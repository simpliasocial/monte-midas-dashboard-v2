import { useMemo } from 'react';
import { useDashboardContext } from '../contexts/DashboardDataContext';

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

export const useDashboardData = (selectedMonth: Date | null = null, selectedWeek: string = "1") => {
    const { conversations, inboxes, loading, error, refetch, isSyncing, fetchProgress } = useDashboardContext();

    const data = useMemo(() => {
        if (!conversations.length || !inboxes.length) return getDefaultData();

        let globalStart: Date;
        let globalEnd: Date;
        if (selectedMonth) {
            globalStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
            globalEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);
        } else {
            globalStart = new Date(2026, 0, 1);
            globalEnd = new Date();
        }

        let trendStart: Date;
        let trendEnd: Date;
        if (selectedMonth) {
            trendStart = globalStart;
            trendEnd = globalEnd;
        } else {
            const now = new Date();
            trendStart = new Date(now.getFullYear(), now.getMonth(), 1);
            trendEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        const inboxMap = new Map(inboxes.map((inbox: any) => [inbox.id, inbox]));

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

        const kpiConversations = conversations.filter(conv => {
            const convDate = new Date(conv.timestamp * 1000);
            return convDate >= globalStart && convDate <= globalEnd;
        });

        const totalLeads = kpiConversations.length;
        const countByLabel = (label: string) => kpiConversations.filter(c => c.labels && c.labels.includes(label)).length;

        const interesadoCount = countByLabel('interesado');
        const deseaCreditoCount = countByLabel('desea_un_credito');
        const solicitaInformacionCount = countByLabel('solicita_informacion');
        const tieneDudasCount = countByLabel('tiene_dudas');
        const noAplicaCount = countByLabel('no_aplica');
        const noTieneJoyasOroCount = countByLabel('no_tiene_joyas_oro');
        const agendaCitaCount = countByLabel('agenda_cita');

        const totalCitas = agendaCitaCount;
        const noCalifican = noAplicaCount + noTieneJoyasOroCount;

        let gananciaMensual = 0;
        let gananciaTotal = conversations.reduce((sum, conv) => {
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
            .filter(c => c.labels && (c.labels.includes('agenda_cita')))
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
            const stats = { leads: 0, interesado: 0, desea_un_credito: 0, agenda_cita: 0, no_aplica: 0, venta_exitosa: 0 };
            conversations.filter(c => {
                const d = new Date(c.timestamp * 1000);
                return d >= trendStart && d <= trendEnd && getWeekNum(d) === targetW && days[d.getDay()] === day;
            }).forEach(c => {
                stats.leads++;
                ['interesado', 'desea_un_credito', 'agenda_cita', 'no_aplica', 'venta_exitosa'].forEach(l => {
                    if (c.labels?.includes(l)) (stats as any)[l]++;
                });
            });
            return { week: day, ...stats };
        });

        const monthlyTrendMap = new Map();
        for (let i = 1; i <= 5; i++) monthlyTrendMap.set(`Sem ${i}`, { leads: 0, sqls: 0, citas: 0 });
        conversations.filter(c => {
            const d = new Date(c.timestamp * 1000);
            return d >= trendStart && d <= trendEnd;
        }).forEach(c => {
            const wTitle = `Sem ${getWeekNum(new Date(c.timestamp * 1000))}`;
            if (monthlyTrendMap.has(wTitle)) {
                const curr = monthlyTrendMap.get(wTitle);
                curr.leads++;
                if (c.labels?.some((l: string) => ['interesado', 'desea_un_credito'].includes(l))) curr.sqls++;
                if (c.labels?.some((l: string) => ['agenda_cita'].includes(l))) curr.citas++;
            }
        });

        const fieldsDC = ['agente', 'nombre_completo', 'celular', 'agencia', 'fecha_visita', 'hora_visita', 'score_interes', 'canal', 'monto_operacion'];
        const targetDC = kpiConversations.filter(c => c.labels?.some((l: string) => ['interesado', 'desea_un_credito', 'agenda_cita'].includes(l)));
        let completeDC = 0, incompleteDC = 0;
        const fieldCountsDC = fieldsDC.map(f => ({ field: f, count: 0 }));

        targetDC.forEach(c => {
            const attrs = { ...c.custom_attributes, ...c.meta?.sender?.custom_attributes };
            let count = 0;
            fieldsDC.forEach(f => { if (attrs[f]) { count++; const item = fieldCountsDC.find(i => i.field === f); if (item) item.count++; } });
            if (count === fieldsDC.length) completeDC++; else if (count > 0) incompleteDC++;
        });

        return {
            kpis: {
                totalLeads, leadsInteresados: interesadoCount, citasAgendadas: totalCitas,
                deseaCreditoCount: deseaCreditoCount, noCalifican: noCalifican,
                tasaAgendamiento: totalLeads > 0 ? Math.round((totalCitas / totalLeads) * 100) : 0,
                tasaDescarte: totalLeads > 0 ? Math.round((noCalifican / totalLeads) * 100) : 0,
                tasaRespuesta: totalLeads > 0 ? Math.round((conversations.filter(c => c.status !== 'new').length / totalLeads) * 100) : 0,
                gananciaMensual, gananciaTotal
            },
            funnelData: [
                { label: "interesado", value: interesadoCount, percentage: totalLeads > 0 ? Math.round((interesadoCount / totalLeads) * 100) : 0, color: "hsl(224, 62%, 32%)" },
                { label: "desea_un_credito", value: deseaCreditoCount, percentage: totalLeads > 0 ? Math.round((deseaCreditoCount / totalLeads) * 100) : 0, color: "hsl(210, 80%, 45%)" },
                { label: "solicita_informacion", value: solicitaInformacionCount, percentage: totalLeads > 0 ? Math.round((solicitaInformacionCount / totalLeads) * 100) : 0, color: "hsl(260, 60%, 50%)" },
                { label: "tiene_dudas", value: tieneDudasCount, percentage: totalLeads > 0 ? Math.round((tieneDudasCount / totalLeads) * 100) : 0, color: "hsl(280, 50%, 60%)" },
                { label: "agenda_cita", value: agendaCitaCount, percentage: totalLeads > 0 ? Math.round((agendaCitaCount / totalLeads) * 100) : 0, color: "hsl(45, 93%, 58%)" },
                { label: "no_aplica", value: noAplicaCount, percentage: totalLeads > 0 ? Math.round((noAplicaCount / totalLeads) * 100) : 0, color: "hsl(0, 70%, 60%)" },
                { label: "no_tiene_joyas_oro", value: noTieneJoyasOroCount, percentage: totalLeads > 0 ? Math.round((noTieneJoyasOroCount / totalLeads) * 100) : 0, color: "hsl(340, 70%, 60%)" },
                { label: "venta_exitosa", value: countByLabel('venta_exitosa'), percentage: totalLeads > 0 ? Math.round((countByLabel('venta_exitosa') / totalLeads) * 100) : 0, color: "hsl(160, 84%, 39%)" },
            ],
            recentAppointments, channelData, weeklyTrend,
            monthlyTrend: Array.from(monthlyTrendMap.entries()).map(([date, counts]) => ({ date, ...counts })),
            disqualificationReasons: [
                { reason: "no_aplica", count: noAplicaCount, percentage: noCalifican > 0 ? Math.round((noAplicaCount / noCalifican) * 100) : 0 },
                { reason: "no_tiene_joyas_oro", count: noTieneJoyasOroCount, percentage: noCalifican > 0 ? Math.round((noTieneJoyasOroCount / noCalifican) * 100) : 0 },
            ],
            dataCapture: {
                completionRate: targetDC.length > 0 ? Math.round((completeDC / targetDC.length) * 100) : 0,
                fieldRates: fieldCountsDC.map(f => ({ field: f.field, rate: targetDC.length > 0 ? Math.round((f.count / targetDC.length) * 100) : 0 })).sort((a, b) => b.rate - a.rate),
                incomplete: incompleteDC, funnelDropoff: 0
            },
            responseTime: 2.5,
            availableChannels: Array.from(channelCounts.keys()).sort(),
            conversationsWithChannel
        };
    }, [conversations, inboxes, selectedMonth, selectedWeek]);

    return { loading, error, data, refetch, isSyncing, fetchProgress };
};

