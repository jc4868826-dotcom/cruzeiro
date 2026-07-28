'use strict';

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const store = require('./store');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.segUser) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autenticado' });
  res.redirect('/seguimiento/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.segUser && req.session.segUser.rol === 'admin') return next();
  res.status(403).json({ error: 'Acceso denegado' });
}

// ─── Rutas públicas ───────────────────────────────────────────────────────────

router.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

router.post('/api/auth/login', async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: 'Faltan campos' });
  const u = store.findUsuario(usuario);
  if (!u || !u.activo) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  req.session.segUser = { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, debeCambiarPassword: u.debeCambiarPassword };
  res.json({ ok: true, usuario: req.session.segUser });
});

// ─── Requiere sesión para todo lo que sigue ───────────────────────────────────

router.use(requireAuth);

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/api/auth/me', (req, res) => {
  res.json(req.session.segUser);
});

router.post('/api/auth/password', async (req, res) => {
  const { passwordActual, passwordNueva } = req.body || {};
  if (!passwordActual || !passwordNueva) return res.status(400).json({ error: 'Faltan campos' });
  if (passwordNueva.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  const u = store.findUsuario(req.session.segUser.usuario);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  const ok = await bcrypt.compare(passwordActual, u.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  const hash = await bcrypt.hash(passwordNueva, 10);
  store.updateUsuario(u.id, { passwordHash: hash, debeCambiarPassword: false });
  req.session.segUser.debeCambiarPassword = false;
  res.json({ ok: true });
});

// ─── Panel principal ──────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Tareas ───────────────────────────────────────────────────────────────────

router.get('/api/tareas', (_req, res) => {
  res.json(store.getTareas());
});

router.patch('/api/tareas/:id', (req, res) => {
  const t = store.updateTarea(Number(req.params.id), req.body);
  if (!t) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json(t);
});

router.post('/api/tareas/:id/bitacora', (req, res) => {
  const { texto } = req.body || {};
  if (!texto) return res.status(400).json({ error: 'texto requerido' });
  const autor = req.session.segUser.nombre;
  const entry = store.addBitacora(Number(req.params.id), autor, texto);
  if (!entry) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.status(201).json(entry);
});

router.get('/api/kpis', (_req, res) => {
  res.json(store.getKpis());
});

// ─── Gestión de usuarios (admin) ──────────────────────────────────────────────

router.get('/api/usuarios', requireAdmin, (_req, res) => {
  res.json(store.getUsuarios());
});

router.post('/api/usuarios', requireAdmin, async (req, res) => {
  const { usuario, nombre, password, rol } = req.body || {};
  if (!usuario || !nombre || !password || !rol) return res.status(400).json({ error: 'Faltan campos' });
  if (!['admin', 'usuario'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const u = store.createUsuario({ usuario, nombre, passwordHash: hash, rol });
    res.status(201).json(u);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/api/usuarios/:id', requireAdmin, async (req, res) => {
  const { nombre, rol, activo, resetPassword } = req.body || {};
  const updates = {};
  if (nombre !== undefined) updates.nombre = nombre;
  if (rol !== undefined) updates.rol = rol;
  if (activo !== undefined) updates.activo = activo;
  if (resetPassword) {
    updates.passwordHash = await bcrypt.hash(resetPassword, 10);
    updates.debeCambiarPassword = true;
  }
  const u = store.updateUsuario(Number(req.params.id), updates);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(u);
});

router.delete('/api/usuarios/:id', requireAdmin, (req, res) => {
  try {
    store.deleteUsuario(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
