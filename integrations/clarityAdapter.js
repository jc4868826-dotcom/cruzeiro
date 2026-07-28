'use strict';

/**
 * clarityAdapter.js
 *
 * Processes abandoned cart events from Microsoft Clarity (or a custom
 * analytics webhook that mirrors Clarity session data).
 *
 * TO REPLACE: Set CLARITY_WEBHOOK_SECRET in .env to validate HMAC signatures.
 * Current implementation parses a simulated event structure.
 */

const crypto = require('crypto');
const logger = require('../src/utils/logger');
const { CLARITY_WEBHOOK_SECRET } = require('../src/config');

/**
 * Validate Clarity webhook signature (HMAC-SHA256).
 * Returns true if no secret is configured (dev mode) or signature matches.
 *
 * @param {string} rawBody - raw request body as string
 * @param {string} signature - value of X-Clarity-Signature header
 * @returns {boolean}
 */
function validarFirma(rawBody, signature) {
  if (!CLARITY_WEBHOOK_SECRET) {
    logger.warn('clarityAdapter: CLARITY_WEBHOOK_SECRET no configurado — omitiendo validación de firma');
    return true;
  }
  if (!signature) return false;

  const expectedSig = crypto
    .createHmac('sha256', CLARITY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}

/**
 * Parse a Clarity abandoned cart event body and extract structured data.
 *
 * Expected event structure (simulated):
 * {
 *   event_type: "cart_abandoned",
 *   session_id: "abc123",
 *   user: { phone: "+56912345678", email: "...", name: "..." },
 *   cart: {
 *     total: 34990,
 *     items: [
 *       { sku: "ACE-5W30-4L", nombre: "Aceite Motor 5W30", cantidad: 2, precio_unitario: 18990 }
 *     ]
 *   },
 *   url: "https://tienda.cruzeiro.cl/checkout",
 *   timestamp: "2024-06-01T10:30:00Z"
 * }
 *
 * @param {object} body - parsed JSON body from webhook
 * @returns {{ tipo: string, session_id: string, productos: object[], phone: string|null, email: string|null, total: number }}
 */
function procesarEvento(body) {
  if (!body || typeof body !== 'object') {
    logger.warn('clarityAdapter.procesarEvento: cuerpo inválido');
    return { tipo: 'desconocido', session_id: null, productos: [], phone: null, email: null, total: 0 };
  }

  const tipo = body.event_type || 'desconocido';
  const session_id = body.session_id || null;
  const phone = body.user?.phone || null;
  const email = body.user?.email || null;
  const nombre = body.user?.name || null;

  const productos = Array.isArray(body.cart?.items)
    ? body.cart.items.map(item => ({
        sku: item.sku || '',
        nombre: item.nombre || item.name || '',
        cantidad: item.cantidad || item.quantity || 1,
        precio_unitario: item.precio_unitario || item.unit_price || 0,
      }))
    : [];

  const total = body.cart?.total || productos.reduce((sum, p) => sum + p.precio_unitario * p.cantidad, 0);

  logger.info(`clarityAdapter.procesarEvento: tipo="${tipo}", session_id="${session_id}", phone="${phone}", productos=${productos.length}, total=${total}`);

  return { tipo, session_id, productos, phone, email, nombre, total };
}

module.exports = { procesarEvento, validarFirma };
