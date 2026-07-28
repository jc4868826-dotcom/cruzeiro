'use strict';

const express = require('express');
const db = require('../data/db');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

// ─── GET /api/leads ───────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { estado, segmento, origen, busqueda, asignado_a, fecha_desde, fecha_hasta, page = 1, limit = 50 } = req.query;
    let leads = await db.getAll('leads');

    // Ejecutivo role: enforce own-data filter regardless of query params
    const usuario = req.session.usuario;
    if (usuario.rol === 'ejecutivo' && usuario.ejecutivo_id) {
      leads = leads.filter(l => l.asignado_a === usuario.ejecutivo_id);
    } else {
      if (asignado_a) leads = leads.filter(l => l.asignado_a === asignado_a);
    }

    if (estado) leads = leads.filter(l => l.estado === estado);
    if (segmento) leads = leads.filter(l => l.segmento === segmento);
    if (origen) leads = leads.filter(l => l.origen === origen);
    if (fecha_desde) leads = leads.filter(l => l.createdAt >= fecha_desde);
    if (fecha_hasta) leads = leads.filter(l => l.createdAt <= fecha_hasta + 'T23:59:59Z');
    if (busqueda) {
      const q = busqueda.toLowerCase();
      leads = leads.filter(l =>
        (l.nombre || '').toLowerCase().includes(q) ||
        (l.telefono || '').includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.empresa || '').toLowerCase().includes(q)
      );
    }

    // Sort by createdAt desc
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const total = leads.length;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const start = (pageNum - 1) * limitNum;
    const paginated = leads.slice(start, start + limitNum);

    return res.json({ total, page: pageNum, limit: limitNum, data: paginated });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/leads/:id ───────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const lead = await db.getById('leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'No encontrado', message: 'Lead no existe.' });

    // Embed conversations
    const todasConvs = await db.getAll('conversaciones');
    const conversaciones = todasConvs.filter(c => c.lead_id === lead.id);

    return res.json({ ...lead, conversaciones });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/leads ──────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { nombre, telefono, email, segmento, origen, empresa } = req.body || {};

    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'nombre y telefono son requeridos.' });
    }

    const nuevoLead = await db.save('leads', {
      nombre,
      telefono,
      email: email || '',
      segmento: segmento || 'ecommerce',
      origen: origen || 'web',
      empresa: empresa || '',
      estado: 'Nuevo',
      notas: [],
      bot_activo: true,
    });

    return res.status(201).json(nuevoLead);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/leads/:id ─────────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const lead = await db.getById('leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'No encontrado', message: 'Lead no existe.' });

    // Allowed fields to update
    const allowed = ['nombre', 'telefono', 'email', 'empresa', 'estado', 'segmento', 'origen', 'asignado_a',
      'rut', 'direccion', 'giro', 'canal_origen', 'notas_libres', 'fecha_ultima_compra',
      'resumen_conversacion', 'intencion_compra', 'derivado_a', 'fecha_derivacion'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    // Track pipeline stage transitions
    if (patch.estado && patch.estado !== lead.estado) {
      const autor = req.session.usuario?.nombre || req.session.usuario?.username || 'sistema';
      patch.pipeline_history = [
        ...(lead.pipeline_history || []),
        { etapa_anterior: lead.estado, etapa_nueva: patch.estado, fecha: new Date().toISOString(), autor },
      ];
    }

    const updated = await db.update('leads', req.params.id, patch);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/leads/:id/notas ────────────────────────────────────────────────
router.post('/:id/notas', requireAuth, async (req, res, next) => {
  try {
    const lead = await db.getById('leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'No encontrado', message: 'Lead no existe.' });

    const { texto } = req.body || {};
    if (!texto || texto.trim() === '') {
      return res.status(400).json({ error: 'Datos incompletos', message: 'El campo texto es requerido.' });
    }

    const nota = {
      texto: texto.trim(),
      autor: req.session.usuario?.nombre || req.session.usuario?.username || 'sistema',
      timestamp: new Date().toISOString(),
    };

    const notas = [...(lead.notas || []), nota];
    const updated = await db.update('leads', req.params.id, { notas });

    return res.status(201).json({ nota, lead: updated });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/leads/:id/mensajes — ejecutivo reply from CRM ─────────────────
router.post('/:id/mensajes', requireAuth, async (req, res, next) => {
  try {
    const lead = await db.getById('leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'No encontrado', message: 'Lead no existe.' });

    const { texto } = req.body || {};
    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'texto es requerido.' });
    }

    const sender_name = req.session.usuario?.nombre || req.session.usuario?.username || 'Agente';
    const mensaje = {
      id: `msg-${Date.now()}`,
      rol: 'agente',
      sender_name,
      texto: texto.trim(),
      timestamp: new Date().toISOString(),
    };

    const todasConvs = await db.getAll('conversaciones');
    const convsDelLead = todasConvs
      .filter(c => c.lead_id === lead.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let conv;
    if (!convsDelLead.length) {
      conv = await db.save('conversaciones', {
        lead_id: lead.id,
        phone: lead.telefono,
        bot_activo: false,
        canal: 'ejecutivo_whatsapp',
        canal_tipo: 'ejecutivo_whatsapp',
        mensajes: [mensaje],
        createdAt: new Date().toISOString(),
      });
    } else {
      conv = convsDelLead[0];
      const mensajes = [...(conv.mensajes || []), mensaje];
      conv = await db.update('conversaciones', conv.id, { mensajes });
    }

    return res.status(201).json({ mensaje, conv_id: conv.id });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/leads/:id/bot ─────────────────────────────────────────────────
router.patch('/:id/bot', requireAuth, async (req, res, next) => {
  try {
    const lead = await db.getById('leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'No encontrado', message: 'Lead no existe.' });

    const { bot_activo } = req.body || {};
    if (typeof bot_activo !== 'boolean') {
      return res.status(400).json({ error: 'Datos inválidos', message: 'bot_activo debe ser boolean.' });
    }

    // Update all active conversations for this lead
    const todasConvs = await db.getAll('conversaciones');
    const convsDeLead = todasConvs.filter(c => c.lead_id === lead.id);
    await Promise.all(convsDeLead.map(c => db.update('conversaciones', c.id, { bot_activo })));

    const updated = await db.update('leads', req.params.id, { bot_activo });
    return res.json({ ok: true, lead: updated, conversaciones_actualizadas: convsDeLead.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
