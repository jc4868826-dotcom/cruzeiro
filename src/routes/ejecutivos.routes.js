'use strict'

/**
 * ejecutivos.routes.js
 *
 * All routes require an authenticated session (requireAuth).
 *
 * Mounted at:  (app.use('/api/ejecutivos', ...) and /api/agenda for PATCH gestionar)
 * Note: register this router with both prefixes in app.js, or mount on '/'
 * and let the paths below handle the full /api/... segments.
 */

const express = require('express')
const db = require('../data/db')
const { requireAuth } = require('../middlewares/auth.middleware')
const {
  listarEjecutivos,
  crearEjecutivo,
  actualizarEjecutivo,
  obtenerAgendaEjecutivo,
  marcarAgendaGestionada,
} = require('../modules/ejecutivos/ejecutivos.service')
const { requireRole } = require('../middlewares/auth.middleware')

const router = express.Router()

// ─── GET /api/ejecutivos ──────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const datos = require('../bot/datos');
    const ejecutivos = datos.cargarTodosEjecutivos();
    const dbUsuarios = await db.getAll('usuarios');
    const merged = ejecutivos.map(e => {
      const dbUser = dbUsuarios.find(u => u.username === e.username);
      return {
        id: e.username,
        nombre: e.nombre,
        canal: e.rol,
        fono: e.fono,
        email: e.email,
        activo: dbUser ? dbUser.activo !== false : true,
      };
    });
    res.json(merged);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
})

// ─── POST /api/ejecutivos ─────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const { nombre, email, telefono_alertas, phone_number_id } = req.body || {}

    if (!nombre) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'nombre es requerido.' })
    }

    const nuevo = await crearEjecutivo({ nombre, email, telefono_alertas, phone_number_id })
    return res.status(201).json(nuevo)
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/ejecutivos/:id ────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const updated = await actualizarEjecutivo(req.params.id, req.body || {})
    if (!updated) {
      return res.status(404).json({ error: 'No encontrado', message: 'Ejecutivo no existe.' })
    }
    return res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/ejecutivos/:id/agenda ───────────────────────────────────────────
router.get('/:id/agenda', requireAuth, async (req, res, next) => {
  try {
    const agenda = await obtenerAgendaEjecutivo(req.params.id)
    return res.json({ total: agenda.length, data: agenda })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/agenda/:agendaId/gestionar ────────────────────────────────────
// Note: this path breaks out of the /ejecutivos prefix — mount this router at '/'
// so the full path resolves correctly, or register a dedicated entry in app.js.
router.patch('/agenda/:agendaId/gestionar', requireAuth, async (req, res, next) => {
  try {
    const autor = req.session.usuario?.username || req.session.usuario?.nombre || 'sistema'
    const updated = await marcarAgendaGestionada(req.params.agendaId, autor)
    if (!updated) {
      return res.status(404).json({ error: 'No encontrado', message: 'Entrada de agenda no existe.' })
    }
    return res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/ejecutivos/conversaciones ───────────────────────────────────────
// Fetch all conversations from executive WhatsApp or email channels,
// joined with their lead data.
// Must be registered BEFORE /:id to avoid being swallowed as an id param.
router.get('/conversaciones', requireAuth, async (req, res, next) => {
  try {
    const [convs, leads] = await Promise.all([
      db.getAll('conversaciones'),
      db.getAll('leads'),
    ])

    const leadsById = {}
    for (const l of leads) {
      leadsById[l.id] = l
    }

    const filtradas = convs.filter(c => {
      if (c.canal_tipo === 'ejecutivo_whatsapp' || c.canal === 'correo') return true;
      // Backward compat: existing mayorista conversations without canal_tipo
      const lead = leadsById[c.lead_id];
      return lead?.segmento === 'mayorista' && c.bot_activo === false;
    })

    let resultado = filtradas.map(conv => ({
      conv,
      lead: conv.lead_id ? (leadsById[conv.lead_id] || null) : null,
    }))

    // Ejecutivo role: only show their own assigned conversations
    const usuario = req.session.usuario
    if (usuario.rol === 'ejecutivo' && usuario.ejecutivo_id) {
      resultado = resultado.filter(item => item.lead?.asignado_a === usuario.ejecutivo_id)
    }

    return res.json({ total: resultado.length, data: resultado })
  } catch (err) {
    next(err)
  }
})

module.exports = router
