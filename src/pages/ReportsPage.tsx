import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, Activity, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { chatwootService } from '@/services/ChatwootService';
import { config } from '@/config';
import * as XLSX from 'xlsx';

const ReportsPage = () => {
    const [isExporting, setIsExporting] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth()).toString());
    const [selectedYear, setSelectedYear] = useState<string>("2026");
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");

    const [inboxes, setInboxes] = useState<any[]>([]);

    useEffect(() => {
        const loadInboxes = async () => {
            try {
                const data = await chatwootService.getInboxes();
                setInboxes(data);
            } catch (error) {
                console.error("Error loading inboxes", error);
            }
        };
        loadInboxes();
    }, []);

    const getInboxDisplayName = (name: string) => {
        switch (name) {
            case 'Monte Midas':
                return 'Facebook - Monte Midas';
            case 'montemidas.ec':
                return 'Instagram - montemidas.ec';
            case 'simplia Monte Midas':
                return 'WhatsApp - simplia Monte Midas';
            default:
                return name;
        }
    };

    const labels = [
        'agenda_cita', 'desea_un_credito', 'interesado', 'no_aplica', 'no_tiene_joyas_oro', 'solicita_informacion', 'tiene_dudas', 'venta_exitosa'
    ];

    const formatLabel = (label: string) => {
        return label;
    };

    const fetchAllConversations = async (startDate: string, endDate: string, inboxId: string) => {
        const payloadParams: any = {
            page: 1,
            since: (new Date(startDate + "T00:00:00").getTime() / 1000).toString(),
        };
        if (inboxId !== 'all') {
            payloadParams.inbox_id = inboxId;
        }

        const data = await chatwootService.getConversations(payloadParams);
        if (!data || !data.payload) {
            console.error("No data payload returned from Chatwoot");
            return [];
        }

        let allConvs = [...data.payload];
        const totalCount = data.meta.all_count || data.meta.count || allConvs.length;
        const startTimestamp = new Date(startDate + "T00:00:00").getTime();

        if (totalCount > 15 && data.payload.length > 0) {
            let cp = 2;
            let maxAttempts = 200;
            while (allConvs.length < totalCount && maxAttempts > 0) {
                const nextParams = { ...payloadParams, page: cp };
                const nextData = await chatwootService.getConversations(nextParams);
                if (!nextData || !nextData.payload || nextData.payload.length === 0) break;

                const newItems = nextData.payload.filter((np: any) => !allConvs.find(c => c.id === np.id));
                if (newItems.length === 0) break;

                const oldestInPage = Math.min(...newItems.map((c: any) => c.timestamp * 1000));
                if (oldestInPage > 0 && oldestInPage < startTimestamp) {
                    allConvs = [...allConvs, ...newItems];
                    break;
                }

                allConvs = [...allConvs, ...newItems];
                cp++;
                maxAttempts--;
            }
        }
        return allConvs;
    };

    const generateExcel = (filteredConvs: any[], createdConvs: any[], labelTitle: string, filename: string, startDate: string, endDate: string) => {
        const labelCounts: Record<string, any> = {};
        const labelCountsUnicas: Record<string, any> = {};

        const detailedHeaders = [
            "ID Conversacion",
            "Nombre del Lead",
            "Telefono/Celular",
            "Canal",
            "Etiquetas",
            "Nombre Completo (Attr)",
            "Fecha Visita",
            "Hora Visita",
            "Agencia",
            "Enlace Chatwoot"
        ];

        if (!labels || !Array.isArray(labels)) return;

        labels.forEach(l => {
            labelCounts[l] = { total: 0 };
            labelCountsUnicas[l] = { total: 0 };
            if (inboxes && Array.isArray(inboxes)) {
                inboxes.forEach(inbox => {
                    labelCounts[l][inbox.id] = 0;
                    labelCountsUnicas[l][inbox.id] = 0;
                });
            }
        });

        filteredConvs.forEach(conv => {
            if (conv && conv.labels && Array.isArray(conv.labels)) {
                conv.labels.forEach((l: string) => {
                    if (labelCounts[l]) {
                        labelCounts[l].total++;
                        if (labelCounts[l][conv.inbox_id] !== undefined) {
                            labelCounts[l][conv.inbox_id]++;
                        } else {
                            labelCounts[l][conv.inbox_id] = 1;
                        }
                    }
                });
            }
        });

        createdConvs.forEach(conv => {
            if (conv && conv.labels && Array.isArray(conv.labels)) {
                conv.labels.forEach((l: string) => {
                    if (labelCountsUnicas[l]) {
                        labelCountsUnicas[l].total++;
                        if (labelCountsUnicas[l][conv.inbox_id] !== undefined) {
                            labelCountsUnicas[l][conv.inbox_id]++;
                        } else {
                            labelCountsUnicas[l][conv.inbox_id] = 1;
                        }
                    }
                });
            }
        });

        // --- SECCIÓN 1: RESUMEN DE ACTIVIDADES ---
        const resumenData: any[][] = [];
        resumenData.push([`Fecha Inicio`, startDate]);
        resumenData.push([`Fecha Fin`, endDate]);
        resumenData.push([]);

        const headerRow1 = ["Etiqueta", "Total"];
        inboxes.forEach(inbox => {
            headerRow1.push(getInboxDisplayName(inbox.name));
        });
        resumenData.push(headerRow1);

        Object.keys(labelCounts).forEach(label => {
            let row = [formatLabel(label), labelCounts[label].total];
            inboxes.forEach(inbox => {
                row.push(labelCounts[label][inbox.id] || 0);
            });
            resumenData.push(row);
        });

        let totalSum = 0;
        const sumPerInbox: Record<number, number> = {};
        inboxes.forEach(inbox => sumPerInbox[inbox.id] = 0);

        Object.keys(labelCounts).forEach(label => {
            totalSum += labelCounts[label].total;
            inboxes.forEach(inbox => {
                sumPerInbox[inbox.id] += (labelCounts[label][inbox.id] || 0);
            });
        });

        let footerRow = [labelTitle.replace('Total Leads', 'Total Etiquetas Asignadas'), totalSum];
        inboxes.forEach(inbox => {
            footerRow.push(sumPerInbox[inbox.id]);
        });
        resumenData.push(footerRow);

        resumenData.push([]);
        resumenData.push([`Total Leads de Actividades`, filteredConvs.length]);

        // --- SECCIÓN 2: DETALLE DE LEADS DE ACTIVIDADES ---
        const detalleData: any[][] = [];
        detalleData.push(detailedHeaders);

        filteredConvs.forEach(conv => {
            const cA = conv.meta?.sender?.custom_attributes || {};
            const vA = conv.custom_attributes || {};

            const inboxName = inboxes.find(i => i.id === conv.inbox_id)?.name || '';
            const canalValue = cA.canal || vA.canal || inboxName || "";

            const hasNativePhone = !!conv.meta?.sender?.phone_number;
            const isWhatsApp = inboxName.toLowerCase().includes('whatsapp') ||
                canalValue.toLowerCase().includes('whatsapp') ||
                hasNativePhone;

            const celularAttr = cA.celular || vA.celular || "";
            let telefonoFinal = celularAttr;
            if (!telefonoFinal && (isWhatsApp || hasNativePhone)) {
                telefonoFinal = conv.meta?.sender?.phone_number || "";
            }

            const rowData = [
                conv.id,
                conv.meta?.sender?.name || 'Sin Nombre',
                telefonoFinal,
                canalValue,
                (conv.labels || []).join(' | '),
                cA.nombre_completo || vA.nombre_completo || "",
                cA.fecha_visita || vA.fecha_visita || "",
                cA.hora_visita || vA.hora_visita || "",
                cA.agencia || vA.agencia || "",
                `${config.chatwoot.publicUrl}/app/accounts/1/conversations/${conv.id}`
            ];

            detalleData.push(rowData);
        });

        // --- SECCIÓN 3: RESUMEN DE ETIQUETAS ÚNICAS ---
        const resumenUnicasData: any[][] = [];
        resumenUnicasData.push([`Fecha Inicio`, startDate]);
        resumenUnicasData.push([`Fecha Fin`, endDate]);
        resumenUnicasData.push([]);

        resumenUnicasData.push(headerRow1);

        Object.keys(labelCountsUnicas).forEach(label => {
            let row = [label, labelCountsUnicas[label].total];
            inboxes.forEach(inbox => {
                row.push(labelCountsUnicas[label][inbox.id] || 0);
            });
            resumenUnicasData.push(row);
        });

        let totalSumUnicas = 0;
        const sumPerInboxUnicas: Record<number, number> = {};
        inboxes.forEach(inbox => sumPerInboxUnicas[inbox.id] = 0);

        Object.keys(labelCountsUnicas).forEach(label => {
            totalSumUnicas += labelCountsUnicas[label].total;
            inboxes.forEach(inbox => {
                sumPerInboxUnicas[inbox.id] += (labelCountsUnicas[label][inbox.id] || 0);
            });
        });

        let footerRowUnicas = ["Total Etiquetas Asignadas", totalSumUnicas];
        inboxes.forEach(inbox => {
            footerRowUnicas.push(sumPerInboxUnicas[inbox.id]);
        });
        resumenUnicasData.push(footerRowUnicas);

        resumenUnicasData.push([]);
        resumenUnicasData.push([`Total Leads Unicos`, createdConvs.length]);

        // --- SECCIÓN 4: CONVERSACIONES ÚNICAS ---
        const nuevasData: any[][] = [];
        nuevasData.push(detailedHeaders);

        createdConvs.forEach(conv => {
            const cA = conv.meta?.sender?.custom_attributes || {};
            const vA = conv.custom_attributes || {};

            const inboxName = inboxes.find(i => i.id === conv.inbox_id)?.name || '';
            const canalValue = cA.canal || vA.canal || inboxName || "";

            const hasNativePhone = !!conv.meta?.sender?.phone_number;
            const isWhatsApp = inboxName.toLowerCase().includes('whatsapp') ||
                canalValue.toLowerCase().includes('whatsapp') ||
                hasNativePhone;

            const celularAttr = cA.celular || vA.celular || "";
            let telefonoFinal = celularAttr;
            if (!telefonoFinal && (isWhatsApp || hasNativePhone)) {
                telefonoFinal = conv.meta?.sender?.phone_number || "";
            }

            const rowData = [
                conv.id,
                conv.meta?.sender?.name || 'Sin Nombre',
                telefonoFinal,
                canalValue,
                (conv.labels || []).join(' | '),
                cA.nombre_completo || vA.nombre_completo || "",
                cA.fecha_visita || vA.fecha_visita || "",
                cA.hora_visita || vA.hora_visita || "",
                cA.agencia || vA.agencia || "",
                `${config.chatwoot.publicUrl}/app/accounts/1/conversations/${conv.id}`
            ];

            nuevasData.push(rowData);
        });

        const wb = XLSX.utils.book_new();
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
        if (wsResumen['!ref']) wsResumen['!autofilter'] = { ref: wsResumen['!ref'] };

        const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
        if (wsDetalle['!ref']) wsDetalle['!autofilter'] = { ref: wsDetalle['!ref'] };

        const wsResumenUnicas = XLSX.utils.aoa_to_sheet(resumenUnicasData);
        if (wsResumenUnicas['!ref']) wsResumenUnicas['!autofilter'] = { ref: wsResumenUnicas['!ref'] };

        const wsNuevas = XLSX.utils.aoa_to_sheet(nuevasData);
        if (wsNuevas['!ref']) wsNuevas['!autofilter'] = { ref: wsNuevas['!ref'] };

        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Etiquetas Actividades");
        XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle Leads Actividades");
        XLSX.utils.book_append_sheet(wb, wsResumenUnicas, "Resumen Etiquetas Unicas");
        XLSX.utils.book_append_sheet(wb, wsNuevas, "Detalle Leads Unicas");

        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const downloadReport = async (start: string, end: string, type: 'hoy' | 'mes' | 'rango') => {
        setIsExporting(true);
        const toastId = toast.loading(`Descargando reporte de ${type}...`);
        try {
            const allConvs = await fetchAllConversations(start, end, 'all');
            const startTimestamp = new Date(start + "T00:00:00").getTime();
            const endTimestamp = new Date(end + "T23:59:59").getTime();

            const filteredConvs = allConvs.filter(conv => {
                const convTime = conv.timestamp * 1000;
                return convTime >= startTimestamp && convTime <= endTimestamp;
            });

            const createdConvs = allConvs.filter(conv => {
                const creationTime = (conv.created_at || conv.timestamp) * 1000;
                return creationTime >= startTimestamp && creationTime <= endTimestamp;
            });

            generateExcel(filteredConvs, createdConvs, `Total Leads con Actividad (${type})`, `reporte_avance_monte_midas_${type}`, start, end);
            toast.success('Reporte exportado correctamente', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al exportar el reporte', { id: toastId });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadToday = () => {
        const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' }).split(' ')[0];
        downloadReport(todayStr, todayStr, 'hoy');
    };

    const handleDownloadMonth = () => {
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        downloadReport(startStr, endStr, 'mes');
    };

    const handleDownloadCustomDate = () => {
        if (!customStartDate || !customEndDate) {
            toast.error("Selecciona fecha de inicio y fin");
            return;
        }
        if (new Date(customStartDate) > new Date(customEndDate)) {
            toast.error("La fecha de inicio debe ser menor o igual a la de fin");
            return;
        }
        downloadReport(customStartDate, customEndDate, 'rango');
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">

                <Card className="border-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                            <Activity className="w-5 h-5" />
                            Reporte de Interacciones - Monte Midas
                        </CardTitle>
                        <CardDescription>
                            Filtra prospectos activos en este rango, incluyendo aquellos creados en el pasado pero que <strong>tuvieron actividad u otra etiqueta</strong> hoy.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-8">

                            <div className="space-y-3 bg-slate-50/50 p-5 rounded-lg border border-border">
                                <div>
                                    <h3 className="font-medium text-foreground flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-primary" />
                                        Reporte Diario
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Descarga el reporte de interacciones para el día de hoy ({new Date().toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' }).split(' ')[0]}).
                                    </p>
                                </div>
                                <Button
                                    className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white"
                                    disabled={isExporting}
                                    onClick={handleDownloadToday}
                                >
                                    {isExporting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                                    ) : (
                                        <><Download className="w-4 h-4" /> Generar reporte de hoy</>
                                    )}
                                </Button>
                            </div>

                            <div className="space-y-4 bg-slate-50/50 p-5 rounded-lg border border-border">
                                <div>
                                    <h3 className="font-medium text-foreground flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-primary" />
                                        Reporte Mensual
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Genera un resumen acumulado de todo un mes.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 items-end">
                                    <div className="space-y-1 w-full sm:w-auto">
                                        <label className="text-sm font-medium text-muted-foreground">Mes</label>
                                        <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isExporting}>
                                            <SelectTrigger className="w-full sm:w-[150px]">
                                                <SelectValue placeholder="Mes" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[
                                                    { v: "0", l: "Enero" }, { v: "1", l: "Febrero" },
                                                    { v: "2", l: "Marzo" }, { v: "3", l: "Abril" },
                                                    { v: "4", l: "Mayo" }, { v: "5", l: "Junio" },
                                                    { v: "6", l: "Julio" }, { v: "7", l: "Agosto" },
                                                    { v: "8", l: "Septiembre" }, { v: "9", l: "Octubre" },
                                                    { v: "10", l: "Noviembre" }, { v: "11", l: "Diciembre" }
                                                ].map(m => (
                                                    <SelectItem key={m.v} value={m.v}>
                                                        {m.l}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1 w-full sm:w-auto">
                                        <label className="text-sm font-medium text-muted-foreground">Año</label>
                                        <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isExporting}>
                                            <SelectTrigger className="w-full sm:w-[120px]">
                                                <SelectValue placeholder="Año" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="2026">2026</SelectItem>
                                                <SelectItem value="2027">2027</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white mt-4 sm:mt-0"
                                        disabled={isExporting}
                                        onClick={handleDownloadMonth}
                                    >
                                        {isExporting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                                        ) : (
                                            <><Download className="w-4 h-4" /> Generar reporte del mes</>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4 bg-slate-50/50 p-5 rounded-lg border border-border">
                                <div>
                                    <h3 className="font-medium text-foreground flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-primary" />
                                        Reporte por Fechas
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Genera un resumen para un rango de fechas específico.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 items-end">
                                    <div className="space-y-1 w-full sm:w-auto">
                                        <label className="text-sm font-medium text-muted-foreground">Fecha Inicio</label>
                                        <input
                                            type="date"
                                            className="flex h-10 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            disabled={isExporting}
                                        />
                                    </div>
                                    <div className="space-y-1 w-full sm:w-auto">
                                        <label className="text-sm font-medium text-muted-foreground">Fecha Fin</label>
                                        <input
                                            type="date"
                                            className="flex h-10 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            disabled={isExporting}
                                        />
                                    </div>
                                    <Button
                                        className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white mt-4 sm:mt-0"
                                        disabled={isExporting}
                                        onClick={handleDownloadCustomDate}
                                    >
                                        {isExporting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                                        ) : (
                                            <><Download className="w-4 h-4" /> Generar reporte</>
                                        )}
                                    </Button>
                                </div>
                            </div>

                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ReportsPage;
