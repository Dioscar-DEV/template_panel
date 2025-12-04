# SestIA - Sistema Modular de Gestión

## 🎯 Descripción

SestIA es un sistema modular ultra-flexible construido con HTML, CSS y JavaScript puro, diseñado para ser completamente configurable desde Supabase. El sistema permite cambiar colores, logos, textos y toda la configuración visual directamente desde la base de datos, sin necesidad de modificar código.

## ✨ Características Principales

### 🎨 **Configuración Visual Dinámica**
- **Temas personalizables**: Cambia colores, logos, textos y banners desde Supabase
- **Configuración en tiempo real**: Los cambios se aplican inmediatamente sin reiniciar
- **Fallback inteligente**: Si Supabase no está disponible, usa configuración por defecto
- **API de actualización**: Funciones JavaScript para modificar temas programáticamente

### 🏗️ **Arquitectura Modular**
- **Módulos independientes**: Cada funcionalidad es un módulo separado
- **Carga dinámica**: Los módulos se cargan solo cuando se necesitan
- **Sistema de permisos**: Control granular de acceso por usuario y rol
- **Manifest configurable**: Define qué módulos están disponibles

### 🔐 **Sistema de Autenticación Robusto**
- **Integración con Supabase Auth**: Autenticación segura y escalable
- **Roles y permisos**: Sistema flexible de autorización
- **Invitaciones**: Envío de invitaciones por email
- **Recuperación de contraseñas**: Flujo completo de reset

### 📊 **Módulos Core Incluidos**
- **Home**: Dashboard principal con tarjetas de módulos
- **Índice**: Sistema de gestión de contenido con etiquetas y colores
- **Usuarios**: Gestión completa de usuarios, roles y permisos
- **Invitaciones**: Sistema de invitaciones por email

## 🚀 Instalación Rápida

### 1. Configurar Supabase

