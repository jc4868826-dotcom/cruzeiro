'use strict';
const ftp = require('basic-ftp');
const { Writable } = require('stream');
const xlsx = require('xlsx');

const RELOAD_MS = 10 * 60 * 1000;
const ESTADOS_COTIZACION = new Set(['ACEPTADA COMPLETA', 'ACEPTADA PARCIAL', 'VENCIDA', 'VIGENTE', 'PENDIENTE']);

let _store = {
  clientesMap:  new Map(),
  ventasRaw:    [],
  cotizaciones: [],
  stockMap:     new Map(),
  wooMap:       {},
  wooOrders:    [],
  estadoPedidos:[],
  lastLoaded:   null,
};

// ─── Parsing helpers ─────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].replace(/^﻿/, '').split(';').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(';');
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] !== undefined ? vals[i] : '').trim(); });
    return row;
  });
}

function normalizarUnidad(u) {
  const v = String(u || '').trim();
  const vl = v.toLowerCase();
  if (vl === 'mt' || vl === 'mt.' || vl === 'und') return 'MT';
  if (vl === 'c/u' || vl === 'cu')                 return 'CU';
  if (vl === 'kg.' || vl === 'kg')                 return 'KG';
  if (vl === 'tira')                               return 'TIRA';
  return v.toUpperCase();
}

function parsearPrecio(str) {
  if (str == null) return 0;
  const clean = String(str).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// ─── CSV loaders ─────────────────────────────────────────────────────────────

function cargarClientesFTP(rows) {
  const map = new Map();
  for (const row of rows) {
    const rut = String(row['Rut'] || '').replace(/\D/g, '');
    if (!rut || rut === '0' || rut === '1') continue;
    map.set(rut, {
      rut,
      dv:          String(row['Digito']     || '').trim(),
      razonSocial: String(row['RazonSocial']|| '').trim(),
      vendedor:    String(row['Vendedor']   || '').trim(),
      email:       String(row['Email']      || '').trim(),
      celular:     String(row['Celular']    || '').trim(),
      giro:        String(row['Giro']       || '').trim(),
      segmentoErp: String(row['Segmento']   || '').trim(),
    });
  }
  return map;
}

function cargarVentasFTP(rows) {
  return rows.map(row => ({
    rut:          String(row['Rut']          || '').replace(/\D/g, ''),
    dv:           String(row['Digito']       || '').trim(),
    razonSocial:  String(row['RazonSocial']  || '').trim(),
    codigo:       String(row['CODIGO']       || '').trim(),
    descripcion:  String(row['DESCRIPCION']  || '').trim(),
    vendedor:     String(row['Vendedor']     || '').trim(),
    precio:       parsearPrecio(row['precio']),
    pxq:          parsearPrecio(row['PxQ']),
    fechaEmision: String(row['FechaEmision'] || '').trim(),
    tipoNegocio:  String(row['Tipo_Negocio']|| '').trim(),
    familia:      String(row['Familia']      || '').trim(),
    padreFamilia: String(row['Padre_familia']|| '').trim(),
  }));
}

function cargarCotizacionesFTP(rows) {
  return rows
    .filter(row => ESTADOS_COTIZACION.has(String(row['Estado'] || '').trim()))
    .map(row => ({
      tipoNegocio:    String(row['Tipo_Negocio']     || '').trim(),
      rut:            String(row['RUT'] || row['Rut'] || '').replace(/\D/g, ''),
      dv:             String(row['Digito']           || '').trim(),
      razonSocial:    String(row['RazonSocial']      || '').trim(),
      vendedor:       String(row['Vendedor']         || '').replace(/\s*\([^)]*\)/g, '').trim(),
      codigo:         String(row['CODIGO']           || '').trim(),
      descripcion:    String(row['DESCRIPCION']      || '').trim(),
      unidad:         String(row['UNIDAD']           || '').trim(),
      cantidad:       parseFloat(row['CANTIDAD'])    || 0,
      precioCotizado: parsearPrecio(row['PRECIOCOTIZADO']),
      totalItem:      parsearPrecio(row['Total_item']),
      estado:         String(row['Estado']           || '').trim(),
      fecha:          String(row['Fecha']            || '').trim(),
    }));
}

