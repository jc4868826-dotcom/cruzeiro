'use strict';

const express = require('express');
const datos = require('../bot/datos');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

function normalizar(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

// ─── GET /api/productos ───────────────────────────────────────────────────────
router.get('/productos', requireAuth, (req, res) => {
  const productos = datos.getTodosCatalogo();
  const { q, familia, solo_stock } = req.query;
  let result = productos;
  if (solo_stock === 'true') result = result.filter(p => p.stock > 0);
  if (familia) result = result.filter(p => normalizar(p.familia) === normalizar(familia));
  if (q) {
    const qn = normalizar(q);
    result = result.filter(p =>
      normalizar(p.sku).includes(qn) ||
      normalizar(p.nombre_web).includes(qn) ||
      normalizar(p.familia).includes(qn)
    );
  }
  return res.json(result);
});

// ─── GET /api/productos/buscar ────────────────────────────────────────────────
router.get('/productos/buscar', requireAuth, (req, res) => {
  const q = normalizar(req.query.q || '');
  if (!q) return res.json([]);
  const result = datos.getTodosCatalogo()
    .filter(p =>
      normalizar(p.sku).includes(q) ||
      normalizar(p.nombre_web).includes(q) ||
      normalizar(p.familia).includes(q)
    )
    .filter(p => p.tiene_stock)
    .slice(0, 20);
  return res.json(result);
});

// ─── GET /api/productos/:sku ──────────────────────────────────────────────────
router.get('/productos/:sku', requireAuth, (req, res) => {
  const p = datos.getTodosCatalogo().find(x => normalizar(x.sku) === normalizar(req.params.sku));
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  return res.json(p);
});

// ─── GET /api/clientes ────────────────────────────────────────────────────────
router.get('/clientes', requireAuth, (req, res) => {
  const { q, canal, vendedor, page = 1, limit = 50 } = req.query;
  let result = datos.cargarClientes();
  if (canal) result = result.filter(c => normalizar(c.canal) === normalizar(canal));
  if (vendedor) result = result.filter(c => normalizar(c.vendedor_actual) === normalizar(vendedor));
  if (q) {
    const qn = normalizar(q);
    result = result.filter(c => normalizar(c.rut).includes(qn) || normalizar(c.nombre).includes(qn));
  }
  const total = result.length;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const data = result.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  return res.json({ total, page: pageNum, limit: limitNum, data });
});

// ─── GET /api/clientes/buscar ─────────────────────────────────────────────────
router.get('/clientes/buscar', requireAuth, (req, res) => {
  const q = normalizar(req.query.q || '');
  if (!q) return res.json([]);
  return res.json(
    datos.cargarClientes()
      .filter(c => normalizar(c.rut).includes(q) || normalizar(c.nombre).includes(q))
      .slice(0, 20)
  );
});

// ─── GET /api/clientes/:rut ───────────────────────────────────────────────────
router.get('/clientes/:rut', requireAuth, (req, res) => {
  const c = datos.cargarClientes().find(x => x.rut === req.params.rut);
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  return res.json(c);
});

// ─── GET /api/ventas/resumen ──────────────────────────────────────────────────
router.get('/ventas/resumen', requireAuth, (req, res) => {
  const clientes = datos.cargarClientes();
  const canales = {};
  clientes.forEach(c => { canales[c.canal] = (canales[c.canal] || 0) + 1; });
  return res.json({ total_clientes: clientes.length, por_canal: canales });
});

// ─── GET /api/pedidos ─────────────────────────────────────────────────────────
router.get('/pedidos', requireAuth, (req, res) => {
  const { q, estado, vendedor, page = 1, limit = 50 } = req.query;
  let result = datos.cargarPedidos();
  if (estado) result = result.filter(p => (p.estado || '').toUpperCase() === estado.toUpperCase());
  if (vendedor) result = result.filter(p => normalizar(p.vendedor) === normalizar(vendedor));
  if (q) {
    const qn = normalizar(q);
    result = result.filter(p =>
      String(p.nv).includes(qn) ||
      normalizar(p.rut || '').includes(qn) ||
      normalizar(p.razon_social || '').includes(qn)
    );
  }
  const total = result.length;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const data = result.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  return res.json({ total, page: pageNum, limit: limitNum, data });
});

// ─── GET /api/pedidos/resumen ─────────────────────────────────────────────────
router.get('/pedidos/resumen', requireAuth, (req, res) => {
  const pedidos = datos.cargarPedidos();
  const por_estado = {};
  pedidos.forEach(p => { por_estado[p.estado] = (por_estado[p.estado] || 0) + 1; });
  return res.json({ total: pedidos.length, por_estado });
});

// ─── GET /api/pedidos/nv/:nv ──────────────────────────────────────────────────
router.get('/pedidos/nv/:nv', requireAuth, (req, res) => {
  const p = datos.cargarPedidos().find(x => String(x.nv) === String(req.params.nv));
  if (!p) return res.status(404).json({ error: 'NV no encontrada' });
  return res.json(p);
});

// ─── GET /api/pedidos/rut/:rut ────────────────────────────────────────────────
router.get('/pedidos/rut/:rut', requireAuth, (req, res) => {
  const rutN = String(req.params.rut).replace(/[.\s-]/g, '').toUpperCase();
  const result = datos.cargarPedidos()
    .filter(p => p.rut && String(p.rut).replace(/[.\s-]/g, '').toUpperCase() === rutN);
  return res.json(result);
});

module.exports = router;
