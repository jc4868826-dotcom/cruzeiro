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
  const segFilter = filterState?.segmento || '';

  const leadsRes = await api.get('/api/leads?limit=500').catch(() => ({ data: [] }));
  const todosLeads = leadsRes.data || [];
  const leadsEcom = todosLeads.filter(l => (l.segmento||'ecommerce') === 'ecommerce');
  const leadsMay  = todosLeads.filter(l => l.segmento === 'mayorista');

  // FIX 2: normalize etapa_pipeline — leads con ejecutivo asignado que no estén cerrados = 'derivado'
  for (const l of todosLeads) {
    if (l.ejecutivo_asignado && !['ganado','Cerrado','cerrado'].includes(l.etapa_pipeline)) {
      l.etapa_pipeline = 'derivado';
    }
  }

  const convertidosEcom  = metrics.calidad?.ecommerce?.convertido || 0;
  const convertidosMay   = metrics.calidad?.mayorista?.convertido || 0;
  const totalConvertidos = convertidosEcom + convertidosMay;
  const totalLeads       = (minConv.total||0) + (mayConv.total||0);
  const tasaConvTotal    = totalLeads > 0 ? ((totalConvertidos / totalLeads) * 100).toFixed(1) : '0.0';
  const mayDerivados     = leadsMay.filter(l => l.etapa_pipeline === 'derivado').length;

  container.innerHTML = `
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
        <p class="text-3xl font-bold text-[#0d5c8c]">${totalLeads}</p>
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

      <div onclick="showKpiDetail('cerrados')" class="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-emerald-400 hover:shadow-md transition group">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <svg class="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
        <p class="text-3xl font-bold text-emerald-600">${totalConvertidos}</p>
        <p class="text-xs text-slate-500 mt-1 font-medium">Convertidos &middot; ${tasaConvTotal}% tasa conv.</p>
      </div>
    </div>

    <!-- ACORDEONES -->
    <div class="space-y-4 mb-6">

      <!-- Acordeón ECOMMERCE — abierto por defecto -->
      <div id="acc-ecommerce" class="bg-white border border-slate-200 rounded-xl overflow-hidden ${segFilter==='mayorista'?'hidden':''}">
        <button onclick="toggleAccordion('ecommerce')" class="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Ecommerce &middot; ${minConv.total} leads &middot; ${minPct}% conv.
            </span>
          </div>
          <svg id="acc-ecommerce-chevron" class="w-5 h-5 text-slate-400" style="transition:transform .2s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div id="acc-ecommerce-body" class="border-t border-slate-100 px-5 pb-5">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div class="bg-slate-50 rounded-xl p-4">
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Calidad del lead</p>
              ${renderCalidadRows(metrics, 'ecommerce')}
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Qu&eacute; buscan</p>
              ${renderFamiliasRows(leadsEcom)}
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Status</p>
              ${renderStatusRows(leadsEcom, 'ecommerce')}
            </div>
          </div>
        </div>
      </div>

      <!-- Acordeón MAYORISTA — cerrado por defecto -->
      <div id="acc-mayorista" class="bg-white border border-slate-200 rounded-xl overflow-hidden ${segFilter==='ecommerce'?'hidden':''}">
        <button onclick="toggleAccordion('mayorista')" class="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Mayorista &middot; ${mayConv.total} leads &middot; ${mayDerivados} derivados
            </span>
          </div>
          <svg id="acc-mayorista-chevron" class="w-5 h-5 text-slate-400" style="transform:rotate(-90deg);transition:transform .2s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div id="acc-mayorista-body" class="border-t border-slate-100 px-5 pb-5 hidden">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div class="bg-slate-50 rounded-xl p-4">
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Calidad del lead</p>
              ${renderCalidadRows(metrics, 'mayorista')}
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Motivo de contacto</p>
              ${renderMotivoRows(leadsMay)}
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Status</p>
              ${renderStatusRows(leadsMay, 'mayorista')}
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Ejecutivos hoy</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              ${renderEjecutivosCards(leadsMay)}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ÚLTIMOS LEADS -->
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <h3 class="font-semibold text-slate-700 text-sm">Últimos leads</h3>
        </div>
        <span class="text-xs text-slate-400">en vivo &middot; 10s</span>
      </div>
      <div id="ultimos-leads-list">
        <p class="text-xs text-slate-400 text-center py-4">Cargando...</p>
      </div>
      <button onclick="navigate('leads')" class="mt-4 w-full text-xs text-[#0d5c8c] font-semibold border border-[#0d5c8c]/20 rounded-lg py-2 hover:bg-[#e8f4fd] transition">
        Ver todos los leads →
      </button>
    </div>
  `;

  refreshLeadsKPIs('', '');
  setTimeout(refreshUltimosLeads, 150);
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
    const leads = (res.data||[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);
    if (!leads.length) { c.innerHTML='<p class="text-xs text-slate-400 text-center py-4">Sin leads aún</p>'; return; }
    const _calidadChip = {
      bajo:       'bg-slate-100 text-slate-600',
      medio:      'bg-amber-100 text-amber-700',
      alto:       'bg-blue-100 text-blue-700',
      convertido: 'bg-green-100 text-green-700',
    };
    c.innerHTML = leads.map(l => {
      const calidad = l.calidad_lead || 'bajo';
      const calidadClass = _calidadChip[calidad] || _calidadChip.bajo;
      const calidadLabel = calidad.charAt(0).toUpperCase() + calidad.slice(1);
      const motivo = l.familia_interes || l.intencion_principal || '';
      const motivoLabel = _INTENCION_LABELS[motivo] || motivo;
      const tiempo = new Date(l.createdAt).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
      return `
        <div onclick="document.getElementById('kpi-detail-panel')?.remove();navigate('leads');setTimeout(()=>verLead('${l.id}'),400);"
          class="flex items-start justify-between py-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 px-1 rounded-lg transition gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <p class="text-sm font-medium text-slate-800 truncate">${escHtml(l.nombre||'—')}</p>
              <span class="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${l.segmento==='mayorista'?'bg-indigo-100 text-indigo-700':'bg-emerald-100 text-emerald-700'}">${l.segmento==='mayorista'?'May':'Eco'}</span>
              <span class="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${calidadClass}">${calidadLabel}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
              ${estadoBadge(l.estado)}
              ${motivoLabel ? `<span class="text-xs text-slate-400">${escHtml(motivoLabel)}</span>` : ''}
            </div>
          </div>
          <span class="text-xs text-slate-400 shrink-0 mt-0.5">${tiempo}</span>
        </div>`;
    }).join('');
  } catch(_) {}
}

