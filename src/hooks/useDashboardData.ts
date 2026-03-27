import { useState, useEffect, useRef } from 'react';
import { chatwootService } from '../services/ChatwootService';

const CACHE_KEY = 'implanta_dashboard_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedData {
    timestamp: number;
    data: any;
}

const getDefaultData = () => ({
    kpis: {
        totalLeads: 0,
        leadsInteresados: 0,
        citasAgendadas: 0,
        deseaCreditoCount: 0,
        noCalifican: 0,
        tasaAgendamiento: 0,
        tasaDescarte: 0,
        tasaRespuesta: 0,
        gananciaMensual: 0,
        gananciaTotal: 0
    },
    funnelData: [] as any[],
    recentAppointments: [] as any[],
    channelData: [] as any[],
    weeklyTrend: [] as any[],
    monthlyTrend: [] as any[],
    disqualificationReasons: [] as any[],
    dataCapture: {
        completionRate: 0,
        fieldRates: [] as any[],
        incomplete: 0,
        funnelDropoff: 0
    },
    responseTime: 0,
    availableChannels: [] as string[],
    conversationsWithChannel: [] as any[]
});

const loadFromCache = (): any | null => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached: CachedData = JSON.parse(raw);
        // Return cache even if stale - we'll refresh in background
        return cached.data;
    } catch {
        return null;
    }
};

