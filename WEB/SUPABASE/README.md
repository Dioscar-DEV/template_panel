# SestIA - Configuración de Supabase

Este directorio contiene toda la configuración necesaria para desplegar SestIA en Supabase.

## 📁 Estructura del Directorio

```
SUPABASE/
├── README.md                    # Este archivo (índice y guía rápida)
├── SETUP_COMPLETO.md            # Documentación completa del setup
├── sql definitivo.sql            # Script SQL completo con toda la configuración
├── supabase/
│   └── functions/
│       └── invite-user/
│           └── index.ts        # Edge Function para envío de invitaciones
└── Credenciales.txt             # (Opcional) Credenciales del proyecto
```

## 🚀 Inicio Rápido

### Paso 1: Preparar Usuario Administrador

Antes de ejecutar el SQL, crea el usuario administrador:

1. Ve a **Supabase Dashboard** > **Authentication** > **Users**
2. Haz clic en **Add user**
3. Crea usuario:
   - Email: `admin@smartautomatai.com`
   - Password: `12345678`
   - Confirm Password: `12345678`

### Paso 2: Ejecutar SQL

1. Abre **SQL Editor** en el Dashboard de Supabase
2. Copia y pega el contenido de `sql definitivo.sql`
3. Ejecuta el script completo
4. Verifica que no haya errores
5. Verifica que las nuevas tablas del agente IA (N8N) estén creadas en el esquema `instancias`

### Paso 3: Configurar Variables de Entorno

1. Ve a **Settings** > **Edge Functions**
2. Configura `SITE_URL`: URL completa de tu sitio (ej: `https://tudominio.com`)

### Paso 4: Desplegar Edge Function

```bash
# Opción 1: Usando Supabase CLI
supabase functions deploy invite-user

# Opción 2: Usando MCP Sestia
# Desplegar desde el panel de MCP
```

## 📚 Documentación

- **[SETUP_COMPLETO.md](./SETUP_COMPLETO.md)**: Guía detallada completa con:
  - Estructura completa de base de datos
  - Funciones RPC explicadas
  - Edge Functions documentadas
  - Proceso de instalación paso a paso
  - Troubleshooting
  - Verificación post-instalación

- **[sql definitivo.sql](./sql%20definitivo.sql)**: Script SQL completo que incluye:
  - Tablas y esquemas
  - Funciones RPC
  - Políticas RLS
  - Triggers
  - Índices
  - Datos iniciales
  - Esquema del agente IA (N8N): `agent_config`, `agent_vars`, `blacklist`, `input_channels`, `agent_contact_list`, `agent_surveys`, `agent_task_list`, `agent_task_assign`, vista `v_tasks_summary`, y la RPC `instancias.complete_or_report_agent_task`
   - Esquema del agente IA (N8N): `agent_config` (incluye `eleven_labs`, `context_length`, `owner_list`), `agent_vars`, `agent_core_list` (núcleos con `core_memories` y `core_description`), `blacklist`, `input_channels`, `agent_contact_list`, `agent_surveys`, `agent_task_list`, `agent_task_assign`, vista `v_tasks_summary`, y la RPC `instancias.complete_or_report_agent_task`
  - Esquema de métricas `kpidata`: tablas `iainterna`, `multimedia`, `tools` con RLS habilitado y grants para `service_role`

## ⚠️ Requisitos Previos

- ✅ Proyecto Supabase creado
- ✅ Usuario administrador creado en Authentication
- ✅ Supabase CLI instalado (para desplegar Edge Functions)
- ✅ Variables de entorno configuradas

## 🔍 Verificación Rápida

Después de la instalación, verifica:

- [ ] Todas las tablas están creadas
- [ ] Edge Function `invite-user` está desplegada y activa
- [ ] Puedes iniciar sesión como admin
- [ ] Puedes crear invitaciones desde el módulo de usuarios
- [ ] Extensión `moddatetime` instalada (ver en Database > Extensions)
- [ ] Tablas del agente IA creadas en `instancias` y accesibles con `service_role`
 - [ ] Tabla `agent_core_list` creada con default de `core_memories`
 - [ ] Columna `eleven_labs` presente en `agent_config`
 - [ ] Columna `context_length` presente en `agent_config`
 - [ ] Columna `owner_list` presente en `agent_config`
