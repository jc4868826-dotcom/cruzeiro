'use strict';

const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '..', 'data', 'cruzeiro', 'notas-pedido.json');

let _cache = null;
let _cacheMtime = 0;

function cargarNotas() {
  if (!fs.existsSync(JSON_PATH)) {
    fs.writeFileSync(JSON_PATH, '[]');
    _cache = [];
    _cacheMtime = 0;
    return _cache;
  }
  const stat = fs.statSync(JSON_PATH);
  const mtime = stat.mtimeMs;
  if (_cache && mtime === _cacheMtime) return _cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    _cache = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    _cache = [];
  }
  _cacheMtime = mtime;
  return _cache;
}

function normalizarRut(rut) {
  return String(rut || '').replace(/[.\s-]/g, '').toUpperCase();
}

function buscarPedidosPorRut(rut) {
  const notas = cargarNotas();
  const rutN = normalizarRut(rut);
  return notas
    .filter(n => normalizarRut(n.rut) === rutN)
    .sort((a, b) => {
      const da = a.fecha_nv ? new Date(a.fecha_nv) : new Date(0);
      const db = b.fecha_nv ? new Date(b.fecha_nv) : new Date(0);
      return db - da;
    })
    .slice(0, 5);
}

function buscarPedidoPorNV(nv) {
  const notas = cargarNotas();
  const key = String(nv).trim();
  return notas.find(n => String(n.nv).trim() === key) || null;
}

function formatearEstadoPedidoBot(nv_obj) {
  let txt = `📋 *NV ${nv_obj.nv}*\nEstado: ${nv_obj.estado}\nEntrega: ${nv_obj.fecha_entrega || 'Sin fecha'}\nTransporte: ${nv_obj.transporte || '—'}\nDirección: ${nv_obj.direccion || '—'}, ${nv_obj.comuna || '—'}`;
  const est = (nv_obj.estado || '').toUpperCase();
  if (est.includes('ENTREGADO') || est.includes('FACTURADO')) txt += '\n✅ Pedido completado.';
  else if (est.includes('RUTA')) txt += '\n🚚 En camino.';
  else if (est.includes('PREPARACIÓN') || est.includes('PREPARADO')) txt += '\n⏳ En preparación.';
  return txt;
}

function getResumenPedidos() {
  const notas = cargarNotas();
  const por_estado = {};
  const por_canal = {};
  for (const n of notas) {
    por_estado[n.estado] = (por_estado[n.estado] || 0) + 1;
    por_canal[n.canal] = (por_canal[n.canal] || 0) + 1;
  }
  const stat = fs.statSync(JSON_PATH);
  return { total: notas.length, por_estado, por_canal, actualizado_en: stat.mtime.toISOString() };
}

module.exports = { buscarPedidosPorRut, buscarPedidoPorNV, formatearEstadoPedidoBot, getResumenPedidos };
