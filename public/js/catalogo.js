// ─── Catálogo ─────────────────────────────────────────────────────────────────

async function renderCatalogo(container) {
  const [res, syncStatus] = await Promise.all([
    api.get('/api/catalogo?v=2').catch(() => ({ data: [] })),
    api.get('/api/catalogo/sync/status').catch(() => ({ ultima_sync: null, total_productos: 0 })),
  ]);

  const productos = res.data || [];

  // Obtener categorías únicas
  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort();

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Header con sync -->
      <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4 justify-between">
        <div class="flex flex-wrap gap-3 flex-1">
          <input id="cat-search" type="text" placeholder="Buscar SKU o descripción..."
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20"
            oninput="filtrarCatalogo()">
          <select id="cat-categoria"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarCatalogo()">
            <option value="">Todas las categorías</option>
            ${categorias.map(c => `<option>${c}</option>`).join('')}
          </select>
          <select id="cat-activo"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="filtrarCatalogo()">
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <div class="flex items-center gap-4 shrink-0">
          <div class="text-xs text-slate-400 text-right">
            <p>Última sync: <span class="font-medium text-slate-600">${syncStatus.ultima_sync ? formatDate(syncStatus.ultima_sync) : 'Nunca'}</span></p>
            <p><span class="font-medium text-slate-600">${syncStatus.total_productos || productos.length}</span> productos en catálogo</p>
          </div>
          <button onclick="sincronizarCatalogo()" id="sync-btn"
            class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Sincronizar
          </button>
        </div>
      </div>

      <!-- Stats rápidas -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-slate-800">${productos.length}</p>
          <p class="text-xs text-slate-400 mt-1">Total productos</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-emerald-600">${productos.filter(p => p.tiene_stock).length}</p>
          <p class="text-xs text-slate-400 mt-1">Con stock</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-red-500">${productos.filter(p => !p.stock || p.stock === 0).length}</p>
          <p class="text-xs text-slate-400 mt-1">Sin stock</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-[#0d5c8c]">${categorias.length}</p>
          <p class="text-xs text-slate-400 mt-1">Categorías</p>
        </div>
      </div>

      <!-- Tabla -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[700px]">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">SKU</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Descripción</th>
                <th class="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Categoría</th>
                <th class="text-right text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Precio</th>
                <th class="text-right text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Familia</th>
                <th class="text-right text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Stock</th>
                <th class="text-center text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wide">Unidad</th>
              </tr>
            </thead>
            <tbody id="catalogo-tbody">
              ${productos.length
                ? productos.map(p => filaCatalogo(p)).join('')
                : `<tr><td colspan="7" class="text-center text-slate-300 text-sm py-14">
                    Sin productos. Haz clic en <strong>Sincronizar</strong> para importar el catálogo.
                  </td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  window._catalogoProductos = productos;
}

function filaCatalogo(p) {
  const stock = p.stock ?? 0;
  const stockColor = stock > 20 ? 'text-emerald-600' : stock > 0 ? 'text-yellow-600' : 'text-red-500';
  return `
    <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
      <td class="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">${p.sku || '—'}</td>
      <td class="px-5 py-3 font-medium text-slate-700 max-w-xs">
        <p class="truncate" title="${p.nombre_web || p.descripcion || ''}">${p.nombre_web || p.descripcion || '—'}</p>
      </td>
      <td class="px-5 py-3 whitespace-nowrap">${badge(p.categoria || 'Sin categoría', 'gray')}</td>
      <td class="px-5 py-3 text-right font-medium text-slate-700 whitespace-nowrap">${formatCLP(p.precio || p.precio_venta || 0)}</td>
      <td class="px-5 py-3 text-right font-medium text-slate-500 whitespace-nowrap text-xs">${p.familia || '—'}</td>
      <td class="px-5 py-3 text-right font-bold ${stockColor} whitespace-nowrap">${stock}</td>
      <td class="px-5 py-3 text-center whitespace-nowrap text-xs text-slate-500">${p.unidad || 'C/U'}</td>
    </tr>
  `;
}

function formatCLP(n) {
  if (n == null || n === '') return '—';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(n);
}

function filtrarCatalogo() {
  const q = document.getElementById('cat-search')?.value?.toLowerCase() || '';
  const cat = document.getElementById('cat-categoria')?.value || '';
  const activoFilter = document.getElementById('cat-activo')?.value || '';

  const filtered = (window._catalogoProductos || []).filter(p => {
    const matchQ = !q || (p.nombre_web?.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    const matchCat = !cat || p.categoria === cat;
    const matchActivo = !activoFilter || String(p.tiene_stock) === activoFilter;
    return matchQ && matchCat && matchActivo;
  });

  const tbody = document.getElementById('catalogo-tbody');
  if (tbody) {
    tbody.innerHTML = filtered.length
      ? filtered.map(p => filaCatalogo(p)).join('')
      : `<tr><td colspan="7" class="text-center text-slate-300 text-sm py-10">Sin productos que coincidan</td></tr>`;
  }
}

async function sincronizarCatalogo() {
  const btn = document.getElementById('sync-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      Sincronizando...
    `;
  }
  try {
    const result = await api.post('/api/catalogo/sync', {});
    await renderCatalogo(document.getElementById('view-container'));
    // Show success briefly
    const newBtn = document.getElementById('sync-btn');
    if (newBtn) {
      newBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Sincronizado
      `;
      newBtn.classList.remove('bg-[#0d5c8c]', 'hover:bg-[#0a4a73]');
      newBtn.classList.add('bg-emerald-600');
      setTimeout(() => {
        newBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Sincronizar
        `;
        newBtn.classList.remove('bg-emerald-600');
        newBtn.classList.add('bg-[#0d5c8c]', 'hover:bg-[#0a4a73]');
        newBtn.disabled = false;
      }, 2500);
    }
  } catch (e) {
    alert('Error al sincronizar: ' + e.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Sincronizar
      `;
    }
  }
}
