'use strict';

const dataStore = require('../data/dataStore');

async function shortenUrl(longUrl) {
  try {
    const response = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!response.ok) throw new Error('fallo');
    const short = await response.text();
    if (short.startsWith('https://tinyurl.com/')) return short;
    throw new Error('respuesta inválida');
  } catch {
    return longUrl; // fallback: URL larga si TinyURL falla
  }
}

// Acepta dos formatos:
//   - session.cart items:  { sku, wooId, nombre, precio, qty }
//   - items legados:       { sku, quantity }  (resuelve wooId desde WooMap)
async function buildCartUrl(cartItems) {
  if (!cartItems || !cartItems.length) return null;
  const wooMapData = dataStore.getWooMap();
  if (!Object.keys(wooMapData).length) {
    console.warn('[wooCart] WooMap vacío al construir carrito — verificar carga FTP');
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
  const longUrl = `https://cruzeirogomas.cl/carrito/?${params.join('&')}`;
  console.log('[wooCart] longUrl:', longUrl);
  return await shortenUrl(longUrl);
}

async function generarLinkCarrito(skusConfirmados) {
  if (!Array.isArray(skusConfirmados) || !skusConfirmados.length) return null;
  return buildCartUrl(skusConfirmados.map(s => ({ sku: s.sku, quantity: s.cantidad || 1 })));
}

module.exports = { buildCartUrl, generarLinkCarrito };
