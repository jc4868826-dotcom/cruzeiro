'use strict';

const dataStore = require('../data/dataStore');

function buildCartUrl(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const wooMap = dataStore.getWooMap();
  const params = new URLSearchParams();
  let alguno = false;
  for (const item of items) {
    const sku = item.sku || item.SKU;
    const qty = Math.max(1, parseInt(item.quantity || item.cantidad) || 1);
    const wooId = wooMap[sku] || wooMap[sku?.toUpperCase()];
    if (!wooId) continue;
    params.append('add-to-cart[]', wooId);
    params.append('quantity[]', qty);
    alguno = true;
  }
  if (!alguno) return null;
  return `https://cruzeirogomas.cl/carrito/?${params.toString()}`;
}

// Alias para compatibilidad con llamadas existentes que usan { sku, cantidad }
function generarLinkCarrito(skusConfirmados) {
  if (!Array.isArray(skusConfirmados) || !skusConfirmados.length) return null;
  return buildCartUrl(skusConfirmados.map(s => ({ sku: s.sku, quantity: s.cantidad || 1 })));
}

module.exports = { buildCartUrl, generarLinkCarrito };
