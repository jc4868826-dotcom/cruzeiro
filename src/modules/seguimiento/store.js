'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../config');

const DIR = path.join(DATA_DIR, 'seguimiento');
const FILE = path.join(DIR, 'tareas.json');
const USERS_FILE = path.join(DIR, 'usuarios.json');

const SEED = [{"id":1,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Firma formalización de contrato (cláusulas revisadas)","responsable":"Ambos","inicio":"2026-07-13","termino":"2026-07-15","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":2,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Envío propuesta tarifa UF/hora Etapa 2 (cláusula 14.1)","responsable":"Proveedor","inicio":"2026-07-13","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":3,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Acceso Business Manager Meta + número exclusivo","responsable":"Cruzeiro","inicio":"2026-07-13","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":4,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Método de pago registrado en Meta","responsable":"Cruzeiro","inicio":"2026-07-13","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":5,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Acceso administrador Microsoft Clarity","responsable":"Cruzeiro","inicio":"2026-07-13","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":6,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Definición sistema de estado de pedidos","responsable":"Cruzeiro","inicio":"2026-07-13","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":7,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Entrega catálogo de productos (CSV o URL)","responsable":"Cruzeiro","inicio":"2026-07-13","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":8,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Credenciales Khipu (activación inmediata)","responsable":"Cruzeiro","inicio":"2026-07-13","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":9,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Credenciales Transbank (5–10 días hábiles)","responsable":"Cruzeiro","inicio":"2026-07-13","termino":"2026-07-24","estado":"Pendiente","avance":0,"riesgo":"Riesgo de plazo: activación puede tardar y correr el cronograma","bitacora":[]},{"id":10,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Base de contactos CSV para campañas (opt-in)","responsable":"Cruzeiro","inicio":"2026-07-13","termino":"2026-07-20","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":11,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Flujos de conversación y tono aprobados","responsable":"Ambos","inicio":"2026-07-13","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":12,"faseId":"FASE 0","fase":"Formalización y Accesos","tarea":"Textos plantillas HSM (envío a Meta, aprob. 1–3 días)","responsable":"Ambos","inicio":"2026-07-15","termino":"2026-07-22","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":13,"faseId":"FASE 1","fase":"Relevamiento y Setup (Sem. 1)","tarea":"Configuración cuentas Meta / WABA","responsable":"Proveedor","inicio":"2026-07-13","termino":"2026-07-16","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":14,"faseId":"FASE 1","fase":"Relevamiento y Setup (Sem. 1)","tarea":"Setup entorno Render (namespace /data/cruzeiro/)","responsable":"Proveedor","inicio":"2026-07-13","termino":"2026-07-15","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":15,"faseId":"FASE 1","fase":"Relevamiento y Setup (Sem. 1)","tarea":"Integración WhatsApp Business API","responsable":"Proveedor","inicio":"2026-07-15","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":16,"faseId":"FASE 1","fase":"Relevamiento y Setup (Sem. 1)","tarea":"Entrega primera versión del bot (hito viernes)","responsable":"Proveedor","inicio":"2026-07-17","termino":"2026-07-17","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":17,"faseId":"FASE 2","fase":"Desarrollo Bot e Integraciones (Sem. 2)","tarea":"Flujos de conversación + motor NLP de intención","responsable":"Proveedor","inicio":"2026-07-20","termino":"2026-07-22","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":18,"faseId":"FASE 2","fase":"Desarrollo Bot e Integraciones (Sem. 2)","tarea":"Enrutamiento ecommerce/mayorista + derivación humana","responsable":"Proveedor","inicio":"2026-07-20","termino":"2026-07-23","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":19,"faseId":"FASE 2","fase":"Desarrollo Bot e Integraciones (Sem. 2)","tarea":"Recomendación de productos (cross-selling)","responsable":"Proveedor","inicio":"2026-07-21","termino":"2026-07-23","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":20,"faseId":"FASE 2","fase":"Desarrollo Bot e Integraciones (Sem. 2)","tarea":"Links de pago Transbank/Khipu (in-chat)","responsable":"Proveedor","inicio":"2026-07-21","termino":"2026-07-24","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":21,"faseId":"FASE 2","fase":"Desarrollo Bot e Integraciones (Sem. 2)","tarea":"Integración Microsoft Clarity (carritos abandonados)","responsable":"Proveedor","inicio":"2026-07-22","termino":"2026-07-24","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":22,"faseId":"FASE 2","fase":"Desarrollo Bot e Integraciones (Sem. 2)","tarea":"Integración catalogAdapter (respuestas sin hallucination)","responsable":"Proveedor","inicio":"2026-07-20","termino":"2026-07-23","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":23,"faseId":"FASE 2","fase":"Desarrollo Bot e Integraciones (Sem. 2)","tarea":"Encuestas NPS post-venta","responsable":"Proveedor","inicio":"2026-07-23","termino":"2026-07-24","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":24,"faseId":"FASE 2","fase":"Desarrollo Bot e Integraciones (Sem. 2)","tarea":"Aprobación de plantillas HSM por Meta","responsable":"Ambos","inicio":"2026-07-20","termino":"2026-07-22","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":25,"faseId":"FASE 3","fase":"Dashboard, QA y Aceptación (Sem. 3)","tarea":"Dashboard de KPIs (accordions ecommerce/mayorista)","responsable":"Proveedor","inicio":"2026-07-27","termino":"2026-07-29","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":26,"faseId":"FASE 3","fase":"Dashboard, QA y Aceptación (Sem. 3)","tarea":"Definición checklist Acta de Aceptación (cláusula 11ª)","responsable":"Ambos","inicio":"2026-07-27","termino":"2026-07-28","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":27,"faseId":"FASE 3","fase":"Dashboard, QA y Aceptación (Sem. 3)","tarea":"Mecanismo carga CSV precios/stock (cláusula 5ª)","responsable":"Proveedor","inicio":"2026-07-28","termino":"2026-07-30","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":28,"faseId":"FASE 3","fase":"Dashboard, QA y Aceptación (Sem. 3)","tarea":"Pruebas de carga y casos borde","responsable":"Proveedor","inicio":"2026-07-29","termino":"2026-07-31","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":29,"faseId":"FASE 3","fase":"Dashboard, QA y Aceptación (Sem. 3)","tarea":"Revisión y validación con equipo Cruzeiro","responsable":"Ambos","inicio":"2026-07-31","termino":"2026-07-31","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":30,"faseId":"FASE 4","fase":"Lanzamiento (Sem. 4)","tarea":"Go-live productivo","responsable":"Proveedor","inicio":"2026-08-03","termino":"2026-08-03","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":31,"faseId":"FASE 4","fase":"Lanzamiento (Sem. 4)","tarea":"Firma Acta de Aceptación (gatilla pago 50% final)","responsable":"Ambos","inicio":"2026-08-03","termino":"2026-08-04","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":32,"faseId":"FASE 4","fase":"Lanzamiento (Sem. 4)","tarea":"Capacitación equipo Cruzeiro (5 personas, 3h)","responsable":"Proveedor","inicio":"2026-08-04","termino":"2026-08-05","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":33,"faseId":"FASE 4","fase":"Lanzamiento (Sem. 4)","tarea":"Soporte intensivo post-lanzamiento (2 semanas)","responsable":"Proveedor","inicio":"2026-08-03","termino":"2026-08-14","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":34,"faseId":"FASE 5","fase":"Marcha Blanca (3 meses)","tarea":"Marcha blanca – Mes 1 + informe mensual","responsable":"Ambos","inicio":"2026-08-03","termino":"2026-08-31","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":35,"faseId":"FASE 5","fase":"Marcha Blanca (3 meses)","tarea":"Respaldo mensual de datos (cláusula 10ª)","responsable":"Proveedor","inicio":"2026-08-03","termino":"2026-11-03","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":36,"faseId":"FASE 5","fase":"Marcha Blanca (3 meses)","tarea":"Marcha blanca – Mes 2 + informe mensual","responsable":"Ambos","inicio":"2026-09-01","termino":"2026-09-30","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":37,"faseId":"FASE 5","fase":"Marcha Blanca (3 meses)","tarea":"Marcha blanca – Mes 3 + informe mensual","responsable":"Ambos","inicio":"2026-10-01","termino":"2026-10-31","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":38,"faseId":"FASE 5","fase":"Marcha Blanca (3 meses)","tarea":"Evaluación fin marcha blanca / continuidad","responsable":"Ambos","inicio":"2026-11-02","termino":"2026-11-03","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":39,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Diseño esquema de datos exportable desde el bot","responsable":"Proveedor","inicio":"2026-07-13","termino":"2026-07-24","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":40,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Levantamiento alcance: gestión de leads","responsable":"Proveedor","inicio":"2026-08-03","termino":"2026-08-11","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":41,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Levantamiento alcance: pipeline de ventas","responsable":"Proveedor","inicio":"2026-08-03","termino":"2026-08-11","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":42,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Levantamiento alcance: ficha única de cliente","responsable":"Proveedor","inicio":"2026-08-10","termino":"2026-08-18","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":43,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Levantamiento alcance: gestión de cotizaciones","responsable":"Proveedor","inicio":"2026-08-10","termino":"2026-08-18","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":44,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Levantamiento alcance: reportería comercial","responsable":"Proveedor","inicio":"2026-08-17","termino":"2026-08-25","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":45,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Levantamiento alcance: roles y permisos","responsable":"Proveedor","inicio":"2026-08-17","termino":"2026-08-21","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":46,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Levantamiento alcance: integración API / futuro ERP","responsable":"Proveedor","inicio":"2026-08-21","termino":"2026-08-28","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":47,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Estimación orden de magnitud (alcance + costos)","responsable":"Proveedor","inicio":"2026-08-25","termino":"2026-09-01","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]},{"id":48,"faseId":"FASE 6","fase":"Etapa 2: CRM Mayorista (paralelo)","tarea":"Presentación estimación CRM a Cruzeiro (presup. 2027)","responsable":"Ambos","inicio":"2026-09-01","termino":"2026-09-04","estado":"Pendiente","avance":0,"riesgo":null,"bitacora":[]}];

// ─── Tareas ───────────────────────────────────────────────────────────────────

function load() {
  fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(SEED, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getTareas() {
  return load();
}

function updateTarea(id, fields) {
  const data = load();
  const idx = data.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const allowed = ['estado', 'avance', 'inicio', 'termino'];
  allowed.forEach(k => { if (fields[k] !== undefined) data[idx][k] = fields[k]; });
  save(data);
  return data[idx];
}

function addBitacora(id, autor, texto) {
  const data = load();
  const idx = data.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const entry = { fecha: new Date().toISOString(), autor, texto };
  data[idx].bitacora.push(entry);
  save(data);
  return entry;
}

function getKpis() {
  const data = load();
  const hoy = new Date().toISOString().slice(0, 10);
  const total = data.length;
  const completadas = data.filter(t => t.estado === 'Completado').length;
  const atrasadas = data.filter(t => t.estado !== 'Completado' && t.termino < hoy).length;

  const duracion = t => {
    const d = (new Date(t.termino) - new Date(t.inicio)) / 86400000 + 1;
    return Math.max(d, 1);
  };
  const totalDias = data.reduce((s, t) => s + duracion(t), 0);
  const avanceGlobal = Math.round(
    data.reduce((s, t) => s + t.avance * duracion(t), 0) / totalDias
  );

  const faseMap = {};
  data.forEach(t => {
    if (!faseMap[t.fase]) faseMap[t.fase] = { suma: 0, n: 0 };
    faseMap[t.fase].suma += t.avance;
    faseMap[t.fase].n += 1;
  });
  const avancePorFase = Object.entries(faseMap).map(([fase, v]) => ({
    fase,
    avance: Math.round(v.suma / v.n),
  }));

  const respMap = {};
  data.forEach(t => {
    if (!respMap[t.responsable]) respMap[t.responsable] = { suma: 0, n: 0 };
    respMap[t.responsable].suma += t.avance;
    respMap[t.responsable].n += 1;
  });
  const avancePorResponsable = Object.entries(respMap).map(([responsable, v]) => ({
    responsable,
    avance: Math.round(v.suma / v.n),
  }));

  const proximas = data
    .filter(t => t.estado !== 'Completado' && t.termino >= hoy)
    .sort((a, b) => a.termino.localeCompare(b.termino));
  const proximoHito = proximas[0] ? { tarea: proximas[0].tarea, termino: proximas[0].termino } : null;

  return { avanceGlobal, tareasCompletadas: completadas, tareasTotal: total, tareasAtrasadas: atrasadas, avancePorFase, avancePorResponsable, proximoHito };
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

function ensureUsuarios() {
  fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('demo1234', 10);
    const seed = [{
      id: 1, usuario: 'admin', nombre: 'Administrador',
      passwordHash: hash, rol: 'admin', activo: true,
      debeCambiarPassword: true, creadoEn: new Date().toISOString(),
    }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(seed, null, 2));
    console.log('[seguimiento] Usuario admin creado con clave temporal — cámbiala de inmediato');
  }
}

function loadUsuarios() {
  ensureUsuarios();
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsuarios(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function getUsuarios() {
  return loadUsuarios().map(({ passwordHash, ...u }) => u);
}

function findUsuario(usuario) {
  return loadUsuarios().find(u => u.usuario === usuario) || null;
}

function createUsuario({ usuario, nombre, passwordHash, rol }) {
  const data = loadUsuarios();
  if (data.find(u => u.usuario === usuario)) throw new Error('Usuario ya existe');
  const u = {
    id: Math.max(0, ...data.map(x => x.id)) + 1,
    usuario, nombre, passwordHash, rol,
    activo: true, debeCambiarPassword: true,
    creadoEn: new Date().toISOString(),
  };
  data.push(u);
  saveUsuarios(data);
  const { passwordHash: _, ...safe } = u;
  return safe;
}

function updateUsuario(id, fields) {
  const data = loadUsuarios();
  const idx = data.findIndex(u => u.id === id);
  if (idx === -1) return null;
  Object.assign(data[idx], fields);
  saveUsuarios(data);
  const { passwordHash, ...safe } = data[idx];
  return safe;
}

function deleteUsuario(id) {
  const data = loadUsuarios();
  const u = data.find(x => x.id === id);
  if (!u) return null;
  if (u.rol === 'admin') {
    const otrosAdmins = data.filter(x => x.rol === 'admin' && x.activo && x.id !== id);
    if (otrosAdmins.length === 0) throw new Error('No se puede eliminar el último admin activo');
  }
  saveUsuarios(data.filter(x => x.id !== id));
}

module.exports = {
  getTareas, updateTarea, addBitacora, getKpis,
  getUsuarios, findUsuario, createUsuario, updateUsuario, deleteUsuario,
};
