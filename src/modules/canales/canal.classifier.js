'use strict'

/**
 * canal.classifier.js
 *
 * Channel-based classification engine.
 *
 * Reads from config / env:
 *   META_EJECUTIVO_PHONE_IDS  — comma-separated list of Meta phone_number_ids
 *                               belonging to executive reps
 *   MAYORISTA_INACTIVITY_MONTHS — number of months after which a mayorista
 *                                  contact is considered inactive (default 6)
 *   INACTIVE_MAYORISTA_BEHAVIOR — 'treat_as_new' | 'silent_monitor' (default 'silent_monitor')
 */

const config = require('../../config')

// ─── Parse env ────────────────────────────────────────────────────────────────

const EJECUTIVO_IDS = (process.env.META_EJECUTIVO_PHONE_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean)

const MAYORISTA_INACTIVITY_MONTHS = parseInt(
  process.env.MAYORISTA_INACTIVITY_MONTHS || '6',
  10
)

const INACTIVE_MAYORISTA_BEHAVIOR = (
  process.env.INACTIVE_MAYORISTA_BEHAVIOR || 'silent_monitor'
).trim()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when `ultimaCompra` (ISO string or Date) is within
 * the configured inactivity window from now.
 */
function _dentroDeVentanaActividad(ultimaCompra) {
  if (!ultimaCompra) return false
  const compraMs = new Date(ultimaCompra).getTime()
  if (isNaN(compraMs)) return false
  const limiteMs =
    Date.now() - MAYORISTA_INACTIVITY_MONTHS * 30 * 24 * 60 * 60 * 1000
  return compraMs >= limiteMs
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Classify an incoming contact by channel and phone_number_id.
 *
 * @param {string|null} phoneNumberId - Meta phone_number_id from the incoming webhook
 * @param {'whatsapp'|'correo'} canal
 * @returns {{ clasificacion: 'ecommerce'|'mayorista', canal_tipo: 'web_whatsapp'|'ejecutivo_whatsapp'|'correo' }}
 */
function clasificarPorCanal(phoneNumberId, canal = 'whatsapp') {
  if (canal === 'correo') {
    return { clasificacion: 'mayorista', canal_tipo: 'correo' }
  }

  if (phoneNumberId && EJECUTIVO_IDS.includes(phoneNumberId)) {
    return { clasificacion: 'mayorista', canal_tipo: 'ejecutivo_whatsapp' }
  }

  return { clasificacion: 'ecommerce', canal_tipo: 'web_whatsapp' }
}

/**
 * Determine whether the bot should respond actively or just monitor.
 *
 * @param {'ecommerce'|'mayorista'} clasificacion
 * @param {object|null} lead - existing lead record or null for new contact
 * @returns {'active'|'silent_monitor'}
 */
function determinarBotMode(clasificacion, lead) {
  // Ecommerce → bot always active
  if (clasificacion === 'ecommerce') {
    return 'active'
  }

  // Mayorista — new contact (no lead yet)
  if (!lead) {
    return 'active'
  }

  // Mayorista — lead exists but not classified as mayorista
  if (lead.segmento !== 'mayorista') {
    return 'active'
  }

  // Mayorista — lead is confirmed mayorista
  const activo = _dentroDeVentanaActividad(lead.ultima_compra)

  if (activo) {
    // Recent purchase → watch silently, executive handles it
    return 'silent_monitor'
  }

  // Purchase older than inactivity window
  // TODO: confirmar con Cruzeiro
  if (INACTIVE_MAYORISTA_BEHAVIOR === 'treat_as_new') {
    return 'active'
  }

  return 'silent_monitor'
}

module.exports = { clasificarPorCanal, determinarBotMode, EJECUTIVO_IDS }
