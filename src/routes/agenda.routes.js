'use strict'

/**
 * agenda.routes.js
 *
 * Read and update agenda entries.
 * All routes require an authenticated session.
 */

const express = require('express')
const db = require('../data/db')
const { requireAuth } = require('../middlewares/auth.middleware')

const router = express.Router()

// ─── GET /api/agenda ──────────────────────────────────────────────────────────
// Optional query param: ejecutivo_id
router.get('/', requireAuth, async (req, res, next) => {
  try {
    let agenda = await db.getAll('agenda')

    if (req.query.ejecutivo_id) {
      agenda = agenda.filter(e => e.ejecutivo_id === req.query.ejecutivo_id)
    }

    // Sort by createdAt descending
    agenda.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return res.json({ total: agenda.length, data: agenda })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/agenda/pendientes ───────────────────────────────────────────────
// Must be registered before /:id to avoid being matched as an id
router.get('/pendientes', requireAuth, async (req, res, next) => {
  try {
    let agenda = await db.getAll('agenda')
    agenda = agenda.filter(e => e.estado === 'pendiente')

    const usuario = req.session.usuario
    if (usuario.rol === 'ejecutivo' && usuario.ejecutivo_id) {
      agenda = agenda.filter(e => e.ejecutivo_id === usuario.ejecutivo_id)
    } else if (req.query.ejecutivo_id) {
      agenda = agenda.filter(e => e.ejecutivo_id === req.query.ejecutivo_id)
    }

    // Oldest first — most urgent items at top
    agenda.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    return res.json({ total: agenda.length, data: agenda })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/agenda ─────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { lead_id, descripcion, canal, ejecutivo_id: ej_body } = req.body || {};
    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'descripcion es requerido.' });
    }
    const usuario = req.session.usuario;
    const ejecutivo_id = usuario.ejecutivo_id || ej_body || null;

    const item = await db.save('agenda', {
      ejecutivo_id,
      lead_id: lead_id || null,
      descripcion: descripcion.trim(),
      canal: canal || 'interno',
      estado: 'pendiente',
    });
    return res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/agenda/:id ────────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['estado', 'notas_gestion']
    const patch = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key]
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: `Solo se permiten los campos: ${allowed.join(', ')}.`,
      })
    }

    const updated = await db.update('agenda', req.params.id, patch)
    if (!updated) {
      return res.status(404).json({ error: 'No encontrado', message: 'Entrada de agenda no existe.' })
    }

    return res.json(updated)
  } catch (err) {
    next(err)
  }
})

module.exports = router
