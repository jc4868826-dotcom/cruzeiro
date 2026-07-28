'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'cruzeiro');
const router = express.Router();

let _catalogoCache = null, _catalogoMtime = 0;
let _pedidosCache = null, _pedidosMtime = 0;
let _clientesCache = null, _clientesMtime = 0;
let _ventasCache = null, _ventasMtime = 0;

function leerJSON(filename, defaultVal) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) { fs.writeFileSync(fp, JSON.stringify(defaultVal, null, 2)); return defaultVal; }
  try {
    const raw = fs.readFileSync(fp, 'utf8').trim();
    if (!raw || raw === '' || raw === 'null') return defaultVal;
    return JSON.parse(raw);
  } catch (_) { return defaultVal; }
}

function getCatalogoCache() {
  const fp = path.join(DATA_DIR, 'catalogo.json');
  if (!fs.existsSync(fp)) return [];
  const mtime = fs.statSync(fp).mtimeMs;
  if (_catalogoCache && mtime === _catalogoMtime) return _catalogoCache;
  try { _catalogoCache = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { _catalogoCache = []; }
  if (!Array.isArray(_catalogoCache)) _catalogoCache = [];
  _catalogoMtime = mtime;
  return _catalogoCache;
}

function getPedidosCache() {
  const fp = path.join(DATA_DIR, 'notas-pedido.json');
  if (!fs.existsSync(fp)) return [];
  const mtime = fs.statSync(fp).mtimeMs;
  if (_pedidosCache && mtime === _pedidosMtime) return _pedidosCache;
  try { _pedidosCache = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { _pedidosCache = []; }
  if (!Array.isArray(_pedidosCache)) _pedidosCache = [];
  _pedidosMtime = mtime;
  return _pedidosCache;
}

function getClientesCache() {
  const fp = path.join(DATA_DIR, 'clientes.json');
  if (!fs.existsSync(fp)) return [];
  const mtime = fs.statSync(fp).mtimeMs;
  if (_clientesCache && mtime === _clientesMtime) return _clientesCache;
  try { _clientesCache = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { _clientesCache = []; }
  if (!Array.isArray(_clientesCache)) _clientesCache = [];
  _clientesMtime = mtime;
  return _clientesCache;
}

function getVentasCache() {
  const fp = path.join(DATA_DIR, 'ventas-resumen.json');
  if (!fs.existsSync(fp)) return null;
  const mtime = fs.statSync(fp).mtimeMs;
  if (_ventasCache && mtime === _ventasMtime) return _ventasCache;
  try { _ventasCache = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { _ventasCache = null; }
  _ventasMtime = mtime;
  return _ventasCache;
}

function normalizar(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

router.get('/productos', requireAuth, (req, res) => {
  const productos = getCatalogoCache();
  const { q, familia, solo_stock } = req.query;
  let result = productos;
  if (solo_stock === 'true') result = result.filter(p => p.stock > 0);
  if (familia) result = result.filter(p => normalizar(p.familia) === normalizar(familia));
  if (q) {
    const qn = normalizar(q);
    result = result.filter(p =>
      normalizar(p.sku).includes(qn) || normalizar(p.nombre).includes(qn) || normalizar(p.familia).includes(qn)
    );
  }
  return res.json(result);
});

router.get('/productos/buscar', requireAuth, (req, res) => {
  const q = normalizar(req.query.q || '');
  if (!q) return res.json([]);
  const productos = getCatalogoCache();
  const result = productos
    .filter(p => normalizar(p.sku).includes(q) || normalizar(p.nombre).includes(q) || normalizar(p.familia).includes(q))
    .filter(p => p.stock > 0)
    .slice(0, 20);
  return res.json(result);
});

router.get('/productos/:sku', requireAuth, (req, res) => {
  const productos = getCatalogoCache();
  const p = productos.find(x => normalizar(x.sku) === normalizar(req.params.sku));
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  return res.json(p);
});

router.get('/clientes', requireAuth, (req, res) => {
  const clientes = getClientesCache();
  const { q, canal, vendedor, page = 1, limit = 50 } = req.query;
  let result = clientes;
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

router.get('/clientes/buscar', requireAuth, (req, res) => {
  const q = normalizar(req.query.q || '');
  if (!q) return res.json([]);
  const clientes = getClientesCache();
  return res.json(clientes.filter(c => normalizar(c.rut).includes(q) || normalizar(c.nombre).includes(q)).slice(0, 20));
});

router.get('/clientes/:rut', requireAuth, (req, res) => {
  const clientes = getClientesCache();
  const c = clientes.find(x => x.rut === req.params.rut);
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  return res.json(c);
});

router.get('/ventas/resumen', requireAuth, (req, res) => {
  const v = getVentasCache();
  return res.json(v || {});
});

router.get('/pedidos', requireAuth, (req, res) => {
  const pedidos = getPedidosCache();
  const { q, estado, canal, vendedor, page = 1, limit = 50 } = req.query;
  let result = pedidos;
  if (estado) result = result.filter(p => (p.estado || '').toUpperCase() === estado.toUpperCase());
  if (canal) result = result.filter(p => normalizar(p.canal) === normalizar(canal));
  if (vendedor) result = result.filter(p => normalizar(p.vendedor) === normalizar(vendedor));
  if (q) {
    const qn = normalizar(q);
    result = result.filter(p =>
      String(p.nv).includes(qn) || normalizar(p.rut || '').includes(qn) || normalizar(p.cliente || '').includes(qn)
    );
  }
  const total = result.length;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const data = result.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  return res.json({ total, page: pageNum, limit: limitNum, data });
});

router.get('/pedidos/resumen', requireAuth, (req, res) => {
  const pedidos = getPedidosCache();
  const por_estado = {};
  const por_canal = {};
  pedidos.forEach(p => {
    por_estado[p.estado] = (por_estado[p.estado] || 0) + 1;
    por_canal[p.canal] = (por_canal[p.canal] || 0) + 1;
  });
  return res.json({ total: pedidos.length, por_estado, por_canal });
});

router.get('/pedidos/nv/:nv', requireAuth, (req, res) => {
  const pedidos = getPedidosCache();
  const p = pedidos.find(x => String(x.nv) === String(req.params.nv));
  if (!p) return res.status(404).json({ error: 'NV no encontrada' });
  return res.json(p);
});

router.get('/pedidos/rut/:rut', requireAuth, (req, res) => {
  const pedidos = getPedidosCache();
  const rutN = String(req.params.rut).replace(/[.\s-]/g, '').toUpperCase();
  const result = pedidos
    .filter(p => p.rut && String(p.rut).replace(/[.\s-]/g,'').toUpperCase() === rutN)
    .sort((a, b) => {
      const da = a.fecha_nv ? new Date(a.fecha_nv) : new Date(0);
      const db = b.fecha_nv ? new Date(b.fecha_nv) : new Date(0);
      return db - da;
    });
  return res.json(result);
});

module.exports = router;
