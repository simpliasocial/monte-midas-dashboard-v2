export const config = {
    supabase: {
        url: import.meta.env.VITE_SUPABASE_URL || "https://vbcswxtioavfywxplkus.supabase.co",
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiY3N3eHRpb2F2Znl3eHBsa3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4Mjc1OTEsImV4cCI6MjA2OTQwMzU5MX0.VaAQLzMhJh35AQpiXdC6SO8yXIzC-LQwF2aKdw-ntK8"
    },
    chatwoot: {
        baseUrl: "/chatwoot-api/api/v1/accounts/1",
        apiToken: import.meta.env.VITE_CHATWOOT_API_TOKEN || "Zz4kfVeARYpjnVfiDE7SyobG",
        publicUrl: import.meta.env.VITE_CHATWOOT_BASE_URL || "https://chatwoot-production-e75e.up.railway.app"
    }
};
