// ─── Campañas HSM ─────────────────────────────────────────────────────────────

async function renderCampanas(container) {
  const res = await api.get('/api/campanas').catch(() => ({ data: [] }));
  const campanas = res.data || [];

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Toolbar -->
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex gap-2 flex-wrap">
          ${['todas', 'borrador', 'programada', 'enviada', 'fallida'].map((e, i) => `
            <button onclick="filtrarCampanas('${e}')" data-filtro="${e}"
              class="camp-filtro text-sm px-4 py-2 rounded-lg border transition font-medium
                ${i === 0 ? 'bg-[#0d5c8c] text-white border-[#0d5c8c]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">
              ${e.charAt(0).toUpperCase() + e.slice(1)}
            </button>
          `).join('')}
        </div>
        <button onclick="mostrarFormCampana()"
          class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-5 py-2 rounded-lg transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Nueva Campaña
        </button>
      </div>

      <!-- Stats rápidas -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        ${[
          ['Total campañas', campanas.length, 'text-slate-800'],
          ['Borradores', campanas.filter(c => c.estado === 'borrador').length, 'text-slate-600'],
          ['Programadas', campanas.filter(c => c.estado === 'programada').length, 'text-blue-600'],
          ['Enviadas', campanas.filter(c => c.estado === 'enviada').length, 'text-emerald-600'],
        ].map(([label, val, cls]) => `
          <div class="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p class="text-2xl font-bold ${cls}">${val}</p>
            <p class="text-xs text-slate-400 mt-1">${label}</p>
          </div>
        `).join('')}
      </div>

      <!-- Grid de campañas -->
      <div id="campanas-grid" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        ${campanas.length
          ? campanas.map(c => cardCampana(c)).join('')
          : `<div class="col-span-3 bg-white border border-slate-200 rounded-xl p-12 text-center">
              <svg class="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
              </svg>
              <p class="text-slate-400 text-sm">No hay campañas. Crea tu primera campaña HSM.</p>
            </div>`
        }
      </div>
    </div>
  `;

  window._campanasData = campanas;
}

function cardCampana(c) {
  const estadoColors = {
    borrador: 'gray',
    programada: 'blue',
    enviada: 'green',
    fallida: 'red',
  };
  const stats = c.stats || {};
  const enviados = stats.enviados || 0;
  const respondidos = stats.respondidos || 0;
  const tasaResp = enviados > 0 ? Math.round((respondidos / enviados) * 100) : 0;

  return `
    <div class="bg-white border border-slate-200 rounded-xl p-5 space-y-4 hover:border-slate-300 transition">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-semibold text-slate-800 truncate">${c.nombre || 'Sin nombre'}</h3>
          <p class="text-xs text-slate-400 mt-0.5 truncate">${c.template_hsm || 'Sin template'}</p>
        </div>
        ${badge(c.estado || 'borrador', estadoColors[c.estado] || 'gray')}
      </div>

      <!-- Stats grid -->
      <div class="grid grid-cols-4 gap-2 text-center">
        ${[
          ['Enviados', stats.enviados || 0, 'text-[#0d5c8c]'],
          ['Entregados', stats.entregados || 0, 'text-emerald-600'],
          ['Leídos', stats.leidos || 0, 'text-yellow-600'],
          ['Respondidos', stats.respondidos || 0, 'text-purple-600'],
        ].map(([l, v, cls]) => `
          <div class="bg-slate-50 rounded-lg p-2">
            <p class="text-base font-bold ${cls}">${v}</p>
            <p class="text-[10px] text-slate-400 leading-tight mt-0.5">${l}</p>
          </div>
        `).join('')}
      </div>

      <!-- Tasa de respuesta -->
      ${enviados > 0 ? `
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-slate-400">Tasa de respuesta</span>
            <span class="text-xs font-semibold text-slate-700">${tasaResp}%</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-[#0d5c8c] rounded-full transition-all" style="width: ${tasaResp}%"></div>
          </div>
        </div>
      ` : ''}

      <!-- Meta info -->
      <div class="text-xs text-slate-400 space-y-1">
        <p>Segmento: <span class="font-medium text-slate-600">${c.segmento || 'todos'}</span></p>
        ${c.programada_para ? `<p>Programada: <span class="font-medium text-slate-600">${formatDate(c.programada_para)}</span></p>` : ''}
        ${c.createdAt ? `<p>Creada: <span class="font-medium text-slate-600">${formatDate(c.createdAt)}</span></p>` : ''}
      </div>

      <!-- Acciones -->
      <div class="flex gap-2 pt-1 border-t border-slate-100">
        ${c.estado !== 'enviada' ? `
          <button onclick="enviarCampana('${c.id || c._id}')"
            class="flex-1 bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-xs font-semibold py-2 rounded-lg transition">
            Enviar ahora
          </button>
        ` : `
          <button onclick="verReporteCampana('${c.id || c._id}')"
            class="flex-1 border border-[#0d5c8c] text-[#0d5c8c] text-xs font-semibold py-2 rounded-lg hover:bg-[#e8f4fd] transition">
            Ver reporte
          </button>
        `}
        <button onclick="editarCampana('${c.id || c._id}')"
          class="border border-slate-200 text-slate-500 text-xs px-3 py-2 rounded-lg hover:bg-slate-50 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function filtrarCampanas(filtro) {
  // Update button styles
  document.querySelectorAll('.camp-filtro').forEach(b => {
    const isActive = b.dataset.filtro === filtro;
    b.classList.toggle('bg-[#0d5c8c]', isActive);
    b.classList.toggle('text-white', isActive);
    b.classList.toggle('border-[#0d5c8c]', isActive);
    b.classList.toggle('bg-white', !isActive);
    b.classList.toggle('text-slate-600', !isActive);
    b.classList.toggle('border-slate-200', !isActive);
  });

  const data = window._campanasData || [];
  const filtered = filtro === 'todas' ? data : data.filter(c => c.estado === filtro);
  const grid = document.getElementById('campanas-grid');
  if (grid) {
    grid.innerHTML = filtered.length
      ? filtered.map(c => cardCampana(c)).join('')
      : `<div class="col-span-3 text-center text-slate-300 text-sm py-10">No hay campañas en estado "${filtro}"</div>`;
  }
}

