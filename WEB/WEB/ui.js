(function(){
  function createToast(message, type){
    const containerId = 'ui-toast-container';
    let c = document.getElementById(containerId);
    if(!c){
      c = document.createElement('div');
      c.id = containerId;
      c.style.position = 'fixed';
      c.style.right = '16px';
      c.style.bottom = '16px';
      c.style.display = 'flex';
      c.style.flexDirection = 'column';
      c.style.gap = '8px';
      c.style.zIndex = '99999';
      document.body.appendChild(c);
    }
    const toast = document.createElement('div');
    toast.className = 'ui-alert ' + (type || 'info');
    toast.textContent = message;
    toast.style.minWidth = '220px';
    toast.style.boxShadow = 'var(--shadow-lg)';
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => c.removeChild(toast));
    c.appendChild(toast);
    setTimeout(() => { if(toast.parentNode === c){ c.removeChild(toast); } }, 4000);
  }

  function modal(html){
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(0,0,0,0.5)';
    backdrop.style.backdropFilter = 'blur(4px)';
    backdrop.style.display = 'flex';
    backdrop.style.alignItems = 'center';
    backdrop.style.justifyContent = 'center';
    backdrop.style.zIndex = '99998';
    const panel = document.createElement('div');
    panel.className = 'ui-panel raised';
    panel.style.maxWidth = '90vw';
    panel.style.maxHeight = '90vh';
    panel.style.overflow = 'auto';
    panel.innerHTML = html || '';
    backdrop.appendChild(panel);
    backdrop.addEventListener('click', (e)=>{ if(e.target === backdrop){ document.body.removeChild(backdrop); } });
    document.body.appendChild(backdrop);
    return { close: ()=>{ try{ document.body.removeChild(backdrop); }catch(_){ } } };
  }

  function confirmDialog(message, { okText='Aceptar', cancelText='Cancelar' } = {}){
    return new Promise(resolve => {
      const html = `
        <div style="min-width:300px;">
          <h3 style="margin-top:0">Confirmación</h3>
          <p style="color:var(--text)">${message}</p>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
            <button class="ui-btn">${cancelText}</button>
            <button class="ui-btn primary">${okText}</button>
          </div>
        </div>`;
      const m = modal(html);
      const buttons = m && m.close ? m : null;
      const panel = document.querySelector('#ui-toast-container ~ div .ui-panel') || document.body.lastElementChild.querySelector('.ui-panel');
      const [btnCancel, btnOk] = panel.querySelectorAll('button');
      btnCancel.addEventListener('click', ()=>{ m.close(); resolve(false); });
      btnOk.addEventListener('click', ()=>{ m.close(); resolve(true); });
    });
  }

  window.UI = { toast: createToast, modal, confirm: confirmDialog };
})();


