// ─── Chat de Prueba ───────────────────────────────────────────────────────────

async function renderChatTest(container) {
  container.innerHTML = `
    <div class="max-w-2xl mx-auto">
      <!-- Simulador de chat -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
        style="height: calc(100vh - 200px); min-height: 500px;">

        <!-- Header simulado WhatsApp -->
        <div class="bg-[#0d5c8c] text-white px-5 py-4 flex items-center gap-3 shrink-0">
          <div class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm shrink-0">C</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-semibold text-sm">Cruzeiro IA — Modo Prueba</p>
              <span id="ct-canal-badge" class="hidden text-[10px] font-bold px-2 py-0.5 rounded-full"></span>
            </div>
            <p class="text-xs text-white/70">Chat simulado · No conecta a Meta</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <label class="text-[10px] text-white/60 whitespace-nowrap">Teléfono:</label>
            <input id="test-phone" type="text" placeholder="+56912345678" value="+56912345678"
              class="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 w-36 focus:outline-none focus:border-white/50">
          </div>
          <button onclick="nuevaConversacion()"
            class="w-8 h-8 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 flex items-center justify-center transition shrink-0"
            title="Nueva conversación (resetea el estado del bot sin borrar leads)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 4v16m8-8H4"/>
            </svg>
          </button>
          <button onclick="limpiarChat()"
            class="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0"
            title="Limpiar chat visual (no borra leads)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>

        <!-- Info bar -->
        <div class="bg-[#e8f4fd] border-b border-[#0d5c8c]/10 px-5 py-2 flex items-center gap-2 shrink-0">
          <svg class="w-3.5 h-3.5 text-[#0d5c8c] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-xs text-[#0d5c8c]">
            Simulador de conversación. Envía mensajes para probar el flujo del bot anti-alucinación.
            <span class="font-semibold">➕ Nueva conversación</span> resetea el bot sin borrar leads.
          </p>
        </div>

        <!-- Messages area -->
        <div id="ct-messages" class="flex-1 overflow-y-auto p-5 space-y-4"
          style="background: #fafafa; background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22><circle cx=%2210%22 cy=%2210%22 r=%221%22 fill=%22%23e2e8f0%22/></svg>')">
          <div class="text-center">
            <span class="text-xs text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full inline-block">
              Inicio de conversación
            </span>
          </div>
        </div>

        <!-- Typing indicator (hidden) -->
        <div id="ct-typing" class="hidden px-5 py-2 shrink-0">
          <div class="flex items-center gap-2">
            <div class="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style="animation-delay:0ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style="animation-delay:150ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style="animation-delay:300ms"></span>
            </div>
            <p class="text-[10px] text-slate-400">Cruzeiro IA escribiendo...</p>
          </div>
        </div>

        <!-- Input bar -->
        <div class="border-t border-slate-200 p-4 flex gap-3 shrink-0 bg-white">
          <input id="ct-input" type="text" placeholder="Escribe un mensaje para el bot..."
            class="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0d5c8c] focus:ring-2 focus:ring-[#0d5c8c]/15 transition"
            onkeydown="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); enviarMensajeTest(); }">
          <button onclick="enviarMensajeTest()"
            class="bg-[#0d5c8c] hover:bg-[#0a4a73] text-white px-5 py-2.5 rounded-xl transition text-sm font-semibold flex items-center gap-2 shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
            Enviar
          </button>
        </div>
      </div>

      <!-- Sugerencias rápidas -->
      <div class="mt-4">
        <p class="text-xs text-slate-400 mb-2 font-medium">Mensajes de prueba sugeridos:</p>
        <div class="flex flex-wrap gap-2">
          ${[
            'hola',
            'sí, ya he comprado antes',
            '¿Tienen pastelón de goma?',
            'Precio de la grada estriada',
            '¿Cuánto cuesta el piso PVC?',
            'stock de tacha reflectiva',
            'Necesito 300 pisos para mi empresa',
            'Quiero comprar piso diamantado, ¿cómo pago?',
            'necesito hablar con un ejecutivo',
          ].map(msg => `
            <button onclick="probarMensaje('${msg.replace(/'/g, "\\'")}', this)"
              class="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:border-[#0d5c8c] hover:text-[#0d5c8c] hover:bg-[#e8f4fd] transition">
              ${msg}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Log de sesión -->
      <div class="mt-4 bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-slate-600">Log de sesión</p>
          <button onclick="limpiarLog()" class="text-xs text-slate-400 hover:text-slate-600 transition">Limpiar</button>
        </div>
        <div id="ct-log" class="font-mono text-xs text-slate-500 space-y-1 max-h-32 overflow-y-auto">
          <p class="text-slate-300">Sin actividad aún...</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('ct-input')?.focus();
}

let _chatTestSending = false;

