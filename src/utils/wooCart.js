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

  const params = [];
  for (const { sku, cantidad } of skusConfirmados) {
    const wooId = mapa[sku];
    if (wooId) {
      const qty = Math.max(1, parseInt(cantidad) || 1);
      params.push(`add-to-cart=${encodeURIComponent(wooId)}&quantity=${qty}`);
    }
  }

  if (params.length === 0) return null;
  return `https://cruzeirogomas.cl/carrito/?${params.join('&')}`;
}

module.exports = { generarLinkCarrito };
