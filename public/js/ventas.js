'use strict';

let _ventasDataFull = null;

async function renderVentas(container) {
  container.innerHTML = `<div class="flex items-center justify-center h-32 text-slate-400 text-sm">Cargando ventas...</div>`;
  try {
    _ventasDataFull = await api.get('/api/ventas/resumen');
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-red-500 text-sm">Error: ${escV(e.message)}</div>`;
    return;
  }

  if (!_ventasDataFull || !_ventasDataFull.total_PxQ) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <p class="text-slate-400 text-sm mb-3">Sin datos — sube el archivo de ventas en la sección Archivos</p>
        <a href="#archivos" onclick="navigate('archivos')" class="text-sm text-[#0d5c8c] underline underline-offset-2">Ir a Archivos</a>
      </div>`;
    return;
  }

  const mesesDisponibles = Object.keys(_ventasDataFull.por_mes || {});
  const canalesDisponibles = Object.keys(_ventasDataFull.por_canal || {});

  container.innerHTML = `
    <div class="space-y-5">
      <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div class="min-w-[160px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Período</label>
          <select id="v-mes"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="aplicarFiltrosVentas()">
            <option value="">Todos los meses</option>
            ${mesesDisponibles.map(m => `<option value="${escV(m)}">${escV(m.charAt(0).toUpperCase()+m.slice(1))}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-[160px]">
          <label class="text-xs font-medium text-slate-500 block mb-1">Canal</label>
          <select id="v-canal"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]"
            onchange="aplicarFiltrosVentas()">
            <option value="">Todos los canales</option>
            ${canalesDisponibles.map(c => `<option value="${escV(c)}">${escV(c)}</option>`).join('')}
          </select>
        </div>
        <button onclick="limpiarFiltrosVentas()"
          class="text-xs text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition whitespace-nowrap self-end">
          Limpiar filtros
        </button>
        <span id="v-aviso" class="text-xs text-amber-600 self-end hidden"></span>
      </div>
      <div id="v-kpis" class="grid grid-cols-2 lg:grid-cols-4 gap-4"></div>
      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-slate-700 mb-4">Ventas por Mes (PxQ CLP)</h3>
        <canvas id="chart-ventas-mes" height="180"></canvas>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="bg-white border border-slate-200 rounded-xl p-5">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">Por Canal</h3>
          <div id="v-tabla-canal"></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-5">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">Top 20 Familias</h3>
          <div id="v-tabla-familias" class="space-y-2 max-h-80 overflow-y-auto pr-1"></div>
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-slate-700 mb-3">Por Vendedor</h3>
        <div id="v-tabla-vendedor" class="overflow-x-auto"></div>
      </div>
    </div>`;

  aplicarFiltrosVentas();
}

window.aplicarFiltrosVentas = function() {
  const data = _ventasDataFull;
  if (!data) return;

  const mesSelec = document.getElementById('v-mes')?.value || '';
  const canalSelec = document.getElementById('v-canal')?.value || '';
  const aviso = document.getElementById('v-aviso');

  if (mesSelec && canalSelec) {
    if (aviso) { aviso.textContent = 'Filtro combinado mes+canal no disponible en vista resumida.'; aviso.classList.remove('hidden'); }
  } else {
    if (aviso) aviso.classList.add('hidden');
  }

  let totalPxQ, totalDocs, clientesUnicos, avgDoc;
  let mesesLabels, mesesVals, canales, familias, vendedores;

  if (mesSelec && !canalSelec) {
    const m = data.por_mes[mesSelec] || { PxQ: 0, documentos: 0 };
    totalPxQ = m.PxQ;
    totalDocs = m.documentos;
    clientesUnicos = '—';
    avgDoc = totalDocs > 0 ? Math.round(totalPxQ / totalDocs) : 0;
    mesesLabels = [mesSelec];
    mesesVals = [totalPxQ];
    canales = Object.entries(data.por_canal || {}).sort((a,b)=>b[1].PxQ-a[1].PxQ);
    familias = data.por_familia || [];
    vendedores = Object.entries(data.por_vendedor || {}).sort((a,b)=>b[1].PxQ-a[1].PxQ);
  } else if (canalSelec && !mesSelec) {
    const c = data.por_canal[canalSelec] || { PxQ: 0, clientes: 0 };
    totalPxQ = c.PxQ;
    totalDocs = '—';
    clientesUnicos = c.clientes;
    avgDoc = '—';
    mesesLabels = Object.keys(data.por_mes || {});
    mesesVals = mesesLabels.map(m => data.por_mes[m].PxQ);
    canales = [[canalSelec, c]];
    familias = data.por_familia || [];
    vendedores = Object.entries(data.por_vendedor || {}).sort((a,b)=>b[1].PxQ-a[1].PxQ);
  } else {
    totalPxQ = data.total_PxQ || 0;
    totalDocs = data.total_documentos || 0;
    clientesUnicos = Object.values(data.por_canal || {}).reduce((s,c)=>s+(c.clientes||0),0);
    avgDoc = totalDocs > 0 ? Math.round(totalPxQ / totalDocs) : 0;
    mesesLabels = Object.keys(data.por_mes || {});
    mesesVals = mesesLabels.map(m => data.por_mes[m].PxQ);
    canales = Object.entries(data.por_canal || {}).sort((a,b)=>b[1].PxQ-a[1].PxQ);
    familias = data.por_familia || [];
    vendedores = Object.entries(data.por_vendedor || {}).sort((a,b)=>b[1].PxQ-a[1].PxQ);
  }

  const fmtPxQ = v => typeof v === 'number' ? '$'+Math.round(v).toLocaleString('es-CL') : String(v);
  const fmtNum = v => typeof v === 'number' ? v.toLocaleString('es-CL') : String(v);

  const kpisEl = document.getElementById('v-kpis');
  if (kpisEl) kpisEl.innerHTML = `
    ${kpiV('Total Vendido',''+fmtPxQ(totalPxQ),'text-[#0d5c8c]')}
    ${kpiV('Documentos',''+fmtNum(totalDocs),'text-slate-700')}
    ${kpiV('Clientes únicos',''+fmtNum(clientesUnicos),'text-emerald-600')}
    ${kpiV('Promedio/doc',''+fmtPxQ(avgDoc),'text-indigo-600')}`;

  if (window.App?.charts) {
    if (window.App.charts['ventas-mes']) { try { window.App.charts['ventas-mes'].destroy(); } catch(e){} }
    const ctx = document.getElementById('chart-ventas-mes');
    if (ctx) {
      window.App.charts['ventas-mes'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: mesesLabels,
          datasets: [{ label: 'PxQ CLP', data: mesesVals, backgroundColor: mesesLabels.map(m => m === mesSelec ? 'rgba(13,92,140,1)' : 'rgba(13,92,140,0.55)'), borderRadius: 4 }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => '$'+Math.round(v/1e6)+'M' } },
            x: { grid: { display: false } },
          },
        },
      });
    }
  }

  const totalPxQAll = data.total_PxQ || 1;
  const canalEl = document.getElementById('v-tabla-canal');
  if (canalEl) canalEl.innerHTML = `<table class="w-full text-xs"><thead><tr class="border-b border-slate-100">${['Canal','Monto PxQ','%'].map(h=>`<th class="text-left py-2 font-semibold text-slate-400 uppercase tracking-wide">${h}</th>`).join('')}</tr></thead><tbody>${canales.map(([canal,v])=>`<tr class="border-b border-slate-50"><td class="py-2 text-slate-600">${escV(canal)}</td><td class="py-2 text-slate-700 font-medium">$${Math.round(v.PxQ).toLocaleString('es-CL')}</td><td class="py-2 text-slate-400">${totalPxQAll>0?((v.PxQ/totalPxQAll)*100).toFixed(1)+'%':'—'}</td></tr>`).join('')}</tbody></table>`;

  const maxFam = familias[0]?.PxQ || 1;
  const famEl = document.getElementById('v-tabla-familias');
  if (famEl) famEl.innerHTML = familias.map(f=>`<div><div class="flex justify-between text-xs mb-0.5"><span class="text-slate-600 truncate max-w-[60%]">${escV(f.familia)}</span><span class="text-slate-500 font-medium">$${Math.round(f.PxQ).toLocaleString('es-CL')}</span></div><div class="h-1.5 bg-slate-100 rounded-full"><div class="h-1.5 bg-[#0d5c8c] rounded-full" style="width:${((f.PxQ/maxFam)*100).toFixed(1)}%"></div></div></div>`).join('');

  const vendEl = document.getElementById('v-tabla-vendedor');
  if (vendEl) vendEl.innerHTML = `<table class="w-full text-xs min-w-[500px]"><thead><tr class="border-b border-slate-100">${['Vendedor','Monto PxQ','Documentos'].map(h=>`<th class="text-left py-2 font-semibold text-slate-400 uppercase tracking-wide">${h}</th>`).join('')}</tr></thead><tbody>${vendedores.map(([v,d])=>`<tr class="border-b border-slate-50"><td class="py-2 text-slate-600">${escV(v)}</td><td class="py-2 font-medium text-slate-700">$${Math.round(d.PxQ).toLocaleString('es-CL')}</td><td class="py-2 text-slate-400">${(d.documentos||0).toLocaleString('es-CL')}</td></tr>`).join('')}</tbody></table>`;
};

window.limpiarFiltrosVentas = function() {
  ['v-mes','v-canal'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  aplicarFiltrosVentas();
};

function kpiV(label, value, colorClass) {
  return `<div class="bg-white border border-slate-200 rounded-xl p-5 text-center">
    <p class="text-xs text-slate-400 font-medium mb-2">${label}</p>
    <p class="text-2xl font-bold ${colorClass}">${value}</p>
  </div>`;
}

function escV(s) { return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
