'use strict';

const express = require('express');
const db = require('../data/db');
const botService = require('../bot/bot.service');
const clarityAdapter = require('../../integrations/clarityAdapter');
const transbankAdapter = require('../../integrations/transbankAdapter');
const khipuAdapter = require('../../integrations/khipuAdapter');
const whatsappAdapter = require('../../integrations/whatsappAdapter');
const { procesarContactoMayorista } = require('../modules/alertas/alerta.service');
const { META_VERIFY_TOKEN } = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

// ─── GET /webhook — Meta verification (base URL fallback) ────────────────────
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    logger.info('Webhook: verificación exitosa (ruta raíz)');
    return res.status(200).send(challenge);
  }
  logger.warn(`Webhook: verificación fallida — token="${token}"`);
  return res.sendStatus(403);
});

// ─── GET /webhook/whatsapp — Meta verification ────────────────────────────────
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    logger.info('Webhook WhatsApp: verificación exitosa');
    return res.status(200).send(challenge);
  }

  logger.warn(`Webhook WhatsApp: verificación fallida — token="${token}"`);
  return res.status(403).json({ error: 'Verificación fallida' });
});

// ─── procesarMensajeWhatsApp ──────────────────────────────────────────────────
async function procesarMensajeWhatsApp(phone, texto, value) {
  try {
    console.log('[webhook] Procesando:', phone, texto.slice(0, 50));

    const contactos = value?.contacts || [];
    const nombrePerfil = contactos[0]?.profile?.name || null;

    // ── Buscar conversación activa para este teléfono ─────────────────────
    // Si el mensaje es /reset, no buscamos conversación — siempre arranca limpio
    const esReset = texto.trim().toLowerCase() === '/reset';

    const conversaciones = await db.getAll('conversaciones');

    // La conversación activa es la más reciente del phone que esté abierta
    const conversacionExistente = esReset ? null : (
      conversaciones
        .filter(c => c.phone === phone && c.bot_activo !== false)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
    );

    const resultado = await botService.procesarMensaje(phone, texto, conversacionExistente, {
      canal_tipo: 'web_whatsapp',
      nombrePerfil,
    });

    console.log('[webhook] Resultado:', JSON.stringify({
      tieneRespuesta: !!resultado?.respuesta,
      tieneConversacion: !!resultado?.conversacion,
      leadId: resultado?.conversacion?.lead_id,
      leadUpdate: resultado?.leadUpdate,
      estado: resultado?.estado,
    }).slice(0, 300));

    if (resultado?.respuesta) {
      await whatsappAdapter.enviarMensaje(phone, resultado.respuesta);
      console.log('[webhook] Respuesta enviada a:', phone);
    }
  } catch (e) {
    console.error('[webhook] ERROR procesando mensaje de', phone, ':', e.message, e.stack);
  }
}

// ─── POST /webhook — Incoming messages from Meta ──────────────────────────────
router.post('/', (req, res) => {
  res.sendStatus(200);
  console.log('[webhook] POST recibido de Meta');
  try {
    const body = req.body;
    if (!body || !body.object) return;
    if (body.object === 'whatsapp_business_account') {
      body.entry?.forEach(entry => {
        entry.changes?.forEach(change => {
          const value = change.value;
          if (value?.messages?.length > 0) {
            value.messages.forEach(msg => {
              const phone = msg.from;
              const texto = msg.text?.body || '';
              if (texto) {
                console.log('[webhook] Procesando mensaje de:', phone, texto);
                procesarMensajeWhatsApp(phone, texto, value).catch(e =>
                  console.error('[webhook] Error procesando:', e.message)
                );
              }
            });
          }
        });
      });
    }
  } catch (e) {
    console.error('[webhook] Error:', e.message);
  }
});

// ─── POST /webhook/correo — Incoming email notifications ─────────────────────
// Called by the email poller (correo.service.js) or a future inbound webhook.
router.post('/correo', async (req, res) => {
  res.status(200).json({ status: 'ok' });

  try {
    const { from, subject, body: emailBody, ejecutivoId } = req.body || {};
    if (!from) return;

    const { normalizarCorreo } = require('../modules/correo/correo.service');
    const contacto = normalizarCorreo({ from, subject, body: emailBody });

    logger.info(`Webhook correo: email de ${from} — asunto: "${(subject || '').substring(0, 60)}"`);

    await procesarContactoMayorista({
      ...contacto,
      ejecutivoId: ejecutivoId || null,
      clasificacion: 'mayorista',
    });
  } catch (err) {
    logger.error('Webhook correo: error:', err.message);
  }
});

