(function(){
  async function init(){
    const nameEl = document.getElementById('home-user-name');
    const email = window.App?.session?.user?.email || 'Supervisor';
    nameEl.textContent = email.split('@')[0];

    // Render dinámico de tarjetas desde el manifest
    try{
      const grid = document.getElementById('home-modules-grid');
      if(!grid){ return; }

      const resp = await fetch('modules/manifest.json', { cache: 'no-store' });
      const data = await resp.json();
      const modules = Array.isArray(data.modules) ? data.modules : [];

      // Reglas de visibilidad acorde a roles/permisos del App
      function canShow(mod){
        if(mod.public){ return true; }
        if(!window.App?.session){ return false; }
        const roleOk = Array.isArray(mod.roles) && mod.roles.length > 0 ? window.App.can(mod.roles) : true;
        const permOk = mod.perms ? window.App.hasPerm(mod.perms) : true;
        return roleOk && permOk;
      }

      // Íconos básicos por clave, con fallback
      function iconFor(key){
        const map = {
          livechat: '💬',
          indice: '📚',
          dashboard: '📊',
          users: '👥',
          template: '🧩',
          reportes: '📈',
          invite: '✉️'
        };
        return map[key] || '🗂️';
      }

      // Limpiar contenido previo
      grid.innerHTML = '';

      // Seleccionar módulos visibles en home (excluir home en sí)
      const cards = modules
        .filter(m => m.key !== 'home')
        .filter(m => m.nav?.show)
        .filter(canShow)
        .sort((a,b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0))
        .map(m => {
          const a = document.createElement('a');
          a.className = 'module-card';
          a.href = `#/${m.key}`;
          a.innerHTML = `
            <div class="module-icon">${iconFor(m.key)}</div>
            <div class="module-info">
              <h3>${m.label || m.key}</h3>
              <p>${m.description || ''}</p>
            </div>
          `;
          return a;
        });

      // Insertar en DOM
      cards.forEach(el => grid.appendChild(el));
    }catch(err){
      console.warn('No se pudo renderizar módulos en Home:', err);
    }
  }
  window.HomeModule = { init };
})();


