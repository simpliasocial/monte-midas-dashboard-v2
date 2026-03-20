import { useState } from 'react';
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

    const labels = [
        'a_', 'b1', 'b2', 'c1', 'cita_agendada', 'cita_agendadajess', 'leads_entrantes', 'venta_exitosa'
    ];

    const fetchAllConversations = async (startDate: string, endDate: string) => {
        const data = await chatwootService.getConversations({
            page: 1,
            since: (new Date(startDate + "T00:00:00").getTime() / 1000).toString(),
            until: (new Date(endDate + "T23:59:59").getTime() / 1000).toString(),
        });

        let allConvs = [...data.payload];
        const totalCount = data.meta.all_count || data.meta.count || allConvs.length;
        const startTimestamp = new Date(startDate + "T00:00:00").getTime();

        if (totalCount > 15 && data.payload.length > 0) {
            let cp = 2;
            let maxAttempts = 20;
            while (allConvs.length < totalCount && maxAttempts > 0) {
                const nextData = await chatwootService.getConversations({
                    page: cp,
                    since: (new Date(startDate + "T00:00:00").getTime() / 1000).toString(),
                    until: (new Date(endDate + "T23:59:59").getTime() / 1000).toString(),
                });
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
        const labelCounts: Record<string, number> = {};
        labels.forEach(l => labelCounts[l] = 0);

        filteredConvs.forEach(conv => {
            conv.labels.forEach((l: string) => {
                if (labelCounts[l] !== undefined) {
                    labelCounts[l]++;
                } else {
                    labelCounts[l] = 1;
                }
            });
        });

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Resumen de Etiquetas\n";
        csvContent += `Fecha Inicio,${startDate}\n`;
        csvContent += `Fecha Fin,${endDate}\n\n`;
        csvContent += "Etiqueta,Cantidad\n";

        Object.keys(labelCounts).forEach(label => {
            csvContent += `${label},${labelCounts[label]}\n`;
        });

        csvContent += `\n${labelTitle},${filteredConvs.length}\n`;

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
            const allConvs = await fetchAllConversations(startDate1, endDate1);
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
            const allConvs = await fetchAllConversations(startDate2, endDate2);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                            <Users className="w-5 h-5" />
                            Reporte de Leads Nuevos
                        </CardTitle>
                        <CardDescription>
                            Filtra exclusivamente los prospectos que escribieron <strong>por primera vez</strong> en este rango de fechas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="space-y-1 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">Fecha Inicio <span className="text-red-500">*</span></label>
                                    <Input type="date" value={startDate1} onChange={(e) => setStartDate1(e.target.value)} />
                                </div>
                                <div className="space-y-1 w-full">
                                    <label className="text-sm font-medium text-muted-foreground">Fecha Fin <span className="text-red-500">*</span></label>
                                    <Input type="date" value={endDate1} onChange={(e) => setEndDate1(e.target.value)} />
                                </div>
                            </div>
                            <Button
                                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={!startDate1 || !endDate1 || isExporting1}
                                onClick={downloadReport1}
                            >
                                {isExporting1 ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Generando Reporte...</>
                                ) : (
                                    <><Download className="w-4 h-4" /> Descargar CSV de Leads</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                            <Activity className="w-5 h-5" />
                            Reporte de Interacciones (Avance)
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
