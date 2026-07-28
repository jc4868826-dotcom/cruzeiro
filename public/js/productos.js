'use strict';

let _productosData = [];
let _productosFiltrados = [];
let _productosPagina = 1;
const _PROD_POR_PAG = 50;

async function renderProductos(container) {
  container.innerHTML = `<div class="flex items-center justify-center h-32 text-slate-400 text-sm">Cargando catálogo...</div>`;
  try {
    _productosData = await api.get('/api/productos');
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-red-500 text-sm">Error: ${escHtml(e.message)}</div>`;
    return;
  }

  if (!_productosData.length) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <p class="text-slate-400 text-sm mb-3">Sin datos — sube el catálogo en la sección Archivos</p>
        <a href="#archivos" onclick="navigate('archivos')"
          class="text-sm text-[#0d5c8c] underline underline-offset-2">Ir a Archivos</a>
      </div>`;
    return;
  }

  const familias = [...new Set(_productosData.filter(p => p.stock > 0).map(p => p.familia).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const categorias = [...new Set(_productosData.map(p => p.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const proveedores = [...new Set(_productosData.filter(p => p.stock > 0).map(p => p.proveedor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));

  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[200px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Buscar</label>
          <input id="prod-search" type="text" placeholder="SKU, descripción o familia..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            oninput="filtrarProductos()">
        </div>
        <div class="min-w-[180px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Familia</label>
          <select id="prod-familia"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarProductos()">
            <option value="">Todas</option>
            ${familias.map(f => `<option value="${escHtml(f)}">${escHtml(f)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[180px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Categoría</label>
          <select id="prod-categoria"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarProductos()">
            <option value="">Todas</option>
            ${categorias.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[180px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Proveedor</label>
          <select id="prod-proveedor"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarProductos()">
            <option value="">Todos</option>
            ${proveedores.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[110px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Precio mín.</label>
          <input id="prod-precio-min" type="number" min="0" placeholder="0"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            oninput="filtrarProductos()">
        </div>
        <div class="min-w-[110px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Precio máx.</label>
          <input id="prod-precio-max" type="number" min="0" placeholder="∞"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]"
            oninput="filtrarProductos()">
        </div>
        <div class="flex items-end gap-2">
          <label class="flex items-center gap-2 text-sm text-slate-600 pb-2 cursor-pointer">
            <input type="checkbox" id="prod-solo-stock" onchange="filtrarProductos()"
              class="w-4 h-4 accent-[#0d5c8c]">
            Solo con stock
          </label>
        </div>
        <button onclick="limpiarFiltrosProductos()"
          class="text-xs text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition whitespace-nowrap self-end">
          Limpiar filtros
        </button>
        <div class="pb-2 self-end">
          <span id="prod-contador" class="text-xs text-slate-400">—</span>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[900px]">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">SKU</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Descripción</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Familia</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Categoría</th>
                <th class="text-right text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Stock</th>
                <th class="text-right text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Precio</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Unidad</th>
              </tr>
            </thead>
            <tbody id="prod-tbody"></tbody>
          </table>
        </div>
        <div id="prod-paginacion" class="border-t border-slate-100 px-4 py-3 flex items-center justify-between"></div>
      </div>
    </div>`;

  filtrarProductos();
}

window.filtrarProductos = function() {
  const q = (document.getElementById('prod-search')?.value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const familia = document.getElementById('prod-familia')?.value || '';
  const categoria = document.getElementById('prod-categoria')?.value || '';
  const proveedor = document.getElementById('prod-proveedor')?.value || '';
  const precioMin = parseFloat(document.getElementById('prod-precio-min')?.value) || 0;
  const precioMax = parseFloat(document.getElementById('prod-precio-max')?.value) || Infinity;
  const soloStock = document.getElementById('prod-solo-stock')?.checked;

  _productosFiltrados = _productosData.filter(p => {
    if (soloStock && p.stock <= 0) return false;
    if (familia && p.familia !== familia) return false;
    if (categoria && p.categoria !== categoria) return false;
    if (proveedor && p.proveedor !== proveedor) return false;
    if (precioMin > 0 && p.precio < precioMin) return false;
    if (precioMax < Infinity && p.precio > precioMax) return false;
    if (q) {
      const hay = [p.sku, p.nombre, p.familia, p.categoria].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  _productosPagina = 1;
  renderTablaProd();
};

window.limpiarFiltrosProductos = function() {
  ['prod-search','prod-familia','prod-categoria','prod-proveedor','prod-precio-min','prod-precio-max'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const cb = document.getElementById('prod-solo-stock');
  if (cb) cb.checked = false;
  filtrarProductos();
};

function renderTablaProd() {
  const tbody = document.getElementById('prod-tbody');
  const pag = document.getElementById('prod-paginacion');
  const contador = document.getElementById('prod-contador');
  if (!tbody) return;

  const total = _productosFiltrados.length;
  const totalPag = Math.ceil(total / _PROD_POR_PAG) || 1;
  _productosPagina = Math.min(_productosPagina, totalPag);
  const slice = _productosFiltrados.slice((_productosPagina - 1) * _PROD_POR_PAG, _productosPagina * _PROD_POR_PAG);

  if (contador) contador.textContent = `Mostrando ${slice.length} de ${total} productos`;

  tbody.innerHTML = slice.map(p => {
    const stockColor = p.stock > 20 ? 'text-emerald-600' : p.stock > 0 ? 'text-amber-600' : 'text-red-500';
    return `<tr class="border-b border-slate-100 hover:bg-slate-50 transition">
      <td class="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">${escHtml(p.sku)}</td>
      <td class="px-4 py-2.5 text-slate-700 max-w-xs"><p class="truncate" title="${escHtml(p.nombre)}">${escHtml(p.nombre)}</p></td>
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(p.familia)}</td>
      <td class="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">${escHtml(p.categoria)}</td>
      <td class="px-4 py-2.5 text-right font-semibold ${stockColor} whitespace-nowrap">${p.stock}</td>
      <td class="px-4 py-2.5 text-right font-medium text-slate-700 whitespace-nowrap">$${Number(p.precio).toLocaleString('es-CL')}</td>
      <td class="px-4 py-2.5 text-xs text-slate-400">${escHtml(p.unidad)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="text-center text-slate-300 py-10 text-sm">Sin resultados</td></tr>`;

  if (pag) {
    if (totalPag <= 1) { pag.innerHTML = ''; return; }
    pag.innerHTML = `
      <span class="text-xs text-slate-400">Página ${_productosPagina} de ${totalPag}</span>
      <div class="flex gap-2">
        <button onclick="irPagProd(${_productosPagina - 1})" ${_productosPagina <= 1 ? 'disabled' : ''}
          class="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">Ant.</button>
        <button onclick="irPagProd(${_productosPagina + 1})" ${_productosPagina >= totalPag ? 'disabled' : ''}
          class="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">Sig.</button>
      </div>`;
  }
}

window.irPagProd = function(p) { _productosPagina = p; renderTablaProd(); };

function escHtml(s) { return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
