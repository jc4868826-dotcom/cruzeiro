'use strict';

const express = require('express');
const db = require('../data/db');
const botService = require('../bot/bot.service');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

const NOMBRES   = ['Rodrigo','Claudia','Felipe','Javiera','Andrés','Marcela','Diego','Valentina','Cristián','Sofía','Pablo','Daniela','Matías','Camila','Sebastián'];
const APELLIDOS = ['González','Muñoz','Rojas','Díaz','Pérez','Soto','Contreras','Silva','Martínez','Romero','López','Flores','Torres','Herrera','Mora'];

// ─── POST /api/chat-test/send ─────────────────────────────────────────────────
router.post('/send', requireAuth, async (req, res, next) => {
  try {
    const { mensaje, testMode } = req.body || {};
    const phone = req.body.phone || ('+569' + Math.floor(10000000 + Math.random() * 90000000));

    if (!mensaje) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'mensaje es requerido.' });
    }

    const todos = await db.getAll('leads');
    let lead = todos.find(l => l.telefono === phone);
    let lead_nuevo = false;
    if (!lead) {
      const nombre = `${NOMBRES[Math.floor(Math.random() * NOMBRES.length)]} ${APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)]}`;
      lead = await db.save('leads', {
        nombre,
        telefono: phone,
        segmento: 'ecommerce',
        origen: 'simulador',
        canal_origen: 'simulador',
        estado: 'Nuevo',
        etapa_pipeline: 'Nuevo',
        bot_activo: true,
        notas: [],
        createdAt: new Date().toISOString(),
      });
      lead_nuevo = true;
    }

    const convs = await db.getAll('conversaciones');
    const convExistente = convs.find(c => c.phone === phone && c.bot_activo) || null;

    const resultado = await botService.procesarMensaje(phone, mensaje, convExistente, { testMode: !!testMode });

    if (resultado.conversacion?.id && !resultado.conversacion.lead_id) {
      await db.update('conversaciones', resultado.conversacion.id, { lead_id: lead.id });
    }

    // Apply lead fields returned from bot state machine
    if (resultado.leadUpdate && Object.keys(resultado.leadUpdate).length > 0) {
      lead = await db.update('leads', lead.id, resultado.leadUpdate) || lead;
    }

    return res.json({
      ok: true,
      phone,
      mensaje_enviado: mensaje,
      respuesta_bot: resultado.respuesta,
      derivar_a_humano: resultado.derivar,
      conversacion_id: resultado.conversacion?.id || null,
      lead_id: lead.id,
      lead_nuevo,
      canal_clasificado: resultado.estado?.canal || lead.canal || null,
      etapa_bot: resultado.estado?.etapa || null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/chat-test/reset ────────────────────────────────────────────────
router.post('/reset', requireAuth, async (req, res, next) => {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'phone es requerido.' });
    }
    botService.resetEstado(phone);
    return res.json({ ok: true, phone, message: 'Estado del bot reiniciado.' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/chat-test/conversation/:phone ───────────────────────────────────
router.get('/conversation/:phone', requireAuth, async (req, res, next) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const convs = await db.getAll('conversaciones');

    const conversaciones = convs
      .filter(c => c.phone === phone)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (conversaciones.length === 0) {
      return res.status(404).json({ error: 'No encontrado', message: `No hay conversaciones para el número ${phone}.` });
    }

    const todosLosMensajes = conversaciones.flatMap(c =>
      (c.mensajes || []).map(m => ({ ...m, conversacion_id: c.id }))
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return res.json({
      phone,
      total_conversaciones: conversaciones.length,
      bot_activo: conversaciones[conversaciones.length - 1]?.bot_activo ?? true,
      conversaciones,
      todos_mensajes: todosLosMensajes,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
