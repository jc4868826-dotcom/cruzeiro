'use strict';

/**
 * whatsappAdapter.js
 *
 * Abstraction layer for WhatsApp Cloud API (Meta).
 *
 * TO REPLACE: Set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in .env.
 * The adapter auto-detects mock vs real mode based on those env vars.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../src/data/db');
const logger = require('../src/utils/logger');
const { META_ACCESS_TOKEN, META_PHONE_NUMBER_ID } = require('../src/config');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0';

/**
 * Send a plain text message to a WhatsApp phone number.
 * In mock mode: saves message to conversaciones.json and returns simulated messageId.
 *
 * @param {string} phone - recipient phone in E.164 format (+56...)
 * @param {string} texto - message body
 * @returns {Promise<{ ok: boolean, messageId: string }>}
 */
async function enviarMensaje(phone, texto) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    // MOCK MODE
    const messageId = `wamid.mock.${uuidv4()}`;
    logger.info(`whatsappAdapter [MOCK] enviarMensaje → ${phone}: "${texto.substring(0, 60)}..."`);

    // Persist to conversaciones
    const todasConvs = await db.getAll('conversaciones');
    let conv = todasConvs.find(c => c.phone === phone);

    const nuevoMsg = {
      id: messageId,
      rol: 'bot',
      texto,
      timestamp: new Date().toISOString(),
    };

    if (conv) {
      const mensajes = [...(conv.mensajes || []), nuevoMsg];
      await db.update('conversaciones', conv.id, { mensajes });
    } else {
      await db.save('conversaciones', {
        phone,
        lead_id: null,
        bot_activo: true,
        canal: 'whatsapp',
        mensajes: [nuevoMsg],
      });
    }

    return { ok: true, messageId };
  }

  // REAL MODE — Meta WhatsApp Cloud API
  try {
    const url = `${WHATSAPP_API_URL}/${META_PHONE_NUMBER_ID}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { body: texto },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      logger.error('whatsappAdapter.enviarMensaje error:', JSON.stringify(data));
      return { ok: false, messageId: null, error: data };
    }

    const messageId = data.messages?.[0]?.id || uuidv4();
    return { ok: true, messageId };
  } catch (err) {
    logger.error('whatsappAdapter.enviarMensaje excepción:', err.message);
    return { ok: false, messageId: null, error: err.message };
  }
}

/**
 * Send a WhatsApp HSM (template) message.
 *
 * @param {string} phone
 * @param {string} template - template name
 * @param {string[]} params - template parameter values in order
 * @returns {Promise<{ ok: boolean, messageId: string }>}
 */
async function enviarHSM(phone, template, params = []) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    // MOCK MODE
    const messageId = `wamid.mock.hsm.${uuidv4()}`;
    logger.info(`whatsappAdapter [MOCK] enviarHSM → ${phone}: template="${template}", params=${JSON.stringify(params)}`);
    return { ok: true, messageId };
  }

  // REAL MODE
  try {
    const url = `${WHATSAPP_API_URL}/${META_PHONE_NUMBER_ID}/messages`;
    const components = params.length > 0
      ? [{
          type: 'body',
          parameters: params.map(value => ({ type: 'text', text: value })),
        }]
      : [];

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: template,
        language: { code: 'es_CL' },
        components,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      logger.error('whatsappAdapter.enviarHSM error:', JSON.stringify(data));
      return { ok: false, messageId: null, error: data };
    }

    const messageId = data.messages?.[0]?.id || uuidv4();
    return { ok: true, messageId };
  } catch (err) {
    logger.error('whatsappAdapter.enviarHSM excepción:', err.message);
    return { ok: false, messageId: null, error: err.message };
  }
}

module.exports = { enviarMensaje, enviarHSM };
