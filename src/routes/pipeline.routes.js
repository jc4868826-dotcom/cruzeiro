'use strict';

const express = require('express');
const db = require('../data/db');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

const ETAPAS = ['Nuevo', 'Contactado', 'Cotizado', 'Pedido Enviado', 'Cerrado', 'Abandonado'];

// GET /api/pipeline — leads grouped by estado
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { segmento, asignado_a } = req.query;
    const usuario = req.session.usuario;

    let leads = await db.getAll('leads');

    if (segmento) leads = leads.filter(l => l.segmento === segmento);
    if (asignado_a) leads = leads.filter(l => l.asignado_a === asignado_a);

    // Non-admin users only see their own leads
    if (usuario && usuario.rol !== 'admin') {
      leads = leads.filter(l =>
        l.ejecutivo_asignado === usuario.username ||
        l.asignado_a === usuario.username
      );
    }

    const board = {};
    for (const etapa of ETAPAS) {
      board[etapa] = leads
        .filter(l => l.estado === etapa)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return res.json({ board, total: leads.length });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pipeline/:id/etapa — move lead between stages
router.patch('/:id/etapa', requireAuth, async (req, res, next) => {
  try {
    const { estado } = req.body || {};
    if (!ETAPAS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido', message: `Debe ser uno de: ${ETAPAS.join(', ')}` });
    }
    const lead = await db.getById('leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'No encontrado' });

    const updated = await db.update('leads', req.params.id, { estado });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