// ─── Interés del lead ─────────────────────────────────────────────────────────

function renderIntencionesRows(intencionesObj, segmento) {
  const entries = Object.entries(intencionesObj).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return '<p class="text-xs text-slate-400 py-1 px-2">Sin clasificar · 0</p>';
  }
  if (entries.length === 1 && entries[0][0] === 'sin_clasificar') {
    return `<div class="flex items-center gap-3 py-1.5 px-2"><span class="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0"></span><span class="text-xs text-slate-500">Sin clasificar · ${entries[0][1]}</span></div>`;
  }
  const max = entries[0][1];
  return entries.map(([k, n], i) => {
    const label = _INTENCION_LABELS[k] || k;
    const pct = Math.round((n / max) * 100);
    const dotColor = _INTENCION_COLORS[i % _INTENCION_COLORS.length];
    return `
      <div onclick="showSegmentDetail('${segmento}','intencion_principal','${k}')"
        class="flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-slate-50 transition">
        <span class="w-2.5 h-2.5 rounded-full ${dotColor} shrink-0"></span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700">${label}</span>
            <span class="text-xs font-bold text-slate-700 ml-2">${n}</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div class="h-full ${dotColor} rounded-full" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Calidad del lead ─────────────────────────────────────────────────────────

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

// ─── Status del lead ──────────────────────────────────────────────────────────

function _derivarStatusEcommerce(lead) {
  const ep = lead.etapa_pipeline || 'nuevo';
  const hasLink = !!lead.link_carrito_enviado;
  if (hasLink || ep === 'ganado' || ep === 'cotizado') return 'ganado';
  if (ep === 'derivado') return 'derivado';
  if (ep === 'calificado' || (ep === 'nuevo' && (lead.mensajes_count || 0) > 2)) return 'en_conversacion';
  if (ep === 'perdido' || (ep === 'nuevo' && (lead.mensajes_count || 0) <= 1)) return 'abandonado';
  return 'en_conversacion';
}

function _derivarStatusMayorista(lead) {
  const ep = lead.etapa_pipeline || '';
  if (['Cerrado', 'cerrado', 'ganado'].includes(ep)) return 'cerrado';
  if (ep === 'derivado' || ep === 'Contactado') return 'en_gestion';
  if (lead.ejecutivo_asignado) return 'notificado';
  return 'identificado';
}

function generarDonutSVG(segments, totalLeads) {
  const R = 44, cx = 55, cy = 55;
  const C = 2 * Math.PI * R;
  const totalN = segments.reduce((s, seg) => s + seg.n, 0) || 1;
  let acc = 0;
  const circles = segments.filter(s => s.n > 0).map(({ n, color }) => {
    const len = (n / totalN) * C;
    const rotateDeg = (acc / totalN) * 360 - 90;
    acc += n;
    return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${color}" stroke-width="18" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" transform="rotate(${rotateDeg.toFixed(1)} ${cx} ${cy})"/>`;
  });
  if (!circles.length) circles.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="18"/>`);
  const n = totalLeads !== undefined ? totalLeads : totalN;
  const centerText = `<text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="18" font-weight="700" fill="#1e293b">${n}</text><text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="9" fill="#94a3b8">leads</text>`;
  return `<svg viewBox="0 0 110 110" width="110" height="110">${circles.join('')}<circle cx="${cx}" cy="${cy}" r="30" fill="white"/>${centerText}</svg>`;
}

function renderStatusRows(leads, segmento) {
  const rowsEcom = [
    { key: 'ganado',          label: 'Ganado',          color: '#10b981', chipCss: 'bg-emerald-50 text-emerald-700', chip: 'Link o cotiz.' },
    { key: 'derivado',        label: 'Derivado',         color: '#6366f1', chipCss: 'bg-indigo-50 text-indigo-700',   chip: 'Con ejecutivo' },
    { key: 'en_conversacion', label: 'En conversación',  color: '#06b6d4', chipCss: 'bg-cyan-50 text-cyan-700',       chip: 'Bot activo' },
    { key: 'abandonado',      label: 'Abandonado',       color: '#f59e0b', chipCss: 'bg-amber-50 text-amber-700',     chip: '+48h sin resp.' },
  ];
  const rowsMay = [
    { key: 'identificado', label: 'Identificado', color: '#f59e0b', chipCss: 'bg-amber-50 text-amber-700',    chip: 'RUT + exec.' },
    { key: 'notificado',   label: 'Notificado',   color: '#06b6d4', chipCss: 'bg-cyan-50 text-cyan-700',      chip: 'Alerta enviada' },
    { key: 'en_gestion',   label: 'En gestión',   color: '#10b981', chipCss: 'bg-emerald-50 text-emerald-700', chip: 'Contactado' },
    { key: 'cerrado',      label: 'Cerrado',      color: '#94a3b8', chipCss: 'bg-slate-100 text-slate-600',    chip: 'Resuelto' },
  ];
  const rows = segmento === 'mayorista' ? rowsMay : rowsEcom;
  const deriver = segmento === 'mayorista' ? _derivarStatusMayorista : _derivarStatusEcommerce;
  const counts = {};
  for (const l of leads) {
    const k = deriver(l);
    counts[k] = (counts[k] || 0) + 1;
  }
  const total = leads.length || 1;

  const cards = rows.map(r => {
    const n = counts[r.key] || 0;
    const pct = Math.round((n / total) * 100);
    return `
      <div onclick="showSegmentDetail('${segmento}','_status','${r.key}')"
        class="flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-white transition">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${r.color}"></span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700">${r.label}</span>
            <div class="flex items-center gap-1.5">
              <span class="text-xs px-1.5 py-0.5 rounded-full font-medium ${r.chipCss}">${r.chip}</span>
              <span class="text-xs font-bold text-slate-700">${n}</span>
            </div>
          </div>
          <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
            <div class="h-full rounded-full transition-all" style="width:${pct}%;background:${r.color}"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  const segments = rows.map(r => ({ n: counts[r.key] || 0, color: r.color }));

  return `
    <div class="flex flex-col items-center gap-2">
      <div>${generarDonutSVG(segments, leads.length)}</div>
      <div class="w-full">${cards}</div>
    </div>`;
}

