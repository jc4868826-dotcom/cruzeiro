'use strict';
const dataStore = require('../data/dataStore');

// ─── Búsquedas ────────────────────────────────────────────────────────────────

const MESES_ES = { ene:1, jan:1, feb:2, mar:3, abr:4, apr:4, may:5, jun:6, jul:7, ago:8, aug:8, sep:9, oct:10, nov:11, dic:12, dec:12 };

function _parseFechaEmision(str) {
  if (!str) return null;
  const parts = String(str).trim().toLowerCase().split('-');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const mes = MESES_ES[m];
  if (!mes) return null;
  const anio = parseInt(y) + (parseInt(y) < 100 ? 2000 : 0);
  return new Date(anio, mes - 1, parseInt(d));
}

function _calcularEsMayoristaActivo(rutDigitos) {
  const ventasFtp = dataStore.getVentasFTPRaw();
  const fuente = ventasFtp.length ? ventasFtp : dataStore.getVentasRaw();
  const limite = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  return fuente.some(v => {
    const rutV = String(v.rut || v.Rut || '').replace(/\D/g, '');
    if (rutV !== rutDigitos) return false;
    const fecha = _parseFechaEmision(v.fechaEmision || v.FechaEmision);
    return fecha && fecha >= limite;
  });
}

function buscarClientePorRut(inputRut) {
  const soloDigitos = String(inputRut).replace(/[^0-9]/g, '');

  // 1. Buscar en ventasMap (Excel)
  const map = dataStore.getVentasMap();
  let cliente = null;
  if (map.has(soloDigitos)) {
    cliente = map.get(soloDigitos);
  } else {
    for (const [k, v] of map) {
      if (soloDigitos.startsWith(k) || k.startsWith(soloDigitos)) { cliente = v; break; }
    }
  }

  // 2. Si no encontrado, buscar en FTP clientes
  if (!cliente) {
    const ftpMap = dataStore.getClientesFTP();
    if (ftpMap.has(soloDigitos)) {
      cliente = ftpMap.get(soloDigitos);
    } else {
      for (const [k, v] of ftpMap) {
        if (soloDigitos.startsWith(k) || k.startsWith(soloDigitos)) { cliente = v; break; }
      }
    }
  }

  if (!cliente) return null;

  // 3. Calcular esMayoristaActivo
  const esMayoristaActivo = _calcularEsMayoristaActivo(soloDigitos);
  return { ...cliente, esMayoristaActivo };
}

function buscarCotizacionesPorRut(rutInput) {
  const soloDigitos = String(rutInput).replace(/[^0-9]/g, '');
  if (!soloDigitos) return [];
  return dataStore.getCotizacionesFTP()
    .filter(c => {
      const rutC = String(c.rut).replace(/[^0-9]/g, '');
      return soloDigitos === rutC || soloDigitos.startsWith(rutC) || rutC.startsWith(soloDigitos);
    })
    .sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));
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

// ─── Clasificación por RUT: dos búsquedas FTP ────────────────────────────────
// Retorna { canal, tipo, cliente, razonSocial, ejecutivo }
// tipo: 'nuevo' (no en Clientes.csv) | 'inactivo' (sin ventas 180d) | 'activo' (tiene ventas)

function clasificarPorRut(rutRaw) {
  const rutDigitos = String(rutRaw).replace(/\D/g, '');
  if (!rutDigitos) return { canal: 'ecommerce', tipo: 'nuevo', cliente: null };

  // BÚSQUEDA 1: Clientes.csv (FTP clientesMap)
  const ftpMap = dataStore.getClientesFTP();
  let clienteRaw = null;
  if (ftpMap.has(rutDigitos)) {
    clienteRaw = ftpMap.get(rutDigitos);
  } else {
    for (const [k, v] of ftpMap) {
      if (rutDigitos.startsWith(k) || k.startsWith(rutDigitos)) { clienteRaw = v; break; }
    }
  }
  if (!clienteRaw) return { canal: 'ecommerce', tipo: 'nuevo', cliente: null };

  // BÚSQUEDA 2: Ventas_OR.csv — últimos 180 días
  const fuente = dataStore.getVentasFTPRaw().length
    ? dataStore.getVentasFTPRaw()
    : dataStore.getVentasRaw();
  const limite = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const tieneCompraReciente = fuente.some(v => {
    const rutV = String(v.rut || v.Rut || '').replace(/\D/g, '');
    if (rutV !== rutDigitos) return false;
    const fecha = _parseFechaEmision(v.fechaEmision || v.FechaEmision);
    return fecha && fecha >= limite;
  });

  if (tieneCompraReciente) {
    return {
      canal: 'mayorista',
      tipo: 'activo',
      cliente: clienteRaw,
      razonSocial: clienteRaw.razonSocial || '',
      ejecutivo: clienteRaw.vendedor || '',
    };
  }
  return {
    canal: 'ecommerce',
    tipo: 'inactivo',
    cliente: clienteRaw,
    razonSocial: clienteRaw.razonSocial || '',
    ejecutivo: clienteRaw.vendedor || '',
  };
}

module.exports = {
  buscarClientePorRut,
  buscarCotizacionesPorRut,
  buscarEjecutivo,
  buscarPedidosPorRut,
  resolverEjecutivo,
  clasificarPorRut,
  getTodosCatalogo,
  cargarTodosEjecutivos,
  cargarClientes,
  cargarPedidos,
};
