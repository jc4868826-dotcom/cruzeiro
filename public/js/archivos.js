'use strict';

const TIPOS_CARGA = [
  {
    id: 'catalogo',
    titulo: 'Catálogo de Productos',
    icono: '📦',
    metaKey: 'catalogo',
    contadorLabel: 'SKUs cargados',
    contadorKey: 'total',
  },
  {
    id: 'pedidos',
    titulo: 'Estado Notas de Pedido',
    icono: '📋',
    metaKey: 'pedidos',
    contadorLabel: 'NVs cargadas',
    contadorKey: 'total',
  },
  {
    id: 'clientes',
    titulo: 'Base de Clientes',
    icono: '👤',
    metaKey: 'clientes',
    contadorLabel: 'Clientes cargados',
    contadorKey: 'total',
  },
  {
    id: 'ventas',
    titulo: 'Ventas / Historial',
    icono: '📊',
    metaKey: 'ventas',
    contadorLabel: 'Documentos procesados',
    contadorKey: 'total_documentos',
  },
  {
    id: 'equipos',
    titulo: 'Equipos / Configuración CRM',
    icono: '👥',
    metaKey: 'equipos',
    contadorLabel: null,
    contadorKey: null,
  },
];

async function renderArchivos(container) {
  let meta = {};
  try {
    meta = await api.get('/api/archivos/meta');
  } catch (_) {}

  container.innerHTML = `
    <div class="space-y-5 max-w-2xl">
      ${TIPOS_CARGA.map(t => bloqueUpload(t, meta[t.metaKey])).join('')}

      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-slate-800">Repositorio externo</h2>
            <p class="text-xs text-slate-400 mt-0.5">Sincronización automática — pendiente configurar</p>
          </div>
          <span class="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">Pendiente</span>
        </div>
        <div class="p-6">
          <p class="text-xs text-slate-400">Disponible cuando Cruzeiro defina el proveedor y entregue credenciales de acceso.</p>
          <button onclick="probarSync()" class="mt-3 text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
            Probar sincronización (stub)
          </button>
          <span id="sync-status" class="text-xs text-slate-400 ml-2"></span>
        </div>
      </div>
    </div>
  `;
}

function bloqueUpload(tipo, metaDato) {
  const ultimaCarga = metaDato?.ultima_carga
    ? new Date(metaDato.ultima_carga).toLocaleString('es-CL')
    : 'Nunca';

  let contadorHTML = '';
  if (tipo.contadorKey && metaDato) {
    const val = metaDato[tipo.contadorKey];
    contadorHTML = `<p class="text-xs text-slate-400">${tipo.contadorLabel}: <span id="counter-${tipo.id}" class="font-medium text-slate-600">${val ?? '—'}</span></p>`;
  } else if (tipo.id === 'equipos') {
    const cfg = metaDato?.configurado ? 'Configurado' : 'Sin configurar';
    contadorHTML = `<p id="counter-${tipo.id}" class="text-xs ${metaDato?.configurado ? 'text-emerald-600 font-medium' : 'text-slate-400'}">${cfg}</p>`;
  }

  return `
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-slate-800">${tipo.icono} ${tipo.titulo}</h2>
          <p class="text-xs text-slate-400">Último cargado: <span id="fecha-${tipo.id}" class="font-medium text-slate-600">${ultimaCarga}</span></p>
        </div>
        ${contadorHTML}
      </div>
      <div class="p-6 space-y-3">
        <div id="error-${tipo.id}" class="hidden text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
        <div class="flex items-center gap-3">
          <input type="file" id="file-${tipo.id}" accept=".csv,.xlsx"
            class="flex-1 text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#e8f4fd] file:text-[#0d5c8c] hover:file:bg-[#d0e8f5]"
            onchange="validarExtension(this, '${tipo.id}')">
          <button id="btn-${tipo.id}" onclick="subirArchivo('${tipo.id}')"
            class="shrink-0 bg-[#0d5c8c] hover:bg-[#0a4a73] text-white text-sm px-4 py-2 rounded-lg transition">
            Subir
          </button>
        </div>
        <div id="status-${tipo.id}" class="text-xs text-slate-400 min-h-[1rem]"></div>
        <p class="text-xs text-slate-300">Formatos: .csv, .xlsx &nbsp;|&nbsp; Máx: 10MB</p>
      </div>
    </div>
  `;
}

window.validarExtension = function (input, tipoId) {
  const errEl = document.getElementById(`error-${tipoId}`);
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx'].includes(ext)) {
    if (errEl) { errEl.textContent = `Formato no soportado (.${ext}). Solo .csv y .xlsx.`; errEl.classList.remove('hidden'); }
    input.value = '';
    return;
  }
  if (errEl) errEl.classList.add('hidden');
};

window.subirArchivo = async function (tipoId) {
  const fileInput = document.getElementById(`file-${tipoId}`);
  const statusEl = document.getElementById(`status-${tipoId}`);
  const errEl = document.getElementById(`error-${tipoId}`);
  const btn = document.getElementById(`btn-${tipoId}`);

  if (!fileInput?.files[0]) {
    if (statusEl) statusEl.textContent = 'Selecciona un archivo primero.';
    return;
  }

  const file = fileInput.files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx'].includes(ext)) {
    if (errEl) { errEl.textContent = `Formato no soportado (.${ext}). Solo .csv y .xlsx.`; errEl.classList.remove('hidden'); }
    return;
  }

  if (errEl) errEl.classList.add('hidden');
  if (statusEl) statusEl.textContent = 'Subiendo...';
  if (btn) btn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('tipo', tipoId);

    const res = await fetch('/api/archivos/subir', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      if (errEl) { errEl.textContent = data.mensaje || data.message || 'Error al subir.'; errEl.classList.remove('hidden'); }
      if (statusEl) statusEl.textContent = '';
    } else {
      if (statusEl) statusEl.textContent = `✓ ${data.mensaje}${data.filas_omitidas ? ` (${data.filas_omitidas} omitidas)` : ''}`;
      actualizarMeta(tipoId, data);
    }
  } catch (e) {
    if (errEl) { errEl.textContent = `Error: ${e.message}`; errEl.classList.remove('hidden'); }
    if (statusEl) statusEl.textContent = '';
  } finally {
    if (btn) btn.disabled = false;
  }
};

async function actualizarMeta(tipoId, resultado) {
  try {
    const meta = await api.get('/api/archivos/meta');
    const d = meta[tipoId];
    if (!d) return;

    const fechaEl = document.getElementById(`fecha-${tipoId}`);
    if (fechaEl && d.ultima_carga) fechaEl.textContent = new Date(d.ultima_carga).toLocaleString('es-CL');

    const counterEl = document.getElementById(`counter-${tipoId}`);
    if (counterEl) {
      if (tipoId === 'equipos') {
        counterEl.textContent = d.configurado ? 'Configurado' : 'Sin configurar';
        counterEl.className = d.configurado ? 'text-xs text-emerald-600 font-medium' : 'text-xs text-slate-400';
      } else {
        counterEl.textContent = d.total ?? '—';
      }
    }
  } catch (_) {}
}

window.probarSync = async function () {
  const status = document.getElementById('sync-status');
  if (status) status.textContent = 'Probando...';
  try {
    const res = await api.post('/api/archivos/sync-repo', {});
    if (status) status.textContent = res.mensaje || 'Hecho';
  } catch (e) {
    if (status) status.textContent = e.message;
  }
};
