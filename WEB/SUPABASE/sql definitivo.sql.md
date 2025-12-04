# SQL Definitivo - SestIA

## 📋 Descripción

Este archivo contiene todo el SQL necesario para configurar automáticamente la base de datos de SestIA. Al ejecutar este script, se crean todas las tablas, funciones, políticas RLS y datos iniciales necesarios para que el sistema funcione correctamente.

## 🚀 Instrucciones de Uso

### 1. Preparación
1. Crea un nuevo proyecto en [Supabase](https://supabase.com)
2. Ve al SQL Editor en tu dashboard de Supabase
3. Copia y pega todo el contenido de `sql definitivo.sql`
4. Ejecuta el script completo

### 2. Crear Usuario Administrador (OBLIGATORIO)
**⚠️ IMPORTANTE:** Debes crear el usuario administrador ANTES de ejecutar el SQL.

**Crear usuario en Supabase Dashboard:**
1. Ve a tu proyecto de Supabase
2. Navega a **Authentication > Users**
3. Haz clic en **"Add user"**
4. Completa:
   - **Email:** admin@smartautomatai.com
   - **Password:** 12345678
   - **Confirm Password:** 12345678
5. Haz clic en **"Create user"**

**El SQL incluye validación automática:**
- Si el usuario no existe, el script se detendrá con un mensaje de error claro
- Te mostrará las instrucciones exactas para crear el usuario
- Una vez creado el usuario, ejecuta el SQL nuevamente

### 3. Verificación
Después de ejecutar el script, verifica que se hayan creado:
- ✅ Todas las tablas en el esquema `public`
- ✅ El esquema `instancias` con sus tablas
- ✅ Las funciones RPC
- ✅ Las políticas RLS optimizadas (sin recursión infinita)
- ✅ Los datos iniciales
- ✅ Usuario administrador configurado

### 4. Edge Functions (OPCIONAL)
Si necesitas funcionalidades avanzadas como envío automático de emails de invitación, puedes desplegar la Edge Function incluida.

**Requisitos:**
- **Node.js y npm:** [Descargar](https://nodejs.org/)
- **Supabase CLI:** 
  1. Descarga el ejecutable para Windows desde: [https://github.com/supabase/cli/releases](https://github.com/supabase/cli/releases) (busca la versión más reciente, por ejemplo `supabase_windows_amd64.exe`)
  2. Renombra el archivo descargado a `supabase.exe`.
  3. Colócalo en una carpeta de tu preferencia (ej. `C:\Program Files\Supabase CLI`).
  4. Añade esa carpeta a tu variable de entorno PATH.
  5. Cierra y vuelve a abrir tu terminal/CMD para que los cambios surtan efecto.
- **Iniciar sesión en la CLI:** `supabase login`
- **Vincular tu proyecto:** `supabase link --project-ref TU_PROJECT_ID` (encuentra el ID en la URL de tu dashboard de Supabase).

**Pasos para el Despliegue:**

1. **Navegación Obligatoria:** Asegúrate de estar en la **carpeta raíz de tu proyecto** (donde se encuentra `supabase/config.toml`).
   
2. **Ejecutar el Lanzador:** Haz doble clic en el archivo `supabase/deploy-functions.cmd`.
   - Este lanzador ejecutará el script de PowerShell de forma segura y te guiará a través de todo el proceso interactivo.

3. **Seguir las instrucciones** en la terminal para:
   - Instalar la Supabase CLI (si es necesario).
   - Iniciar sesión en tu cuenta de Supabase.
   - Vincular el proyecto correcto.

4. **Configurar variables de entorno en Supabase:**
   - Ve a `Settings` > `Configuration` > `Database` en tu dashboard.
   - Asegúrate de que las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles para las Edge Functions.
   - Adicionalmente, crea una variable `SITE_URL` con la URL de tu aplicación (ej: `https://sestia.manuelitoai.com`).

5. **Habilitar CORS (si es necesario):**
   - Ve a `Edge Functions` > `invite-user` > `Details`.
   - Asegúrate de que los `CORS headers` están configurados para permitir peticiones desde el dominio de tu aplicación. El script de la función ya incluye headers para desarrollo local (`*`).

**Nota:** El sistema puede funcionar sin Edge Functions usando las funciones RPC de la base de datos, pero el envío de correos de invitación no será automático. El usuario tendría que compartir manualmente el enlace de invitación.

## 🗄️ Estructura de la Base de Datos

### Esquema `public`

#### Tabla `frontconfig`
Almacena toda la configuración visual del sitio web.

```sql
CREATE TABLE frontconfig (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Datos iniciales:**
- `theme`: Configuración de colores, logos y textos
- `site`: Información general del sitio

#### Tabla `profiles`
Perfiles de usuarios del sistema.

```sql
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Tabla `roles`
Roles disponibles en el sistema.

```sql
CREATE TABLE roles (
    role_key VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Roles predefinidos:**
- `user`: Usuario básico
- `admin`: Administrador
- `superadmin`: Super administrador

#### Tabla `permissions`
Permisos específicos del sistema.

```sql
CREATE TABLE permissions (
    perm_key VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    module VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Permisos incluidos (granulares por acción):**

**Home:**
- `home.view`: Ver dashboard

**Usuarios:**
- `users.view`: Ver usuarios
- `users.manage`: Gestionar usuarios (legacy, incluye crear/editar/eliminar)
- `users.invite`: Enviar invitaciones
- `users.create`: Crear usuarios
- `users.edit`: Editar usuarios
- `users.delete`: Eliminar usuarios
- `users.permissions`: Gestionar permisos de usuarios

**Índice:**
- `indice.view`: Ver índice
- `indice.manage`: Gestionar índice (legacy, incluye crear/editar/eliminar)
- `indice.create`: Crear contenido
- `indice.edit`: Editar contenido
- `indice.delete`: Eliminar contenido

**Invitaciones:**
- `invitations.view`: Ver invitaciones
- `invitations.manage`: Gestionar invitaciones (legacy, incluye crear/cancelar)
- `invitations.cancel`: Cancelar invitaciones

**IMPORTANTE**: El sistema verifica permisos granulares. Cada acción debe tener su permiso específico.

#### Tabla `role_permissions`
Asignación de permisos a roles.

```sql
CREATE TABLE role_permissions (
    role_key VARCHAR(50) REFERENCES roles(role_key) ON DELETE CASCADE,
    perm_key VARCHAR(100) REFERENCES permissions(perm_key) ON DELETE CASCADE,
    PRIMARY KEY (role_key, perm_key)
);
```

#### Tabla `user_permissions`
Permisos específicos por usuario.

```sql
CREATE TABLE user_permissions (
    user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    perm_key VARCHAR(100) REFERENCES permissions(perm_key) ON DELETE CASCADE,
    granted_by UUID REFERENCES profiles(user_id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, perm_key)
);
```

#### Tabla `invitations`
Invitaciones de usuarios pendientes.

```sql
CREATE TABLE invitations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL REFERENCES roles(role_key),
    invited_by UUID REFERENCES profiles(user_id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);
```

### Esquema `instancias`

#### Tabla `INDICE`
Contenido del módulo de índice.

```sql
CREATE TABLE instancias.INDICE (
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
```

#### Tabla `INDICE_LOG`
Log de cambios en el módulo de índice.

```sql
CREATE TABLE instancias.INDICE_LOG (
    id SERIAL PRIMARY KEY,
    INDICE_ID INTEGER REFERENCES instancias.INDICE(ID) ON DELETE CASCADE,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Funciones RPC

### Autenticación y Perfiles

#### `get_profile_by_user_id(p_user_id UUID)`
Obtiene el perfil de un usuario por su ID.

**Parámetros:**
- `p_user_id`: UUID del usuario

**Retorna:** JSONB con los datos del perfil

#### `get_permissions_by_user_id(p_user_id UUID)`
Obtiene todos los permisos de un usuario (rol + permisos específicos).

**Parámetros:**
- `p_user_id`: UUID del usuario

**Retorna:** Array de strings con las claves de permisos

**Lógica de Verificación:**
1. Verifica que el usuario esté autenticado
2. Valida que el llamador tenga permiso `users.permissions` O sea el mismo usuario
3. Calcula UNION de:
   - Permisos del rol del usuario (role_permissions)
   - Permisos específicos del usuario (user_permissions)

**Seguridad**: Protege contra acceso no autorizado a permisos de otros usuarios.

#### `get_my_permissions()`
Obtiene los permisos del usuario actualmente autenticado.

**Retorna:** Array de strings con las claves de permisos

#### `user_has_permission(p_user_id UUID, p_perm_key VARCHAR(100))`
Verifica si un usuario tiene un permiso específico.

**Parámetros:**
- `p_user_id`: UUID del usuario
- `p_perm_key`: Clave del permiso a verificar

**Retorna:** BOOLEAN (TRUE si tiene el permiso, FALSE si no)

**Lógica**: Consulta `get_permissions_by_user_id()` y verifica si el permiso existe en el array.

#### `current_user_has_permission(p_perm_key VARCHAR(100))`
Verifica si el usuario actual tiene un permiso específico. **Esta es la función principal usada en políticas RLS.**

**Parámetros:**
- `p_perm_key`: Clave del permiso a verificar

**Retorna:** BOOLEAN (TRUE si tiene el permiso, FALSE si no)

**Lógica de Verificación**:
1. ¿Usuario autenticado?
2. ¿El rol del usuario tiene el permiso X? (role_permissions)
3. ¿Si no, el usuario específico tiene el permiso X? (user_permissions)

**Resultado**: TRUE o FALSE si el permiso existe para el rol O para el usuario específico.

### Módulo de Índice

#### `indice_list()`
Lista todos los elementos del índice.

**Retorna:** Tabla con todos los campos del índice

#### `indice_upsert(...)`
Crea o actualiza un elemento del índice.

**Parámetros:**
- `p_id`: ID del elemento (NULL para crear nuevo)
- `p_tema`: Tema del elemento
- `p_descripcion`: Descripción
- `p_contenido`: Contenido
- `p_etiquetas`: Etiquetas separadas por comas
- `p_color`: Color en formato hexadecimal
- `p_activo`: Si está activo
- `p_available_for_ai`: Si está disponible para IA

**Retorna:** JSONB con el resultado de la operación

#### `indice_delete(p_id INTEGER)`
Elimina un elemento del índice.

**Parámetros:**
- `p_id`: ID del elemento a eliminar

**Retorna:** JSONB con el resultado de la operación

### Invitaciones

#### `cancel_invitation_complete(p_invitation_id INTEGER, p_user_email VARCHAR(255))`
Cancela una invitación y elimina el usuario asociado si ya fue aceptada.

**Parámetros:**
- `p_invitation_id`: ID de la invitación
- `p_user_email`: Email del usuario

**Retorna:** JSONB con el resultado de la operación

## 🔒 Políticas RLS (Row Level Security)

### ⚠️ Principio Fundamental de Permisología

**El sistema NO filtra por roles, SOLO por permisos.**

**Secuencia de verificación**:
1. ¿Usuario autenticado?
2. ¿El rol del usuario tiene el permiso X? (role_permissions)
3. ¿Si no, el usuario específico tiene el permiso X? (user_permissions)

**NUNCA verificar roles directamente en políticas RLS o funciones RPC.** Siempre usar permisos específicos.

### Principios de Seguridad

1. **Autenticación requerida**: Todas las tablas requieren usuario autenticado
2. **Principio de menor privilegio**: Los usuarios solo ven lo que necesitan
3. **Verificación por permisos**: Todas las políticas usan `current_user_has_permission()` que verifica permisos del rol O permisos específicos
4. **Auditoría**: Log de todas las acciones importantes
5. **Optimización de rendimiento**: Políticas optimizadas para evitar recursión infinita

### Políticas por Tabla

#### `profiles`
- Los usuarios pueden ver su propio perfil
- Usuarios con permiso `users.view` pueden ver todos los perfiles
- Usuarios con permiso `users.edit` pueden actualizar perfiles

#### `roles`, `permissions`, `role_permissions`
- Solo lectura para usuarios autenticados
- No se pueden modificar desde la aplicación

#### `user_permissions`
- Los usuarios pueden ver sus propios permisos
- Usuarios con permiso `users.permissions` pueden gestionar todos los permisos

#### `invitations`
- Usuarios con permiso `invitations.view` pueden ver invitaciones
- Usuarios con permiso `invitations.manage` pueden gestionar invitaciones

#### `instancias.INDICE`
- Todos los usuarios autenticados pueden ver elementos activos
- Solo usuarios con permiso `indice.manage` pueden modificar

#### `instancias.INDICE_LOG`
- Solo usuarios con permiso `indice.manage` pueden ver el log

#### `frontconfig`
- Lectura pública para configuración visual (theme, site) - permite que el look and feel esté disponible antes de autenticación
- Todos los usuarios autenticados pueden ver la configuración
- Gestión disponible para usuarios autenticados (TODO: agregar permiso específico en el futuro)

## 🔄 Triggers Automáticos

### `handle_new_user()`
Se ejecuta automáticamente cuando se crea un nuevo usuario en `auth.users`:
1. Crea un perfil en la tabla `profiles`
2. Asigna el rol por defecto 'user'
3. Usa el nombre del metadata o el email como nombre

### `update_updated_at_column()`
Actualiza automáticamente el campo `updated_at` en las tablas:
- `profiles`
- `instancias.INDICE`
- `frontconfig`

## 📊 Índices para Optimización

### Índices de Búsqueda
- `profiles.email`: Búsqueda por email
- `profiles.role`: Filtrado por rol
- `invitations.email`: Búsqueda de invitaciones
- `invitations.status`: Filtrado por estado

### Índices de Rendimiento
- `user_permissions.user_id`: Consultas de permisos
- `instancias.INDICE.ACTIVO`: Filtrado de elementos activos
- `instancias.INDICE_LOG.INDICE_ID`: Log por elemento

## 🛠️ Mantenimiento

### Limpieza de Datos
```sql
-- Eliminar invitaciones expiradas (ejecutar periódicamente)
DELETE FROM invitations 
WHERE expires_at < NOW() 
AND accepted_at IS NULL;

-- Limpiar log antiguo (opcional)
DELETE FROM instancias.INDICE_LOG 
WHERE created_at < NOW() - INTERVAL '1 year';
```

### Backup Recomendado
1. **Datos críticos**: `profiles`, `roles`, `permissions`, `role_permissions`
2. **Configuración**: `frontconfig`
3. **Contenido**: `instancias.INDICE`
4. **Auditoría**: `instancias.INDICE_LOG`, `invitations`

### Monitoreo
- Revisar logs de errores en las funciones RPC
- Monitorear el uso de permisos
- Verificar la integridad de las relaciones

## ⚠️ Consideraciones Importantes

### Seguridad
- Las funciones RPC usan `SECURITY DEFINER` para mayor control
- Las políticas RLS son la primera línea de defensa y están optimizadas
- Los permisos se verifican tanto en frontend como backend
- No hay recursión infinita en las políticas RLS

### Rendimiento
- Los índices están optimizados para las consultas más comunes
- Las funciones RPC están diseñadas para ser eficientes
- Las políticas RLS usan `(SELECT auth.uid())` para mejor rendimiento
- Se recomienda monitorear el rendimiento en producción

### Escalabilidad
- El sistema está diseñado para manejar miles de usuarios
- Las consultas están optimizadas para grandes volúmenes
- Se puede particionar `instancias.INDICE_LOG` si es necesario
- Las políticas RLS están optimizadas para evitar problemas de rendimiento

## 🔧 Personalización

### Agregar Nuevos Permisos
```sql
INSERT INTO permissions (perm_key, name, description, module) 
VALUES ('mi-modulo.view', 'Ver Mi Módulo', 'Acceso de lectura', 'mi-modulo');

INSERT INTO role_permissions (role_key, perm_key) 
VALUES ('admin', 'mi-modulo.view');
```

### Agregar Nuevos Roles
```sql
INSERT INTO roles (role_key, name, description) 
VALUES ('editor', 'Editor', 'Puede editar contenido');

-- Asignar permisos al nuevo rol
INSERT INTO role_permissions (role_key, perm_key) 
SELECT 'editor', perm_key 
FROM permissions 
WHERE module = 'indice';
```

### Modificar Configuración por Defecto
```sql
UPDATE frontconfig 
SET value = jsonb_set(value, '{brandName}', '"Mi Empresa"')
WHERE key = 'theme';
```

### Usuario Administrador por Defecto
El sistema incluye funciones para configurar un usuario administrador:

- **Email:** admin@smartautomatai.com
- **Contraseña:** 12345678
- **Rol:** superadmin
- **Permisos:** Acceso completo al sistema

**Crear el usuario:**
1. Ve a Supabase Dashboard > Authentication > Users
2. Crea usuario con las credenciales mencionadas
3. Ejecuta el SQL - el perfil se configurará automáticamente con rol superadmin

**Verificar configuración:**
```sql
-- Verificar usuario admin
SELECT email, role, name FROM profiles WHERE email = 'admin@smartautomatai.com';

-- Verificar permisos del admin
SELECT array_agg(perm_key) as permissions
FROM role_permissions 
WHERE role_key = 'superadmin';
```

**Nota:** La función `create_default_admin()` solo configura el perfil si el usuario ya existe en `auth.users`. No crea usuarios inexistentes para evitar errores de clave foránea.

## 📞 Soporte

Si encuentras problemas con el SQL:

1. Verifica que todas las extensiones estén habilitadas
2. Revisa los logs de Supabase para errores
3. Asegúrate de que el usuario tenga permisos de administrador
4. Consulta la documentación de Supabase para RLS

### Verificación Rápida
```sql
-- Verificar que el usuario admin existe
SELECT email, role FROM profiles WHERE email = 'admin@smartautomatai.com';

-- Verificar políticas RLS
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Verificar funciones RPC
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';
```

---

**¡El SQL está optimizado y listo para usar sin errores! 🚀**
