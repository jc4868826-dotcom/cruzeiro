'use strict'

/**
 * alerta.service.js
 *
 * Internal alert + ficha / pipeline / agenda for mayorista contacts.
 * Handles lead upsert, conversation creation, agenda entry and WhatsApp
 * alert dispatch for both the assigned executive and the jefatura.
 */

const db = require('../../data/db')
const { enviarMensaje } = require('../../../integrations/whatsappAdapter')
const logger = require('../../utils/logger')

// Read from env — never throw if missing, service degrades gracefully
const ALERT_JEFATURA_PHONE = (process.env.ALERT_JEFATURA_PHONE || '').trim()
const ALERT_TEMPLATE_NAME = (process.env.ALERT_TEMPLATE_NAME || '').trim()

// ─── Standalone helper ────────────────────────────────────────────────────────

/**
 * Send a free-text WhatsApp alert to a given phone number.
 *
 * // Ready: swap enviarMensaje for enviarHSM(dest, ALERT_TEMPLATE_NAME, [...])
 * // when Meta template is approved.
 *
 * @param {string} ejecutivoPhone
 * @param {string} clienteNombre
 * @param {string} canal
 * @param {string} mensaje
 */
async function enviarAlerta(ejecutivoPhone, clienteNombre, canal, mensaje) {
  const texto =
    `[FunnelOS Alerta] Nuevo contacto mayorista.\n` +
    `Cliente: ${clienteNombre}\n` +
    `Canal: ${canal}\n` +
    `Mensaje: ${mensaje.substring(0, 200)}`

  if (ejecutivoPhone) {
    try {
      await enviarMensaje(ejecutivoPhone, texto)
    } catch (err) {
      logger.warn(`alerta.service: no se pudo enviar alerta al ejecutivo (${ejecutivoPhone}): ${err.message}`)
    }
  }

  if (ALERT_JEFATURA_PHONE && ALERT_JEFATURA_PHONE !== ejecutivoPhone) {
    try {
      await enviarMensaje(ALERT_JEFATURA_PHONE, texto)
    } catch (err) {
      logger.warn(`alerta.service: no se pudo enviar alerta a jefatura (${ALERT_JEFATURA_PHONE}): ${err.message}`)
    }
  }
}

// ─── Main processor ───────────────────────────────────────────────────────────

/**
 * Full mayorista intake flow:
 *   1. Upsert lead
 *   2. Upsert conversation with silent_monitor mode
 *   3. Create agenda entry for the executive
 *   4. Send WhatsApp alerts
 *
 * @param {object} params
 * @param {string} params.phone
 * @param {string} [params.email]
 * @param {string} [params.nombre]
 * @param {string} params.canal        - channel name ('whatsapp', 'correo', ...)
 * @param {string} params.mensaje
 * @param {string} [params.ejecutivoId]
 * @param {string} params.clasificacion - 'mayorista' | 'ecommerce'
 * @returns {Promise<{ lead: object, conv: object }>}
 */
async function procesarContactoMayorista({
  phone,
  email,
  nombre,
  canal,
  mensaje,
  ejecutivoId,
  clasificacion,
}) {
  // ── 1. Find or create lead ─────────────────────────────────────────────────
  const todos = await db.getAll('leads')

  let lead = todos.find(
    l => (phone && l.telefono === phone) || (email && l.email === email)
  )

  if (!lead) {
    lead = await db.save('leads', {
      nombre: nombre || '',
      telefono: phone || '',
      email: email || '',
      segmento: 'mayorista',
      bot_activo: false,
      estado: 'Nuevo',
      canal_clasificacion: clasificacion || 'mayorista',
      ejecutivo_asignado: ejecutivoId || null,
      notas: [],
    })
    logger.info(`alerta.service: nuevo lead mayorista creado id=${lead.id}`)
  } else {
    // Append note and refresh channel / assignment
    const nota = {
      texto: `[${canal}] ${mensaje.substring(0, 300)}`,
      autor: 'sistema',
      timestamp: new Date().toISOString(),
    }
    const notas = [...(lead.notas || []), nota]
    lead = await db.update('leads', lead.id, {
      notas,
      canal_clasificacion: clasificacion || lead.canal_clasificacion,
      ejecutivo_asignado: ejecutivoId || lead.ejecutivo_asignado,
    })
    logger.info(`alerta.service: lead existente actualizado id=${lead.id}`)
  }

  // ── 2. Find or create conversation ────────────────────────────────────────
  const todasConvs = await db.getAll('conversaciones')

  let conv = todasConvs.find(
    c => c.lead_id === lead.id && c.canal === canal
  )

  const nuevoMsg = {
    rol: 'cliente',
    texto: mensaje,
    timestamp: new Date().toISOString(),
  }

  if (!conv) {
    conv = await db.save('conversaciones', {
      lead_id: lead.id,
      canal,
      bot_mode: 'silent_monitor',
      bot_activo: false,
      mensajes: [nuevoMsg],
    })
  } else {
    const mensajes = [...(conv.mensajes || []), nuevoMsg]
    conv = await db.update('conversaciones', conv.id, { mensajes })
  }

  // ── 3. Create agenda entry ─────────────────────────────────────────────────
  // Structure is ready to evolve to Google Calendar integration without data model changes.
  await db.save('agenda', {
    lead_id: lead.id,
    ejecutivo_id: ejecutivoId || null,
    descripcion: `Contacto mayorista via ${canal}: "${mensaje.substring(0, 150)}"`,
    estado: 'pendiente',
    canal,
  })

  // ── 4. Send alerts ─────────────────────────────────────────────────────────
  let ejecutivoPhone = null
  if (ejecutivoId) {
    try {
      const ejecutivos = await db.getAll('ejecutivos')
      const ejecutivo = ejecutivos.find(e => e.id === ejecutivoId)
      if (ejecutivo) {
        ejecutivoPhone = ejecutivo.telefono_alertas || null
      }
    } catch (err) {
      logger.warn(`alerta.service: no se pudo obtener ejecutivo id=${ejecutivoId}: ${err.message}`)
    }
  }

  await enviarAlerta(
    ejecutivoPhone,
    nombre || phone || email || 'Desconocido',
    canal,
    mensaje
  )

  return { lead, conv }
}

module.exports = { procesarContactoMayorista, enviarAlerta }
