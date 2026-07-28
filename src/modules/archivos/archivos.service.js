'use strict'

/**
 * archivos.service.js
 *
 * CSV upload processing and external repository connector stub.
 */

const fs = require('fs')
const path = require('path')
const db = require('../../data/db')
const logger = require('../../utils/logger')
const { DATA_DIR } = require('../../config')

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPOS_VALIDOS = ['stock', 'clientes', 'ventas', 'productos']

const COLUMNAS_MINIMAS = {
  stock: ['sku', 'stock'],
  clientes: ['nombre', 'telefono'],
  ventas: ['fecha', 'monto'],
  productos: ['sku', 'nombre', 'precio'],
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/**
 * Parse a raw CSV string.
 * First row becomes lowercased, space-normalised column headers.
 * Remaining rows become objects keyed by those headers.
 *
 * @param {string} contenido
 * @returns {{ headers: string[], rows: object[] }}
 */
function parsearCSV(contenido) {
  const lineas = contenido
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lineas.length === 0) return { headers: [], rows: [] }

  const headers = lineas[0]
    .split(',')
    .map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))

  const rows = lineas.slice(1).map(linea => {
    const valores = linea.split(',')
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = (valores[i] || '').trim()
    })
    return obj
  })

  return { headers, rows }
}

// ─── Main processor ───────────────────────────────────────────────────────────

/**
 * Validate, optionally clear, and persist CSV rows to the matching collection.
 *
 * @param {string} tipo    - must be one of TIPOS_VALIDOS
 * @param {string} contenidoCSV
 * @param {'replace'|'append'} [modo='replace']
 * @returns {Promise<{ tipo: string, filas: number, modo: string }>}
 */
async function procesarCSV(tipo, contenidoCSV, modo = 'replace') {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    const err = new Error(`Tipo de archivo inválido: '${tipo}'. Válidos: ${TIPOS_VALIDOS.join(', ')}`)
    err.status = 400
    throw err
  }

  const { headers, rows } = parsearCSV(contenidoCSV)

  // Validate required columns
  const requeridas = COLUMNAS_MINIMAS[tipo]
  const faltantes = requeridas.filter(col => !headers.includes(col))
  if (faltantes.length > 0) {
    const err = new Error(
      `El CSV de tipo '${tipo}' requiere las columnas: ${requeridas.join(', ')}. Faltan: ${faltantes.join(', ')}`
    )
    err.status = 400
    throw err
  }

  const coleccion = `archivo_${tipo}`

  // Clear existing collection file when mode is 'replace'
  if (modo === 'replace') {
    const fp = path.join(DATA_DIR, `${coleccion}.json`)
    fs.writeFileSync(fp, JSON.stringify([], null, 2), 'utf8')
  }

  // Persist rows
  for (const fila of rows) {
    await db.save(coleccion, fila)
  }

  // Record the load entry
  const cargaEntry = {
    tipo,
    modo,
    filas: rows.length,
    origen: 'manual',
    fecha_carga: new Date().toISOString(),
  }
  await db.save('archivo_cargas', cargaEntry)

  logger.info(`archivos.service: procesarCSV tipo=${tipo} modo=${modo} filas=${rows.length}`)

  return { tipo, filas: rows.length, modo }
}

// ─── Estado de cargas ─────────────────────────────────────────────────────────

/**
 * Return the last load entry for each valid tipo.
 *
 * @returns {Promise<Record<string, object|null>>}
 */
async function obtenerEstadoCargas() {
  const cargas = await db.getAll('archivo_cargas')

  const estado = {}
  for (const tipo of TIPOS_VALIDOS) {
    const del_tipo = cargas.filter(c => c.tipo === tipo)
    if (del_tipo.length === 0) {
      estado[tipo] = null
    } else {
      // Sort descending by fecha_carga, pick latest
      del_tipo.sort((a, b) => new Date(b.fecha_carga) - new Date(a.fecha_carga))
      estado[tipo] = del_tipo[0]
    }
  }

  return estado
}

// ─── External repo connector ──────────────────────────────────────────────────

/**
 * Stub for syncing files from an external repository (Google Drive, S3, etc.).
 * TODO: implement Google Drive connector using GDRIVE_SHEET_ID / service account,
 *       or S3 connector using AWS SDK once credentials are configured.
 *
 * @returns {Promise<{ sincronizado: boolean, mensaje: string }>}
 */
async function sincronizarDesdeRepo() {
  logger.info('archivos.service: sincronizarDesdeRepo — conector externo no configurado.')
  return { sincronizado: false, mensaje: 'Conector externo no configurado' }
}

module.exports = {
  TIPOS_VALIDOS,
  COLUMNAS_MINIMAS,
  parsearCSV,
  procesarCSV,
  obtenerEstadoCargas,
  sincronizarDesdeRepo,
}
