# Documentación Completa - Setup de SestIA en Supabase

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Principio Fundamental de Permisología](#principio-fundamental-de-permisología)
3. [Componentes del Sistema](#componentes-del-sistema)
4. [Estructura de Base de Datos](#estructura-de-base-de-datos)
5. [Edge Functions](#edge-functions)
6. [Proceso de Instalación](#proceso-de-instalación)
7. [Configuración Requerida](#configuración-requerida)
8. [Verificación Post-Instalación](#verificación-post-instalación)
9. [Storage (Buckets y TTL)](#storage-buckets-y-ttl)

---

## 📊 Resumen Ejecutivo

Este documento describe **todo el proceso** necesario para configurar completamente SestIA en Supabase. El sistema incluye:

- **Base de datos**: Tablas, funciones RPC, políticas RLS, triggers y índices
- **Edge Functions**: Funciones serverless para envío de invitaciones
- **Autenticación**: Sistema completo de usuarios, roles y permisos
- **Módulos**: Sistema de índice y gestión de usuarios
- **Agente IA (N8N)**: Esquema para configuración, contactos, encuestas, tareas y asignaciones
- **KPIDATA (Métricas)**: Esquema para métricas, multimedia y herramientas del agente

### Archivos Principales

- `sql definitivo.sql`: Contiene **TODA** la configuración de base de datos (incluye el esquema del Agente IA)
- `supabase/functions/invite-user/index.ts`: Edge Function para envío de invitaciones
- Este documento: Guía completa de implementación

---

## ⚠️ Principio Fundamental de Permisología

**El sistema NO filtra por roles, SOLO por permisos.**

### Secuencia de Verificación:

1. **¿Usuario autenticado?** - Verificar `auth.uid()`
2. **¿El rol del usuario tiene el permiso X?** - Consultar `role_permissions` basándose en el rol del usuario
3. **¿Si no, el usuario específico tiene el permiso X?** - Consultar `user_permissions` para permisos asignados directamente

**Resultado**: TRUE o FALSE si el permiso existe para:
- El rol del usuario (desde `role_permissions`), O
- El permiso específico asignado al usuario (desde `user_permissions`)

**NUNCA verificar roles directamente en políticas RLS o funciones RPC.** Siempre usar permisos específicos.

Cada acción del sistema tiene su permiso específico (ej: `users.view`, `users.edit`, `users.invite`, etc.) para máximo control granular.

---

## 🗂️ Componentes del Sistema

### 1. Base de Datos (PostgreSQL)

**Archivo**: `sql definitivo.sql`

**Contenido**:
- ✅ Extensiones necesarias (`uuid-ossp`, `pgcrypto`)
- ✅ Tablas principales (profiles, roles, permissions, invitations, frontconfig, instancias.INDICE)
- ✅ Funciones RPC (get_profile_by_user_id, get_permissions_by_user_id, indice_*, accept_invitation_native, etc.)
- ✅ Políticas RLS (Row Level Security) para todas las tablas
- ✅ Triggers (actualización automática de `updated_at`, creación automática de perfiles)
- ✅ Índices para optimización
- ✅ Datos iniciales (roles, permisos, configuración por defecto)

### 2. Edge Functions (Deno)

**Carpeta**: `supabase/functions/`

**Funciones Disponibles**:
- ✅ `invite-user`: Envía invitaciones por email usando `auth.admin.inviteUserByEmail()`

### 3. Frontend (JavaScript)

**Archivos principales**:
- `WEB/app-init.js`: Inicialización de la aplicación y manejo de autenticación
- `WEB/modules/users/init.js`: Gestión de usuarios e invitaciones
 
---

## 🗄️ Estructura de Base de Datos

### Tablas Principales

#### 1. **frontconfig**
Configuración visual y de marca del sitio web.
- `key`: Clave única (theme, site)
- `value`: Configuración en JSONB
- `description`: Descripción de la configuración

#### 2. **profiles**
Perfiles de usuarios del sistema.
- `user_id`: UUID (FK a `auth.users`)
- `email`: Email del usuario
- `name`: Nombre del usuario
- `role`: Rol del usuario (user, admin, superadmin)
- `created_at`, `updated_at`: Timestamps automáticos

#### 3. **roles**
Roles disponibles en el sistema.
- `role_key`: Clave única (user, admin, superadmin)
- `name`: Nombre del rol
- `description`: Descripción del rol

#### 4. **permissions**
Permisos específicos del sistema. **IMPORTANTE**: El sistema NO filtra por roles, SOLO por permisos. Cada acción debe tener su permiso específico.

**Permisos disponibles**:
- `home.view` - Ver Inicio
- `users.view`, `users.manage`, `users.invite`, `users.create`, `users.edit`, `users.delete`, `users.permissions` - Gestión de usuarios
- `indice.view`, `indice.manage`, `indice.create`, `indice.edit`, `indice.delete` - Gestión de índice
- `invitations.view`, `invitations.manage`, `invitations.cancel` - Gestión de invitaciones

- `perm_key`: Clave única (formato: `[módulo].[acción]`)
- `name`: Nombre del permiso
- `description`: Descripción del permiso
- `module`: Módulo al que pertenece

#### 5. **role_permissions**
Asignación de permisos a roles.
- `role_key`: FK a `roles`
- `perm_key`: FK a `permissions`

#### 6. **user_permissions**
Permisos específicos por usuario.
- `user_id`: FK a `profiles`
- `perm_key`: FK a `permissions`
- `granted_by`: FK a `profiles` (quien otorgó el permiso)
- `granted_at`: Timestamp de otorgamiento

#### 7. **invitations**
Invitaciones de usuarios pendientes.
- `id`: ID serial
- `email`: Email del usuario invitado
- `role`: Rol asignado (FK a `roles`)
- `invited_by`: FK a `profiles` (quien invitó)
- `expires_at`: Fecha de expiración
- `accepted_at`: Fecha de aceptación
- `status`: Estado (pending, accepted, expired, cancelled)
- `name`: Nombre del usuario invitado

#### 8. **instancias.INDICE**
Contenido del módulo de índice.
- `ID`: ID serial
- `TEMA`: Tema del índice
- `DESCRIPCION`: Descripción
- `CONTENIDO`: Contenido completo
- `ETIQUETAS`: Etiquetas separadas por comas
- `COLOR`: Color hexadecimal
- `ACTIVO`: Boolean de activación
- `AVAILABLE_FOR_AI`: Boolean para disponibilidad para IA

#### 9. **instancias.INDICE_LOG**
Log de cambios en el módulo de índice.
- `id`: ID serial
- `INDICE_ID`: FK a `instancias.INDICE`
- `user_email`: Email del usuario que realizó la acción
- `action`: Acción realizada (created, updated, deleted)
- `created_at`: Timestamp automático

### 10. Agente IA (N8N)

Tablas y vista principales (todas bajo esquema `instancias`):

1) `agent_config`: Config general de webhooks, banderas y parámetros del núcleo del agente.
    - Campos clave: `i_channels_webhook`, `i_core_webhook`, `c_channels_webhook`, `c_instance_webhook`, `i_blacklist`, `i_tasks`
    - Nuevos parámetros:
       - `eleven_labs` (JSONB): Config TTS (`key`, `model`, `voice_id`, `output_format`). Default: modelo multilingüe.
       - `context_length` (SMALLINT): Profundidad de contexto conversacional permitida (default 15).
       - `owner_list` (TEXT[]): Lista de identificadores autorizados para administración avanzada del agente.
2) `agent_vars`: Variables base/knowledge inicial del agente (nombre, personalidad, conocimientos y listas de stickers/galería).
3) `agent_core_list`: Núcleos (cores) por chat/canal: distintas configuraciones de prompt/memoria.
   - Campos: `core_name`, `core_chat` (único), `core_instructions`, `core_restrictions`, `core_memories` (JSONB[]), `core_channel`, `core_description`.
    - `core_memories` default: array con un objeto inicial:
       ```json
       [{"id":0,"admin":"Smart Automata","content":"Debo responder siempre en español","created_at":"2025-11-19 19:57:48.598309+00"}]
       ```
    - Uso: Permite múltiples configuraciones de personalidad/memoria según el chat destino.
4) `blacklist`: Bloqueo de usuarios/chats.
5) `input_channels`: Definición de canales de entrada (con capacidades en `output_supports`).
6) `agent_contact_list`: Contactos administrados por el agente, PK compuesta `(user_id, contact_system_channel)`.
7) `agent_surveys`: Encuestas estructuradas (JSONB `schema` + validaciones), índices por estado/tipo y GIN del schema. Trigger `extensions.moddatetime(updated_at)`.
8) `agent_task_list`: Tareas del agente (`task_type`: survey/notification/data_collection/action), índices por estado, tipo, prioridad, due date, filtros (GIN). Trigger `extensions.moddatetime(updated_at)`.
9) `agent_task_assign`: Asignación de tareas a contactos, estado individual, resultados/respuestas, progreso.
10) `v_tasks_summary`: Vista resumen de tareas con conteos por estado.

