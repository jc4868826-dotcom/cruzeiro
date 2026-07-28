require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'cruzeiro-dev-secret',
  DATA_DIR: process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'cruzeiro')
    : path.join(process.cwd(), 'data', 'cruzeiro'),
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || '',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
  META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  TRANSBANK_API_KEY: process.env.TRANSBANK_API_KEY || '',
  KHIPU_API_KEY: process.env.KHIPU_API_KEY || '',
  CLARITY_WEBHOOK_SECRET: process.env.CLARITY_WEBHOOK_SECRET || '',
  ERP_URL: process.env.ERP_URL || '',
  GDRIVE_SHEET_ID: process.env.GDRIVE_SHEET_ID || '',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // ─── Canales ejecutivos ──────────────────────────────────────────────────────
  // Comma-separated list of Meta phone_number_ids that belong to executive reps
  META_EJECUTIVO_PHONE_IDS: process.env.META_EJECUTIVO_PHONE_IDS || '',

  // ─── Correo corporativo centralizado ────────────────────────────────────────
  EMAIL_CENTRAL_MAILBOX: process.env.EMAIL_CENTRAL_MAILBOX || 'alertas@cruzeiro.cl',
  // 'imap' | 'google' | 'microsoft'
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'imap',
  EMAIL_IMAP_HOST: process.env.EMAIL_IMAP_HOST || '',
  EMAIL_IMAP_PORT: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
  EMAIL_IMAP_USER: process.env.EMAIL_IMAP_USER || '',
  EMAIL_IMAP_PASS: process.env.EMAIL_IMAP_PASS || '',

  // ─── Comportamiento mayorista inactivo ──────────────────────────────────────
  // TODO: confirmar con Cruzeiro — used in canal.classifier.js
  MAYORISTA_INACTIVITY_MONTHS: parseInt(process.env.MAYORISTA_INACTIVITY_MONTHS || '6', 10),
  INACTIVE_MAYORISTA_BEHAVIOR: process.env.INACTIVE_MAYORISTA_BEHAVIOR || 'treat_as_new',

  // ─── Alertas internas ────────────────────────────────────────────────────────
  // Swap ALERT_TEMPLATE_NAME from '' to the Meta-approved template name — no code change needed
  ALERT_TEMPLATE_NAME: process.env.ALERT_TEMPLATE_NAME || '',
  ALERT_JEFATURA_PHONE: process.env.ALERT_JEFATURA_PHONE || '',
};
