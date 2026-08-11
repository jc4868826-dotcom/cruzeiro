'use strict';

const dataStore = require('../data/dataStore');

// Acepta dos formatos:
//   - session.cart items:  { sku, wooId, nombre, precio, qty }
//   - items legados:       { sku, quantity }  (resuelve wooId desde WooMap)
function buildCartUrl(cartItems) {
  if (!cartItems || !cartItems.length) return null;
  const wooMapData = dataStore.getWooMap();
  if (!Object.keys(wooMapData).length) {
    console.warn('[wooCart] WooMap vacío — verificar carga FTP');
  }
  const params = [];
  for (const item of cartItems) {
    const sku = item.sku || item.SKU;
    const qty = Math.max(1, parseInt(item.qty || item.quantity || item.cantidad) || 1);
    const wooId = item.wooId || wooMapData[sku] || wooMapData[sku?.toUpperCase()];
    if (!wooId) { console.warn('[wooCart] SKU sin WooID:', sku); continue; }
    params.push(`add-to-cart%5B${wooId}%5D=${qty}`);
  }
  if (!params.length) return null;
  const url = `https://cruzeirogomas.cl/carrito/?${params.join('&')}`;
  console.log('[wooCart] URL carrito:', url);
  return url;
}

function generarLinkCarrito(skusConfirmados) {
  if (!Array.isArray(skusConfirmados) || !skusConfirmados.length) return null;
  return buildCartUrl(skusConfirmados.map(s => ({ sku: s.sku, quantity: s.cantidad || 1 })));
}

module.exports = { buildCartUrl, generarLinkCarrito };