// ─── POST /webhook/clarity — Abandoned cart events ───────────────────────────
router.post('/clarity', async (req, res) => {
  res.status(200).json({ status: 'ok' });

  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-clarity-signature'] || '';

    if (!clarityAdapter.validarFirma(rawBody, signature)) {
      logger.warn('Webhook Clarity: firma inválida, evento descartado');
      return;
    }

    const evento = clarityAdapter.procesarEvento(req.body);

    if (evento.tipo !== 'cart_abandoned' || !evento.phone) {
      logger.info(`Webhook Clarity: evento tipo="${evento.tipo}" ignorado (no es carrito abandonado o sin phone)`);
      return;
    }

    const leads = await db.getAll('leads');
    let lead = leads.find(l => l.telefono === evento.phone);

    if (!lead) {
      lead = await db.save('leads', {
        nombre: evento.nombre || 'Cliente web',
        telefono: evento.phone,
        email: evento.email || '',
        segmento: 'ecommerce',
        origen: 'web',
        empresa: '',
        estado: 'Nuevo',
        notas: [{
          texto: `Carrito abandonado detectado por Clarity. Productos: ${evento.productos.map(p => p.nombre).join(', ')}. Total: $${evento.total}`,
          autor: 'sistema',
          timestamp: new Date().toISOString(),
        }],
        bot_activo: true,
        clarity_session_id: evento.session_id,
        carrito_abandonado: { productos: evento.productos, total: evento.total, detectado_en: new Date().toISOString() },
      });
      logger.info(`Webhook Clarity: nuevo lead creado desde carrito abandonado — ${evento.phone}`);
    } else {
      const notas = [...(lead.notas || []), {
        texto: `Carrito abandonado (Clarity). Productos: ${evento.productos.map(p => p.nombre).join(', ')}. Total: $${evento.total}`,
        autor: 'sistema',
        timestamp: new Date().toISOString(),
      }];
      await db.update('leads', lead.id, { notas, carrito_abandonado: { productos: evento.productos, total: evento.total, detectado_en: new Date().toISOString() } });
      logger.info(`Webhook Clarity: carrito abandonado registrado en lead existente — ${lead.id}`);
    }
  } catch (err) {
    logger.error('Webhook Clarity: error:', err.message);
  }
});

// ─── POST /webhook/payments/transbank ────────────────────────────────────────
router.post('/payments/transbank', async (req, res) => {
  try {
    const { token_ws, TBK_TOKEN } = req.body || {};
    const token = token_ws || TBK_TOKEN;

    if (!token) {
      logger.warn('Webhook Transbank: sin token');
      return res.status(400).json({ error: 'Sin token' });
    }

    const pago = await transbankAdapter.confirmarPago(token);
    logger.info(`Webhook Transbank: pago confirmado — orden=${pago.orden_id}, estado=${pago.estado}, monto=${pago.monto}`);

    return res.json({ ok: true, pago });
  } catch (err) {
    logger.error('Webhook Transbank error:', err.message);
    return res.status(500).json({ error: 'Error confirmando pago Transbank' });
  }
});

// ─── POST /webhook/payments/khipu ────────────────────────────────────────────
router.post('/payments/khipu', async (req, res) => {
  try {
    const { payment_id, notification_token } = req.body || {};
    const pid = payment_id || notification_token;

    if (!pid) {
      logger.warn('Webhook Khipu: sin payment_id');
      return res.status(400).json({ error: 'Sin payment_id' });
    }

    const pago = await khipuAdapter.confirmarPago(pid);
    logger.info(`Webhook Khipu: pago confirmado — orden=${pago.orden_id}, estado=${pago.estado}, monto=${pago.monto}`);

    return res.json({ ok: true, pago });
  } catch (err) {
    logger.error('Webhook Khipu error:', err.message);
    return res.status(500).json({ error: 'Error confirmando pago Khipu' });
  }
});

module.exports = router;
