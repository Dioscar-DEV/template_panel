(function(){
	async function init(){
		// Esperar a que exista el contenedor del módulo para evitar null en render temprano
		const container = await waitForElement('.users-management', 5000);

		// Verificar permisos de acceso (SOLO basado en permisos específicos)
		const hasUsersView = (window.App?.hasPerm && window.App.hasPerm('users.view'));
		const hasUsersManage = (window.App?.hasPerm && window.App.hasPerm('users.manage'));
		const canView = Boolean(hasUsersView || hasUsersManage);
		
		console.log('🔐 Verificación de acceso al módulo de usuarios:', {
			hasUsersView,
			hasUsersManage,
			canView
		});

		if(!canView){
			// Si existe el contenedor, mostrar mensaje de acceso denegado; si no, solo salir sin romper
			if(container){
				container.innerHTML = `
					<div class="access-denegado access-denied">
						<div class="access-denied-icon">🔒</div>
						<h3>Acceso Denegado</h3>
						<p>No tienes permisos para acceder a la gestión de usuarios.</p>
						<p><strong>Permisos requeridos:</strong> users.view o users.manage</p>
						<p>Contacta a tu administrador si necesitas acceso a esta sección.</p>
					</div>
				`;
			}
			return;
		}

		// Inicializar aplicación
		const app = new UsersManagementApp();
		await app.init();
	}

	// Espera reactiva a que un selector aparezca en el DOM (con timeout)
	function waitForElement(selector, timeoutMs = 3000){
		return new Promise((resolve) => {
			const existing = document.querySelector(selector);
			if(existing){ return resolve(existing); }
			const observer = new MutationObserver(() => {
				const el = document.querySelector(selector);
				if(el){ observer.disconnect(); resolve(el); }
			});
			observer.observe(document.documentElement, { childList: true, subtree: true });
			setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
		});
	}

	// Escapar texto para uso seguro en HTML
	function htmlText(value){
		const s = value == null ? '' : String(value);
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	// ===============================================
	//   APLICACIÓN PRINCIPAL
	// ===============================================
	class UsersManagementApp {
		constructor() {
			this.supabase = window.App.supabase;
			this.data = {
				users: [],
				permissions: [],
				roles: [],
				invitations: []
			};
			this.managers = {};
		}

		async init() {
			try {
				// Inicializar managers
				this.managers.tabs = new TabsManager();
				this.managers.modals = new ModalsManager();
				this.managers.tooltips = new TooltipsManager();
				this.managers.users = new UsersManager(this);
				this.managers.permissions = new PermissionsManager(this);
				this.managers.roles = new RolesManager(this);
				this.managers.invitations = new InvitationsManager(this);

				// Configurar eventos globales
				this.setupGlobalEvents();

				// Cargar datos iniciales
				await this.loadAllData();

				console.log('✅ Gestión de usuarios inicializada correctamente');
			} catch (error) {
				console.error('❌ Error inicializando gestión de usuarios:', error);
				this.showError('Error inicializando la aplicación: ' + error.message);
			}
		}

		setupGlobalEvents() {
			// Botón de actualizar global
			const globalRefresh = document.getElementById('global-refresh');
			if (globalRefresh) {
				globalRefresh.addEventListener('click', () => this.loadAllData());
			}
		}

		async loadAllData() {
			try {
				this.showGlobalLoading(true);

				// Cargar datos en paralelo con manejo individual de errores
				const loadPromises = [
					this.loadUsers().catch(err => console.warn('Error cargando usuarios:', err)),
					this.loadPermissions().catch(err => console.warn('Error cargando permisos:', err)),
					this.loadInvitations().catch(err => console.warn('Error cargando invitaciones:', err)),
					this.loadRoles().catch(err => console.warn('Error cargando roles:', err)),
					this.loadRolePermissions().catch(err => console.warn('Error cargando permisos de roles:', err))
				];

				await Promise.allSettled(loadPromises);

				// Actualizar estadísticas
				this.updateStats();

				// Renderizar contenido activo
				const activeTab = this.managers.tabs.getActiveTab();
				if (activeTab) {
					this.managers[activeTab]?.render();
				}

			} catch (error) {
				console.error('❌ Error cargando datos:', error);
				this.showError('Error cargando datos: ' + error.message);
			} finally {
				this.showGlobalLoading(false);
			}
		}

		async loadRoles(){
			const { data, error } = await this.supabase
				.from('roles')
				.select('role_key, name, description')
				.order('role_key', { ascending: true });
			if(error){ throw error; }
			// Mapear los datos de la base de datos al formato esperado por la interfaz
			this.data.roles = Array.isArray(data) && data.length > 0 ? data.map(role => ({
				key: role.role_key,
				label: role.name,
				description: role.description
			})) : [
				{ key: 'user', label: 'Usuario', description: 'Usuario básico del sistema' },
				{ key: 'doctor', label: 'Doctor', description: 'Acceso a módulos médicos' },
				{ key: 'recepcionista', label: 'Recepcionista', description: 'Acceso a citas y pacientes' },
				{ key: 'admin', label: 'Admin', description: 'Acceso administrativo con gestión de usuarios' },
				{ key: 'superadmin', label: 'Superadmin', description: 'Acceso completo al sistema' }
			];
		}

		async loadRolePermissions(){
			const { data, error } = await this.supabase
				.from('role_permissions')
				.select('role_key, perm_key')
				.order('role_key', { ascending: true });
			if(error){ throw error; }
			this.data.rolePermissions = data || [];
		}

		async loadUsers() {
			const { data, error } = await this.supabase
				.from('profiles')
				.select('user_id, email, name, role, created_at')
				.order('created_at', { ascending: false });

			if (error) throw error;
			this.data.users = data || [];
		}

		async loadPermissions() {
			const { data, error } = await this.supabase
				.from('permissions')
				.select('perm_key, name, description, module')
				.order('perm_key', { ascending: true });

			if (error) throw error;
			// Mapear los datos de la base de datos al formato esperado por la interfaz
			this.data.permissions = Array.isArray(data) && data.length > 0 ? data.map(perm => ({
				key: perm.perm_key,
				label: perm.name,
				description: perm.description,
				module: perm.module
			})) : [];
		}

		async loadInvitations() {
			try {
				// Consulta directa simple - más confiable que funciones RPC
				const { data, error } = await this.supabase
					.from('invitations')
					.select('id, email, role, invited_by, expires_at, accepted_at, created_at, name, status')
					.order('created_at', { ascending: false });
				
				if (error) {
					console.warn('Error cargando invitaciones:', error);
					this.data.invitations = [];
					return;
				}
				
				this.data.invitations = data || [];
				
			} catch (err) {
				console.warn('Excepción cargando invitaciones:', err);
				this.data.invitations = [];
			}
		}

		updateStats() {
			// Total usuarios
			const totalUsers = document.getElementById('total-users-stat');
			if (totalUsers) {
				totalUsers.textContent = this.data.users.length;
			}

			// Total permisos
			const totalPermissions = document.getElementById('total-permissions-stat');
			if (totalPermissions) {
				totalPermissions.textContent = this.data.permissions.length;
			}

			// Invitaciones pendientes
			const pendingInvitations = document.getElementById('pending-invitations-stat');
			if (pendingInvitations) {
				const pending = this.data.invitations.filter(inv => 
					!inv.accepted_at && new Date(inv.expires_at) > new Date()
				).length;
				pendingInvitations.textContent = pending;
			}

			// Actualizar indicadores de pestañas
			this.managers.tabs?.updateIndicators({
				users: this.data.users.length,
				permissions: this.data.permissions.length,
				roles: 3, // Roles predefinidos
				invitations: this.data.invitations.length
			});
		}

		showGlobalLoading(show) {
			const btn = document.getElementById('global-refresh');
			if (btn) {
				if (show) {
					btn.disabled = true;
					btn.innerHTML = `
						<div class="loading-spinner" style="width: 16px; height: 16px; margin-right: 8px;"></div>
						Actualizando...
					`;
				} else {
					btn.disabled = false;
					btn.innerHTML = `
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="23,4 23,10 17,10"></polyline>
							<polyline points="1,20 1,14 7,14"></polyline>
							<path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4L18.36,18.36A9,9,0,0,1,3.51,15"></path>
						</svg>
						Actualizar Todo
					`;
				}
			}
		}

		showError(message) {
			console.error(message);
			alert(message); // Temporal - implementar toast notifications
		}
	}

	// ===============================================
	//   GESTOR DE PESTAÑAS
	// ===============================================
	class TabsManager {
		constructor() {
			this.activeTab = 'users';
			this.setupTabEvents();
		}

		setupTabEvents() {
			const tabButtons = document.querySelectorAll('.tab-button');
			tabButtons.forEach(button => {
				button.addEventListener('click', (e) => {
					const tabId = e.currentTarget.dataset.tab;
					this.switchTab(tabId);
				});
			});
		}

		switchTab(tabId) {
			// Actualizar botones
			document.querySelectorAll('.tab-button').forEach(btn => {
				btn.classList.remove('active');
			});
			document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');

			// Actualizar paneles
			document.querySelectorAll('.tab-panel').forEach(panel => {
				panel.classList.remove('active');
			});
			document.getElementById(`${tabId}-tab`)?.classList.add('active');

			this.activeTab = tabId;

			// Notificar cambio de pestaña
			window.dispatchEvent(new CustomEvent('tabChanged', { detail: { tabId } }));
		}

		getActiveTab() {
			return this.activeTab;
		}

		updateIndicators(counts) {
			Object.entries(counts).forEach(([tab, count]) => {
				const indicator = document.getElementById(`${tab}-indicator`);
				if (indicator) {
					indicator.textContent = count;
				}
			});
		}
	}

	// ===============================================
	//   GESTOR DE MODALES
	// ===============================================
	class ModalsManager {
		constructor() {
			this.activeModal = null;
			this.previouslyFocused = null;
			this.setupModalEvents();
		}

		setupModalEvents() {
			// Cerrar modales con botones de cerrar
			document.addEventListener('click', (e) => {
				const target = e.target;
				if (!(target instanceof Element)) return;
				if (target.matches('[data-close]') || target.closest('[data-close]')) {
					const closer = target.matches('[data-close]') ? target : target.closest('[data-close]');
					const modalId = closer?.getAttribute('data-close');
					if (modalId) this.closeModal(modalId);
				}
			});

			// Cerrar modales con ESC
			document.addEventListener('keydown', (e) => {
				if (e.key === 'Escape' && this.activeModal) {
					this.closeModal(this.activeModal);
				}
			});

			// Cerrar modales clickeando el overlay
			document.addEventListener('click', (e) => {
				const target = e.target;
				if (!(target instanceof Element)) return;
				if (target.classList.contains('modal-overlay')) {
					this.closeModal(this.activeModal);
				}
			});
		}

		openModal(modalId) {
			const modal = document.getElementById(modalId);
			if (modal) {
				// Guardar el elemento previamente enfocado
				this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

				modal.classList.add('active');
				modal.setAttribute('aria-hidden', 'false');
				this.activeModal = modalId;
				document.body.style.overflow = 'hidden';

				// Enfocar el primer elemento interactivo del modal
				const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
				if (firstFocusable instanceof HTMLElement) {
					firstFocusable.focus();
				} else {
					const container = modal.querySelector('.modal-container');
					if (container instanceof HTMLElement) {
						if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
						container.focus();
					}
				}
			}
		}

		closeModal(modalId) {
			const modal = document.getElementById(modalId);
			if (modal) {
				// Si el foco está dentro del modal, retirarlo antes de ocultar
				const activeEl = document.activeElement;
				if (activeEl && modal.contains(activeEl)) {
					if (activeEl instanceof HTMLElement) activeEl.blur();
				}

				modal.classList.remove('active');
				modal.setAttribute('aria-hidden', 'true');
				this.activeModal = null;
				document.body.style.overflow = '';

				// Restaurar foco al elemento previo si existe
				if (this.previouslyFocused && document.contains(this.previouslyFocused)) {
					try { this.previouslyFocused.focus(); } catch (_) {}
				} else {
					// fallback seguro
					try { document.body.focus(); } catch (_) {}
				}
			}
		}

		resetForm(formId) {
			const form = document.getElementById(formId);
			if (form) {
				form.reset();
				// Remover clases de error
				form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
			}
		}
	}

	// ===============================================
	//   GESTOR DE TOOLTIPS
	// ===============================================
	class TooltipsManager {
		constructor() {
			this.tooltip = document.getElementById('dynamic-tooltip');
			this.setupTooltipEvents();
		}

		setupTooltipEvents() {
			// mouseenter/mouseleave no burbujean; usamos mouseover/mouseout y filtramos
			document.addEventListener('mouseover', (e) => {
				const target = e.target;
				if (!(target instanceof Element)) return;
				const element = target.closest('[data-tooltip]');
				if (element) {
					this.showTooltip(element, element.getAttribute('data-tooltip'));
				}
			});

			document.addEventListener('mouseout', (e) => {
				const target = e.target;
				if (!(target instanceof Element)) return;
				const element = target.closest('[data-tooltip]');
				if (element) {
					this.hideTooltip();
				}
			});
		}

		showTooltip(element, text) {
			if (!this.tooltip || !text) return;

			this.tooltip.textContent = text;
			this.tooltip.classList.add('show');

			const rect = element.getBoundingClientRect();
			const tooltipRect = this.tooltip.getBoundingClientRect();

			let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
			let top = rect.top - tooltipRect.height - 8;

			// Ajustar si se sale de la pantalla
			if (left < 8) left = 8;
			if (left + tooltipRect.width > window.innerWidth - 8) {
				left = window.innerWidth - tooltipRect.width - 8;
			}
			if (top < 8) {
				top = rect.bottom + 8;
			}

			this.tooltip.style.left = `${left}px`;
			this.tooltip.style.top = `${top}px`;
		}

		hideTooltip() {
			if (this.tooltip) {
				this.tooltip.classList.remove('show');
			}
		}
	}

	// ===============================================
	//   GESTOR DE USUARIOS
	// ===============================================
	class UsersManager {
		constructor(app) {
			this.app = app;
			this.filteredUsers = [];
			this.setupEvents();
		}

		setupEvents() {
			// Búsqueda
			const searchInput = document.getElementById('users-search');
			if (searchInput) {
				searchInput.addEventListener('input', () => this.filterUsers());
			}

			// Filtro por rol
			const roleFilter = document.getElementById('users-role-filter');
			if (roleFilter) {
				roleFilter.addEventListener('change', () => this.filterUsers());
			}

			// Botón crear usuario
			const createBtn = document.getElementById('create-user-btn');
			if (createBtn) {
				createBtn.addEventListener('click', () => this.showCreateUserModal());
			}

			// Escuchar cambios de pestaña
			window.addEventListener('tabChanged', (e) => {
				if (e.detail.tabId === 'users') {
					this.render();
				}
			});
		}

		render() {
			this.filterUsers();
			this.renderUsers();
		}

		filterUsers() {
			const searchTerm = document.getElementById('users-search')?.value.toLowerCase() || '';
			const roleFilter = document.getElementById('users-role-filter')?.value || '';

			this.filteredUsers = this.app.data.users.filter(user => {
				const matchesSearch = !searchTerm || 
					user.email?.toLowerCase().includes(searchTerm) ||
					user.role?.toLowerCase().includes(searchTerm);
				
				const matchesRole = !roleFilter || user.role === roleFilter;

				return matchesSearch && matchesRole;
			});
		}

		renderUsers() {
			const container = document.getElementById('users-grid');
			const loading = document.getElementById('users-loading');
			const error = document.getElementById('users-error');
			const content = document.getElementById('users-content');
			const empty = document.getElementById('users-empty');

			if (!container) return;

			// Ocultar estados
			loading?.classList.add('hidden');
			error?.classList.add('hidden');
			content?.classList.remove('hidden');

			if (this.filteredUsers.length === 0) {
				empty?.classList.remove('hidden');
				container.innerHTML = '';
				return;
			}

			empty?.classList.add('hidden');

			// Renderizar usuarios
			container.innerHTML = this.filteredUsers.map(user => this.renderUserCard(user)).join('');

			// Configurar eventos de las cards
			this.setupUserCardEvents();
		}

		renderUserCard(user) {
			const initials = this.getUserInitials(user.name || user.email || '');
			const roleClass = user.role || 'user';
			const createdDate = new Date(user.created_at).toLocaleDateString();
			const displayName = user.name || user.email || 'Sin nombre';
			
			return `
				<div class="user-card" data-user-id="${htmlText(user.user_id)}">
					<div class="user-card-header">
						<div class="user-avatar">${htmlText(initials)}</div>
						<div class="user-info">
							<h3 class="user-name" data-tooltip="Usuario: ${htmlText(user.email)}">${htmlText(displayName)}</h3>
							<p class="user-email">${htmlText(user.email || 'Sin email')}</p>
						</div>
						<div class="user-role-badge ${htmlText(roleClass)}">${htmlText(user.role || 'user')}</div>
						</div>
					<div class="user-card-body">
						<div class="user-meta">
							<span>Creado: ${htmlText(createdDate)}</span>
							<span>ID: ${htmlText((user.user_id || '').substring(0, 8))}...</span>
						</div>
					</div>
					<div class="user-card-actions">
						<button class="card-btn primary" data-action="edit" data-user-id="${htmlText(user.user_id)}">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
							</svg>
							Editar
						</button>
						<button class="card-btn secondary" data-action="permissions" data-user-id="${htmlText(user.user_id)}">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
								<circle cx="12" cy="16" r="1"></circle>
								<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
							</svg>
							Permisos
						</button>
					</div>
				</div>
			`;
		}

		setupUserCardEvents() {
			document.addEventListener('click', (e) => {
				const target = e.target;
				if (!(target instanceof Element)) return;
				const button = target.closest('[data-action]');
				if (!button) return;

				const action = button.getAttribute('data-action');
				const userId = button.getAttribute('data-user-id');

				switch (action) {
					case 'edit':
						this.showEditUserModal(userId);
						break;
					case 'permissions':
						this.showUserPermissionsModal(userId);
						break;
				}
			});
		}

		getUserInitials(nameOrEmail) {
			if (!nameOrEmail) return '?';
			
			// Si es un nombre completo (contiene espacios)
			if (nameOrEmail.includes(' ')) {
				const parts = nameOrEmail.split(' ').filter(p => p.length > 0);
				if (parts.length >= 2) {
					return (parts[0][0] + parts[1][0]).toUpperCase();
				}
				return parts[0].substring(0, 2).toUpperCase();
			}
			
			// Si es un email
			if (nameOrEmail.includes('@')) {
				const parts = nameOrEmail.split('@')[0].split('.');
				if (parts.length >= 2) {
					return (parts[0][0] + parts[1][0]).toUpperCase();
				}
				return nameOrEmail.substring(0, 2).toUpperCase();
			}
			
			// Si es un nombre simple
			return nameOrEmail.substring(0, 2).toUpperCase();
		}

		async showCreateUserModal() {
			document.getElementById('user-modal-title').textContent = 'Crear Usuario';
			document.getElementById('save-user-btn').textContent = 'Crear Usuario';
			this.app.managers.modals.resetForm('user-form');
			// Cargar y popular roles dinámicamente
			try{ await this.app.loadRoles(); }catch(_){ }
			let freshRoles = [];
			try{
				const { data, error } = await this.app.supabase.from('roles').select('role_key, name').order('role_key', { ascending: true });
				console.log('[Users][Create] roles fetch', { data, error });
				if(Array.isArray(data) && data.length > 0){ 
					freshRoles = data.map(r => ({ key: r.role_key, label: r.name }));
				}
			}catch(err){ console.warn('[Users][Create] roles fetch exception', err); }
			if(freshRoles.length){ this.app.data.roles = freshRoles; }
			const form = document.getElementById('user-form');
			const roleSelect = form?.querySelector('#user-role');
			if(roleSelect){
				console.log('[Users][Create] populateRoleSelect source', freshRoles.length ? freshRoles : this.app.data.roles);
				console.log('[Users][Create] roleSelect tag', roleSelect?.tagName);
				this.populateRoleSelect(roleSelect, undefined, freshRoles.length ? freshRoles : this.app.data.roles);
				console.log('[Users][Create] select options count', (roleSelect instanceof HTMLSelectElement) ? roleSelect.options.length : 'no-options-prop');
				this.tempSelectedRole = null;
				try{ 
					roleSelect.addEventListener('change', (e) => { 
						this.tempSelectedRole = e.target?.value || null;
						// Mostrar/ocultar campos de doctor según el rol seleccionado
						this.toggleDoctorFields(e.target?.value === 'doctor');
					}); 
				}catch(_){ }
			}
			
			if(form){ form.dataset.mode = 'create'; }
			this.configureUserFormForMode('create');
			this.app.managers.modals.openModal('user-modal');
			
			
			this.ensureUserFormBound();
		}

		async showEditUserModal(userId) {
			const user = this.app.data.users.find(u => u.user_id === userId);
			if (!user) return;

			// Verificar permisos para editar usuarios
			const hasUsersManage = window.App?.hasPerm && window.App.hasPerm('users.manage');
			if (!hasUsersManage) {
				alert('❌ No tienes permisos para editar usuarios. Se requiere el permiso "users.manage"');
				return;
			}

			document.getElementById('user-modal-title').textContent = 'Editar Usuario';
			document.getElementById('save-user-btn').textContent = 'Guardar Cambios';
			
			// Llenar formulario
			document.getElementById('user-email').value = user.email || '';
			try{ await this.app.loadRoles(); }catch(_){ }
			let freshRoles = [];
			try{
                const { data, error } = await this.app.supabase.from('roles').select('key, label').order('key', { ascending: true });
                console.log('[Users][Edit] roles fetch', { data, error });
                if(Array.isArray(data) && data.length > 0){ freshRoles = data; }
			}catch(err){ console.warn('[Users][Edit] roles fetch exception', err); }
			if(freshRoles.length){ this.app.data.roles = freshRoles; }
			const formEl2 = document.getElementById('user-form');
			const roleSelect = formEl2?.querySelector('#user-role');
			if(roleSelect){
				console.log('[Users][Edit] populateRoleSelect source', freshRoles.length ? freshRoles : this.app.data.roles);
				console.log('[Users][Edit] roleSelect tag', roleSelect?.tagName);
				this.populateRoleSelect(roleSelect, user.role || 'viewer', freshRoles.length ? freshRoles : this.app.data.roles);
				console.log('[Users][Edit] select options count', (roleSelect instanceof HTMLSelectElement) ? roleSelect.options.length : 'no-options-prop');
				this.tempSelectedRole = null;
				try{
					const formEl = document.getElementById('user-form');
					const scopedSelect = formEl?.querySelector('#user-role');
					(scopedSelect || roleSelect).addEventListener('change', (e) => {
						this.tempSelectedRole = e.target?.value || null;
					});
				}catch(_){ }
			}
			document.getElementById('user-id').value = user.user_id;

			this.configureUserFormForMode('edit');
			// Forzar foco fuera del botón de cerrar para evitar aria-hidden warnings
			try{
				const modal = document.getElementById('user-modal');
				const first = modal?.querySelector('select, input, button');
				if(first instanceof HTMLElement){ first.focus(); }
			}catch(_){ }
			this.app.managers.modals.openModal('user-modal');
			// Debug de selección de rol
			try{
				const sel = document.getElementById('user-role');
				if(sel && !sel.dataset.roleDebug){
					sel.addEventListener('change', (e) => {
						const t = e.target;
						if(t){ console.log('[Users][Edit] user-role changed to', t.value); }
					});
					sel.dataset.roleDebug = '1';
				}
			}catch(_){ }
			const form = document.getElementById('user-form');
			if(form){ form.dataset.mode = 'edit'; }
			this.ensureUserFormBound();
		}

		configureUserFormForMode(mode){
			const form = document.getElementById('user-form');
			if(!form){ return; }
			const nameInput = form.querySelector('#user-name');
			const emailInput = form.querySelector('#user-email');
			const nameGroup = nameInput?.closest('.form-group');
			const emailGroup = emailInput?.closest('.form-group');
			if(mode === 'create'){
				if(nameInput){ nameInput.disabled = false; nameInput.required = true; }
				if(emailInput){ emailInput.disabled = false; emailInput.required = true; }
				if(nameGroup instanceof HTMLElement){ nameGroup.style.display = ''; }
				if(emailGroup instanceof HTMLElement){ emailGroup.style.display = ''; }
			}else{
				if(nameInput){ nameInput.disabled = true; nameInput.required = false; }
				if(emailInput){ emailInput.disabled = true; emailInput.required = false; }
				if(nameGroup instanceof HTMLElement){ nameGroup.style.display = 'none'; }
				if(emailGroup instanceof HTMLElement){ emailGroup.style.display = 'none'; }
			}
		}


		// Función para mostrar/ocultar campos específicos de doctor
		toggleDoctorFields(showDoctorFields) {
			console.log('[Users] toggleDoctorFields llamado con:', showDoctorFields);
			
			const doctorFields = document.querySelectorAll('.doctor-only');
			const nameGroup = document.getElementById('user-name-group');
			const nameInput = document.getElementById('user-name');
			
			console.log('[Users] Campos de doctor encontrados:', doctorFields.length);
			console.log('[Users] Grupo de nombre encontrado:', !!nameGroup);
			console.log('[Users] Input de nombre encontrado:', !!nameInput);
			
			doctorFields.forEach((field, index) => {
				console.log(`[Users] Procesando campo ${index}:`, field.id);
				if (showDoctorFields) {
					field.classList.remove('hidden');
					field.classList.add('show');
					console.log(`[Users] Mostrando campo ${field.id}`);
				} else {
					field.classList.add('hidden');
					field.classList.remove('show');
					console.log(`[Users] Ocultando campo ${field.id}`);
				}
			});

			// Manejar el campo de nombre completo cuando se selecciona doctor
			if (nameGroup && nameInput) {
				if (showDoctorFields) {
					// Ocultar y remover required del campo de nombre completo
					nameGroup.style.display = 'none';
					nameInput.required = false;
					console.log('[Users] Ocultando campo nombre completo y removiendo required');
				} else {
					// Mostrar y restaurar required del campo de nombre completo
					nameGroup.style.display = 'block';
					nameInput.required = true;
					console.log('[Users] Mostrando campo nombre completo y restaurando required');
				}
			}
		}

		// Función de debug para probar manualmente
		debugToggleDoctorFields() {
			console.log('[Users] Debug: Probando toggleDoctorFields...');
			const roleSelect = document.getElementById('user-role');
			if (roleSelect) {
				console.log('[Users] Debug: roleSelect encontrado, valor actual:', roleSelect.value);
				this.toggleDoctorFields(roleSelect.value === 'doctor');
			} else {
				console.error('[Users] Debug: roleSelect no encontrado');
			}
		}

		ensureUserFormBound(){
			const form = document.getElementById('user-form');
			const saveBtn = document.getElementById('save-user-btn');
			if(!form || !saveBtn){ return; }
			if(form.dataset.bound){ return; }
			form.addEventListener('submit', async (e) => {
				e.preventDefault();
				saveBtn.disabled = true;
				try{
					const mode = form.dataset.mode || 'edit';
					if(mode === 'edit'){
						// Verificar permisos antes de procesar el cambio de rol
						const hasUsersManage = window.App?.hasPerm && window.App.hasPerm('users.manage');
						if (!hasUsersManage) {
							throw new Error('No tienes permisos para editar usuarios. Se requiere el permiso "users.manage"');
						}

						const id = document.getElementById('user-id').value;
						const roleEl = document.getElementById('user-role');
						const roleFormEl = form.querySelector('#user-role');
						const role = (this.tempSelectedRole ?? roleFormEl?.value ?? roleEl?.value ?? '').trim();
						let optionsSnapshot = [];
						try{
							const opts = roleEl?.options ? Array.from(roleEl.options) : [];
							optionsSnapshot = opts.map(o => ({ value: o.value, text: o.text, selected: o.selected }));
						}catch(_){ optionsSnapshot = []; }
						console.log('[Users] Submit edit mode - selected role', {
							role,
							byGetElement: roleEl?.value,
							byFormQuery: roleFormEl?.value,
							selectedIndex: roleEl?.selectedIndex,
							options: optionsSnapshot
						});
						if(!id || !role){ throw new Error('Usuario o rol inválido'); }
						console.log('[Users] Intentando actualizar rol', { userId: id, newRole: role });
						const { data, error } = await this.app.supabase
							.from('profiles')
							.update({ role })
							.eq('user_id', id)
							.select('user_id, email, role');
						console.log('[Users] Resultado update profiles', { data, error });
						if(error){
							console.error('[Users] Error al actualizar rol', error);
							throw error;
						}
						if(!Array.isArray(data) || data.length === 0){
							console.warn('[Users] Update no afectó filas. Verifica RLS (users.manage/superadmin) o user_id inexistente.', { userId: id });
						}
						await this.app.loadUsers();
						this.render();
						this.app.managers.modals.closeModal('user-modal');
					} else {
						// create => crear invitación usando Supabase Auth Admin
						const email = (form.querySelector('#user-email')?.value || '').trim();
						const role = (form.querySelector('#user-role')?.value || '').trim();
						if(!email || !role){ throw new Error('Email y rol son requeridos'); }
						
						// Obtener token de sesión actual
						const { data: { session } } = await this.app.supabase.auth.getSession();
						if (!session) {
							throw new Error('No hay sesión activa');
						}

						// Preparar datos según el rol
						let userData = {
							email: email,
							role: role
						};

						// Si es doctor, obtener datos específicos y concatenar nombre completo
						if (role === 'doctor') {
							const nombre = (form.querySelector('#doctor-nombre')?.value || '').trim();
							const apellido = (form.querySelector('#doctor-apellido')?.value || '').trim();
							const cedula = (form.querySelector('#doctor-cedula')?.value || '').trim();
							const telefono = (form.querySelector('#doctor-telefono')?.value || '').trim();

							if (!nombre || !apellido || !cedula) {
								throw new Error('Para doctores, nombre, apellido y cédula son requeridos');
							}

							userData.name = `${nombre} ${apellido}`;
							userData.doctorData = {
								cedula_doctor: cedula,
								nombre: nombre,
								apellido: apellido,
								email: email,
								telefono: telefono || null
							};
						} else {
							// Para otros roles, usar el campo de nombre completo
							const name = (form.querySelector('#user-name')?.value || '').trim();
							if (!name) {
								throw new Error('Nombre completo es requerido');
							}
							userData.name = name;
						}
						
						// Llamar a Edge Function para crear invitación y enviar email
						const { data: result, error: edgeError } = await this.app.supabase.functions.invoke('invite-user', {
							body: {
								email: userData.email,
								role: userData.role,
								name: userData.name
							}
						});
						
						if (edgeError) {
							throw new Error('Error al enviar invitación: ' + edgeError.message);
						}
						
						if (result?.error) {
							throw new Error(result.error || 'Error al crear invitación');
						}
						
						await this.app.loadUsers();
						this.render();
						this.app.managers.modals.closeModal('user-modal');
						
						// Mostrar confirmación de envío
						alert(`✅ Invitación enviada exitosamente a ${email}. El usuario recibirá un email para completar su registro.`);
					}
				}catch(err){ alert('Error: ' + (err?.message || err)); }
				finally{ saveBtn.disabled = false; }
			});
			form.dataset.bound = '1';
		}

		populateRoleSelect(selectEl, selectedKey, rolesSource){
			const base = Array.isArray(rolesSource) && rolesSource.length > 0
				? rolesSource
				: (Array.isArray(this.app.data.roles) && this.app.data.roles.length > 0
					? this.app.data.roles
					: [
						{ key: 'user', label: 'Usuario' },
						{ key: 'doctor', label: 'Doctor' },
						{ key: 'recepcionista', label: 'Recepcionista' },
						{ key: 'admin', label: 'Admin' },
						{ key: 'superadmin', label: 'Superadmin' }
					]);
			
			// Filtrar roles según el rol del usuario actual
			const currentUserRole = window.App.getRole();
			let allowedRoles = base;
			
			if (currentUserRole === 'admin') {
				// Los admin no pueden crear superadmin
				allowedRoles = base.filter(r => r.key !== 'superadmin');
			}
			// Los superadmin pueden crear cualquier rol (no se filtra)
			
			const roles = allowedRoles
				.filter(r => r && r.key)
				.reduce((acc, r) => { if(!acc.find(x => x.key === r.key)) acc.push(r); return acc; }, [])
				.sort((a,b) => a.key.localeCompare(b.key));
			console.log('[Users] populateRoleSelect normalized roles', roles);
			// Reconstruir opciones vía DOM para evitar issues con innerHTML
			while(selectEl.firstChild){ selectEl.removeChild(selectEl.firstChild); }
			const opt0 = document.createElement('option');
			opt0.value = '';
			opt0.textContent = 'Seleccionar rol';
			selectEl.appendChild(opt0);
			roles.forEach(r => {
				const opt = document.createElement('option');
				opt.value = r.key;
				opt.textContent = `${r.label} (${r.key})`;
				selectEl.appendChild(opt);
			});
			if(selectedKey){ selectEl.value = selectedKey; }
			console.log('[Users] populateRoleSelect options length', selectEl.options ? selectEl.options.length : 'no-options-prop');
		}

		async showUserPermissionsModal(userId) {
			const user = this.app.data.users.find(u => u.user_id === userId);
			if (!user) return;

			document.getElementById('user-permissions-title').textContent = `Permisos de ${user.email}`;
			document.getElementById('user-permissions-subtitle').textContent = `Rol: ${user.role}`;
			document.getElementById('current-user-role').textContent = user.role;

			// Cargar permisos actuales del usuario
			try {
				const { data: userPerms, error } = await this.app.supabase
					.from('user_permissions')
					.select('perm_key')
					.eq('user_id', userId);
				
				if (error) throw error;
				
				const currentPerms = new Set((userPerms || []).map(p => p.perm_key));
				
				// Renderizar permisos disponibles
				this.renderUserPermissions(currentPerms);
				
			} catch (err) {
				console.error('Error cargando permisos del usuario:', err);
				alert('Error cargando permisos del usuario: ' + err.message);
			}

			this.app.managers.modals.openModal('user-permissions-modal');
		}

		renderUserPermissions(currentPerms) {
			const container = document.getElementById('custom-permissions-list');
			if (!container) return;

			const permissions = this.app.data.permissions || [];
			
			container.innerHTML = permissions.map(perm => `
				<label class="permission-item">
					<input type="checkbox" data-perm="${perm.key}" ${currentPerms.has(perm.key) ? 'checked' : ''} />
					<div class="permission-item-info">
						<div class="permission-item-key">${perm.key}</div>
						<div class="permission-item-label">${perm.label}</div>
						<div class="permission-item-desc">${perm.description || 'Sin descripción'}</div>
					</div>
				</label>
			`).join('');

			// Configurar botón de guardar
			const saveBtn = document.getElementById('save-user-permissions-btn');
			if (saveBtn && !saveBtn.dataset.bound) {
				saveBtn.addEventListener('click', async () => {
					saveBtn.disabled = true;
					try {
						const checks = container.querySelectorAll('input[type="checkbox"]');
						const selected = [];
						checks.forEach(ch => { 
							if (ch.checked) { 
								selected.push(ch.getAttribute('data-perm')); 
							} 
						});

						const userId = this.app.data.users.find(u => 
							document.getElementById('user-permissions-title').textContent.includes(u.email)
						)?.user_id;

						if (!userId) throw new Error('Usuario no encontrado');

						// Eliminar permisos actuales
						await this.app.supabase
							.from('user_permissions')
							.delete()
							.eq('user_id', userId);

						// Insertar nuevos permisos
						if (selected.length > 0) {
							const rows = selected.map(permKey => ({ 
								user_id: userId, 
								perm_key: permKey 
							}));
							await this.app.supabase
								.from('user_permissions')
								.insert(rows);
						}

						alert('Permisos actualizados correctamente');
						this.app.managers.modals.closeModal('user-permissions-modal');
					} catch (err) {
						alert('Error actualizando permisos: ' + err.message);
					} finally {
						saveBtn.disabled = false;
					}
				});
				saveBtn.dataset.bound = '1';
			}
		}

		showInvitationModal(email, inviteUrl) {
			// Crear modal dinámico para mostrar el enlace de invitación
			const modalHtml = `
				<div class="modal-overlay active" id="invitation-success-modal">
					<div class="modal-container">
						<div class="modal-header">
							<h3>✅ Invitación Creada</h3>
							<button class="modal-close" data-close-modal>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							</button>
						</div>
						<div class="modal-content">
							<div style="text-align: center; margin-bottom: 20px;">
								<div style="width: 64px; height: 64px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
									<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<path d="M9 12l2 2 4-4"></path>
										<circle cx="12" cy="12" r="10"></circle>
									</svg>
								</div>
								<h4 style="margin: 0 0 8px; color: var(--text);">Invitación creada para ${email}</h4>
								<p style="margin: 0; color: var(--muted);">Comparte el enlace de abajo con el usuario para que complete su registro</p>
							</div>
							
							<div style="background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
								<label style="display: block; font-weight: 600; margin-bottom: 8px; color: var(--text);">Enlace de invitación:</label>
								<div style="display: flex; gap: 8px; align-items: center;">
									<input type="text" value="${inviteUrl}" readonly style="flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-family: monospace; font-size: 12px;">
									<button data-copy-link style="padding: 8px 12px; background: var(--brand); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
										Copiar
									</button>
								</div>
							</div>
							
							<div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px;">
								<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
										<circle cx="12" cy="12" r="10"></circle>
										<path d="M9,12l2,2 4,-4"></path>
									</svg>
									<strong style="color: #10b981;">Próximos pasos:</strong>
								</div>
								<ul style="margin: 0; padding-left: 20px; color: var(--text);">
									<li>Comparte este enlace con el usuario</li>
									<li>El usuario hará clic en el enlace para registrarse</li>
									<li>Una vez registrado, aparecerá en la lista de usuarios</li>
								</ul>
							</div>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn-secondary" data-close-modal>Cerrar</button>
						</div>
					</div>
				</div>
			`;
			
			// Insertar el modal en el DOM
			document.body.insertAdjacentHTML('beforeend', modalHtml);
			
			// Configurar event listeners para el modal
			const modal = document.getElementById('invitation-success-modal');
			if (modal) {
				// Cerrar modal
				const closeBtn = modal.querySelector('[data-close-modal]');
				if (closeBtn) {
					closeBtn.addEventListener('click', () => modal.remove());
				}
				
				// Copiar enlace
				const copyBtn = modal.querySelector('[data-copy-link]');
				if (copyBtn) {
					copyBtn.addEventListener('click', () => {
						navigator.clipboard.writeText(inviteUrl).then(() => {
							copyBtn.textContent = '¡Copiado!';
							setTimeout(() => copyBtn.textContent = 'Copiar', 2000);
						}).catch(() => {
							console.log('No se pudo copiar al portapapeles');
						});
					});
				}
			}
			
			// Auto-copiar al portapapeles
			navigator.clipboard.writeText(inviteUrl).catch(() => {
				console.log('No se pudo copiar automáticamente al portapapeles');
			});
		}
	}

	// ===============================================
	//   GESTOR DE PERMISOS
	// ===============================================
	class PermissionsManager {
		constructor(app) {
			this.app = app;
			this.setupEvents();
		}

		setupEvents() {
			// Búsqueda
			const searchInput = document.getElementById('permissions-search');
			if (searchInput) {
				searchInput.addEventListener('input', () => this.render());
			}

			// Botón crear permiso
			const createBtn = document.getElementById('create-permission-btn');
			if (createBtn) {
				createBtn.addEventListener('click', () => this.showCreatePermissionModal());
			}

			// Escuchar cambios de pestaña
			window.addEventListener('tabChanged', (e) => {
				if (e.detail.tabId === 'permissions') {
					this.render();
				}
			});
		}

		render() {
			const searchTerm = document.getElementById('permissions-search')?.value.toLowerCase() || '';
			
			const filteredPermissions = this.app.data.permissions.filter(perm => {
				return !searchTerm || 
					perm.key.toLowerCase().includes(searchTerm) ||
					perm.label.toLowerCase().includes(searchTerm) ||
					perm.description?.toLowerCase().includes(searchTerm);
			});

			this.renderPermissions(filteredPermissions);
		}

		renderPermissions(permissions) {
			const container = document.getElementById('permissions-grid');
			const loading = document.getElementById('permissions-loading');
			const content = document.getElementById('permissions-content');

			if (!container) return;

			loading?.classList.add('hidden');
			content?.classList.remove('hidden');

			if (permissions.length === 0) {
				container.innerHTML = `
					<div class="empty-state">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
							<circle cx="12" cy="16" r="1"></circle>
							<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
						</svg>
						<h3>No hay permisos</h3>
						<p>No se encontraron permisos que coincidan con tu búsqueda</p>
					</div>
				`;
					return;
				}

			container.innerHTML = permissions.map(perm => this.renderPermissionCard(perm)).join('');
		}

		renderPermissionCard(permission) {
			return `
				<div class="permission-card" data-permission-key="${htmlText(permission.key)}">
					<div class="permission-header">
						<div class="permission-key">${htmlText(permission.key)}</div>
					</div>
					<div class="permission-label">${htmlText(permission.label)}</div>
					<p class="permission-description">${htmlText(permission.description || 'Sin descripción')}</p>
				</div>
			`;
		}

		showCreatePermissionModal() {
			document.getElementById('permission-modal-title').textContent = 'Crear Permiso';
			document.getElementById('save-permission-btn').textContent = 'Crear Permiso';
			this.app.managers.modals.resetForm('permission-form');
			this.app.managers.modals.openModal('permission-modal');
			
			// Configurar el formulario de permisos
			const form = document.getElementById('permission-form');
			const saveBtn = document.getElementById('save-permission-btn');
			if(form && saveBtn && !form.dataset.bound){
				form.addEventListener('submit', async (e) => {
					e.preventDefault();
					saveBtn.disabled = true;
					try{
						const key = document.getElementById('permission-key').value.trim();
						const label = document.getElementById('permission-label').value.trim();
						const description = document.getElementById('permission-description').value.trim();
						if(!key || !label){ throw new Error('Completa clave y nombre del permiso'); }
						
						// Extraer módulo de la clave (ej: "users.create" -> "users")
						const module = key.split('.')[0] || 'general';
						
						const { error } = await this.app.supabase.from('permissions').insert({ 
							perm_key: key, 
							name: label, 
							description: description,
							module: module
						});
						if(error){ throw error; }
						await this.app.loadPermissions();
						this.render();
						this.app.managers.modals.closeModal('permission-modal');
					}catch(err){ alert('Error creando permiso: ' + (err?.message || err)); }
					finally{ saveBtn.disabled = false; }
				});
				form.dataset.bound = '1';
			}
		}
	}

	// ===============================================
	//   GESTOR DE ROLES
	// ===============================================
	class RolesManager {
		constructor(app) {
			this.app = app;
			this.setupEvents();
		}

		setupEvents() {
			// Botón crear rol
			const createBtn = document.getElementById('create-role-btn');
			if (createBtn) {
				createBtn.addEventListener('click', () => this.showCreateRoleModal());
			}

			// Escuchar cambios de pestaña
			window.addEventListener('tabChanged', (e) => {
				if (e.detail.tabId === 'roles') {
					this.render();
				}
			});

			// Delegación para abrir el editor de permisos de un rol (bind una sola vez)
			if(!window.__users_roles_delegation_bound){
				document.addEventListener('click', (e) => {
					const target = e.target;
					if(!(target instanceof Element)) return;
					const btn = target.closest('[data-action="edit-role-perms"]');
					if(!btn) return;
					const roleKey = btn.getAttribute('data-role-key');
					if(roleKey){ this.openRolePermissions(roleKey); }
				});
				window.__users_roles_delegation_bound = true;
			}
		}

		render() {
			this.renderRoles();
		}

		renderRoles() {
			const container = document.getElementById('roles-grid');
			const loading = document.getElementById('roles-loading');
			const content = document.getElementById('roles-content');

			if (!container) return;

			loading?.classList.add('hidden');
			content?.classList.remove('hidden');

			const roles = Array.isArray(this.app.data.roles) && this.app.data.roles.length > 0
				? this.app.data.roles
				: [
				{ key: 'viewer', label: 'Viewer', description: 'Acceso de solo lectura a módulos básicos' },
				{ key: 'admin', label: 'Admin', description: 'Acceso administrativo con gestión de usuarios' },
				{ key: 'superadmin', label: 'Superadmin', description: 'Acceso completo al sistema' }
			];

			container.innerHTML = roles.map(role => this.renderRoleCard(role)).join('');
		}

		renderRoleCard(role) {
			// Obtener el número de permisos del rol desde role_permissions
			const rolePermissions = this.app.data.rolePermissions || [];
			const rolePerms = rolePermissions.filter(rp => rp.role_key === role.key);
			const permCount = rolePerms.length;
			
			return `
				<div class="permission-card" data-role-key="${htmlText(role.key)}">
					<div class="permission-header">
						<div class="permission-key">${htmlText(role.key)}</div>
						<div class="permission-count" style="font-size: 0.8em; opacity: 0.7; margin-left: auto;">
							${permCount} permisos
						</div>
					</div>
					<div class="permission-label">${htmlText(role.label)}</div>
					<p class="permission-description">${htmlText(role.description)}</p>
					<div class="permission-actions" style="margin-top:8px; display:flex; gap:8px;">
						<button class="card-btn primary" data-action="edit-role-perms" data-role-key="${htmlText(role.key)}">
							${permCount > 0 ? 'Editar Permisos' : 'Asignar Permisos'}
						</button>
					</div>
				</div>
			`;
		}

		showCreateRoleModal() {
			this.app.managers.modals.resetForm('role-form');
			this.app.managers.modals.openModal('role-modal');
			const form = document.getElementById('role-form');
			const saveBtn = document.getElementById('save-role-btn');
			if(form && saveBtn && !form.dataset.bound){
				form.addEventListener('submit', async (e) => {
					e.preventDefault();
					saveBtn.disabled = true;
					try{
						const key = document.getElementById('role-key').value.trim();
						const label = document.getElementById('role-label').value.trim();
						const description = document.getElementById('role-description').value.trim();
						if(!key || !label){ throw new Error('Completa clave y nombre del rol'); }
						const { error } = await this.app.supabase.from('roles').insert({ 
							role_key: key, 
							name: label, 
							description: description 
						});
						if(error){ throw error; }
						await this.app.loadRoles();
						this.render();
						this.app.managers.modals.closeModal('role-modal');
					}catch(err){ alert('Error creando rol: ' + (err?.message || err)); }
					finally{ saveBtn.disabled = false; }
				});
				form.dataset.bound = '1';
			}
		}

		async openRolePermissions(roleKey){
			const title = document.getElementById('role-permissions-title');
			const list = document.getElementById('role-permissions-list-role');
			const search = document.getElementById('role-permissions-search');
			const saveBtn = document.getElementById('save-role-permissions-btn');
			const hidden = document.getElementById('current-role-key');
			if(!title || !list || !saveBtn || !hidden){ return; }
			hidden.value = roleKey;
			title.textContent = `Permisos del rol: ${roleKey}`;

			// Cargar permisos actuales del rol desde role_permissions
			const current = new Set();
			try {
				const { data: rolePermissions, error } = await this.app.supabase
					.from('role_permissions')
					.select('perm_key')
					.eq('role_key', roleKey);
				
				if (error) throw error;
				rolePermissions.forEach(rp => current.add(rp.perm_key));
			} catch (error) {
				console.error('Error cargando permisos del rol:', error);
			}

			// Render checklist con catálogo, cargar si no está
			if(!Array.isArray(this.app.data.permissions) || this.app.data.permissions.length === 0){
				try{
					await this.app.loadPermissions();
				}catch(_){ /* noop */ }
			}
			const all = this.app.data.permissions || [];
			function render(filter=''){
				const items = all.filter(p => !filter || p.key.toLowerCase().includes(filter) || p.label.toLowerCase().includes(filter));
				list.innerHTML = items.map(p => `
					<label class="perm-item" style="display:flex; align-items:center; gap:8px; padding:6px 0;">
						<input type="checkbox" data-perm="${p.key}" ${current.has(p.key) ? 'checked' : ''} />
						<span style="font-weight:600; min-width:220px;">${p.key}</span>
						<span style="opacity:0.8;">${p.label}</span>
					</label>
				`).join('');
			}
			render();
			if(search && !search.dataset.bound){
				search.addEventListener('input', (e) => {
					render((e.target.value || '').toLowerCase());
				});
				search.dataset.bound = '1';
			}

			if(!saveBtn.dataset.bound){
				saveBtn.addEventListener('click', async () => {
					saveBtn.disabled = true;
					try{
						// Recoger selección & calcular delta (estrategia: reemplazo total)
						const checks = list.querySelectorAll('input[type="checkbox"][data-perm]');
						const selected = [];
						checks.forEach(ch => { if(ch.checked){ selected.push(ch.getAttribute('data-perm')); } });
						
						// Eliminar todos los permisos actuales del rol
						const { error: deleteError } = await this.app.supabase
							.from('role_permissions')
							.delete()
							.eq('role_key', roleKey);
						
						if (deleteError) throw deleteError;
						
						// Insertar los nuevos permisos seleccionados
						if (selected.length > 0) {
							const rolePermissions = selected.map(permKey => ({
								role_key: roleKey,
								perm_key: permKey
							}));
							
							const { error: insertError } = await this.app.supabase
								.from('role_permissions')
								.insert(rolePermissions);
							
							if (insertError) throw insertError;
						}
						
						alert(`Permisos del rol "${roleKey}" actualizados correctamente. Se asignaron ${selected.length} permisos.`);
						this.app.managers.modals.closeModal('role-permissions-modal');
					}catch(err){ 
						console.error('Error guardando permisos del rol:', err);
						alert('Error guardando permisos del rol: ' + (err?.message || err)); 
					}
					finally{ saveBtn.disabled = false; }
				});
				saveBtn.dataset.bound = '1';
			}

			this.app.managers.modals.openModal('role-permissions-modal');
		}

	}

	// ===============================================
	//   GESTOR DE INVITACIONES
	// ===============================================
	class InvitationsManager {
		constructor(app) {
			this.app = app;
			this.setupEvents();
		}

		setupEvents() {
			// Búsqueda
			const searchInput = document.getElementById('invitations-search');
			if (searchInput) {
				searchInput.addEventListener('input', () => this.render());
			}

			// Filtro por estado
			const statusFilter = document.getElementById('invitations-status-filter');
			if (statusFilter) {
				statusFilter.addEventListener('change', () => this.render());
			}

			// Botón enviar invitación
			const sendBtn = document.getElementById('send-invitation-btn');
			if (sendBtn) {
				sendBtn.addEventListener('click', () => this.showSendInvitationModal());
			}

			// Event listener para botones de cancelar invitación
			document.addEventListener('click', (e) => {
				const target = e.target;
				if (!(target instanceof Element)) return;
				const button = target.closest('.cancel-invitation-btn');
				if (!button) return;
				
				const invitationId = button.getAttribute('data-invitation-id');
				const email = button.getAttribute('data-email');
				
				if (invitationId && email) {
					this.cancelInvitation(invitationId, email);
				}
			});

			// Escuchar cambios de pestaña
			window.addEventListener('tabChanged', (e) => {
				if (e.detail.tabId === 'invitations') {
					this.render();
				}
			});
		}

		render() {
			const searchTerm = document.getElementById('invitations-search')?.value.toLowerCase() || '';
			const statusFilter = document.getElementById('invitations-status-filter')?.value || '';

			const filteredInvitations = this.app.data.invitations.filter(inv => {
				const matchesSearch = !searchTerm || inv.email.toLowerCase().includes(searchTerm);
				
				let matchesStatus = true;
				if (statusFilter === 'pending') {
					matchesStatus = !inv.accepted_at && new Date(inv.expires_at) > new Date();
				} else if (statusFilter === 'expired') {
					matchesStatus = !inv.accepted_at && new Date(inv.expires_at) <= new Date();
				} else if (statusFilter === 'accepted') {
					matchesStatus = !!inv.accepted_at;
				}

				return matchesSearch && matchesStatus;
			});

			this.renderInvitations(filteredInvitations);
		}

		renderInvitations(invitations) {
			const container = document.getElementById('invitations-grid');
			const loading = document.getElementById('invitations-loading');
			const content = document.getElementById('invitations-content');

			if (!container) return;

			loading?.classList.add('hidden');
			content?.classList.remove('hidden');

			if (invitations.length === 0) {
				container.innerHTML = `
					<div class="empty-state">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
							<polyline points="22,6 12,13 2,6"></polyline>
						</svg>
						<h3>No hay invitaciones</h3>
						<p>No se encontraron invitaciones que coincidan con tu búsqueda</p>
					</div>
				`;
				return;
			}

			container.innerHTML = invitations.map(inv => this.renderInvitationCard(inv)).join('');
		}

		renderInvitationCard(invitation) {
			const status = this.getInvitationStatus(invitation);
			const createdDate = new Date(invitation.created_at).toLocaleDateString();
			const expiresDate = new Date(invitation.expires_at).toLocaleDateString();
			
			// Solo mostrar botón de cancelar para superadmin y si la invitación no está aceptada
			const canCancel = window.App?.profile?.role === 'superadmin' && !invitation.accepted_at;
			const cancelButton = canCancel ? `
				<div class="permission-actions">
					<button class="btn-action danger small cancel-invitation-btn" 
							data-invitation-id="${invitation.id}" 
							data-email="${invitation.email}"
							title="Cancelar invitación y eliminar usuario">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="15" y1="9" x2="9" y2="15"></line>
							<line x1="9" y1="9" x2="15" y2="15"></line>
						</svg>
						Cancelar
					</button>
				</div>
			` : '';

			return `
				<div class="permission-card" data-invitation-id="${invitation.id}">
					<div class="permission-header">
						<div class="permission-key">${invitation.email}</div>
						<div class="user-role-badge ${status.class}">${status.label}</div>
					</div>
					<div class="permission-label">Rol: ${invitation.role}</div>
					<p class="permission-description">
						Creada: ${createdDate}<br>
						Expira: ${expiresDate}
						${invitation.accepted_at ? `<br>Aceptada: ${new Date(invitation.accepted_at).toLocaleDateString()}` : ''}
					</p>
					${cancelButton}
				</div>
			`;
		}

		getInvitationStatus(invitation) {
			if (invitation.accepted_at) {
				return { class: 'viewer', label: 'Aceptada' };
			}
			if (new Date(invitation.expires_at) <= new Date()) {
				return { class: 'superadmin', label: 'Expirada' };
			}
			return { class: 'admin', label: 'Pendiente' };
		}

		showSendInvitationModal() {
			this.app.managers.modals.resetForm('invitation-form');
			this.app.managers.modals.openModal('invitation-modal');
			
			// Configurar el formulario de invitaciones
			const form = document.getElementById('invitation-form');
			const saveBtn = document.getElementById('send-invitation-btn-modal');
			if(form && saveBtn && !form.dataset.bound){
				form.addEventListener('submit', async (e) => {
					e.preventDefault();
					saveBtn.disabled = true;
					saveBtn.textContent = 'Enviando...';
					
					try{
						const email = document.getElementById('invitation-email').value.trim();
						const role = document.getElementById('invitation-role').value.trim();
						const name = document.getElementById('invitation-name')?.value.trim() || '';
						
						if(!email || !role){ 
							throw new Error('Email y rol son requeridos'); 
						}
						
						// Obtener token de sesión actual
						const { data: { session } } = await this.app.supabase.auth.getSession();
						if (!session) {
							throw new Error('No hay sesión activa');
						}
						
						// Llamar a Edge Function para crear invitación y enviar email
						const { data: result, error: edgeError } = await this.app.supabase.functions.invoke('invite-user', {
							body: {
								email: email,
								role: role,
								name: name || email.split('@')[0]
							}
						});
						
						if (edgeError) {
							throw new Error('Error al enviar invitación: ' + edgeError.message);
						}
						
						if (result?.error) {
							throw new Error(result.error || 'Error al crear invitación');
						}
						
						// 3. Actualizar datos y UI
						await this.app.loadInvitations();
						this.render();
						this.app.managers.modals.closeModal('invitation-modal');
						
						// Mostrar mensaje de éxito
						if (authData?.user) {
							alert(`✅ Invitación enviada exitosamente a ${email}\n\nEl usuario recibirá un email con instrucciones para completar su registro.`);
						} else {
							alert(`✅ Invitación creada para ${email}\n\nNota: No se pudo enviar el email automáticamente. Puedes compartir manualmente el enlace de invitación.`);
						}
						
					}catch(err){ 
						console.error('Error enviando invitación:', err);
						alert('Error enviando invitación: ' + (err?.message || err)); 
					}
					finally{ 
						saveBtn.disabled = false; 
						saveBtn.textContent = 'Enviar Invitación';
					}
				});
				form.dataset.bound = '1';
			}
		}

		showInvitationModal(email, inviteUrl) {
			// Crear modal dinámico para mostrar el enlace de invitación
			const modalHtml = `
				<div class="modal-overlay active" id="invitation-success-modal">
					<div class="modal-container">
						<div class="modal-header">
							<h3>✅ Invitación Creada</h3>
							<button class="modal-close" data-close-modal>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							</button>
						</div>
						<div class="modal-content">
							<div style="text-align: center; margin-bottom: 20px;">
								<div style="width: 64px; height: 64px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
									<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<path d="M9 12l2 2 4-4"></path>
										<circle cx="12" cy="12" r="10"></circle>
									</svg>
								</div>
								<h4 style="margin: 0 0 8px; color: var(--text);">Invitación creada para ${email}</h4>
								<p style="margin: 0; color: var(--muted);">Comparte el enlace de abajo con el usuario para que complete su registro</p>
							</div>
							
							<div style="background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
								<label style="display: block; font-weight: 600; margin-bottom: 8px; color: var(--text);">Enlace de invitación:</label>
								<div style="display: flex; gap: 8px; align-items: center;">
									<input type="text" value="${inviteUrl}" readonly style="flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-family: monospace; font-size: 12px;">
									<button data-copy-link style="padding: 8px 12px; background: var(--brand); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
										Copiar
									</button>
								</div>
							</div>
							
							<div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px;">
								<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
										<circle cx="12" cy="12" r="10"></circle>
										<path d="M9,12l2,2 4,-4"></path>
									</svg>
									<strong style="color: #10b981;">Próximos pasos:</strong>
								</div>
								<ul style="margin: 0; padding-left: 20px; color: var(--text);">
									<li>Comparte este enlace con el usuario</li>
									<li>El usuario hará clic en el enlace para registrarse</li>
									<li>Una vez registrado, aparecerá en la lista de usuarios</li>
								</ul>
							</div>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn-secondary" data-close-modal>Cerrar</button>
						</div>
					</div>
				</div>
			`;
			
			// Insertar el modal en el DOM
			document.body.insertAdjacentHTML('beforeend', modalHtml);
			
			// Configurar event listeners para el modal
			const modal = document.getElementById('invitation-success-modal');
			if (modal) {
				// Cerrar modal
				const closeBtn = modal.querySelector('[data-close-modal]');
				if (closeBtn) {
					closeBtn.addEventListener('click', () => modal.remove());
				}
				
				// Copiar enlace
				const copyBtn = modal.querySelector('[data-copy-link]');
				if (copyBtn) {
					copyBtn.addEventListener('click', () => {
						navigator.clipboard.writeText(inviteUrl).then(() => {
							copyBtn.textContent = '¡Copiado!';
							setTimeout(() => copyBtn.textContent = 'Copiar', 2000);
						}).catch(() => {
							console.log('No se pudo copiar al portapapeles');
						});
					});
				}
			}
			
			// Auto-copiar al portapapeles
			navigator.clipboard.writeText(inviteUrl).catch(() => {
				console.log('No se pudo copiar automáticamente al portapapeles');
			});
		}

		// ===============================================
		// CANCELAR INVITACIÓN
		// ===============================================

		async cancelInvitation(invitationId, email) {
			// Verificar que el usuario es superadmin
			if (window.App?.profile?.role !== 'superadmin') {
				alert('Solo los superadmin pueden cancelar invitaciones');
				return;
			}

			// Confirmar la acción
			const confirmed = confirm(
				`¿Estás seguro de que quieres cancelar la invitación para ${email}?\n\n` +
				'Esta acción eliminará:\n' +
				'• La invitación pendiente\n' +
				'• El perfil del usuario\n' +
				'• El usuario de autenticación\n\n' +
				'Esta acción NO se puede deshacer.'
			);

			if (!confirmed) return;

			try {
				console.log('🔄 Cancelando invitación:', { invitationId, email });

				// Llamar a la función RPC
				const { data, error } = await window.App.supabase.rpc('cancel_invitation_complete', {
					p_invitation_id: parseInt(invitationId),
					p_user_email: email
				});

				if (error) {
					console.error('❌ Error cancelando invitación:', error);
					throw error;
				}

				if (!data?.success) {
					throw new Error(data?.error || 'Error desconocido al cancelar invitación');
				}

				console.log('✅ Invitación cancelada exitosamente:', data);

				// Mostrar mensaje de éxito
				alert(`Invitación cancelada exitosamente para ${email}`);

				// Recargar la lista de invitaciones
				await this.app.loadInvitations();
				this.render();

			} catch (err) {
				console.error('❌ Error cancelando invitación:', err);
				alert('Error al cancelar la invitación: ' + err.message);
			}
		}
	}

    // Función de debug global para probar los campos de doctor
    window.debugDoctorFields = function() {
        console.log('[Users] Debug: Probando campos de doctor...');
        const roleSelect = document.getElementById('user-role');
        if (roleSelect) {
            console.log('[Users] Debug: roleSelect encontrado, valor actual:', roleSelect.value);
            // Simular selección de doctor
            roleSelect.value = 'doctor';
            roleSelect.dispatchEvent(new Event('change'));
        } else {
            console.error('[Users] Debug: roleSelect no encontrado');
        }
    };

    // Exportar para que el Loader/Router inicialice el módulo tras inyectar la vista
    window.UsersModule = { init };
})();