async function enviarCampana(id) {
  if (!confirm('¿Enviar esta campaña ahora a todos los destinatarios del segmento?')) return;
  try {
    await api.post(`/api/campanas/${id}/enviar`, {});
    await renderCampanas(document.getElementById('view-container'));
  } catch (e) {
    alert('Error al enviar campaña: ' + e.message);
  }
}

function mostrarFormCampana() {
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="max-w-xl">
      <!-- Back -->
      <div class="flex items-center gap-3 mb-6">
        <button onclick="navigate('campanas')"
          class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h2 class="text-xl font-bold text-slate-800">Nueva Campaña HSM</h2>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Nombre de la campaña *</label>
          <input id="nc-nombre" type="text" placeholder="Ej: Oferta Lubricantes Mayo 2025"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Template HSM</label>
          <input id="nc-template" type="text" placeholder="ej: oferta_lubricantes_mayo"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          <p class="text-xs text-slate-400 mt-1">Nombre del template aprobado en Meta Business Manager</p>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Segmento destinatario</label>
          <select id="nc-segmento"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
            <option value="todos">Todos los leads</option>
            <option value="ecommerce">Solo ecommerce</option>
            <option value="mayorista">Solo mayoristas</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Programar envío (opcional)</label>
          <input id="nc-fecha" type="datetime-local"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          <p class="text-xs text-slate-400 mt-1">Deja vacío para guardar como borrador</p>
        </div>

        <div id="nc-error" class="hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>

        <div class="flex gap-3 pt-2 border-t border-slate-100">
          <button onclick="crearCampana()"
            class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition">
            Guardar campaña
          </button>
          <button onclick="navigate('campanas')"
            class="border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
}