RPC unificada:
- `instancias.complete_or_report_agent_task(p_contact_user_id TEXT, p_task_id UUID, p_answers JSONB DEFAULT NULL, p_notes TEXT DEFAULT NULL) RETURNS JSONB`
   - Survey: exige `p_answers` y valida contra `agent_surveys.schema`.
   - Otros tipos: prohíbe `p_answers` y exige `p_notes`.
   - Calcula progreso y completa automáticamente cuando corresponde.

---

## 🗂️ Storage (Buckets y TTL)

Esta instalación define y asegura los buckets de Supabase Storage para ingesta, generación y publicación, y programa limpieza automática (TTL) en buckets de trabajo.

### Buckets
- Privados:
   - `media-incoming`: Ingesta desde canales (WhatsApp/Telegram/Webchat, etc.)
   - `media-generated`: Salidas generadas por IA antes de publicación
   - `media-special`: Contenidos especiales (campañas/datasets/compliance)
- Públicos:
   - `media-published`: Publicaciones aprobadas con acceso duradero
   - `public-assets`: Activos estáticos para el frontend

### Políticas de Acceso
- Lectura pública: `media-published`, `public-assets` (anon, authenticated)
- Lectura privada: `agent.view` en `media-incoming`, `media-generated`, `media-special`
- Gestión (subir/actualizar/borrar): `agent.manage` en todos los buckets

