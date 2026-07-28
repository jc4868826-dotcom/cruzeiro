'use strict';
const dataStore = require('../data/dataStore');

// ─── Búsquedas ────────────────────────────────────────────────────────────────

function buscarClientePorRut(inputRut) {
  const soloDigitos = String(inputRut).replace(/[^0-9]/g, '');
  const map = dataStore.getVentasMap();
  if (map.has(soloDigitos)) return map.get(soloDigitos);
  for (const [k, v] of map) {
    if (soloDigitos.startsWith(k) || k.startsWith(soloDigitos)) return v;
  }
  return null;
}

function buscarEjecutivo(username) {
  return dataStore.getEjecutivos().find(e => e.username === username) || null;
}

function buscarPedidosPorRut(rutInput) {
  const soloDigitos = String(rutInput).replace(/[^0-9]/g, '');
  return dataStore.getPedidos().filter(p => {
    const rutP = String(p.rut).replace(/[^0-9]/g, '');
    return soloDigitos === rutP || soloDigitos.startsWith(rutP) || rutP.startsWith(soloDigitos);
  });
}

function getTodosCatalogo()      { return dataStore.getCatalogo(); }
function cargarTodosEjecutivos() { return dataStore.getEjecutivos(); }
function cargarClientes()        { return [...dataStore.getVentasMap().values()]; }
function cargarPedidos()         { return dataStore.getPedidos(); }

// ─── Mapa vendedor → username ejecutivo ──────────────────────────────────────

const MAPA_EJECUTIVOS = {
  // ── Cartera Nicolás Pacheco ──────────────────────────────────────────────
  'NICOLAS PACHECO':              'nicolas.pacheco',
  'NICOLÁS PACHECO':              'nicolas.pacheco',
  'MARIA JOSE UTCHES':            'nicolas.pacheco',
  'MARÍA JOSE UTCHES':            'nicolas.pacheco',
  'ALEJANDRO PARRA':              'nicolas.pacheco',

  // ── Cartera Irma Jara ────────────────────────────────────────────────────
  'IRMA JARA':                    'irma.jara',
  'IRMA JARA (SANTIAGO)':         'irma.jara',
  'JAIME GONZALEZ':               'irma.jara',
  'JAIME GONZÁLEZ':               'irma.jara',

  // ── Cartera Marcos Diamond ───────────────────────────────────────────────
  'MARCOS DIAMOND':               'marcos.diamond',

  // ── Cartera Alejandro Oxman ──────────────────────────────────────────────
  'ALEJANDRO OXMAN':              'alejandro.oxman',

  // ── Cartera Cynthia Romo (jefa mayorista) ────────────────────────────────
  'CYNTHIA ROMO':                 'cynthia.romo',
  'CADENAS':                      'cynthia.romo',
  'CLAUDIA MARTINEZ GALARCE':     'cynthia.romo',
  'CLAUDIA MARTÍNEZ GALARCE':     'cynthia.romo',
  'ANDRES VARELA':                'cynthia.romo',
  'GUSTAVO CARDONA':              'cynthia.romo',
  'GERARDO AGUIRRE':              'cynthia.romo',
  'JOEL MOYA':                    'cynthia.romo',
  'LUIS BUSTOS MENA':             'cynthia.romo',
  'LUIS MUÑOZ':                   'cynthia.romo',

  // ── Jaime Cornejo (ecommerce + locales + canales internos) ───────────────
  'JAIME CORNEJO':                'jaime.cornejo',
  'MARCELO VALENZUELA':           'jaime.cornejo',
  'SOPORTE WEB':                  'jaime.cornejo',
  'TIENDA ONLINE':                'jaime.cornejo',
  'VENTA MESON':                  'jaime.cornejo',
  'VENTA MESÓN':                  'jaime.cornejo',
  'VENTAS OFICINA':               'jaime.cornejo',
  'VENTASSANTIAGO':               'jaime.cornejo',
  'VENTA A LOCAL PORTUGAL 696':   'jaime.cornejo',
  'VENTA A LOCAL QUILICURA':      'jaime.cornejo',
  'VENTA A LOCAL RONDIZZONI':     'jaime.cornejo',
};

function resolverEjecutivo(vendedor) {
  if (!vendedor) return null;
  const norm = String(vendedor).trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [k, u] of Object.entries(MAPA_EJECUTIVOS)) {
    const kn = k.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (norm === kn) return u;
  }
  return null;
}

module.exports = {
  buscarClientePorRut,
  buscarEjecutivo,
  buscarPedidosPorRut,
  resolverEjecutivo,
  getTodosCatalogo,
  cargarTodosEjecutivos,
  cargarClientes,
  cargarPedidos,
};
