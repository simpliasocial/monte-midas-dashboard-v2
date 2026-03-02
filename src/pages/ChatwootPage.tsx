import { useEffect, useState } from 'react';
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
    // NUEVO ESQUEMA DE ETIQUETAS - 6 etiquetas fijas
    const [labels] = useState<string[]>([
        'a_',
        'b1',
        'b2',
        'c1',
        'cita_agendada',
        'leads_entrantes'
    ]);
    const [selectedLabel, setSelectedLabel] = useState<string>('all');
    const [meta, setMeta] = useState<any>({});

    const fetchConversations = async () => {
        setLoading(true);
        try {
            const data = await chatwootService.getConversations({
                page,
                q: search || undefined,
                labels: selectedLabel !== 'all' ? [selectedLabel] : undefined,
            });
            setConversations(data.payload);
            setMeta(data.meta);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar las conversaciones de Chatwoot');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchConversations();
        }, 500);
        return () => clearTimeout(timer);
    }, [page, search, selectedLabel]);

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
                        <div className="flex flex-col sm:flex-row gap-3 items-center">
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