### Signed URLs (Recomendado)
- Generar URLs temporales desde backend/N8N (service_role) para análisis externo (GPT/Gemini) sobre buckets privados.
- Publicación duradera: copiar/mover a `media-published` cuando sea necesario compartir sin expiración.

### TTL (Limpieza Automática)
- `pg_cron` programa el job `purge_media_ttl_30d` diario a las 03:15 UTC.
- Elimina objetos con más de 30 días en `media-incoming` y `media-generated`.
- Para preservar archivos, muévelos antes del TTL a `media-special` o `media-published`.

#### Estructura de Rutas (Convenciones)

Las rutas en Storage son nombres de objeto con `/` como separador. No existen directorios físicos; cualquier "carpeta" aparece al subir un objeto con ese prefijo. Convenciones adoptadas:

```
media-incoming/
   <system_channel>/ (telegram | whatsapp | webchat)
      <YYYY>/<MM>/<DD>/
         <contact_user_id>/
            <uuid>.<ext>

media-generated/
   <type>/ (image | audio | video | document)
      <model_or_tool>/ (gpt-vision | whisper | stable-diffusion | otros)
         <YYYY>/<MM>/<DD>/
            <task_id>/
               <uuid>.<ext>

media-special/
   campaigns/<campaign_key>/<YYYY>/<MM>/<DD>/<uuid>.<ext>
   datasets/<dataset_key>/(estructura dependiente del dataset)
   compliance/<year>/<case_id>/(estructura legal/auditoría)

public-assets/
   stickers/<pack>/<filename>
   gallery/<collection>/<filename>
   banners/<filename>
   misc/<...>

media-published/
   <content_domain>/<...> (flexible según el modelo de publicación)
```

Tokens dinámicos:
- `<YYYY>/<MM>/<DD>`: Fecha en UTC recomendada
- `<contact_user_id>`: ID interno del contacto (no exponer datos sensibles)
- `<task_id>`: UUID de la tarea que produjo el artefacto
- `<uuid>`: Identificador único del archivo (uuid v4)
- `<model_or_tool>`: Nombre estandarizado de la fuente generadora (ej: `gpt-vision`, `whisper`)
- `<content_domain>`: Categoría o dominio editorial (blog, faq, promo, etc.)

Buenas prácticas:
- Usar siempre minúsculas y guiones medios para nombres de herramientas/modelos.
- Evitar espacios y caracteres especiales en IDs.
- Fechas normalizadas en UTC para facilitar purgas y agregaciones.
- Mantener consistencia en `<contact_user_id>` (no usar emails directamente; preferir UUID interno o hash reversible si se requiere privacidad adicional).

Placeholders opcionales:
Puedes hacer que los prefijos estáticos aparezcan en el dashboard creando archivos vacíos `.keep`:

