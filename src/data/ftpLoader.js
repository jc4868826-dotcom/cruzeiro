'use strict';
const ftp = require('basic-ftp');
const { Writable } = require('stream');

const RELOAD_MS = 10 * 60 * 1000;
const ESTADOS_COTIZACION = new Set(['ACEPTADA COMPLETA', 'ACEPTADA PARCIAL', 'VENCIDA', 'VIGENTE', 'PENDIENTE']);

let _store = {
  clientesMap:  new Map(),
  ventasRaw:    [],
  cotizaciones: [],
  stockMap:     new Map(),
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
      rut:            String(row['RUT']              || '').replace(/\D/g, ''),
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

    let clientesMap  = _store.clientesMap;
    let ventasRaw    = _store.ventasRaw;
    let cotizaciones = _store.cotizaciones;
    let stockMap     = _store.stockMap;

    const tareas = [
      { file: 'Clientes.csv',        load: rows => { clientesMap  = cargarClientesFTP(rows); } },
      { file: 'Ventas_OR.csv',       load: rows => { ventasRaw    = cargarVentasFTP(rows); } },
      { file: 'Cotizaciones_OR.csv', load: rows => { cotizaciones = cargarCotizacionesFTP(rows); } },
      { file: 'StockSucursal.csv',   load: rows => { stockMap     = cargarStockFTP(rows); } },
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

    _store = { clientesMap, ventasRaw, cotizaciones, stockMap, lastLoaded: new Date() };
    console.log(`[ftpLoader] OK: ${clientesMap.size} clientes | ${ventasRaw.length} ventas | ${cotizaciones.length} cotizaciones | ${stockMap.size} SKUs stock`);
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

module.exports = { init, getClientesMap, getVentasRaw, getCotizaciones, getStockMap };
