'use strict';
const path = require('path');
const loaders = require('./loaders');

const DATA_DIR = process.env.EXCEL_DIR || path.join(__dirname, '../../data/cruzeiro');
const RELOAD_INTERVAL_MS = 10 * 60 * 1000;

let store = { catalogo: [], ventasMap: new Map(), pedidos: [], ejecutivos: [], lastLoaded: null };

function _loadSync() {
  const maestraMap = loaders.loadMaestra(DATA_DIR);
  const webArray   = loaders.loadWeb(DATA_DIR);
  const catalogo   = loaders.buildCatalogo(maestraMap, webArray);
  const ventasMap  = loaders.loadVentas(DATA_DIR);
  const pedidos    = loaders.loadPedidos(DATA_DIR);
  const ejecutivos = loaders.loadInputs(DATA_DIR);
  return { catalogo, ventasMap, pedidos, ejecutivos, lastLoaded: new Date() };
}

function init() {
  store = _loadSync();
  console.log(`[dataStore] Init: ${store.catalogo.length} productos | ${store.ventasMap.size} clientes | ${store.pedidos.length} pedidos | ${store.ejecutivos.length} ejecutivos`);
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

function getCatalogo()   { return store.catalogo; }
function getVentasMap()  { return store.ventasMap; }
function getPedidos()    { return store.pedidos; }
function getEjecutivos() { return store.ejecutivos; }

module.exports = { init, reload, startAutoReload, getCatalogo, getVentasMap, getPedidos, getEjecutivos };
