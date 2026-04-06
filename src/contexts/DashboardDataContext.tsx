import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { chatwootService, ChatwootConversation } from '../services/ChatwootService';
import { storageService } from '../services/StorageService';

interface DashboardDataContextType {
    conversations: ChatwootConversation[];
    inboxes: any[];
    loading: boolean;
    isSyncing: boolean;
    error: string | null;
    lastSyncTimestamp: number;
    fetchProgress: { current: number; total: number | null };
    refetch: () => Promise<void>;
}

const SYNC_INTERVAL = 30000; // 30 seconds

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

export const DashboardDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [conversations, setConversations] = useState<ChatwootConversation[]>([]);
    const [inboxes, setInboxes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchProgress, setFetchProgress] = useState({ current: 0, total: null as number | null });

    const lastSyncRef = useRef<number>(Date.now() / 1000);
    const isFetchingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Stable reference to latest conversations to avoid re-mounting dependencies
    const conversationsRef = useRef<ChatwootConversation[]>([]);

    const minimizeConvs = (convs: ChatwootConversation[]) => {
        return convs.map(c => ({
            id: c.id,
            timestamp: c.timestamp,
            status: c.status,
            labels: c.labels,
            inbox_id: c.inbox_id,
            created_at: c.created_at,
            custom_attributes: c.custom_attributes,
            meta: {
                sender: {
                    name: c.meta?.sender?.name,
                    phone_number: c.meta?.sender?.phone_number,
                    custom_attributes: c.meta?.sender?.custom_attributes
                }
            }
        } as ChatwootConversation));
    };

    const fetchPageWithRetry = async (page: number, signal: AbortSignal, maxRetries = 2): Promise<any> => {
        let lastError: any;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await chatwootService.getConversations({ status: 'all', page, signal });
            } catch (err: any) {
                if (err.name === 'CanceledError' || err.name === 'AbortError') throw err;
                lastError = err;
                console.warn(`Attempt ${attempt + 1} failed for page ${page}:`, err.message);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
                }
            }
        }
        return { payload: [], meta: { count: 0 }, error: true, errorMessage: lastError?.message };
    };

    const fetchData = useCallback(async (isIncremental = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsSyncing(true);

        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            setError(null);

            // Fetch inboxes and save to IndexedDB
            const currentInboxes = await chatwootService.getInboxes();
            setInboxes(currentInboxes);
            await storageService.saveInboxes(currentInboxes);

            const firstPageResponse = await fetchPageWithRetry(1, signal);
            const firstPayload = firstPageResponse.payload || [];

            // USE REF instead of state to get the most persistent data
            let workingConvs = [...conversationsRef.current];
            const currentSyncTimestamp = Date.now() / 1000;

            if (isIncremental && workingConvs.length > 0) {
                console.log('[Sync] Starting incremental sync...');
                let newItems = [...firstPayload];
                const lastKnownId = workingConvs[0]?.id;

                if (firstPayload.length >= 25 && !firstPayload.some(c => c.id === lastKnownId)) {
                    let page = 2;
                    while (page < 10) {
                        const next = await fetchPageWithRetry(page, signal);
                        const nextPayload = next.payload || [];
                        if (nextPayload.length === 0) break;
                        newItems = [...newItems, ...nextPayload];
                        if (nextPayload.some(c => c.id === lastKnownId) || nextPayload.length < 25) break;
                        page++;
                    }
                }

                const idMap = new Map(workingConvs.map(c => [c.id, c]));
                newItems.forEach(c => idMap.set(c.id, c));
                workingConvs = Array.from(idMap.values()).sort((a, b) => b.timestamp - a.timestamp);

                const minimized = minimizeConvs(workingConvs);
                conversationsRef.current = minimized;
                setConversations(minimized); // Update state only at end
                await storageService.saveConversations(minimized);
            } else {
                // Full load/Bootstrap
                console.log('[Sync] Starting full historical load...');
                setFetchProgress({ current: 1, total: null });
                let allConvs = [...firstPayload];

                if (firstPayload.length >= 25) {
                    let page = 2;
                    let keepFetching = true;
                    const BATCH_SIZE = 2; // Reduced to 2 to avoid timeout overloads

                    while (keepFetching) {
                        setFetchProgress(p => ({ ...p, current: page }));

                        const promises = [];
                        for (let i = 0; i < BATCH_SIZE; i++) {
                            promises.push(fetchPageWithRetry(page + i, signal));
                        }

                        const results = await Promise.all(promises);

                        for (const r of results) {
                            const pLoad = r.payload || [];
                            const isError = (r as any).error === true;

                            allConvs = [...allConvs, ...pLoad];

                            if (!isError) {
                                if (pLoad.length === 0 || pLoad.length < 25) {
                                    keepFetching = false;
                                }
                            }
                        }

                        // We DO NOT update setConversations here to avoid flickering numbers
                        // Only save to storage defensively
                        await storageService.saveConversations(minimizeConvs(allConvs));

                        if (!keepFetching) break;
                        page += BATCH_SIZE;
                        if (page > 150) break;

                        // Add a small delay between batches to respect API limits
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                const finalMinimized = minimizeConvs(allConvs);
                conversationsRef.current = finalMinimized;
                setConversations(finalMinimized);
                await storageService.saveConversations(finalMinimized);
            }

            lastSyncRef.current = currentSyncTimestamp;
            setLoading(false);
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') return;
            console.error('Dashboard data sync error:', err);
            setError('Error de conexión parcial.');
        } finally {
            setIsSyncing(false);
            isFetchingRef.current = false;
        }
    }, []); // NO DEPENDENCIES - Use Ref for state access

    useEffect(() => {
        let isMounted = true;

        const setup = async () => {
            // FORCE CLEANUP of old localStorage keys
            try {
                localStorage.removeItem('monte_midas_dashboard_conversations');
                localStorage.removeItem('monte_midas_dashboard_inboxes');
            } catch (e) { }

            const [cachedConvs, cachedInboxes] = await Promise.all([
                storageService.loadConversations(),
                storageService.loadInboxes()
            ]);

            if (!isMounted) return;

            if (cachedInboxes.length > 0) setInboxes(cachedInboxes);

            if (cachedConvs.length > 0) {
                conversationsRef.current = cachedConvs;
                setConversations(cachedConvs);
                setLoading(false);
            }

            await fetchData(cachedConvs.length > 0);
        }

        setup();

        const timer = setInterval(() => {
            if (isMounted) fetchData(true);
        }, SYNC_INTERVAL);

        return () => {
            isMounted = false;
            clearInterval(timer);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [fetchData]);

    const refetch = async () => {
        conversationsRef.current = [];
        setConversations([]);
        await storageService.clearAll();
        await fetchData(false);
    };

    return (
        <DashboardDataContext.Provider value={{
            conversations,
            inboxes,
            loading,
            isSyncing,
            error,
            lastSyncTimestamp: lastSyncRef.current,
            fetchProgress,
            refetch
        }}>
            {children}
        </DashboardDataContext.Provider>
    );
};

export const useDashboardContext = () => {
    const context = useContext(DashboardDataContext);
    if (!context) throw new Error('useDashboardContext must be used within DashboardDataProvider');
    return context;
};
