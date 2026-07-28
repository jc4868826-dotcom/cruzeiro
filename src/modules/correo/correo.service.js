'use strict'

/**
 * correo.service.js
 *
 * Mock email monitor. Delegates to provider-specific stubs based on
 * EMAIL_PROVIDER env var ('imap' | 'google' | 'microsoft').
 *
 * All fetch stubs return [] until real credentials are configured.
 */

const logger = require('../../utils/logger')

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'imap').toLowerCase().trim()

// IMAP credentials (read from env — not used until stub is implemented)
// TODO: use these when real IMAP credentials arrive
const IMAP_HOST = process.env.IMAP_HOST || ''
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10)
const IMAP_USER = process.env.IMAP_USER || ''
const IMAP_PASS = process.env.IMAP_PASS || ''
const IMAP_TLS = process.env.IMAP_TLS !== 'false'

// ─── Provider stubs ───────────────────────────────────────────────────────────

/**
 * Fetch emails via IMAP.
 * TODO: implement with 'node-imap' or 'imapflow' once IMAP_HOST/USER/PASS are set.
 * @returns {Promise<Array>}
 */
async function fetchEmailsIMAP() {
  logger.info(`correo.service [IMAP stub] host=${IMAP_HOST || '(not set)'} user=${IMAP_USER || '(not set)'}`)
  // TODO: connect with imapflow, iterate INBOX, return raw email objects
  return []
}

/**
 * Fetch emails via Google (Gmail API / OAuth2).
 * TODO: implement with googleapis client once OAuth credentials are configured.
 * @returns {Promise<Array>}
 */
async function fetchEmailsGoogle() {
  logger.info('correo.service [Google stub] Gmail API not yet configured.')
  // TODO: use googleapis/google-auth-library with service account or OAuth2
  return []
}

/**
 * Fetch emails via Microsoft (Graph API / Exchange).
 * TODO: implement with @azure/msal-node once tenant/client credentials are configured.
 * @returns {Promise<Array>}
 */
async function fetchEmailsMicrosoft() {
  logger.info('correo.service [Microsoft stub] Graph API not yet configured.')
  // TODO: use @microsoft/microsoft-graph-client with MSAL authentication
  return []
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch emails from the configured provider.
 * Returns an array of raw email objects (empty until stubs are implemented).
 *
 * @returns {Promise<Array>}
 */
async function fetchEmails() {
  switch (EMAIL_PROVIDER) {
    case 'google':
      return fetchEmailsGoogle()
    case 'microsoft':
      return fetchEmailsMicrosoft()
    case 'imap':
    default:
      return fetchEmailsIMAP()
  }
}

/**
 * Normalize a raw email object into the contact shape expected by
 * procesarContactoMayorista.
 *
 * @param {{ from?: string, subject?: string, body?: string, [key: string]: any }} rawEmail
 * @returns {{ phone: string, email: string, nombre: string, canal: 'correo', mensaje: string }}
 */
function normalizarCorreo(rawEmail) {
  const email = rawEmail.from || ''
  const nombre = rawEmail.fromName || rawEmail.nombre || ''
  const subject = rawEmail.subject || ''
  const body = rawEmail.body || rawEmail.text || rawEmail.html || ''

  // Concatenate subject + body as the message payload
  const mensaje = [subject, body].filter(Boolean).join('\n').trim()

  return {
    phone: '',
    email,
    nombre,
    canal: 'correo',
    mensaje,
  }
}

module.exports = { fetchEmails, normalizarCorreo }