async function crearCampana() {
  const body = {
    nombre:         document.getElementById('nc-nombre')?.value?.trim(),
    template_hsm:   document.getElementById('nc-template')?.value?.trim() || undefined,
    segmento:       document.getElementById('nc-segmento')?.value,
    programada_para: document.getElementById('nc-fecha')?.value || null,
  };

  const errEl = document.getElementById('nc-error');
  if (!body.nombre) {
    if (errEl) { errEl.textContent = 'El nombre de la campaña es requerido'; errEl.classList.remove('hidden'); }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  try {
    await api.post('/api/campanas', body);
    navigate('campanas');
  } catch (e) {
    if (errEl) { errEl.textContent = 'Error al crear campaña: ' + e.message; errEl.classList.remove('hidden'); }
  }
}

function editarCampana(id) {
  // For now, show a simple info panel
  const camp = (window._campanasData || []).find(c => (c.id || c._id) === id);
  if (!camp) return;

  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="max-w-xl">
      <div class="flex items-center gap-3 mb-6">
        <button onclick="navigate('campanas')"
          class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h2 class="text-xl font-bold text-slate-800">Editar Campaña</h2>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Nombre de la campaña</label>
          <input id="ec-nombre" type="text" value="${camp.nombre || ''}"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Segmento</label>
          <select id="ec-segmento"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
            <option value="todos" ${camp.segmento === 'todos' ? 'selected' : ''}>Todos</option>
            <option value="ecommerce" ${camp.segmento === 'ecommerce' ? 'selected' : ''}>Ecommerce</option>
            <option value="mayorista" ${camp.segmento === 'mayorista' ? 'selected' : ''}>Mayoristas</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Programar envío</label>
          <input id="ec-fecha" type="datetime-local" value="${camp.programada_para ? camp.programada_para.slice(0, 16) : ''}"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]">
        </div>
        <div class="flex gap-3 pt-2 border-t border-slate-100">
          <button onclick="guardarEdicionCampana('${id}')"
            class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition">
            Guardar cambios
          </button>
          <button onclick="navigate('campanas')"
            class="border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
}

async function guardarEdicionCampana(id) {
  const body = {
    nombre:          document.getElementById('ec-nombre')?.value?.trim(),
    segmento:        document.getElementById('ec-segmento')?.value,
    programada_para: document.getElementById('ec-fecha')?.value || null,
  };
  try {
    await api.patch(`/api/campanas/${id}`, body);
    navigate('campanas');
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  }
}

async function verReporteCampana(id) {
  try {
    const reporte = await api.get(`/api/campanas/${id}/reporte`);
    const camp = reporte.campana || reporte;
    const stats = camp.stats || reporte.stats || {};

    const container = document.getElementById('view-container');
    container.innerHTML = `
      <div class="max-w-2xl">
        <div class="flex items-center gap-3 mb-6">
          <button onclick="navigate('campanas')"
            class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h2 class="text-xl font-bold text-slate-800">Reporte de Campaña</h2>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 class="font-semibold text-slate-800">${camp.nombre || 'Sin nombre'}</h3>
            <p class="text-xs text-slate-400">${camp.template_hsm || ''} · Segmento: ${camp.segmento || 'todos'}</p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            ${[
              ['Enviados', stats.enviados || 0, 'text-[#0d5c8c]'],
              ['Entregados', stats.entregados || 0, 'text-emerald-600'],
              ['Leídos', stats.leidos || 0, 'text-yellow-600'],
              ['Respondidos', stats.respondidos || 0, 'text-purple-600'],
            ].map(([l, v, cls]) => `
              <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p class="text-3xl font-bold ${cls}">${v}</p>
                <p class="text-xs text-slate-400 mt-1">${l}</p>
              </div>
            `).join('')}
          </div>
          <div class="text-xs text-slate-400 pt-2 border-t border-slate-100">
            ${camp.programada_para ? `<p>Enviada: ${formatDate(camp.programada_para)}</p>` : ''}
            ${camp.createdAt ? `<p>Creada: ${formatDate(camp.createdAt)}</p>` : ''}
          </div>
          <button onclick="navigate('campanas')"
            class="border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            Volver
          </button>
        </div>
      </div>
    `;
  } catch (e) {
    alert('Error al obtener reporte: ' + e.message);
  }
}
