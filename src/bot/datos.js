'use strict';
const path = require('path');
const xlsx = require('xlsx');

// Excel siempre desde el repo — el disco persistente Render (DATA_DIR) es solo para JSON en vivo
// Futuro: cambiar EXCEL_DIR a la ruta FTP montada o usar csv-parse para archivos CSV
const EXCEL_DIR = process.env.EXCEL_DIR || path.join(__dirname, '../../data/cruzeiro');

const ARCHIVOS = {
  maestra: path.join(EXCEL_DIR, '20260713 Maestra full.xlsx'),
  ventas:  path.join(EXCEL_DIR, '20260709 Ventas 2026.xlsx'),
  inputs:  path.join(EXCEL_DIR, 'Inputs BOT-CRM.xlsx'),
  pedidos: path.join(EXCEL_DIR, 'Estado Notas Pedido.xlsx'),
};

console.log('[datos.js] EXCEL_DIR:', EXCEL_DIR);
console.log('[datos.js] Archivos:', JSON.stringify(ARCHIVOS, null, 2));

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0];
}

let _clientes = null;
let _ejecutivos = null;
let _pedidos = null;
let _catalogo = null;

function cargarClientes() {
  if (_clientes) return _clientes;
  try {
    const wb = xlsx.readFile(ARCHIVOS.ventas);
    const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: null });
    const mapa = new Map();
    for (const r of rows) {
      const rut = String(r['Rut'] || '').trim();
      if (!rut || mapa.has(rut)) continue;
      mapa.set(rut, {
        rut,
        dv: String(r['Digito'] || '').trim(),
        nombre: r['RazonSocial'] || '',
        vendedor_actual: r['Vendedor'] || '',
        direccion: r['Direccion'] || '',
        ciudad: r['Ciudad'] || '',
        comuna: r['Comuna'] || '',
        fono: String(r['Fono'] || ''),
        email: r['Email'] || '',
        canal: r['Canal'] || '',
        ultima_venta: excelDateToISO(r['ultima_venta']),
      });
    }
    _clientes = [...mapa.values()];
  } catch (e) {
    console.error('[datos.js] Error leyendo', ARCHIVOS.ventas, e.message);
    _clientes = [];
  }
  return _clientes;
}

function cargarEjecutivos() {
  if (_ejecutivos) return _ejecutivos;
  try {
    const wb = xlsx.readFile(ARCHIVOS.inputs);
    const rows = xlsx.utils.sheet_to_json(wb.Sheets['Inputs'], { defval: null, header: 1 });
    _ejecutivos = [
      { username: 'marcelis.arguelles',  nombre: 'Marcelis Arguelles',  email: rows[9]?.[1],  fono: rows[9]?.[2],  rol: 'ecommerce' },
      { username: 'mauricio.santibanez', nombre: 'Mauricio Santibañez', email: rows[10]?.[1], fono: rows[10]?.[2], rol: 'ecommerce' },
      { username: 'jaime.cornejo',       nombre: 'Jaime Cornejo',       email: rows[13]?.[1], fono: rows[13]?.[2], rol: 'jefe_ecommerce' },
      { username: 'irma.jara',           nombre: 'Irma Jara',           email: rows[16]?.[1], fono: rows[16]?.[2], rol: 'mayorista' },
      { username: 'marcos.diamond',      nombre: 'Marcos Diamond',      email: rows[17]?.[1], fono: rows[17]?.[2], rol: 'mayorista' },
      { username: 'nicolas.pacheco',     nombre: 'Nicolás Pacheco',     email: rows[18]?.[1], fono: rows[18]?.[2], rol: 'mayorista' },
      { username: 'alejandro.oxman',     nombre: 'Alejandro Oxman',     email: rows[19]?.[1], fono: rows[19]?.[2], rol: 'mayorista' },
      { username: 'cynthia.romo',        nombre: 'Cynthia Romo',        email: rows[20]?.[1], fono: rows[20]?.[2], rol: 'jefe_mayorista' },
    ];
  } catch (e) {
    console.error('[datos.js] Error leyendo', ARCHIVOS.inputs, e.message);
    _ejecutivos = [];
  }
  return _ejecutivos;
}

