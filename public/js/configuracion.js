// ─── Configuración ────────────────────────────────────────────────────────────

async function renderConfiguracion(container) {
  const [tenant, usuariosRes, integraciones] = await Promise.all([
    api.get('/api/config/tenant').catch(() => ({})),
    api.get('/api/config/usuarios').catch(() => ({ data: [] })),
    api.get('/api/config/integraciones').catch(() => ({})),
  ]);

  const usuarios = usuariosRes.data || usuariosRes || [];

  container.innerHTML = `
    <div class="max-w-4xl space-y-6">

      <!-- Datos del negocio (tenant) -->
      <div class="bg-white border border-slate-200 rounded-xl p-6">
        <h2 class="font-bold text-slate-800 mb-1 text-base">Datos del negocio</h2>
        <p class="text-sm text-slate-400 mb-5">Información general del tenant en FunnelOS</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Nombre comercial</label>
            <input id="cfg-nombre" type="text" value="${escHtml(tenant.nombre_comercial || '')}"
              placeholder="Ej: Cruzeiro Distribuciones"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Horario de atención</label>
            <input id="cfg-horario" type="text" value="${escHtml(tenant.horario || '')}"
              placeholder="Ej: Lun-Vie 9:00-18:00"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Zona horaria</label>
            <input id="cfg-tz" type="text" value="${escHtml(tenant.zona_horaria || 'America/Santiago')}"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Teléfono WhatsApp</label>
            <input id="cfg-telefono" type="text" value="${escHtml(tenant.telefono_whatsapp || '')}"
              placeholder="+56912345678"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
        </div>
        <div id="cfg-success" class="hidden mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Configuración guardada correctamente
        </div>
        <button onclick="guardarTenant()"
          class="mt-5 bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
          Guardar cambios
        </button>
      </div>

      <!-- Integraciones -->
      <div class="bg-white border border-slate-200 rounded-xl p-6">
        <h2 class="font-bold text-slate-800 mb-1 text-base">Integraciones</h2>
        <p class="text-sm text-slate-400 mb-5">Conexiones con servicios externos</p>
        <div class="space-y-3">
          ${(integraciones.integraciones || []).length
            ? (integraciones.integraciones || []).map(info => `
                <div class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-700">${escHtml(info.nombre || info.clave)}</p>
                    <p class="text-xs text-slate-400 mt-0.5 font-mono">${(info.env_vars || []).join(', ')}</p>
                  </div>
                  <div class="flex items-center gap-3 shrink-0 ml-4">
                    ${info.configurado
                      ? badge('Conectado', 'green')
                      : badge('No conectado', 'gray')
                    }
                  </div>
                </div>
              `).join('')
            : `<div class="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-400 text-center">
                No hay integraciones configuradas
              </div>`
          }
        </div>
      </div>

      <!-- Usuarios del sistema -->
      <div class="bg-white border border-slate-200 rounded-xl p-6">
        <div class="flex items-center justify-between mb-1">
          <h2 class="font-bold text-slate-800 text-base">Usuarios del sistema</h2>
          <button onclick="mostrarFormUsuario()"
            class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Añadir usuario
          </button>
        </div>
        <p class="text-sm text-slate-400 mb-5">${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} registrado${usuarios.length !== 1 ? 's' : ''}</p>

        <div id="usuarios-list" class="space-y-3">
          ${Array.isArray(usuarios) && usuarios.length
            ? usuarios.map(u => tarjetaUsuario(u)).join('')
            : '<p class="text-sm text-slate-400 text-center py-4">Sin usuarios registrados</p>'
          }
        </div>

        <!-- Form nuevo usuario (hidden) -->
        <div id="form-usuario" class="hidden mt-6 border-t border-slate-200 pt-6">
          <h3 class="text-sm font-semibold text-slate-700 mb-4">Nuevo usuario</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-medium text-slate-500 block mb-1">Username *</label>
              <input id="nu-username" type="text" placeholder="usuario_nuevo"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
            </div>
            <div>
              <label class="text-xs font-medium text-slate-500 block mb-1">Nombre completo</label>
              <input id="nu-nombre" type="text" placeholder="Juan Pérez"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
            </div>
            <div>
              <label class="text-xs font-medium text-slate-500 block mb-1">Contraseña *</label>
              <input id="nu-password" type="password" placeholder="••••••••"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
            </div>
            <div>
              <label class="text-xs font-medium text-slate-500 block mb-1">Rol</label>
              <select id="nu-rol"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
                <option value="agente">Agente</option>
                <option value="admin">Admin</option>
                <option value="solo-lectura">Solo lectura</option>
              </select>
            </div>
          </div>
          <div id="nu-error" class="hidden mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
          <div class="flex gap-3 mt-5">
            <button onclick="crearUsuario()"
              class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
              Crear usuario
            </button>
            <button onclick="document.getElementById('form-usuario').classList.add('hidden')"
              class="border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- Info del sistema -->
      <div class="bg-white border border-slate-200 rounded-xl p-6">
        <h2 class="font-bold text-slate-800 mb-4 text-base">Información del sistema</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div class="bg-slate-50 rounded-lg p-4">
            <p class="text-xs text-slate-400 mb-1">Versión FunnelOS</p>
            <p class="font-semibold text-slate-700">v1.0.0</p>
          </div>
          <div class="bg-slate-50 rounded-lg p-4">
            <p class="text-xs text-slate-400 mb-1">Entorno</p>
            <p class="font-semibold text-slate-700">Producción</p>
          </div>
          <div class="bg-slate-50 rounded-lg p-4">
            <p class="text-xs text-slate-400 mb-1">Región</p>
            <p class="font-semibold text-slate-700">Chile (CL)</p>
          </div>
        </div>
      </div>

    </div>
  `;
}

