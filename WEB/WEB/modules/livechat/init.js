(function(){
  async function init(){
    const { supabase } = window.App;
    // Reutilizamos lógica del livechat anterior pero scoped al módulo

    const searchInput = document.getElementById('search');
    const agentFilter = document.getElementById('agent-filter');
    const conversationList = document.getElementById('conversation-list');
    const messagesEl = document.getElementById('messages');
    const conversationTitle = document.getElementById('conversation-title');
    const conversationSubtitle = document.getElementById('conversation-subtitle');
    const newMessagesIndicator = document.getElementById('new-messages-indicator');
    
    // Nuevos elementos UI modernos
    const conversationsCount = document.getElementById('conversations-count');
    const clearSearchBtn = document.getElementById('clear-search');
    const emptyState = document.getElementById('empty-state');
    const welcomeState = document.getElementById('welcome-state');
    const refreshChatBtn = document.getElementById('refresh-chat');
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom');

    let currentContactId = null;
    let messagesSubscription = null;
    let conversations = [];
    
    // Variables para paginación y scroll inteligente
    let currentMessages = []; // Array que mantiene todos los mensajes cargados
    let isLoadingOlderMessages = false;
    let hasMoreOlderMessages = true;
    let lastScrollHeight = 0;
    const MAX_MESSAGES_IN_DOM = 15; // Límite para evitar crecimiento infinito
    const SCROLL_THRESHOLD = 100; // Píxeles desde el top para activar carga
    const WINDOW_STEP = Math.max(1, Math.floor(MAX_MESSAGES_IN_DOM / 2));
    
    // Variables para ventana deslizante inteligente
    let currentViewStart = 0; // Índice de inicio de la ventana visible
    let isViewingLatest = true; // Si el usuario está viendo los mensajes más recientes
    let newMessagesCount = 0; // Contador de mensajes nuevos no vistos
    let earliestConversationTimestamp = null; // Marca mínima en BD para este contacto
    let earliestConversationIdMin = null; // ID mínimo asociado al earliest timestamp

    function formatDate(iso){ try{ return new Date(iso).toLocaleString(); }catch(_){ return iso; } }

    async function fetchEarliestCursor(contactId){
      // Obtiene el cursor más antiguo real (timestamp, id) existente en BD
      try{
        const { data, error } = await supabase
          .from('messages')
          .select('timestamp,id')
          .eq('contact_id', contactId)
          .order('timestamp', { ascending: true })
          .order('id', { ascending: true })
          .limit(1);
        if(error) throw error;
        earliestConversationTimestamp = (data && data[0]?.timestamp) ? data[0].timestamp : null;
        earliestConversationIdMin = (data && data[0]?.id) ? data[0].id : null;
      }catch(err){ console.error('Error obteniendo earliest cursor:', err); }
    }

    function showNewMessagesIndicator(){
      if (newMessagesCount > 0) {
        const text = newMessagesCount === 1 ? 
          '📩 1 nuevo mensaje - Click para ver' : 
          `📩 ${newMessagesCount} nuevos mensajes - Click para ver`;
        newMessagesIndicator.textContent = text;
        newMessagesIndicator.classList.add('show');
      }
    }
    
    function hideNewMessagesIndicator(){
      newMessagesIndicator.classList.remove('show');
      newMessagesCount = 0;
    }
    
    function goToLatestMessages(){
      isViewingLatest = true;
      newMessagesCount = 0;
      hideNewMessagesIndicator();
      renderMessages(currentMessages); // Esto mostrará los mensajes más recientes
    }

    function safeName(c){
      const name = (c.contact_name || '').trim();
      if(name && name !== '-') return name;
      const nick = (c.contact_nickname || '').trim();
      if(nick) return nick;
      return c.contact_id || 'Conversación';
    }

    function renderConversations(list){
      while (conversationList.firstChild) conversationList.removeChild(conversationList.firstChild);

      if (conversationsCount) {
        conversationsCount.textContent = String(list.length);
        conversationsCount.style.display = list.length > 0 ? 'block' : 'none';
      }

      if (list.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
      } else {
        if (emptyState) emptyState.classList.add('hidden');
      }

      const frag = document.createDocumentFragment();
      list.forEach(c => {
        const li = document.createElement('li');
        const isActive = c.contact_id === currentContactId;
        li.className = 'conversation-item' + (isActive ? ' active' : '');
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `Conversación con ${safeName(c)}`);

        const titleEl = document.createElement('div');
        titleEl.className = 'conversation-title';
        titleEl.textContent = safeName(c);

        const metaEl = document.createElement('div');
        metaEl.className = 'conversation-meta';

        const idEl = document.createElement('span');
        idEl.textContent = `ID: ${c.user_id || '—'}`;

        const timeEl = document.createElement('span');
        const lastTime = c.last_message_time || c.updated_at;
        timeEl.textContent = `Último: ${lastTime ? formatDate(lastTime) : '—'}`;

        metaEl.appendChild(idEl);
        metaEl.appendChild(timeEl);

        li.appendChild(titleEl);
        li.appendChild(metaEl);

        li.addEventListener('click', () => selectConversation(c));
        li.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectConversation(c);
          }
        });

        frag.appendChild(li);
      });
      conversationList.appendChild(frag);
    }

    async function loadConversations(){
      const term = (searchInput.value || '').trim();
      const agentId = agentFilter.value || '';
      let data = [];
      try{
        if(term || agentId){
          const { data: rows, error } = await supabase.rpc('search_conversations', { q: term, page_limit: 50, page_offset: 0 });
          if(error) throw error;
          data = rows || [];
          if(agentId){ data = data.filter(c => (c.active_agent_id||'') === agentId); }
        } else {
          const { data: rows, error } = await supabase.rpc('conversations_enriched_list', { p_limit: 50 });
          if(error) throw error;
          data = rows || [];
        }
      }catch(err){ console.error(err); }
      conversations = data;
      renderConversations(conversations);
    }

    function getQueryParam(name){
      try{
        const hash = (location.hash || '').split('?')[1] || '';
        const params = new URLSearchParams(hash);
        return params.get(name);
      }catch(_){ return null; }
    }

    async function trySelectFromQuery(){
      const contact = getQueryParam('contact');
      if(!contact){ return; }
      // Buscar en el lote cargado por contact_id o por user_id
      let found = conversations.find(c => String(c.contact_id) === String(contact));
      if(!found){
        found = conversations.find(c => String(c.user_id || '') === String(contact));
      }
      if(found){
        await selectConversation(found);
        return;
      }
      // Si no estaba en el primer lote, intentar obtenerla directo (fallback 1: contact_id)
      try{
        let row = null;
        {
          const { data, error } = await supabase
            .from('conversations_enriched')
            .select('contact_id, updated_at, last_message_time, contact_name, contact_nickname, user_id, active_agent_id')
            .eq('contact_id', contact)
            .limit(1);
          if(!error && data && data[0]){ row = data[0]; }
        }
        // Fallback 2: buscar por user_id si no hubo match por contact_id
        if(!row){
          const { data, error } = await supabase
            .from('conversations_enriched')
            .select('contact_id, updated_at, last_message_time, contact_name, contact_nickname, user_id, active_agent_id')
            .eq('user_id', contact)
            .limit(1);
          if(!error && data && data[0]){ row = data[0]; }
        }
        if(row){
          conversations = [row, ...conversations];
          renderConversations(conversations);
          await selectConversation(row);
        }
      }catch(err){ console.error('Deep-link livechat error:', err); }
    }

    async function selectConversation(conv){
      currentContactId = conv.contact_id;
      const title = safeName(conv);
      conversationTitle.textContent = title;
      const lastTime = conv.last_message_time || conv.updated_at;
      conversationSubtitle.textContent = lastTime ? `Último mensaje: ${formatDate(lastTime)}` : 'Sin mensajes';
      
      // Ocultar estado de bienvenida
      if (welcomeState) {
        welcomeState.style.display = 'none';
      }
      
      renderConversations(conversations);
      await loadMessages(conv.contact_id);
      await subscribeToMessages(conv.contact_id);
    }

    function renderMessages(list, maintainScroll = false){
      const previousScrollHeight = messagesEl.scrollHeight;
      const previousScrollTop = messagesEl.scrollTop;
      
      // Limpiar contenedor
      messagesEl.innerHTML = '';
      
      // Añadir indicador de carga si estamos cargando mensajes más antiguos
      if (isLoadingOlderMessages && hasMoreOlderMessages) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-indicator';
        loadingEl.textContent = '⏳ Cargando mensajes más antiguos...';
        messagesEl.appendChild(loadingEl);
      }
      
      // Añadir indicador de principio de conversación si no hay más mensajes antiguos
      if (!hasMoreOlderMessages && currentMessages.length > 0) {
        const startEl = document.createElement('div');
        startEl.className = 'conversation-start-indicator';
        startEl.innerHTML = '🎉 <span>Has llegado al principio de esta conversación</span>';
        messagesEl.appendChild(startEl);
      }
      
      // Ventana deslizante inteligente
      let messagesToRender;
      let renderStart, renderEnd;
      
      if (list.length <= MAX_MESSAGES_IN_DOM) {
        // Si hay pocos mensajes, mostrar todos
        messagesToRender = list;
        currentViewStart = 0;
        isViewingLatest = true;
      } else if (isViewingLatest && !maintainScroll) {
        // Primera carga o mensaje nuevo: mostrar los más recientes
        renderStart = list.length - MAX_MESSAGES_IN_DOM;
        renderEnd = list.length;
        messagesToRender = list.slice(renderStart, renderEnd);
        currentViewStart = renderStart;
      } else if (maintainScroll) {
        // Cargando mensajes antiguos: expandir ventana hacia atrás manteniendo contexto
        // Mantener la posición relativa del usuario en la ventana
        renderStart = Math.max(0, currentViewStart);
        renderEnd = Math.min(list.length, renderStart + MAX_MESSAGES_IN_DOM);
        messagesToRender = list.slice(renderStart, renderEnd);
        currentViewStart = renderStart;
        
        // Si estamos al final de todos los mensajes, seguimos viendo los más recientes
        isViewingLatest = (renderEnd >= list.length);
      } else {
        // Navegación normal: mantener ventana centrada en posición actual
        renderStart = Math.max(0, Math.min(currentViewStart, list.length - MAX_MESSAGES_IN_DOM));
        renderEnd = Math.min(list.length, renderStart + MAX_MESSAGES_IN_DOM);
        messagesToRender = list.slice(renderStart, renderEnd);
        currentViewStart = renderStart;
        isViewingLatest = (renderEnd >= list.length);
      }
      
      messagesToRender.forEach(m => {
        const wrap = document.createElement('div');
        wrap.className = 'bubble ' + (m.sender === 'user' ? 'from-user' : 'from-diego');
        wrap.textContent = m.text;
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `${m.sender} • ${formatDate(m.timestamp)}`;
        messagesEl.appendChild(wrap);
        messagesEl.appendChild(meta);
      });
      
      // Manejar posición del scroll inteligentemente
      if (maintainScroll) {
        // Mantener posición relativa cuando se cargan mensajes antiguos
        const newScrollHeight = messagesEl.scrollHeight;
        messagesEl.scrollTop = previousScrollTop + (newScrollHeight - previousScrollHeight);
      } else {
        // Scroll al final solo para conversación nueva o mensaje nuevo
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    async function loadMessages(conversationId){
      // Resetear estado para nueva conversación
      currentMessages = [];
      isLoadingOlderMessages = false;
      hasMoreOlderMessages = true; // Comenzamos asumiendo que hay más
      currentViewStart = 0;
      isViewingLatest = true;
      newMessagesCount = 0;
      hideNewMessagesIndicator();
      
      // CAMBIO CLAVE: Técnica limit+1 para detectar si hay más
      const initialPageBase = Math.max(MAX_MESSAGES_IN_DOM * 2, 30); // Cargar el doble o mínimo 30
      const initialLoadLimit = initialPageBase + 1; // limit+1
      
      const { data, error } = await supabase
        .rpc('fetch_messages', { p_contact_id: conversationId, p_before_ts: null, p_before_id: null, p_limit: initialLoadLimit });
      if(error){ console.error(error); return; }
      
      let list = (data || []).sort((a,b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        if (ta !== tb) return ta - tb;
        return (a.id||0) - (b.id||0);
      });
      
      // Si llegaron más de base, hay más antiguos; recortamos para mostrar exactamente "base"
      hasMoreOlderMessages = list.length > initialPageBase;
      if (hasMoreOlderMessages) {
        // Quitar el más antiguo (primer elemento en ascendente) para mantener tamaño estable
        list = list.slice(1);
      }
      currentMessages = [...list];

      // Verificación robusta: comparar contra el earliest timestamp real en BD
      await fetchEarliestCursor(conversationId);
      if (earliestConversationTimestamp != null && earliestConversationIdMin != null && currentMessages[0]) {
        const oldestLoadedTs = currentMessages[0].timestamp;
        const oldestLoadedId = currentMessages[0].id;
        // Comparación de tupla: (earliestTs, earliestId) < (oldestTs, oldestId)
        const earliestLessThanOldest = (new Date(earliestConversationTimestamp) < new Date(oldestLoadedTs))
          || (new Date(earliestConversationTimestamp).getTime() === new Date(oldestLoadedTs).getTime() && (earliestConversationIdMin < oldestLoadedId));
        hasMoreOlderMessages = earliestLessThanOldest;
      }

      console.log(`📊 Cargados ${list.length}/${initialPageBase}. EarliestBD=${earliestConversationTimestamp || 'N/A'}#${earliestConversationIdMin ?? 'N/A'} | OldestLoaded=${currentMessages[0]?.timestamp || 'N/A'}#${currentMessages[0]?.id ?? 'N/A'} | HayMás=${hasMoreOlderMessages}`);
      
      renderMessages(currentMessages);
    }
    
    async function loadOlderMessages(conversationId){
      if (isLoadingOlderMessages || !hasMoreOlderMessages) return;
      
      isLoadingOlderMessages = true;
      
      // Usar el timestamp del mensaje más antiguo como referencia
      const oldestMessage = currentMessages[0];
      const beforeTimestamp = oldestMessage ? oldestMessage.timestamp : null;
      const beforeId = oldestMessage ? oldestMessage.id : null;
      
      try {
        // CAMBIO: Técnica limit+1 para páginas
        const pagingBase = Math.max(MAX_MESSAGES_IN_DOM, 20); // Mínimo 20 o el límite de DOM
        const pagingLimit = pagingBase + 1; // limit+1
        
        const { data, error } = await supabase
          .rpc('fetch_messages', { 
            p_contact_id: conversationId, 
            p_before_ts: beforeTimestamp,
            p_before_id: beforeId,
            p_limit: pagingLimit 
          });
          
        if(error) throw error;
        
        let newMessages = (data || []).sort((a,b) => {
          const ta = new Date(a.timestamp).getTime();
          const tb = new Date(b.timestamp).getTime();
          if (ta !== tb) return ta - tb;
          return (a.id||0) - (b.id||0);
        });
        
        if (newMessages.length === 0) {
          hasMoreOlderMessages = false;
          console.log('📭 Has llegado al principio de la conversación');
        } else {
          // ¿Hay más aún más antiguos?
          hasMoreOlderMessages = newMessages.length > pagingBase;
          if (hasMoreOlderMessages) {
            // Quitar el más antiguo (primer elemento) para mantener exactamente "pagingBase"
            newMessages = newMessages.slice(1);
          }
          // Añadir mensajes más antiguos al inicio del array
          currentMessages = [...newMessages, ...currentMessages];

          // Re-evaluar con earliest real en BD
          if (earliestConversationTimestamp != null && earliestConversationIdMin != null && currentMessages[0]) {
            const oldestLoadedNowTs = currentMessages[0].timestamp;
            const oldestLoadedNowId = currentMessages[0].id;
            const earliestLessThanOldestNow = (new Date(earliestConversationTimestamp) < new Date(oldestLoadedNowTs))
              || (new Date(earliestConversationTimestamp).getTime() === new Date(oldestLoadedNowTs).getTime() && (earliestConversationIdMin < oldestLoadedNowId));
            hasMoreOlderMessages = earliestLessThanOldestNow;
          }
          
          console.log(`📥 +${newMessages.length}/${pagingBase}. EarliestBD=${earliestConversationTimestamp || 'N/A'}#${earliestConversationIdMin ?? 'N/A'} | OldestLoaded=${currentMessages[0]?.timestamp || 'N/A'}#${currentMessages[0]?.id ?? 'N/A'} | Total=${currentMessages.length} | HayMás=${hasMoreOlderMessages}`);
        }
        
        renderMessages(currentMessages, true); // maintainScroll = true
        
      } catch(err) {
        console.error('❌ Error cargando mensajes más antiguos:', err);
      } finally {
        isLoadingOlderMessages = false;
      }
    }

    async function subscribeToMessages(conversationId){
      if(messagesSubscription){
        await App.supabase.removeChannel(messagesSubscription);
        messagesSubscription = null;
      }
      messagesSubscription = App.supabase
        .channel('room:messages:' + conversationId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${conversationId}` }, (payload) => {
          const m = payload.new;
          
          // Añadir mensaje nuevo al array
          currentMessages.push(m);
          
          // Solo mostrar el mensaje nuevo si el usuario está viendo los más recientes
          if (isViewingLatest) {
            const isNearBottom = messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 100;
            
            if (currentMessages.length <= MAX_MESSAGES_IN_DOM) {
              // Re-renderizar todo si hay pocos mensajes
              renderMessages(currentMessages, !isNearBottom);
            } else {
              // Para muchos mensajes, re-renderizar la ventana actual que incluye el nuevo mensaje
              renderMessages(currentMessages, !isNearBottom);
            }
          } else {
            // El usuario está viendo mensajes antiguos, no molestar su navegación
            // Solo actualizar el array en memoria, no cambiar la vista
            newMessagesCount++;
            showNewMessagesIndicator();
          }
        })
        .subscribe();
    }

    async function loadAgents(){
      const { data, error } = await supabase
        .from('agents')
        .select('id, display_name, is_active')
        .eq('is_active', true)
        .order('display_name', { ascending: true });
      if(error){ console.error(error); return; }
      agentFilter.innerHTML = '';
      const optAll = document.createElement('option');
      optAll.value = '';
      optAll.textContent = 'Todos los agentes';
      agentFilter.appendChild(optAll);
      (data || []).forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.display_name;
        agentFilter.appendChild(opt);
      });
    }

    // Event listeners principales
    agentFilter?.addEventListener('change', () => loadConversations());
    function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }
    const debouncedSearch = debounce(() => loadConversations(), 250);
    
    // Búsqueda con funcionalidades mejoradas
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      
      // Mostrar/ocultar botón de limpiar
      if (clearSearchBtn) {
        if (value.length > 0) {
          clearSearchBtn.classList.remove('hidden');
        } else {
          clearSearchBtn.classList.add('hidden');
        }
      }
      
      debouncedSearch();
    });
    
    // Botón limpiar búsqueda
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        loadConversations();
        searchInput.focus();
      });
    }
    
    // Función para scroll al final
    function scrollToBottom() {
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        // Actualizar estado para mostrar mensajes más recientes
        isViewingLatest = true;
        newMessagesCount = 0;
        hideNewMessagesIndicator();
      }
    }
    
    // Botón scroll al final
    if (scrollToBottomBtn) {
      scrollToBottomBtn.addEventListener('click', scrollToBottom);
    }
    
    // Botón refrescar chat
    if (refreshChatBtn) {
      refreshChatBtn.addEventListener('click', async () => {
        if (currentContactId) {
          refreshChatBtn.style.opacity = '0.6';
          refreshChatBtn.style.transform = 'rotate(360deg)';
          
          try {
            await loadMessages(currentContactId);
          } catch (error) {
            console.error('Error al refrescar:', error);
          }
          
          setTimeout(() => {
            refreshChatBtn.style.opacity = '1';
            refreshChatBtn.style.transform = 'rotate(0deg)';
          }, 500);
        }
      });
    }

    // Listener para scroll inteligente (paginación hacia arriba)
    const debouncedScrollHandler = debounce(() => {
      if (!currentContactId) return;
      const scrollTop = messagesEl.scrollTop;
      const nearBottom = (messagesEl.scrollHeight - messagesEl.clientHeight - scrollTop) <= SCROLL_THRESHOLD;

      // Mover ventana hacia atrás dentro de mensajes ya cargados
      if (scrollTop <= SCROLL_THRESHOLD) {
        if (currentViewStart > 0) {
          const previousStart = currentViewStart;
          currentViewStart = Math.max(0, currentViewStart - WINDOW_STEP);
          if (previousStart !== currentViewStart) {
            renderMessages(currentMessages, true);
            return;
          }
        }
        // Si ya no hay más en memoria hacia atrás, intentar pedir a BD
        if (!isLoadingOlderMessages && hasMoreOlderMessages) {
          loadOlderMessages(currentContactId);
          return;
        }
      }

      // Mover ventana hacia adelante dentro de mensajes ya cargados
      if (nearBottom) {
        const maxStart = Math.max(0, currentMessages.length - MAX_MESSAGES_IN_DOM);
        if (currentViewStart < maxStart) {
          const previousStart = currentViewStart;
          currentViewStart = Math.min(maxStart, currentViewStart + WINDOW_STEP);
          if (previousStart !== currentViewStart) {
            renderMessages(currentMessages, true);
            return;
          }
        }
      }
    }, 120);
    
    // Verificar que los elementos existan antes de añadir event listeners
    if (messagesEl) {
      messagesEl.addEventListener('scroll', debouncedScrollHandler);
      console.log('✅ Event listener de scroll añadido correctamente');
    } else {
      console.error('❌ No se encontró el elemento #messages');
    }

    // Evento para ir a los mensajes más recientes
    if (newMessagesIndicator) {
      newMessagesIndicator.addEventListener('click', goToLatestMessages);
    }

    await loadAgents();
    await loadConversations();
    await trySelectFromQuery();
  }

  window.LivechatModule = { init };
})();