function cargarPedidos() {
  if (_pedidos) return _pedidos;
  try {
    const wb = xlsx.readFile(ARCHIVOS.pedidos);
    const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: null });
    _pedidos = rows.map(r => ({
      nv: r['Nota_Venta'],
      estado: r['status_pedido'] || '',
      rut: String(r['Rut'] || '').trim(),
      razon_social: r['RazonSocial'] || '',
      vendedor: r['Vendedor'] || '',
      fecha_entrega: r['Fecha Entrega'] || null,
      orden_compra: r['ordencompra'] || '',
      tipo_transporte: r['tipotransporte'] || '',
      transporte: r['transporte'] || '',
      direccion: r['direcciondespacho'] || '',
      comuna: r['Comuna'] || '',
    }));
  } catch (e) {
    console.error('[datos.js] Error leyendo', ARCHIVOS.pedidos, e.message);
    _pedidos = [];
  }
  return _pedidos;
}

function cargarCatalogo() {
  if (_catalogo) return _catalogo;
  try {
    const wb = xlsx.readFile(ARCHIVOS.maestra);

    // Hoja1: índice de stock + precio_lista por SKU (columna Codigo)
    // Los headers tienen espacios extra — se normalizan con trim
    const h1rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: null });
    const stockMap = new Map();
    for (const r of h1rows) {
      const row = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), v]));
      const sku = String(row['Codigo'] || '').trim();
      if (!sku) continue;
      stockMap.set(sku, {
        stock:        row['Saldo']        != null ? Number(row['Saldo'])        : null,
        precio_lista: row['Precio Venta'] != null ? Number(row['Precio Venta']) : null,
        familia:      row['Familia']      || '',
        padre_familia: row['Padre_familia'] || '',
        unidad:       row['unidad']       || 'C/U',
      });
    }

    // Hoja2: catálogo web cruzado con Hoja1
    const h2rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja2'], { defval: null });
    _catalogo = h2rows
      .filter(r => r['SKU'])
      .map(r => {
        const sku = String(r['SKU'] || '').trim();
        const h1 = stockMap.get(sku) || {};
        const stock = h1.stock ?? null;
        return {
          sku,
          nombre_web:    r['Nombre Web']       || '',
          descripcion:   r['Descripción Corta'] || '',
          precio:        r['Precio (CLP)'] != null ? Number(r['Precio (CLP)']) : null,
          categoria:     r['Categoría']    || '',
          subcategoria:  r['Subcategoría'] || '',
          atributos:     r['Atributos']    || '',
          imagen_url:    r['URL Imagen']   || '',
          familia:       h1.familia        || '',
          padre_familia: h1.padre_familia  || '',
          unidad:        h1.unidad         || 'C/U',
          precio_lista:  h1.precio_lista   || null,
          stock,
          tiene_stock: stock === null || stock > 0,
        };
      });
  } catch (e) {
    console.error('[datos.js] Error leyendo Maestra full.xlsx catálogo:', e.message);
    _catalogo = [];
  }
  return _catalogo;
}

function getTodosCatalogo() {
  return cargarCatalogo();
}

function cargarTodosEjecutivos() {
  return cargarEjecutivos();
}

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

function buscarClientePorRut(inputRut) {
  const soloNumeros = String(inputRut).replace(/[^0-9]/g, '');
  return cargarClientes().find(c => {
    const rutNumeros = String(c.rut).replace(/[^0-9]/g, '');
    return soloNumeros === rutNumeros || soloNumeros.startsWith(rutNumeros) || rutNumeros.startsWith(soloNumeros);
  }) || null;
}

function buscarEjecutivo(username) {
  return cargarEjecutivos().find(e => e.username === username) || null;
}

function buscarPedidosPorRut(rutInput) {
  const soloNumeros = String(rutInput).replace(/[^0-9]/g, '');
  return cargarPedidos().filter(p => {
    const rutNumeros = String(p.rut).replace(/[^0-9]/g, '');
    return soloNumeros === rutNumeros || soloNumeros.startsWith(rutNumeros) || rutNumeros.startsWith(soloNumeros);
  });
}

module.exports = { buscarClientePorRut, buscarEjecutivo, buscarPedidosPorRut, resolverEjecutivo, getTodosCatalogo, cargarTodosEjecutivos };
