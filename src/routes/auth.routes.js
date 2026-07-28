'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { requireAuth } = require('../middlewares/auth.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'Se requieren username y password.' });
    }

    const usuarios = await db.getAll('usuarios');
    const usuario = usuarios.find(u => u.username === username && u.activo !== false);

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas', message: 'Usuario o contraseña incorrectos.' });
    }

    const passwordOk = await bcrypt.compare(password, usuario.password);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales inválidas', message: 'Usuario o contraseña incorrectos.' });
    }

    // Store user in session (without password)
    const { password: _pw, ...usuarioSinPassword } = usuario;
    req.session.usuario = usuarioSinPassword;

    logger.info(`Auth: login exitoso — usuario="${username}", rol="${usuario.rol}"`);
    return res.json({ ok: true, usuario: usuarioSinPassword });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    return res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({ usuario: req.session.usuario });
});

module.exports = router;