- [ ] Esquema `kpidata` con tablas `iainterna`, `multimedia`, `tools` creado y accesible con `service_role`
- [ ] Storage configurado: buckets `media-incoming`, `media-generated`, `media-special` (privados), `media-published`, `public-assets` (públicos)
- [ ] Políticas de Storage activas: lectura pública en buckets públicos; lectura privada con `agent.view`; gestión con `agent.manage`
- [ ] Job pg_cron `purge_media_ttl_30d` creado (TTL 30 días para `media-incoming` y `media-generated`)

## 🗂️ Storage (Buckets + Signed URLs)

- **Buckets**:
  - Privados: `media-incoming` (ingesta), `media-generated` (salidas IA), `media-special` (campañas/datasets/compliance)
  - Públicos: `media-published` (publicaciones duraderas), `public-assets` (activos estáticos)
- **Acceso**:
  - Público: lectura anónima en `media-published` y `public-assets`
  - Privado: lectura con `agent.view`; gestión con `agent.manage`
  - Backend/N8N usa `service_role` y puede generar **Signed URLs** temporales para análisis externo (GPT/Gemini)
- **TTL**: Limpieza automática diaria de objetos >30 días en `media-incoming` y `media-generated` (job `purge_media_ttl_30d` con `pg_cron`).

Ver detalles y pasos de verificación en `SETUP_COMPLETO.md`.

### Estructura de Paths (Convenciones)

Las "carpetas" en Supabase Storage son claves de objeto separadas por `/`. No existen directorios reales; se crean dinámicamente cuando subes un archivo con ese prefijo. Para organización y consistencia usamos las siguientes convenciones:

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
  <content_domain>/<...> (flexible según necesidades de publicación)
```

Tokens dinámicos:
- `<YYYY>/<MM>/<DD>`: Fecha de ingesta o generación (UTC recomendado)
- `<contact_user_id>`: Identificador interno del contacto
- `<task_id>`: ID de la tarea (UUID)
- `<uuid>`: ID único del archivo (uuid v4)
- `<model_or_tool>`: Nombre estandarizado del modelo/herramienta generadora

Placeholders opcionales: Si quieres que aparezcan los prefijos en el dashboard antes de subir contenido, puedes insertar archivos vacíos `.keep` bajo cada prefijo (ej: `media-incoming/telegram/.keep`). No es obligatorio para funcionamiento.

No recomendamos pre-crear estructuras con fechas o IDs (son altamente dinámicas). Solo los prefijos estáticos (`telegram`, `whatsapp`, `webchat`, `image`, `audio`, etc.) pueden opcionalmente llevar `.keep`.

Para ejemplo de creación de placeholders consulta la sección extendida en `SETUP_COMPLETO.md`.

## 🆘 Problemas Comunes

**Error: "Usuario admin no encontrado"**
→ Crea el usuario en Authentication > Users antes de ejecutar el SQL

**Error: "Missing Authorization header"**
→ Verifica que el frontend envíe el token JWT en las requests a Edge Functions

**Error: "Forbidden: Insufficient permissions"**
→ Verifica que el usuario tenga rol `superadmin` o `admin` en la tabla `profiles`

**Error: "moddatetime does not exist"**
→ Verifica que la extensión `moddatetime` está instalada (el SQL la crea con `CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;`). Si tu proyecto no expone esta extensión, sustituye los triggers que usan `extensions.moddatetime(updated_at)` por el trigger `update_updated_at_column()` incluido.

Para más soluciones, consulta **[SETUP_COMPLETO.md](./SETUP_COMPLETO.md#troubleshooting)**.

## 📞 Soporte

Para más información, consulta la documentación completa en **[SETUP_COMPLETO.md](./SETUP_COMPLETO.md)**.

---

**Última actualización**: Noviembre 2025  
**Versión**: 1.0.0

