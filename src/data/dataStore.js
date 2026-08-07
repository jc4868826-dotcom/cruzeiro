'use strict';
const path = require('path');
const loaders    = require('./loaders');
const ftpLoader  = require('./ftpLoader');

const DATA_DIR = process.env.EXCEL_DIR || path.join(__dirname, '../../data/cruzeiro');
const RELOAD_INTERVAL_MS = 10 * 60 * 1000;

let store = { catalogo: [], ventasMap: new Map(), ventasRaw: [], usos: [], pedidos: [], ejecutivos: [], lastLoaded: null };

function _loadSync() {
  const maestraMap = loaders.loadMaestra(DATA_DIR);
  const webArray   = loaders.loadWeb(DATA_DIR);
  const catalogo   = loaders.buildCatalogo(maestraMap, webArray);
  const ventasMap  = loaders.loadVentas(DATA_DIR);
  const ventasRaw  = loaders.loadVentasRaw(DATA_DIR);
  const usos       = loaders.loadUsos(DATA_DIR);
  const pedidos    = loaders.loadPedidos(DATA_DIR);
  const ejecutivos = loaders.loadInputs(DATA_DIR);
  return { catalogo, ventasMap, ventasRaw, usos, pedidos, ejecutivos, lastLoaded: new Date() };
}

async function init() {
  store = _loadSync();
  console.log(`[dataStore] Init: ${store.catalogo.length} productos | ${store.ventasMap.size} clientes | ${store.ventasRaw.length} filas ventas | ${store.usos.length} filas usos | ${store.pedidos.length} pedidos | ${store.ejecutivos.length} ejecutivos`);
  if (process.env.FTP_HOST) {
    await ftpLoader.init();
    console.log(`[dataStore] FTP: ${ftpLoader.getClientesMap().size} clientes | ${ftpLoader.getVentasRaw().length} filas ventas | ${ftpLoader.getCotizaciones().length} cotizaciones | ${ftpLoader.getStockMap().size} SKUs stock | ${Object.keys(ftpLoader.getWooMap()).length} wooMap | ${ftpLoader.getWooOrders().length} pedidosWoo`);
  } else {
    console.warn('[dataStore] FTP_HOST no definido — datos FTP desactivados');
  }
}

function reload() {
  try {
    store = _loadSync();
    console.log(`[dataStore] Recargado: ${new Date().toISOString()} — ${store.catalogo.length} productos`);
  } catch (e) {
    console.error('[dataStore] Error en recarga, manteniendo datos anteriores:', e.message);
  }
}

function startAutoReload() {
  setInterval(reload, RELOAD_INTERVAL_MS);
}

function getCatalogo() {
  const stockMap = ftpLoader.getStockMap();
  if (!stockMap.size) return store.catalogo;
  return store.catalogo.map(p => {
    const entry = stockMap.get(p.sku);
    return { ...p, saldo_ftp: entry ? entry.saldo : null };
  });
}
function getVentasMap()     { return store.ventasMap; }
function getVentasRaw()     { return store.ventasRaw; }
function getUsos()          { return store.usos; }
function getPedidos()       { return store.pedidos; }
function getEjecutivos()    { return store.ejecutivos; }
function getClientesFTP()        { return ftpLoader.getClientesMap(); }
function getCotizacionesFTP()    { return ftpLoader.getCotizaciones(); }
function getVentasFTPRaw()       { return ftpLoader.getVentasRaw(); }
function getWooMap()             { return ftpLoader.getWooMap(); }
function getWooOrders()          { return ftpLoader.getWooOrders(); }
function getWooOrdersByRut(rut)  { return ftpLoader.getWooOrdersByRut(rut); }

module.exports = { init, reload, startAutoReload, getCatalogo, getVentasMap, getVentasRaw, getUsos, getPedidos, getEjecutivos, getClientesFTP, getCotizacionesFTP, getVentasFTPRaw, getWooMap, getWooOrders, getWooOrdersByRut };
