# Guía de Migración - De Hospital a SestIA

## 🎯 Objetivo

Esta guía te ayudará a migrar tu proyecto hospitalario existente al sistema modular SestIA, manteniendo toda la funcionalidad core mientras eliminas las dependencias específicas del hospital.

## 📋 Checklist de Migración

### ✅ Paso 1: Preparar el Entorno

1. **Crear nuevo proyecto Supabase**
   - Ve a [Supabase](https://supabase.com)
   - Crea un nuevo proyecto llamado "SestIA"
   - Copia la URL y anon key

2. **Configurar credenciales**
   ```javascript
   // En config.js
   window.__SUPABASE_CONFIG__ = {
     url: "https://tu-nuevo-proyecto.supabase.co",
     anonKey: "tu-nueva-anon-key"
   };
   ```

### ✅ Paso 2: Ejecutar SQL de Migración

1. **Ejecutar SQL definitivo**
   - Abre el SQL Editor en Supabase
   - Copia y pega todo el contenido de `supa/sql definitivo.sql`
   - Ejecuta el script completo

2. **Verificar creación de tablas**
   ```sql
   -- Verificar que se crearon todas las tablas
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

### ✅ Paso 3: Migrar Datos Existentes (Opcional)

Si tienes datos importantes en tu proyecto hospitalario:

#### Migrar Usuarios
```sql
-- Si tienes usuarios existentes, puedes migrarlos
INSERT INTO profiles (user_id, email, name, role)
SELECT 
  id as user_id,
  email,
  COALESCE(raw_user_meta_data->>'name', email) as name,
  COALESCE(raw_user_meta_data->>'role', 'user') as role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles);
```

#### Migrar Configuración de Tema
```sql
-- Personalizar el tema con la identidad de tu organización
UPDATE frontconfig 
SET value = '{
  "brandName": "Tu Empresa",
  "brandShort": "TE",
  "logoUrl": "assets/logo.svg",
  "bannerUrl": "assets/banner.svg",
  "bannerText": "Sistema de Gestión Empresarial",
  "footer": {
    "text": "© 2025 Tu Empresa. Todos los derechos reservados.",
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
}' 
WHERE key = 'theme';
```

### ✅ Paso 4: Limpiar Archivos Específicos del Hospital

#### Archivos a Eliminar
```bash
# Módulos específicos del hospital (ya no necesarios)
rm -rf modules/pacientes/
rm -rf modules/citas/
rm -rf modules/doctores/
rm -rf modules/emergencias/

# Archivos de configuración específicos
rm -f config.hospital.js
rm -f theme.hospital.js
```

#### Archivos a Mantener
```
✅ modules/home/          # Dashboard principal
✅ modules/indice/        # Gestión de contenido
✅ modules/users/         # Gestión de usuarios
✅ modules/invite/        # Sistema de invitaciones
✅ core.js               # Núcleo del sistema
✅ theme.js              # Sistema de temas
✅ config.js             # Configuración de Supabase
✅ index.html            # Página principal
✅ styles.css            # Estilos globales
✅ ui.css                # Componentes de interfaz
```

### ✅ Paso 5: Personalizar la Aplicación

#### Actualizar Información de la Empresa

1. **Cambiar logos y banners**
   - Reemplaza `assets/logo.svg` con tu logo
   - Reemplaza `assets/banner.svg` con tu banner
   - O actualiza las URLs en la configuración de Supabase

2. **Personalizar textos**
   ```sql
   -- Actualizar textos del sitio
   UPDATE frontconfig 
   SET value = jsonb_set(value, '{bannerText}', '"Tu Mensaje Personalizado"')
   WHERE key = 'theme';
   ```

3. **Cambiar colores corporativos**
   ```sql
   -- Actualizar colores
   UPDATE frontconfig 
   SET value = jsonb_set(value, '{colors,brand}', '"#tu-color-corporativo"')
   WHERE key = 'theme';
   ```

### ✅ Paso 6: Configurar Usuarios Iniciales

#### Crear Super Administrador
```sql
-- Después de que el usuario se registre, actualizar su rol
UPDATE profiles 
SET role = 'superadmin' 
WHERE email = 'admin@tuempresa.com';
```

#### Configurar Permisos Personalizados
```sql
-- Agregar permisos específicos para tu organización
INSERT INTO permissions (perm_key, name, description, module) 
VALUES 
  ('mi-modulo.view', 'Ver Mi Módulo', 'Acceso de lectura al módulo personalizado', 'mi-modulo'),
  ('mi-modulo.manage', 'Gestionar Mi Módulo', 'Acceso completo al módulo personalizado', 'mi-modulo');

