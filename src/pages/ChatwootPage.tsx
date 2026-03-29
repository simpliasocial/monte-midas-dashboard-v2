import { useEffect, useState, useRef } from 'react';
import { chatwootService, ChatwootConversation } from '@/services/ChatwootService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, ExternalLink, User, Clock, Tag, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { config } from '@/config';

const ChatwootPage = () => {
    const [conversations, setConversations] = useState<ChatwootConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [labels] = useState<string[]>([
        'interesado',
        'crear_confianza',
        'crear_urgencia',
        'desinteresado',
        'cita_agendada',
        'cita_agendada_jess',
        'venta_exitosa'
    ]);

    const formatLabel = (label: string) => {
        const mapping: Record<string, string> = {
            'interesado': 'Interesado',
            'crear_confianza': 'Crear Confianza',
            'crear_urgencia': 'Crear Urgencia',
            'cita_agendada': 'Cita Agendada',
            'cita_agendada_jess': 'Cita Agendada Jess',
            'desinteresado': 'Desinteresado',
            'venta_exitosa': 'Venta Exitosa'
        };
        return mapping[label] || label;
    };
    const [selectedLabel, setSelectedLabel] = useState<string>('all');

    // NUEVO - Filtrado por canal (inbox)
    const [inboxes, setInboxes] = useState<any[]>([]);
    const [selectedInbox, setSelectedInbox] = useState<string>('all');

    // NUEVO - Filtrado por fecha específica (diaria)
    const [dateFilter, setDateFilter] = useState<string>('');
    const [dateFilterType, setDateFilterType] = useState<string>('last_activity');

    const [meta, setMeta] = useState<any>({});

    // Prevent race conditions from multiple rapid requests
    const fetchRequestIdRef = useRef<number>(0);

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

    const fetchConversations = async (customPage?: number, isBackground = false) => {
        const reqId = ++fetchRequestIdRef.current;
        const fetchLoading = !customPage && !isBackground;
        if (fetchLoading) setLoading(true);
        try {
            if (dateFilter) {
                // Client-side fetch & filter (because Chatwoot API ignores since/until for this endpoint)
                let allConvs: any[] = [];
                let cp = 1;
                let maxAttempts = 200; // Incrementado para barrer históricos
                let totalCount = 1;
                const targetPage = customPage || page;

                const startTimestamp = new Date(dateFilter + "T00:00:00").getTime();
                const endTimestamp = new Date(dateFilter + "T23:59:59").getTime();

                while (allConvs.length < totalCount && maxAttempts > 0) {
                    const data = await chatwootService.getConversations({
                        page: cp,
                        q: search || undefined,
                        labels: selectedLabel !== 'all' ? [selectedLabel] : undefined,
                        inbox_id: selectedInbox !== 'all' ? selectedInbox : undefined,
                        since: (startTimestamp / 1000).toString(),
                    });

                    if (!data || !data.payload || data.payload.length === 0) break;
                    if (cp === 1) totalCount = data.meta.all_count || data.meta.count || data.payload.length || 0;

                    const newItems = data.payload.filter((np: any) => !allConvs.find(c => c.id === np.id));
                    if (newItems.length === 0) break;

                    const oldestInPage = Math.min(...newItems.map((c: any) => c.timestamp * 1000));

                    allConvs = [...allConvs, ...newItems];

                    // Stop fetching if the oldest item in the current page is older than our start day
                    if (oldestInPage > 0 && oldestInPage < startTimestamp) {
                        break;
                    }

                    cp++;
                    maxAttempts--;
                }

                // Filter locally by everything to ensure 100% accuracy (API sometimes ignores them)
                const filteredConvs = allConvs.filter(conv => {
                    const convTime = dateFilterType === 'created_at'
                        ? (conv.created_at ? conv.created_at : conv.timestamp) * 1000
                        : conv.timestamp * 1000;
                    const isDateMatch = convTime >= startTimestamp && convTime <= endTimestamp;

                    const isLabelMatch = selectedLabel === 'all' || (conv.labels && conv.labels.includes(selectedLabel));
                    const isInboxMatch = selectedInbox === 'all' || conv.inbox_id.toString() === selectedInbox;
                    const isSearchMatch = !search ||
                        (conv.meta?.sender?.name?.toLowerCase().includes(search.toLowerCase())) ||
                        (conv.meta?.sender?.phone_number?.includes(search));

                    return isDateMatch && isLabelMatch && isInboxMatch && isSearchMatch;
                });

                const pageSize = 15;
                const startIndex = (targetPage - 1) * pageSize;
                const sliced = filteredConvs.slice(startIndex, startIndex + pageSize);

                if (reqId !== fetchRequestIdRef.current) return;

                setConversations(sliced);
                setMeta({
                    count: sliced.length,
                    all_count: filteredConvs.length
                });

            } else {
                // Standard server-side pagination
                const data = await chatwootService.getConversations({
                    page: customPage || page,
                    q: search || undefined,
                    labels: selectedLabel !== 'all' ? [selectedLabel] : undefined,
                    inbox_id: selectedInbox !== 'all' ? selectedInbox : undefined,
                });

                if (reqId !== fetchRequestIdRef.current) return;

                setConversations(data.payload);
                setMeta(data.meta);
            }
        } catch (error) {
            if (reqId !== fetchRequestIdRef.current) return;
            console.error(error);
            toast.error('Error al cargar las conversaciones de Chatwoot');
        } finally {
            if (fetchLoading) setLoading(false);
        }
    };

    useEffect(() => {
        // Mostrar animación de actualizando inmediatamente cuando cambia un filtro
        setLoading(true);
        // Debounce search
        const timer = setTimeout(() => {
            fetchConversations();
        }, 500);
        return () => clearTimeout(timer);
    }, [page, search, selectedLabel, selectedInbox, dateFilter, dateFilterType]);

    // Polling silencioso en vivo ("LIVE") cada 15 segundos sin interrupción de UI
    useEffect(() => {
        const interval = setInterval(() => {
            fetchConversations(undefined, true);
        }, 15000);
        return () => clearInterval(interval);
    }, [page, search, selectedLabel, selectedInbox, dateFilter, dateFilterType]);

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



                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => {
                                    setDateFilter(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full sm:w-[150px] h-10"
                                title="Filtrar por fecha específica"
                            />

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
                                            {formatLabel(label)}
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
                                                                    <div className="text-xs text-muted-foreground flex flex-col items-start gap-1 mt-0.5">
                                                                        <span>{conv.meta.sender.email || conv.meta.sender.phone_number}</span>
                                                                        <span className="text-[10px] bg-primary/5 text-primary/80 px-1.5 py-0.5 rounded-sm line-clamp-1 border border-primary/10">
                                                                            {getInboxDisplayName(
                                                                                inboxes.find(i => i.id === conv.inbox_id)?.name || 'Canal Desconocido'
                                                                            )}
                                                                        </span>
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
                                                                        {formatLabel(label)}
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
        </div >
    );
};

export default ChatwootPage;
