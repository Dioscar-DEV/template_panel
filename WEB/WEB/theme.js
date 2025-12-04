// Configuración de tema: colores, logos, banners. 
// Ahora lee desde Supabase para máxima flexibilidad
(function(){
  // Configuración por defecto (fallback)
  const DEFAULT_THEME = {
    brandName: 'SestIA',
    brandShort: 'SestIA',
    logoUrl: 'assets/logo.svg',
    bannerUrl: 'assets/banner.svg',
    bannerText: 'Sistema Modular de Gestión',
    footer: {
      text: '© 2025 SestIA. Todos los derechos reservados.',
      links: [
        { label: 'Términos', href: 'javascript:openTermsModal()' },
        { label: 'Privacidad', href: 'javascript:openPrivacyModal()' }
      ]
    },
    colors: {
      bg: '#ffffff',
      panel: '#ffffff',
      panel2: '#f8fafc',
      text: '#0f172a',
      muted: '#64748b',
      brand: '#3b82f6',           // Azul principal
      accent: '#1e40af',          // Azul oscuro para acentos
      danger: '#dc2626',          // Rojo peligro
      success: '#10b981',         // Verde éxito
      warning: '#f59e0b',         // Naranja advertencia
      info: '#0ea5e9',            // Azul info
      brandLight: '#60a5fa',      // Azul claro
      border: '#e2e8f0'           // Borde gris suave
    }
  };

  // Función para aplicar tema a las variables CSS
  function applyThemeToCSS(theme) {
    const r = document.documentElement;
    
    function hexToRgb(hex){
      if(!hex) return null;
      const h = hex.replace('#','');
      const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `${r}, ${g}, ${b}`;
    }

    // Aplicar variables CSS
    r.style.setProperty('--bg', theme.colors.bg);
    r.style.setProperty('--panel', theme.colors.panel);
    r.style.setProperty('--panel-2', theme.colors.panel2);
    r.style.setProperty('--text', theme.colors.text);
    r.style.setProperty('--muted', theme.colors.muted);
    r.style.setProperty('--brand', theme.colors.brand);
    r.style.setProperty('--brand-light', theme.colors.brandLight || theme.colors.brand);
    r.style.setProperty('--brand-rgb', hexToRgb(theme.colors.brand || '#3b82f6'));
    r.style.setProperty('--brand-light-rgb', hexToRgb(theme.colors.brandLight || theme.colors.brand || '#60a5fa'));
    r.style.setProperty('--accent', theme.colors.accent);
    r.style.setProperty('--danger', theme.colors.danger);
    r.style.setProperty('--danger-light', theme.colors.dangerLight || '#b91c1c');
    r.style.setProperty('--danger-rgb', hexToRgb(theme.colors.danger || '#dc2626'));
    r.style.setProperty('--danger-light-rgb', hexToRgb(theme.colors.dangerLight || '#b91c1c'));
    r.style.setProperty('--success', theme.colors.success || '#10b981');
    r.style.setProperty('--success-light', theme.colors.successLight || '#34d399');
    r.style.setProperty('--success-rgb', hexToRgb(theme.colors.success || '#10b981'));
    r.style.setProperty('--success-light-rgb', hexToRgb(theme.colors.successLight || '#34d399'));
    r.style.setProperty('--warning', theme.colors.warning || '#f59e0b');
    r.style.setProperty('--warning-light', theme.colors.warningLight || '#d97706');
    r.style.setProperty('--warning-rgb', hexToRgb(theme.colors.warning || '#f59e0b'));
    r.style.setProperty('--warning-light-rgb', hexToRgb(theme.colors.warningLight || '#d97706'));
    r.style.setProperty('--info', theme.colors.info || '#0ea5e9');
    r.style.setProperty('--info-light', theme.colors.infoLight || '#38bdf8');
    r.style.setProperty('--info-rgb', hexToRgb(theme.colors.info || '#0ea5e9'));
    r.style.setProperty('--info-light-rgb', hexToRgb(theme.colors.infoLight || '#38bdf8'));
    r.style.setProperty('--border', theme.colors.border);
    r.style.setProperty('--banner-image', `url('${theme.bannerUrl}')`);
    
    // Fallbacks opcionales
    if(theme.bannerFallback){
      r.style.setProperty('--banner-fallback', theme.bannerFallback);
    }
  }

  // Función para cargar tema desde Supabase
  async function loadThemeFromSupabase() {
    try {
      // Verificar que la instancia global de Supabase esté disponible
      if (!window.App?.supabase) {
        console.warn('Supabase no está disponible, usando tema por defecto');
        return DEFAULT_THEME;
      }

      const supabase = window.App.supabase;

      // Cargar configuración del tema
      const { data: themeData, error: themeError } = await supabase
        .from('frontconfig')
        .select('value')
        .eq('key', 'theme')
        .single();

      if (themeError) {
        console.warn('Error cargando tema desde Supabase:', themeError);
        return DEFAULT_THEME;
      }

      if (!themeData || !themeData.value) {
        console.warn('No se encontró configuración de tema en Supabase');
        return DEFAULT_THEME;
      }

      // Combinar tema por defecto con configuración de Supabase
      const theme = {
        ...DEFAULT_THEME,
        ...themeData.value,
        colors: {
          ...DEFAULT_THEME.colors,
          ...(themeData.value.colors || {})
        },
        footer: {
          ...DEFAULT_THEME.footer,
          ...(themeData.value.footer || {})
        }
      };

      console.log('✅ Tema cargado desde Supabase:', theme);
      return theme;

    } catch (error) {
      console.error('Error cargando tema desde Supabase:', error);
      return DEFAULT_THEME;
    }
  }

  // Función para actualizar elementos del DOM con el tema
  function updateDOMWithTheme(theme) {
    // Actualizar elementos con data-* attributes
    const brandNameTargets = document.querySelectorAll('[data-brand-name]');
    brandNameTargets.forEach(el => el.textContent = theme.brandName);
    
    const brandShortTargets = document.querySelectorAll('[data-brand-short]');
    brandShortTargets.forEach(el => el.textContent = theme.brandShort);
    
    const logoTargets = document.querySelectorAll('[data-logo-src]');
    logoTargets.forEach(el => { 
      el.src = theme.logoUrl; 
      el.onerror = () => (el.style.display='none'); 
    });

    const bannerTextTargets = document.querySelectorAll('[data-banner-text]');
    bannerTextTargets.forEach(el => el.textContent = theme.bannerText);

    // Actualizar título de la página
    if (theme.brandName) {
      document.title = `${theme.brandName} - Sistema Modular`;
    }

    // Actualizar meta description si existe
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = theme.bannerText || 'Sistema Modular de Gestión';
  }

  // Función principal para inicializar el tema
  async function initializeTheme() {
    try {
      // Esperar a que Supabase esté disponible
      if (!window.App?.supabase) {
        console.log('⏳ Esperando a que Supabase esté disponible...');
        
        // Esperar hasta 5 segundos para que Supabase esté listo
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos con intervalos de 100ms
        
        while (!window.App?.supabase && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!window.App?.supabase) {
          throw new Error('Supabase no está disponible después de 5 segundos');
        }
      }
      
      // Cargar tema desde Supabase
      const theme = await loadThemeFromSupabase();
      
      // Aplicar tema a las variables CSS
      applyThemeToCSS(theme);
      
      // Actualizar elementos del DOM
      updateDOMWithTheme(theme);
      
      // Exponer tema para uso global
      window.__THEME__ = theme;
      
      // Disparar evento personalizado para notificar que el tema está listo
      window.dispatchEvent(new CustomEvent('themeLoaded', { 
        detail: { theme } 
      }));
      
      console.log('🎨 Tema inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando tema:', error);
      
      // Usar tema por defecto en caso de error
      applyThemeToCSS(DEFAULT_THEME);
      updateDOMWithTheme(DEFAULT_THEME);
      window.__THEME__ = DEFAULT_THEME;
    }
  }

  // Función para recargar tema dinámicamente
  window.reloadTheme = async function() {
    console.log('🔄 Recargando tema...');
    await initializeTheme();
  };

  // Función para actualizar tema en Supabase
  window.updateTheme = async function(newTheme) {
    try {
      if (!window.App?.supabase) {
        throw new Error('Supabase no está disponible');
      }

      const supabase = window.App.supabase;

      const { error } = await supabase
        .from('frontconfig')
        .upsert({
          key: 'theme',
          value: newTheme,
          description: 'Configuración visual del tema del sitio'
        });

      if (error) throw error;

      console.log('✅ Tema actualizado en Supabase');
      
      // Recargar tema
      await reloadTheme();
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error actualizando tema:', error);
      return { success: false, error: error.message };
    }
  };

  // Inicializar tema cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTheme);
  } else {
    initializeTheme();
  }

  // También exponer la configuración por defecto para compatibilidad
  window.__DEFAULT_THEME__ = DEFAULT_THEME;

})();