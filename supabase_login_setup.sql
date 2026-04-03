-- SQL para configurar el login personalizado en Supabase
-- Ejecuta esto en el Editor SQL de tu proyecto Supabase (https://supabase.com/dashboard/project/vbcswxtioavfywxplkus/sql)

-- 1. Crear una tabla simple para las credenciales si no existe
CREATE TABLE IF NOT EXISTS public.user_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Recomendación: Usar hashing. Para este caso simple guardamos texto plano o hash.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insertar las credenciales solicitadas (montemidas / montemidas)
-- Nota: Si ya existe el usuario, esto no hará nada o fallará por el UNIQUE
INSERT INTO public.user_credentials (username, password)
VALUES ('montemidas', 'montemidas')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

-- 3. Crear la función RPC que llama el frontend
CREATE OR REPLACE FUNCTION public.verify_custom_credentials(p_username TEXT, p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_valid BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_credentials 
        WHERE username = p_username AND password = p_password
    ) INTO is_valid;
    
    RETURN is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Dar permisos a la función para que el rol anon pueda ejecutarla
GRANT EXECUTE ON FUNCTION public.verify_custom_credentials(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_custom_credentials(TEXT, TEXT) TO authenticated;