function _parseFechaNVRaw(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function cargarEstadoPedidosFTP(rows) {
  return rows
    .filter(row => String(row['Rut'] || '').trim() !== '')
    .map(row => ({
      notaVenta:      String(row['Nota_Venta']           || '').trim(),
      statusPedido:   String(row['status_pedido']         || '').trim(),
      fechaFacturado: String(row['fecha_facturado']       || '').trim(),
      rut:            String(row['Rut']                   || '').replace(/\D/g, ''),
      razonSocial:    String(row['RazonSocial']           || '').trim(),
      vendedor:       String(row['Vendedor']              || '').trim(),
      fechaNV:        String(row['Fecha Nota de Venta']   || '').trim(),
      fechaEntrega:   String(row['Fecha Entrega']         || '').trim(),
      ordenCompra:    String(row['ordencompra']           || '').trim(),
      estado:         String(row['Estado']                || '').trim(),
      tipoNegocio:    String(row['tipo_negocio']          || '').trim(),
      tipoTransporte: String(row['tipotransporte']        || '').trim(),
      transporte:     String(row['transporte']            || '').trim(),
      direccion:      String(row['direcciondespacho']     || '').trim(),
      comuna:         String(row['Comuna']                || '').trim(),
      _fechaNVParsed: _parseFechaNVRaw(row['Fecha Nota de Venta']),
    }));
}

function cargarStockFTP(rows) {
  const map = new Map();
  for (const row of rows) {
    const codigo = String(row['Codigo'] || '').trim();
    if (!codigo || codigo.startsWith('P355')) continue;
    map.set(codigo, {
      codigo,
      descripcion: String(row['Descripcion'] || '').trim(),
      unidad:      normalizarUnidad(row['Unidad']),
      saldo:       Math.max(0, Math.round(parseFloat(String(row['Saldo'] || '').replace(',', '.')) || 0)),
    });
  }
  return map;
}

function cargarWooMapFTP(buf) {
  const mapa = {};
  const lineas = buf.toString('latin1').split(/\r?\n/).filter(l => l.trim());
  for (const linea of lineas) {
    const partes = linea.split(',').map(p => p.trim().replace(/^"(.*)"$/, '$1'));
    if (partes.length >= 2 && /^\d+$/.test(partes[0])) {
      mapa[partes[1]] = partes[0]; // { SKU: wooId }
    }
  }
  return mapa;
}

function cargarRegPedidosFTP(buf) {
  const wb = xlsx.read(buf, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets['Pedidos'];
  if (!ws) return [];
  const filas = xlsx.utils.sheet_to_json(ws, { defval: '' });
  const normRut = r => String(r || '').replace(/[^0-9]/g, '');
  const pedidosMap = {};

  for (const fila of filas) {
    const nroPedido = String(fila['Número de pedido'] || '').trim();
    if (!nroPedido) continue;
    const rut = normRut(fila['RUT']);

    if (!pedidosMap[nroPedido]) {
      const rawFecha = fila['Fecha del pedido'];
      const fechaStr = rawFecha instanceof Date
        ? rawFecha.toISOString().slice(0, 10)
        : String(rawFecha || '').slice(0, 10);
      pedidosMap[nroPedido] = {
        nroPedido,
        rut,
        rutOriginal: String(fila['RUT'] || ''),
        estado:   String(fila['Estado del pedido'] || '').trim(),
        fecha:    fechaStr,
        nombre:   `${fila['Nombre (facturación)'] || ''} ${fila['Apellidos (facturación)'] || ''}`.trim(),
        email:    String(fila['Correo electrónico (facturación)'] || '').trim(),
        telefono: String(fila['Teléfono (facturación)'] || '').trim(),
        total:    Number(fila['Importe total del pedido']) || 0,
        envio:    String(fila['Título del método de envío'] || '').trim(),
        pago:     String(fila['Título del método de pago'] || '').trim(),
        items:    [],
      };
    }
    const sku = String(fila['SKU'] || '').trim();
    if (sku) {
      pedidosMap[nroPedido].items.push({
        sku,
        articulo: String(fila['Nombre del artículo'] || '').trim(),
        cantidad: Number(fila['Cantidad (- reembolso)']) || 0,
        costo:    Number(fila['Coste de artículo']) || 0,
      });
    }
  }
  return Object.values(pedidosMap);
}

// ─── FTP download ─────────────────────────────────────────────────────────────

async function downloadToBuffer(client, remotePath) {
  const chunks = [];
  const writable = new Writable({
    write(chunk, enc, cb) { chunks.push(chunk); cb(); },
  });
  await client.downloadTo(writable, remotePath);
  return Buffer.concat(chunks);
}

async function downloadAndParse() {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await client.access({
      host:     process.env.FTP_HOST,
      port:     parseInt(process.env.FTP_PORT || '21'),
      user:     process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure:   false,
    });

    let clientesMap   = _store.clientesMap;
    let ventasRaw     = _store.ventasRaw;
    let cotizaciones  = _store.cotizaciones;
    let stockMap      = _store.stockMap;
    let wooMap        = _store.wooMap;
    let wooOrders     = _store.wooOrders;
    let estadoPedidos = _store.estadoPedidos;

    const tareas = [
      { file: 'Clientes.csv',             load: rows => { clientesMap   = cargarClientesFTP(rows); } },
      { file: 'Ventas_OR.csv',            load: rows => { ventasRaw     = cargarVentasFTP(rows); } },
      { file: 'Cotizaciones_OR.csv',      load: rows => { cotizaciones  = cargarCotizacionesFTP(rows); } },
      { file: 'StockSucursal.csv',        load: rows => { stockMap      = cargarStockFTP(rows); } },
      { file: 'Estado_Notas_Pedido.csv',  load: rows => { estadoPedidos = cargarEstadoPedidosFTP(rows); } },
    ];

    for (const { file, load } of tareas) {
      try {
        const buf  = await downloadToBuffer(client, file);
        const text = buf.toString('latin1');
        load(parseCSV(text));
      } catch (e) {
        console.error(`[ftpLoader] Error cargando ${file}:`, e.message);
      }
    }

    // WooMap.csv — comma-delimited, sin header, ID,SKU
    try {
      const buf = await downloadToBuffer(client, 'WooMap.csv');
      wooMap = cargarWooMapFTP(buf);
      console.log(`[ftpLoader] WooMap: ${Object.keys(wooMap).length} SKUs mapeados`);
    } catch (e) {
      console.error('[ftpLoader] Error cargando WooMap.csv:', e.message);
    }

    // RegPedidos.xlsx — WooCommerce orders grouped by order number
    try {
      const buf = await downloadToBuffer(client, 'RegPedidos.xlsx');
      wooOrders = cargarRegPedidosFTP(buf);
      console.log(`[ftpLoader] RegPedidos: ${wooOrders.length} pedidos WooCommerce`);
    } catch (e) {
      console.error('[ftpLoader] Error cargando RegPedidos.xlsx:', e.message);
    }

    _store = { clientesMap, ventasRaw, cotizaciones, stockMap, wooMap, wooOrders, estadoPedidos, lastLoaded: new Date() };
    console.log(`[ftpLoader] OK: ${clientesMap.size} clientes | ${ventasRaw.length} ventas | ${cotizaciones.length} cotizaciones | ${stockMap.size} SKUs stock | ${Object.keys(wooMap).length} wooMap | ${wooOrders.length} pedidosWoo | ${estadoPedidos.length} estadoPedidos`);
  } catch (e) {
    console.error('[ftpLoader] Error de conexión FTP:', e.message);
  } finally {
    client.close();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function init() {
  await downloadAndParse();
  setInterval(() => {
    downloadAndParse().catch(e => console.error('[ftpLoader] Reload error:', e.message));
  }, RELOAD_MS);
}

function getClientesMap()  { return _store.clientesMap; }
function getVentasRaw()    { return _store.ventasRaw; }
function getCotizaciones() { return _store.cotizaciones; }
function getStockMap()     { return _store.stockMap; }
function getWooMap()       { return _store.wooMap; }
function getWooOrders()    { return _store.wooOrders; }
function getEstadoPedidos(){ return _store.estadoPedidos; }
function getWooOrdersByRut(rut) {
  const norm = String(rut || '').replace(/[^0-9]/g, '');
  if (!norm) return [];
  return _store.wooOrders.filter(o => o.rut === norm);
}

module.exports = { init, getClientesMap, getVentasRaw, getCotizaciones, getStockMap, getWooMap, getWooOrders, getEstadoPedidos, getWooOrdersByRut };