-- Asignar permisos a roles
INSERT INTO role_permissions (role_key, perm_key) 
VALUES 
  ('admin', 'mi-modulo.view'),
  ('admin', 'mi-modulo.manage'),
  ('superadmin', 'mi-modulo.view'),
  ('superadmin', 'mi-modulo.manage');
```

### ✅ Paso 7: Desarrollar Módulos Personalizados

#### Estructura de un Módulo Personalizado
```
modules/mi-modulo/
├── init.js          # Lógica del módulo
├── view.html        # Interfaz del módulo
└── styles.css       # Estilos específicos (opcional)
```

#### Ejemplo de Módulo Básico
```javascript
// modules/mi-modulo/init.js
(function(){
  async function init(){
    console.log('Mi módulo personalizado inicializado');
    
    // Tu lógica aquí
    const container = document.getElementById('mi-modulo-container');
    if (container) {
      container.innerHTML = '<h2>Mi Módulo Personalizado</h2>';
    }
  }
  
  window.MiModuloModule = { init };
})();
```

#### Registrar el Módulo
```json
// En modules/manifest.json
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

### ✅ Paso 8: Pruebas y Validación

#### Verificar Funcionalidad Core
1. **Autenticación**
   - [ ] Login funciona correctamente
   - [ ] Logout funciona correctamente
   - [ ] Recuperación de contraseña funciona

2. **Gestión de Usuarios**
   - [ ] Crear usuarios funciona
   - [ ] Asignar roles funciona
   - [ ] Gestionar permisos funciona
   - [ ] Enviar invitaciones funciona

3. **Módulo de Índice**
   - [ ] Crear contenido funciona
   - [ ] Editar contenido funciona
   - [ ] Eliminar contenido funciona
   - [ ] Búsqueda funciona

4. **Sistema de Temas**
   - [ ] Carga desde Supabase funciona
   - [ ] Cambios se aplican en tiempo real
   - [ ] Fallback funciona si Supabase no está disponible

#### Verificar Seguridad
1. **Políticas RLS**
   - [ ] Los usuarios solo ven sus propios datos
   - [ ] Los permisos se respetan correctamente
   - [ ] No hay acceso no autorizado

2. **Funciones RPC**
   - [ ] Todas las funciones devuelven datos correctos
   - [ ] Los errores se manejan apropiadamente
   - [ ] La auditoría funciona

### ✅ Paso 9: Despliegue

#### Opción 1: Hosting Estático
1. Sube todos los archivos a Netlify, Vercel, etc.
2. Configura las variables de entorno si es necesario
3. Verifica que la aplicación funcione correctamente

#### Opción 2: Servidor Web
1. Coloca los archivos en tu servidor web
2. Configura el servidor para servir archivos estáticos
3. Verifica que la aplicación funcione correctamente

### ✅ Paso 10: Monitoreo y Mantenimiento

#### Configurar Monitoreo
1. **Logs de Supabase**
   - Revisar logs de autenticación
   - Monitorear errores de funciones RPC
   - Verificar uso de permisos

2. **Métricas de la Aplicación**
   - Tiempo de carga de módulos
   - Uso de memoria
   - Errores de JavaScript

#### Mantenimiento Regular
1. **Limpieza de datos**
   - Eliminar invitaciones expiradas
   - Limpiar logs antiguos
   - Optimizar base de datos

2. **Actualizaciones**
   - Mantener Supabase actualizado
   - Revisar actualizaciones de seguridad
   - Actualizar dependencias si es necesario

## 🔧 Solución de Problemas Comunes

### Error: "Supabase no está disponible"
**Solución:** Verifica que las credenciales en `config.js` sean correctas.

### Error: "No tienes permisos para acceder"
**Solución:** Verifica que el usuario tenga el rol correcto y los permisos necesarios.

### Error: "Módulo no encontrado"
**Solución:** Verifica que el módulo esté registrado en `manifest.json` y que el archivo exista.

### Error: "Tema no se carga"
**Solución:** Verifica que la tabla `frontconfig` tenga datos y que la configuración sea válida JSON.

## 📞 Soporte Post-Migración

### Recursos Disponibles
1. **Documentación**: `README.md` y `sql definitivo.sql.md`
2. **Ejemplos**: `config.example.js`
3. **Comunidad**: Issues en GitHub

### Contacto
Si necesitas ayuda con la migración:
1. Revisa esta guía paso a paso
2. Consulta la documentación
3. Crea un issue con detalles específicos

## 🎉 ¡Migración Completada!

Una vez que hayas completado todos los pasos, tendrás:

✅ Un sistema modular completamente funcional
✅ Configuración visual personalizable desde Supabase
✅ Sistema de autenticación robusto
✅ Gestión de usuarios y permisos
✅ Base sólida para desarrollar módulos personalizados
✅ Sistema escalable y mantenible

**¡Bienvenido a SestIA! 🚀**