Ejemplos de prefijos que pueden llevar `.keep`:
- `media-incoming/telegram/.keep`
- `media-incoming/whatsapp/.keep`
- `media-incoming/webchat/.keep`
- `media-generated/image/.keep`, `media-generated/audio/.keep`, etc.
- `media-special/campaigns/.keep`, `media-special/datasets/.keep`, `media-special/compliance/.keep`
- `public-assets/stickers/.keep`, `public-assets/gallery/.keep`, `public-assets/banners/.keep`, `public-assets/misc/.keep`

No recomendamos pre-crear rutas con fechas, IDs o llaves variables (crecen rápido y añaden ruido). Se generan on-demand al subir contenido.

##### ¿Se pueden crear "carpetas" vía SQL?
Sí, creando objetos vacíos (placeholders). Ejemplo idempotente (usa `.keep`):

```sql
-- OPCIONAL: crear placeholders para prefijos estáticos
INSERT INTO storage.objects (bucket_id, name)
VALUES
      ('media-incoming','telegram/.keep'),
      ('media-incoming','whatsapp/.keep'),
      ('media-incoming','webchat/.keep'),
      ('media-generated','image/.keep'),
      ('media-generated','audio/.keep'),
      ('media-generated','video/.keep'),
      ('media-generated','document/.keep'),
      ('media-special','campaigns/.keep'),
      ('media-special','datasets/.keep'),
      ('media-special','compliance/.keep'),
      ('public-assets','stickers/.keep'),
      ('public-assets','gallery/.keep'),
      ('public-assets','banners/.keep'),
      ('public-assets','misc/.keep')
ON CONFLICT DO NOTHING;
```

Notas:
- Si la tabla `storage.objects` tuviera columnas adicionales requeridas en tu instalación (ej: `owner`), añade valores por defecto o ajusta el INSERT.
- Estos archivos pueden ser de cero bytes; el objetivo es solo visual.
- El script principal no los crea por defecto para evitar dependencia de estructura interna de Supabase Storage.

##### Publicación de Contenido
1. Subir a `media-incoming` (ingesta bruta) o `media-generated` (output modelo).
2. Procesar/anotar y registrar metadata (tabla `kpidata.multimedia` opcional).
3. Copiar o mover versión aprobada a `media-published`.
4. Generar URL permanente (sin expiración) o usar directamente la ruta pública.
5. Si requiere preservación interna sin exposición pública (auditoría, dataset): mover a `media-special`.

##### Limpieza y Retención
- `media-incoming` / `media-generated`: 30 días (cron) → mover antes del límite si se requiere retención.
- `media-special`: Sin TTL automático (control manual).
- `media-published` / `public-assets`: Sin TTL (contenidos duraderos / estáticos).

##### Ejemplo de Path Completo
```
media-generated/image/stable-diffusion/2025/11/18/5c4e2d8e-9f6a-4c1e-b0e2-9d3f1bb0b123.png
```
Componentes: bucket / tipo / modelo / fecha / task_id (omitido si no aplica) / uuid.ext

##### Riesgos a Evitar
- Mezclar modelos y tipos (ej: `image/whisper/` incorrecto).
- Usar emails sin anonimización en `<contact_user_id>`.
- Fechas locales inconsistentes → siempre UTC.
- Falta de normalización en nombres de modelos (usar minúsculas y guiones).

### 11. KPIDATA (Métricas del Agente)

Esquema `kpidata` para telemetría y contenidos auxiliares del agente. Acceso previsto vía `service_role` (N8N/backend); RLS habilitado en todas las tablas.

Tablas principales:

1) `kpidata.iainterna`: Mensajes internos del agente para auditoría/seguimiento.
   - Campos: `from`, `to`, `content`, `created_at`.

2) `kpidata.multimedia`: Registros multimedia asociados a interacciones (audio, imagen, documento, etc.).
   - Campos: `type`, `url`, `filename`, `size`, `tokens`, `chat_id`, `user_id`, `user_channel`, `system_channel`, `prompt_id`, `prompt_tokens`, `completion_token`, `audio_seconds`, `direccion`, `created_at`.

3) `kpidata.tools`: Ejecuciones de herramientas del agente.
   - Campos: `tool`, `result`, `status`, `created_at`.

Permisos y seguridad:
- RLS habilitado en `kpidata.iainterna`, `kpidata.multimedia`, `kpidata.tools`.
- `service_role` tiene USAGE en el esquema y ALL PRIVILEGES sobre tablas, secuencias y funciones (incluye default privileges para futuros objetos).

