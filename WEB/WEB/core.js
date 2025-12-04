(function(){
  // Núcleo compartido: auth, tema, utilidades
  const cfg = window.__SUPABASE_CONFIG__;
  const supabase = window.supabase.createClient(cfg.url, cfg.anonKey);

  const App = {
    supabase,
    session: null,
    profile: null,
    permissions: [],
    config: {
      supabaseUrl: cfg.url,
      supabaseAnonKey: cfg.anonKey
    },
    theme: (function(){
      const t = window.__THEME__ || {};
      const colors = t.colors || {};
      return {
        brandName: t.brandName || 'SestIA',
        brandShort: t.brandShort || 'SestIA',
        logoText: t.brandName || 'SestIA',
        primary: colors.brand || '#3b82f6',
        primaryLight: colors.brandLight || colors.brand || '#60a5fa',
        accent: colors.accent || '#1e40af',
        text: colors.text || '#0f172a',
        muted: colors.muted || '#64748b',
        success: colors.success || '#10b981',
        warning: colors.warning || '#f59e0b',
        info: colors.info || '#0ea5e9',
        border: colors.border || '#e2e8f0',
        bannerText: t.bannerText || 'Sistema Modular de Gestión',
        logoUrl: t.logoUrl || 'assets/logo.svg',
        bannerUrl: t.bannerUrl || 'assets/banner.svg',
        footer: t.footer || { text: '© 2025 SestIA', links: [] }
      };
    })(),
    tokens: {
      // Tokens semánticos compartidos para módulos
      get brandName(){ return window.App.theme.brandName; },
      get brandShort(){ return window.App.theme.brandShort; },
      get logoUrl(){ return window.App.theme.logoUrl; },
      get primary(){ return window.App.theme.primary; },
      get primaryLight(){ return window.App.theme.primaryLight; },
      get accent(){ return window.App.theme.accent; },
      get text(){ return window.App.theme.text; },
      get muted(){ return window.App.theme.muted; },
      get border(){ return window.App.theme.border; },
      get success(){ return window.App.theme.success; },
      get warning(){ return window.App.theme.warning; },
      get info(){ return window.App.theme.info; },
      get bannerText(){ return window.App.theme.bannerText; },
      get footer(){ return window.App.theme.footer; }
    },
    applyTokensToDOM(){
      // Rellena atributos data-* comunes para evitar duplicación en módulos
      const brandNameTargets = document.querySelectorAll('[data-brand-name]');
      brandNameTargets.forEach(el => el.textContent = App.theme.brandName);
      const brandShortTargets = document.querySelectorAll('[data-brand-short]');
      brandShortTargets.forEach(el => el.textContent = App.theme.brandShort);
      const logoTargets = document.querySelectorAll('[data-logo-src]');
      logoTargets.forEach(el => { el.src = App.theme.logoUrl; el.onerror = () => (el.style.display='none'); });
    },
    async signIn(email, password){
      return supabase.auth.signInWithPassword({ email, password });
    },
    async signOut(){
      await supabase.auth.signOut();
      App.session = null;
      App.profile = null;
      App.permissions = [];
    },
    async restoreSession(){
      const { data: { session } } = await supabase.auth.getSession();
      App.session = session;
      
      // Configurar listener para detectar PASSWORD_RECOVERY e INVITACIONES
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        // 🔧 NUEVO: Extraer correctamente parámetros del hash (incluso con doble #)
        const fullHash = window.location.hash || '';
        
        // Dividir por # y parsear la parte con parámetros
        const hashParts = fullHash.split('#').filter(p => p);
        let hashParams = new URLSearchParams();
        
        // Buscar la parte que contiene access_token
        for(const part of hashParts){
          if(part.includes('access_token') || part.includes('type=')){
            hashParams = new URLSearchParams(part);
            break;
          }
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const hasRecoveryParams = urlParams.has('access_token') || hashParams.has('access_token');
        const type = hashParams.get('type') || urlParams.get('type');
        
        console.log('🔍 Parámetros detectados:', {
          event,
          type,
          hasRecoveryParams,
          hashParts,
          hashParamsEntries: Object.fromEntries(hashParams)
        });
        
        // Verificar si el usuario necesita cambiar contraseña
        const needsPasswordChange = session?.user?.app_metadata?.must_change_password || 
                                   session?.user?.user_metadata?.must_change_password ||
                                   session?.user?.app_metadata?.temp_password;
        
        // 🔧 Para invitaciones: dejar que el módulo invite maneje la sesión
        // Supabase v2 redirige directamente a /#/invite después de verificar el token
        // El módulo invite verificará la sesión con getSession()
        
        if (event === 'PASSWORD_RECOVERY' || 
            (event === 'INITIAL_SESSION' && hasRecoveryParams && type === 'recovery') ||
            (event === 'SIGNED_IN' && needsPasswordChange)) {
          console.log('Detectado flujo de recuperación de contraseña, redirigiendo...');
          setTimeout(() => {
            window.location.hash = '#/reset-password';
          }, 100);
        }
      });
      
      return session;
    },
    async loadProfile(){
      if(!App.session?.user?.id){ App.profile = null; return null; }
      try {
        // Intentar perfil vía RPC por user_id (sistema híbrido)
        const customRpc = await supabase.rpc('get_profile_by_user_id', {
          p_user_id: App.session.user.id
        });
        if(!customRpc.error && customRpc.data?.success){
          App.profile = {
            user_id: customRpc.data.user_id,
            email: customRpc.data.email,
            role: customRpc.data.role,
            name: customRpc.data.name
          };
          return App.profile;
        }
      } catch(err){
        // continuar al fallback
      }
      // Fallback a lectura directa de profiles (Supabase Auth)
      try{
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, email, role')
          .eq('user_id', App.session.user.id)
          .single();
        if(error){ throw error; }
        App.profile = data || null;
        return App.profile;
      }catch(err){
        console.warn('No se pudo cargar el perfil:', err?.message || err);
        App.profile = null;
        return null;
      }
    },
    async loadPermissions(){
      if(!App.session?.user?.id){ App.permissions = []; return []; }
      let perms = [];
      try{
        // Preferir RPC por user_id
        const customRpc = await supabase.rpc('get_permissions_by_user_id', {
          p_user_id: App.session.user.id
        });
        if(!customRpc.error && Array.isArray(customRpc.data)){
          perms = customRpc.data;
        } else {
          // Fallback a get_my_permissions (auth.uid())
          const rpc = await supabase.rpc('get_my_permissions');
          if(!rpc.error && Array.isArray(rpc.data)){
            perms = rpc.data;
          } else {
            // Último recurso: leer user_permissions directos
            const { data, error } = await supabase
              .from('user_permissions')
              .select('perm_key')
              .eq('user_id', App.session.user.id);
            if(error){ throw error; }
            perms = (data || []).map(r => r.perm_key);
          }
        }
      }catch(err){ console.warn('No se pudieron cargar permisos:', err?.message || err); perms = []; }
      App.permissions = perms;
      return perms;
    },
    getRole(){
      return App.profile?.role || null;
    },
    can(requiredRoles){
      if(!requiredRoles || requiredRoles.length === 0){ return true; }
      const role = App.getRole();
      return role ? requiredRoles.includes(role) : false;
    },
    hasPerm(required){
      if(!required){ return true; }
      const requiredList = Array.isArray(required) ? required : [required];
      if(requiredList.length === 0){ return true; }
      if(!Array.isArray(App.permissions) || App.permissions.length === 0){ return false; }
      return requiredList.every(k => App.permissions.includes(k));
    }
  };

  window.App = App;
})();