const saveToCache = (data: any) => {
    try {
        const cached: CachedData = { timestamp: Date.now(), data };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch {
        // localStorage full or unavailable - ignore
    }
};

export const useDashboardData = (selectedMonth: Date | null = null, selectedWeek: string = "1") => {
    const cachedData = useRef(loadFromCache());
    const rawConversationsCache = useRef<any[]>([]);
    const lastSyncRef = useRef<number>(0);
    const isFetchingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [loading, setLoading] = useState(!cachedData.current);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState(cachedData.current || getDefaultData());

    const fetchData = async (isBackground = false) => {
        // Prevent concurrent executions and allow cancellation
        if (isFetchingRef.current && !isBackground) return;
        if (isBackground && isFetchingRef.current) return;

        isFetchingRef.current = true;

        // Cancel previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        if (!isBackground && !cachedData.current && rawConversationsCache.current.length === 0) {
            setLoading(true);
        }
        try {
            setError(null);
            // 1. Determine Global Filter Range (for KPIs, Funnel, etc.)
            let globalStart: Date;
            let globalEnd: Date;

            if (selectedMonth) {
                globalStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
                globalEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);
            } else {
                // All Time (Default: Jan 1 2026 to Now)
                globalStart = new Date(2026, 0, 1); // Jan 1, 2026
                globalEnd = new Date(); // Now
            }

            // 2. Determine Monthly Trend Range (Specific requirement: Show Current Month if "All Time" is selected)
            let trendStart: Date;
            let trendEnd: Date;

            if (selectedMonth) {
                trendStart = globalStart;
                trendEnd = globalEnd;
            } else {
                // If "All Time" selected, show Current Month for trend
                const now = new Date();
                trendStart = new Date(now.getFullYear(), now.getMonth(), 1);
                trendEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            }

            // 3. Fetch conversations + inboxes in PARALLEL
            const [firstPageResponse, inboxes] = await Promise.all([
                chatwootService.getConversations({ status: 'all', page: 1, signal }),
                chatwootService.getInboxes()
            ]);

            const processAndSetData = (allConversations: any[], currentInboxes: any[]) => {
                // Calculate KPIs from filtered data
                const inboxMap = new Map(currentInboxes.map((inbox: any) => [inbox.id, inbox]));

                const getChannelName = (inboxId: number): string => {
                    const inbox = inboxMap.get(inboxId);
                    if (!inbox) return 'Otros';
                    const type = inbox.channel_type;
                    if (type === 'Channel::Whatsapp') return 'WhatsApp';
                    if (type === 'Channel::FacebookPage') return 'Facebook';
                    if (type === 'Channel::Instagram') return 'Instagram';
                    return inbox.name;
                };

                const parseMonto = (val: any): number => {
                    if (!val) return 0;
                    const clean = val.toString().replace(/[^0-9.]/g, '');
                    const num = parseFloat(clean);
                    return isNaN(num) ? 0 : num;
                };

                // Date filtering
                const kpiConversations = allConversations.filter(conv => {
                    const convDate = new Date(conv.timestamp * 1000);
                    return convDate >= globalStart && convDate <= globalEnd;
                });

                const totalLeads = kpiConversations.length;
                const countByLabel = (label: string) => kpiConversations.filter(c => c.labels && c.labels.includes(label)).length;

                const interesadoCount = countByLabel('Interesado');
                const crearConfianzaCount = countByLabel('crear_confianza');
                const crearUrgenciaCount = countByLabel('crear_urgencia');
                const desinteresadoCount = countByLabel('desinteresado');
                const citasAgendadas = countByLabel('cita_agendada');
                const citasAgendadasJess = countByLabel('cita_agendada_jess');
                const ventaExitosa = countByLabel('venta_exitosa');
                const totalCitas = citasAgendadas + citasAgendadasJess;

                let gananciaMensual = 0;
                let gananciaTotal = allConversations.reduce((sum, conv) => {
                    const cA = conv.meta?.sender?.custom_attributes || {};
                    const vA = conv.custom_attributes || {};
                    const m = parseMonto(cA.monto_operacion || vA.monto_operacion);

                    if (m > 0) {
                        const fMStr = cA.fecha_monto_operacion || vA.fecha_monto_operacion;
                        const fM = fMStr ? new Date(fMStr) : new Date(conv.timestamp * 1000);
                        if (fM >= globalStart && fM <= globalEnd) gananciaMensual += m;
                    }
                    return sum + m;
                }, 0);

                const recentAppointments = kpiConversations
                    .filter(c => c.labels && (c.labels.includes('cita_agendada') || c.labels.includes('cita_agendada_jess')))
                    .slice(0, 5)
                    .map(conv => {
                        const cA = conv.meta?.sender?.custom_attributes || {};
                        const vA = conv.custom_attributes || {};
                        return {
                            id: conv.id,
                            nombre: cA.nombre_completo || vA.nombre_completo || conv.meta?.sender?.name || 'Sin Nombre',
                            celular: cA.celular || vA.celular || conv.meta?.sender?.phone_number || 'Sin Celular',
                            agencia: cA.agencia || vA.agencia || 'Sin Agencia',
                            fecha: cA.fecha_visita || vA.fecha_visita || cA.fecha || vA.fecha || 'Pendiente',
                            hora: cA.hora_visita || vA.hora_visita || cA.hora || vA.hora || '',
                            canal: cA.canal || vA.canal || getChannelName(conv.inbox_id),
                            status: 'Confirmada'
                        };
                    });

                const conversationsWithChannel = kpiConversations.map(conv => ({
                    ...conv,
                    _channelName: getChannelName(conv.inbox_id)
                }));

                const channelCounts = new Map<string, number>();
                conversationsWithChannel.forEach(c => channelCounts.set(c._channelName, (channelCounts.get(c._channelName) || 0) + 1));

                const channelData = Array.from(channelCounts.entries()).map(([name, count]) => ({
                    name, count, percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
                    icon: name === 'WhatsApp' ? 'MessageCircle' : (name === 'Facebook' ? 'Facebook' : (name === 'Instagram' ? 'Instagram' : 'MessageCircle')),
                    color: name === 'WhatsApp' ? 'bg-green-500' : (name === 'Facebook' ? 'bg-blue-600' : (name === 'Instagram' ? 'bg-pink-600' : 'bg-gray-500'))
                }));

                const getWeekNum = (d: Date) => {
                    const first = new Date(d.getFullYear(), d.getMonth(), 1);
                    return Math.ceil(((d.getTime() - first.getTime()) / 86400000 + first.getDay() + 1) / 7);
                };

                const targetW = parseInt(selectedWeek);
                const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                const weeklyTrend = days.map(day => {
                    const stats = { leads: 0, Interesado: 0, crear_confianza: 0, crear_urgencia: 0, cita_agendada: 0, cita_agendada_jess: 0, desinteresado: 0, venta_exitosa: 0 };
                    allConversations.filter(c => {
                        const d = new Date(c.timestamp * 1000);
                        return d >= trendStart && d <= trendEnd && getWeekNum(d) === targetW && days[d.getDay()] === day;
                    }).forEach(c => {
                        stats.leads++;
                        ['Interesado', 'crear_confianza', 'crear_urgencia', 'cita_agendada', 'cita_agendada_jess', 'desinteresado', 'venta_exitosa'].forEach(l => {
                            if (c.labels?.includes(l)) (stats as any)[l]++;
                        });
                    });
                    return { week: day, ...stats };
                });

                const monthlyTrendMap = new Map();
                for (let i = 1; i <= 5; i++) monthlyTrendMap.set(`Sem ${i}`, { leads: 0, sqls: 0, citas: 0 });
                allConversations.filter(c => {
                    const d = new Date(c.timestamp * 1000);
                    return d >= trendStart && d <= trendEnd;
                }).forEach(c => {
                    const wTitle = `Sem ${getWeekNum(new Date(c.timestamp * 1000))}`;
                    if (monthlyTrendMap.has(wTitle)) {
                        const curr = monthlyTrendMap.get(wTitle);
                        curr.leads++;
                        if (c.labels?.some((l: string) => ['Interesado', 'crear_confianza', 'crear_urgencia'].includes(l))) curr.sqls++;
                        if (c.labels?.some((l: string) => ['cita_agendada', 'cita_agendada_jess'].includes(l))) curr.citas++;
                    }
                });

                const fieldsDC = ['nombre_completo', 'celular', 'agencia', 'fecha_visita', 'hora_visita', 'correo', 'ciudad', 'campana', 'edad'];
                const targetDC = kpiConversations.filter(c => c.labels?.some((l: string) => ['Interesado', 'crear_confianza', 'crear_urgencia', 'cita_agendada', 'cita_agendada_jess'].includes(l)));
                let completeDC = 0, incompleteDC = 0;
                const fieldCountsDC = fieldsDC.map(f => ({ field: f, count: 0 }));

                targetDC.forEach(c => {
                    const attrs = { ...c.custom_attributes, ...c.meta?.sender?.custom_attributes };
                    let count = 0;
                    fieldsDC.forEach(f => { if (attrs[f]) { count++; const item = fieldCountsDC.find(i => i.field === f); if (item) item.count++; } });
                    if (count === fieldsDC.length) completeDC++; else if (count > 0) incompleteDC++;
                });

                const newData = {
                    kpis: {
                        totalLeads, leadsInteresados: interesadoCount, citasAgendadas: totalCitas,
                        deseaCreditoCount: 0, noCalifican: desinteresadoCount,
                        tasaAgendamiento: totalLeads > 0 ? Math.round((totalCitas / totalLeads) * 100) : 0,
                        tasaDescarte: totalLeads > 0 ? Math.round((desinteresadoCount / totalLeads) * 100) : 0,
                        tasaRespuesta: totalLeads > 0 ? Math.round((allConversations.filter(c => c.status !== 'new').length / totalLeads) * 100) : 0,
                        gananciaMensual, gananciaTotal
                    },
                    funnelData: [
                        { label: "Interesado", value: interesadoCount, percentage: totalLeads > 0 ? Math.round((interesadoCount / totalLeads) * 100) : 0, color: "hsl(224, 62%, 32%)" },
                        { label: "Crear Confianza", value: crearConfianzaCount, percentage: totalLeads > 0 ? Math.round((crearConfianzaCount / totalLeads) * 100) : 0, color: "hsl(142, 60%, 45%)" },
                        { label: "Crear Urgencia", value: crearUrgenciaCount, percentage: totalLeads > 0 ? Math.round((crearUrgenciaCount / totalLeads) * 100) : 0, color: "hsl(142, 60%, 55%)" },
                        { label: "Cita Agendada", value: citasAgendadas, percentage: totalLeads > 0 ? Math.round((citasAgendadas / totalLeads) * 100) : 0, color: "hsl(45, 93%, 58%)" },
                        { label: "Cita Agendada Jess", value: citasAgendadasJess, percentage: totalLeads > 0 ? Math.round((citasAgendadasJess / totalLeads) * 100) : 0, color: "hsl(35, 93%, 50%)" },
                        { label: "Desinteresado", value: desinteresadoCount, percentage: totalLeads > 0 ? Math.round((desinteresadoCount / totalLeads) * 100) : 0, color: "hsl(0, 70%, 60%)" },
                        { label: "Venta Exitosa", value: ventaExitosa, percentage: totalLeads > 0 ? Math.round((ventaExitosa / totalLeads) * 100) : 0, color: "hsl(160, 84%, 39%)" },
                    ],
                    recentAppointments, channelData, weeklyTrend,
                    monthlyTrend: Array.from(monthlyTrendMap.entries()).map(([date, counts]) => ({ date, ...counts })),
                    disqualificationReasons: [{ reason: "Descartados", count: desinteresadoCount, percentage: 100 }],
                    dataCapture: {
                        completionRate: targetDC.length > 0 ? Math.round((completeDC / targetDC.length) * 100) : 0,
                        fieldRates: fieldCountsDC.map(f => ({ field: f.field, rate: targetDC.length > 0 ? Math.round((f.count / targetDC.length) * 100) : 0 })).sort((a, b) => b.rate - a.rate),
                        incomplete: incompleteDC, funnelDropoff: 0
                    },
                    responseTime: 2.5, // Fallback literal for performance
                    availableChannels: Array.from(channelCounts.keys()).sort(),
                    conversationsWithChannel
                };

                setData(newData);
                saveToCache(newData);
            };

            let allConversationsRaw = rawConversationsCache.current;
            const currentSyncTimestamp = Date.now() / 1000;

            const fetchPageWithRetry = async (page: number, attempt = 0): Promise<any> => {
                try {
                    return await chatwootService.getConversations({ status: 'all', page, signal });
                } catch (err: any) {
                    if (attempt < 2) {
                        await new Promise(res => setTimeout(res, 800 * (attempt + 1)));
                        return fetchPageWithRetry(page, attempt + 1);
                    }
                    throw err;
                }
            };

            // 12. Orchestrate sync
            if (allConversationsRaw.length === 0 || !isBackground) {
                const firstPayload = Array.isArray(firstPageResponse) ? firstPageResponse : (firstPageResponse.payload || []);
                allConversationsRaw = [...firstPayload];

                // UX: Show first page immediately
                processAndSetData(allConversationsRaw, inboxes);
                setLoading(false);

                if (firstPayload.length >= 25) {
                    let currentPage = 2;
                    let keepFetching = true;

                    while (keepFetching) {
                        console.log(`[PROGRESS] Cargando lote desde pág ${currentPage}...`);
                        const results = await Promise.all([currentPage, currentPage + 1, currentPage + 2].map(p => fetchPageWithRetry(p)));

                        let batchSize = 0;
                        for (const r of results) {
                            const pLoad = Array.isArray(r) ? r : (r?.payload || []);
                            if (pLoad.length === 0) { keepFetching = false; break; }
                            allConversationsRaw = [...allConversationsRaw, ...pLoad];
                            batchSize += pLoad.length;
                            if (pLoad.length < 25) { keepFetching = false; break; }
                        }

                        if (batchSize > 0) processAndSetData(allConversationsRaw, inboxes);
                        if (keepFetching) {
                            currentPage += 3;
                            await new Promise(res => setTimeout(res, 300));
                        }
                    }
                }
            } else {
                // Delta sync
                const firstPayload = Array.isArray(firstPageResponse) ? firstPageResponse : (firstPageResponse.payload || []);
                let newItems = [...firstPayload];
                const oldest = firstPayload.length > 0 ? Math.min(...firstPayload.map((c: any) => c.timestamp)) : 0;

                if (firstPayload.length >= 25 && oldest > lastSyncRef.current) {
                    let cp = 2;
                    while (true) {
                        const r = await chatwootService.getConversations({ status: 'all', page: cp, signal });
                        const p = Array.isArray(r) ? r : (r?.payload || []);
                        if (p.length === 0) break;
                        newItems = [...newItems, ...p];
                        if (Math.min(...p.map((c: any) => c.timestamp)) <= lastSyncRef.current || p.length < 25) break;
                        cp++;
                        await new Promise(res => setTimeout(res, 200));
                    }
                }
                const idMap = new Map(allConversationsRaw.map(c => [c.id, c]));
                newItems.forEach(c => idMap.set(c.id, c));
                allConversationsRaw = Array.from(idMap.values());
                processAndSetData(allConversationsRaw, inboxes);
            }

            rawConversationsCache.current = allConversationsRaw;
            lastSyncRef.current = currentSyncTimestamp;
            setLoading(false);
            setError(null);
        } catch (err: any) {
            // Re-throw or ignore cancellation errors
            if (err.name === 'CanceledError' || err.name === 'AbortError') {
                console.log('Fetch canceled');
                return;
            }

            console.error('Error loading dashboard data:', err);
            // Only show error if we don't have cached data to display
            if (!cachedData.current) {
                setError(`Error de servidor (500). Reintentando...`);
            }
            setLoading(false);
        } finally {
            isFetchingRef.current = false;
        }
    };

    useEffect(() => {
        fetchData(!!cachedData.current); // If we have cache, fetch in background
        const interval = setInterval(() => fetchData(true), 15000); // Poll every 15s in background
        return () => {
            clearInterval(interval);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [selectedMonth, selectedWeek]); // Re-fetch when month or week changes

    const refetch = () => {
        cachedData.current = null; // Force showing loader
        fetchData(false);
    };

    return { loading, error, data, refetch };
};