### Funciones RPC

#### Funciones de Usuario y Perfiles

1. **`get_profile_by_user_id(p_user_id UUID)`**
   - Retorna: JSONB con datos del perfil
   - Uso: Obtener perfil de un usuario específico

2. **`get_permissions_by_user_id(p_user_id UUID)`**
   - Retorna: TEXT[] con permisos del usuario
   - Uso: Obtener todos los permisos de un usuario (rol + específicos)
   - **Seguridad**: Valida que el llamador tenga permiso `users.permissions` o sea el mismo usuario
   - **Lógica**: Calcula UNION de permisos del rol (role_permissions) + permisos específicos (user_permissions)

3. **`get_my_permissions()`**
   - Retorna: TEXT[] con permisos del usuario actual
   - Uso: Obtener permisos del usuario autenticado

#### Funciones Helper de Permisos

4. **`user_has_permission(p_user_id UUID, p_perm_key VARCHAR(100))`**
   - Retorna: BOOLEAN
   - Uso: Verificar si un usuario tiene un permiso específico
   - **Lógica**: Consulta `get_permissions_by_user_id()` para verificar si el permiso existe

5. **`current_user_has_permission(p_perm_key VARCHAR(100))`**
   - Retorna: BOOLEAN
   - Uso: Verificar si el usuario actual tiene un permiso específico (usado en políticas RLS)
   - **Lógica**: Verifica permisos del rol (role_permissions) O permisos específicos (user_permissions)

#### Funciones del Módulo de Índice

4. **`indice_list()`**
   - Retorna: TABLE con todos los elementos del índice
   - Uso: Listar todos los elementos del índice

5. **`indice_upsert(...)`**
   - Parámetros: ID (opcional), tema, descripción, contenido, etiquetas, color, activo, available_for_ai
   - Retorna: JSONB con resultado (success, id)
   - Uso: Crear o actualizar un elemento del índice

6. **`indice_delete(p_id INTEGER)`**
   - Retorna: JSONB con resultado (success)
   - Uso: Eliminar un elemento del índice

#### Funciones de Invitaciones

7. **`accept_invitation_native(p_email VARCHAR(255))`**
   - Retorna: JSON con resultado (success, message, role)
   - Uso: Aceptar una invitación pendiente (actualiza perfil con rol)

8. **`cancel_invitation_complete(p_invitation_id INTEGER, p_user_email VARCHAR(255))`**
   - Retorna: JSON con resultado (success, message)
   - Uso: Cancelar una invitación (solo superadmin)

### Políticas RLS (Row Level Security)

**⚠️ PRINCIPIO FUNDAMENTAL**: El sistema NO filtra por roles, SOLO por permisos. Todas las políticas verifican permisos específicos usando `current_user_has_permission()` que consulta:
1. Permisos del rol del usuario (role_permissions)
2. Permisos específicos del usuario (user_permissions)

**Secuencia de verificación**:
1. ¿Usuario autenticado?
2. ¿El rol del usuario tiene el permiso X? (role_permissions)
3. ¿Si no, el usuario específico tiene el permiso X? (user_permissions)

Todas las tablas tienen RLS habilitado con políticas específicas:

- **profiles**: Usuarios pueden ver su propio perfil. Usuarios con permiso `users.view` pueden ver todos. Usuarios con permiso `users.edit` pueden editar perfiles.
- **roles**: Lectura para usuarios autenticados
- **permissions**: Lectura para usuarios autenticados
- **role_permissions**: Lectura para usuarios autenticados
- **user_permissions**: Usuarios pueden ver sus propios permisos. Usuarios con permiso `users.permissions` pueden gestionar todos.
- **invitations**: Usuarios con permiso `invitations.view` pueden ver. Usuarios con permiso `invitations.manage` pueden gestionar todas las invitaciones.
- **instancias.INDICE**: Usuarios autenticados pueden ver elementos activos. Usuarios con permiso `indice.manage` pueden gestionar.
- **instancias.INDICE_LOG**: Usuarios con permiso `indice.manage` pueden ver logs.
- **frontconfig**: Lectura pública para configuración visual (theme, site) - permite que el look and feel esté disponible antes de autenticación. Usuarios autenticados pueden ver toda la configuración.

