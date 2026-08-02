'use strict';

const express = require('express');
const db = require('../data/db');
const { requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inRange(isoStr, desde, hasta) {
  const d = new Date(isoStr);
  if (isNaN(d)) return true; // no date filtering if invalid
  if (desde && d < new Date(desde)) return false;
  if (hasta && d > new Date(hasta)) return false;
  return true;
}

function filtrarLeads(leads, params) {
  const { desde, hasta, origen, equipo } = params;
  return leads.filter(lead => {
    if (!inRange(lead.createdAt, desde, hasta)) return false;
    if (origen && lead.origen !== origen) return false;
    if (equipo && lead.equipo !== equipo) return false;
    return true;
  });
}

function filtrarConversaciones(convs, params) {
  const { desde, hasta } = params;
  return convs.filter(c => inRange(c.createdAt, desde, hasta));
}

function calcularMetrics(leads, conversaciones, campanas) {
  const totalLeads = leads.length;
  const cerradosLeads = leads.filter(l => l.estado === 'Cerrado');
  const abandonadosLeads = leads.filter(l => l.estado === 'Abandonado');
  const derivacionesConvs = conversaciones.filter(c => c.bot_activo === false);

  const rendimiento = campanas.reduce(
    (acc, c) => {
      acc.enviadas += c.stats?.enviadas || 0;
      acc.entregadas += c.stats?.entregadas || 0;
      acc.leidas += c.stats?.leidas || 0;
      acc.respondidas += c.stats?.respondidas || 0;
      return acc;
    },
    { enviadas: 0, entregadas: 0, leidas: 0, respondidas: 0 }
  );

  const cerrados_lead_ids = cerradosLeads.map(l => l.id);
  const abandonos_lead_ids = abandonadosLeads.map(l => l.id);
  const derivaciones_lead_ids = [...new Set(derivacionesConvs.filter(c => c.lead_id).map(c => c.lead_id))];
  const volumen_lead_ids = [...new Set(conversaciones.filter(c => c.lead_id).map(c => c.lead_id))];

  // ── Segmento breakdown ────────────────────────────────────────────────────
  const leadsMap = new Map(leads.map(l => [l.id, l]));
  const getSegmento = id => leadsMap.get(id)?.segmento || 'ecommerce';

  const leadsMin = leads.filter(l => (l.segmento || 'ecommerce') === 'ecommerce');
  const leadsMay = leads.filter(l => l.segmento === 'mayorista');

  const segmento = {
    conversaciones: {
      total: conversaciones.length,
      ecommerce: conversaciones.filter(c => c.lead_id && getSegmento(c.lead_id) === 'ecommerce').length,
      mayorista: conversaciones.filter(c => c.lead_id && getSegmento(c.lead_id) === 'mayorista').length,
    },
    conversion: {
      total_pct: totalLeads > 0 ? parseFloat(((cerradosLeads.length / totalLeads) * 100).toFixed(2)) : 0,
      ecommerce: { convertidos: leadsMin.filter(l => l.estado === 'Cerrado').length, total: leadsMin.length },
      mayorista: { convertidos: leadsMay.filter(l => l.estado === 'Cerrado').length, total: leadsMay.length },
    },
    abandonos: {
      total: abandonadosLeads.length,
      ecommerce: leadsMin.filter(l => l.estado === 'Abandonado').length,
      mayorista: leadsMay.filter(l => l.estado === 'Abandonado').length,
    },
    derivaciones_humano: {
      total: derivacionesConvs.length,
      ecommerce: derivacionesConvs.filter(c => c.lead_id && getSegmento(c.lead_id) === 'ecommerce').length,
      mayorista: derivacionesConvs.filter(c => c.lead_id && getSegmento(c.lead_id) === 'mayorista').length,
    },
  };

  // ── Clasificación de interés ──────────────────────────────────────────────
  const intenciones = {};
  leads.forEach(l => {
    const k = l.intencion_principal || 'sin_clasificar';
    intenciones[k] = (intenciones[k] || 0) + 1;
  });

  const intenciones_ecommerce = {};
  leadsMin.forEach(l => {
    const k = l.intencion_principal || 'sin_clasificar';
    intenciones_ecommerce[k] = (intenciones_ecommerce[k] || 0) + 1;
  });

  const intenciones_mayorista = {};
  leadsMay.forEach(l => {
    const k = l.intencion_principal || 'sin_clasificar';
    intenciones_mayorista[k] = (intenciones_mayorista[k] || 0) + 1;
  });

  // ── Calidad de leads ──────────────────────────────────────────────────────
  const calidad = {
    bajo: 0, medio: 0, alto: 0, convertido: 0,
    ecommerce: { bajo: 0, medio: 0, alto: 0, convertido: 0 },
    mayorista: { bajo: 0, medio: 0, alto: 0, convertido: 0 },
  };
  leads.forEach(l => {
    const q   = l.calidad_lead || 'bajo';
    const seg = l.segmento === 'mayorista' ? 'mayorista' : 'ecommerce';
    calidad[q] = (calidad[q] || 0) + 1;
    calidad[seg][q] = (calidad[seg][q] || 0) + 1;
  });

  // ── Familias de producto ──────────────────────────────────────────────────
  const famMap = {};
  leads.forEach(l => {
    if (l.familia_interes) famMap[l.familia_interes] = (famMap[l.familia_interes] || 0) + 1;
  });
  const familias = Object.entries(famMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nombre, total]) => ({ nombre, total }));

  return {
    volumen_conversaciones: conversaciones.length,
    volumen_lead_ids,
    tasa_conversion: totalLeads > 0 ? parseFloat(((cerradosLeads.length / totalLeads) * 100).toFixed(2)) : 0,
    cerrados_lead_ids,
    derivaciones_humano: derivacionesConvs.length,
    derivaciones_lead_ids,
    abandonos: abandonadosLeads.length,
    abandonos_lead_ids,
    rendimiento_campanas: rendimiento,
    segmento,
    intenciones,
    intenciones_ecommerce,
    intenciones_mayorista,
    calidad,
    familias,
  };
}

