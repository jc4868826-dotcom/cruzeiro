'use strict';

const wooCartMap = require('./wooCartMap.json');

function generarLinkCarrito(skusConfirmados) {
  if (!Array.isArray(skusConfirmados) || skusConfirmados.length === 0) return null;

  const params = [];
  for (const { sku, cantidad } of skusConfirmados) {
    const wooId = wooCartMap[sku];
    if (wooId) {
      const qty = Math.max(1, parseInt(cantidad) || 1);
      params.push(`add-to-cart=${encodeURIComponent(wooId)}&quantity=${qty}`);
    }
  }

  if (params.length === 0) return null;
  return `https://cruzeirogomas.cl/carrito/?${params.join('&')}`;
}

module.exports = { generarLinkCarrito };