#### Agente IA (N8N)
- RLS habilitado en todas las tablas del agente. No se crean políticas para `anon`/`authenticated`, por lo que el acceso directo desde el cliente está bloqueado.
- El rol `service_role` (usado por N8N/backend) bypassa RLS y tiene permisos otorgados a nivel del esquema `instancias`.
- Si en el futuro se requiere acceso desde `authenticated`, crear políticas específicas basadas en permisos `agent.*` (por ejemplo, `agent.view`, `agent.manage`).

### Triggers

1. **`update_updated_at_column()`**
   - Actualiza automáticamente `updated_at` en: profiles, instancias.INDICE, frontconfig

2. **`handle_new_user()`**
   - Crea automáticamente un perfil cuando se crea un nuevo usuario en `auth.users`
   - Usa `raw_user_meta_data` para obtener nombre y rol

3. **`extensions.moddatetime(updated_at)`**
   - Utilizado en `instancias.agent_surveys` y `instancias.agent_task_list` para mantener `updated_at` sin funciones personalizadas.

---

## ⚡ Edge Functions

### `invite-user`

**Ubicación**: `supabase/functions/invite-user/index.ts`

**Descripción**: Envía invitaciones por email usando la API de administración de Supabase.

**Funcionalidad**:
1. Verifica que el usuario tenga rol `superadmin` o `admin`
2. Usa `auth.admin.inviteUserByEmail()` para enviar el email
3. Crea un registro en la tabla `invitations` para tracking
4. Configura metadata del usuario (nombre y rol)

**Parámetros del Request**:
```json
{
  "email": "usuario@example.com",
  "role": "user",
  "name": "Nombre del Usuario"
}
```

**Respuesta Exitosa**:
```json
{
  "id": "uuid-del-usuario",
  "email": "usuario@example.com",
  ...
}
```

**Respuesta de Error**:
```json
{
  "error": "Mensaje de error"
}
```

**Variables de Entorno Requeridas**:
- `SUPABASE_URL`: URL del proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (solo para Edge Functions)
- `SITE_URL`: URL del sitio web (para redirectTo del enlace de invitación)

**Uso desde el Frontend**:
```javascript
const { data, error } = await supabase.functions.invoke('invite-user', {
  body: {
    email: 'usuario@example.com',
    role: 'user',
    name: 'Nombre del Usuario'
  }
});
```

---

## 🚀 Proceso de Instalación

### Paso 1: Preparar el Proyecto Supabase

1. Crear un proyecto nuevo en Supabase o usar uno existente
2. Obtener las credenciales:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Paso 2: Ejecutar el SQL

1. Abrir el **SQL Editor** en el Dashboard de Supabase
2. Copiar todo el contenido de `sql definitivo.sql`
3. Ejecutar el script completo
4. Verificar que no haya errores
5. Verificar en `Table Editor` (esquema `instancias`) que existan las tablas del Agente IA y la vista `v_tasks_summary`

**⚠️ IMPORTANTE**: Antes de ejecutar el SQL, asegúrate de:
- Tener creado el usuario `admin@smartautomatai.com` en Authentication > Users
- O modificar el email del admin en el SQL según tus necesidades

### Paso 3: Configurar Variables de Entorno

En el Dashboard de Supabase:
1. Ir a **Settings** > **Edge Functions**
2. Configurar las siguientes variables:
   - `SITE_URL`: URL completa de tu sitio web (ej: `https://tudominio.com`)

### Paso 4: Desplegar Edge Functions

1. Instalar Supabase CLI (si no está instalado):
```bash
npm install -g supabase
```

2. Autenticarse con Supabase:
```bash
supabase login
```

3. Vincular el proyecto:
```bash
supabase link --project-ref tu-project-ref
```

4. Desplegar la Edge Function:
```bash
supabase functions deploy invite-user
```

**Alternativa usando MCP**:
Si usas Sestia MCP, puedes desplegar directamente desde ahí usando:
```
mcp_Sestia_MCP_deploy_edge_function
```

### Paso 5: Verificar Configuración

1. **Verificar Tablas**:
   - Ir a **Table Editor** en el Dashboard
   - Verificar que existan todas las tablas mencionadas

2. **Verificar Funciones RPC**:
   - Ir a **Database** > **Functions**
   - Verificar que existan todas las funciones RPC

3. **Verificar Edge Functions**:
   - Ir a **Edge Functions**
   - Verificar que `invite-user` esté desplegada y activa

4. **Verificar RLS**:
   - En cada tabla, verificar que RLS esté habilitado
   - Verificar que existan las políticas necesarias

