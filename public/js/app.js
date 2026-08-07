// ─── Estado global ────────────────────────────────────────────────────────────
window.App = {
  usuario: null,
  currentPage: null,
  charts: {}, // guardar instancias Chart.js para destroy antes de re-render
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.status === 401) {
      window.location.href = '/login.html';
      return false;
    }
    App.usuario = (await res.json()).usuario;
    // Render user info en sidebar
    const inicialNombre = (App.usuario.nombre || App.usuario.username || 'U').charAt(0).toUpperCase();
    document.getElementById('sidebar-user').innerHTML = `
      <div class="w-8 h-8 rounded-full bg-[#0d5c8c] flex items-center justify-center text-white text-xs font-bold shrink-0">
        ${inicialNombre}
      </div>
      <div class="text-xs flex-1 min-w-0">
        <p class="font-semibold text-slate-700 truncate">${App.usuario.nombre || App.usuario.username}</p>
        <p class="text-slate-400 capitalize">${App.usuario.rol || 'usuario'}</p>
      </div>
    `;
    return true;
  } catch (err) {
    console.error('Error en checkAuth:', err);
    window.location.href = '/login.html';
    return false;
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  window.location.href = '/login.html';
}

// ─── Router ───────────────────────────────────────────────────────────────────
const PAGE_CONFIG = {
  dashboard:     { title: 'Dashboard',       subtitle: 'Resumen del ecosistema WhatsApp',               render: renderDashboard },
  productos:     { title: 'Productos',       subtitle: 'Catálogo completo de productos y stock',        render: renderProductos },
  clientes:      { title: 'Clientes',        subtitle: 'Base de clientes activos',                      render: renderClientes },
  ventas:        { title: 'Ventas',          subtitle: 'Resumen de ventas 2026',                        render: renderVentas },
  pedidos:       { title: 'Pedidos',         subtitle: 'Estado de notas de pedido',                     render: renderPedidos },
  leads:         { title: 'Leads',           subtitle: 'Gestión de clientes y conversaciones',          render: renderLeads },
  pipeline:      { title: 'Pipeline',        subtitle: 'Tablero kanban de todos los leads',             render: renderPipeline },
  agenda:        { title: 'Agenda',          subtitle: 'Tareas pendientes del equipo comercial',        render: renderAgenda },
  catalogo:      { title: 'Catálogo',        subtitle: 'Productos sincronizados',                       render: renderCatalogo },
  campanas:      { title: 'Campañas HSM',    subtitle: 'Mensajería masiva de WhatsApp',                 render: renderCampanas },
  'chat-test':   { title: 'Chat de Prueba',  subtitle: 'Simulador de conversación WhatsApp',            render: renderChatTest },
  archivos:      { title: 'Archivos / CSV',  subtitle: 'Carga de stock, clientes, ventas y productos',  render: renderArchivos },
  configuracion: { title: 'Configuración',   subtitle: 'Usuarios, accesos y datos del sistema',         render: renderConfiguracion },
};

function navigate(page) {
  if (!PAGE_CONFIG[page]) page = 'dashboard';

  // Destroy previous charts
  Object.values(App.charts).forEach(c => { try { c.destroy(); } catch (e) {} });
  App.charts = {};

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(a => {
    const isActive = a.dataset.page === page;
    a.classList.toggle('nav-active', isActive);
  });

  // Update header
  const cfg = PAGE_CONFIG[page];
  document.getElementById('page-title').textContent = cfg.title;
  document.getElementById('page-subtitle').textContent = cfg.subtitle;

  // Update hash without triggering hashchange
  if (window.location.hash.slice(1) !== page) {
    window._navigating = true;
    window.location.hash = page;
  }

  // Clear container and render
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="flex justify-center items-center h-32">
      <div class="flex items-center gap-3 text-slate-400">
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <span class="text-sm">Cargando...</span>
      </div>
    </div>
  `;
  App.currentPage = page;

  // Call render function — it may be async
  Promise.resolve(cfg.render(container)).catch(err => {
    container.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-700">
        <p class="font-semibold mb-1">Error al cargar la vista</p>
        <p class="text-red-500">${err.message || 'Error desconocido'}</p>
      </div>
    `;
    console.error('Error en render:', err);
  });
}

// Hash-based routing
window.addEventListener('hashchange', () => {
  if (window._navigating) { window._navigating = false; return; }
  const page = window.location.hash.slice(1) || 'dashboard';
  navigate(page);
});

