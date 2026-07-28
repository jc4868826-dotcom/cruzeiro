'use strict';

const express = require('express');
const pedidosAdapter = require('../../integrations/pedidosAdapter');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, (req, res, next) => {
  try {
    return res.json(pedidosAdapter.getResumenPedidos());
  } catch (err) {
    next(err);
  }
});

router.get('/nv/:nv', requireAuth, (req, res, next) => {
  try {
    const nv = pedidosAdapter.buscarPedidoPorNV(req.params.nv);
    if (!nv) return res.status(404).json({ error: 'NV no encontrada' });
    return res.json(nv);
  } catch (err) {
    next(err);
  }
});

router.get('/rut/:rut', requireAuth, requireAdmin, (req, res, next) => {
  try {
    return res.json(pedidosAdapter.buscarPedidosPorRut(req.params.rut));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
