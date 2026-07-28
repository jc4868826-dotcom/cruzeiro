'use strict';

const express = require('express');
const db = require('../data/db');
const whatsappAdapter = require('../../integrations/whatsappAdapter');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

// All write operations on campañas require admin role
// GET routes use requireAuth only
const logger = require('../utils/logger');

const router = express.Router();

// ─── GET /api/campanas ────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { estado } = req.query;
    let campanas = await db.getAll('campanas');

    if (estado) {
      campanas = campanas.filter(c => c.estado === estado);
    }

    campanas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ total: campanas.length, data: campanas });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/campanas/:id/reporte ────────────────────────────────────────────
// Must be before /:id PATCH
router.get('/:id/reporte', requireAuth, async (req, res, next) => {
  try {
    const campana = await db.getById('campanas', req.params.id);
    if (!campana) return res.status(404).json({ error: 'No encontrado', message: 'Campaña no existe.' });

    const stats = campana.stats || { enviadas: 0, entregadas: 0, leidas: 0, respondidas: 0 };
    const tasaEntrega = stats.enviadas > 0 ? parseFloat(((stats.entregadas / stats.enviadas) * 100).toFixed(2)) : 0;
    const tasaLectura = stats.entregadas > 0 ? parseFloat(((stats.leidas / stats.entregadas) * 100).toFixed(2)) : 0;
    const tasaRespuesta = stats.leidas > 0 ? parseFloat(((stats.respondidas / stats.leidas) * 100).toFixed(2)) : 0;

    return res.json({
      campana: {
        id: campana.id,
        nombre: campana.nombre,
        estado: campana.estado,
        segmento: campana.segmento,
        programada_para: campana.programada_para,
      },
      stats,
      tasas: {
        entrega: tasaEntrega,
        lectura: tasaLectura,
        respuesta: tasaRespuesta,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/campanas ───────────────────────────────────────────────────────
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, template_hsm, segmento, programada_para } = req.body || {};

    if (!nombre || !template_hsm) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'nombre y template_hsm son requeridos.' });
    }

    const nueva = await db.save('campanas', {
      nombre,
      template_hsm,
      segmento: segmento || 'ecommerce',
      programada_para: programada_para || null,
      estado: 'borrador',
      stats: { enviadas: 0, entregadas: 0, leidas: 0, respondidas: 0 },
    });

    return res.status(201).json(nueva);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/campanas/:id ──────────────────────────────────────────────────
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const campana = await db.getById('campanas', req.params.id);
    if (!campana) return res.status(404).json({ error: 'No encontrado', message: 'Campaña no existe.' });

    if (campana.estado === 'enviada') {
      return res.status(400).json({ error: 'No permitido', message: 'No se puede editar una campaña ya enviada.' });
    }

    const allowed = ['nombre', 'template_hsm', 'segmento', 'programada_para', 'estado'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    const updated = await db.update('campanas', req.params.id, patch);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/campanas/:id/enviar ────────────────────────────────────────────
router.post('/:id/enviar', requireAdmin, async (req, res, next) => {
  try {
    const campana = await db.getById('campanas', req.params.id);
    if (!campana) return res.status(404).json({ error: 'No encontrado', message: 'Campaña no existe.' });

    if (campana.estado === 'enviada') {
      return res.status(400).json({ error: 'Ya enviada', message: 'Esta campaña ya fue enviada.' });
    }

    // Get leads matching segmento
    const leads = await db.getAll('leads');
    const destinatarios = leads.filter(l =>
      (!campana.segmento || l.segmento === campana.segmento) && l.telefono
    );

    logger.info(`Campaña "${campana.nombre}": enviando a ${destinatarios.length} destinatarios...`);

    let enviadas = 0;
    let entregadas = 0;

    for (const lead of destinatarios) {
      try {
        const result = await whatsappAdapter.enviarHSM(
          lead.telefono,
          campana.template_hsm,
          [lead.nombre || 'cliente']
        );
        if (result.ok) {
          enviadas++;
          entregadas++; // in mock mode, assume delivered
        }
      } catch (sendErr) {
        logger.warn(`Campaña: error enviando a ${lead.telefono}: ${sendErr.message}`);
      }
    }

    const stats = {
      enviadas,
      entregadas,
      leidas: Math.floor(entregadas * 0.65), // simulated read rate
      respondidas: Math.floor(entregadas * 0.15), // simulated response rate
    };

    const updated = await db.update('campanas', campana.id, {
      estado: 'enviada',
      enviada_en: new Date().toISOString(),
      stats,
    });

    return res.json({ ok: true, campana: updated, stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
