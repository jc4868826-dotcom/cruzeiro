'use strict';

let _clientesData = [];
let _clientesFiltrados = [];
let _clientesPagina = 1;
const _CLI_POR_PAG = 50;

async function renderClientes(container) {
  container.innerHTML = `<div class="flex items-center justify-center h-32 text-slate-400 text-sm">Cargando clientes...</div>`;
  try {
    const res = await api.get('/api/clientes?limit=5000');
    _clientesData = res.data || [];
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-red-500 text-sm">Error: ${escC(e.message)}</div>`;
    return;
  }

  if (!_clientesData.length) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <p class="text-slate-400 text-sm mb-3">Sin datos — sube el archivo de clientes en la sección Archivos</p>
        <a href="#archivos" onclick="navigate('archivos')"
          class="text-sm text-[#0d5c8c] underline underline-offset-2">Ir a Archivos</a>
      </div>`;
    return;
  }

  const canales = [...new Set(_clientesData.map(c => c.canal).filter(Boolean))].sort();
  const vendedores = [...new Set(_clientesData.map(c => c.vendedor_actual).filter(Boolean))].sort();
  const regiones = [...new Set(_clientesData.map(c => c.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));

  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[200px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Buscar RUT o Razón Social</label>
          <input id="cli-search" type="text" placeholder="RUT o nombre..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            oninput="filtrarClientes()">
        </div>
        <div class="min-w-[150px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Canal</label>
          <select id="cli-canal"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarClientes()">
            <option value="">Todos</option>
            ${canales.map(c => `<option value="${escC(c)}">${escC(c)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[180px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Vendedor</label>
          <select id="cli-vendedor"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarClientes()">
            <option value="">Todos</option>
            ${vendedores.map(v => `<option value="${escC(v)}">${escC(v)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[150px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Región</label>
          <select id="cli-region"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarClientes()">
            <option value="">Todas</option>
            ${regiones.map(r => `<option value="${escC(r)}">${escC(r)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[130px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Últ. venta desde</label>
          <input id="cli-venta-desde" type="date"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarClientes()">
        </div>
        <div class="min-w-[130px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Últ. venta hasta</label>
          <input id="cli-venta-hasta" type="date"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarClientes()">
        </div>
        <button onclick="limpiarFiltrosClientes()"
          class="text-xs text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition whitespace-nowrap self-end">
          Limpiar filtros
        </button>
        <div class="pb-2 self-end"><span id="cli-contador" class="text-xs text-slate-400">—</span></div>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[800px]">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">RUT</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Razón Social</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Canal</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Vendedor</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Región</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Última Venta</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody id="cli-tbody"></tbody>
          </table>
        </div>
        <div id="cli-paginacion" class="border-t border-slate-100 px-4 py-3 flex items-center justify-between"></div>
      </div>
    </div>

    <div id="cli-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/30 p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div id="cli-modal-content"></div>
      </div>
    </div>`;

  filtrarClientes();
}

window.filtrarClientes = function() {
  const q = (document.getElementById('cli-search')?.value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const canal = document.getElementById('cli-canal')?.value || '';
  const vendedor = document.getElementById('cli-vendedor')?.value || '';
  const region = document.getElementById('cli-region')?.value || '';
  const ventaDesde = document.getElementById('cli-venta-desde')?.value || '';
  const ventaHasta = document.getElementById('cli-venta-hasta')?.value || '';

  _clientesFiltrados = _clientesData.filter(c => {
    if (canal && c.canal !== canal) return false;
    if (vendedor && c.vendedor_actual !== vendedor) return false;
    if (region && c.region !== region) return false;
    if (ventaDesde && c.ultima_venta && c.ultima_venta < ventaDesde) return false;
    if (ventaHasta && c.ultima_venta && c.ultima_venta > ventaHasta + 'T23:59:59') return false;
    if (q) {
      const hay = [c.rut, c.nombre].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  _clientesPagina = 1;
  renderTablaClientes();
};

window.limpiarFiltrosClientes = function() {
  ['cli-search','cli-canal','cli-vendedor','cli-region','cli-venta-desde','cli-venta-hasta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filtrarClientes();
};

function renderTablaClientes() {
  const tbody = document.getElementById('cli-tbody');
  const pag = document.getElementById('cli-paginacion');
  const contador = document.getElementById('cli-contador');
  if (!tbody) return;
  const total = _clientesFiltrados.length;
  const totalPag = Math.ceil(total / _CLI_POR_PAG) || 1;
  _clientesPagina = Math.min(_clientesPagina, totalPag);
  const slice = _clientesFiltrados.slice((_clientesPagina - 1) * _CLI_POR_PAG, _clientesPagina * _CLI_POR_PAG);
  if (contador) contador.textContent = `Mostrando ${slice.length} de ${total} clientes`;
  tbody.innerHTML = slice.map(c => `
    <tr class="border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer" onclick="abrirCliente('${escC(c.rut)}')">
      <td class="px-4 py-2.5 font-mono text-xs text-slate-600">${escC(c.rut)}${c.dv ? '-'+escC(c.dv) : ''}</td>
      <td class="px-4 py-2.5 text-slate-800 font-medium max-w-xs"><p class="truncate">${escC(c.nombre)}</p></td>
      <td class="px-4 py-2.5 text-xs">${badgeCanal(c.canal)}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500">${escC(c.vendedor_actual||'—')}</td>
      <td class="px-4 py-2.5 text-xs text-slate-400">${escC(c.region||'—')}</td>
      <td class="px-4 py-2.5 text-xs text-slate-400">${c.ultima_venta ? new Date(c.ultima_venta).toLocaleDateString('es-CL') : '—'}</td>
      <td class="px-4 py-2.5"><button class="text-xs text-[#0d5c8c] underline underline-offset-2">Ver</button></td>
    </tr>`).join('') || `<tr><td colspan="7" class="text-center text-slate-300 py-10 text-sm">Sin resultados</td></tr>`;
  if (pag) {
    if (totalPag <= 1) { pag.innerHTML = ''; return; }
    pag.innerHTML = `
      <span class="text-xs text-slate-400">Página ${_clientesPagina} de ${totalPag}</span>
      <div class="flex gap-2">
        <button onclick="irPagCli(${_clientesPagina-1})" ${_clientesPagina<=1?'disabled':''}
          class="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">Ant.</button>
        <button onclick="irPagCli(${_clientesPagina+1})" ${_clientesPagina>=totalPag?'disabled':''}
          class="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">Sig.</button>
      </div>`;
  }
}

window.irPagCli = function(p) { _clientesPagina = p; renderTablaClientes(); };

window.abrirCliente = async function(rut) {
  const modal = document.getElementById('cli-modal');
  const content = document.getElementById('cli-modal-content');
  if (!modal || !content) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  content.innerHTML = `<div class="p-6 text-slate-400 text-sm">Cargando...</div>`;
  try {
    const [cliente, pedidosArr] = await Promise.all([
      api.get(`/api/clientes/${encodeURIComponent(rut)}`),
      api.get(`/api/pedidos/rut/${encodeURIComponent(rut)}`).catch(() => []),
    ]);
    content.innerHTML = `
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="font-bold text-slate-800">${escC(cliente.nombre)}</h3>
        <button onclick="cerrarCliModal()" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-3 text-sm">
          ${[['RUT', (cliente.rut||'')+(cliente.dv?'-'+cliente.dv:'')],['Email',cliente.email||'—'],['Fono',cliente.fono||'—'],['Canal',cliente.canal||'—'],['Vendedor',cliente.vendedor_actual||'—'],['Región',cliente.region||'—'],['Ciudad',cliente.ciudad||'—'],['Dirección',cliente.direccion||'—']].map(([l,v])=>`<div><p class="text-xs text-slate-400 font-medium">${l}</p><p class="text-slate-700">${escC(v)}</p></div>`).join('')}
        </div>
        <div class="border-t border-slate-100 pt-4">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pedidos activos</p>
          ${Array.isArray(pedidosArr) && pedidosArr.length ? `
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead><tr class="bg-slate-50 border-b border-slate-200">${['NV','Estado','Fecha NV','Entrega','Transporte'].map(h=>`<th class="text-left px-3 py-2 font-semibold text-slate-500">${h}</th>`).join('')}</tr></thead>
                <tbody>${pedidosArr.map(n=>`<tr class="border-b border-slate-100"><td class="px-3 py-2 font-mono font-semibold text-[#0d5c8c]">${escC(n.nv)}</td><td class="px-3 py-2">${badgeEstadoPed(n.estado)}</td><td class="px-3 py-2 text-slate-400">${n.fecha_nv?new Date(n.fecha_nv).toLocaleDateString('es-CL'):'—'}</td><td class="px-3 py-2 text-slate-400">${escC(n.fecha_entrega||'—')}</td><td class="px-3 py-2 text-slate-400">${escC(n.transporte||'—')}</td></tr>`).join('')}</tbody>
              </table>
            </div>` : `<p class="text-slate-300 text-sm">Sin pedidos activos para este cliente.</p>`}
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="p-6 text-red-500 text-sm">${escC(e.message)}</div>`;
  }
};

window.cerrarCliModal = function() {
  const m = document.getElementById('cli-modal');
  if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
};

function badgeCanal(canal) {
  const c = (canal||'').toLowerCase();
  if (c === 'ecommerce') return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">${escC(canal)}</span>`;
  if (c.includes('mayorista')) return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">${escC(canal)}</span>`;
  if (c.includes('mercado')) return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">${escC(canal)}</span>`;
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${escC(canal||'—')}</span>`;
}

function badgeEstadoPed(estado) {
  const e = (estado||'').toUpperCase();
  if (e.includes('ENTREGADO')||e.includes('FACTURADO')) return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">${escC(estado)}</span>`;
  if (e.includes('RUTA')||e.includes('DESPACHADO')) return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">${escC(estado)}</span>`;
  if (e.includes('PREPARACI')||e.includes('PREPARADO')) return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">${escC(estado)}</span>`;
  if (e.includes('GUIA')) return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">${escC(estado)}</span>`;
  return `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">${escC(estado||'SIN ESTADO')}</span>`;
}

function escC(s) { return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
