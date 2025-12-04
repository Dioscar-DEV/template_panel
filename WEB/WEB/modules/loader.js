(function(){
  const state = {
    manifest: null,
    scriptsLoaded: new Set(),
    routesRegistered: false
  };

  function fetchJSON(url){
    return fetch(url, { cache: 'no-store' }).then(r => {
      if(!r.ok){ throw new Error('No se pudo cargar ' + url); }
      return r.json();
    });
  }

  function loadScriptOnce(src){
    return new Promise((resolve, reject) => {
      if(state.scriptsLoaded.has(src)){ return resolve(); }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => { state.scriptsLoaded.add(src); resolve(); };
      s.onerror = () => reject(new Error('Error cargando script: ' + src));
      document.head.appendChild(s);
    });
  }

  function byOrder(a, b){
    const ao = (a.nav?.order ?? 0);
    const bo = (b.nav?.order ?? 0);
    return ao - bo;
  }

  function canShowModule(mod){
    if(mod.public){ return true; }
    if(!window.App?.session){ return false; }
    const roleOk = Array.isArray(mod.roles) && mod.roles.length > 0 ? window.App.can(mod.roles) : true;
    const permOk = mod.perms ? window.App.hasPerm(mod.perms) : true;
    return roleOk && permOk;
  }

  function isSafePath(path){
    try{
      const s = String(path || '');
      if(!s) return false;
      // Solo rutas relativas dentro de /modules/
      if(!s.startsWith('modules/')) return false;
      // Bloquear '/../' y esquemas
      if(s.includes('..') || s.startsWith('http:') || s.startsWith('https:') || s.startsWith('//')) return false;
      // Extensiones permitidas
      const ok = s.endsWith('.js') || s.endsWith('.html') || s.endsWith('.css') || s.endsWith('.json');
      return ok;
    }catch(_){ return false; }
  }

  async function loadManifest(){
    if(state.manifest){ return state.manifest; }
    const data = await fetchJSON('modules/manifest.json');
    if(!Array.isArray(data.modules)){ data.modules = []; }
    // Validar rutas de cada módulo (whitelist)
    data.modules = data.modules.filter(m => {
      const ok = isSafePath(m?.script) && isSafePath(m?.view);
      if(!ok){ console.warn('[Loader] Módulo descartado por rutas no seguras:', m?.key || m); }
      return ok;
    });
    state.manifest = data;
    return state.manifest;
  }

  function withVersion(path){
    try{
      const v = (window.__APP_VERSION__ || '').toString().trim();
      if(!v) return path;
      const hasQuery = String(path).includes('?');
      return path + (hasQuery ? '&' : '?') + 'v=' + encodeURIComponent(v);
    }catch(_){ return path; }
  }

  async function loadModuleScripts(modules){
    const promises = modules.map(m => loadScriptOnce(withVersion(m.script)));
    await Promise.all(promises);
  }

  function registerRoutes(modules){
    if(!window.Router){ return; }
    modules.forEach(m => {
      const initFn = () => {
        const api = window[m.moduleName];
        return api && typeof api.init === 'function' ? api.init() : undefined;
      };
      const def = {
        viewPath: withVersion(m.view),
        init: initFn,
        roles: m.roles,
        perms: m.perms,
        public: !!m.public
      };
      
      
      window.Router.registerRoute(m.key, def);
    });
    state.routesRegistered = true;
  }

  function clearInjectedNav(container){
    [...container.querySelectorAll('[data-dynamic="1"]')].forEach(el => el.remove());
  }

  function buildDropdownItems(modules){
    const dropdown = document.querySelector('.nav-dropdown');
    if(!dropdown){ return; }
    clearInjectedNav(dropdown);
    modules
      .filter(m => m.nav?.show && (m.nav.group === 'dropdown'))
      .sort(byOrder)
      .forEach(m => {
        if(!canShowModule(m)){ return; }
        const a = document.createElement('a');
        a.href = `#/${m.key}`;
        a.className = 'nav-dropdown-item';
        a.setAttribute('role','menuitem');
        a.setAttribute('data-section', m.key);
        a.setAttribute('data-dynamic','1');
        a.innerHTML = `
          <div class="nav-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="6" height="6"/>
              <rect x="15" y="3" width="6" height="6"/>
              <rect x="3" y="15" width="6" height="6"/>
              <rect x="15" y="15" width="6" height="6"/>
            </svg>
          </div>
          <span class="nav-text">${m.label || m.key}</span>
        `;
        dropdown.appendChild(a);
      });
  }

  async function init(){
    const { modules } = await loadManifest();
    await loadModuleScripts(modules);
    registerRoutes(modules);
  }

  async function renderNavigation(){
    const manifest = state.manifest || await loadManifest();
    buildDropdownItems(manifest.modules || []);
    // refrescar estado activo
    if(typeof window.dispatchEvent === 'function'){
      window.dispatchEvent(new Event('hashchange'));
    }
    // Aplicar tokens del tema en DOM por si el menú contiene bindings
    if(window.App && typeof window.App.applyTokensToDOM === 'function'){
      window.App.applyTokensToDOM();
    }
  }

  window.Loader = { init, renderNavigation };
})();


