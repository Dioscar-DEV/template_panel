-- =====================================================
-- SESTIA - Sistema Modular de Gestión
-- SQL Definitivo para implementación automática
-- =====================================================

-- ⚠️ PRINCIPIO FUNDAMENTAL DE PERMISOLOGÍA
-- El sistema NO filtra por roles, SOLO por permisos.
-- 
-- Secuencia de verificación:
-- 1. ¿Usuario autenticado?
-- 2. ¿El rol del usuario tiene el permiso X? (role_permissions)
-- 3. ¿Si no, el usuario específico tiene el permiso X? (user_permissions)
-- 
-- Resultado: TRUE o FALSE si el permiso existe para:
-- - El rol del usuario (desde role_permissions), O
-- - El permiso específico asignado al usuario (desde user_permissions)
-- 
-- NUNCA verificar roles directamente en políticas RLS o funciones RPC.
-- Siempre usar permisos específicos.

-- =====================================================
-- SCRIPT SQL IDEMPOTENTE
-- =====================================================
-- Este script es completamente idempotente: puede ejecutarse múltiples veces
-- sin errores, tanto en bases de datos nuevas como en bases de datos existentes
-- que necesitan actualizaciones.
-- 
-- Todas las funciones incluyen DROP FUNCTION IF EXISTS antes de CREATE OR REPLACE
-- Todas las tablas usan CREATE TABLE IF NOT EXISTS
-- Todas las políticas usan DROP POLICY IF EXISTS antes de CREATE POLICY
-- Todos los índices usan CREATE INDEX IF NOT EXISTS
-- Todos los triggers usan DROP TRIGGER IF EXISTS antes de CREATE TRIGGER
-- Todos los INSERT usan ON CONFLICT DO NOTHING
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Extensión para actualizar columnas de timestamp automáticamente desde triggers
CREATE EXTENSION IF NOT EXISTS "moddatetime" SCHEMA extensions;