1. Crea un nuevo proyecto en [Supabase](https://supabase.com)
2. Ejecuta el SQL del archivo `supa/sql definitivo.sql` en el SQL Editor
3. Copia la URL y anon key de tu proyecto

### 2. Configurar el Frontend

1. Abre `config.js` y reemplaza las credenciales:
```javascript
window.__SUPABASE_CONFIG__ = {
  url: "https://tu-proyecto.supabase.co",
  anonKey: "tu-anon-key-aqui"
};
```

2. Abre `index.html` en tu navegador

### 3. Personalizar el Tema

Puedes personalizar el tema de dos formas:

#### Opción A: Desde Supabase (Recomendado)
```sql
UPDATE frontconfig 
SET value = '{
  "brandName": "Mi Empresa",
  "brandShort": "ME",
  "colors": {
    "brand": "#ff6b6b",
    "accent": "#ee5a24"
  }
}' 
WHERE key = 'theme';
```

#### Opción B: Desde JavaScript
```javascript
await window.updateTheme({
  brandName: "Mi Empresa",
  brandShort: "ME",
  colors: {
    brand: "#ff6b6b",
    accent: "#ee5a24"
  }
});
```

## 📁 Estructura del Proyecto

```
SestIA/
├── assets/                 # Recursos estáticos
│   ├── fonts/             # Fuentes personalizadas
│   ├── logo.svg           # Logo por defecto
│   └── banner.svg         # Banner por defecto
├── modules/               # Módulos del sistema
│   ├── home/              # Dashboard principal
│   ├── indice/            # Gestión de contenido
│   ├── users/             # Gestión de usuarios
│   ├── invite/            # Sistema de invitaciones
│   └── manifest.json      # Configuración de módulos
├── supa/
│   └── sql definitivo.sql # Script SQL completo
├── config.js              # Configuración de Supabase
├── theme.js               # Sistema de temas dinámico
├── core.js                # Núcleo del sistema
├── index.html             # Página principal
└── README.md              # Esta documentación
```

## 🎨 Sistema de Temas

### Configuración Disponible

El sistema de temas permite personalizar:

```javascript
{
  "brandName": "Nombre de la empresa",
  "brandShort": "Siglas",
  "logoUrl": "assets/logo.svg",
  "bannerUrl": "assets/banner.svg", 
  "bannerText": "Texto del banner",
  "footer": {
    "text": "© 2025 Mi Empresa",
    "links": [
      {"label": "Términos", "href": "javascript:openTermsModal()"},
      {"label": "Privacidad", "href": "javascript:openPrivacyModal()"}
    ]
  },
  "colors": {
    "bg": "#ffffff",           // Fondo principal
    "panel": "#ffffff",        // Fondo de paneles
    "panel2": "#f8fafc",       // Fondo secundario
    "text": "#0f172a",         // Texto principal
    "muted": "#64748b",        // Texto secundario
    "brand": "#3b82f6",        // Color principal
    "accent": "#1e40af",       // Color de acento
    "danger": "#dc2626",       // Color de peligro
    "success": "#10b981",      // Color de éxito
    "warning": "#f59e0b",      // Color de advertencia
    "info": "#0ea5e9",         // Color de información
    "brandLight": "#60a5fa",   // Color principal claro
    "border": "#e2e8f0"        // Color de bordes
  }
}
```

### API de Temas

```javascript
// Recargar tema desde Supabase
await window.reloadTheme();

// Actualizar tema en Supabase
await window.updateTheme({
  brandName: "Nuevo Nombre",
  colors: { brand: "#ff0000" }
});

// Acceder al tema actual
console.log(window.__THEME__);
```

## 🔧 Desarrollo de Módulos

### Estructura de un Módulo

Cada módulo debe seguir esta estructura:

```
modules/mi-modulo/
├── init.js          # Lógica del módulo
├── view.html        # HTML del módulo
└── styles.css       # Estilos específicos (opcional)
```

### Ejemplo de Módulo

```javascript
// modules/mi-modulo/init.js
(function(){
  async function init(){
    // Lógica de inicialización
    console.log('Módulo inicializado');
  }
  
  window.MiModuloModule = { init };
})();
```

### Registro en Manifest

```json
{
  "key": "mi-modulo",
  "moduleName": "MiModuloModule", 
  "script": "modules/mi-modulo/init.js",
  "view": "modules/mi-modulo/view.html",
  "label": "Mi Módulo",
  "roles": ["admin"],
  "perms": ["mi-modulo.view"],
  "public": false,
  "nav": { "group": "dropdown", "order": 30, "show": true }
}
```

## 🔐 Sistema de Permisos

### Roles Predefinidos

- **user**: Usuario básico (solo lectura)
- **admin**: Administrador (gestión completa)
- **superadmin**: Super administrador (acceso total)

### Permisos Disponibles

- `home.view`: Ver dashboard principal
- `users.view`: Ver usuarios
- `users.manage`: Gestionar usuarios
- `indice.view`: Ver contenido del índice
- `indice.manage`: Gestionar contenido del índice
- `invitations.view`: Ver invitaciones
- `invitations.manage`: Gestionar invitaciones

### Verificación de Permisos

```javascript
// Verificar rol
if (window.App.can(['admin', 'superadmin'])) {
  // Usuario es admin o superadmin
}

// Verificar permiso específico
if (window.App.hasPerm('users.manage')) {
  // Usuario puede gestionar usuarios
}
```

## 🗄️ Base de Datos

### Tablas Principales

- **frontconfig**: Configuración visual del sitio
- **profiles**: Perfiles de usuarios
- **roles**: Roles del sistema
- **permissions**: Permisos disponibles
- **role_permissions**: Asignación de permisos a roles
- **user_permissions**: Permisos específicos por usuario
- **invitations**: Invitaciones pendientes
- **instancias.INDICE**: Contenido del módulo índice
- **instancias.INDICE_LOG**: Log de cambios del índice

### Funciones RPC

- `get_profile_by_user_id()`: Obtener perfil de usuario
- `get_permissions_by_user_id()`: Obtener permisos de usuario
- `get_my_permissions()`: Obtener permisos del usuario actual
- `indice_list()`: Listar contenido del índice
- `indice_upsert()`: Crear/actualizar contenido del índice
- `indice_delete()`: Eliminar contenido del índice
- `cancel_invitation_complete()`: Cancelar invitación completa

## 🚀 Despliegue

### Opción 1: Hosting Estático
1. Sube todos los archivos a tu hosting estático (Netlify, Vercel, etc.)
2. Configura las credenciales de Supabase
3. ¡Listo!

### Opción 2: Servidor Web
1. Coloca los archivos en tu servidor web
2. Configura las credenciales de Supabase
3. Asegúrate de que el servidor sirva archivos estáticos

### Opción 3: Desarrollo Local
1. Usa un servidor local como Live Server
2. Configura las credenciales de Supabase
3. Abre `index.html` en tu navegador

## 🔧 Personalización Avanzada

### Agregar Nuevos Módulos

1. Crea la carpeta del módulo en `modules/`
2. Implementa `init.js` y `view.html`
3. Registra el módulo en `manifest.json`
4. Agrega los permisos necesarios en Supabase

### Personalizar Estilos

1. Modifica `styles.css` para estilos globales
2. Usa `ui.css` para componentes de interfaz
3. Crea `styles.css` en cada módulo para estilos específicos

### Integrar APIs Externas

1. Agrega las funciones en `core.js`
2. Usa las credenciales desde `config.js`
3. Implementa la lógica en los módulos correspondientes

## 📚 Ejemplos de Uso

### Cambiar Colores de la Empresa

```sql
UPDATE frontconfig 
SET value = jsonb_set(
  value, 
  '{colors,brand}', 
  '"#ff6b6b"'
) 
WHERE key = 'theme';
```

### Agregar Nuevo Permiso

```sql
INSERT INTO permissions (perm_key, name, description, module) 
VALUES ('mi-modulo.view', 'Ver Mi Módulo', 'Acceso de lectura al módulo', 'mi-modulo');

INSERT INTO role_permissions (role_key, perm_key) 
VALUES ('admin', 'mi-modulo.view');
```

### Crear Usuario Administrador

```sql
-- El usuario se creará automáticamente cuando se registre
-- Solo necesitas asignar el rol
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@miempresa.com';
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes preguntas o necesitas ayuda:

1. Revisa la documentación
2. Busca en los issues existentes
3. Crea un nuevo issue con detalles del problema

## 🎉 ¡Gracias!

SestIA está diseñado para ser simple, flexible y poderoso. ¡Esperamos que te sea útil para tus proyectos!

---

**Desarrollado con ❤️ para la comunidad**
