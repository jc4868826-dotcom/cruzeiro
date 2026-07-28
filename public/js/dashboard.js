// ─── Dashboard ────────────────────────────────────────────────────────────────

async function renderDashboard(container, prefetched = null, filterState = null) {
  const [metrics, trends] = prefetched || await Promise.all([
    api.get('/api/dashboard/metrics').catch(() => ({})),
    api.get('/api/dashboard/trends').catch(() => ({ trends: [] })),
  ]);
  window._dashMetrics = metrics;

  const seg = metrics.segmento || {};
  const minConv = seg.conversion?.ecommerce || { convertidos: 0, total: 0 };
  const mayConv = seg.conversion?.mayorista || { convertidos: 0, total: 0 };
  const minPct = minConv.total > 0 ? ((minConv.convertidos / minConv.total) * 100).toFixed(1) : '0.0';
  const mayPct = mayConv.total > 0 ? ((mayConv.convertidos / mayConv.total) * 100).toFixed(1) : '0.0';
  const camp = metrics.rendimiento_campanas || {};
  const segFilter = filterState?.segmento || '';

  container.innerHTML = `
    <!-- Filtros -->
    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex flex-wrap gap-4 items-end">
      <div class="flex-1 min-w-[160px]">
        <label class="text-xs font-medium text-slate-500 block mb-1">Desde</label>
        <input type="date" id="f-desde" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
      </div>
      <div class="flex-1 min-w-[160px]">
        <label class="text-xs font-medium text-slate-500 block mb-1">Hasta</label>
        <input type="date" id="f-hasta" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
      </div>
      <div class="flex-1 min-w-[140px]">
        <label class="text-xs font-medium text-slate-500 block mb-1">Origen</label>
        <select id="f-origen" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
          <option value="">Todos</option>
          <option>whatsapp</option>
          <option>web</option>
          <option>referido</option>
        </select>
      </div>
      <div class="flex-1 min-w-[140px]">
        <label class="text-xs font-medium text-slate-500 block mb-1">Segmento</label>
        <select id="f-segmento" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
          <option value="">Todos</option>
          <option value="ecommerce">Ecommerce</option>
          <option value="mayorista">Mayorista</option>
        </select>
      </div>
      <button onclick="applyDashboardFilters()"
        class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
        Filtrar
      </button>
    </div>

    <!-- Acordeón Ecommerce -->
    <div id="acc-ecommerce" class="bg-white border border-slate-200 rounded-xl mb-4 overflow-hidden ${segFilter === 'mayorista' ? 'hidden' : ''}">
      <button onclick="toggleAccordion('ecommerce')"
        class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors">
        <div class="flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-emerald-400 shrink-0"></span>
          <span class="font-bold text-slate-800 text-base">Ecommerce</span>
          <span class="text-sm text-slate-500">· ${minConv.total} leads · ${minPct}% conversión</span>
        </div>
        <svg id="acc-ecommerce-chevron" class="w-5 h-5 text-slate-400 shrink-0" style="transition:transform .2s" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div id="acc-ecommerce-body" class="border-t border-slate-100 px-5 pb-5">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          ${miniKpiCard('Conversaciones', seg.conversaciones?.ecommerce ?? '—', 'chats de este segmento', 'conversaciones', 'ecommerce')}
          ${miniKpiCard('Conversión', minPct + '%', `${minConv.convertidos} de ${minConv.total} cerrados`, 'cerrados', 'ecommerce')}
          ${miniKpiCard('Abandonos', seg.abandonos?.ecommerce ?? '—', 'leads abandonados', 'abandonos', 'ecommerce')}
          ${miniKpiCard('Derivaciones', seg.derivaciones_humano?.ecommerce ?? '—', 'derivados a ejecutivo', 'derivaciones', 'ecommerce')}
        </div>
      </div>
    </div>

    <!-- Acordeón Mayorista -->
    <div id="acc-mayorista" class="bg-white border border-slate-200 rounded-xl mb-5 overflow-hidden ${segFilter === 'ecommerce' ? 'hidden' : ''}">
      <button onclick="toggleAccordion('mayorista')"
        class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors">
        <div class="flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-indigo-500 shrink-0"></span>
          <span class="font-bold text-slate-800 text-base">Mayorista</span>
          <span class="text-sm text-slate-500">· ${mayConv.total} leads · ${mayPct}% conversión</span>
        </div>
        <svg id="acc-mayorista-chevron" class="w-5 h-5 text-slate-400 shrink-0" style="transform:rotate(-90deg);transition:transform .2s" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div id="acc-mayorista-body" class="border-t border-slate-100 px-5 pb-5 hidden">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          ${miniKpiCard('Conversaciones', seg.conversaciones?.mayorista ?? '—', 'chats de este segmento', 'conversaciones', 'mayorista')}
          ${miniKpiCard('Conversión', mayPct + '%', `${mayConv.convertidos} de ${mayConv.total} cerrados`, 'cerrados', 'mayorista')}
          ${miniKpiCard('Abandonos', seg.abandonos?.mayorista ?? '—', 'leads abandonados', 'abandonos', 'mayorista')}
          ${miniKpiCard('Derivaciones', seg.derivaciones_humano?.mayorista ?? '—', 'derivados a ejecutivo', 'derivaciones', 'mayorista')}
        </div>
      </div>
    </div>

    <!-- Campañas HSM (transversal, fuera de acordeones) -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 mb-5">
      <div class="flex items-center gap-2 mb-4">
        <svg class="w-5 h-5 text-[#0d5c8c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
        </svg>
        <h3 class="font-semibold text-slate-700 text-sm">Campañas HSM — Resumen global</h3>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-6">
        ${campKpi('Enviadas', camp.enviadas || 0, '#0d5c8c')}
        ${campKpi('Entregadas', camp.entregadas || 0, '#1a7db5')}
        ${campKpi('Leídas', camp.leidas || 0, '#3299cc')}
        ${campKpi('Respondidas', camp.respondidas || 0, '#50b4e0')}
      </div>
    </div>

    <!-- Leads KPI -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 mb-5">
      <div class="flex items-center gap-2 mb-4">
        <svg class="w-5 h-5 text-[#0d5c8c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <h3 class="font-semibold text-slate-700 text-sm">Leads — período seleccionado</h3>
        <span id="dash-leads-periodo" class="text-xs text-slate-400 ml-auto"></span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="text-center border border-slate-100 rounded-xl p-3">
          <p id="dash-leads-total" class="text-2xl font-bold text-[#0d5c8c]">—</p>
          <p class="text-xs text-slate-400 mt-1">Total leads</p>
        </div>
        <div class="text-center border border-slate-100 rounded-xl p-3">
          <p id="dash-leads-nuevos" class="text-2xl font-bold text-emerald-600">—</p>
          <p class="text-xs text-slate-400 mt-1">Nuevos</p>
        </div>
        <div class="text-center border border-slate-100 rounded-xl p-3">
          <p id="dash-leads-cerrados" class="text-2xl font-bold text-indigo-600">—</p>
          <p class="text-xs text-slate-400 mt-1">Cerrados</p>
        </div>
        <div class="text-center border border-slate-100 rounded-xl p-3">
          <p id="dash-leads-chat-test" class="text-2xl font-bold text-slate-600">—</p>
          <p class="text-xs text-slate-400 mt-1">Chat de Prueba</p>
        </div>
      </div>
    </div>

    <!-- Catálogo -->
    <div id="dashboard-catalogo" class="bg-white border border-slate-200 rounded-xl p-5 mb-5">
      <div class="flex items-center gap-2 mb-4">
        <svg class="w-5 h-5 text-[#0d5c8c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <h3 class="font-semibold text-slate-700 text-sm">Catálogo de Productos</h3>
        <span id="catalogo-actualizado" class="text-xs text-slate-400 ml-auto"></span>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div class="text-center">
          <p id="cat-total" class="text-2xl font-bold text-[#0d5c8c]">—</p>
          <p class="text-xs text-slate-500 mt-0.5">Total SKUs</p>
        </div>
        <div class="text-center">
          <p id="cat-stock" class="text-2xl font-bold text-emerald-600">—</p>
          <p class="text-xs text-slate-500 mt-0.5">Con stock</p>
        </div>
        <div class="text-center">
          <p id="cat-familias" class="text-2xl font-bold text-slate-700">—</p>
          <p class="text-xs text-slate-500 mt-0.5">Familias</p>
        </div>
      </div>
    </div>

    <!-- Gráficos de tendencia -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-slate-700 mb-4">Volumen de conversaciones (30 días)</h3>
        <canvas id="chart-volumen" height="200"></canvas>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-slate-700 mb-4">Tasa de conversión diaria</h3>
        <canvas id="chart-conversion" height="200"></canvas>
      </div>
    </div>
  `;

  const dias = trends.trends || [];
  const labels = dias.map(d => d.fecha ? d.fecha.slice(5) : '');

  App.charts.volumen = new Chart(document.getElementById('chart-volumen'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Conversaciones',
        data: dias.map(d => d.volumen_conversaciones || 0),
        borderColor: '#0d5c8c',
        backgroundColor: 'rgba(13,92,140,0.08)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#0d5c8c',
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } },
      },
    },
  });

  App.charts.conversion = new Chart(document.getElementById('chart-conversion'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Conversión %',
        data: dias.map(d => d.tasa_conversion || 0),
        backgroundColor: 'rgba(13,92,140,0.7)',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } },
      },
    },
  });

  refreshLeadsKPIs('', '');

  api.get('/api/catalogo').then(data => {
    const r = data.resumen || {};
    const el = id => document.getElementById(id);
    if (el('cat-total')) el('cat-total').textContent = (r.total ?? '—').toLocaleString('es-CL');
    if (el('cat-stock')) el('cat-stock').textContent = (r.con_stock ?? '—').toLocaleString('es-CL');
    if (el('cat-familias')) el('cat-familias').textContent = (r.familias ?? '—').toLocaleString('es-CL');
    if (el('catalogo-actualizado') && r.actualizado_en) {
      el('catalogo-actualizado').textContent = 'Actualizado: ' + new Date(r.actualizado_en).toLocaleDateString('es-CL');
    }
  }).catch(() => {});
}

