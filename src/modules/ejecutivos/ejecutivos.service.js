'use strict'

/**
 * ejecutivos.service.js
 *
 * CRUD for ejecutivos collection and agenda management helpers.
 */

const db = require('../../data/db')

// ─── Ejecutivos ───────────────────────────────────────────────────────────────

/**
 * Return all executives.
 * @returns {Promise<Array>}
 */
async function listarEjecutivos() {
  return db.getAll('ejecutivos')
}

/**
 * Create a new executive.
 *
 * @param {{ nombre: string, email: string, telefono_alertas: string, phone_number_id: string }} data
 * @returns {Promise<object>}
 */
async function crearEjecutivo({ nombre, email, telefono_alertas, phone_number_id }) {
  return db.save('ejecutivos', {
    nombre: nombre || '',
    email: email || '',
    telefono_alertas: telefono_alertas || '',
    phone_number_id: phone_number_id || '',
  })
}

/**
 * Partially update an existing executive.
 *
 * @param {string} id
 * @param {object} patch
 * @returns {Promise<object|null>}
 */
async function actualizarEjecutivo(id, patch) {
  return db.update('ejecutivos', id, patch)
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

/**
 * Return all agenda entries for a given executive.
 *
 * @param {string} ejecutivoId
 * @returns {Promise<Array>}
 */
async function obtenerAgendaEjecutivo(ejecutivoId) {
  const agenda = await db.getAll('agenda')
  return agenda.filter(entry => entry.ejecutivo_id === ejecutivoId)
}

/**
 * Mark an agenda entry as managed (estado='gestionado').
 *
 * @param {string} agendaId
 * @param {string} [autor]
 * @returns {Promise<object|null>}
 */
async function marcarAgendaGestionada(agendaId, autor) {
  return db.update('agenda', agendaId, {
    estado: 'gestionado',
    gestionado_por: autor || 'sistema',
    gestionado_en: new Date().toISOString(),
  })
}

module.exports = {
  listarEjecutivos,
  crearEjecutivo,
  actualizarEjecutivo,
  obtenerAgendaEjecutivo,
  marcarAgendaGestionada,
}
