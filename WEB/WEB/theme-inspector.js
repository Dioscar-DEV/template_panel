(function(){
  function mountInspector(){
    if(document.getElementById('theme-inspector-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'theme-inspector-btn';
    btn.textContent = '🎨 Theme';
    Object.assign(btn.style, { position:'fixed', right:'12px', bottom:'72px', zIndex:'99997', padding:'8px 10px', borderRadius:'999px', border:'1px solid var(--border)', background:'linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%)', boxShadow:'var(--shadow-md)', cursor:'pointer', fontWeight:'700' });
    btn.addEventListener('click', openPanel);
    document.body.appendChild(btn);
  }

  function openPanel(){
    const t = window.__THEME__ || {}; const c = (t.colors||{});
    const rows = [
      ['brand','brandLight','accent','text','muted','bg','panel','panel2','border','success','warning','info','danger']
    ].flat().map(k=>{
      const v = c[k] || '';
      return `<div style="display:flex;align-items:center;gap:8px;"><label style="width:120px">${k}</label><input data-key="${k}" type="color" value="${/^#/.test(v)?v:'#000000'}" style="width:36px;height:28px;border:none;border-radius:6px"/><input data-key="${k}" type="text" value="${v}" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--panel-2);color:var(--text)"/></div>`;
    }).join('');
    const html = `
      <div style="min-width:380px;">
        <h3 style="margin-top:0">Theme Inspector</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">${rows}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
          <button class="ui-btn" data-action="reset">Reset</button>
          <button class="ui-btn primary" data-action="apply">Aplicar</button>
        </div>
      </div>`;
    const m = window.UI ? UI.modal(html) : (function(){ const d=document.createElement('div'); d.innerHTML='UI.modal no disponible'; document.body.appendChild(d); return { close:()=>document.body.removeChild(d) }; })();
    const panel = document.body.lastElementChild.querySelector('.ui-panel');
    panel.addEventListener('input', (e)=>{
      const key = e.target.getAttribute('data-key');
      if(!key) return;
      const inputs = panel.querySelectorAll(`input[data-key="${key}"]`);
      inputs.forEach(inp => { if(inp!==e.target){ inp.value = e.target.value; } });
    });
    panel.querySelector('[data-action="apply"]').addEventListener('click', ()=>{
      const entries = [...panel.querySelectorAll('input[type="text"][data-key]')].map(inp => [inp.getAttribute('data-key'), inp.value]);
      const next = Object.fromEntries(entries);
      const root = document.documentElement;
      const trySet = (name,val)=>{ if(!val) return; if(/^#/.test(val)) root.style.setProperty(`--${name}`, val); };
      trySet('brand', next.brand); trySet('brand-light', next.brandLight); trySet('accent', next.accent); trySet('text', next.text); trySet('muted', next.muted); trySet('bg', next.bg); trySet('panel', next.panel); trySet('panel-2', next.panel2); trySet('border', next.border); trySet('success', next.success); trySet('warning', next.warning); trySet('info', next.info); trySet('danger', next.danger);
      if(window.UI) UI.toast('Tema aplicado (runtime)', 'info');
    });
    panel.querySelector('[data-action="reset"]').addEventListener('click', ()=>{ location.reload(); });
  }

  window.ThemeInspector = { mount: mountInspector };
})();