function miniKpiCard(title, value, sub, kpiKey, segmento) {
  return `
    <div onclick="showKpiDetail('${kpiKey}', '${segmento}')"
      class="border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-[#0d5c8c] hover:bg-[#f8fbff] transition-colors">
      <p class="text-xs font-medium text-slate-500 mb-2">${title}</p>
      <p class="text-2xl font-bold text-slate-800">${value}</p>
      <p class="text-xs text-slate-400 mt-1">${sub}</p>
    </div>
  `;
}

function campKpi(label, value, color) {
  return `
    <div class="text-center border border-slate-100 rounded-xl p-3">
      <p class="text-2xl font-bold" style="color:${color}">${Number(value).toLocaleString('es-CL')}</p>
      <p class="text-xs text-slate-400 mt-1">${label}</p>
    </div>
  `;
}

function toggleAccordion(id) {
  const body = document.getElementById(`acc-${id}-body`);
  const chevron = document.getElementById(`acc-${id}-chevron`);
  if (!body) return;
  const isOpen = !body.classList.contains('hidden');
  if (isOpen) {
    body.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
  } else {
    body.classList.remove('hidden');
    if (chevron) chevron.style.transform = '';
  }
}

async function showKpiDetail(kpiKey, segmentoFilter = null) {
  const metrics = window._dashMetrics || {};
  const keyMap = {
    conversaciones: 'volumen_lead_ids',
    cerrados: 'cerrados_lead_ids',
    derivaciones: 'derivaciones_lead_ids',
    abandonos: 'abandonos_lead_ids',
    volumen: 'volumen_lead_ids',
  };
  const titleMap = {
    conversaciones: 'Con conversación',
    cerrados: 'Leads cerrados',
    derivaciones: 'Derivados a humano',
    abandonos: 'Leads abandonados',
    volumen: 'Con conversación activa',
  };

  const allIds = metrics[keyMap[kpiKey]] || [];
  const segLabel = segmentoFilter ? ` — ${segmentoFilter}` : '';

  document.getElementById('kpi-detail-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'kpi-detail-panel';
  panel.className = 'fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col';
  panel.innerHTML = `
    <div class="flex items-center justify-between p-4 border-b border-slate-200">
      <h3 class="font-semibold text-slate-800">${titleMap[kpiKey] || kpiKey}${segLabel}</h3>
      <button onclick="document.getElementById('kpi-detail-panel').remove()" class="text-slate-400 hover:text-slate-700 p-1">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div id="kpi-detail-body" class="flex-1 overflow-y-auto p-4 text-sm text-slate-400">Cargando...</div>
  `;
  document.body.appendChild(panel);

  if (allIds.length === 0 && !segmentoFilter) {
    document.getElementById('kpi-detail-body').innerHTML = 'No hay leads en esta categoría.';
    return;
  }

  try {
    const res = await api.get('/api/leads?limit=200');
    let filtered = allIds.length > 0
      ? (res.data || []).filter(l => allIds.includes(l.id))
      : (res.data || []);
    if (segmentoFilter) {
      filtered = filtered.filter(l => (l.segmento || 'ecommerce') === segmentoFilter);
    }
    document.getElementById('kpi-detail-body').innerHTML = filtered.length === 0
      ? 'No hay leads en esta categoría.'
      : filtered.map(l => `
        <div class="border border-slate-200 rounded-lg p-3 mb-2 hover:bg-slate-50">
          <p class="font-medium text-slate-800">${l.nombre || '—'}</p>
          <p class="text-xs text-slate-500 mt-0.5">${l.telefono || ''} · ${l.segmento || 'sin segmento'}</p>
          <div class="mt-1.5">${estadoBadge(l.estado)}</div>
        </div>
      `).join('');
  } catch {
    document.getElementById('kpi-detail-body').innerHTML = '<span class="text-red-500">Error al cargar leads.</span>';
  }
}

async function refreshLeadsKPIs(desde, hasta) {
  try {
    const params = new URLSearchParams({ limit: 1000 });
    if (desde) params.set('fecha_desde', desde);
    if (hasta) params.set('fecha_hasta', hasta);
    const res = await api.get(`/api/leads?${params}`);
    const leads = res.data || [];
    const el = id => document.getElementById(id);
    if (el('dash-leads-total')) el('dash-leads-total').textContent = leads.length;
    if (el('dash-leads-nuevos')) el('dash-leads-nuevos').textContent = leads.filter(l => l.estado === 'Nuevo').length;
    if (el('dash-leads-cerrados')) el('dash-leads-cerrados').textContent = leads.filter(l => l.estado === 'Cerrado').length;
    if (el('dash-leads-chat-test')) el('dash-leads-chat-test').textContent = leads.filter(l => l.origen === 'chat_test').length;
    if (el('dash-leads-periodo')) {
      el('dash-leads-periodo').textContent = (desde || hasta) ? `${desde||'inicio'} → ${hasta||'hoy'}` : 'Todos los tiempos';
    }
  } catch (_) {}
}

async function applyDashboardFilters() {
  const desde = document.getElementById('f-desde')?.value || '';
  const hasta = document.getElementById('f-hasta')?.value || '';
  const origen = document.getElementById('f-origen')?.value || '';
  const segmento = document.getElementById('f-segmento')?.value || '';
  const params = new URLSearchParams({ desde, hasta, origen, segmento });

  Object.values(App.charts).forEach(c => { try { c.destroy(); } catch (e) {} });
  App.charts = {};

  const container = document.getElementById('view-container');
  try {
    const [metrics, trends] = await Promise.all([
      api.get(`/api/dashboard/metrics?${params}`).catch(() => ({})),
      api.get(`/api/dashboard/trends?${params}`).catch(() => ({ trends: [] })),
    ]);
    const filterState = { desde, hasta, origen, segmento };
    await renderDashboard(container, [metrics, trends], filterState);
    if (desde) document.getElementById('f-desde').value = desde;
    if (hasta) document.getElementById('f-hasta').value = hasta;
    if (origen) document.getElementById('f-origen').value = origen;
    if (segmento) document.getElementById('f-segmento').value = segmento;
    await refreshLeadsKPIs(desde, hasta);
  } catch {
    navigate('dashboard');
  }
}
