'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const {
  META_ACCESS_TOKEN,
  META_PHONE_NUMBER_ID,
  OPENAI_API_KEY,
  TRANSBANK_API_KEY,
  KHIPU_API_KEY,
  ERP_URL,
  GDRIVE_SHEET_ID,
  CLARITY_WEBHOOK_SECRET,
} = require('../config');

const router = express.Router();

// ─── GET /api/config/tenant ───────────────────────────────────────────────────
router.get('/tenant', requireAuth, async (req, res, next) => {
  try {
    const configs = await db.getAll('config');
    const config = configs[0] || {};
    return res.json(config);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/config/tenant ─────────────────────────────────────────────────
router.patch('/tenant', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const configs = await db.getAll('config');
    if (configs.length === 0) {
      return res.status(404).json({ error: 'No encontrado', message: 'Config no existe.' });
    }

    const config = configs[0];
    const allowed = ['nombre_comercial', 'horario', 'zona_horaria', 'moneda', 'pais', 'whatsapp_numero'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    const updated = await db.update('config', config.id, patch);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/config/usuarios ─────────────────────────────────────────────────
router.get('/usuarios', requireAuth, async (req, res, next) => {
  try {
    const usuarios = await db.getAll('usuarios');
    // Strip passwords
    const safe = usuarios.map(({ password, ...u }) => u);
    return res.json({ total: safe.length, data: safe });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/config/usuarios ────────────────────────────────────────────────
router.post('/usuarios', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { username, password, rol, nombre } = req.body || {};

    if (!username || !password || !rol || !nombre) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'username, password, rol y nombre son requeridos.' });
    }

    const rolesValidos = ['admin', 'agente', 'solo-lectura'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido', message: `Roles válidos: ${rolesValidos.join(', ')}.` });
    }

    // Check duplicate username
    const todos = await db.getAll('usuarios');
    if (todos.find(u => u.username === username)) {
      return res.status(409).json({ error: 'Conflicto', message: `El username "${username}" ya existe.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevo = await db.save('usuarios', {
      username,
      password: hashedPassword,
      rol,
      nombre,
      activo: true,
    });

    const { password: _pw, ...nuevoSafe } = nuevo;
    return res.status(201).json(nuevoSafe);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/config/usuarios/:id ──────────────────────────────────────────
router.patch('/usuarios/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const usuario = await db.getById('usuarios', req.params.id);
    if (!usuario) return res.status(404).json({ error: 'No encontrado', message: 'Usuario no existe.' });

    const rolesValidos = ['admin', 'agente', 'solo-lectura'];
    const patch = {};

    if (req.body.rol !== undefined) {
      if (!rolesValidos.includes(req.body.rol)) {
        return res.status(400).json({ error: 'Rol inválido', message: `Roles válidos: ${rolesValidos.join(', ')}.` });
      }
      patch.rol = req.body.rol;
    }

    if (req.body.activo !== undefined) patch.activo = Boolean(req.body.activo);
    if (req.body.nombre !== undefined) patch.nombre = req.body.nombre;

    if (req.body.password) {
      patch.password = await bcrypt.hash(req.body.password, 10);
    }

    const updated = await db.update('usuarios', req.params.id, patch);
    const { password: _pw, ...safe } = updated;
    return res.json(safe);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/config/usuarios/:id ─────────────────────────────────────────
router.delete('/usuarios/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.session.usuario?.id === req.params.id) {
      return res.status(400).json({ error: 'No permitido', message: 'No puedes desactivar tu propia cuenta.' });
    }

    const usuario = await db.getById('usuarios', req.params.id);
    if (!usuario) return res.status(404).json({ error: 'No encontrado', message: 'Usuario no existe.' });

    // Soft delete: set activo = false
    await db.update('usuarios', req.params.id, { activo: false });
    return res.json({ ok: true, message: 'Usuario desactivado correctamente.' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/config/integraciones ───────────────────────────────────────────
router.get('/integraciones', requireAuth, requireAdmin, (req, res) => {
  const integraciones = [
    {
      nombre: 'WhatsApp Cloud API (Meta)',
      clave: 'meta_whatsapp',
      configurado: !!(META_ACCESS_TOKEN && META_PHONE_NUMBER_ID),
      env_vars: ['META_ACCESS_TOKEN', 'META_PHONE_NUMBER_ID', 'META_VERIFY_TOKEN'],
    },
    {
      nombre: 'OpenAI',
      clave: 'openai',
      configurado: !!OPENAI_API_KEY,
      env_vars: ['OPENAI_API_KEY'],
    },
    {
      nombre: 'Transbank WebPay',
      clave: 'transbank',
      configurado: !!TRANSBANK_API_KEY,
      env_vars: ['TRANSBANK_API_KEY'],
    },
    {
      nombre: 'Khipu',
      clave: 'khipu',
      configurado: !!KHIPU_API_KEY,
      env_vars: ['KHIPU_API_KEY'],
    },
    {
      nombre: 'ERP / API de productos',
      clave: 'erp',
      configurado: !!ERP_URL,
      env_vars: ['ERP_URL'],
    },
    {
      nombre: 'Google Drive / Sheets',
      clave: 'gdrive',
      configurado: !!GDRIVE_SHEET_ID,
      env_vars: ['GDRIVE_SHEET_ID'],
    },
    {
      nombre: 'Microsoft Clarity Webhooks',
      clave: 'clarity',
      configurado: !!CLARITY_WEBHOOK_SECRET,
      env_vars: ['CLARITY_WEBHOOK_SECRET'],
    },
  ];

  return res.json({ integraciones });
});

module.exports = router;
