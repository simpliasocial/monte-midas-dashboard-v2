// CONFIGURACIÓN DEL NUEVO PROYECTO
// Actualizado con las credenciales del nuevo proyecto

export const config = {
    supabase: {
        url: "https://xxdazmikvjsiwkcfwpoj.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4ZGF6bWlrdmpzaXdrY2Z3cG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0Njk5MTcsImV4cCI6MjA4ODA0NTkxN30._goWhT1VeT-2oknYAy6IOtcVmdVNkx6k_CbPnX4w0lU"
    },
    chatwoot: {
        baseUrl: "/chatwoot-api/api/v1/accounts/1",
        apiToken: import.meta.env.VITE_CHATWOOT_API_TOKEN,
        publicUrl: import.meta.env.VITE_CHATWOOT_BASE_URL
    }
};
