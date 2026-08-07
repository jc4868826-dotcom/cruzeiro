// ─── Leads ────────────────────────────────────────────────────────────────────

let _currentLeadId = null;
let _currentLead = null;

async function renderLeads(container) {
  container.innerHTML = `
    <div class="flex rounded-xl overflow-hidden border border-slate-200" style="height:calc(100vh - 140px); background:#f0f2f5;">

      <!-- Columna izquierda estilo WhatsApp Web -->
      <div class="shrink-0 flex flex-col bg-white border-r border-slate-200" style="width:380px;">

        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100" style="background:#f0f2f5;">
          <span class="text-base font-semibold text-slate-800">Leads</span>
          <button onclick="mostrarFormNuevoLead()"
            class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 transition text-slate-500"
            title="Nuevo Lead">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          </button>
        </div>

        <!-- Buscador -->
        <div class="px-3 py-2 border-b border-slate-100" style="background:#f0f2f5;">
          <div class="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-slate-200">
            <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/></svg>
            <input id="lead-search" type="text" placeholder="Buscar o empezar un nuevo chat"
              class="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400"
              oninput="filtrarLeads()">
          </div>
        </div>

        <!-- Pills de segmento -->
        <div class="flex gap-2 px-3 py-2 border-b border-slate-100 overflow-x-auto" style="background:#f0f2f5;">
          <button onclick="setFiltroSegmento('')"
            id="pill-todos"
            class="pill-seg shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition bg-[#0d5c8c] text-white border-[#0d5c8c]">
            Todos
          </button>
          <button onclick="setFiltroSegmento('ecommerce')"
            id="pill-ecommerce"
            class="pill-seg shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition bg-white text-slate-600 border-slate-300 hover:border-[#0d5c8c]">
            Ecommerce
          </button>
          <button onclick="setFiltroSegmento('mayorista')"
            id="pill-mayorista"
            class="pill-seg shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition bg-white text-slate-600 border-slate-300 hover:border-[#0d5c8c]">
            Mayorista
          </button>
          <select id="lead-estado" class="shrink-0 text-xs border border-slate-300 rounded-full px-3 py-1 bg-white text-slate-600 focus:outline-none focus:border-[#0d5c8c]" onchange="filtrarLeads()">
            <option value="">Todos los estados</option>
            <option>Nuevo</option><option>Contactado</option><option>Cotizado</option>
            <option>Pedido Enviado</option><option>Cerrado</option><option>Abandonado</option>
          </select>
          <button onclick="limpiarFiltrosLeads()" class="shrink-0 text-xs text-slate-400 hover:text-slate-600 px-2 transition">✕</button>
        </div>

        <!-- Lista de leads -->
        <div id="leads-list" class="flex-1 overflow-y-auto">
          <div class="text-sm text-slate-400 text-center py-8">Cargando leads...</div>
        </div>
      </div>

      <!-- Panel derecho -->
      <div id="lead-detail" class="flex-1 flex flex-col overflow-hidden" style="background:#f0f2f5;">
        <div class="flex-1 flex flex-col items-center justify-center gap-4">
          <div class="w-20 h-20 rounded-full flex items-center justify-center" style="background:#dfe5e7;">
            <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          </div>
          <div class="text-center">
            <p class="text-lg font-light text-slate-500">Selecciona un lead</p>
            <p class="text-sm text-slate-400 mt-1">para ver la conversación</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Inputs ocultos para filtros adicionales -->
    <div class="hidden">
      <input id="lead-segmento" type="text">
      <input id="lead-origen" type="text">
      <input id="lead-fecha-desde" type="date">
      <input id="lead-fecha-hasta" type="date">
    </div>
  `;

  window.setFiltroSegmento = function(seg) {
    const el = document.getElementById('lead-segmento');
    if (el) el.value = seg;
    document.querySelectorAll('.pill-seg').forEach(p => {
      p.classList.remove('bg-[#0d5c8c]', 'text-white', 'border-[#0d5c8c]');
      p.classList.add('bg-white', 'text-slate-600', 'border-slate-300');
    });
    const active = document.getElementById(seg ? `pill-${seg}` : 'pill-todos');
    if (active) {
      active.classList.remove('bg-white', 'text-slate-600', 'border-slate-300');
      active.classList.add('bg-[#0d5c8c]', 'text-white', 'border-[#0d5c8c]');
    }
    cargarLeads();
  };

  await cargarLeads();

  // Auto-open lead coming from Pipeline or Agenda view
  if (window._pipelineOpenLead) {
    const id = window._pipelineOpenLead;
    window._pipelineOpenLead = null;
    verLead(id);
  }
}

let _leadsData = [];

async function cargarLeads() {
  const busqueda = document.getElementById('lead-search')?.value || '';
  const estado = document.getElementById('lead-estado')?.value || '';
  const segmento = document.getElementById('lead-segmento')?.value || '';
  const origen = document.getElementById('lead-origen')?.value || '';
  const fecha_desde = document.getElementById('lead-fecha-desde')?.value || '';
  const fecha_hasta = document.getElementById('lead-fecha-hasta')?.value || '';
  const params = new URLSearchParams({ busqueda, estado, segmento, origen, fecha_desde, fecha_hasta });
  const res = await api.get(`/api/leads?${params}`);
  _leadsData = res.data || [];
  renderLeadsList(_leadsData);
}

function filtrarLeads() { cargarLeads(); }

