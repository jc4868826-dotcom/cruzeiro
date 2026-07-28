// ─── Agenda ───────────────────────────────────────────────────────────────────

async function renderAgenda(container) {
  const isAdmin = App.usuario?.rol === 'admin';

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <p class="text-xs text-slate-400">Tareas pendientes del equipo comercial</p>
        <div class="flex items-center gap-3">
          ${isAdmin ? `
            <select id="agenda-filtro-ejecutivo"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
              onchange="recargarAgenda()">
              <option value="">Todos los ejecutivos</option>
            </select>` : ''}
          <button onclick="recargarAgenda()"
            class="border border-slate-200 text-slate-500 text-sm px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      <div id="agenda-list" class="space-y-3">
        <div class="text-center py-12">
          <div class="w-5 h-5 border-2 border-[#0d5c8c] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p class="text-sm text-slate-400">Cargando tareas...</p>
        </div>
      </div>

      <div id="agenda-completadas-section" class="hidden">
        <button onclick="toggleCompletadas()" id="btn-toggle-completadas"
          class="text-xs text-slate-400 hover:text-slate-600 transition flex items-center gap-1.5">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
          Ver tareas completadas
        </button>
        <div id="agenda-completadas-list" class="hidden mt-3 space-y-2"></div>
      </div>
    </div>
  `;

  if (isAdmin) {
    await cargarEjecutivosAgenda();
  }
  await recargarAgenda();
}

async function cargarEjecutivosAgenda() {
  try {
    const res = await api.get('/api/ejecutivos');
    const sel = document.getElementById('agenda-filtro-ejecutivo');
    if (!sel || !res.data?.length) return;
    res.data.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.nombre;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

async function recargarAgenda() {
  const isAdmin = App.usuario?.rol === 'admin';
  const filtroEj = isAdmin ? (document.getElementById('agenda-filtro-ejecutivo')?.value || '') : '';

  const params = new URLSearchParams();
  if (filtroEj) params.set('ejecutivo_id', filtroEj);

  try {
    const [pendientesRes, completadasRes, leadsRes] = await Promise.all([
      api.get(`/api/agenda/pendientes?${params}`),
      api.get(`/api/agenda?${params}`),
      api.get('/api/leads?limit=200').catch(() => ({ data: [] })),
    ]);

    const pendientes = pendientesRes.data || [];
    const todasAgenda = completadasRes.data || [];
    const completadas = todasAgenda.filter(i => i.estado === 'completada');
    const leadMap = new Map((leadsRes.data || []).map(l => [l.id, l]));

    renderAgendaList(pendientes, leadMap);

    const secComp = document.getElementById('agenda-completadas-section');
    if (completadas.length > 0) {
      secComp?.classList.remove('hidden');
      const compList = document.getElementById('agenda-completadas-list');
      if (compList) {
        compList.innerHTML = completadas.map(item => agendaItemHTML(item, leadMap.get(item.lead_id), true)).join('');
      }
    } else {
      secComp?.classList.add('hidden');
    }
  } catch (e) {
    const list = document.getElementById('agenda-list');
    if (list) list.innerHTML = `<div class="text-sm text-red-500 p-4 text-center">${e.message}</div>`;
  }
}

function renderAgendaList(items, leadMap) {
  const container = document.getElementById('agenda-list');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="text-center py-16 bg-white border border-slate-200 rounded-xl">
        <div class="text-4xl mb-3">✅</div>
        <p class="text-slate-600 font-medium text-sm">Sin tareas pendientes</p>
        <p class="text-slate-400 text-xs mt-1">Todas las tareas están al día</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => agendaItemHTML(item, leadMap.get(item.lead_id), false)).join('');
}

function agendaItemHTML(item, lead, completada) {
  const canalIcon = item.canal === 'correo' ? '✉️' : item.canal === 'ejecutivo_whatsapp' ? '📱' : '📌';
  const canalLabel = item.canal === 'correo' ? 'Correo' : item.canal === 'ejecutivo_whatsapp' ? 'WhatsApp' : 'Interno';

  const leadBtn = lead
    ? `<button onclick="irALeadDesdeAgenda('${lead.id}')"
        class="text-[#0d5c8c] hover:underline text-xs font-medium">${escHtmlAg(lead.nombre)}</button>`
    : '';

  return `
    <div class="bg-white border ${completada ? 'border-slate-100 opacity-60' : 'border-slate-200'} rounded-xl p-4 flex items-start gap-4 transition"
      id="agenda-item-${item.id}">
      <div class="w-9 h-9 rounded-full ${completada ? 'bg-slate-50 border border-slate-200' : 'bg-amber-50 border border-amber-200'} flex items-center justify-center text-base shrink-0">${canalIcon}</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-slate-700 leading-relaxed">${escHtmlAg(item.descripcion)}</p>
        <div class="flex items-center gap-3 mt-1.5 flex-wrap">
          ${lead ? `<span class="text-xs text-slate-400">Lead: ${leadBtn}</span>` : ''}
          <span class="text-xs text-slate-400">${canalLabel}</span>
          <span class="text-xs text-slate-300">${formatDate(item.createdAt)}</span>
        </div>
      </div>
      ${!completada ? `
        <button onclick="completarTarea('${item.id}')"
          class="shrink-0 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition whitespace-nowrap">
          Completar
        </button>` : `
        <span class="shrink-0 text-xs text-slate-400 font-medium">Completada</span>`}
    </div>`;
}

async function completarTarea(id) {
  const el = document.getElementById(`agenda-item-${id}`);
  if (el) {
    el.style.opacity = '0.4';
    el.style.transition = 'opacity 0.3s';
  }
  try {
    await api.patch(`/api/agenda/${id}`, { estado: 'completada' });
    setTimeout(() => recargarAgenda(), 400);
  } catch (e) {
    if (el) el.style.opacity = '';
    alert('Error al completar tarea: ' + e.message);
  }
}

function irALeadDesdeAgenda(id) {
  window._pipelineOpenLead = id;
  navigate('leads');
}

function toggleCompletadas() {
  const list = document.getElementById('agenda-completadas-list');
  const btn = document.getElementById('btn-toggle-completadas');
  if (!list) return;
  const hidden = list.classList.toggle('hidden');
  if (btn) btn.querySelector('svg')?.setAttribute('style', hidden ? '' : 'transform: rotate(180deg)');
}

function escHtmlAg(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.recargarAgenda = recargarAgenda;
