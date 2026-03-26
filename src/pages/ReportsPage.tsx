import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Loader2, Users, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { chatwootService } from '@/services/ChatwootService';

const ReportsPage = () => {
    // State for Report 1
    const [startDate1, setStartDate1] = useState('');
    const [endDate1, setEndDate1] = useState('');
    const [isExporting1, setIsExporting1] = useState(false);

    // State for Report 2
    const [startDate2, setStartDate2] = useState('');
    const [endDate2, setEndDate2] = useState('');
    const [isExporting2, setIsExporting2] = useState(false);

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
        'a_', 'b1', 'b2', 'c1', 'cita_agendada', 'cita_agendadajess', 'leads_entrantes', 'venta_exitosa'
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

    const downloadReport1 = async () => {
        setIsExporting1(true);
        const toastId = toast.loading('Descargando datos de leads nuevos...');
        try {
            const allConvs = await fetchAllConversations(startDate1, endDate1, 'all');
            const startTimestamp = new Date(startDate1 + "T00:00:00").getTime();
            const endTimestamp = new Date(endDate1 + "T23:59:59").getTime();

            // Lógica Reporte 1: Filtrar por fecha de CREACIÓN
            const filteredConvs = allConvs.filter(conv => {
                const convTime = (conv.created_at ? conv.created_at : conv.timestamp) * 1000;
                return convTime >= startTimestamp && convTime <= endTimestamp;
            });

            generateCSV(filteredConvs, "Conversaciones Nuevas (Leads)", "reporte_leads_nuevos", startDate1, endDate1);
            toast.success('Reporte exportado correctamente', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al exportar el reporte', { id: toastId });
        } finally {
            setIsExporting1(false);
        }
    };

    const downloadReport2 = async () => {
        setIsExporting2(true);
        const toastId = toast.loading('Descargando datos de avance e interacciones...');
        try {
            const allConvs = await fetchAllConversations(startDate2, endDate2, 'all');
            const startTimestamp = new Date(startDate2 + "T00:00:00").getTime();
            const endTimestamp = new Date(endDate2 + "T23:59:59").getTime();

            // Lógica Reporte 2: Filtrar por ÚLTIMA ACTIVIDAD (timestamp)
            const filteredConvs = allConvs.filter(conv => {
                const convTime = conv.timestamp * 1000;
                return convTime >= startTimestamp && convTime <= endTimestamp;
            });

            generateCSV(filteredConvs, "Total Leads con Actividad/Cambios", "reporte_avance_etiquetas", startDate2, endDate2);
            toast.success('Reporte exportado correctamente', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al exportar el reporte', { id: toastId });
        } finally {
            setIsExporting2(false);
        }
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
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="space-y-1 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">Fecha Inicio <span className="text-red-500">*</span></label>
                                    <Input type="date" value={startDate2} onChange={(e) => setStartDate2(e.target.value)} />
                                </div>
                                <div className="space-y-1 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">Fecha Fin <span className="text-red-500">*</span></label>
                                    <Input type="date" value={endDate2} onChange={(e) => setEndDate2(e.target.value)} />
                                </div>
                            </div>
                            <Button
                                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                                disabled={!startDate2 || !endDate2 || isExporting2}
                                onClick={downloadReport2}
                            >
                                {isExporting2 ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Generando Reporte...</>
                                ) : (
                                    <><Download className="w-4 h-4" /> Descargar CSV de Avances</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ReportsPage;
