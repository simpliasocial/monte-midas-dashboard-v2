import { useEffect, useState } from 'react';
import { chatwootService, ChatwootConversation } from '@/services/ChatwootService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, ExternalLink, User, Clock, Tag, Search, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { config } from '@/config';

const ChatwootPage = () => {
    const [conversations, setConversations] = useState<ChatwootConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    // NUEVO ESQUEMA DE ETIQUETAS - 6 etiquetas fijas
    const [labels] = useState<string[]>([
        'a_',
        'b1',
        'b2',
        'c1',
        'cita_agendada',
        'cita_agendadajess',
        'leads_entrantes',
        'venta_exitosa'
    ]);
    const [selectedLabel, setSelectedLabel] = useState<string>('all');

    // NUEVO - Filtrado por canal (inbox)
    const [inboxes, setInboxes] = useState<any[]>([]);
    const [selectedInbox, setSelectedInbox] = useState<string>('all');

    // NUEVO - Fechas para el reporte
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isExporting, setIsExporting] = useState(false);

    const [meta, setMeta] = useState<any>({});

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

    const fetchConversations = async (customPage?: number) => {
        const fetchLoading = !customPage;
        if (fetchLoading) setLoading(true);
        try {
            const data = await chatwootService.getConversations({
                page: customPage || page,
                q: search || undefined,
                labels: selectedLabel !== 'all' ? [selectedLabel] : undefined,
                inbox_id: selectedInbox !== 'all' ? selectedInbox : undefined,
            });
            setConversations(data.payload);
            setMeta(data.meta);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar las conversaciones de Chatwoot');
        } finally {
            if (fetchLoading) setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchConversations();
        }, 500);
        return () => clearTimeout(timer);
    }, [page, search, selectedLabel, selectedInbox]);

    const downloadReport = async () => {
        setIsExporting(true);
        try {
            // Fetch the maximum page size or iterate across pages.
            // For now we do a single request for the dates.
            const data = await chatwootService.getConversations({
                page: 1, // We might need to iterate if there are many pages, or fetch a big page
                q: undefined, // ignoring search for the full report
                labels: selectedLabel !== 'all' ? [selectedLabel] : undefined,
                inbox_id: selectedInbox !== 'all' ? selectedInbox : undefined,
                since: startDate ? (new Date(startDate + "T00:00:00").getTime() / 1000).toString() : undefined,
                until: endDate ? (new Date(endDate + "T23:59:59").getTime() / 1000).toString() : undefined,
            });

            // If we have to pull all we would loop until data.payload.length is 0. 
            // Here we assume data.payload contains what we need for the CSV.
            // Better: loop through all pages for a full export:
            let allConvs = [...data.payload];
            const metaData = data.meta;
            const totalCount = metaData.all_count || metaData.count || allConvs.length;

            const startTimestamp = new Date(startDate + "T00:00:00").getTime();
            const endTimestamp = new Date(endDate + "T23:59:59").getTime();

            const toastId = toast.loading('Descargando datos. Esto puede tardar unos segundos...');

            if (totalCount > 15 && data.payload.length > 0) { // Chatwoot page size is usually 15 or 25
                let cp = 2;
                let maxAttempts = 20; // prevent true infinite loop 
                while (allConvs.length < totalCount && maxAttempts > 0) {
                    const nextData = await chatwootService.getConversations({
                        page: cp,
                        q: undefined, // ignoring search for the full report
                        labels: selectedLabel !== 'all' ? [selectedLabel] : undefined,
                        inbox_id: selectedInbox !== 'all' ? selectedInbox : undefined,
                        since: startDate ? (new Date(startDate + "T00:00:00").getTime() / 1000).toString() : undefined,
                        until: endDate ? (new Date(endDate + "T23:59:59").getTime() / 1000).toString() : undefined,
                    });
                    if (!nextData || !nextData.payload || nextData.payload.length === 0) break;

                    // Filter out duplicates just in case Chatwoot API behaves weird with dates
                    const newItems = nextData.payload.filter((np: any) => !allConvs.find(c => c.id === np.id));
                    if (newItems.length === 0) break; // if we didn't get any new items, we are probably looping

                    // Optional Optimization: if all items in this page are older than startTimestamp, we could break early.
                    // Because Chatwoot sorts by last_activity_at_desc.
                    const oldestInPage = Math.min(...newItems.map((c: any) => c.timestamp * 1000));
                    if (oldestInPage > 0 && oldestInPage < startTimestamp) {
                        // We still add them and then filter all later, but we know we don't need to fetch more pages
                        allConvs = [...allConvs, ...newItems];
                        break;
                    }

                    allConvs = [...allConvs, ...newItems];
                    cp++;
                    maxAttempts--;
                }
            }

            // Aplicar el filtro de fechas localmente (por FECHA DE CREACIÓN del lead)
            const filteredConvs = allConvs.filter(conv => {
                const convTime = (conv.created_at ? conv.created_at : conv.timestamp) * 1000;
                return convTime >= startTimestamp && convTime <= endTimestamp;
            });

            // Agrupar conteo de etiquetas
            const labelCounts: Record<string, number> = {};
            labels.forEach(l => labelCounts[l] = 0); // initialize all predefined labels to 0

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
            csvContent += `Fecha Inicio,${startDate || 'No definida'}\n`;
            csvContent += `Fecha Fin,${endDate || 'No definida'}\n\n`;

            csvContent += "Etiqueta,Cantidad\n";
            Object.keys(labelCounts).forEach(label => {
                csvContent += `${label},${labelCounts[label]}\n`;
            });
            csvContent += `\nConversaciones Nuevas (Leads),${filteredConvs.length}\n`;

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `reporte_etiquetas_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Reporte exportado correctamente', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al exportar el reporte');
        } finally {
            setIsExporting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'resolved':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'pending':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default:
                return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    const openInChatwoot = (id: number) => {
        window.open(`${config.chatwoot.publicUrl}/app/accounts/1/conversations/${id}`, '_blank');
    };

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

    return (
        <div className="space-y-6">
            <Card className="border-border bg-card">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Generar Reporte de Etiquetas
                    </CardTitle>
                    <CardDescription>
                        Selecciona un rango de fechas obligatorio para exportar el resumen de conversaciones en formato CSV.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="space-y-1 w-full sm:w-auto">
                            <label className="text-sm font-medium text-muted-foreground">Fecha Inicio <span className="text-red-500">*</span></label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full sm:w-[150px]"
                            />
                        </div>
                        <div className="space-y-1 w-full sm:w-auto">
                            <label className="text-sm font-medium text-muted-foreground">Fecha Fin <span className="text-red-500">*</span></label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full sm:w-[150px]"
                            />
                        </div>
                        <Button
                            className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white"
                            disabled={!startDate || !endDate || isExporting}
                            onClick={downloadReport}
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generando Reporte...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Descargar CSV
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border bg-card">
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                        <div>
                            <CardTitle>Listado de Conversaciones</CardTitle>
                            <CardDescription>
                                Total encontrado: {meta.all_count || conversations.length}
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto">
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nombre o celular..."
                                    className="pl-9 w-full sm:w-[300px]"
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1); // Reset page on search
                                    }}
                                />
                            </div>

                            <Select
                                value={selectedInbox}
                                onValueChange={(val) => {
                                    setSelectedInbox(val);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Filtrar por canal" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los canales</SelectItem>
                                    {inboxes.map((inbox) => (
                                        <SelectItem key={inbox.id} value={inbox.id.toString()}>
                                            {getInboxDisplayName(inbox.name)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={selectedLabel}
                                onValueChange={(val) => {
                                    setSelectedLabel(val);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Filtrar por etiqueta" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las etiquetas</SelectItem>
                                    {Array.from(new Set(labels)).map((label) => (
                                        <SelectItem key={label} value={label}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-md border border-border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium">
                                            <tr>
                                                <th className="px-6 py-4">Contacto</th>
                                                <th className="px-6 py-4">Último Mensaje</th>
                                                <th className="px-6 py-4">Estado</th>
                                                <th className="px-6 py-4 hidden md:table-cell">Etiquetas</th>
                                                <th className="px-6 py-4 hidden lg:table-cell">Tiempo</th>
                                                <th className="px-6 py-4 text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border bg-card">
                                            {conversations.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                                        No se encontraron conversaciones
                                                    </td>
                                                </tr>
                                            ) : (
                                                conversations.map((conv) => (
                                                    <tr key={conv.id} className="hover:bg-muted/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                {conv.meta.sender.thumbnail ? (
                                                                    <img
                                                                        src={conv.meta.sender.thumbnail}
                                                                        alt={conv.meta.sender.name}
                                                                        className="w-8 h-8 rounded-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                        <User className="w-4 h-4 text-primary" />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-medium text-foreground">
                                                                        {conv.meta.sender.name || 'Sin Nombre'}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {conv.meta.sender.email || conv.meta.sender.phone_number}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 max-w-md">
                                                            <p className="truncate text-muted-foreground">
                                                                {conv.last_non_activity_message?.content || 'Sin mensajes'}
                                                            </p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span
                                                                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                                                                    conv.status
                                                                )}`}
                                                            >
                                                                {conv.status === 'open' ? 'Abierto' : conv.status === 'resolved' ? 'Resuelto' : conv.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 hidden md:table-cell">
                                                            <div className="flex flex-wrap gap-1">
                                                                {conv.labels.map((label) => (
                                                                    <Badge key={label} variant="secondary" className="text-xs font-normal">
                                                                        <Tag className="w-3 h-3 mr-1 opacity-70" />
                                                                        {label}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                                                            <div className="flex items-center gap-1.5 text-xs">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {formatDistanceToNow(new Date(conv.timestamp * 1000), {
                                                                    addSuffix: true,
                                                                    locale: es,
                                                                })}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                className="gap-2"
                                                                onClick={() => openInChatwoot(conv.id)}
                                                            >
                                                                Ver Chat
                                                                <ExternalLink className="w-3 h-3" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Página {page}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1 || loading}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => p + 1)}
                                        disabled={conversations.length < 15 || loading} // Assuming default page size is 15-25
                                    >
                                        Siguiente
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ChatwootPage;
