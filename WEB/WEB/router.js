(function(){
  const routes = new Map();

  async function loadModule(fullRoute){
    // Extraer la ruta base para encontrar el módulo
    const route = parseRoute(fullRoute);
    const mod = routes.get(route) || routes.get('home') || routes.get('livechat');
    
    
    if(!mod){ return; }

    const outlet = document.getElementById('app-outlet');
    if(!outlet){ return; }

    // Skip guards para rutas públicas
    if(!mod.public){
      // Guard por rol
      if(Array.isArray(mod.roles) && mod.roles.length > 0){
        if(!window.App?.can(mod.roles)){
          outlet.innerHTML = `<section class="card"><h3>Acceso restringido</h3><p>No tienes permisos para ver esta sección.</p></section>`;
          return;
        }
      }

      // Guard por permisos
      if(mod.perms){
        if(!window.App?.hasPerm(mod.perms)){
          outlet.innerHTML = `<section class="card"><h3>Acceso restringido</h3><p>Te falta el permiso requerido para esta sección.</p></section>`;
          return;
        }
      }
    }

    // Cargar vista
    const viewResp = await fetch(mod.viewPath, { cache: 'no-store' });
    const html = await viewResp.text();
    outlet.innerHTML = html;

    // Ejecutar inicializador del módulo
    if(typeof mod.init === 'function'){
      // Para módulos públicos como invite, pasar la ruta completa con parámetros
      if(mod.public && route === 'invite'){
        await mod.init(fullRoute);
      } else {
        await mod.init();
      }
    }
  }

  function getRouteFromHash(){
    let hash = (location.hash || '').replace(/^#\/?/, '');
    
    // 🔧 NUEVO: Para rutas de invitación, mantener los parámetros
    // Ejemplo: "invite#access_token=..." → mantener todo para el módulo invite
    if(hash.startsWith('invite')){
      return hash; // Devolver la ruta completa con parámetros
    }
    
    // Para otras rutas, limpiar tokens de Supabase que vienen después de un segundo #
    if(hash.includes('#')){
      const parts = hash.split('#');
      hash = parts[0]; // Tomar solo la primera parte antes del segundo #
    }
    
    return hash || 'home';
  }

  function parseRoute(fullRoute){
    // Ignorar querystring (e.g., livechat?contact=123) y extraer solo la ruta base
    const noQuery = (fullRoute || '').split('?')[0];
    // Para rutas como "invite/TOKEN123", extraer solo "invite"
    const parts = noQuery.split('/');
    return parts[0] || 'home';
  }

  async function onRouteChange(){
    const fullRoute = getRouteFromHash();
    const route = parseRoute(fullRoute);
    const header = document.querySelector('.app-header');
    const mod = routes.get(route);
    
    console.log('🔄 Cambio de ruta:', { fullRoute, route, mod: !!mod, isPublic: mod?.public });
    
    // Verificar si es una ruta pública (como invitaciones)
    if(mod?.public){
      console.log('📖 Cargando módulo público:', route);
      document.getElementById('auth-section')?.classList.add('hidden');
      document.getElementById('shell')?.classList.remove('hidden');
      
      // Para rutas públicas, ocultar header por defecto
      header?.classList.add('hidden');
      
      // 🔧 Para invite, pasar el hash completo (incluye tokens después del segundo #)
      if(route === 'invite'){
        console.log('🔑 Cargando módulo invite con hash completo:', fullRoute);
        await loadModule(fullRoute);
      } else {
        await loadModule(fullRoute);
      }
      return;
    }
    
    // Guard de auth para rutas privadas
    if(!window.App?.session){
      // Mostrar solo login - ocultar header y shell
      document.getElementById('auth-section')?.classList.remove('hidden');
      document.getElementById('shell')?.classList.add('hidden');
      header?.classList.add('hidden'); // ✨ Ocultar header en login
      return;
    }
    
    // Asegurar perfil cargado y roles disponibles
    if(!window.App.profile){
      await window.App.loadProfile();
    }
    // Asegurar permisos cargados
    if(!Array.isArray(window.App.permissions) || window.App.permissions.length === 0){
      await window.App.loadPermissions();
    }

    // Mostrar aplicación completa - ocultar login
    document.getElementById('auth-section')?.classList.add('hidden');
    document.getElementById('shell')?.classList.remove('hidden');
    header?.classList.remove('hidden'); // ✨ Mostrar header en aplicación
    await loadModule(fullRoute);
  }

  function registerRoute(key, def){
    routes.set(key, def);
  }

  window.Router = { registerRoute, onRouteChange };

  window.addEventListener('hashchange', onRouteChange);
})();