5. **Verificar Agente IA (N8N)**:
   - Tablas `agent_config`, `agent_vars`, `blacklist`, `input_channels`, `agent_contact_list`, `agent_surveys`, `agent_task_list`, `agent_task_assign` creadas en `instancias`
   - Vista `v_tasks_summary` creada
   - Probar la RPC `instancias.complete_or_report_agent_task` desde backend (service_role)

6. **Verificar KPIDATA (Métricas)**:
   - En esquema `kpidata`, verificar tablas: `iainterna`, `multimedia`, `tools`
   - Confirmar que RLS esté habilitado en las tres tablas
   - En Grants, confirmar que `service_role` tiene USAGE en `kpidata` y ALL PRIVILEGES sobre tablas/funciones/secuencias

7. **Verificar Storage**:
   - En SQL Editor:
     - `SELECT id, public FROM storage.buckets WHERE id IN ('media-incoming','media-generated','media-special','media-published','public-assets');`
     - `SELECT jobname, schedule FROM cron.job WHERE jobname = 'purge_media_ttl_30d';`
   - En Policies de `storage.objects` comprobar:
     - Lectura pública en `media-published` y `public-assets`
     - Lectura privada con `agent.view` en buckets privados
     - Gestión con `agent.manage` en todos los buckets

---

## ⚙️ Configuración Requerida

### 1. Usuario Administrador

**Requisito**: Antes de ejecutar el SQL, debe existir el usuario `admin@smartautomatai.com` en Authentication > Users.

**Pasos**:
1. Ir a **Authentication** > **Users**
2. Hacer clic en **Add user**
3. Crear usuario:
   - Email: `admin@smartautomatai.com`
   - Password: `12345678` (o la que prefieras)
   - Confirm Password: `12345678`
4. Hacer clic en **Create user**

**Nota**: El SQL verificará que este usuario existe y configurará su perfil con rol `superadmin` automáticamente.

### 2. Variables de Entorno en Edge Functions

**En el Dashboard de Supabase**:
1. Ir a **Edge Functions** > **invite-user** > **Settings**
2. Configurar:
   - `SITE_URL`: URL completa de tu sitio (ej: `https://tudominio.com`)

### 3. Configuración de Email (Opcional)

Para personalizar los emails de invitación:
1. Ir a **Authentication** > **Email Templates**
2. Personalizar el template **Invite user**

---

## ✅ Verificación Post-Instalación

### Checklist de Verificación

#### Base de Datos

- [ ] Todas las tablas están creadas
- [ ] Todas las funciones RPC están creadas
- [ ] RLS está habilitado en todas las tablas
- [ ] Las políticas RLS están correctas
- [ ] Los triggers están activos
- [ ] Los índices están creados
- [ ] Los datos iniciales (roles, permisos) están insertados
- [ ] Permisos del agente agregados (`agent.view`, `agent.manage`, `agent.logs`, `agent.run`) y asignados a `admin`/`superadmin`
- [ ] Esquema `kpidata` creado con tablas `iainterna`, `multimedia`, `tools`
- [ ] RLS habilitado en todas las tablas de `kpidata`
- [ ] Grants de `service_role` en `kpidata` vigentes (USAGE + ALL PRIVILEGES)
- [ ] Storage: buckets creados (privados y públicos) y políticas activas
- [ ] Job `purge_media_ttl_30d` programado; `pg_cron` disponible

#### Edge Functions

- [ ] `invite-user` está desplegada
- [ ] `invite-user` está activa
- [ ] Las variables de entorno están configuradas

#### Usuario Administrador

- [ ] El usuario `admin@smartautomatai.com` existe
- [ ] El usuario tiene perfil en la tabla `profiles`
- [ ] El perfil tiene rol `superadmin`
- [ ] Puedes iniciar sesión con este usuario

#### Funcionalidad

- [ ] Puedes crear invitaciones desde el módulo de usuarios
- [ ] Los emails de invitación se envían correctamente
- [ ] Los usuarios pueden aceptar invitaciones y establecer contraseña
- [ ] Los permisos se cargan correctamente
- [ ] El módulo de índice funciona correctamente
- [ ] La RPC `instancias.complete_or_report_agent_task` funciona para `survey` (con `p_answers`) y para `notification`/`data_collection`/`action` (con `p_notes`) usando `service_role`

### Pruebas Manuales

1. **Probar Invitación**:
   - Iniciar sesión como admin
   - Ir a Módulo de Usuarios
   - Crear una invitación
   - Verificar que llegue el email
   - Aceptar la invitación y establecer contraseña