-- =====================================================
-- TABLA DE CONFIGURACIÓN FRONTEND
-- =====================================================
CREATE TABLE IF NOT EXISTS frontconfig (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración por defecto
INSERT INTO frontconfig (key, value, description) VALUES 
('theme', '{
    "brandName": "SestIA",
    "brandShort": "SestIA",
    "logoUrl": "assets/logo.svg",
    "bannerUrl": "assets/banner.svg",
    "bannerText": "Sistema Modular de Gestión",
    "footer": {
        "text": "© 2025 SestIA. Todos los derechos reservados.",
        "links": [
            {"label": "Términos", "href": "javascript:openTermsModal()"},
            {"label": "Privacidad", "href": "javascript:openPrivacyModal()"}
        ]
    },
    "colors": {
        "bg": "#ffffff",
        "panel": "#ffffff",
        "panel2": "#f8fafc",
        "text": "#0f172a",
        "muted": "#64748b",
        "brand": "#3b82f6",
        "accent": "#1e40af",
        "danger": "#dc2626",
        "success": "#10b981",
        "warning": "#f59e0b",
        "info": "#0ea5e9",
        "brandLight": "#60a5fa",
        "border": "#e2e8f0"
    }
}', 'Configuración visual del tema del sitio'),
('site', '{
    "title": "SestIA - Sistema Modular",
    "description": "Sistema modular de gestión empresarial",
    "version": "1.0.0",
    "author": "SestIA Team",
    "contact": "contacto@sestia.com"
}', 'Configuración general del sitio')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SISTEMA DE AUTENTICACIÓN Y USUARIOS
-- =====================================================

-- Tabla de perfiles de usuarios
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    role_key VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar roles por defecto
INSERT INTO roles (role_key, name, description) VALUES 
('user', 'Usuario', 'Usuario básico del sistema'),
('admin', 'Administrador', 'Administrador con acceso completo'),
('superadmin', 'Super Administrador', 'Acceso completo al sistema y configuración')
ON CONFLICT (role_key) DO NOTHING;

-- Tabla de permisos
CREATE TABLE IF NOT EXISTS permissions (
    perm_key VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    module VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar permisos por defecto
-- IMPORTANTE: El sistema NO filtra por roles, SOLO por permisos.
-- Cada acción debe tener su permiso específico para máximo control granular.
INSERT INTO permissions (perm_key, name, description, module) VALUES 
-- Permisos de home
('home.view', 'Ver Inicio', 'Acceso al módulo de inicio', 'home'),
-- Permisos de usuarios (granulares)
('users.view', 'Ver Usuarios', 'Ver lista de usuarios', 'users'),
('users.manage', 'Gestionar Usuarios', 'Crear, editar y eliminar usuarios', 'users'),
('users.invite', 'Enviar Invitaciones', 'Enviar invitaciones por email a nuevos usuarios', 'users'),
('users.create', 'Crear Usuarios', 'Crear nuevos usuarios en el sistema', 'users'),
('users.edit', 'Editar Usuarios', 'Editar información de usuarios existentes', 'users'),
('users.delete', 'Eliminar Usuarios', 'Eliminar usuarios del sistema', 'users'),
('users.permissions', 'Gestionar Permisos', 'Asignar y revocar permisos de usuarios', 'users'),
-- Permisos de índice (granulares)
('indice.view', 'Ver Índice', 'Ver contenido del índice', 'indice'),
('indice.manage', 'Gestionar Índice', 'Crear, editar y eliminar contenido del índice', 'indice'),
('indice.create', 'Crear Contenido', 'Crear nuevo contenido en el índice', 'indice'),
('indice.edit', 'Editar Contenido', 'Editar contenido existente del índice', 'indice'),
('indice.delete', 'Eliminar Contenido', 'Eliminar contenido del índice', 'indice'),
-- Permisos de invitaciones (granulares)
('invitations.view', 'Ver Invitaciones', 'Ver invitaciones pendientes', 'invitations'),
('invitations.manage', 'Gestionar Invitaciones', 'Crear y cancelar invitaciones', 'invitations'),
('invitations.cancel', 'Cancelar Invitaciones', 'Cancelar invitaciones pendientes', 'invitations')
ON CONFLICT (perm_key) DO NOTHING;

-- Tabla de permisos por rol
CREATE TABLE IF NOT EXISTS role_permissions (
    role_key VARCHAR(50) REFERENCES roles(role_key) ON DELETE CASCADE,
    perm_key VARCHAR(100) REFERENCES permissions(perm_key) ON DELETE CASCADE,
    PRIMARY KEY (role_key, perm_key)
);

-- Asignar permisos por defecto a roles
INSERT INTO role_permissions (role_key, perm_key) VALUES 
-- Usuario básico
('user', 'home.view'),
('user', 'indice.view'),
-- Administrador
('admin', 'home.view'),
('admin', 'users.view'),
('admin', 'users.manage'),
('admin', 'indice.view'),
('admin', 'indice.manage'),
('admin', 'invitations.view'),
('admin', 'invitations.manage'),
-- Super administrador (todos los permisos)
('superadmin', 'home.view'),
('superadmin', 'users.view'),
('superadmin', 'users.manage'),
('superadmin', 'indice.view'),
('superadmin', 'indice.manage'),
('superadmin', 'invitations.view'),
('superadmin', 'invitations.manage')
ON CONFLICT (role_key, perm_key) DO NOTHING;

-- Tabla de permisos específicos de usuario
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    perm_key VARCHAR(100) REFERENCES permissions(perm_key) ON DELETE CASCADE,
    granted_by UUID REFERENCES profiles(user_id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, perm_key)
);

-- Tabla de invitaciones
CREATE TABLE IF NOT EXISTS invitations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL REFERENCES roles(role_key),
    invited_by UUID REFERENCES profiles(user_id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- =====================================================
-- MÓDULO DE ÍNDICE
-- =====================================================

-- Crear esquema para instancias si no existe
CREATE SCHEMA IF NOT EXISTS instancias;

-- Tabla principal del índice
CREATE TABLE IF NOT EXISTS instancias.INDICE (
    ID SERIAL PRIMARY KEY,
    TEMA VARCHAR(255) NOT NULL,
    DESCRIPCION TEXT,
    CONTENIDO TEXT,
    ETIQUETAS TEXT,
    COLOR VARCHAR(7) DEFAULT '#3b82f6',
    ACTIVO BOOLEAN DEFAULT true,
    AVAILABLE_FOR_AI BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de log del índice
CREATE TABLE IF NOT EXISTS instancias.INDICE_LOG (
    id SERIAL PRIMARY KEY,
    INDICE_ID INTEGER REFERENCES instancias.INDICE(ID) ON DELETE CASCADE,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PERMISOS PARA SERVICE_ROLE EN ESQUEMA INSTANCIAS
-- =====================================================

-- Otorgar USAGE en el esquema para acceder a objetos dentro del esquema
GRANT USAGE ON SCHEMA instancias TO service_role;

-- Otorgar todos los privilegios en tablas existentes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA instancias TO service_role;

-- Otorgar todos los privilegios en secuencias existentes (para serials, etc.)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA instancias TO service_role;

-- Otorgar todos los privilegios en funciones existentes
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA instancias TO service_role;

-- Configurar permisos por defecto para futuras tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA instancias GRANT ALL PRIVILEGES ON TABLES TO service_role;

-- Configurar permisos por defecto para futuras secuencias
ALTER DEFAULT PRIVILEGES IN SCHEMA instancias GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

-- Configurar permisos por defecto para futuras funciones
ALTER DEFAULT PRIVILEGES IN SCHEMA instancias GRANT ALL PRIVILEGES ON FUNCTIONS TO service_role;

-- =====================================================
-- FUNCIONES RPC
-- =====================================================

-- Función para obtener perfil por user_id
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
-- CASCADE: Elimina también dependencias que se recrearán después
DROP FUNCTION IF EXISTS get_profile_by_user_id(UUID) CASCADE;
CREATE OR REPLACE FUNCTION get_profile_by_user_id(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'success', true,
        'user_id', p.user_id,
        'email', p.email,
        'role', p.role,
        'name', p.name
    ) INTO result
    FROM profiles p
    WHERE p.user_id = p_user_id;
    
    RETURN COALESCE(result, jsonb_build_object('success', false, 'error', 'Usuario no encontrado'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener permisos por user_id
-- PRINCIPIO FUNDAMENTAL: Verifica permisos basándose en:
-- 1. Permisos del rol del usuario (role_permissions)
-- 2. Permisos específicos del usuario (user_permissions)
-- NO verifica roles directamente, solo permisos.
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
-- CASCADE: Elimina también dependencias (políticas RLS) que se recrearán después
DROP FUNCTION IF EXISTS get_permissions_by_user_id(UUID) CASCADE;
CREATE OR REPLACE FUNCTION get_permissions_by_user_id(p_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    user_perms TEXT[];
    current_user_id UUID;
BEGIN
    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    -- Validar: Solo puedes ver tus propios permisos, a menos que tengas permiso users.permissions
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Permitir ver propios permisos o si tiene permiso users.permissions
    IF current_user_id != p_user_id AND NOT current_user_has_permission('users.permissions') THEN
        RAISE EXCEPTION 'No tienes permiso para ver los permisos de otro usuario. Solo puedes ver tus propios permisos o debes tener el permiso users.permissions.';
    END IF;
    
    -- Obtener permisos del rol del usuario
    -- Esto consulta role_permissions basándose en el rol del usuario
    WITH role_perms AS (
        SELECT DISTINCT rp.perm_key
        FROM profiles p
        JOIN role_permissions rp ON p.role = rp.role_key
        WHERE p.user_id = p_user_id
    ),
    -- Obtener permisos específicos del usuario
    -- Esto consulta user_permissions para permisos asignados directamente
    user_specific_perms AS (
        SELECT DISTINCT up.perm_key
        FROM user_permissions up
        WHERE up.user_id = p_user_id
    )
    -- Combinar ambos conjuntos (UNION elimina duplicados)
    -- La lógica es: Permisos del rol OR Permisos específicos del usuario
    SELECT ARRAY(
        SELECT DISTINCT perm_key FROM role_perms
        UNION
        SELECT DISTINCT perm_key FROM user_specific_perms
    ) INTO user_perms;
    
    RETURN COALESCE(user_perms, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener permisos del usuario actual
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
-- CASCADE: Elimina también dependencias que se recrearán después
DROP FUNCTION IF EXISTS get_my_permissions() CASCADE;
CREATE OR REPLACE FUNCTION get_my_permissions()
RETURNS TEXT[] AS $$
BEGIN
    RETURN get_permissions_by_user_id(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIONES HELPER PARA VERIFICACIÓN DE PERMISOS
-- =====================================================
-- IMPORTANTE: Estas funciones verifican permisos basándose en:
-- 1. Permisos del rol del usuario (role_permissions)
-- 2. Permisos específicos del usuario (user_permissions)
-- NO verifican roles directamente, solo permisos.
-- 
-- Secuencia de verificación:
-- 1. ¿Usuario autenticado?
-- 2. ¿El rol del usuario tiene el permiso X? (role_permissions)
-- 3. ¿Si no, el usuario específico tiene el permiso X? (user_permissions)
-- 
-- Resultado: TRUE o FALSE si el permiso existe para:
-- - El rol del usuario (desde role_permissions), O
-- - El permiso específico asignado al usuario (desde user_permissions)

-- Función para verificar si un usuario tiene un permiso específico
-- Esta función consulta get_permissions_by_user_id() que ya calcula
-- la unión de permisos del rol + permisos específicos del usuario
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
-- CASCADE: Elimina también dependencias que se recrearán después
DROP FUNCTION IF EXISTS user_has_permission(UUID, VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_perm_key VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificar si el usuario existe y está autenticado
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Usar get_permissions_by_user_id que ya calcula:
    -- UNION de (permisos del rol + permisos específicos del usuario)
    RETURN EXISTS (
        SELECT 1 FROM get_permissions_by_user_id(p_user_id) AS perms
        WHERE p_perm_key = ANY(perms)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper para verificar si el usuario actual tiene un permiso
-- Esta es la función principal que se usa en políticas RLS
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
-- CASCADE: Elimina también dependencias (políticas RLS) que se recrearán después
DROP FUNCTION IF EXISTS current_user_has_permission(VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION current_user_has_permission(p_perm_key VARCHAR(100))
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, no tiene permisos
    IF current_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar permiso usando la función que calcula:
    -- 1. Permisos del rol del usuario
    -- 2. Permisos específicos del usuario
    RETURN user_has_permission(current_user_id, p_perm_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para listar elementos del índice
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
DROP FUNCTION IF EXISTS indice_list() CASCADE;
CREATE OR REPLACE FUNCTION indice_list()
RETURNS TABLE (
    ID INTEGER,
    TEMA VARCHAR(255),
    DESCRIPCION TEXT,
    CONTENIDO TEXT,
    ETIQUETAS TEXT,
    COLOR VARCHAR(7),
    ACTIVO BOOLEAN,
    AVAILABLE_FOR_AI BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.ID,
        i.TEMA,
        i.DESCRIPCION,
        i.CONTENIDO,
        i.ETIQUETAS,
        i.COLOR,
        i.ACTIVO,
        i.AVAILABLE_FOR_AI,
        i.created_at,
        i.updated_at
    FROM instancias.INDICE i
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para upsert del índice
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
DROP FUNCTION IF EXISTS indice_upsert(INTEGER, VARCHAR, TEXT, TEXT, TEXT, VARCHAR, BOOLEAN, BOOLEAN) CASCADE;
CREATE OR REPLACE FUNCTION indice_upsert(
    p_id INTEGER DEFAULT NULL,
    p_tema VARCHAR(255) DEFAULT NULL,
    p_descripcion TEXT DEFAULT NULL,
    p_contenido TEXT DEFAULT NULL,
    p_etiquetas TEXT DEFAULT NULL,
    p_color VARCHAR(7) DEFAULT NULL,
    p_activo BOOLEAN DEFAULT NULL,
    p_available_for_ai BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result_id INTEGER;
    user_email TEXT;
BEGIN
    -- Obtener email del usuario actual
    SELECT email INTO user_email FROM profiles WHERE user_id = auth.uid();
    
    IF p_id IS NOT NULL THEN
        -- Actualizar registro existente
        UPDATE instancias.INDICE SET
            TEMA = COALESCE(p_tema, TEMA),
            DESCRIPCION = COALESCE(p_descripcion, DESCRIPCION),
            CONTENIDO = COALESCE(p_contenido, CONTENIDO),
            ETIQUETAS = COALESCE(p_etiquetas, ETIQUETAS),
            COLOR = COALESCE(p_color, COLOR),
            ACTIVO = COALESCE(p_activo, ACTIVO),
            AVAILABLE_FOR_AI = COALESCE(p_available_for_ai, AVAILABLE_FOR_AI),
            updated_at = NOW()
        WHERE ID = p_id
        RETURNING ID INTO result_id;
        
        -- Registrar en log
        INSERT INTO instancias.INDICE_LOG (INDICE_ID, user_email, action)
        VALUES (p_id, user_email, 'updated');
        
    ELSE
        -- Insertar nuevo registro
        INSERT INTO instancias.INDICE (TEMA, DESCRIPCION, CONTENIDO, ETIQUETAS, COLOR, ACTIVO, AVAILABLE_FOR_AI)
        VALUES (p_tema, p_descripcion, p_contenido, p_etiquetas, p_color, p_activo, p_available_for_ai)
        RETURNING ID INTO result_id;
        
        -- Registrar en log
        INSERT INTO instancias.INDICE_LOG (INDICE_ID, user_email, action)
        VALUES (result_id, user_email, 'created');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'id', result_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para eliminar del índice
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
DROP FUNCTION IF EXISTS indice_delete(INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION indice_delete(p_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Obtener email del usuario actual
    SELECT email INTO user_email FROM profiles WHERE user_id = auth.uid();
    
    -- Registrar en log antes de eliminar
    INSERT INTO instancias.INDICE_LOG (INDICE_ID, user_email, action)
    VALUES (p_id, user_email, 'deleted');
    
    -- Eliminar registro
    DELETE FROM instancias.INDICE WHERE ID = p_id;
    
    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cancelar invitación completa
-- NOTA: Esta función se define más abajo con tipo de retorno JSON (no JSONB)
-- Para evitar conflictos, se elimina aquí si existe con JSONB
DROP FUNCTION IF EXISTS cancel_invitation_complete(INTEGER, VARCHAR);

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.INDICE ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.INDICE_LOG ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontconfig ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
-- IMPORTANTE: Usa SOLO permisos, nunca roles. Verificación basada en:
-- 1. Usuario autenticado
-- 2. Permisos del rol (role_permissions)
-- 3. Permisos específicos del usuario (user_permissions)

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Users can view own profile or users.view" ON profiles
    FOR SELECT TO authenticated
    USING (
        -- Pueden ver su propio perfil
        ((SELECT auth.uid()) = user_id)
        -- O tienen permiso users.view
        OR current_user_has_permission('users.view')
    );

DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users with users.manage can manage profiles" ON profiles;
CREATE POLICY "Users can edit own profile or users.edit" ON profiles
    FOR UPDATE TO authenticated
    USING (
        -- Pueden editar su propio perfil
        ((SELECT auth.uid()) = user_id)
        -- O tienen permiso users.edit
        OR current_user_has_permission('users.edit')
    )
    WITH CHECK (
        -- Si edita su propio perfil, debe mantener user_id (validado por trigger)
        ((SELECT auth.uid()) = user_id)
        -- Si tiene permiso users.edit, puede editar cualquier campo
        OR current_user_has_permission('users.edit')
    );

-- Políticas para roles (solo lectura para usuarios autenticados)
DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
CREATE POLICY "Authenticated users can view roles" ON roles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas para permissions (solo lectura para usuarios autenticados)
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON permissions;
CREATE POLICY "Authenticated users can view permissions" ON permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas para role_permissions (solo lectura para usuarios autenticados)
DROP POLICY IF EXISTS "Authenticated users can view role_permissions" ON role_permissions;
CREATE POLICY "Authenticated users can view role_permissions" ON role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas para user_permissions
-- IMPORTANTE: Usa SOLO permisos, nunca roles
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
CREATE POLICY "Users can view own permissions" ON user_permissions
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can manage user permissions" ON user_permissions;
CREATE POLICY "Users with users.permissions can manage user_permissions" ON user_permissions
    FOR ALL TO authenticated
    USING (current_user_has_permission('users.permissions'))
    WITH CHECK (current_user_has_permission('users.permissions'));

-- Políticas para invitations
-- IMPORTANTE: Usa SOLO permisos, nunca roles
DROP POLICY IF EXISTS "Admins can manage invitations" ON invitations;
CREATE POLICY "Users with invitations.manage can manage invitations" ON invitations
    FOR ALL TO authenticated
    USING (current_user_has_permission('invitations.manage'))
    WITH CHECK (current_user_has_permission('invitations.manage'));

-- Permitir ver invitaciones con permiso invitations.view
DROP POLICY IF EXISTS "Users with invitations.view can view invitations" ON invitations;
CREATE POLICY "Users with invitations.view can view invitations" ON invitations
    FOR SELECT TO authenticated
    USING (current_user_has_permission('invitations.view'));

-- Políticas para INDICE
DROP POLICY IF EXISTS "Authenticated users can view active indice" ON instancias.INDICE;
CREATE POLICY "Authenticated users can view active indice" ON instancias.INDICE
    FOR SELECT USING (auth.role() = 'authenticated' AND ACTIVO = true);

DROP POLICY IF EXISTS "Users with indice.manage can manage indice" ON instancias.INDICE;
CREATE POLICY "Users with indice.manage can manage indice" ON instancias.INDICE
    FOR ALL USING (
        current_user_has_permission('indice.manage')
    );

-- Políticas para INDICE_LOG (solo lectura para usuarios con permisos)
DROP POLICY IF EXISTS "Users with indice.manage can view indice_log" ON instancias.INDICE_LOG;
CREATE POLICY "Users with indice.manage can view indice_log" ON instancias.INDICE_LOG
    FOR SELECT USING (
        current_user_has_permission('indice.manage')
    );

-- Políticas para frontconfig
-- IMPORTANTE: Permitir lectura pública de configuración visual (theme, site)
-- para que el look and feel esté disponible antes de autenticación
DROP POLICY IF EXISTS "Public can view frontconfig" ON frontconfig;
CREATE POLICY "Public can view frontconfig" ON frontconfig
    FOR SELECT 
    TO anon, authenticated
    USING (key IN ('theme', 'site'));

-- Política para usuarios autenticados (pueden ver toda la configuración)
DROP POLICY IF EXISTS "Authenticated users can view frontconfig" ON frontconfig;
CREATE POLICY "Authenticated users can view frontconfig" ON frontconfig
    FOR SELECT 
    TO authenticated
    USING (true);

-- Política para gestión de frontconfig
-- IMPORTANTE: Usa SOLO permisos, nunca roles
-- Por ahora mantiene USING (true) para retrocompatibilidad
-- TODO: Agregar permiso específico para gestión de frontconfig en el futuro
DROP POLICY IF EXISTS "Admins can manage frontconfig" ON frontconfig;
CREATE POLICY "Authenticated users can manage frontconfig" ON frontconfig
    FOR ALL TO authenticated
    USING (true);

-- =====================================================
-- TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- =====================================================

-- Función para actualizar updated_at
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger a INDICE
DROP TRIGGER IF EXISTS update_indice_updated_at ON instancias.INDICE;
CREATE TRIGGER update_indice_updated_at
    BEFORE UPDATE ON instancias.INDICE
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger a frontconfig
DROP TRIGGER IF EXISTS update_frontconfig_updated_at ON frontconfig;
CREATE TRIGGER update_frontconfig_updated_at
    BEFORE UPDATE ON frontconfig
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE
-- =====================================================

-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
-- CASCADE: Elimina también dependencias (triggers) que se recrearán después
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TRIGGER PARA VALIDAR ACTUALIZACIONES DE PERFIL
-- =====================================================

-- Función para validar que usuarios sin permiso users.edit no puedan cambiar
-- campos sensibles (rol, user_id, email) al editar su propio perfil
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
-- CASCADE: Elimina también dependencias (triggers) que se recrearán después
DROP FUNCTION IF EXISTS public.validate_profile_update() CASCADE;
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS TRIGGER AS $$
DECLARE
    has_edit_permission BOOLEAN;
BEGIN
    -- Verificar si el usuario tiene permiso users.edit
    SELECT current_user_has_permission('users.edit') INTO has_edit_permission;
    
    -- Si el usuario está editando su propio perfil y NO tiene permiso users.edit
    IF NEW.user_id = auth.uid() AND NOT has_edit_permission THEN
        -- No puede cambiar el rol
        IF NEW.role != OLD.role THEN
            RAISE EXCEPTION 'No tienes permiso para cambiar tu rol. Se requiere permiso users.edit';
        END IF;
        
        -- No puede cambiar el user_id
        IF NEW.user_id != OLD.user_id THEN
            RAISE EXCEPTION 'No puedes cambiar tu user_id';
        END IF;
        
        -- No puede cambiar el email
        IF NEW.email != OLD.email THEN
            RAISE EXCEPTION 'No tienes permiso para cambiar tu email. Se requiere permiso users.edit';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para validar actualizaciones de perfil
DROP TRIGGER IF EXISTS validate_profile_update_trigger ON profiles;
CREATE TRIGGER validate_profile_update_trigger
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_profile_update();

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Índices para user_permissions
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_perm_key ON user_permissions(perm_key);

-- Índices para invitations
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

-- Índices para INDICE
CREATE INDEX IF NOT EXISTS idx_indice_activo ON instancias.INDICE(ACTIVO);
CREATE INDEX IF NOT EXISTS idx_indice_created_at ON instancias.INDICE(created_at);

-- Índices para INDICE_LOG
CREATE INDEX IF NOT EXISTS idx_indice_log_indice_id ON instancias.INDICE_LOG(INDICE_ID);
CREATE INDEX IF NOT EXISTS idx_indice_log_created_at ON instancias.INDICE_LOG(created_at);

-- =====================================================
-- AGENTE IA (N8N) - ESQUEMA Y TABLAS
-- =====================================================

-- Tablas de configuración del agente
CREATE TABLE IF NOT EXISTS instancias.agent_config (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    i_channels_webhook TEXT NOT NULL,
    i_core_webhook TEXT NOT NULL,
    c_channels_webhook TEXT NOT NULL,
    c_instance_webhook TEXT NOT NULL,
    i_blacklist BOOLEAN NOT NULL,
    i_tasks BOOLEAN NOT NULL,
    eleven_labs JSONB NOT NULL DEFAULT '{"key": "", "model": "eleven_multilingual_v2", "voice_id": "", "output_format": "mp3_44100_96"}'::jsonb,
    context_length SMALLINT NOT NULL DEFAULT 15,
    owner_list TEXT[] NOT NULL DEFAULT '{}'::text[]
);

COMMENT ON TABLE instancias.agent_config IS 'Configuración general de webhooks y banderas del agente IA';

-- Asegurar columna eleven_labs en despliegues existentes (idempotente)
ALTER TABLE instancias.agent_config
    ADD COLUMN IF NOT EXISTS eleven_labs JSONB;

-- Default, backfill y NOT NULL
ALTER TABLE instancias.agent_config
    ALTER COLUMN eleven_labs SET DEFAULT '{"key": "", "model": "eleven_multilingual_v2", "voice_id": "", "output_format": "mp3_44100_96"}'::jsonb;

UPDATE instancias.agent_config
SET eleven_labs = '{"key": "", "model": "eleven_multilingual_v2", "voice_id": "", "output_format": "mp3_44100_96"}'::jsonb
WHERE eleven_labs IS NULL;

ALTER TABLE instancias.agent_config
    ALTER COLUMN eleven_labs SET NOT NULL;

-- Asegurar columna context_length en despliegues existentes (idempotente)
ALTER TABLE instancias.agent_config
    ADD COLUMN IF NOT EXISTS context_length SMALLINT;

ALTER TABLE instancias.agent_config
    ALTER COLUMN context_length SET DEFAULT 15;

UPDATE instancias.agent_config
SET context_length = 15
WHERE context_length IS NULL;

ALTER TABLE instancias.agent_config
    ALTER COLUMN context_length SET NOT NULL;

-- Asegurar columna owner_list en despliegues existentes (idempotente)
ALTER TABLE instancias.agent_config
    ADD COLUMN IF NOT EXISTS owner_list TEXT[];

ALTER TABLE instancias.agent_config
    ALTER COLUMN owner_list SET DEFAULT '{}'::text[];

UPDATE instancias.agent_config
SET owner_list = '{}'::text[]
WHERE owner_list IS NULL;

ALTER TABLE instancias.agent_config
    ALTER COLUMN owner_list SET NOT NULL;

CREATE TABLE IF NOT EXISTS instancias.agent_vars (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        agent_owner_name TEXT NULL,
        agent_owner_knowledge TEXT NULL,
        agent_name TEXT NULL,
        agent_personality TEXT NULL,
        agent_knowledge TEXT NULL,
        agent_stickerlist JSONB[] NULL,
        agent_gallerylist JSONB[] NULL
);

COMMENT ON TABLE instancias.agent_vars IS 'Variables base y conocimiento inicial del agente IA';

-- Núcleos (cores) del agente: configuraciones individuales por canal/contexto
CREATE TABLE IF NOT EXISTS instancias.agent_core_list (
    core_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc-4:00'::text),
    core_name TEXT NOT NULL,
    core_chat TEXT NOT NULL,
    core_instructions TEXT NULL,
    core_restrictions TEXT NULL,
    core_memories JSONB[] NOT NULL DEFAULT ARRAY[
        '{"id":0,"admin":"Smart Automata","content":"Debo responder siempre en español","created_at":"2025-11-19 19:57:48.598309+00"}'::jsonb
    ]::jsonb[],
    core_channel TEXT NOT NULL,
    core_description TEXT NULL,
    CONSTRAINT agent_core_list_core_chat_key UNIQUE (core_chat)
);

COMMENT ON TABLE instancias.agent_core_list IS 'Lista de configuraciones núcleo (core) del agente por chat/canal';

-- Asegurar default y NOT NULL de core_memories si tabla existía previamente (idempotente)
ALTER TABLE instancias.agent_core_list
    ALTER COLUMN core_memories SET DEFAULT ARRAY['{"id":0,"admin":"Smart Automata","content":"Debo responder siempre en español","created_at":"2025-11-19 19:57:48.598309+00"}'::jsonb]::jsonb[];

UPDATE instancias.agent_core_list
SET core_memories = ARRAY['{"id":0,"admin":"Smart Automata","content":"Debo responder siempre en español","created_at":"2025-11-19 19:57:48.598309+00"}'::jsonb]::jsonb[]
WHERE core_memories IS NULL;

ALTER TABLE instancias.agent_core_list
    ALTER COLUMN core_memories SET NOT NULL;

-- Agregar columna core_description si faltaba (idempotente)
ALTER TABLE instancias.agent_core_list
    ADD COLUMN IF NOT EXISTS core_description TEXT;

CREATE TABLE IF NOT EXISTS instancias.blacklist (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_chat TEXT NULL,
        nombre TEXT NULL
);

COMMENT ON TABLE instancias.blacklist IS 'Lista negra de usuarios/chat para bloquear respuestas del agente';

-- Canales de entrada soportados por el agente
CREATE TABLE IF NOT EXISTS instancias.input_channels (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        name TEXT NOT NULL,
        output_supports JSONB NOT NULL DEFAULT '{"text": true, "photo": false, "video": false, "gallery": false, "sticker": false, "document": false, "location": false}'::jsonb,
        CONSTRAINT input_channels_name_key UNIQUE (name)
);

COMMENT ON TABLE instancias.input_channels IS 'Definición de canales de entrada disponibles para conexión del agente';

-- Contactos administrados por el agente
CREATE TABLE IF NOT EXISTS instancias.agent_contact_list (
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id TEXT NOT NULL,
        contact_nickname TEXT,
        contact_name TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        contact_channel TEXT,
        conctact_chat TEXT,
        contact_system_channel TEXT NOT NULL,
        contact_agent_name TEXT,
        contact_last_channel TEXT,
        contact_verify BOOLEAN NOT NULL DEFAULT FALSE,
        contact_friendship INTEGER NOT NULL DEFAULT 0,
        contact_prompt_count BIGINT NOT NULL DEFAULT 0,
        contact_chat TEXT,
        contact_docid TEXT,
        CONSTRAINT agent_contact_list_pkey PRIMARY KEY (user_id, contact_system_channel),
        CONSTRAINT agent_contact_list_user_id_key UNIQUE (user_id)
);

COMMENT ON TABLE instancias.agent_contact_list IS 'Contactos (usuarios finales) vinculados al agente IA';

-- Encuestas estructuradas (solo para tareas tipo survey)
CREATE TABLE IF NOT EXISTS instancias.agent_surveys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        survey_type TEXT CHECK (survey_type IN ('opinion', 'facts', 'satisfaction', 'diagnostic')) NOT NULL DEFAULT 'facts',
        schema JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ,
        CONSTRAINT survey_schema_valid CHECK (
                schema ? 'fields' AND jsonb_typeof(schema->'fields') = 'array'
        )
);

CREATE INDEX IF NOT EXISTS idx_surveys_active ON instancias.agent_surveys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_surveys_type ON instancias.agent_surveys(survey_type);
CREATE INDEX IF NOT EXISTS idx_surveys_schema_gin ON instancias.agent_surveys USING GIN (schema);

-- Trigger de updated_at usando la extensión moddatetime
DROP TRIGGER IF EXISTS handle_surveys_updated_at ON instancias.agent_surveys;
CREATE TRIGGER handle_surveys_updated_at
        BEFORE UPDATE ON instancias.agent_surveys
        FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- Definición de tareas del agente
CREATE TABLE IF NOT EXISTS instancias.agent_task_list (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        task_type TEXT CHECK (task_type IN ('survey', 'notification', 'data_collection', 'action')) NOT NULL,
        survey_id UUID REFERENCES instancias.agent_surveys(id) ON DELETE SET NULL,
        global_status TEXT CHECK (global_status IN ('borrador', 'asignada', 'pausada', 'completada', 'cancelada')) NOT NULL DEFAULT 'borrador',
        priority INTEGER NOT NULL DEFAULT 0,
        due_date TIMESTAMPTZ,
        assignment_filters JSONB,
        metadata JSONB,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ,
        CONSTRAINT task_survey_requires_survey_id CHECK (
                task_type != 'survey' OR survey_id IS NOT NULL
        )
);

CREATE INDEX IF NOT EXISTS idx_tasks_global_status ON instancias.agent_task_list(global_status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON instancias.agent_task_list(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON instancias.agent_task_list(priority DESC) WHERE global_status = 'asignada';
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON instancias.agent_task_list(due_date) WHERE due_date IS NOT NULL AND global_status IN ('asignada', 'pausada');
CREATE INDEX IF NOT EXISTS idx_tasks_survey_id ON instancias.agent_task_list(survey_id) WHERE survey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_filters_gin ON instancias.agent_task_list USING GIN (assignment_filters);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON instancias.agent_task_list(created_by);

DROP TRIGGER IF EXISTS handle_tasks_updated_at ON instancias.agent_task_list;
CREATE TRIGGER handle_tasks_updated_at
        BEFORE UPDATE ON instancias.agent_task_list
        FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- Asignaciones de tareas a contactos
CREATE TABLE IF NOT EXISTS instancias.agent_task_assign (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES instancias.agent_task_list(id) ON DELETE CASCADE,
        contact_user_id TEXT NOT NULL REFERENCES instancias.agent_contact_list(user_id) ON DELETE CASCADE,
        individual_status TEXT CHECK (individual_status IN ('asignado', 'iniciado', 'completado', 'fallado', 'omitido')) NOT NULL DEFAULT 'asignado',
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        result JSONB,
        failure_reason TEXT,
        notes TEXT,
        answered_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
        completion_pct NUMERIC(5,2) DEFAULT 0.00,
        CONSTRAINT unique_task_contact UNIQUE(task_id, contact_user_id),
        CONSTRAINT started_after_assigned CHECK (started_at IS NULL OR started_at >= assigned_at),
        CONSTRAINT completed_after_started CHECK (completed_at IS NULL OR (started_at IS NOT NULL AND completed_at >= started_at))
);

CREATE INDEX IF NOT EXISTS idx_assign_contact ON instancias.agent_task_assign(contact_user_id, individual_status);
CREATE INDEX IF NOT EXISTS idx_assign_task ON instancias.agent_task_assign(task_id, individual_status);
CREATE INDEX IF NOT EXISTS idx_assign_status ON instancias.agent_task_assign(individual_status);
CREATE INDEX IF NOT EXISTS idx_assign_assigned_at ON instancias.agent_task_assign(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assign_result_gin ON instancias.agent_task_assign USING GIN (result);
CREATE INDEX IF NOT EXISTS idx_assign_contact_pending ON instancias.agent_task_assign(contact_user_id, individual_status, assigned_at)
        WHERE individual_status IN ('asignado', 'iniciado');

-- Vista de resumen de tareas
CREATE OR REPLACE VIEW instancias.v_tasks_summary AS
SELECT 
    t.id,
    t.title,
    t.task_type,
    t.global_status,
    t.priority,
    t.due_date,
    s.name AS survey_name,
    COUNT(a.id) AS total_assigned,
    COUNT(a.id) FILTER (WHERE a.individual_status = 'asignado') AS pending_count,
    COUNT(a.id) FILTER (WHERE a.individual_status = 'iniciado') AS in_progress_count,
    COUNT(a.id) FILTER (WHERE a.individual_status = 'completado') AS completed_count,
    COUNT(a.id) FILTER (WHERE a.individual_status = 'fallado') AS failed_count,
    t.created_at,
    t.updated_at
FROM instancias.agent_task_list t
LEFT JOIN instancias.agent_surveys s ON t.survey_id = s.id
LEFT JOIN instancias.agent_task_assign a ON t.id = a.task_id
GROUP BY t.id, s.name;

COMMENT ON TABLE instancias.agent_surveys IS 'Cuestionarios estructurados solo para tareas tipo survey';
COMMENT ON TABLE instancias.agent_task_list IS 'Definición de tareas del agente';
COMMENT ON TABLE instancias.agent_task_assign IS 'Asignaciones de tareas a contactos para el agente IA';

-- RPC adaptativa para completar/reportar tareas
DROP FUNCTION IF EXISTS instancias.complete_or_report_agent_task(TEXT, UUID, JSONB, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION instancias.complete_or_report_agent_task(
    p_contact_user_id TEXT,
    p_task_id UUID,
    p_answers JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_assignment_id UUID;
    v_task_type TEXT;
    v_survey_schema JSONB;
    v_field_ids TEXT[];
    v_answered_now TEXT[];
    v_invalid_ids TEXT[];
    v_existing_answers TEXT[];
    v_all_answered TEXT[];
    v_required_questions TEXT[];
    v_total_questions INT;
    v_answered_required INT;
    v_pct NUMERIC(5,2);
    v_status TEXT;
BEGIN
    SELECT a.id, t.task_type, s.schema, a.answered_fields
        INTO v_assignment_id, v_task_type, v_survey_schema, v_existing_answers
    FROM instancias.agent_task_assign a
    JOIN instancias.agent_task_list t ON a.task_id = t.id
    LEFT JOIN instancias.agent_surveys s ON t.survey_id = s.id
    WHERE a.contact_user_id = p_contact_user_id AND a.task_id = p_task_id;

    IF v_assignment_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'assignment_not_found');
    END IF;

    -- Solo survey permite respuestas estructuradas
    IF v_task_type = 'survey' THEN
        IF p_answers IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'answers_required', 'message', 'Las tareas tipo survey requieren respuestas estructuradas en p_answers.');
        END IF;
        IF v_survey_schema IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'schema_missing', 'message', 'No se encontró el schema para el survey.');
        END IF;

        -- Validar IDs
        v_field_ids := ARRAY(SELECT f->>'id' FROM jsonb_array_elements(v_survey_schema->'fields') f);
        v_answered_now := ARRAY(SELECT jsonb_object_keys(p_answers));
        v_invalid_ids := ARRAY(
            SELECT id FROM unnest(v_answered_now) id
            WHERE id NOT IN (SELECT * FROM unnest(v_field_ids))
        );
        IF array_length(v_invalid_ids, 1) IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'invalid_field_id',
                'message', 'Respuesta contiene IDs no definidos en el schema',
                'invalid_ids', v_invalid_ids,
                'valid_ids', v_field_ids
            );
        END IF;

        -- Progreso
        v_all_answered := (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(v_existing_answers, ARRAY[]::TEXT[]) || v_answered_now)));
        v_required_questions := ARRAY(
            SELECT f->>'id' FROM jsonb_array_elements(v_survey_schema->'fields') f
            WHERE COALESCE((f->>'required')::BOOLEAN, FALSE)
        );
        v_total_questions := COALESCE(array_length(v_required_questions, 1), 0);
        v_answered_required := (
            SELECT COUNT(*) FROM unnest(v_required_questions) rq WHERE rq = ANY(v_all_answered)
        );
        IF v_total_questions > 0 THEN
            v_pct := round(v_answered_required::NUMERIC / v_total_questions * 100.0, 2);
        ELSE
            v_pct := 100.00;
        END IF;
        v_status := CASE WHEN v_pct = 100.0 THEN 'completado' ELSE 'parcial' END;

        UPDATE instancias.agent_task_assign
             SET 
                 result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('answers', COALESCE(result->'answers', '{}'::jsonb) || p_answers),
                 answered_fields = v_all_answered,
                 completion_pct = v_pct,
                 individual_status = CASE WHEN v_pct = 100.0 THEN 'completado' ELSE individual_status END,
                 started_at = CASE WHEN v_pct = 100.0 AND started_at IS NULL THEN NOW() ELSE started_at END,
                 completed_at = CASE WHEN v_pct = 100.0 THEN NOW() ELSE completed_at END,
                 notes = COALESCE(p_notes, notes)
         WHERE id = v_assignment_id;

        RETURN jsonb_build_object(
            'success', true,
            'type', v_task_type,
            'answered_fields', v_all_answered,
            'completion_pct', v_pct,
            'required_total', v_total_questions,
            'answered_required', v_answered_required,
            'status', v_status
        );
    END IF;

    -- data_collection / notification / action solo notas
    IF v_task_type IN ('data_collection', 'notification', 'action') THEN
        IF p_answers IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'answers_forbidden',
                'message', 'Solo las tareas tipo survey aceptan respuestas estructuradas en p_answers. Para este tipo debe reportar solo en p_notes.'
            );
        END IF;
        IF (p_notes IS NULL OR LENGTH(TRIM(p_notes)) = 0) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'notes_required',
                'message', 'Para este tipo de tarea debe informar el resultado en p_notes.'
            );
        END IF;

        UPDATE instancias.agent_task_assign
            SET 
                individual_status = 'completado',
                notes = COALESCE(p_notes, notes),
                started_at = COALESCE(started_at, NOW()),
                completed_at = NOW()
        WHERE id = v_assignment_id;

        RETURN jsonb_build_object(
            'success', true,
            'type', v_task_type,
            'status', 'completado'
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'unknown_task_type', 'type', v_task_type);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'message', 'Error inesperado. Consulte soporte con este detalle.');
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (solo service_role debe acceder; no se crean políticas para anon/auth)
ALTER TABLE instancias.agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.agent_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.input_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.agent_contact_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.agent_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.agent_task_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.agent_task_assign ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias.agent_core_list ENABLE ROW LEVEL SECURITY;

-- Grant explícito para nueva tabla (aunque default privileges ya cubren)
GRANT ALL PRIVILEGES ON TABLE instancias.agent_core_list TO service_role;

-- Los grants a service_role para el esquema instancias ya se declararon arriba.

-- =====================================================
-- PERMISOS PARA EL AGENTE IA (TABLA permissions / role_permissions)
-- =====================================================

-- Permisos nuevos (idempotentes)
INSERT INTO permissions (perm_key, name, description, module) VALUES 
('agent.view', 'Ver Agente', 'Ver configuración y estado del agente IA', 'agent'),
('agent.manage', 'Gestionar Agente', 'Crear/editar configuración, tareas y encuestas del agente', 'agent'),
('agent.logs', 'Ver Logs del Agente', 'Acceder a trazas y telemetría del agente', 'agent'),
('agent.run', 'Ejecutar Agente', 'Lanzar/forzar ejecuciones y pruebas del agente', 'agent')
ON CONFLICT (perm_key) DO NOTHING;

-- Asignaciones por defecto a roles (idempotentes)
INSERT INTO role_permissions (role_key, perm_key) VALUES 
('admin', 'agent.view'),
('admin', 'agent.manage'),
('admin', 'agent.logs'),
('admin', 'agent.run'),
('superadmin', 'agent.view'),
('superadmin', 'agent.manage'),
('superadmin', 'agent.logs'),
('superadmin', 'agent.run')
ON CONFLICT (role_key, perm_key) DO NOTHING;

-- =====================================================
-- SCHEMA KPIDATA - MÉTRICAS Y CONTENIDO DEL AGENTE
-- =====================================================

-- Crear esquema para métricas si no existe
CREATE SCHEMA IF NOT EXISTS kpidata;

-- Tablas principales en kpidata
CREATE TABLE IF NOT EXISTS kpidata.iainterna (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc-4:00'::text),
    "from" TEXT NULL,
    "to" TEXT NULL,
    content TEXT NULL
);

COMMENT ON TABLE kpidata.iainterna IS 'Mensajes internos del agente IA para auditoría/seguimiento';

CREATE TABLE IF NOT EXISTS kpidata.multimedia (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc-4:00'::text),
    type TEXT NULL,
    url TEXT NULL,
    filename TEXT NULL,
    size TEXT NULL,
    tokens NUMERIC NULL,
    chat_id TEXT NULL,
    user_id TEXT NULL,
    user_channel TEXT NULL,
    system_channel TEXT NULL,
    prompt_id TEXT NULL,
    prompt_tokens NUMERIC NULL,
    completion_token NUMERIC NULL,
    audio_seconds NUMERIC NULL,
    direccion TEXT NULL
);

COMMENT ON TABLE kpidata.multimedia IS 'Registros multimedia asociados a interacciones del agente IA (audios, imágenes, documentos)';

CREATE TABLE IF NOT EXISTS kpidata.tools (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc-4:00'::text),
    tool TEXT NULL,
    result TEXT NULL,
    status TEXT NULL
);

COMMENT ON TABLE kpidata.tools IS 'Ejecuciones de herramientas del agente IA (nombre, resultado, estado)';

-- Habilitar RLS
ALTER TABLE kpidata.iainterna ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpidata.multimedia ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpidata.tools ENABLE ROW LEVEL SECURITY;

-- Permisos para service_role en KPIDATA
GRANT USAGE ON SCHEMA kpidata TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA kpidata TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA kpidata TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA kpidata TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA kpidata GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA kpidata GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA kpidata GRANT ALL PRIVILEGES ON FUNCTIONS TO service_role;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE frontconfig IS 'Configuración visual y de marca del sitio web';
COMMENT ON TABLE profiles IS 'Perfiles de usuarios del sistema';
COMMENT ON TABLE roles IS 'Roles disponibles en el sistema';
COMMENT ON TABLE permissions IS 'Permisos específicos del sistema';
COMMENT ON TABLE role_permissions IS 'Asignación de permisos a roles';
COMMENT ON TABLE user_permissions IS 'Permisos específicos por usuario';
COMMENT ON TABLE invitations IS 'Invitaciones de usuarios pendientes';
COMMENT ON TABLE instancias.INDICE IS 'Contenido del módulo de índice';
COMMENT ON TABLE instancias.INDICE_LOG IS 'Log de cambios en el módulo de índice';

-- =====================================================
-- VALIDACIÓN PREVIA - USUARIO ADMINISTRADOR
-- =====================================================

-- Función para validar que el usuario admin existe antes de continuar
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
DROP FUNCTION IF EXISTS validate_admin_user_exists() CASCADE;
CREATE OR REPLACE FUNCTION validate_admin_user_exists()
RETURNS BOOLEAN AS $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Verificar si el usuario admin@smartautomatai.com existe en auth.users
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'admin@smartautomatai.com';
    
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION '❌ ERROR: Usuario admin@smartautomatai.com no encontrado en auth.users. 
        
📋 INSTRUCCIONES REQUERIDAS:
1. Ve a Supabase Dashboard > Authentication > Users
2. Haz clic en "Add user"
3. Completa:
   - Email: admin@smartautomatai.com
   - Password: 12345678
   - Confirm Password: 12345678
4. Haz clic en "Create user"
5. Ejecuta este SQL nuevamente

⚠️  El script se detendrá aquí hasta que crees el usuario.';
        RETURN FALSE;
    ELSE
        RAISE NOTICE '✅ Usuario admin@smartautomatai.com encontrado. Continuando con la configuración...';
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validar que el usuario admin existe antes de continuar
DO $$
BEGIN
    IF NOT validate_admin_user_exists() THEN
        RAISE EXCEPTION 'Script detenido: Usuario administrador no encontrado.';
    END IF;
END $$;

-- =====================================================
-- USUARIO ADMINISTRADOR POR DEFECTO
-- =====================================================

-- Función para crear usuario administrador por defecto
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
DROP FUNCTION IF EXISTS create_default_admin() CASCADE;
CREATE OR REPLACE FUNCTION create_default_admin()
RETURNS void AS $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Verificar si el usuario admin@smartautomatai.com ya existe en auth.users
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'admin@smartautomatai.com';
    
    -- Solo proceder si el usuario existe en auth.users
    IF admin_user_id IS NOT NULL THEN
        -- Insertar o actualizar en profiles con rol superadmin
        INSERT INTO profiles (user_id, email, name, role)
        VALUES (admin_user_id, 'admin@smartautomatai.com', 'Administrador', 'superadmin')
        ON CONFLICT (user_id) DO UPDATE SET
            role = 'superadmin',
            name = 'Administrador',
            email = 'admin@smartautomatai.com';
            
        RAISE NOTICE '✅ Usuario administrador configurado: admin@smartautomatai.com';
    ELSE
        RAISE EXCEPTION '❌ Usuario admin@smartautomatai.com no encontrado en auth.users.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar la función para crear el usuario admin
SELECT create_default_admin();

-- =====================================================
-- INSTRUCCIONES PARA EL USUARIO ADMIN
-- =====================================================

-- IMPORTANTE: Para usar el usuario administrador:
-- 1. Ve a Supabase Dashboard > Authentication > Users
-- 2. Crea un usuario con email: admin@smartautomatai.com
-- 3. Establece la contraseña: 12345678
-- 4. El perfil se creará automáticamente con rol superadmin
-- 5. O usa la función de invitación desde la aplicación

-- Función para invitar usuario administrador (alternativa)
-- IDEMPOTENTE: Eliminar función si existe antes de crearla (permite actualizaciones)
DROP FUNCTION IF EXISTS invite_admin_user() CASCADE;
CREATE OR REPLACE FUNCTION invite_admin_user()
RETURNS JSONB AS $$
DECLARE
    invitation_id INTEGER;
BEGIN
    -- Crear invitación para el usuario admin
    INSERT INTO invitations (email, role, invited_by, expires_at)
    VALUES (
        'admin@smartautomatai.com',
        'superadmin',
        NULL, -- No hay invitador específico
        NOW() + INTERVAL '7 days'
    )
    RETURNING id INTO invitation_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', invitation_id,
        'message', 'Invitación creada para admin@smartautomatai.com'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIONES RPC PARA INVITACIONES
-- =====================================================
-- NOTA IMPORTANTE: La función create_invitation fue reemplazada por la Edge Function 'invite-user'
-- que maneja tanto el envío de emails como la creación del registro en la tabla invitations.
-- 
-- Edge Function: invite-user
-- Ubicación: supabase/functions/invite-user/index.ts
-- Descripción: Envía invitaciones por email usando auth.admin.inviteUserByEmail() y crea
--              un registro en la tabla invitations para tracking.
-- Requisitos: 
--    - Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
--    - Permisos: Solo usuarios con rol 'superadmin' o 'admin' pueden usar esta función
--    - Despliegue: Debe desplegarse usando 'supabase functions deploy invite-user'
--
-- IMPORTANTE: Esta Edge Function DEBE estar desplegada y activa para que el sistema de
--             invitaciones funcione correctamente. Ver SETUP_COMPLETO.md para más detalles.

-- Eliminar función obsoleta create_invitation si existe (reemplazada por Edge Function)
DROP FUNCTION IF EXISTS create_invitation(character varying, character varying) CASCADE;
DROP FUNCTION IF EXISTS create_invitation(varchar, varchar) CASCADE;
DROP FUNCTION IF EXISTS create_invitation(character varying, character varying, character varying) CASCADE;
DROP FUNCTION IF EXISTS create_invitation(varchar, varchar, varchar) CASCADE;

-- Función para aceptar invitación (usada por usuarios invitados)
-- IDEMPOTENTE: Eliminar todas las variaciones de la función antes de crearla
DROP FUNCTION IF EXISTS accept_invitation_native(character varying) CASCADE;
DROP FUNCTION IF EXISTS accept_invitation_native(varchar) CASCADE;
DROP FUNCTION IF EXISTS accept_invitation_native(text) CASCADE;
DROP FUNCTION IF EXISTS accept_invitation_native(VARCHAR) CASCADE;

CREATE OR REPLACE FUNCTION accept_invitation_native(p_email VARCHAR(255))
RETURNS JSON AS $$
DECLARE
    invitation_record RECORD;
    user_record RECORD;
    result JSON;
BEGIN
    -- Buscar la invitación pendiente para este email
    SELECT * INTO invitation_record
    FROM invitations
    WHERE email = p_email
    AND accepted_at IS NULL
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Verificar que existe una invitación válida
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No se encontró una invitación válida para este email'
        );
    END IF;
    
    -- Verificar que el usuario está autenticado
    IF auth.uid() IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Usuario no autenticado'
        );
    END IF;
    
    -- Verificar que el email coincide con el usuario autenticado
    SELECT * INTO user_record
    FROM auth.users
    WHERE id = auth.uid() AND email = p_email;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El email no coincide con el usuario autenticado'
        );
    END IF;
    
    -- Actualizar el perfil con el rol de la invitación
    UPDATE profiles
    SET 
        role = invitation_record.role,
        name = COALESCE(invitation_record.name, profiles.name, user_record.email),
        updated_at = NOW()
    WHERE user_id = auth.uid();
    
    -- Si el perfil no existe, crearlo
    IF NOT FOUND THEN
        INSERT INTO profiles (user_id, email, name, role)
        VALUES (
            auth.uid(),
            p_email,
            COALESCE(invitation_record.name, user_record.email),
            invitation_record.role
        )
        ON CONFLICT (user_id) DO UPDATE SET
            role = invitation_record.role,
            name = COALESCE(invitation_record.name, profiles.name, user_record.email),
            updated_at = NOW();
    END IF;
    
    -- Marcar la invitación como aceptada
    UPDATE invitations
    SET 
        accepted_at = NOW(),
        status = 'accepted'
    WHERE id = invitation_record.id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Invitación aceptada correctamente',
        'role', invitation_record.role
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cancelar invitación
-- IDEMPOTENTE: Eliminar todas las variaciones de la función antes de crearla
-- Incluye variaciones con diferentes tipos de retorno (JSONB vs JSON) y tipos de parámetros
DROP FUNCTION IF EXISTS cancel_invitation_complete(integer, character varying) CASCADE;
DROP FUNCTION IF EXISTS cancel_invitation_complete(integer, varchar) CASCADE;
DROP FUNCTION IF EXISTS cancel_invitation_complete(integer, text) CASCADE;
DROP FUNCTION IF EXISTS cancel_invitation_complete(INTEGER, VARCHAR) CASCADE;

CREATE OR REPLACE FUNCTION cancel_invitation_complete(
    p_invitation_id INTEGER,
    p_user_email VARCHAR(255)
)
RETURNS JSON AS $$
DECLARE
    current_user_role TEXT;
    invitation_record RECORD;
    user_record RECORD;
    result JSON;
BEGIN
    -- Verificar que el usuario actual es superadmin
    SELECT role INTO current_user_role 
    FROM profiles 
    WHERE user_id = auth.uid();
    
    IF current_user_role != 'superadmin' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Solo los superadmin pueden cancelar invitaciones'
        );
    END IF;
    
    -- Verificar que la invitación existe
    SELECT * INTO invitation_record 
    FROM invitations 
    WHERE id = p_invitation_id AND email = p_user_email;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invitación no encontrada'
        );
    END IF;
    
    -- Buscar el usuario en auth.users
    SELECT * INTO user_record 
    FROM auth.users 
    WHERE email = p_user_email;
    
    -- Iniciar transacción para eliminar todo
    BEGIN
        -- 1. Eliminar invitación
        DELETE FROM invitations WHERE id = p_invitation_id;
        
        -- 2. Eliminar perfil del usuario (si existe)
        DELETE FROM profiles WHERE email = p_user_email;
        
        result := json_build_object(
            'success', true,
            'message', 'Invitación cancelada exitosamente',
            'details', json_build_object(
                'invitation_id', p_invitation_id,
                'email', p_user_email,
                'user_deleted', user_record.id IS NOT NULL
            )
        );
        
    EXCEPTION WHEN OTHERS THEN
        -- En caso de error, hacer rollback
        result := json_build_object(
            'success', false,
            'error', 'Error al cancelar invitación: ' || SQLERRM
        );
    END;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- NOTAS FINALES
-- =====================================================
-- 
-- Este script SQL contiene TODA la configuración necesaria para que Supabase funcione
-- correctamente con SestIA. Sin embargo, también se requiere:
--
-- 1. Edge Function 'invite-user' desplegada y activa
--    Ubicación: supabase/functions/invite-user/index.ts
--    Ver SETUP_COMPLETO.md para instrucciones de despliegue
--
-- 2. Usuario administrador creado en Authentication > Users
--    Email requerido: admin@smartautomatai.com (o modificar el script según necesidades)
--
-- 3. Variables de entorno configuradas en Edge Functions
--    SITE_URL: URL completa del sitio web para redirectTo de invitaciones
--
-- =====================================================
-- SCRIPT IDEMPOTENTE - INFORMACIÓN IMPORTANTE
-- =====================================================
-- 
-- Este script es completamente idempotente y puede ejecutarse múltiples veces
-- sin errores:
--
-- ✅ Para nuevas implementaciones: Ejecuta todo desde cero
-- ✅ Para actualizaciones: Actualiza solo lo que cambió sin romper lo existente
-- ✅ Para migraciones: Funciona en bases de datos existentes
--
-- Características de idempotencia:
-- - Todas las funciones incluyen DROP FUNCTION IF EXISTS antes de CREATE OR REPLACE
-- - Todas las tablas usan CREATE TABLE IF NOT EXISTS
-- - Todas las políticas usan DROP POLICY IF EXISTS antes de CREATE POLICY
-- - Todos los índices usan CREATE INDEX IF NOT EXISTS
-- - Todos los triggers usan DROP TRIGGER IF EXISTS antes de CREATE TRIGGER
-- - Todos los INSERT usan ON CONFLICT DO NOTHING
-- - Todas las extensiones usan CREATE EXTENSION IF NOT EXISTS
--
-- Si encuentras errores al ejecutar múltiples veces, verifica:
-- 1. Que todas las funciones tengan DROP FUNCTION IF EXISTS antes de CREATE
-- 2. Que todos los tipos de retorno sean consistentes
-- 3. Que todos los parámetros de las funciones sean del tipo correcto
--
-- Para más información, ver: SETUP_COMPLETO.md
--
-- =====================================================
-- STORAGE: BUCKETS PRIVADOS/PÚBLICOS + POLÍTICAS (IDEMPOTENTE)
-- =====================================================
-- Buckets a crear:
--  - media-incoming    (privado)  Ingesta desde canales externos
--  - media-generated   (privado)  Salidas generadas por IA antes de publicación
--  - media-special     (privado)  Campañas / datasets / compliance
--  - media-published   (público)  Objetos ya aprobados para acceso duradero externo
--  - public-assets     (público)  Activos estáticos (logos, stickers, galerías)
-- Uso de Signed URLs: para análisis temporal (GPT/Gemini) sobre buckets privados.
-- Publicación permanente: copiar objeto a media-published o public-assets.

-- Crear / actualizar buckets con control completo (idempotente)
-- Nota: En Supabase el id del bucket es el nombre. ON CONFLICT permite modificar opciones al re-ejecutar.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('media-incoming',  'media-incoming',  FALSE, NULL, NULL),
    ('media-generated', 'media-generated', FALSE, 52428800, ARRAY['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/wav']),
    ('media-special',   'media-special',   FALSE, NULL, NULL),
    ('media-published', 'media-published', TRUE,  NULL, NULL),
    ('public-assets',   'public-assets',   TRUE,  NULL, NULL)
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Eliminar función redundante previa si existiera
DROP FUNCTION IF EXISTS get_bucket_name(UUID);

-- Eliminar políticas previas potenciales (idempotente)
DROP POLICY IF EXISTS "Public read media-published" ON storage.objects;
DROP POLICY IF EXISTS "Public read public-assets" ON storage.objects;
DROP POLICY IF EXISTS "Read private media buckets" ON storage.objects;
DROP POLICY IF EXISTS "Manage media buckets" ON storage.objects;

-- Lectura pública para buckets públicos
CREATE POLICY "Public read media-published" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'media-published');

CREATE POLICY "Public read public-assets" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'public-assets');

-- Lectura en buckets privados (requiere permiso agent.view)
CREATE POLICY "Read private media buckets" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        public.current_user_has_permission('agent.view') AND
        bucket_id IN ('media-incoming','media-generated','media-special')
    );

-- Gestión (subir, actualizar, borrar) en todos los buckets (requiere agent.manage)
CREATE POLICY "Manage media buckets" ON storage.objects
    FOR ALL TO authenticated
    USING (
        public.current_user_has_permission('agent.manage') AND
        bucket_id IN ('media-incoming','media-generated','media-special','media-published','public-assets')
    )
    WITH CHECK (
        public.current_user_has_permission('agent.manage') AND
        bucket_id IN ('media-incoming','media-generated','media-special','media-published','public-assets')
    );

-- NOTA: Signed URLs se generan desde backend/N8N con service_role o sesión con permisos.
--       No requieren políticas adicionales; la firma valida el acceso temporal.

-- =====================================================
-- LIMPIEZA AUTOMÁTICA (TTL 30 DÍAS) PARA media-incoming / media-generated
-- =====================================================
-- Requiere extensión pg_cron; ejecuta un DELETE directo sobre storage.objects.
-- Los triggers internos de Supabase eliminan el archivo físico asociado.
-- Idempotente: si el job existe se reprograma (unschedule + schedule).

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;

DO $main$
DECLARE
    v_job_name text := 'purge_media_ttl_30d';
    v_job_id int;
BEGIN
    -- Buscar job previo y desprogramar
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = v_job_name;
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;

    -- Programar limpieza diaria a las 03:15 UTC usando DELETE directo
    PERFORM cron.schedule(
        v_job_name,
        '15 3 * * *',
        $$
        DELETE FROM storage.objects
        WHERE bucket_id IN ('media-incoming', 'media-generated')
          AND created_at < (now() - interval '30 days');
        $$
    );
END $main$;

-- NOTA: Para conservar archivos más tiempo, mover/copiar a 'media-special' o 'media-published' antes del TTL,
-- o ajustar la política en futuras ejecuciones del script.

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
