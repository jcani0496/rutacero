-- ============================================
-- CREATE SUPER ADMIN - RutaCero
-- Ejecutar DESPUÉS de crear el usuario en Auth
-- ============================================

-- Reemplaza 'USER_ID_HERE' con el ID del usuario
-- que se genera al crear el usuario en Supabase Auth

INSERT INTO public.admin_users (
    id,
    email,
    name,
    role,
    is_active,
    created_at
) VALUES (
    'USER_ID_HERE',  -- Reemplazar con el UUID del usuario de auth.users
    'jcani0496@gmail.com',
    'Juan Carlos Nolasco',
    'SUPER_ADMIN',
    true,
    NOW()
);
