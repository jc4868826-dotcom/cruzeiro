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
    <!-- BANNER -->
    <div class="rounded-2xl mb-6 px-6 py-5 flex items-center justify-between" style="background:linear-gradient(135deg,#0d5c8c 0%,#0a4a73 100%)">
      <div class="flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-xl">C</div>
        <div>
          <p class="text-white font-bold text-lg leading-tight">Cruzeiro Gomas</p>
          <p class="text-white/60 text-xs">FunnelOS · Panel de Control Comercial</p>
        </div>
      </div>
      <div class="text-right">
        <p id="dash-reloj" class="text-white font-semibold text-base tabular-nums"></p>
        <p class="text-white/50 text-xs mt-0.5">Santiago, Chile</p>
      </div>
    </div>

    <!-- FILTROS -->
    <div class="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-3 items-end">
      <div class="flex-1 min-w-[130px]">
        <label class="text-xs font-medium text-slate-500 block mb-1">Desde</label>
        <input type="date" id="f-desde" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]">
      </div>
      <div class="flex-1 min-w-[130px]">
        <label class="text-xs font-medium text-slate-500 block mb-1">Hasta</label>
        <input type="date" id="f-hasta" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]">
      </div>
      <div class="flex-1 min-w-[120px]">
        <label class="text-xs font-medium text-slate-500 block mb-1">Origen</label>
        <select id="f-origen" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
          <option value="">Todos</option>
          <option>whatsapp</option><option>web</option><option>referido</option>
        </select>
      </div>
      <div class="flex-1 min-w-[120px]">
        <label class="text-xs font-medium text-slate-500 block mb-1">Segmento</label>
        <select id="f-segmento" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
          <option value="">Todos</option>
          <option value="ecommerce">Ecommerce</option>
          <option value="mayorista">Mayorista</option>
        </select>
      </div>
      <button onclick="applyDashboardFilters()" class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-5 py-2 rounded-lg transition shrink-0">Filtrar</button>
    </div>

    <!-- 4 KPIs PRINCIPALES -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div onclick="showKpiDetail('todos')" class="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-[#0d5c8c] hover:shadow-md transition group">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-[#e8f4fd] flex items-center justify-center">
            <svg class="w-5 h-5 text-[#0d5c8c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <svg class="w-4 h-4 text-slate-300 group-hover:text-[#0d5c8c] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
        <p class="text-3xl font-bold text-[#0d5c8c]">${(minConv.total||0)+(mayConv.total||0)}</p>
        <p class="text-xs text-slate-500 mt-1 font-medium">Total Leads</p>
      </div>

      <div onclick="showKpiDetail('ecommerce')" class="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-emerald-400 hover:shadow-md transition group">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </div>
          <svg class="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
        <p class="text-3xl font-bold text-emerald-600">${minConv.total||0}</p>
        <p class="text-xs text-slate-500 mt-1 font-medium">Ecommerce</p>
      </div>

      <div onclick="showKpiDetail('mayorista')" class="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-indigo-400 hover:shadow-md transition group">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <svg class="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
        <p class="text-3xl font-bold text-indigo-600">${mayConv.total||0}</p>
        <p class="text-xs text-slate-500 mt-1 font-medium">Mayorista</p>
      </div>

      <div onclick="showKpiDetail('cerrados')" class="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-amber-400 hover:shadow-md transition group">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <svg class="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
        <p class="text-3xl font-bold text-amber-600">${minPct}%</p>
        <p class="text-xs text-slate-500 mt-1 font-medium">Conversión</p>
      </div>
    </div>

    <!-- GRID: ACORDEONES IZQUIERDA + PANEL DERECHO -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-6">

      <!-- Acordeones izquierda (3/5) -->
      <div class="lg:col-span-3 space-y-4">
        <div id="acc-ecommerce" class="bg-white border border-slate-200 rounded-xl overflow-hidden ${segFilter==='mayorista'?'hidden':''}">
          <button onclick="toggleAccordion('ecommerce')" class="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
            <div class="flex items-center gap-3">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span class="font-bold text-slate-800">Ecommerce</span>
              <span class="text-sm text-slate-400">· ${minConv.total} leads · ${minPct}% conv.</span>
            </div>
            <svg id="acc-ecommerce-chevron" class="w-5 h-5 text-slate-400" style="transition:transform .2s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="acc-ecommerce-body" class="border-t border-slate-100 px-5 pb-5">
            <div class="grid grid-cols-3 gap-3 pt-4">
              ${miniKpiCard('Conversión', minPct+'%', `${minConv.convertidos} de ${minConv.total}`,'cerrados','ecommerce')}
              ${miniKpiCard('Abandonos', seg.abandonos?.ecommerce??'—','leads','abandonos','ecommerce')}
              ${miniKpiCard('Derivaciones', seg.derivaciones_humano?.ecommerce??'—','a ejecutivo','derivaciones','ecommerce')}
            </div>
            ${subAccordionHtml('ecommerce-intenciones','Clasificación de interés','<div class="py-2 text-xs text-slate-400 text-center">Cargando...</div>')}
            ${subAccordionHtml('ecommerce-calidad','Calidad de leads',renderCalidadRows(metrics,'ecommerce'))}
            ${subAccordionHtml('ecommerce-familias','Familias consultadas',renderFamiliasRows(metrics))}
          </div>
        </div>

        <div id="acc-mayorista" class="bg-white border border-slate-200 rounded-xl overflow-hidden ${segFilter==='ecommerce'?'hidden':''}">
          <button onclick="toggleAccordion('mayorista')" class="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
            <div class="flex items-center gap-3">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <span class="font-bold text-slate-800">Mayorista</span>
              <span class="text-sm text-slate-400">· ${mayConv.total} leads · ${mayPct}% conv.</span>
            </div>
            <svg id="acc-mayorista-chevron" class="w-5 h-5 text-slate-400" style="transform:rotate(-90deg);transition:transform .2s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="acc-mayorista-body" class="border-t border-slate-100 px-5 pb-5 hidden">
            <div class="grid grid-cols-3 gap-3 pt-4">
              ${miniKpiCard('Conversión', mayPct+'%', `${mayConv.convertidos} de ${mayConv.total}`,'cerrados','mayorista')}
              ${miniKpiCard('Abandonos', seg.abandonos?.mayorista??'—','leads','abandonos','mayorista')}
              ${miniKpiCard('Derivaciones', seg.derivaciones_humano?.mayorista??'—','a ejecutivo','derivaciones','mayorista')}
            </div>
            ${subAccordionHtml('mayorista-intenciones','Clasificación de interés','<div class="py-2 text-xs text-slate-400 text-center">Cargando...</div>')}
            ${subAccordionHtml('mayorista-calidad','Calidad de leads',renderCalidadRows(metrics,'mayorista'))}
          </div>
        </div>

        <!-- Catálogo -->
        <div class="bg-white border border-slate-200 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-4">
            <svg class="w-4 h-4 text-[#0d5c8c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
            <h3 class="font-semibold text-slate-700 text-sm">Catálogo de Productos</h3>
            <p id="catalogo-actualizado" class="text-xs text-slate-400 ml-auto"></p>
          </div>
          <div class="grid grid-cols-3 gap-4 text-center">
            <div class="border border-slate-100 rounded-xl p-3">
              <p id="catalogo-total" class="text-2xl font-bold text-[#0d5c8c]">—</p>
              <p class="text-xs text-slate-400 mt-1">Total SKUs</p>
            </div>
            <div class="border border-slate-100 rounded-xl p-3">
              <p id="catalogo-stock" class="text-2xl font-bold text-emerald-600">—</p>
              <p class="text-xs text-slate-400 mt-1">Con stock</p>
            </div>
            <div class="border border-slate-100 rounded-xl p-3">
              <p id="catalogo-familias" class="text-2xl font-bold text-amber-600">—</p>
              <p class="text-xs text-slate-400 mt-1">Familias</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel derecho (2/5) -->
      <div class="lg:col-span-2 space-y-4">

        <!-- Campañas HSM -->
        <div class="bg-white border border-slate-200 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-4">
            <svg class="w-4 h-4 text-[#0d5c8c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
            <h3 class="font-semibold text-slate-700 text-sm">Campañas HSM</h3>
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${campKpi('Enviadas', camp.enviadas||0, '#0d5c8c')}
            ${campKpi('Entregadas', camp.entregadas||0, '#1a7db5')}
            ${campKpi('Leídas', camp.leidas||0, '#3299cc')}
            ${campKpi('Respondidas', camp.respondidas||0, '#50b4e0')}
          </div>
        </div>

        <!-- Leads en tiempo real -->
        <div class="bg-white border border-slate-200 rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <h3 class="font-semibold text-slate-700 text-sm">Últimos leads</h3>
            </div>
            <span class="text-xs text-slate-400">en vivo · 10s</span>
          </div>
          <div id="ultimos-leads-list">
            <p class="text-xs text-slate-400 text-center py-4">Cargando...</p>
          </div>
          <button onclick="navigate('leads')" class="mt-4 w-full text-xs text-[#0d5c8c] font-semibold border border-[#0d5c8c]/20 rounded-lg py-2 hover:bg-[#e8f4fd] transition">
            Ver todos los leads →
          </button>
        </div>

        <!-- Leads KPI período -->
        <div class="bg-white border border-slate-200 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-4">
            <h3 class="font-semibold text-slate-700 text-sm">Leads — período</h3>
            <span id="dash-leads-periodo" class="text-xs text-slate-400 ml-auto"></span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="text-center border border-slate-100 rounded-xl p-3">
              <p id="dash-leads-total" class="text-2xl font-bold text-[#0d5c8c]">—</p>
              <p class="text-xs text-slate-400 mt-1">Total</p>
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
              <p id="dash-leads-chat-test" class="text-2xl font-bold text-slate-500">—</p>
              <p class="text-xs text-slate-400 mt-1">Chat test</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- GRÁFICOS -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <h3 class="font-semibold text-slate-700 text-sm mb-4">Volumen de conversaciones (30 días)</h3>
        <canvas id="chart-volumen" height="180"></canvas>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <h3 class="font-semibold text-slate-700 text-sm mb-4">Tasa de conversión diaria</h3>
        <canvas id="chart-conversion" height="180"></canvas>
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
    if (el('catalogo-total')) el('catalogo-total').textContent = (r.total ?? '—').toLocaleString('es-CL');
    if (el('catalogo-stock')) el('catalogo-stock').textContent = (r.con_stock ?? '—').toLocaleString('es-CL');
    if (el('catalogo-familias')) el('catalogo-familias').textContent = (r.familias ?? '—').toLocaleString('es-CL');
    if (el('catalogo-actualizado') && r.actualizado_en) {
      el('catalogo-actualizado').textContent = 'Actualizado: ' + new Date(r.actualizado_en).toLocaleDateString('es-CL');
    }
  }).catch(() => {});

  // Reloj
  function _tickReloj() {
    const el = document.getElementById('dash-reloj');
    if (el) el.textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  _tickReloj();
  if (window._relojInt) clearInterval(window._relojInt);
  window._relojInt = setInterval(_tickReloj, 1000);
  setTimeout(refreshUltimosLeads, 150);
  setTimeout(refreshSegmentIntenciones, 250);
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
  const keyMap = { conversaciones:'volumen_lead_ids', cerrados:'cerrados_lead_ids', derivaciones:'derivaciones_lead_ids', abandonos:'abandonos_lead_ids', volumen:'volumen_lead_ids', todos:null, ecommerce:null, mayorista:null };
  const titleMap = { conversaciones:'Con conversación', cerrados:'Leads cerrados', derivaciones:'Derivados a humano', abandonos:'Leads abandonados', volumen:'Con conversación activa', todos:'Todos los leads', ecommerce:'Leads Ecommerce', mayorista:'Leads Mayorista' };

  document.getElementById('kpi-detail-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'kpi-detail-panel';
  panel.className = 'fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col';
  panel.innerHTML = `
    <div class="flex items-center justify-between p-4 border-b border-slate-200" style="background:#0d5c8c">
      <h3 class="font-semibold text-white text-sm">${titleMap[kpiKey]||kpiKey}${segmentoFilter?' — '+segmentoFilter:''}</h3>
      <button onclick="document.getElementById('kpi-detail-panel').remove()" class="text-white/70 hover:text-white p-1">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div id="kpi-detail-body" class="flex-1 overflow-y-auto p-4 space-y-2">
      <div class="text-sm text-slate-400 text-center py-8">Cargando...</div>
    </div>
  `;
  document.body.appendChild(panel);

  try {
    const res = await api.get('/api/leads?limit=200');
    let filtered = res.data || [];
    const allIds = keyMap[kpiKey] !== null ? (metrics[keyMap[kpiKey]]||[]) : null;
    if (allIds && allIds.length > 0) filtered = filtered.filter(l => allIds.includes(l.id));
    if (segmentoFilter) filtered = filtered.filter(l => (l.segmento||'ecommerce') === segmentoFilter);
    if (kpiKey === 'ecommerce') filtered = filtered.filter(l => (l.segmento||'ecommerce') === 'ecommerce');
    if (kpiKey === 'mayorista') filtered = filtered.filter(l => l.segmento === 'mayorista');

    document.getElementById('kpi-detail-body').innerHTML = filtered.length === 0
      ? '<p class="text-sm text-slate-400 text-center py-8">No hay leads.</p>'
      : filtered.map(l => `
        <div onclick="document.getElementById('kpi-detail-panel').remove();navigate('leads');setTimeout(()=>verLead('${l.id}'),400);"
          class="border border-slate-200 rounded-xl p-3 hover:border-[#0d5c8c] hover:bg-[#e8f4fd]/30 cursor-pointer transition">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-slate-800 text-sm truncate">${escHtml(l.nombre||'—')}</p>
              <p class="text-xs text-slate-500 mt-0.5">${escHtml(l.telefono||'')}</p>
            </div>
            ${estadoBadge(l.estado)}
          </div>
          <div class="mt-2 flex gap-2 flex-wrap">
            <span class="text-xs px-2 py-0.5 rounded-full font-medium ${l.segmento==='mayorista'?'bg-indigo-100 text-indigo-700':'bg-emerald-100 text-emerald-700'}">${l.segmento==='mayorista'?'Mayorista':'Ecommerce'}</span>
            ${l.ejecutivo_nombre?`<span class="text-xs text-slate-400">${escHtml(l.ejecutivo_nombre)}</span>`:''}
          </div>
        </div>`).join('');
  } catch {
    document.getElementById('kpi-detail-body').innerHTML = '<span class="text-red-500 text-sm">Error al cargar.</span>';
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

async function refreshUltimosLeads() {
  const c = document.getElementById('ultimos-leads-list');
  if (!c) return;
  try {
    const res = await api.get('/api/leads?limit=20');
    const leads = (res.data||[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);
    if (!leads.length) { c.innerHTML='<p class="text-xs text-slate-400 text-center py-4">Sin leads aún</p>'; return; }
    c.innerHTML = leads.map(l=>`
      <div onclick="document.getElementById('kpi-detail-panel')?.remove();navigate('leads');setTimeout(()=>verLead('${l.id}'),400);"
        class="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 px-1 rounded-lg transition">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-800 truncate">${escHtml(l.nombre||'—')}</p>
          <p class="text-xs text-slate-400">${new Date(l.createdAt).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</p>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${l.segmento==='mayorista'?'bg-indigo-100 text-indigo-700':'bg-emerald-100 text-emerald-700'}">
          ${l.segmento==='mayorista'?'B2B':'Web'}
        </span>
      </div>`).join('');
  } catch(_) {}
}

// ─── Sub-acordeón helper ──────────────────────────────────────────────────────

function subAccordionHtml(id, title, bodyHtml) {
  return `
    <div class="mt-3 border border-slate-100 rounded-xl overflow-hidden">
      <button onclick="toggleSubAccordion('${id}')"
        class="w-full flex items-center justify-between px-4 py-2.5 text-left bg-slate-50/80 hover:bg-slate-100 transition">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${title}</span>
        <svg id="sub-${id}-chevron" class="w-4 h-4 text-slate-400 shrink-0"
          style="transform:rotate(-90deg);transition:transform .2s"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div id="sub-${id}-body" class="hidden px-4 pb-3 pt-1 space-y-0.5">
        ${bodyHtml}
      </div>
    </div>
  `;
}

function toggleSubAccordion(id) {
  const body = document.getElementById(`sub-${id}-body`);
  const chevron = document.getElementById(`sub-${id}-chevron`);
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

// ─── Sección B: Calidad de leads (render sincrónico desde metrics) ────────────

function renderCalidadRows(metrics, segmento) {
  const cal = metrics.calidad?.[segmento] || {};
  const rows = [
    { key: 'bajo',      label: 'Bajo',       dot: 'bg-slate-400',   bar: 'bg-slate-400',   text: 'text-slate-600',   sub: '1 mensaje, sin continuidad' },
    { key: 'medio',     label: 'Medio',      dot: 'bg-amber-400',   bar: 'bg-amber-400',   text: 'text-amber-600',   sub: 'Interactuó, sin señal de compra' },
    { key: 'alto',      label: 'Alto',       dot: 'bg-blue-400',    bar: 'bg-blue-400',    text: 'text-blue-600',    sub: 'Pidió precio, medidas o link' },
    { key: 'convertido',label: 'Convertido', dot: 'bg-emerald-400', bar: 'bg-emerald-400', text: 'text-emerald-600', sub: 'Recibió link o fue derivado' },
  ];
  const max = Math.max(...rows.map(r => cal[r.key] || 0), 1);
  return rows.map(r => {
    const n = cal[r.key] || 0;
    const pct = Math.round((n / max) * 100);
    return `
      <div onclick="showSegmentDetail('${segmento}','calidad_lead','${r.key}')"
        class="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-50 transition">
        <span class="w-2.5 h-2.5 rounded-full ${r.dot} shrink-0"></span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700">${r.label}</span>
            <span class="text-xs font-bold ${r.text} ml-2">${n}</span>
          </div>
          <div class="text-xs text-slate-400 mt-0.5 mb-1">${r.sub}</div>
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full ${r.bar} rounded-full transition-all" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Sección C: Familias consultadas (solo ecommerce, render sincrónico) ──────

function renderFamiliasRows(metrics) {
  const familias = metrics.familias || [];
  if (!familias.length) return '<p class="text-xs text-slate-400 py-2 text-center">Sin datos</p>';
  const max = Math.max(...familias.map(f => f.total), 1);
  return familias.map(f => {
    const pct = Math.round((f.total / max) * 100);
    return `
      <div class="flex items-center gap-3 py-1.5">
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700 truncate">${escHtml(f.nombre)}</span>
            <span class="text-xs font-bold text-[#0d5c8c] ml-2">${f.total}</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div class="h-full bg-[#0d5c8c] rounded-full transition-all" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Sección A: Clasificación de interés (async, carga leads desde API) ───────

const _INTENCION_LABELS = {
  producto:         'Interés en producto',
  precio:           'Consulta de precio',
  stock:            'Consulta de stock',
  consulta_pedido:  'Estado de pedido',
  pago:             'Proceso de pago',
  mayorista:        'Canal mayorista',
  info_general:     'Información general',
  consulta_catalogo:'Catálogo general',
  sin_clasificar:   'Sin clasificar',
};

const _INTENCION_COLORS = [
  'bg-violet-400','bg-blue-400','bg-emerald-400','bg-amber-400',
  'bg-rose-400','bg-indigo-400','bg-teal-400','bg-orange-400','bg-slate-400',
];

async function refreshSegmentIntenciones() {
  try {
    const res = await api.get('/api/leads?limit=500');
    const leads = res.data || [];
    ['ecommerce', 'mayorista'].forEach(seg => {
      const bodyEl = document.getElementById(`sub-${seg}-intenciones-body`);
      if (!bodyEl) return;
      const segLeads = leads.filter(l => (l.segmento || 'ecommerce') === seg);
      const counts = {};
      segLeads.forEach(l => {
        const k = l.intencion_principal || 'sin_clasificar';
        counts[k] = (counts[k] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (!sorted.length) {
        bodyEl.innerHTML = '<p class="text-xs text-slate-400 py-2 text-center">Sin datos</p>';
        return;
      }
      const max = sorted[0][1];
      bodyEl.innerHTML = sorted.map(([k, n], i) => {
        const label = _INTENCION_LABELS[k] || k;
        const pct = Math.round((n / max) * 100);
        const dotColor = _INTENCION_COLORS[i % _INTENCION_COLORS.length];
        return `
          <div onclick="showSegmentDetail('${seg}','intencion_principal','${k}')"
            class="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-50 transition">
            <span class="w-2.5 h-2.5 rounded-full ${dotColor} shrink-0"></span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-slate-700">${label}</span>
                <span class="text-xs font-bold text-slate-800 ml-2">${n}</span>
              </div>
              <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div class="h-full ${dotColor} rounded-full transition-all" style="width:${pct}%"></div>
              </div>
            </div>
          </div>`;
      }).join('');
    });
  } catch (_) {}
}

// ─── Panel lateral: detalle por segmento + campo ─────────────────────────────

async function showSegmentDetail(segmento, campo, valor) {
  document.getElementById('kpi-detail-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'kpi-detail-panel';
  panel.className = 'fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col';

  const _CALIDAD_LABELS = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', convertido: 'Convertido' };
  const valorLabel = _INTENCION_LABELS[valor] || _CALIDAD_LABELS[valor] || valor;
  const segLabel = segmento === 'mayorista' ? 'Mayorista' : 'Ecommerce';

  panel.innerHTML = `
    <div class="flex items-center justify-between p-4 border-b border-slate-200" style="background:#0d5c8c">
      <h3 class="font-semibold text-white text-sm">${segLabel} · ${valorLabel}</h3>
      <button onclick="document.getElementById('kpi-detail-panel').remove()" class="text-white/70 hover:text-white p-1">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div id="kpi-detail-body" class="flex-1 overflow-y-auto p-4 space-y-2">
      <div class="text-sm text-slate-400 text-center py-8">Cargando...</div>
    </div>
  `;
  document.body.appendChild(panel);

  try {
    const res = await api.get('/api/leads?limit=200');
    const _defaultVal = campo === 'calidad_lead' ? 'bajo' : 'sin_clasificar';
    const filtered = (res.data || []).filter(l =>
      (l.segmento || 'ecommerce') === segmento &&
      (l[campo] || _defaultVal) === valor
    );
    document.getElementById('kpi-detail-body').innerHTML = filtered.length === 0
      ? '<p class="text-sm text-slate-400 text-center py-8">No hay leads.</p>'
      : filtered.map(l => `
        <div onclick="document.getElementById('kpi-detail-panel').remove();navigate('leads');setTimeout(()=>verLead('${l.id}'),400);"
          class="border border-slate-200 rounded-xl p-3 hover:border-[#0d5c8c] hover:bg-[#e8f4fd]/30 cursor-pointer transition">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-slate-800 text-sm truncate">${escHtml(l.nombre||'—')}</p>
              <p class="text-xs text-slate-500 mt-0.5">${escHtml(l.telefono||'')}</p>
            </div>
            ${estadoBadge(l.estado)}
          </div>
          <div class="mt-2 flex gap-2 flex-wrap">
            <span class="text-xs px-2 py-0.5 rounded-full font-medium ${l.segmento==='mayorista'?'bg-indigo-100 text-indigo-700':'bg-emerald-100 text-emerald-700'}">${l.segmento==='mayorista'?'Mayorista':'Ecommerce'}</span>
            ${l.ejecutivo_nombre?`<span class="text-xs text-slate-400">${escHtml(l.ejecutivo_nombre)}</span>`:''}
          </div>
        </div>`).join('');
  } catch {
    document.getElementById('kpi-detail-body').innerHTML = '<span class="text-red-500 text-sm">Error al cargar.</span>';
  }
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
