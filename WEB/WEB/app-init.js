(async function(){
    // ==========================================
    // PRE-PROCESAMIENTO DE ENLACES DE INVITACIÓN
    // ==========================================
    // Ejecutar ANTES de Loader.init()
    // Parsear los parámetros correctamente y guardar el tipo en sessionStorage
    (function preprocessAuthLinks() {
      // Parsear los parámetros correctamente
      const hashString = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hashString);
      const urlParams = new URLSearchParams(window.location.search);

      const type = hashParams.get('type') || urlParams.get('type');
      const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || urlParams.get('refresh_token');

      // DEBUG
      console.log('🔍 PRE-PROCESAMIENTO:', { type, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });

      // Si es una invitación, guardar el tipo en sessionStorage ANTES de procesar
      if (type === 'invite' && accessToken && refreshToken) {
        console.log('📌 Invitación detectada en pre-procesamiento, guardando tipo...');
        // Guardar en sessionStorage para que el onAuthStateChange lo encuentre
        sessionStorage.setItem('authType', 'invite');
        sessionStorage.setItem('authTokens', JSON.stringify({ accessToken, refreshToken }));
      }

      // Si es recuperación, también guardar
      if (type === 'recovery' && accessToken) {
        console.log('📌 Recuperación detectada en pre-procesamiento...');
        sessionStorage.setItem('authType', 'recovery');
      }

      // Esperar a que App esté disponible y establecer sesión
      if (window.App?.supabase && type === 'invite' && accessToken && refreshToken) {
        console.log('🔄 Pre-procesando enlace de invitación...');
        window.App.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        .then(() => console.log('✅ Sesión establecida en pre-procesamiento'))
        .catch(err => console.error('❌ Error estableciendo sesión:', err));
      }
    })();
    
    await Loader.init();
    const loginForm = document.getElementById('login-form');
    const authError = document.getElementById('auth-error');
    const userEmail = document.getElementById('user-email');
    const userRoleEl = document.getElementById('user-role');
    const logoutBtn = document.getElementById('logout-btn');
    const brand = document.getElementById('brand-name');
    const logo = document.getElementById('brand-logo');
    const bannerText = document.getElementById('banner-text');
    
    // === APLICAR TEMA Y CONFIGURAR UI ===
    
    // Header: Logo y marca
    const footerLogo = document.getElementById('footer-brand-logo');
    const footerBrandName = document.getElementById('footer-brand-name');
    
    brand.textContent = App.theme.brandName;
    logo.src = App.theme.logoUrl;
    logo.onerror = () => logo.style.display = 'none';
    
    // Footer: Logo y marca
    if (footerLogo && footerBrandName) {
      footerLogo.src = App.theme.logoUrl;
      footerLogo.onerror = () => footerLogo.style.display = 'none';
      footerBrandName.textContent = App.theme.brandName;
    }
    
    bannerText.textContent = App.theme.bannerText;
    
    // === NAVEGACIÓN ACTIVA MEJORADA ===
    function updateActiveNavigation() {
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        const href = item.getAttribute('href');
        if (href && location.hash.includes(href.substring(1))) {
          item.classList.add('active');
        }
      });
      
      // Actualizar items del dropdown también
      document.querySelectorAll('.nav-dropdown-item').forEach(item => {
        item.classList.remove('active');
        const href = item.getAttribute('href');
        if (href && location.hash.includes(href.substring(1))) {
          item.classList.add('active');
          // También marcar el trigger como activo si hay un item activo
          const trigger = document.querySelector('.nav-dropdown-trigger');
          if (trigger) {
            trigger.classList.add('active');
          }
        }
      });
    }
    
    // === MENÚ DESPLEGABLE FUNCIONAL ===
    function initDropdownNavigation() {
      const trigger = document.querySelector('.nav-dropdown-trigger');
      const dropdown = document.querySelector('.nav-dropdown');
      
      if (!trigger || !dropdown) return;
      
      let isOpen = false;
      let timeoutId = null;
      
      function openDropdown() {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        dropdown.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
        isOpen = true;
      }
      
      function closeDropdown() {
        dropdown.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
        isOpen = false;
      }
      
      function scheduleClose() {
        timeoutId = setTimeout(closeDropdown, 300);
      }
      
      // Hover events para escritorio
      trigger.addEventListener('mouseenter', openDropdown);
      trigger.addEventListener('mouseleave', scheduleClose);
      dropdown.addEventListener('mouseenter', () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      });
      dropdown.addEventListener('mouseleave', scheduleClose);
      
      // Click events para móvil/touch
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (isOpen) {
          closeDropdown();
        } else {
          openDropdown();
        }
      });
      
      // Cerrar al hacer click fuera
      document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
          closeDropdown();
        }
      });
      
      // Soporte para teclado
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isOpen) {
            closeDropdown();
          } else {
            openDropdown();
          }
        }
        if (e.key === 'Escape' && isOpen) {
          closeDropdown();
          trigger.focus();
        }
      });
    }
    
    updateActiveNavigation();
    initDropdownNavigation();
    
    // Escuchar cambios de hash para actualizar navegación
    window.addEventListener('hashchange', updateActiveNavigation);
  
    // Aplicar tokens semánticos a elementos con data-*
    App.applyTokensToDOM();
    // Montar inspector de tema (opcional, visible en runtime)
    try{ window.ThemeInspector?.mount(); }catch(_){ }
  
    // === MANEJO MANUAL DE ENLACES DE RECUPERACIÓN ===
    async function handleRecoveryLink() {
      // Extraer correctamente los parámetros aunque haya una ruta antes del '?'
      const hashString = window.location.hash.includes('?')
        ? window.location.hash.split('?')[1] // obtiene solo "token_hash=...&type=recovery"
        : window.location.hash.substring(1);
      
      const hashParams = new URLSearchParams(hashString);
      const urlParams = new URLSearchParams(window.location.search);
      const type = hashParams.get('type') || urlParams.get('type');
      const access_token = hashParams.get('access_token') || urlParams.get('access_token');
      const token_hash = hashParams.get('token_hash') || urlParams.get('token_hash');
  
      // Debug: imprimir resultado del parseo
      console.log('Token parsing result:', {
        fullHash: window.location.hash,
        hashString,
        tokenHash: hashParams.get('token_hash'),
        type: hashParams.get('type'),
        accessToken: hashParams.get('access_token')
      });
  
      if (type === 'recovery' && (access_token || token_hash)) {
        console.log('Token de recuperación detectado manualmente:', { type, hasToken: !!(access_token || token_hash) });
        
        // Esperar un poco para que Supabase procese el token y cree la sesión
        await new Promise(res => setTimeout(res, 1000));
  
        // Verificar si ya hay una sesión activa
        const { data: { session } } = await App.supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Sesión activa encontrada después del delay, abriendo modal...');
          // Mostrar modal manualmente
          openModal('password-change-modal');
          // Limpiar hash para evitar loops
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          console.log('No hay sesión activa, intentando verificación manual...');
          // Intentar verificación manual del token
          try {
            const { data: verifyData, error: verifyError } = await App.supabase.auth.verifyOtp({
              token_hash: token_hash || access_token,
              type: 'recovery'
            });
            
            if (!verifyError && verifyData?.user) {
              console.log('Token verificado manualmente, abriendo modal...');
              openModal('password-change-modal');
              window.history.replaceState({}, document.title, window.location.pathname);
            } else {
              console.error('Error verificando token manualmente:', verifyError);
            }
          } catch (err) {
            console.error('Error en verificación manual:', err);
          }
        }
      }
    }
  
    // Ejecutar manejo de enlace de recuperación al cargar
    handleRecoveryLink();
  
    // === LISTENER DE CAMBIOS DE AUTENTICACIÓN ===
    // Maneja tanto recuperación como invitaciones de forma nativa
    App.supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state change:', event, session?.user?.email);

      // Obtener el tipo de evento guardado en sessionStorage
      const authType = sessionStorage.getItem('authType');
      
      console.log('📋 Event info:', {
        event,
        authType,
        hasSession: !!session?.user,
        url: window.location.href
      });

      // ==========================================
      // 1. MANEJAR RECUPERACIÓN DE CONTRASEÑA
      // ==========================================
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        console.log('✅ PASSWORD_RECOVERY event detectado - abriendo modal...');
        sessionStorage.removeItem('authType');
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Abrir modal después de un pequeño delay
        setTimeout(() => {
          openModal('password-change-modal');
        }, 500);
        return;
      }

      // ==========================================
      // 2. MANEJAR INVITACIÓN (SIGNED_IN + authType='invite')
      // ==========================================
      if (event === 'SIGNED_IN' && authType === 'invite' && session?.user) {
        console.log('✅ SIGNED_IN + INVITE detectado - abriendo modal de invitación...');
        
        try {
          // Limpiar sessionStorage
          sessionStorage.removeItem('authType');
          sessionStorage.removeItem('authTokens');

          // Ocultar shell de login, mostrar auth section
          const shell = document.getElementById('shell');
          if (shell && !shell.classList.contains('hidden')) {
            shell.classList.add('hidden');
          }

          const authSection = document.getElementById('auth-section');
          if (authSection) {
            authSection.classList.remove('hidden');
            const loginForm = document.getElementById('login-form');
            if (loginForm) loginForm.style.opacity = '0';
          }

          // Poblar datos del usuario en el modal
          const userMetadata = session.user.user_metadata || {};
          const emailInput = document.getElementById('invitation-email');
          const roleBadge = document.getElementById('invitation-role-badge');
          const inviteBy = document.getElementById('invitation-by');

          if (emailInput) emailInput.value = session.user.email;
          if (roleBadge) {
            const role = userMetadata.role || 'usuario';
            roleBadge.textContent = role;
            roleBadge.className = `role-badge ${role}`;
          }
          if (inviteBy) inviteBy.textContent = userMetadata.invited_by || 'Administrador';

          // Limpiar URL ANTES de abrir modal
          window.history.replaceState({}, document.title, window.location.pathname);

          // Abrir modal
          setTimeout(() => {
            openModal('invitation-modal');
            console.log('🎉 Modal de invitación abierto');
          }, 300);

        } catch (err) {
          console.error('❌ Error procesando invitación:', err);
          alert('Error al procesar la invitación: ' + err.message);
          window.location.hash = '#/';
        }
        return;
      }

      // ==========================================
      // 3. MANEJAR RECUPERACIÓN COMO SIGNED_IN
      // ==========================================
      if (event === 'SIGNED_IN' && authType === 'recovery' && session?.user) {
        console.log('✅ SIGNED_IN + RECOVERY detectado - abriendo modal...');
        sessionStorage.removeItem('authType');
        
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setTimeout(() => {
          openModal('password-change-modal');
        }, 500);
        return;
      }

      // ==========================================
      // 4. FLUJO NORMAL (LOGIN, SIGNED_IN sin invitación)
      // ==========================================
      if (event === 'SIGNED_IN' && session?.user && !authType) {
        console.log('✅ Login normal exitoso');
        sessionStorage.removeItem('authType');
        
        // El flujo normal continuará
        return;
      }

      // ==========================================
      // 5. SIGN_OUT
      // ==========================================
      if (event === 'SIGNED_OUT') {
        console.log('👋 Usuario desconectado');
        sessionStorage.removeItem('authType');
        sessionStorage.removeItem('authTokens');
        
        // Restaurar UI de login
        const shell = document.getElementById('shell');
        const authSection = document.getElementById('auth-section');
        const loginForm = document.getElementById('login-form');
        const header = document.querySelector('.app-header');
        
        // Ocultar shell y header
        if (shell) shell.classList.add('hidden');
        if (header) header.classList.add('hidden');
        
        // Mostrar auth section
        if (authSection) {
          authSection.classList.remove('hidden');
          // Restaurar opacidad del login form
          if (loginForm) loginForm.style.opacity = '';
        }
        
        // Cerrar cualquier modal abierto
        const openModals = document.querySelectorAll('.modal.active');
        openModals.forEach(modal => {
          if (modal.id) {
            closeModal(modal.id);
          }
        });
        
        // Limpiar hash y redirigir a login
        window.location.hash = '#/';
        Router.onRouteChange();
        
        return;
      }

      // ==========================================
      // 6. INITIAL_SESSION (Carga de página)
      // ==========================================
      if (event === 'INITIAL_SESSION') {
        console.log('📦 Sesión inicial cargada');
        
        // Verificar si hay una invitación pendiente que se cargó en pre-procesamiento
        if (authType === 'invite' && session?.user) {
          console.log('🔄 Invitación pendiente desde pre-procesamiento');
          // El siguiente ciclo (SIGNED_IN) la manejará
          return;
        }
        
        return;
      }
    });
  
    function updateRoleUI(){
      if(userRoleEl){ userRoleEl.textContent = (App.getRole() || '—'); }
      Loader.renderNavigation();
    }
  
    // === FOOTER MEJORADO ===
    const footerText = document.getElementById('footer-text');
    const footerLinks = document.getElementById('footer-links');
    const currentTime = document.getElementById('current-time');
    
    // Configurar footer
    footerText.textContent = App.theme.footer?.text || '';
    footerLinks.innerHTML = '';
    (App.theme.footer?.links || []).forEach(l => {
      const a = document.createElement('a');
      a.href = l.href;
      a.textContent = l.label;
      a.className = 'footer-nav-link';
      footerLinks.appendChild(a);
    });
    
    // === RELOJ EN TIEMPO REAL ===
    function updateTime() {
      if (currentTime) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        currentTime.textContent = timeString;
      }
    }
    
    updateTime();
    setInterval(updateTime, 1000);
    
    // === NOTIFICACIONES (PLACEHOLDER) ===
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationBadge = document.getElementById('notification-badge');
    
    if (notificationsBtn) {
      notificationsBtn.addEventListener('click', () => {
        // Placeholder para funcionalidad futura
        console.log('Notificaciones clicked - funcionalidad futura');
        
        // Simular actualización de badge
        if (notificationBadge && !notificationBadge.classList.contains('hidden')) {
          notificationBadge.classList.add('hidden');
        }
      });
    }
  
    // == NUEVA LÓGICA MEJORADA DEL LOGIN ==
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    const passwordToggle = document.querySelector('.password-toggle');
    const forgotPassword = document.getElementById('forgot-password');
    const rememberMe = document.getElementById('remember-me');
    const submitBtn = document.querySelector('.btn-login');
    const btnText = document.querySelector('.btn-text');
    const btnSpinner = document.querySelector('.btn-spinner');
  
    // Validación en tiempo real
    const validators = {
      email: (value) => {
        if (!value) return 'El correo electrónico es requerido';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Ingresa un correo electrónico válido';
        return null;
      },
      password: (value) => {
        if (!value) return 'La contraseña es requerida';
        if (value.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
        return null;
      }
    };
  
    function showFieldError(input, errorElement, message) {
      input.classList.add('error');
      input.classList.remove('success');
      errorElement.textContent = message;
      errorElement.classList.add('show');
      input.closest('.form-field')?.classList.add('shake');
      setTimeout(() => input.closest('.form-field')?.classList.remove('shake'), 400);
    }
  
    function showFieldSuccess(input, errorElement) {
      input.classList.remove('error');
      input.classList.add('success');
      errorElement.textContent = '';
      errorElement.classList.remove('show');
    }
  
    function clearFieldState(input, errorElement) {
      input.classList.remove('error', 'success');
      errorElement.textContent = '';
      errorElement.classList.remove('show');
    }
  
    function validateField(input, errorElement, validator) {
      const value = input.value.trim();
      const error = validator(value);
      
      if (error) {
        showFieldError(input, errorElement, error);
        return false;
      } else if (value) {
        showFieldSuccess(input, errorElement);
        return true;
      } else {
        clearFieldState(input, errorElement);
        return false;
      }
    }
  
    function updateSubmitButton() {
      const emailValid = !emailInput.classList.contains('error') && emailInput.value.trim();
      const passwordValid = !passwordInput.classList.contains('error') && passwordInput.value.trim();
      submitBtn.disabled = !(emailValid && passwordValid);
    }
  
    // Event listeners para validación en tiempo real
    emailInput.addEventListener('input', (e) => {
      setTimeout(() => {
        validateField(e.target, emailError, validators.email);
        updateSubmitButton();
      }, 300); // Debounce de 300ms
    });
  
    emailInput.addEventListener('blur', (e) => {
      validateField(e.target, emailError, validators.email);
      updateSubmitButton();
    });
  
    passwordInput.addEventListener('input', (e) => {
      if (e.target.value.length > 0) {
        setTimeout(() => {
          validateField(e.target, passwordError, validators.password);
          updateSubmitButton();
        }, 300);
      }
    });
  
    passwordInput.addEventListener('blur', (e) => {
      validateField(e.target, passwordError, validators.password);
      updateSubmitButton();
    });
  
    // Toggle de contraseña
    passwordToggle.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      const eyeOpen = passwordToggle.querySelector('.eye-open');
      const eyeClosed = passwordToggle.querySelector('.eye-closed');
      
      if (type === 'text') {
        eyeOpen.classList.add('hidden');
        eyeClosed.classList.remove('hidden');
      } else {
        eyeOpen.classList.remove('hidden');
        eyeClosed.classList.add('hidden');
      }
    });
  
    // Función para mostrar errores generales
    function showAuthError(message) {
      authError.textContent = message;
      authError.classList.add('show');
    }
  
    function clearAuthError() {
      authError.textContent = '';
      authError.classList.remove('show');
    }
  
    // Funcionalidad "Recordarme"
    function saveLoginPreference(email, remember) {
      if (remember) {
        localStorage.setItem('rememberedEmail', email);
        localStorage.setItem('rememberLogin', 'true');
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberLogin');
      }
    }
  
    function loadLoginPreference() {
      const remembered = localStorage.getItem('rememberLogin') === 'true';
      const email = localStorage.getItem('rememberedEmail');
      
      if (remembered && email) {
        emailInput.value = email;
        rememberMe.checked = true;
        validateField(emailInput, emailError, validators.email);
        updateSubmitButton();
      }
    }
  
    // Cargar preferencias al iniciar
    loadLoginPreference();
  
    // Función principal de login
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthError();
  
      // Validación final
      const emailValid = validateField(emailInput, emailError, validators.email);
      const passwordValid = validateField(passwordInput, passwordError, validators.password);
  
      if (!emailValid || !passwordValid) {
        showAuthError('Por favor corrige los errores en el formulario');
        return;
      }
  
      // Estado de carga
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;
      btnSpinner.classList.remove('hidden');
  
      try {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        const { data, error } = await App.signIn(email, password);
        
        if (error) {
          // Manejo de errores más específico
          let errorMessage = 'Error al iniciar sesión';
          
          if (error.message?.includes('Invalid login credentials')) {
            errorMessage = 'Credenciales incorrectas. Verifica tu correo y contraseña.';
          } else if (error.message?.includes('Email not confirmed')) {
            errorMessage = 'Por favor confirma tu correo electrónico antes de iniciar sesión.';
          } else if (error.message?.includes('Too many requests')) {
            errorMessage = 'Demasiados intentos. Espera un momento antes de intentar nuevamente.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          showAuthError(errorMessage);
          return;
        }
  
        // Login exitoso
        App.session = data.user ? { user: data.user } : null;
        userEmail.textContent = data.user?.email || '';
  
        // Cambio de contraseña obligatorio
        const mustChangePassword = data.user?.app_metadata?.must_change_password || data.user?.user_metadata?.must_change_password;
        if (mustChangePassword) {
          showPasswordChangeModal(data.user);
          return;
        }
        
        // Guardar preferencias
        saveLoginPreference(email, rememberMe.checked);
        await App.loadProfile();
        await App.loadPermissions();
        updateRoleUI();
        await Loader.renderNavigation();
        
        // Redireccionar
        location.hash = location.hash || '#/livechat';
        Router.onRouteChange();
        
      } catch (err) {
        console.error('Error durante el login:', err);
        showAuthError('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
      } finally {
        // Restaurar estado del botón
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        btnSpinner.classList.add('hidden');
      }
    });
  
    // Modal de cambio de contraseña obligatorio para primer inicio
    function showPasswordChangeModal(user) {
      const backdrop = document.createElement('div');
      backdrop.className = 'password-change-modal-backdrop';
      backdrop.innerHTML = `
        <div class="password-change-modal">
          <div class="modal-header">
            <h3>🔐 Cambio de Contraseña Requerido</h3>
            <p>Debes cambiar tu contraseña antes de continuar</p>
          </div>
          <form id="password-change-form">
            <div class="form-field">
              <label for="new-password">Nueva Contraseña</label>
              <div class="input-wrapper">
                <input type="password" id="new-password" required minlength="8" placeholder="Mínimo 8 caracteres">
              </div>
            </div>
            <div class="form-field">
              <label for="confirm-password">Confirmar Contraseña</label>
              <div class="input-wrapper">
                <input type="password" id="confirm-password" required minlength="8" placeholder="Repite la contraseña">
              </div>
            </div>
            <div class="password-requirements">
              <small id="req-length">• Mínimo 8 caracteres</small>
              <br>
              <small id="req-match">• Las contraseñas deben coincidir</small>
            </div>
            <div class="modal-actions">
              <button type="submit" id="change-password-btn" class="btn-primary" disabled>Cambiar Contraseña</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(backdrop);
  
      const form = backdrop.querySelector('#password-change-form');
      const newPasswordInput = backdrop.querySelector('#new-password');
      const confirmPasswordInput = backdrop.querySelector('#confirm-password');
      const submitBtn = backdrop.querySelector('#change-password-btn');
      const reqLen = backdrop.querySelector('#req-length');
      const reqMatch = backdrop.querySelector('#req-match');
  
      function validate() {
        const p1 = newPasswordInput.value;
        const p2 = confirmPasswordInput.value;
        const okLen = p1.length >= 8;
        const okMatch = p1.length > 0 && p1 === p2;
        reqLen.style.color = okLen ? 'var(--success, #10b981)' : 'var(--warning, #f59e0b)';
        reqMatch.style.color = okMatch ? 'var(--success, #10b981)' : 'var(--warning, #f59e0b)';
        submitBtn.disabled = !(okLen && okMatch);
      }
  
      newPasswordInput.addEventListener('input', validate);
      confirmPasswordInput.addEventListener('input', validate);
  
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        try {
          const newPassword = newPasswordInput.value;
          // 1) Cambiar password del usuario autenticado
          const { error: updateErr } = await App.supabase.auth.updateUser({ password: newPassword });
          if (updateErr) throw updateErr;
          // 2) Limpiar flags de primer login
          await App.supabase.auth.updateUser({ data: { must_change_password: false, temp_password: false } });
  
          // Cerrar modal
          if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  
          // Continuar flujo normal
          saveLoginPreference(user.email, rememberMe.checked);
          await App.loadProfile();
          await App.loadPermissions();
          updateRoleUI();
          await Loader.renderNavigation();
          location.hash = location.hash || '#/livechat';
          Router.onRouteChange();
          setTimeout(() => alert('Contraseña cambiada exitosamente. Bienvenido.'), 200);
        } catch (err) {
          alert('Error cambiando contraseña: ' + (err?.message || err));
          submitBtn.disabled = false;
        }
      });
  
      setTimeout(() => newPasswordInput.focus(), 100);
    }
  
    // Funcionalidad "Olvidé mi contraseña" - Modal integrado
    forgotPassword.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      if (email && validators.email(email) === null) {
        // Si hay un email válido, pre-llenar el modal
        document.getElementById('recovery-email').value = email;
      }
      
      // Abrir modal de recuperación
      openModal('password-recovery-modal');
    });
  
    logoutBtn.addEventListener('click', async () => {
      await App.signOut();
      userEmail.textContent = '';
      // ✨ Usar lógica centralizada del router que incluye header
      await Loader.renderNavigation();
      Router.onRouteChange();
    });
  
    const session = await App.restoreSession();
    
    // Verificar si el usuario llegó a través de un enlace de recuperación
    const initUrlParams = new URLSearchParams(window.location.search);
    
    // Parsear hash correctamente
    const initHashString = window.location.hash.includes('?')
      ? window.location.hash.split('?')[1]
      : window.location.hash.substring(1);
    const initHashParams = new URLSearchParams(initHashString);
    
    const hasInitRecoveryParams = initUrlParams.has('access_token') || initHashParams.has('access_token') || 
                                 initUrlParams.has('token_hash') || initHashParams.has('token_hash') ||
                                 (initUrlParams.has('type') && initUrlParams.get('type') === 'recovery') ||
                                 (initHashParams.has('type') && initHashParams.get('type') === 'recovery');
    
    console.log('Verificando parámetros de recuperación:', {
      search: window.location.search,
      hash: window.location.hash,
      hasRecoveryParams: hasInitRecoveryParams,
      urlParams: Object.fromEntries(initUrlParams),
      hashParams: Object.fromEntries(initHashParams)
    });
    
    if(session?.user){
      userEmail.textContent = session.user.email || '';
      
      // Verificar si llegó desde recuperación o invitación (manejados por onAuthStateChange)
      const hasInitInviteParams = (initUrlParams.get('type') === 'invite') || 
                                 (initHashParams.get('type') === 'invite');
      
      if (hasInitInviteParams) {
        // Invitación: será manejada por onAuthStateChange después del pre-procesamiento
        console.log('Invitación detectada - será manejada por onAuthStateChange');
        return; // NO continuar con el flujo normal
      }
      
      if (hasInitRecoveryParams) {
        // Recuperación: será manejada por handleRecoveryLink() o onAuthStateChange
        console.log('Recuperación detectada - será manejada por handleRecoveryLink() o onAuthStateChange');
        return;
      }
      
      // Verificar si el usuario necesita cambiar contraseña (método alternativo)
      const needsPasswordChange = session.user.app_metadata?.must_change_password || 
                                 session.user.user_metadata?.must_change_password ||
                                 session.user.app_metadata?.temp_password;
      
      if (needsPasswordChange) {
        console.log('Usuario necesita cambiar contraseña, redirigiendo...');
        window.location.hash = '#/reset-password';
        Router.onRouteChange();
        return;
      }
      
      // Flujo normal: cargar perfil y permisos
      await App.loadProfile();
      await App.loadPermissions();
      updateRoleUI();
      await Loader.renderNavigation();
    }
    
    // NO ejecutar Router.onRouteChange si hay una invitación pendiente
    // El pre-procesamiento y onAuthStateChange manejarán la invitación
    const hashStringForRouter = window.location.hash.includes('?')
      ? window.location.hash.split('?')[1]
      : window.location.hash.substring(1);
    const hashParamsForRouter = new URLSearchParams(hashStringForRouter);
    const urlParamsForRouter = new URLSearchParams(window.location.search);
    const pendingType = hashParamsForRouter.get('type') || urlParamsForRouter.get('type');
    
    // Solo ejecutar router si NO hay una invitación pendiente (el pre-procesamiento la manejará)
    if (pendingType !== 'invite') {
      Router.onRouteChange();
    }
  
    // ===============================================
    // SISTEMA DE MODALES LEGALES
    // ===============================================
    
    function openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Foco en el modal para accesibilidad
        modal.setAttribute('aria-hidden', 'false');
        modal.querySelector('.modal-close')?.focus();
      }
    }
    
    function closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        modal.setAttribute('aria-hidden', 'true');
      }
    }
    
    // Funciones globales para los enlaces del footer
    window.openTermsModal = () => openModal('terms-modal');
    window.openPrivacyModal = () => openModal('privacy-modal');
    
    // Event listeners para cerrar modales
    document.addEventListener('click', (e) => {
      if (e.target.dataset.modalClose) {
        closeModal(e.target.dataset.modalClose);
      }
    });
    
    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
          const modalId = activeModal.id;
          closeModal(modalId);
        }
      }
    });
  
    // ===============================================
    // SISTEMA DE RECUPERACIÓN DE CONTRASEÑA INTEGRADO
    // ===============================================
    
    // Modal de recuperación de contraseña
    const recoveryModal = document.getElementById('password-recovery-modal');
    const recoveryForm = document.getElementById('password-recovery-form');
    const recoveryEmailInput = document.getElementById('recovery-email');
    const recoveryEmailError = document.getElementById('recovery-email-error');
    const sendRecoveryBtn = document.getElementById('send-recovery-btn');
    const recoverySuccess = document.getElementById('recovery-success');
    
    // Modal de cambio de contraseña
    const changeModal = document.getElementById('password-change-modal');
    const changeForm = document.getElementById('password-change-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-new-password');
    const newPasswordError = document.getElementById('new-password-error');
    const confirmPasswordError = document.getElementById('confirm-password-error');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const changeSuccess = document.getElementById('password-change-success');
    
    // Event listener para el botón "Ir al Login" después del cambio de contraseña
    const goToLoginBtn = document.getElementById('go-to-login-btn');
    if (goToLoginBtn) {
      goToLoginBtn.addEventListener('click', () => {
        closeModal('password-change-modal');
        window.location.hash = '#/';
      });
    }
    
    // Validación de email en modal de recuperación
    recoveryEmailInput?.addEventListener('input', (e) => {
      setTimeout(() => {
        validateField(e.target, recoveryEmailError, validators.email);
      }, 300);
    });
    
    recoveryEmailInput?.addEventListener('blur', (e) => {
      validateField(e.target, recoveryEmailError, validators.email);
    });
    
    // Envío de enlace de recuperación
    recoveryForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = recoveryEmailInput.value.trim();
      const emailValid = validateField(recoveryEmailInput, recoveryEmailError, validators.email);
      
      if (!emailValid) {
        return;
      }
      
      // Estado de carga
      sendRecoveryBtn.disabled = true;
      sendRecoveryBtn.classList.add('loading');
      sendRecoveryBtn.querySelector('.btn-text').classList.add('hidden');
      sendRecoveryBtn.querySelector('.btn-spinner').classList.remove('hidden');
      
      try {
        // Usar Auth nativo de Supabase para recuperación
        const { error } = await App.supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`
        });
        
        if (error) {
          throw error;
        }
        
        // Mostrar éxito
        recoveryForm.classList.add('hidden');
        recoverySuccess.classList.remove('hidden');
        
        // Cerrar modal después de 3 segundos
        setTimeout(() => {
          closeModal('password-recovery-modal');
          recoveryForm.classList.remove('hidden');
          recoverySuccess.classList.add('hidden');
          recoveryEmailInput.value = '';
        }, 3000);
        
      } catch (err) {
        console.error('Error enviando enlace de recuperación:', err);
        let errorMessage = 'Error al enviar el enlace de recuperación';
        
        if (err.message?.includes('User not found')) {
          errorMessage = 'No se encontró una cuenta con este correo electrónico';
        } else if (err.message?.includes('Too many requests')) {
          errorMessage = 'Demasiados intentos. Espera un momento antes de intentar nuevamente';
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        showFieldError(recoveryEmailInput, recoveryEmailError, errorMessage);
      } finally {
        // Restaurar botón
        sendRecoveryBtn.disabled = false;
        sendRecoveryBtn.classList.remove('loading');
        sendRecoveryBtn.querySelector('.btn-text').classList.remove('hidden');
        sendRecoveryBtn.querySelector('.btn-spinner').classList.add('hidden');
      }
    });
    
    // Validación de contraseñas en modal de cambio
    function validatePasswordChange() {
      const password = newPasswordInput.value;
      const confirm = confirmPasswordInput.value;
      
      // Validaciones
      const hasLength = password.length >= 8;
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const passwordsMatch = password && confirm && password === confirm;
      
      // Actualizar indicadores visuales
      updateRequirement('req-length', hasLength);
      updateRequirement('req-uppercase', hasUppercase);
      updateRequirement('req-lowercase', hasLowercase);
      updateRequirement('req-match', passwordsMatch);
      
      // Validar campos
      validatePasswordField(newPasswordInput, newPasswordError, password);
      validatePasswordField(confirmPasswordInput, confirmPasswordError, confirm);
      
      // Habilitar/deshabilitar botón
      const allValid = hasLength && hasUppercase && hasLowercase && passwordsMatch;
      changePasswordBtn.disabled = !allValid;
      
      return allValid;
    }
    
    function updateRequirement(id, isValid) {
      const element = document.getElementById(id);
      if (!element) return;
      
      const icon = element.querySelector('.requirement-icon');
      if (icon) {
        icon.textContent = isValid ? '✅' : '❌';
      }
      
      element.classList.toggle('valid', isValid);
      element.classList.toggle('invalid', !isValid);
    }
    
    function validatePasswordField(input, errorElement, value) {
      if (!input || !errorElement) return;
      
      if (!value) {
        clearFieldState(input, errorElement);
        return false;
      }
      
      const password = newPasswordInput.value;
      const confirm = confirmPasswordInput.value;
      
      if (input === newPasswordInput) {
        // Validar nueva contraseña
        if (password.length < 8) {
          showFieldError(input, errorElement, 'Mínimo 8 caracteres');
          return false;
        }
        if (!/[A-Z]/.test(password)) {
          showFieldError(input, errorElement, 'Debe tener al menos una mayúscula');
          return false;
        }
        if (!/[a-z]/.test(password)) {
          showFieldError(input, errorElement, 'Debe tener al menos una minúscula');
          return false;
        }
        showFieldSuccess(input, errorElement);
        return true;
      }
      
      if (input === confirmPasswordInput) {
        // Validar confirmación
        if (confirm && password && confirm !== password) {
          showFieldError(input, errorElement, 'Las contraseñas no coinciden');
          return false;
        }
        if (confirm && password && confirm === password) {
          showFieldSuccess(input, errorElement);
          return true;
        }
        clearFieldState(input, errorElement);
        return false;
      }
      
      return true;
    }
    
    // Event listeners para validación en tiempo real
    newPasswordInput?.addEventListener('input', () => {
      setTimeout(validatePasswordChange, 100);
    });
    
    confirmPasswordInput?.addEventListener('input', () => {
      setTimeout(validatePasswordChange, 100);
    });
    
    // Toggle de contraseñas en modales
    document.querySelectorAll('#password-change-modal .password-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const input = toggle.closest('.input-wrapper').querySelector('input');
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        const eyeOpen = toggle.querySelector('.eye-open');
        const eyeClosed = toggle.querySelector('.eye-closed');
        
        if (type === 'text') {
          eyeOpen.classList.add('hidden');
          eyeClosed.classList.remove('hidden');
        } else {
          eyeOpen.classList.remove('hidden');
          eyeClosed.classList.add('hidden');
        }
      });
    });
    
    // Envío del formulario de cambio de contraseña
    changeForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!validatePasswordChange()) {
        return;
      }
      
      // Estado de carga
      changePasswordBtn.disabled = true;
      changePasswordBtn.classList.add('loading');
      changePasswordBtn.querySelector('.btn-text').classList.add('hidden');
      changePasswordBtn.querySelector('.btn-spinner').classList.remove('hidden');
      
      try {
        const newPassword = newPasswordInput.value;
        
        // Verificar si hay una sesión activa
        const { data: { session } } = await App.supabase.auth.getSession();
        
        if (!session?.user) {
          // Si no hay sesión, intentar verificar el token manualmente
          const urlParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const token = hashParams.get('access_token') || urlParams.get('access_token');
          const tokenHash = hashParams.get('token_hash') || urlParams.get('token_hash');
          
          if (token || tokenHash) {
            // Intentar verificar el token OTP
            const { data: verifyData, error: verifyError } = await App.supabase.auth.verifyOtp({
              token_hash: tokenHash || token,
              type: 'recovery'
            });
            
            if (verifyError) {
              throw new Error('Token de recuperación inválido o expirado. Por favor, solicita un nuevo enlace.');
            }
            
            // Ahora actualizar la contraseña
            const { error } = await App.supabase.auth.updateUser({
              password: newPassword
            });
            
            if (error) {
              throw error;
            }
          } else {
            throw new Error('No hay una sesión activa. Por favor, usa el enlace de recuperación correcto.');
          }
        } else {
          // Hay sesión activa, actualizar contraseña normalmente
          const { error } = await App.supabase.auth.updateUser({
            password: newPassword
          });
          
          if (error) {
            throw error;
          }
        }
        
        // Mostrar éxito
        changeForm.classList.add('hidden');
        changeSuccess.classList.remove('hidden');
        
        // Cerrar sesión para forzar nuevo login
        await App.supabase.auth.signOut();
        
      } catch (err) {
        console.error('Error cambiando contraseña:', err);
        let errorMsg = 'Error al cambiar la contraseña';
        
        if (err.message?.includes('same password')) {
          errorMsg = 'La nueva contraseña debe ser diferente a la actual';
        } else if (err.message?.includes('weak password')) {
          errorMsg = 'La contraseña es demasiado débil. Usa una más segura';
        } else if (err.message) {
          errorMsg = err.message;
        }
        
        alert(errorMsg);
        
        // Restaurar botón
        changePasswordBtn.disabled = false;
        changePasswordBtn.classList.remove('loading');
        changePasswordBtn.querySelector('.btn-text').classList.remove('hidden');
        changePasswordBtn.querySelector('.btn-spinner').classList.add('hidden');
      }
    });
    
    // Detectar si el usuario llegó desde un enlace de recuperación
    const recoveryUrlParams = new URLSearchParams(window.location.search);
    
    // Parsear hash correctamente
    const recoveryHashString = window.location.hash.includes('?')
      ? window.location.hash.split('?')[1]
      : window.location.hash.substring(1);
    const recoveryHashParams = new URLSearchParams(recoveryHashString);
    
    const hasRecoveryParams = recoveryUrlParams.has('access_token') || recoveryHashParams.has('access_token') || 
                             recoveryUrlParams.has('token_hash') || recoveryHashParams.has('token_hash') ||
                             (recoveryUrlParams.has('type') && recoveryUrlParams.get('type') === 'recovery') ||
                             (recoveryHashParams.has('type') && recoveryHashParams.get('type') === 'recovery');
    
    // Si llegó desde enlace de recuperación, la función handleRecoveryLink() ya lo maneja
    if (hasRecoveryParams && !session?.user) {
      console.log('Token de recuperación detectado, manejado por handleRecoveryLink()');
    }
    
    // Listener para cambios de estado de autenticación
    App.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change en modales:', event, session?.user?.email);
      
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        console.log('Usuario autenticado por enlace de recuperación, abriendo modal...');
        // Limpiar la URL para evitar loops (ahora que ya se procesó el token)
        window.history.replaceState({}, document.title, window.location.pathname);
        // Usuario autenticado por enlace de recuperación, ahora sí podemos abrir el modal
        setTimeout(() => openModal('password-change-modal'), 500);
      }
    });
  
    // ==========================================
    // MANEJO DE INVITACIONES
    // ==========================================
    // NOTA: El manejo de invitaciones ahora es NATIVO y se hace en onAuthStateChange
    // El pre-procesamiento establece la sesión y onAuthStateChange detecta SIGNED_IN + type=invite
    
    // Formulario de invitación
    const invitationForm = document.getElementById('invitation-form');
    const invitationPasswordInput = document.getElementById('invitation-password');
    const invitationPasswordConfirmInput = document.getElementById('invitation-password-confirm');
    
    // Toggle de contraseñas en modal de invitación
    document.querySelectorAll('#invitation-modal .password-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const input = toggle.closest('.input-wrapper').querySelector('input');
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        const eyeOpen = toggle.querySelector('.eye-open');
        const eyeClosed = toggle.querySelector('.eye-closed');
        
        if (type === 'text') {
          eyeOpen.classList.add('hidden');
          eyeClosed.classList.remove('hidden');
        } else {
          eyeOpen.classList.remove('hidden');
          eyeClosed.classList.add('hidden');
        }
      });
    });

    // Función para validar contraseña de invitación
    function validateInvitationPassword() {
      const password = invitationPasswordInput?.value || '';
      const confirmPassword = invitationPasswordConfirmInput?.value || '';
      const acceptBtn = document.getElementById('accept-invitation-btn');
      
      // Validar longitud
      const reqLength = document.getElementById('inv-req-length');
      const hasLength = password.length >= 8;
      if(reqLength){
        reqLength.classList.toggle('met', hasLength);
        const icon = reqLength.querySelector('.requirement-icon');
        if(icon) icon.textContent = hasLength ? '✅' : '❌';
      }
      
      // Validar mayúscula
      const reqUppercase = document.getElementById('inv-req-uppercase');
      const hasUppercase = /[A-Z]/.test(password);
      if(reqUppercase){
        reqUppercase.classList.toggle('met', hasUppercase);
        const icon = reqUppercase.querySelector('.requirement-icon');
        if(icon) icon.textContent = hasUppercase ? '✅' : '❌';
      }
      
      // Validar minúscula
      const reqLowercase = document.getElementById('inv-req-lowercase');
      const hasLowercase = /[a-z]/.test(password);
      if(reqLowercase){
        reqLowercase.classList.toggle('met', hasLowercase);
        const icon = reqLowercase.querySelector('.requirement-icon');
        if(icon) icon.textContent = hasLowercase ? '✅' : '❌';
      }
      
      // Validar número
      const reqNumber = document.getElementById('inv-req-number');
      const hasNumber = /[0-9]/.test(password);
      if(reqNumber){
        reqNumber.classList.toggle('met', hasNumber);
        const icon = reqNumber.querySelector('.requirement-icon');
        if(icon) icon.textContent = hasNumber ? '✅' : '❌';
      }
      
      // Validar coincidencia
      const reqMatch = document.getElementById('inv-req-match');
      const passwordsMatch = password && confirmPassword && password === confirmPassword;
      if(reqMatch){
        reqMatch.classList.toggle('met', passwordsMatch);
        const icon = reqMatch.querySelector('.requirement-icon');
        if(icon) icon.textContent = passwordsMatch ? '✅' : '❌';
      }
      
      // Habilitar botón si todo está válido
      const allValid = hasLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;
      if(acceptBtn) acceptBtn.disabled = !allValid;
      
      return allValid;
    }

    // Validación en tiempo real para invitación
    [invitationPasswordInput, invitationPasswordConfirmInput].forEach(input => {
      if(input){
        input.addEventListener('input', () => {
          setTimeout(validateInvitationPassword, 100);
        });
      }
    });
    
    // Manejar envío del formulario de invitación
    invitationForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('invitation-email')?.value;
      const password = invitationPasswordInput?.value;
      const confirmPassword = invitationPasswordConfirmInput?.value;
      const acceptBtn = document.getElementById('accept-invitation-btn');

      // Validación
      if (!email || !password || !confirmPassword || password !== confirmPassword) {
        alert('Por favor completa todos los campos correctamente');
        return;
      }

      // Mostrar loading
      acceptBtn.disabled = true;
      acceptBtn.classList.add('loading');

      try {
        console.log('💾 Actualizando contraseña...');

        // 1. Actualizar contraseña del usuario autenticado
        const { error: updateError } = await App.supabase.auth.updateUser({
          password: password
        });

        if (updateError) throw updateError;
        console.log('✅ Contraseña actualizada');

        // 2. Cargar perfil y permisos
        await App.loadProfile();
        await App.loadPermissions();
        
        // 3. Actualizar UI
        updateRoleUI();
        await Loader.renderNavigation();

        // 4. Mostrar éxito
        document.getElementById('invitation-details')?.classList.add('hidden');
        document.getElementById('invitation-success')?.classList.remove('hidden');

        // 5. Cerrar modal y redirigir después de 2 segundos
        setTimeout(() => {
          closeModal('invitation-modal');
          
          // Limpiar
          const authSection = document.getElementById('auth-section');
          const shell = document.getElementById('shell');
          if (authSection) authSection.classList.add('hidden');
          if (shell) shell.classList.remove('hidden');

          // Redirigir a home
          window.location.hash = '#/home';
          Router.onRouteChange();
        }, 2000);

      } catch (err) {
        console.error('❌ Error:', err);
        alert('Error al completar el registro: ' + err.message);
      } finally {
        acceptBtn.disabled = false;
        acceptBtn.classList.remove('loading');
      }
    });
    
    // Botón de continuar a la aplicación
    document.getElementById('continue-to-app-btn')?.addEventListener('click', async () => {
      closeModal('invitation-modal');
      
      const authSection = document.getElementById('auth-section');
      const shell = document.getElementById('shell');
      if (authSection) authSection.classList.add('hidden');
      if (shell) shell.classList.remove('hidden');

      // Asegurar que todo esté cargado
      await App.loadProfile();
      await App.loadPermissions();
      updateRoleUI();
      await Loader.renderNavigation();

      window.location.hash = '#/home';
      Router.onRouteChange();
    });
  })();
  