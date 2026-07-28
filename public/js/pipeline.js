'use strict';

// ─── Pipeline global — tablero kanban de todos los leads ──────────────────────
// Pattern: RMG PipelinePage.jsx — fetch board → columnas por etapa →
// card click → navigate('leads') + auto-open lead detail.

const PIPELINE_ETAPAS = [
  { key: 'Nuevo',          color: '#64748b', dot: '#94a3b8' },
  { key: 'Contactado',     color: '#0d5c8c', dot: '#0d5c8c' },
  { key: 'Cotizado',       color: '#b45309', dot: '#d97706' },
  { key: 'Pedido Enviado', color: '#0f766e', dot: '#14b8a6' },
  { key: 'Cerrado',        color: '#15803d', dot: '#22c55e' },
  { key: 'Abandonado',     color: '#b91c1c', dot: '#ef4444' },
];

// Shared with leads.js — signals which lead to auto-open after navigation
window._pipelineOpenLead = null;

async function renderPipeline(container) {
  container.innerHTML = `
    <div class="space-y-5" style="height: calc(100vh - 140px); display: flex; flex-direction: column;">

      <!-- Header + filtros -->
      <div class="flex items-center justify-between gap-4 flex-shrink-0 flex-wrap">
        <div>
          <p class="text-xs text-slate-400 mt-0.5">Vista kanban · todos los leads agrupados por etapa</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <select id="pipeline-segmento"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="recargarPipeline()">
            <option value="">Todos los segmentos</option>
            <option value="ecommerce">Ecommerce</option>
            <option value="mayorista">Mayorista</option>
          </select>
          <select id="pipeline-ejecutivo"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="recargarPipeline()">
            <option value="">Todos los ejecutivos</option>
          </select>
          <button onclick="recargarPipeline()"
            class="border border-slate-200 text-slate-500 text-sm px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      <!-- Kanban board -->
      <div id="pipeline-board" class="flex gap-4 overflow-x-auto pb-4 flex-1" style="min-height: 0; align-items: flex-start;">
        ${PIPELINE_ETAPAS.map(() => `
          <div class="flex-shrink-0 animate-pulse" style="width:220px">
            <div class="h-5 rounded bg-slate-200 mb-3 w-3/4"></div>
            <div class="space-y-2">
              <div class="h-20 rounded-xl bg-slate-100"></div>
              <div class="h-20 rounded-xl bg-slate-100"></div>
            </div>
          </div>`).join('')}
      </div>

    </div>`;

  // Hide ejecutivo select for ejecutivo role (they always see only their own)
  const usuario = window.App?.usuario;
  if (usuario?.rol === 'ejecutivo') {
    const sel = document.getElementById('pipeline-ejecutivo');
    if (sel) sel.closest('.flex')?.querySelector('select[id="pipeline-ejecutivo"]')?.parentElement
      ? (sel.style.display = 'none')
      : (sel.style.display = 'none');
  } else {
    await cargarEjecutivosFiltro();
  }
  await recargarPipeline();
}

async function cargarEjecutivosFiltro() {
  try {
    const ejecutivos = await api.get('/api/ejecutivos');
    const sel = document.getElementById('pipeline-ejecutivo');
    if (!sel || !ejecutivos.length) return;
    ejecutivos.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.nombre;
      sel.appendChild(opt);
    });
  } catch (_) { /* filtro de ejecutivos es opcional */ }
}

async function recargarPipeline() {
  const segmento = document.getElementById('pipeline-segmento')?.value || '';
  const usuario = window.App?.usuario;
  // Ejecutivo role: backend enforces own-data filter; frontend locks the select
  const asignado_a = usuario?.rol === 'ejecutivo'
    ? (usuario.ejecutivo_id || '')
    : (document.getElementById('pipeline-ejecutivo')?.value || '');
  const params = new URLSearchParams();
  if (segmento) params.set('segmento', segmento);
  if (asignado_a) params.set('asignado_a', asignado_a);

  let board;
  try {
    const res = await api.get(`/api/pipeline?${params}`);
    board = res.board || {};
  } catch (e) {
    const boardEl = document.getElementById('pipeline-board');
    if (boardEl) boardEl.innerHTML = `<div class="text-sm text-red-500 p-4">${e.message}</div>`;
    return;
  }

  renderBoard(board);
}

function renderBoard(board) {
  const boardEl = document.getElementById('pipeline-board');
  if (!boardEl) return;

  boardEl.innerHTML = PIPELINE_ETAPAS.map(etapa => {
    const cards = board[etapa.key] || [];
    return `
      <div class="flex-shrink-0 flex flex-col" style="width: 220px">
        <!-- Column header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${etapa.dot}"></div>
            <span class="text-sm font-semibold" style="color:${etapa.color}">${etapa.key}</span>
          </div>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">${cards.length}</span>
        </div>

        <!-- Cards -->
        <div class="space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-260px)]">
          ${cards.length === 0
            ? `<div class="text-center py-8 text-xs rounded-xl border-2 border-dashed border-slate-200 text-slate-400">Sin leads</div>`
            : cards.map(l => leadCardHTML(l, etapa)).join('')
          }
        </div>
      </div>`;
  }).join('');
}

function leadCardHTML(lead, etapa) {
  const nombre = escPipeline(lead.nombre || '—');
  const telefono = escPipeline(lead.telefono || '');
  const empresa = escPipeline(lead.empresa || '');
  const segmentoBadge = lead.segmento === 'mayorista'
    ? `<span class="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-[#e8f4fd] text-[#0d5c8c] font-medium border border-[#0d5c8c]/20">Mayor.</span>`
    : `<span class="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">Ecom.</span>`;
  const ts = lead.updatedAt || lead.createdAt;
  const hace = ts ? tiempoRelativo(ts) : '';

  return `
    <div onclick="abrirLeadDesdePipeline('${lead.id}')"
      class="bg-white border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:border-[#0d5c8c]/50 hover:shadow-sm transition group">
      <div class="font-semibold text-sm text-slate-800 truncate mb-1 group-hover:text-[#0d5c8c]">${nombre}</div>
      ${empresa ? `<div class="text-xs text-slate-400 truncate mb-1.5">${empresa}</div>` : ''}
      <div class="flex items-center justify-between gap-2">
        ${segmentoBadge}
        <span class="text-[10px] text-slate-400 truncate">${hace}</span>
      </div>
      ${telefono ? `<div class="text-xs text-slate-400 mt-1.5 truncate">${telefono}</div>` : ''}
    </div>`;
}

// Navigate to leads page and auto-open this lead's detail (the Pipeline tab)
function abrirLeadDesdePipeline(id) {
  window._pipelineOpenLead = id;
  navigate('leads');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escPipeline(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tiempoRelativo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return min <= 1 ? 'hace 1 min' : `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'hace 1 h' : `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} d`;
}

// Expose for app.js nav handler
window.recargarPipeline = recargarPipeline;