function tarjetaUsuario(u) {
  const inicial = (u.nombre || u.username || 'U').charAt(0).toUpperCase();
  const rolColor = u.rol === 'admin' ? 'ocean' : u.rol === 'agente' ? 'blue' : 'gray';
  return `
    <div class="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-[#0d5c8c] flex items-center justify-center text-white text-sm font-bold shrink-0">
          ${inicial}
        </div>
        <div>
          <p class="text-sm font-semibold text-slate-700">${escHtml(u.nombre || u.username)}</p>
          <p class="text-xs text-slate-400">@${escHtml(u.username)}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${badge(u.rol || 'agente', rolColor)}
        ${u.activo === false ? badge('Inactivo', 'red') : badge('Activo', 'green')}
      </div>
    </div>
  `;
}

async function guardarTenant() {
  const body = {
    nombre_comercial:   document.getElementById('cfg-nombre')?.value?.trim(),
    horario:            document.getElementById('cfg-horario')?.value?.trim(),
    zona_horaria:       document.getElementById('cfg-tz')?.value?.trim(),
    telefono_whatsapp:  document.getElementById('cfg-telefono')?.value?.trim(),
  };
  try {
    await api.patch('/api/config/tenant', body);
    const suc = document.getElementById('cfg-success');
    if (suc) {
      suc.classList.remove('hidden');
      setTimeout(() => suc.classList.add('hidden'), 3000);
    }
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  }
}

function mostrarFormUsuario() {
  const form = document.getElementById('form-usuario');
  if (form) {
    form.classList.remove('hidden');
    document.getElementById('nu-username')?.focus();
  }
}

async function crearUsuario() {
  const body = {
    username: document.getElementById('nu-username')?.value?.trim(),
    nombre:   document.getElementById('nu-nombre')?.value?.trim() || undefined,
    password: document.getElementById('nu-password')?.value,
    rol:      document.getElementById('nu-rol')?.value,
  };

  const errEl = document.getElementById('nu-error');
  if (!body.username || !body.password) {
    if (errEl) { errEl.textContent = 'Username y contraseña son requeridos'; errEl.classList.remove('hidden'); }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  try {
    await api.post('/api/config/usuarios', body);
    renderConfiguracion(document.getElementById('view-container'));
  } catch (e) {
    if (errEl) { errEl.textContent = 'Error al crear usuario: ' + e.message; errEl.classList.remove('hidden'); }
  }
}

// ─── Utility (local, también disponible en leads.js pero la redefinimos por seguridad) ─────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
