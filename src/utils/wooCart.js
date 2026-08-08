'use strict';

const wooCartMapFallback = require('./wooCartMap.json');
let _ftpLoader = null;
function getFtpLoader() {
  if (!_ftpLoader) _ftpLoader = require('../data/ftpLoader');
  return _ftpLoader;
}

function generarLinkCarrito(skusConfirmados) {
  if (!Array.isArray(skusConfirmados) || skusConfirmados.length === 0) return null;

  const ftpMap = getFtpLoader().getWooMap();
  const mapa = Object.keys(ftpMap).length > 0 ? ftpMap : wooCartMapFallback;

  const items = [];
  for (const { sku, cantidad } of skusConfirmados) {
    const wooId = mapa[sku];
    if (wooId) items.push({ wooId, qty: Math.max(1, parseInt(cantidad) || 1) });
  }

  if (items.length === 0) return null;

  // WooCommerce multi-item: add-to-cart[]=ID&quantity[]=N para cada ítem
  // evita que PHP descarte parámetros duplicados
  const p = new URLSearchParams();
  for (const { wooId, qty } of items) {
    p.append('add-to-cart[]', wooId);
    p.append('quantity[]', qty);
  }
  return `https://cruzeirogomas.cl/carrito/?${p.toString()}`;
}

module.exports = { generarLinkCarrito };