// ─── Shared utilities ─────────────────────────────────────────────────────────
window.api = {
  get: (url) =>
    fetch(url).then(r => {
      if (!r.ok) return r.json().then(d => Promise.reject(new Error(d.error || `HTTP ${r.status}`)));
      return r.json();
    }),
  post: (url, body) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => {
      if (!r.ok) return r.json().then(d => Promise.reject(new Error(d.error || `HTTP ${r.status}`)));
      return r.json();
    }),
  patch: (url, body) =>
    fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => {
      if (!r.ok) return r.json().then(d => Promise.reject(new Error(d.error || `HTTP ${r.status}`)));
      return r.json();
    }),
  delete: (url) =>
    fetch(url, { method: 'DELETE' }).then(r => {
      if (!r.ok) return r.json().then(d => Promise.reject(new Error(d.error || `HTTP ${r.status}`)));
      return r.json();
    }),
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (e) { return iso; }
}

function badge(text, color) {
  const colors = {
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    gray:   'bg-slate-100 text-slate-600 border-slate-200',
    ocean:  'bg-[#e8f4fd] text-[#0d5c8c] border-[#0d5c8c]/20',
  };
  return `<span class="text-xs font-medium px-2 py-0.5 rounded-full border inline-block ${colors[color] || colors.gray}">${text}</span>`;
}

function estadoBadge(estado) {
  const map = {
    'Nuevo': 'blue',
    'Contactado': 'yellow',
    'Cotizado': 'ocean',
    'Pedido Enviado': 'green',
    'Cerrado': 'green',
    'Abandonado': 'red',
  };
  return badge(estado, map[estado] || 'gray');
}

function etapaBadge(etapa) {
  const cfgs = {
    'nuevo':      ['Nuevo',      'gray'],
    'calificado': ['Calificado', 'blue'],
    'cotizado':   ['Cotizado',   'yellow'],
    'ganado':     ['Ganado',     'green'],
    'derivado':   ['Derivado',   'ocean'],
    'perdido':    ['Perdido',    'red'],
  };
  const [label, color] = cfgs[etapa || 'nuevo'] || cfgs.nuevo;
  return badge(label, color);
}

// ─── Role-based sidebar filtering ────────────────────────────────────────────
function aplicarFiltroRol(rol) {
  if (!rol || rol === 'admin') return;

  // Ejecutivos see only: Leads, Pipeline, Agenda
  const ocultosPorRol = {
    ejecutivo: ['dashboard', 'productos', 'clientes', 'ventas', 'pedidos', 'catalogo', 'campanas', 'chat-test', 'archivos', 'configuracion'],
  };

  const ocultos = ocultosPorRol[rol] || [];
  ocultos.forEach(page => {
    const a = document.querySelector(`a[data-page="${page}"]`);
    if (a) a.style.display = 'none';
  });

  // Hide section wrappers whose all links are now hidden
  document.querySelectorAll('#nav-links-herramientas, #nav-links-sistema').forEach(wrapper => {
    const visible = [...wrapper.querySelectorAll('a')].some(a => a.style.display !== 'none');
    if (!visible) {
      wrapper.style.display = 'none';
      const prev = wrapper.previousElementSibling;
      if (prev && prev.tagName === 'P') prev.style.display = 'none';
    }
  });
}

// ─── PWA Service Worker ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ─── Push notifications helper ────────────────────────────────────────────────
window.App.requestPushPermission = async function () {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

window.App.showLocalNotification = function (title, body, data = {}) {
  if (Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data,
      vibrate: [200, 100, 200],
    });
  }).catch(() => {
    new Notification(title, { body });
  });
};

// ─── Auto-refresh 10s ────────────────────────────────────────────────────────
let _autoRefreshInterval = null;

function startAutoRefresh() {
  if (_autoRefreshInterval) clearInterval(_autoRefreshInterval);
  _autoRefreshInterval = setInterval(async () => {
    const page = window.location.hash.replace('#', '') || 'dashboard';
    if (page === 'dashboard') {
      try { await refreshLeadsKPIs(); } catch (_) {}
      try { await refreshUltimosLeads(); } catch (_) {}
    }
    if (page === 'leads') {
      try { await cargarLeads(); } catch (_) {}
    }
  }, 10000);
}

window.addEventListener('load', () => setTimeout(startAutoRefresh, 3000));
window.addEventListener('hashchange', () => startAutoRefresh());

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  // Setup nav clicks
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const page = a.dataset.page;
      navigate(page);
    });
  });

  aplicarFiltroRol(App.usuario?.rol);

  // Initial route
  const initialPage = window.location.hash.slice(1) || 'dashboard';
  navigate(initialPage);
})();
