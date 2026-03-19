import axios from 'axios';
import { config } from '../config';

// RECONECTADO - Chatwoot del nuevo proyecto

const CHATWOOT_API_URL = config.chatwoot.baseUrl;
const API_TOKEN = config.chatwoot.apiToken;

export interface ChatwootConversation {
    id: number;
    status: string;
    inbox_id: number;
    messages: any[];
    meta: {
        sender: {
            name: string;
            email: string;
            phone_number: string;
            thumbnail: string;
            custom_attributes?: any;
        };
    };
    labels: string[];
    last_non_activity_message: {
        content: string;
        created_at: number;
    };
    timestamp: number;
    created_at?: number; // Unix timestamp when conversation was created
    first_reply_created_at?: number; // Unix timestamp of first agent reply
    waiting_since?: number; // Unix timestamp since waiting for response
    custom_attributes?: {
        [key: string]: any;
    };
}

export const chatwootService = {
    getConversations: async (params: {
        page?: number;
        status?: string;
        sort_by?: string;
        q?: string;
        since?: string;
        until?: string;
        labels?: string[];
        inbox_id?: number | string;
    } = {}): Promise<{ payload: ChatwootConversation[]; meta: any }> => {
        try {
            // If 'q' is present, we perform a Contact Search first to find the specific person
            if (params.q) {
                console.log('Searching contacts for:', params.q);
                const contactsResponse = await axios.get(`${CHATWOOT_API_URL}/contacts/search`, {
                    headers: { api_access_token: API_TOKEN },
                    params: { q: params.q }
                });

                const contacts = contactsResponse.data.payload;
                console.log('Contacts found:', contacts.length);

                if (!contacts || contacts.length === 0) {
                    return { payload: [], meta: { count: 0, all_count: 0 } };
                }

                // Fetch conversations for each found contact
                const conversationPromises = contacts.map(async (contact: any) => {
                    try {
                        const convResponse = await axios.get(`${CHATWOOT_API_URL}/contacts/${contact.id}/conversations`, {
                            headers: { api_access_token: API_TOKEN }
                        });
                        return convResponse.data.payload;
                    } catch (err) {
                        console.error(`Error fetching conversations for contact ${contact.id}`, err);
                        return [];
                    }
                });

                const results = await Promise.all(conversationPromises);
                let allConversations = results.flat();

                // In-memory filter for labels if present
                if (params.labels && params.labels.length > 0) {
                    allConversations = allConversations.filter(conv =>
                        conv.labels && conv.labels.some((l: string) => params.labels!.includes(l))
                    );
                }

                // In-memory filter for inbox_id if present
                if (params.inbox_id) {
                    allConversations = allConversations.filter(conv =>
                        conv.inbox_id === Number(params.inbox_id)
                    );
                }

                return {
                    payload: allConversations,
                    meta: {
                        count: allConversations.length,
                        all_count: allConversations.length
                    }
                };
            }

            // Normal flow (no search query)
            const response = await axios.get(`${CHATWOOT_API_URL}/conversations`, {
                headers: {
                    api_access_token: API_TOKEN,
                },
                params: {
                    page: params.page || 1,
                    status: 'all',
                    sort_by: params.sort_by || 'last_activity_at_desc',
                    since: params.since,
                    until: params.until,
                    labels: params.labels ? params.labels.join(',') : undefined,
                    inbox_id: params.inbox_id,
                },
            });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Chatwoot conversations:', error);
            throw error;
        }
    },

    getLabels: async (): Promise<string[]> => {
        try {
            const response = await axios.get(`${CHATWOOT_API_URL}/labels`, {
                headers: {
                    api_access_token: API_TOKEN,
                },
            });
            return response.data.payload.map((label: any) => label.title);
        } catch (error) {
            console.error('Error fetching Chatwoot labels:', error);
            return [];
        }
    },

    getInboxes: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${CHATWOOT_API_URL}/inboxes`, {
                headers: {
                    api_access_token: API_TOKEN,
                },
            });
            return response.data.payload;
        } catch (error) {
            console.error('Error fetching Chatwoot inboxes:', error);
            return [];
        }
    },
};