window.limpiarFiltrosLeads = function() {
  ['lead-search','lead-estado','lead-segmento','lead-origen','lead-fecha-desde','lead-fecha-hasta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarLeads();
};

function renderLeadsList(leads) {
  const container = document.getElementById('leads-list');
  if (!container) return;
  if (!leads.length) {
    container.innerHTML = '<p class="text-sm text-slate-400 text-center py-12">Sin resultados</p>';
    return;
  }

  const colorAvatar = seg => seg === 'mayorista' ? '#0d5c8c' : '#25a244';

  const calidadCfg = {
    convertido: { label: 'Convertido', css: 'bg-green-100 text-green-700' },
    alto:       { label: 'Alto',       css: 'bg-blue-100 text-blue-700' },
    medio:      { label: 'Medio',      css: 'bg-amber-100 text-amber-700' },
    bajo:       { label: 'Bajo',       css: 'bg-slate-100 text-slate-500' },
  };
  const _MOTIVO_LABELS = {
    producto: 'Producto', precio: 'Precio', consulta_pedido: 'Pedido',
    pago: 'Pago', mayorista: 'Mayorista', info_general: 'Info', consulta_catalogo: 'Catálogo',
  };

  container.innerHTML = leads.map(l => {
    const inicial = (l.nombre || l.telefono || '?').charAt(0).toUpperCase();
    const avatarBg = colorAvatar(l.segmento);
    const hora = l.updatedAt || l.createdAt
      ? new Date(l.updatedAt || l.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      : '';
    const isActive = _currentLeadId === l.id;

    const calidad = calidadCfg[l.calidad_lead] || calidadCfg['bajo'];

    const conv = (l.conversaciones || [])[0];
    const msgs = (conv?.mensajes || []).filter(m => m.rol === 'cliente').length;
    const msgBadge = msgs > 0
      ? `<span class="ml-1 shrink-0 min-w-[18px] h-[18px] rounded-full bg-[#0d5c8c] text-white text-[10px] font-bold flex items-center justify-center px-1">${msgs}</span>`
      : '';

    const segPill = l.segmento === 'mayorista'
      ? `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Mayorista</span>`
      : `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Ecommerce</span>`;

    const motivoTxt = _MOTIVO_LABELS[l.intencion_principal] || '';

    return `
    <div class="flex items-center gap-3 px-3 py-3 cursor-pointer lead-card border-b border-slate-100 hover:bg-slate-50 transition ${isActive ? 'bg-[#e8f4fd]' : ''}"
      data-lead-id="${l.id}"
      onclick="verLead('${l.id}')">
      <!-- Avatar -->
      <div class="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-white text-base font-semibold"
        style="background:${avatarBg};">
        ${inicial}
      </div>
      <!-- Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1">
          <p class="text-sm font-semibold text-slate-800 truncate">${escHtml(l.nombre || l.telefono)}</p>
          <div class="flex items-center gap-1 shrink-0">
            <span class="text-xs text-slate-400">${hora}</span>
            ${msgBadge}
          </div>
        </div>
        <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
          ${segPill}
          <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full ${calidad.css}">${calidad.label}</span>
          ${l.etapa_pipeline && l.etapa_pipeline !== 'nuevo' ? etapaBadge(l.etapa_pipeline) : ''}
          ${motivoTxt ? `<span class="text-[10px] text-slate-400 truncate">${escHtml(motivoTxt)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function verLead(id) {
  _currentLeadId = id;

  // Highlight selected card
  document.querySelectorAll('.lead-card').forEach(c => {
    const isSelected = c.dataset.leadId === id;
    c.classList.toggle('border-[#0d5c8c]', isSelected);
    c.classList.toggle('bg-[#e8f4fd]/50', isSelected);
  });

  const panel = document.getElementById('lead-detail');
  if (!panel) return;
  panel.innerHTML = `<div class="flex-1 flex items-center justify-center text-slate-400 text-sm">Cargando...</div>`;

  let lead, ejecutivos = [];
  try {
    [lead, ejecutivos] = await Promise.all([
      api.get(`/api/leads/${id}`),
      api.get('/api/ejecutivos').then(r => r.data || []).catch(() => []),
    ]);
  } catch (e) {
    panel.innerHTML = `<div class="p-6 text-red-500 text-sm">Error cargando lead: ${e.message}</div>`;
    return;
  }

  if (_currentLeadId !== id) return;

  _currentLead = lead;

  const conv = (lead.conversaciones || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const mensajes = conv?.mensajes || [];
  const esModo = botModeLabel(lead);

  panel.innerHTML = `
    <!-- Header del lead -->
    <div class="border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 flex-wrap gap-3">
      <div>
        <h2 class="font-bold text-slate-800">${escHtml(lead.nombre)}</h2>
        <p class="text-sm text-slate-500">${escHtml(lead.telefono)} · ${escHtml(lead.empresa || 'Sin empresa')}</p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <span id="lead-estado-badge">${estadoBadge(lead.estado)}</span>
        <span id="lead-etapa-badge">${etapaBadge(lead.etapa_pipeline)}</span>
        <label class="flex items-center gap-2 cursor-pointer">
          <span class="text-xs text-slate-500">Bot</span>
          <div class="relative" onclick="toggleBot('${lead.id}', !${!!lead.bot_activo})">
            <div id="bot-toggle-track" class="w-10 h-5 rounded-full transition-colors duration-200 ${lead.bot_activo ? 'bg-[#0d5c8c]' : 'bg-slate-200'}"></div>
            <div id="bot-toggle-thumb" class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${lead.bot_activo ? 'translate-x-5' : 'translate-x-0'}"></div>
          </div>
          <span id="bot-toggle-label-text" class="text-xs font-medium ${lead.bot_activo ? 'text-[#0d5c8c]' : 'text-slate-400'}">${lead.bot_activo ? 'Activo' : 'Apagado'}</span>
        </label>
      </div>
    </div>

    <!-- Tabs internas -->
    <div class="border-b border-slate-200 flex shrink-0 overflow-x-auto">
      ${['Chat', 'Datos', 'Bitácora', 'Pipeline', 'Pedidos', 'Cotizaciones'].map((t, i) => `
        <button class="lead-tab px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap shrink-0
          ${i === 0 ? 'border-[#0d5c8c] text-[#0d5c8c]' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          onclick="switchLeadTab(this, 'lead-tab-${t.toLowerCase()}', '${lead.id}')">${t}</button>
      `).join('')}
    </div>

    <!-- Chat -->
    <div id="lead-tab-chat" class="flex-1 flex flex-col overflow-hidden">
      <div id="chat-messages" class="flex-1 overflow-y-auto p-5 space-y-3">
        ${mensajes.length ? mensajes.map(m => mensajeHTML(m)).join('') : '<p class="text-slate-300 text-sm text-center pt-8">Sin mensajes registrados</p>'}
      </div>
      <div class="border-t border-slate-200 p-4 shrink-0">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] font-medium px-2 py-0.5 rounded-full ${esModo.badge}">${esModo.label}</span>
        </div>
        <div class="flex gap-3">
          <input id="chat-input" type="text"
            placeholder="${esModo.placeholder}"
            class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20"
            onkeydown="if(event.key==='Enter') enviarMensajeLead('${lead.id}', '${escHtml(lead.telefono)}')">
          <button onclick="enviarMensajeLead('${lead.id}', '${escHtml(lead.telefono)}')"
            class="${esModo.btnClass} text-white text-sm px-4 py-2 rounded-lg transition">
            ${esModo.btnText}
          </button>
        </div>
      </div>
    </div>

    <!-- Datos (oculto inicialmente) -->
    <div id="lead-tab-datos" class="flex-1 overflow-y-auto p-6 space-y-5 hidden">

      <!-- Identificación -->
      <div>
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Identificación</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Nombre</label>
            <input type="text" value="${escHtml(lead.nombre)}"
              onblur="guardarCampoLead('${lead.id}', 'nombre', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Teléfono</label>
            <input type="text" value="${escHtml(lead.telefono)}"
              onblur="guardarCampoLead('${lead.id}', 'telefono', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Email</label>
            <input type="email" value="${escHtml(lead.email || '')}"
              onblur="guardarCampoLead('${lead.id}', 'email', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">RUT</label>
            <input type="text" value="${escHtml(lead.rut || '')}" placeholder="12.345.678-9"
              onblur="guardarCampoLead('${lead.id}', 'rut', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
        </div>
      </div>

      <!-- Empresa -->
      <div class="border-t border-slate-200 pt-5">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Empresa</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Razón social / empresa</label>
            <input type="text" value="${escHtml(lead.empresa || '')}"
              onblur="guardarCampoLead('${lead.id}', 'empresa', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Giro</label>
            <input type="text" value="${escHtml(lead.giro || '')}" placeholder="Ej: Construcción"
              onblur="guardarCampoLead('${lead.id}', 'giro', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-slate-500 block mb-1">Dirección</label>
            <input type="text" value="${escHtml(lead.direccion || '')}" placeholder="Av. Ejemplo 123, Ciudad"
              onblur="guardarCampoLead('${lead.id}', 'direccion', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
        </div>
      </div>

      <!-- CRM -->
      <div class="border-t border-slate-200 pt-5">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">CRM</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Segmento</label>
            <div class="flex items-center h-9">${badge(lead.segmento || 'ecommerce', lead.segmento === 'mayorista' ? 'ocean' : 'green')}</div>
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Canal de origen</label>
            <input type="text" value="${escHtml(lead.canal_origen || conv?.canal_tipo || conv?.canal || lead.origen || '')}"
              placeholder="whatsapp, web, referido..."
              onblur="guardarCampoLead('${lead.id}', 'canal_origen', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label>Ejecutivo asignado</label>
            <div style="padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; color: #111827;">
              ${lead.ejecutivo_nombre || lead.ejecutivo_asignado || '— Sin asignar —'}
            </div>
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Última compra</label>
            <input type="date" value="${(lead.fecha_ultima_compra || '').slice(0, 10)}"
              onblur="guardarCampoLead('${lead.id}', 'fecha_ultima_compra', this.value || null)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Registrado</label>
            <div class="flex items-center h-9 text-xs text-slate-500">${formatDate(lead.createdAt)}</div>
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Última actualización</label>
            <div class="flex items-center h-9 text-xs text-slate-500">${formatDate(lead.updatedAt || lead.createdAt)}</div>
          </div>
        </div>
      </div>

      <!-- Trazabilidad -->
      <div class="border-t border-slate-200 pt-5 space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trazabilidad del embudo</p>
          <button onclick="generarResumenIA('${lead.id}')"
            class="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-100 transition flex items-center gap-1.5">
            🤖 Generar resumen IA
          </button>
        </div>

        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Resumen de conversación</label>
          <textarea id="dato-resumen" rows="2"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20"
            onblur="guardarCampoLead('${lead.id}', 'resumen_conversacion', this.value)"
          >${escHtml(lead.resumen_conversacion || '')}</textarea>
        </div>

        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Notas libres</label>
          <textarea id="dato-notas-libres" rows="2"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20"
            placeholder="Observaciones adicionales del ejecutivo..."
            onblur="guardarCampoLead('${lead.id}', 'notas_libres', this.value)"
          >${escHtml(lead.notas_libres || '')}</textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Intención de compra</label>
            <select id="dato-intencion"
              onchange="guardarCampoLead('${lead.id}', 'intencion_compra', this.value)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
              ${['ninguna', 'consulta', 'carrito', 'cerrado'].map(v =>
                `<option value="${v}" ${lead.intencion_compra === v ? 'selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500 block mb-1">Derivado a</label>
            <select id="dato-derivado"
              onchange="guardarCampoLead('${lead.id}', 'derivado_a', this.value || null)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
              <option value="" ${!lead.derivado_a ? 'selected' : ''}>— ninguno —</option>
              ${['bot', 'equipo_ecommerce', 'equipo_mayorista'].map(v =>
                `<option value="${v}" ${lead.derivado_a === v ? 'selected' : ''}>${v.replace(/_/g, ' ')}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        ${lead.fecha_derivacion ? campoInfo('Fecha derivación', formatDate(lead.fecha_derivacion)) : ''}
      </div>

      <div class="border-t border-slate-200 pt-4">
        <label class="text-xs font-medium text-slate-500 block mb-1.5">Estado del pipeline</label>
        <select id="datos-estado-select" onchange="cambiarEstado('${lead.id}', this.value)"
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
          ${['Nuevo', 'Contactado', 'Cotizado', 'Pedido Enviado', 'Cerrado', 'Abandonado'].map(e =>
            `<option ${lead.estado === e ? 'selected' : ''}>${e}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <!-- Bitácora (oculto) -->
    <div id="lead-tab-bitácora" class="flex-1 flex flex-col overflow-hidden hidden">
      <div id="notas-list" class="flex-1 overflow-y-auto p-5 space-y-3">
        ${(lead.notas || []).length
          ? (lead.notas || []).map(n => notaHTML(n)).join('')
          : '<p id="notas-empty" class="text-slate-300 text-sm text-center pt-8">Sin notas registradas</p>'
        }
      </div>
      <div class="border-t border-slate-200 p-4 shrink-0">
        <div class="flex items-center gap-2 mb-2">
          <input type="checkbox" id="nota-crear-agenda" class="w-3.5 h-3.5 accent-[#0d5c8c]">
          <label for="nota-crear-agenda" class="text-xs text-slate-500 cursor-pointer">Crear tarea en agenda</label>
        </div>
        <div class="flex gap-3">
          <input id="nota-input" type="text" placeholder="Agregar nota interna..."
            class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20"
            onkeydown="if(event.key==='Enter') agregarNota('${lead.id}')">
          <button onclick="agregarNota('${lead.id}')"
            class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm px-4 py-2 rounded-lg transition">
            Guardar
          </button>
        </div>
      </div>
    </div>

    <!-- Pipeline (oculto) -->
    <div id="lead-tab-pipeline" class="flex-1 overflow-y-auto p-6 hidden">
      <p class="text-xs font-medium text-slate-500 mb-5">Estado actual del lead en el pipeline de ventas</p>
      <div id="lead-pipeline-steps" class="flex items-start gap-0 overflow-x-auto pb-4">
        ${pipelineStepsHTML(lead.id, lead.estado)}
      </div>
      <div class="mt-8 border-t border-slate-200 pt-5">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Historial de cambios</p>
        ${pipelineHistoryHTML(lead.pipeline_history)}
      </div>
    </div>

    <!-- Pedidos (oculto) -->
    <div id="lead-tab-pedidos" class="flex-1 overflow-y-auto p-6 hidden">
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Notas de Venta</p>
      ${lead.rut
        ? `<div id="pedidos-container"><div class="text-sm text-slate-400 py-4">Cargando pedidos...</div></div>`
        : `<div id="pedidos-container">
             <p class="text-xs text-slate-400 mb-3">Este lead no tiene RUT registrado. Buscar por NV:</p>
             <div class="flex gap-2">
               <input id="pedidos-nv-input" type="text" placeholder="Número de nota de venta..."
                 class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c]">
               <button onclick="buscarPedidoPorNV(document.getElementById('pedidos-nv-input').value)"
                 class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm px-4 py-2 rounded-lg transition">Buscar</button>
             </div>
             <div id="pedidos-nv-result" class="mt-3"></div>
           </div>`
      }
    </div>

    <!-- Cotizaciones FTP (oculto) -->
    <div id="lead-tab-cotizaciones" class="flex-1 overflow-y-auto p-6 hidden">
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Cotizaciones ERP (FTP)</p>
      ${renderCotizacionesTab(lead.cotizaciones || [], lead.rut)}
    </div>
  `;

  const cm = document.getElementById('chat-messages');
  if (cm) cm.scrollTop = cm.scrollHeight;

  if (lead.rut) {
    cargarPedidosLead(lead.rut);
  }
}

// ─── Bot mode detection ────────────────────────────────────────────────────────
function botModeLabel(lead) {
  const esBot = lead.bot_activo && lead.segmento === 'ecommerce';
  if (esBot) {
    return {
      label: 'Modo bot — simulando cliente',
      badge: 'bg-amber-50 border border-amber-200 text-amber-700',
      placeholder: 'Simular mensaje del cliente...',
      btnText: 'Simular',
      btnClass: 'bg-amber-500 hover:bg-amber-600',
    };
  }
  return {
    label: 'Modo agente — escribiendo como ejecutivo',
    badge: 'bg-[#e8f4fd] border border-[#0d5c8c]/20 text-[#0d5c8c]',
    placeholder: 'Escribir mensaje como agente...',
    btnText: 'Enviar',
    btnClass: 'bg-[#0d5c8c] hover:bg-[#0a4a73]',
  };
}

// ─── Pipeline steps HTML ──────────────────────────────────────────────────────
function pipelineStepsHTML(leadId, estadoActual) {
  const etapas = ['Nuevo', 'Contactado', 'Cotizado', 'Pedido Enviado', 'Cerrado', 'Abandonado'];
  return etapas.map((etapa, idx, arr) => {
    const currentIdx = arr.indexOf(estadoActual);
    const isActive = idx === currentIdx;
    const isPast = idx < currentIdx;
    return `
      <div class="flex items-center">
        <div onclick="cambiarEstado('${leadId}', '${etapa}')"
          class="flex flex-col items-center gap-2 cursor-pointer min-w-[80px] group">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition
            ${isActive ? 'bg-[#0d5c8c] border-[#0d5c8c] text-white shadow-md' :
              isPast ? 'bg-[#e8f4fd] border-[#0d5c8c] text-[#0d5c8c]' :
              'bg-white border-slate-300 text-slate-400 group-hover:border-[#0d5c8c]/40'}">
            ${isPast ? '✓' : idx + 1}
          </div>
          <span class="text-[11px] text-center font-medium leading-tight px-1
            ${isActive ? 'text-[#0d5c8c]' : isPast ? 'text-slate-600' : 'text-slate-400'}">
            ${etapa}
          </span>
        </div>
        ${idx < arr.length - 1 ? `
          <div class="h-0.5 w-8 shrink-0 -mt-4 ${isPast ? 'bg-[#0d5c8c]' : 'bg-slate-200'}"></div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ─── Pipeline history HTML ────────────────────────────────────────────────────
function pipelineHistoryHTML(history) {
  if (!history || !history.length) {
    return '<p class="text-slate-300 text-sm">Sin cambios de etapa registrados</p>';
  }
  return `
    <div class="space-y-2">
      ${history.slice().reverse().map(h => `
        <div class="flex items-center gap-3 text-xs text-slate-600">
          <span class="text-slate-400 shrink-0">${formatDate(h.fecha)}</span>
          <span class="text-slate-400">→</span>
          <span>${escHtml(h.etapa_anterior)}</span>
          <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
          <span class="font-semibold text-[#0d5c8c]">${escHtml(h.etapa_nueva)}</span>
          <span class="text-slate-400">por ${escHtml(h.autor)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Note HTML ─────────────────────────────────────────────────────────────────
function notaHTML(n) {
  return `
    <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <p class="text-sm text-slate-700">${escHtml(n.texto)}</p>
      <p class="text-xs text-slate-400 mt-1">${escHtml(n.autor || 'Sistema')} · ${formatDate(n.timestamp)}</p>
    </div>`;
}

// ─── Chat message HTML — 3 bubble types ──────────────────────────────────────
// cliente → LEFT  / white bg
// bot     → RIGHT / amber bg
// agente  → RIGHT / ocean bg (shows name)
function mensajeHTML(m) {
  const rol = m.rol || m.remitente || 'bot';
  const ts = `<p class="text-[10px] mt-1 text-slate-400">${formatDate(m.timestamp)}</p>`;

  if (rol === 'cliente') {
    return `
      <div class="flex justify-start">
        <div class="max-w-[75%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-white border border-slate-200 text-slate-800">
          <p>${escHtml(m.texto)}</p>
          ${ts}
        </div>
      </div>`;
  }
  if (rol === 'bot') {
    return `
      <div class="flex justify-end">
        <div class="max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed bg-amber-50 border border-amber-200 text-slate-700">
          <p class="text-[10px] font-semibold mb-1 text-amber-600">🤖 Bot</p>
          <p>${escHtml(m.texto)}</p>
          ${ts}
        </div>
      </div>`;
  }
  // agente
  const nombre = escHtml(m.sender_name || 'Agente');
  return `
    <div class="flex justify-end">
      <div class="max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed bg-[#e8f4fd] border border-[#0d5c8c]/20 text-slate-700">
        <p class="text-[10px] font-semibold mb-1 text-[#0d5c8c]">👤 ${nombre}</p>
        <p>${escHtml(m.texto)}</p>
        ${ts}
      </div>
    </div>`;
}

function campoInfo(label, value) {
  return `
    <div>
      <p class="text-xs text-slate-400 font-medium">${label}</p>
      <p class="text-sm text-slate-700 mt-0.5">${value}</p>
    </div>
  `;
}

function switchLeadTab(btn, tabId, leadId) {
  document.querySelectorAll('.lead-tab').forEach(b => {
    b.classList.remove('border-[#0d5c8c]', 'text-[#0d5c8c]');
    b.classList.add('border-transparent', 'text-slate-500');
  });
  btn.classList.add('border-[#0d5c8c]', 'text-[#0d5c8c]');
  btn.classList.remove('border-transparent', 'text-slate-500');

  ['chat', 'datos', 'bitácora', 'pipeline', 'pedidos', 'cotizaciones'].forEach(t => {
    const el = document.getElementById(`lead-tab-${t}`);
    if (el) el.classList.toggle('hidden', `lead-tab-${t}` !== tabId);
  });
}

// ─── Bot toggle ───────────────────────────────────────────────────────────────
async function toggleBot(leadId, activo) {
  try {
    await api.patch(`/api/leads/${leadId}/bot`, { bot_activo: activo });
    if (_currentLead) _currentLead.bot_activo = activo;

    const track = document.getElementById('bot-toggle-track');
    const thumb = document.getElementById('bot-toggle-thumb');
    const label = document.getElementById('bot-toggle-label-text');
    if (track) track.className = `w-10 h-5 rounded-full transition-colors duration-200 ${activo ? 'bg-[#0d5c8c]' : 'bg-slate-200'}`;
    if (thumb) thumb.className = `absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${activo ? 'translate-x-5' : 'translate-x-0'}`;
    if (label) {
      label.textContent = activo ? 'Activo' : 'Apagado';
      label.className = `text-xs font-medium ${activo ? 'text-[#0d5c8c]' : 'text-slate-400'}`;
    }
  } catch (e) {
    alert('Error al cambiar estado del bot: ' + e.message);
  }
}

// ─── Cambiar estado ───────────────────────────────────────────────────────────
async function cambiarEstado(leadId, estado) {
  try {
    const updated = await api.patch(`/api/leads/${leadId}`, { estado });

    const badgeEl = document.getElementById('lead-estado-badge');
    if (badgeEl) badgeEl.innerHTML = estadoBadge(estado);

    const steps = document.getElementById('lead-pipeline-steps');
    if (steps) steps.innerHTML = pipelineStepsHTML(leadId, estado);

    // Refresh pipeline history
    const histEl = steps?.parentElement?.querySelector('.space-y-2, .text-slate-300');
    const histContainer = document.querySelector('#lead-tab-pipeline .border-t.border-slate-200.pt-5 > div:last-child');
    if (histContainer) histContainer.outerHTML = pipelineHistoryHTML(updated.pipeline_history);

    const datosSelect = document.getElementById('datos-estado-select');
    if (datosSelect) datosSelect.value = estado;

    if (_currentLead) _currentLead.estado = estado;
    await cargarLeads();
  } catch (e) {
    alert('Error al cambiar estado: ' + e.message);
  }
}

// ─── Agregar nota ─────────────────────────────────────────────────────────────
async function agregarNota(leadId) {
  const input = document.getElementById('nota-input');
  const texto = input?.value?.trim();
  if (!texto) return;

  const crearAgenda = document.getElementById('nota-crear-agenda')?.checked;

  try {
    const { nota } = await api.post(`/api/leads/${leadId}/notas`, { texto });
    input.value = '';
    input.focus();

    const lista = document.getElementById('notas-list');
    if (lista) {
      const empty = document.getElementById('notas-empty');
      if (empty) empty.remove();

      const div = document.createElement('div');
      div.innerHTML = notaHTML({
        texto,
        autor: nota?.autor || App.usuario?.nombre || 'Agente',
        timestamp: nota?.timestamp || new Date().toISOString(),
      });
      lista.appendChild(div.firstElementChild);
      lista.scrollTop = lista.scrollHeight;
    }

    if (crearAgenda) {
      await api.post('/api/agenda', {
        lead_id: leadId,
        descripcion: texto,
        canal: 'interno',
      });
      document.getElementById('nota-crear-agenda').checked = false;
    }
  } catch (e) {
    alert('Error al agregar nota: ' + e.message);
  }
}

// ─── Generar resumen IA (client-side) ─────────────────────────────────────────
async function generarResumenIA(leadId) {
  const lead = _currentLead;
  if (!lead) return;

  const conv = (lead.conversaciones || [])[0];
  const mensajes = conv?.mensajes || [];

  const PALABRAS_CLAVE = [
    'pastelón', 'pastelon', 'goma', 'PVC', 'pvc', 'nomad', 'pasto sintético', 'pasto sintetico',
    'tacha', 'tada reflectiva', 'grada', 'estriada', 'antifatiga', 'diamantado', 'diamante',
    'estoperol', 'rollo', 'metro', 'unidad', 'cable', 'protector',
  ];

  const textoCliente = mensajes
    .filter(m => m.rol === 'cliente')
    .map(m => m.texto)
    .join(' ');

  const encontrados = PALABRAS_CLAVE.filter(p =>
    textoCliente.toLowerCase().includes(p.toLowerCase())
  );

  let resumen = '';
  if (!textoCliente) {
    resumen = 'Sin mensajes del cliente para analizar.';
  } else if (!encontrados.length) {
    resumen = 'Consulta sin productos específicos identificados.';
  } else {
    const unicos = [...new Set(encontrados.map(p => p.charAt(0).toUpperCase() + p.slice(1)))];
    resumen = `Interesado en: ${unicos.join(', ')}.`;
    if (lead.segmento === 'mayorista') resumen += ' Segmento mayorista — requiere cotización formal.';
  }

  const textarea = document.getElementById('dato-resumen');
  if (textarea) {
    textarea.value = resumen;
    textarea.dispatchEvent(new Event('blur'));
  }
}

// ─── Enviar mensaje — smart routing ──────────────────────────────────────────
async function enviarMensajeLead(leadId, phone) {
  const input = document.getElementById('chat-input');
  const texto = input?.value?.trim();
  if (!texto) return;
  input.value = '';

  const lead = _currentLead;
  const modoBot = lead?.bot_activo && lead?.segmento === 'ecommerce';

  // Optimistic bubble
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    const placeholder = chatMessages.querySelector('.text-slate-300');
    if (placeholder) placeholder.remove();

    const div = document.createElement('div');
    if (modoBot) {
      // Show as client bubble (left/white) — message going to the bot
      div.innerHTML = `
        <div class="flex justify-start">
          <div class="max-w-[75%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm bg-white border border-slate-200 text-slate-800">
            <p>${escHtml(texto)}</p>
            <p class="text-[10px] mt-1 text-slate-400">${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>`;
    } else {
      // Show as agente bubble (right/ocean)
      const senderName = App.usuario?.nombre || 'Agente';
      div.innerHTML = `
        <div class="flex justify-end">
          <div class="max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-[#e8f4fd] border border-[#0d5c8c]/20 text-slate-700">
            <p class="text-[10px] font-semibold mb-1 text-[#0d5c8c]">👤 ${escHtml(senderName)}</p>
            <p>${escHtml(texto)}</p>
            <p class="text-[10px] mt-1 text-slate-400">${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>`;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  try {
    if (modoBot) {
      await api.post('/api/chat-test/send', { phone, mensaje: texto });
      setTimeout(() => refreshChatOnly(leadId), 1200);
    } else {
      await api.post(`/api/leads/${leadId}/mensajes`, { texto });
      // Already optimistically shown; no refresh needed
    }
  } catch (e) {
    console.error('Error enviando mensaje:', e);
  }
}

// ─── refreshChatOnly ──────────────────────────────────────────────────────────
async function refreshChatOnly(leadId) {
  if (_currentLeadId !== leadId) return;

  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const chatTab = document.getElementById('lead-tab-chat');
  if (chatTab && chatTab.classList.contains('hidden')) return;

  try {
    const lead = await api.get(`/api/leads/${leadId}`);
    if (_currentLeadId !== leadId) return;

    const conv = (lead.conversaciones || [])[0];
    const mensajes = conv?.mensajes || [];
    chatMessages.innerHTML = mensajes.length
      ? mensajes.map(m => mensajeHTML(m)).join('')
      : '<p class="text-slate-300 text-sm text-center pt-8">Sin mensajes registrados</p>';
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (e) {
    // Silently ignore
  }
}

// ─── Nuevo lead form ───────────────────────────────────────────────────────────
function mostrarFormNuevoLead() {
  _currentLeadId = null;
  _currentLead = null;
  const panel = document.getElementById('lead-detail');
  if (!panel) return;
  panel.classList.add('overflow-y-auto');
  panel.innerHTML = `
    <div class="p-6 overflow-y-auto">
      <h2 class="font-bold text-slate-800 mb-5 text-lg">Nuevo Lead</h2>
      <div class="space-y-4 max-w-md">
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Nombre *</label>
          <input id="nl-nombre" type="text" placeholder="Nombre completo"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Teléfono *</label>
          <input id="nl-telefono" type="text" placeholder="+56912345678"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Email</label>
          <input id="nl-email" type="email" placeholder="correo@empresa.cl"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 block mb-1">Empresa</label>
          <input id="nl-empresa" type="text" placeholder="Nombre de la empresa"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-1 focus:ring-[#0d5c8c]/20">
        </div>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="text-xs font-medium text-slate-500 block mb-1">Segmento</label>
            <select id="nl-segmento" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
              <option value="ecommerce">Ecommerce</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </div>
          <div class="flex-1">
            <label class="text-xs font-medium text-slate-500 block mb-1">Origen</label>
            <select id="nl-origen" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0d5c8c]">
              <option value="web">Web</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="referido">Referido</option>
            </select>
          </div>
        </div>
        <div id="nl-error" class="hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
        <div class="flex gap-3 pt-2">
          <button onclick="crearLead()"
            class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
            Crear Lead
          </button>
          <button onclick="cargarLeads()"
            class="border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
}

async function crearLead() {
  const body = {
    nombre:   document.getElementById('nl-nombre')?.value?.trim(),
    telefono: document.getElementById('nl-telefono')?.value?.trim(),
    email:    document.getElementById('nl-email')?.value?.trim() || undefined,
    empresa:  document.getElementById('nl-empresa')?.value?.trim() || undefined,
    segmento: document.getElementById('nl-segmento')?.value,
    origen:   document.getElementById('nl-origen')?.value,
  };

  const errEl = document.getElementById('nl-error');
  if (!body.nombre || !body.telefono) {
    if (errEl) { errEl.textContent = 'Nombre y teléfono son requeridos'; errEl.classList.remove('hidden'); }
    return;
  }

  try {
    const nuevo = await api.post('/api/leads', body);
    await cargarLeads();
    verLead(nuevo.id || nuevo._id);
  } catch (e) {
    if (errEl) { errEl.textContent = 'Error al crear lead: ' + e.message; errEl.classList.remove('hidden'); }
  }
}

async function guardarCampoLead(id, campo, valor) {
  await api.patch(`/api/leads/${id}`, { [campo]: valor });
}

// ─── Pedidos widget ───────────────────────────────────────────────────────────

function estadoPedidoBadge(estado) {
  const e = (estado || '').toUpperCase();
  if (e.includes('ENTREGADO') || e.includes('FACTURADO')) return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">${escHtml(estado)}</span>`;
  if (e.includes('RUTA') || e.includes('DESPACHADO')) return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">${escHtml(estado)}</span>`;
  if (e.includes('PREPARACIÓN') || e.includes('PREPARADO')) return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">${escHtml(estado)}</span>`;
  if (e.includes('GUIA')) return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${escHtml(estado)}</span>`;
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">${escHtml(estado || 'SIN ESTADO')}</span>`;
}

function pedidosTablaHTML(nvs) {
  if (!nvs || !nvs.length) return '<p class="text-sm text-slate-400 py-4">No se encontraron notas de venta para este cliente.</p>';
  return `
    <div class="overflow-x-auto">
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="text-left px-3 py-2 font-semibold text-slate-500">NV</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Estado</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Fecha NV</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Fecha Entrega</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Canal</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Transporte</th>
          </tr>
        </thead>
        <tbody>
          ${nvs.map(n => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="px-3 py-2 font-mono font-semibold text-[#0d5c8c]">${escHtml(n.nv)}</td>
              <td class="px-3 py-2">${estadoPedidoBadge(n.estado)}</td>
              <td class="px-3 py-2 text-slate-500">${n.fecha_nv ? new Date(n.fecha_nv).toLocaleDateString('es-CL') : '—'}</td>
              <td class="px-3 py-2 text-slate-500">${escHtml(n.fecha_entrega || '—')}</td>
              <td class="px-3 py-2 text-slate-500">${escHtml(n.canal || '—')}</td>
              <td class="px-3 py-2 text-slate-500">${escHtml(n.transporte || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function cargarPedidosLead(rut) {
  const container = document.getElementById('pedidos-container');
  if (!container) return;
  try {
    const nvs = await api.get(`/api/pedidos/rut/${encodeURIComponent(rut)}`);
    container.innerHTML = pedidosTablaHTML(Array.isArray(nvs) ? nvs : []);
  } catch (e) {
    container.innerHTML = `<p class="text-sm text-red-500">Error al cargar pedidos: ${escHtml(e.message)}</p>`;
  }
}

async function buscarPedidoPorNV(nv) {
  const resultEl = document.getElementById('pedidos-nv-result');
  if (!nv || !resultEl) return;
  try {
    const n = await api.get(`/api/pedidos/nv/${encodeURIComponent(nv.trim())}`);
    resultEl.innerHTML = pedidosTablaHTML([n]);
  } catch (e) {
    resultEl.innerHTML = `<p class="text-sm text-slate-400">No se encontró la NV ${escHtml(nv)}.</p>`;
  }
}

// ─── Cotizaciones FTP tab ─────────────────────────────────────────────────────

function renderCotizacionesTab(cotizaciones, rut) {
  if (!rut) {
    return '<p class="text-xs text-slate-400">Sin RUT registrado — no se pueden buscar cotizaciones en el sistema.</p>';
  }
  if (!cotizaciones || !cotizaciones.length) {
    return '<p class="text-xs text-slate-400 py-4">Sin cotizaciones encontradas para este RUT en el ERP.</p>';
  }

  const _estadoBadge = (estado) => {
    const e = (estado || '').toUpperCase();
    if (e.includes('ACEPTADA')) return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">${escHtml(estado)}</span>`;
    if (e.includes('VENCIDA'))  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">${escHtml(estado)}</span>`;
    if (e.includes('VIGENTE') || e.includes('PENDIENTE')) return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">${escHtml(estado)}</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${escHtml(estado)}</span>`;
  };

  // Group by fecha+estado+vendedor to aggregate line items into cotización groups
  const grupos = {};
  for (const c of cotizaciones) {
    const key = `${c.fecha}|${c.estado}|${c.vendedor}`;
    if (!grupos[key]) grupos[key] = { fecha: c.fecha, estado: c.estado, vendedor: c.vendedor, items: [], total: 0 };
    grupos[key].items.push(c);
    grupos[key].total += c.totalItem || 0;
  }

  const fmtClp = n => n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

  return Object.values(grupos).map(g => `
    <div class="border border-slate-200 rounded-xl p-4 mb-3">
      <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          ${_estadoBadge(g.estado)}
          <span class="text-xs text-slate-500">${escHtml(g.fecha)}</span>
          <span class="text-xs text-slate-400">· ${escHtml(g.vendedor)}</span>
        </div>
        <span class="text-xs font-bold text-slate-800">${fmtClp(g.total)}</span>
      </div>
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="border-b border-slate-100">
            <th class="text-left py-1 pr-2 text-slate-400 font-medium">Descripción</th>
            <th class="text-right py-1 px-2 text-slate-400 font-medium">Cant.</th>
            <th class="text-right py-1 px-2 text-slate-400 font-medium">Precio</th>
            <th class="text-right py-1 pl-2 text-slate-400 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          ${g.items.map(it => `
            <tr class="border-b border-slate-50 last:border-0">
              <td class="py-1 pr-2 text-slate-700">${escHtml(it.descripcion)}</td>
              <td class="py-1 px-2 text-right text-slate-500">${it.cantidad} ${escHtml(it.unidad)}</td>
              <td class="py-1 px-2 text-right text-slate-500">${fmtClp(it.precioCotizado || 0)}</td>
              <td class="py-1 pl-2 text-right font-medium text-slate-700">${fmtClp(it.totalItem || 0)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
