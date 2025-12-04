(function(){
  let initialized = false;

  // Estado del módulo (en memoria mientras está montado)
  const state = {
    items: [],
    filtered: [],
    selectedId: null,
    loading: false,
    error: ''
  };

  function qs(id){ return document.getElementById(id); }

  function setLoading(isLoading){
    state.loading = isLoading;
    const loadingEl = qs('tpl-loading');
    const contentEl = qs('tpl-content');
    if(loadingEl){ loadingEl.classList.toggle('hidden', !isLoading); }
    if(contentEl){ contentEl.classList.toggle('hidden', isLoading); }
  }

  function setError(message){
    state.error = message || '';
    const errorWrap = qs('tpl-error');
    const errorText = qs('tpl-error-text');
    if(errorWrap && errorText){
      errorText.textContent = message || '';
      errorWrap.classList.toggle('hidden', !message);
    }
  }

  function renderList(){
    const listEl = qs('tpl-list');
    const emptyEl = qs('tpl-empty');
    if(!listEl || !emptyEl){ return; }

    listEl.innerHTML = '';
    const rows = state.filtered.length ? state.filtered : state.items;
    emptyEl.classList.toggle('hidden', rows.length > 0);

    rows.forEach(item => {
      const el = document.createElement('div');
      el.className = 'tpl-item' + (item.id === state.selectedId ? ' active' : '');
      el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
      el.innerHTML = `
        <div class="tpl-item-title">${item.title}</div>
        <div class="tpl-item-sub">${item.subtitle}</div>
      `;
      el.addEventListener('click', () => selectItem(item.id));
      el.addEventListener('keypress', (e) => { if(e.key==='Enter'){ selectItem(item.id); } });
      listEl.appendChild(el);
    });
  }

  function renderDetail(){
    const detailWrap = qs('tpl-detail');
    const detailEmpty = qs('tpl-detail-empty');
    if(!detailWrap || !detailEmpty){ return; }

    const it = state.items.find(x => x.id === state.selectedId) || null;
    if(!it){
      detailWrap.classList.add('hidden');
      detailEmpty.classList.remove('hidden');
      return;
    }
    detailEmpty.classList.add('hidden');
    detailWrap.classList.remove('hidden');

    const title = qs('tpl-detail-title');
    const desc = qs('tpl-detail-desc');
    const meta = qs('tpl-detail-meta');
    if(title) title.textContent = it.title;
    if(desc) desc.textContent = it.description;
    if(meta) meta.textContent = `ID ${it.id} • Actualizado ${new Date(it.updatedAt).toLocaleString('es-CO')}`;
  }

  function selectItem(id){
    state.selectedId = id;
    renderList();
    renderDetail();
  }

  function filterList(){
    const q = (qs('tpl-search')?.value || '').toLowerCase().trim();
    if(!q){ state.filtered = []; renderList(); return; }
    state.filtered = state.items.filter(it => {
      const hay = [it.title, it.subtitle, it.description].join(' ').toLowerCase();
      return hay.includes(q);
    });
    renderList();
  }

  async function loadData(){
    setLoading(true);
    setError('');
    try {
      // Ejemplo: podría venir de Supabase. Aquí datos mock con retardo.
      await new Promise(r => setTimeout(r, 250));
      const now = Date.now();
      state.items = Array.from({ length: 8 }).map((_,i) => ({
        id: i+1,
        title: `Elemento ${i+1}`,
        subtitle: i % 2 === 0 ? 'Tipo A' : 'Tipo B',
        description: 'Descripción de ejemplo para el elemento plantilla.',
        updatedAt: now - i * 3600_000
      }));
      state.selectedId = state.items[0]?.id || null;
      renderList();
      renderDetail();
    } catch(err){
      setError(err?.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }

  function bindEvents(){
    qs('tpl-search')?.addEventListener('input', () => { setTimeout(filterList, 200); });
    qs('tpl-refresh')?.addEventListener('click', loadData);
    qs('tpl-new')?.addEventListener('click', () => openModal('tpl-modal'));
    qs('tpl-modal-cancel')?.addEventListener('click', (e) => { e.preventDefault(); closeModal('tpl-modal'); });
    qs('tpl-modal-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      try{
        const canManage = window.App?.hasPerm && window.App.hasPerm('template.manage');
        if(!canManage){ alert('No tienes permisos para gestionar este módulo.'); return; }
      }catch(_){/* noop */}
      const title = (qs('tpl-input-title')?.value || '').trim();
      const desc = (qs('tpl-input-desc')?.value || '').trim();
      if(!title){ qs('tpl-input-title')?.focus(); return; }
      const id = Math.max(0, ...state.items.map(x => x.id)) + 1;
      state.items.unshift({ id, title, subtitle: 'Nuevo', description: desc, updatedAt: Date.now() });
      closeModal('tpl-modal');
      renderList();
    });
  }

  function openModal(id){
    const m = qs(id);
    if(!m) return;
    try{
      const canManage = window.App?.hasPerm && window.App.hasPerm('template.manage');
      if(!canManage){ return; }
    }catch(_){/* noop */}
    m.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id){
    const m = qs(id);
    if(!m) return;
    m.classList.remove('active');
    document.body.style.overflow = '';
    const form = qs('tpl-modal-form');
    if(form){ form.reset(); }
  }

  async function init(){
    // Idempotente: por si el router reinyecta la vista
    if(initialized){ return; }
    initialized = true;

    // Cargar estilos del módulo si existen
    try{
      const href = 'modules/template/styles.css';
      if(!document.querySelector('link[data-tpl-style="1"]')){
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        l.setAttribute('data-tpl-style','1');
        document.head.appendChild(l);
      }
    }catch(_){/* noop */}

    bindEvents();
    // Guard de UI: ocultar acciones de gestión si falta permiso
    try{
      const canManage = window.App?.hasPerm && window.App.hasPerm('template.manage');
      const newBtn = document.getElementById('tpl-new');
      if(newBtn && !canManage){ newBtn.style.display = 'none'; }
    }catch(_){/* noop */}
    // Aplicar tokens a bindings data-* (marca, logo)
    try{ if(window.App && typeof window.App.applyTokensToDOM === 'function'){ window.App.applyTokensToDOM(); } }catch(_){/* noop */}
    await loadData();
  }

  window.TemplateModule = { init };
})();