// ─── GET /api/dashboard/metrics ───────────────────────────────────────────────
router.get('/metrics', requireAdmin, async (req, res, next) => {
  try {
    const { desde, hasta, articulo, origen, equipo } = req.query;

    const [allLeads, allConvs, allCampanas] = await Promise.all([
      db.getAll('leads'),
      db.getAll('conversaciones'),
      db.getAll('campanas'),
    ]);

    const leads = filtrarLeads(allLeads, { desde, hasta, origen, equipo });
    const conversaciones = filtrarConversaciones(allConvs, { desde, hasta });

    const metrics = calcularMetrics(leads, conversaciones, allCampanas);

    return res.json(metrics);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/dashboard/trends ────────────────────────────────────────────────
router.get('/trends', requireAdmin, async (req, res, next) => {
  try {
    const [allLeads, allConvs] = await Promise.all([
      db.getAll('leads'),
      db.getAll('conversaciones'),
    ]);

    // Build last 30 days array
    const days = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dayStr = date.toISOString().slice(0, 10);

      const desde = `${dayStr}T00:00:00.000Z`;
      const hasta = `${dayStr}T23:59:59.999Z`;

      const leads = filtrarLeads(allLeads, { desde, hasta });
      const convs = filtrarConversaciones(allConvs, { desde, hasta });

      const totalLeads = leads.length;
      const cerrados = leads.filter(l => l.estado === 'Cerrado').length;
      const abandonados = leads.filter(l => l.estado === 'Abandonado').length;
      const derivaciones = convs.filter(c => c.bot_activo === false).length;

      days.push({
        fecha: dayStr,
        volumen_conversaciones: convs.length,
        tasa_conversion: totalLeads > 0 ? parseFloat(((cerrados / totalLeads) * 100).toFixed(2)) : 0,
        derivaciones_humano: derivaciones,
        abandonos: abandonados,
        nuevos_leads: totalLeads,
      });
    }

    return res.json({ trends: days });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
