'use strict';

const express = require('express');
const db = require('../data/db');
const catalogAdapter = require('../../integrations/catalogAdapter');
const datos = require('../bot/datos');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

// ─── GET /api/catalogo/resumen ────────────────────────────────────────────────
router.get('/resumen', requireAuth, (req, res) => {
  try {
    const resumen = catalogAdapter.obtenerResumenCatalogo();
    const familias = catalogAdapter.listarSubcategorias();
    return res.json({ resumen, familias });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/catalogo/buscar?q= ─────────────────────────────────────────────
router.get('/buscar', requireAuth, (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    return res.json(catalogAdapter.buscar(q));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/catalogo/familia/:f ────────────────────────────────────────────
router.get('/familia/:f', requireAuth, (req, res) => {
  try {
    return res.json(catalogAdapter.buscarPorSubcategorias([req.params.f]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/catalogo/sku/:sku ──────────────────────────────────────────────
router.get('/sku/:sku', requireAuth, (req, res) => {
  try {
    const p = catalogAdapter.buscarPorSKU(req.params.sku);
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    return res.json(p);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/catalogo/sync/status ───────────────────────────────────────────
// Must be BEFORE /:id to avoid conflict
router.get('/sync/status', requireAuth, async (req, res, next) => {
  try {
    const status = await catalogAdapter.getSyncStatus();
    return res.json(status);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/catalogo/sync ──────────────────────────────────────────────────
router.post('/sync', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const productos = await catalogAdapter.sync();
    const status = await catalogAdapter.getSyncStatus();
    return res.json({ ok: true, total_productos: productos.length, ...status });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/catalogo ────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const datosBot = require('../bot/datos');
    const catalogo = datosBot.getTodosCatalogo();
    const q = req.query.q || req.query.buscar || '';
    if (q) {
      const adapter = require('../../integrations/catalogAdapter');
      const filtered = adapter.buscar(q);
      return res.json({ data: filtered, total: filtered.length });
    }
    return res.json({ data: catalogo, total: catalogo.length });
  } catch (e) { next(e); }
});

// ─── GET /api/catalogo/:id ────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const producto = await db.getById('catalogo', req.params.id);
    if (!producto) return res.status(404).json({ error: 'No encontrado', message: 'Producto no existe.' });
    return res.json(producto);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/catalogo ───────────────────────────────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { sku, nombre, familia, categoria, precio, stock, unidad } = req.body || {};

    if (!sku || !nombre || !categoria || precio === undefined) {
      return res.status(400).json({ error: 'Datos incompletos', message: 'sku, nombre, categoria y precio son requeridos.' });
    }

    const todos = await db.getAll('catalogo');
    if (todos.find(p => p.sku === sku)) {
      return res.status(409).json({ error: 'Conflicto', message: `Ya existe un producto con SKU "${sku}".` });
    }

    const nuevo = await db.save('catalogo', {
      sku,
      nombre,
      familia: familia || categoria,
      categoria,
      precio: Number(precio),
      stock: Number(stock || 0),
      unidad: unidad || 'C/U',
    });

    return res.status(201).json(nuevo);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/catalogo/:id ──────────────────────────────────────────────────
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const producto = await db.getById('catalogo', req.params.id);
    if (!producto) return res.status(404).json({ error: 'No encontrado', message: 'Producto no existe.' });

    const allowed = ['nombre', 'familia', 'categoria', 'precio', 'costo', 'stock', 'unidad'];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    const updated = await db.update('catalogo', req.params.id, patch);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