2. **Probar Permisos**:
   - Verificar que los usuarios solo ven lo que tienen permiso
   - Verificar que los admins tienen acceso completo

3. **Probar Módulo de Índice**:
   - Crear un elemento del índice
   - Editar un elemento
   - Eliminar un elemento
   - Verificar los logs

---

## 📝 Notas Importantes

### Sobre `accept_invitation_native`

**IMPORTANTE**: Esta función RPC ya **NO se usa** en el flujo actual de invitaciones. El flujo nativo en `app-init.js` maneja todo automáticamente:

1. El usuario hace clic en el enlace de invitación
2. Supabase autentica al usuario automáticamente
3. `app-init.js` detecta `type=invite` y abre el modal
4. El usuario establece su contraseña
5. El perfil se actualiza automáticamente con el rol de la invitación

La función `accept_invitation_native` está disponible por si se necesita en el futuro, pero **no es requerida** para el flujo actual.

### Sobre `create_invitation`

**Eliminada**: Esta función RPC fue reemplazada por la Edge Function `invite-user`. El SQL incluye `DROP FUNCTION IF EXISTS` para asegurar que no queden versiones antiguas.

### Sobre la Estructura de Carpetas

```
SUPABASE/
├── sql definitivo.sql          # Script SQL completo
├── SETUP_COMPLETO.md            # Este documento
├── supabase/
│   └── functions/
│       └── invite-user/
│           └── index.ts        # Edge Function de invitaciones
```

---

## 🔧 Troubleshooting

### Error: "Usuario admin@smartautomatai.com no encontrado"

**Solución**: Crear el usuario en Authentication > Users antes de ejecutar el SQL.

### Error: "Missing Authorization header" en Edge Function

**Solución**: Asegúrate de que el frontend envíe el token JWT en el header `Authorization`:
```javascript
const { data, error } = await supabase.functions.invoke('invite-user', {
  body: { ... },
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});
```

### Error: "Forbidden: Insufficient permissions"

**Solución**: Verificar que el usuario tenga rol `superadmin` o `admin` en la tabla `profiles`.

### Error: RLS bloqueando consultas

**Solución**: Verificar que las políticas RLS estén correctas y que el usuario esté autenticado.

### Error: "406 (Not Acceptable)" al cargar frontconfig antes de autenticación

**Síntoma**: El error aparece cuando se intenta cargar la configuración visual (theme) desde `frontconfig` antes de que el usuario inicie sesión.

**Solución**: Verificar que la política RLS "Public can view frontconfig" esté creada. Esta política permite lectura pública de las claves 'theme' y 'site' para que el look and feel esté disponible antes de autenticación.

Si el error persiste, ejecutar:
```sql
DROP POLICY IF EXISTS "Public can view frontconfig" ON frontconfig;
CREATE POLICY "Public can view frontconfig" ON frontconfig
    FOR SELECT 
    TO anon, authenticated
    USING (key IN ('theme', 'site'));
```

### Error: Edge Function no se despliega

**Solución**: 
1. Verificar que Supabase CLI esté actualizado
2. Verificar que estés autenticado: `supabase login`
3. Verificar que el proyecto esté vinculado: `supabase link`

### Error: `pg_cron` no disponible / job no aparece

**Síntoma**: No ves la extensión `pg_cron` o el job `purge_media_ttl_30d` en `cron.job`.

**Solución**:
- Verifica que tu proyecto soporte `pg_cron` (Database > Extensions). Si no está disponible en tu plan/región, deberás programar limpieza con un job externo (por ejemplo, Edge Function + Supabase Scheduler o cron del proveedor) que ejecute una purga equivalente usando `storage.delete(...)`.
- Reejecuta el SQL completo; el script incluye `CREATE EXTENSION IF NOT EXISTS pg_cron` y reprograma idempotentemente el job.

---

## 📚 Referencias

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Edge Functions](https://supabase.com/docs/guides/functions)
- [Documentación de RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Documentación de Auth Admin](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)

---

## 🎯 Resumen Final

**Todo lo necesario para que Supabase funcione completamente** está incluido en:

1. ✅ **`sql definitivo.sql`**: Base de datos completa
2. ✅ **`supabase/functions/invite-user/index.ts`**: Edge Function de invitaciones
3. ✅ **Este documento**: Guía completa de implementación

Una vez completados todos los pasos, SestIA estará **completamente funcional** en Supabase.

---

**Última actualización**: Noviembre 2025
**Versión**: 1.0.0