async function enviarMensajeTest() {
  if (_chatTestSending) return;

  const input = document.getElementById('ct-input');
  const texto = input?.value?.trim();
  if (!texto) return;
  input.value = '';

  const phone = document.getElementById('test-phone')?.value?.trim() || '+56912345678';

  appendMensajeTest(texto, 'cliente');
  addLog(`→ Cliente [${phone}]: ${texto}`);

  _chatTestSending = true;
  const typing = document.getElementById('ct-typing');
  if (typing) typing.classList.remove('hidden');

  try {
    const startTime = Date.now();
    const res = await api.post('/api/chat-test/send', { phone, mensaje: texto, testMode: true });
    const elapsed = Date.now() - startTime;

    if (typing) typing.classList.add('hidden');

    // Update canal badge if clasificado
    if (res.canal_clasificado) {
      _actualizarCanalBadge(res.canal_clasificado);
      addLog(`↗ Canal identificado: ${res.canal_clasificado}`);
    }

    const delay = Math.max(0, 400 - elapsed);
    setTimeout(() => {
      if (res.lead_nuevo) {
        const notif = document.createElement('div');
        notif.className = 'text-center my-2';
        notif.innerHTML = `<span class="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5">✓ Lead creado — <a href="#leads" onclick="navigate('leads')" class="underline font-semibold">Ver en Leads</a></span>`;
        document.getElementById('ct-messages')?.appendChild(notif);
      } else if (res.lead_id && !res.lead_nuevo) {
        addLog(`↗ Lead existente: ${res.lead_id}`);
      }
      if (res.respuesta_bot) {
        appendMensajeTest(res.respuesta_bot, 'bot');
        addLog(`← Bot (${elapsed}ms): ${res.respuesta_bot.slice(0, 80)}${res.respuesta_bot.length > 80 ? '...' : ''}`);
      } else if (res.error) {
        appendMensajeTest('❌ Error del servidor: ' + res.error, 'error');
        addLog(`✗ Error: ${res.error}`);
      } else {
        addLog(`← Bot: sin respuesta (${elapsed}ms)`);
      }
    }, delay);
  } catch (e) {
    if (typing) typing.classList.add('hidden');
    appendMensajeTest('⚠️ Error de conexión: ' + e.message, 'error');
    addLog(`✗ Error de conexión: ${e.message}`);
  } finally {
    _chatTestSending = false;
    document.getElementById('ct-input')?.focus();
  }
}

function _actualizarCanalBadge(canal) {
  const badge = document.getElementById('ct-canal-badge');
  if (!badge) return;
  badge.classList.remove('hidden');
  if (canal === 'mayorista') {
    badge.textContent = '🏢 Mayorista';
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-900';
  } else if (canal === 'ecommerce') {
    badge.textContent = '🛒 Ecommerce';
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-900';
  }
}

async function nuevaConversacion() {
  const phone = document.getElementById('test-phone')?.value?.trim() || '+56912345678';

  try {
    await api.post('/api/chat-test/reset', { phone });
    addLog(`— Nueva conversación iniciada para ${phone} —`);
  } catch (e) {
    addLog(`⚠ No se pudo resetear estado: ${e.message}`);
  }

  // Reset visual
  const container = document.getElementById('ct-messages');
  if (container) {
    container.innerHTML = `
      <div class="text-center">
        <span class="text-xs text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full inline-block">
          Nueva conversación iniciada
        </span>
      </div>
    `;
  }

  // Reset badge
  const badge = document.getElementById('ct-canal-badge');
  if (badge) {
    badge.classList.add('hidden');
    badge.textContent = '';
    badge.className = 'hidden text-[10px] font-bold px-2 py-0.5 rounded-full';
  }

  document.getElementById('ct-input')?.focus();
}

function probarMensaje(texto, btn) {
  const input = document.getElementById('ct-input');
  if (input) {
    input.value = texto;
    input.focus();
    if (btn) {
      btn.classList.add('bg-[#e8f4fd]', 'border-[#0d5c8c]', 'text-[#0d5c8c]');
      setTimeout(() => {
        btn.classList.remove('bg-[#e8f4fd]', 'border-[#0d5c8c]', 'text-[#0d5c8c]');
      }, 500);
    }
  }
}

function appendMensajeTest(texto, remitente) {
  const container = document.getElementById('ct-messages');
  if (!container) return;

  const isCliente = remitente === 'cliente';
  const isError = remitente === 'error';
  const isEjecutivo = remitente === 'ejecutivo';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  const div = document.createElement('div');
  div.className = `flex ${isCliente ? 'justify-start' : 'justify-end'} items-end gap-2`;
  div.dataset.time = now.toISOString();

  if (isError) {
    div.innerHTML = `
      <div class="max-w-[80%] bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
        <p>${texto}</p>
      </div>
    `;
  } else if (isCliente) {
    div.innerHTML = `
      <div class="max-w-[75%] bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
        <p>${escHtml(texto)}</p>
        <p class="text-[10px] mt-1.5 text-slate-400">${timeStr}</p>
      </div>
    `;
  } else if (isEjecutivo) {
    div.innerHTML = `
      <div class="max-w-[75%] bg-[#0d5c8c] text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
        <p class="text-[10px] font-semibold text-white/70 mb-1">👤 Ejecutivo</p>
        <p style="white-space: pre-wrap">${escHtml(texto)}</p>
        <p class="text-[10px] mt-1.5 text-white/50">${timeStr}</p>
      </div>
    `;
  } else {
    div.innerHTML = `
      <div class="max-w-[75%] bg-amber-50 border border-amber-200 text-slate-700 rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
        <p class="text-[10px] font-semibold text-amber-600 mb-1">🤖 Cruzeiro IA</p>
        <p style="white-space: pre-wrap">${escHtml(texto)}</p>
        <p class="text-[10px] mt-1.5 text-amber-400">${timeStr}</p>
      </div>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addLog(msg) {
  const log = document.getElementById('ct-log');
  if (!log) return;

  const empty = log.querySelector('.text-slate-300');
  if (empty) empty.remove();

  const p = document.createElement('p');
  const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  p.innerHTML = `<span class="text-slate-300">[${time}]</span> ${escHtml(msg)}`;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

function limpiarChat() {
  const container = document.getElementById('ct-messages');
  if (container) {
    container.innerHTML = `
      <div class="text-center">
        <span class="text-xs text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full inline-block">
          Chat limpiado — nueva sesión
        </span>
      </div>
    `;
  }
  addLog('— Chat limpiado —');
}

function limpiarLog() {
  const log = document.getElementById('ct-log');
  if (log) {
    log.innerHTML = '<p class="text-slate-300">Log limpiado</p>';
  }
}

if (typeof escHtml === 'undefined') {
  window.escHtml = function(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
}
