import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, Activity, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { chatwootService } from '@/services/ChatwootService';

const ReportsPage = () => {
    const [isExporting, setIsExporting] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth()).toString());
    const [selectedYear, setSelectedYear] = useState<string>("2026");

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
            case 'Implanta':
                return 'Facebook - Implanta';
            case 'implanta.clinic':
                return 'Instagram - implanta.clinic';
            case 'simplia Implanta':
                return 'WhatsApp - simplia Implanta';
            default:
                return name;
        }
    };

    const labels = [
        'interesado', 'crear_confianza', 'crear_urgencia', 'desinteresado', 'cita_agendada', 'cita_agendada_jess', 'venta_exitosa'
    ];

    const fetchAllConversations = async (startDate: string, endDate: string, inboxId: string) => {
        const payloadParams: any = {
            page: 1,
            since: (new Date(startDate + "T00:00:00").getTime() / 1000).toString(),
            // No enviamos 'until' al API porque Chatwoot filtraría leads históricos si tuvieron actividad posterior al 'endDate'
        };
        if (inboxId !== 'all') {
            payloadParams.inbox_id = inboxId;
        }

        const data = await chatwootService.getConversations(payloadParams);

        let allConvs = [...data.payload];
        const totalCount = data.meta.all_count || data.meta.count || allConvs.length;
        const startTimestamp = new Date(startDate + "T00:00:00").getTime();

        if (totalCount > 15 && data.payload.length > 0) {
            let cp = 2;
            let maxAttempts = 200; // Incrementado masivamente para soportar barrer históricos sin truncamientos
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

    const generateCSV = (filteredConvs: any[], labelTitle: string, filename: string, startDate: string, endDate: string) => {
        const labelCounts: Record<string, any> = {};

        labels.forEach(l => {
            labelCounts[l] = { total: 0 };
            inboxes.forEach(inbox => {
                labelCounts[l][inbox.id] = 0;
            });
        });

        filteredConvs.forEach(conv => {
            if (conv.labels) {
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

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Resumen de Etiquetas\n";
        csvContent += `Fecha Inicio,${startDate}\n`;
        csvContent += `Fecha Fin,${endDate}\n\n`;

        // HEADER ROW
        let headerRow = "Etiqueta,Total";
        inboxes.forEach(inbox => {
            headerRow += `,${getInboxDisplayName(inbox.name)}`;
        });
        csvContent += headerRow + "\n";

        Object.keys(labelCounts).forEach(label => {
            let row = `${label},${labelCounts[label].total}`;
            inboxes.forEach(inbox => {
                row += `,${labelCounts[label][inbox.id] || 0}`;
            });
            csvContent += row + "\n";
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

        let footerRow = `${labelTitle},${totalSum}`;
        inboxes.forEach(inbox => {
            footerRow += `,${sumPerInbox[inbox.id]}`;
        });

        csvContent += `\n${footerRow}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const downloadReport = async (start: string, end: string, type: 'hoy' | 'mes') => {
        setIsExporting(true);
        const toastId = toast.loading(`Descargando reporte de ${type}...`);
        try {
            const allConvs = await fetchAllConversations(start, end, 'all');
            const startTimestamp = new Date(start + "T00:00:00").getTime();
            // Para el final del día:
            const endTimestamp = new Date(end + "T23:59:59").getTime();

            // Filtrar por ÚLTIMA ACTIVIDAD (timestamp)
            const filteredConvs = allConvs.filter(conv => {
                const convTime = conv.timestamp * 1000;
                return convTime >= startTimestamp && convTime <= endTimestamp;
            });

            generateCSV(filteredConvs, `Total Leads con Actividad (${type})`, `reporte_avance_${type}`, start, end);
            toast.success('Reporte exportado correctamente', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al exportar el reporte', { id: toastId });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadToday = () => {
        // Generar en formato YYYY-MM-DD
        const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' }).split(' ')[0];
        downloadReport(todayStr, todayStr, 'hoy');
    };

    const handleDownloadMonth = () => {
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Formatear localmente para evitar desfases de UTC
        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        downloadReport(startStr, endStr, 'mes');
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">

                <Card className="border-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                            <Activity className="w-5 h-5" />
                            Reporte de Interacciones
                        </CardTitle>
                        <CardDescription>
                            Filtra prospectos activos en este rango, incluyendo aquellos creados en el pasado pero que <strong>tuvieron actividad u otra etiqueta</strong> hoy.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-8">

                            {/* Opción 1: Reporte de Hoy */}
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

                            {/* Opción 2: Reporte del Mes */}
                            <div className="space-y-4 bg-slate-50/50 p-5 rounded-lg border border-border">
                                <div>
                                    <h3 className="font-medium text-foreground flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-primary" />
                                        Reporte Mensual
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Genera un resumen acumulado de todo un mes. El negocio empezó en marzo de 2026.
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
                                                    <SelectItem key={m.v} value={m.v} disabled={parseInt(m.v) < 2 && selectedYear === "2026"}>
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

                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ReportsPage;