// ─── Familias de catálogo (Qué buscan) ───────────────────────────────────────

function renderFamiliasRows(leads) {
  const _JUNK = new Set(['', 'Catálogo general', 'Sin clasificar', 'sin_clasificar']);
  const _COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
  const counts = {};
  for (const l of leads) {
    const f = (l.familia_interes || '').trim();
    if (!f || _JUNK.has(f)) continue;
    counts[f] = (counts[f] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5);
  const otrasN = sorted.slice(5).reduce((s, [, n]) => s + n, 0);
  const max = top5[0]?.[1] || 1;
  if (!top5.length) {
    return '<p class="text-xs text-slate-400 py-1 px-2">Sin familias clasificadas aún</p>';
  }
  const rows = top5.map(([familia, n], i) => {
    const pct = Math.round((n / max) * 100);
    const color = _COLORS[i % _COLORS.length];
    return `
      <div onclick="showSegmentDetail('ecommerce','familia_interes',${JSON.stringify(familia)})"
        class="flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-slate-50 transition">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${color}"></span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700 truncate">${escHtml(familia)}</span>
            <span class="text-xs font-bold text-slate-700 ml-2">${n}</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div class="h-full rounded-full" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
      </div>`;
  });
  if (otrasN > 0) {
    rows.push(`<div class="flex items-center gap-3 py-1.5 px-2"><span class="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-300"></span><span class="text-xs text-slate-400">Otras familias (${otrasN})</span></div>`);
  }
  return rows.join('');
}

// ─── Motivo de contacto mayorista ─────────────────────────────────────────────

function renderMotivoRows(leadsMay) {
  const motivos = [
    { key: 'producto',        label: 'Venta nueva',        dotClass: 'bg-teal-400',   barClass: 'bg-teal-400' },
    { key: 'consulta_pedido', label: 'Estado pedido',      dotClass: 'bg-purple-400', barClass: 'bg-purple-400' },
    { key: 'precio',          label: 'Cotización',         dotClass: 'bg-amber-400',  barClass: 'bg-amber-400' },
    { key: 'escalar',         label: 'Reclamo / urgencia', dotClass: 'bg-red-400',    barClass: 'bg-red-400' },
    { key: 'sin_clasificar',  label: 'Sin clasificar',     dotClass: 'bg-slate-400',  barClass: 'bg-slate-400' },
  ];
  const counts = {};
  for (const l of leadsMay) {
    const k = l.intencion_principal || 'sin_clasificar';
    counts[k] = (counts[k] || 0) + 1;
  }
  const max = Math.max(...motivos.map(m => counts[m.key] || 0), 1);
  return motivos.map(m => {
    const n = counts[m.key] || 0;
    const pct = Math.round((n / max) * 100);
    return `
      <div onclick="showSegmentDetail('mayorista','intencion_principal','${m.key}')"
        class="flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-white transition">
        <span class="w-2.5 h-2.5 rounded-full ${m.dotClass} shrink-0"></span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700">${m.label}</span>
            <span class="text-xs font-bold text-slate-700 ml-2">${n}</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div class="h-full ${m.barClass} rounded-full" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Tarjetas de ejecutivos ───────────────────────────────────────────────────

function renderEjecutivosCards(leadsMay) {
  const ejecutivos = [
    { username: 'nicolas.pacheco', nombre: 'N. Pacheco', iniciales: 'NP' },
    { username: 'irma.jara',       nombre: 'I. Jara',    iniciales: 'IJ' },
    { username: 'cynthia.romo',    nombre: 'C. Romo',    iniciales: 'CR' },
    { username: 'marcos.diamond',  nombre: 'M. Diamond', iniciales: 'MD' },
  ];
  return ejecutivos.map(ej => {
    const leadsEj = leadsMay.filter(l => l.ejecutivo_asignado === ej.username);
    const statuses = leadsEj.map(_derivarStatusMayorista);
    const tieneEnGestion  = statuses.includes('en_gestion');
    const tieneNotificado = statuses.includes('notificado');
    const chipClass = leadsEj.length === 0
      ? 'bg-slate-100 text-slate-500'
      : tieneEnGestion
        ? 'bg-green-100 text-green-700'
        : tieneNotificado
          ? 'bg-blue-100 text-blue-700'
          : 'bg-amber-100 text-amber-700';
    const chipLabel = leadsEj.length === 0
      ? 'Sin actividad'
      : tieneEnGestion
        ? 'En gestión'
        : tieneNotificado
          ? 'Notificado'
          : 'Identificado';
    return `
      <div onclick="showSegmentDetail('mayorista','ejecutivo_asignado','${ej.username}')"
        class="bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition flex flex-col items-center gap-2 text-center">
        <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">${ej.iniciales}</div>
        <p class="text-xs font-semibold text-slate-700">${ej.nombre}</p>
        <p class="text-lg font-bold text-slate-800">${leadsEj.length}</p>
        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${chipClass}">${chipLabel}</span>
      </div>`;
  }).join('');
}

// ─── Etiquetas y colores de intenciones ──────────────────────────────────────

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
    let filtered;
    if (campo === '_status') {
      const deriver = segmento === 'mayorista' ? _derivarStatusMayorista : _derivarStatusEcommerce;
      // apply same normalization
      const rawLeads = res.data || [];
      for (const l of rawLeads) {
        if (l.ejecutivo_asignado && !['ganado','Cerrado','cerrado'].includes(l.etapa_pipeline)) {
          l.etapa_pipeline = 'derivado';
        }
      }
      filtered = rawLeads.filter(l => (l.segmento || 'ecommerce') === segmento && deriver(l) === valor);
    } else {
      const _defaultVal = campo === 'calidad_lead' ? 'bajo' : 'sin_clasificar';
      filtered = (res.data || []).filter(l =>
        (l.segmento || 'ecommerce') === segmento &&
        (l[campo] || _defaultVal) === valor
      );
    }
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
