'use strict';

let _pedidosData = [];
let _pedidosFiltrados = [];
let _pedidosPagina = 1;
const _PED_POR_PAG = 50;

async function renderPedidos(container) {
  container.innerHTML = `<div class="flex items-center justify-center h-32 text-slate-400 text-sm">Cargando pedidos...</div>`;
  try {
    const res = await api.get('/api/pedidos?limit=500');
    _pedidosData = res.data || [];
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-red-500 text-sm">Error: ${escP(e.message)}</div>`;
    return;
  }

  if (!_pedidosData.length) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <p class="text-slate-400 text-sm mb-3">Sin datos — sube el archivo de pedidos en la sección Archivos</p>
        <a href="#archivos" onclick="navigate('archivos')" class="text-sm text-[#0d5c8c] underline underline-offset-2">Ir a Archivos</a>
      </div>`;
    return;
  }

  const estados = [...new Set(_pedidosData.map(p => p.estado).filter(Boolean))].sort();
  const canales = [...new Set(_pedidosData.map(p => p.canal).filter(Boolean))].sort();
  const vendedores = [...new Set(_pedidosData.map(p => p.vendedor).filter(Boolean))].sort();

  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[200px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Buscar NV, RUT o cliente</label>
          <input id="ped-search" type="text" placeholder="NV, RUT o razón social..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            oninput="filtrarPedidos()">
        </div>
        <div class="min-w-[180px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Estado</label>
          <select id="ped-estado"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarPedidos()">
            <option value="">Todos</option>
            ${estados.map(e => `<option value="${escP(e)}">${escP(e)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[140px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Canal</label>
          <select id="ped-canal"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarPedidos()">
            <option value="">Todos</option>
            ${canales.map(c => `<option value="${escP(c)}">${escP(c)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[160px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Vendedor</label>
          <select id="ped-vendedor"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarPedidos()">
            <option value="">Todos</option>
            ${vendedores.map(v => `<option value="${escP(v)}">${escP(v)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[130px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Fecha NV desde</label>
          <input id="ped-fecha-desde" type="date"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarPedidos()">
        </div>
        <div class="min-w-[130px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Fecha NV hasta</label>
          <input id="ped-fecha-hasta" type="date"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarPedidos()">
        </div>
        <button onclick="limpiarFiltrosPedidos()"
          class="text-xs text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition whitespace-nowrap self-end">
          Limpiar filtros
        </button>
        <div class="pb-2 self-end"><span id="ped-contador" class="text-xs text-slate-400">—</span></div>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[1100px]">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                ${['NV','Estado','Cliente','RUT','Canal','Vendedor','Fecha NV','Entrega','Transporte','Comuna'].map(h=>`<th class="text-left text-xs font-semibold text-slate-500 px-3 py-3 uppercase tracking-wide whitespace-nowrap">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="ped-tbody"></tbody>
          </table>
        </div>
        <div id="ped-paginacion" class="border-t border-slate-100 px-4 py-3 flex items-center justify-between"></div>
      </div>
    </div>`;

  filtrarPedidos();
}

window.filtrarPedidos = function() {
  const q = (document.getElementById('ped-search')?.value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const estado = document.getElementById('ped-estado')?.value || '';
  const canal = document.getElementById('ped-canal')?.value || '';
  const vendedor = document.getElementById('ped-vendedor')?.value || '';
  const fechaDesde = document.getElementById('ped-fecha-desde')?.value || '';
  const fechaHasta = document.getElementById('ped-fecha-hasta')?.value || '';

  _pedidosFiltrados = _pedidosData.filter(p => {
    if (estado && p.estado !== estado) return false;
    if (canal && p.canal !== canal) return false;
    if (vendedor && p.vendedor !== vendedor) return false;
    if (fechaDesde && p.fecha_nv && p.fecha_nv < fechaDesde) return false;
    if (fechaHasta && p.fecha_nv && p.fecha_nv > fechaHasta + 'T23:59:59') return false;
    if (q) {
      const hay = [p.nv, p.rut, p.cliente].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  _pedidosPagina = 1;
  renderTablaPed();
};

window.limpiarFiltrosPedidos = function() {
  ['ped-search','ped-estado','ped-canal','ped-vendedor','ped-fecha-desde','ped-fecha-hasta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filtrarPedidos();
};

function renderTablaPed() {
  const tbody = document.getElementById('ped-tbody');
  const pag = document.getElementById('ped-paginacion');
  const contador = document.getElementById('ped-contador');
  if (!tbody) return;
  const total = _pedidosFiltrados.length;
  const totalPag = Math.ceil(total / _PED_POR_PAG) || 1;
  _pedidosPagina = Math.min(_pedidosPagina, totalPag);
  const slice = _pedidosFiltrados.slice((_pedidosPagina - 1) * _PED_POR_PAG, _pedidosPagina * _PED_POR_PAG);
  if (contador) contador.textContent = `Mostrando ${slice.length} de ${total} pedidos`;
  tbody.innerHTML = slice.map(p => `
    <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
      <td class="px-3 py-2 font-mono text-xs text-[#0d5c8c] font-semibold">${escP(p.nv)}</td>
      <td class="px-3 py-2">${badgePed(p.estado)}</td>
      <td class="px-3 py-2 text-xs text-slate-700 max-w-[140px]"><p class="truncate">${escP(p.cliente||'—')}</p></td>
      <td class="px-3 py-2 font-mono text-xs text-slate-400">${escP(p.rut||'—')}</td>
      <td class="px-3 py-2 text-xs text-slate-500">${escP(p.canal||'—')}</td>
      <td class="px-3 py-2 text-xs text-slate-500 max-w-[120px]"><p class="truncate">${escP(p.vendedor||'—')}</p></td>
      <td class="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">${p.fecha_nv?new Date(p.fecha_nv).toLocaleDateString('es-CL'):'—'}</td>
      <td class="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">${escP(p.fecha_entrega||'—')}</td>
      <td class="px-3 py-2 text-xs text-slate-400">${escP(p.transporte||'—')}</td>
      <td class="px-3 py-2 text-xs text-slate-400">${escP(p.comuna||'—')}</td>
    </tr>`).join('') || `<tr><td colspan="10" class="text-center text-slate-300 py-10 text-sm">Sin resultados</td></tr>`;
  if (pag) {
    if (totalPag <= 1) { pag.innerHTML = ''; return; }
    pag.innerHTML = `
      <span class="text-xs text-slate-400">Página ${_pedidosPagina} de ${totalPag}</span>
      <div class="flex gap-2">
        <button onclick="irPagPed(${_pedidosPagina-1})" ${_pedidosPagina<=1?'disabled':''}
          class="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">Ant.</button>
        <button onclick="irPagPed(${_pedidosPagina+1})" ${_pedidosPagina>=totalPag?'disabled':''}
          class="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">Sig.</button>
      </div>`;
  }
}

window.irPagPed = function(p) { _pedidosPagina = p; renderTablaPed(); };

function badgePed(estado) {
  const e = (estado||'').toUpperCase();
  if (e.includes('ENTREGADO')||e.includes('FACTURADO')) return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap">${escP(estado)}</span>`;
  if (e.includes('RUTA')||e.includes('DESPACHADO')) return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">${escP(estado)}</span>`;
  if (e.includes('PREPARACI')||e.includes('PREPARADO')) return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">${escP(estado)}</span>`;
  if (e.includes('GUIA')) return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 whitespace-nowrap">${escP(estado)}</span>`;
  return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600 whitespace-nowrap">${escP(estado||'SIN ESTADO')}</span>`;
}

function escP(s) { return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
