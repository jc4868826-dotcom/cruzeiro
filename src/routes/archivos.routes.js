'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

const DATA_CRUZEIRO = path.join(__dirname, '..', '..', 'data', 'cruzeiro');
const META_PATH = path.join(DATA_CRUZEIRO, 'meta-cargas.json');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function leerMeta() {
  try {
    if (fs.existsSync(META_PATH)) return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  } catch (_) {}
  return { catalogo: { ultima_carga: null, total: 0 }, pedidos: { ultima_carga: null, total: 0 }, equipos: { ultima_carga: null, configurado: false } };
}

function guardarMeta(meta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
}

function parseNum(val, def = 0) {
  const n = Number(val);
  return isNaN(n) ? def : n;
}

function excelDateToStr(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    const d = xlsx.SSF.parse_date_code(val);
    if (!d) return null;
    return `${d.d.toString().padStart(2, '0')}-${d.m.toString().padStart(2, '0')}-${d.y}`;
  }
  return null;
}

function normalizarCanal(raw) {
  if (!raw) return 'Sin canal';
  const s = String(raw).trim();
  if (s.toUpperCase() === 'ECOMMERCE') return 'Ecommerce';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function normalizarRut(val) {
  if (val == null) return '';
  return String(val).replace(/[.\s]/g, '').toUpperCase();
}

function parsearArchivo(buffer, ext) {
  if (ext === '.csv') {
    const texto = buffer.toString('utf8');
    const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lineas.length < 2) return [];
    const headers = lineas[0].split(',').map(h => h.trim());
    return lineas.slice(1).map(linea => {
      const vals = linea.split(',');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return obj;
    });
  }
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = xlsx.utils.sheet_to_json(ws, { defval: null });
  return raw.map(row => {
    const clean = {};
    for (const k of Object.keys(row)) clean[k.trim()] = row[k];
    return clean;
  });
}

function transformarCatalogo(rows) {
  const out = [];
  let omitidas = 0;
  for (const r of rows) {
    const sku = r['Codigo'] ? String(r['Codigo']).trim() : null;
    if (!sku) { omitidas++; continue; }
    const precio = Math.round(parseNum(r['Precio Venta'], 0));
    if (precio <= 0) { omitidas++; continue; }
    out.push({
      sku,
      nombre: String(r['descripcion'] || '').trim(),
      familia: String(r['Familia'] || '').trim(),
      categoria: String(r['Padre_familia'] || '').trim(),
      stock: Math.max(0, parseNum(r['Saldo'], 0)),
      precio,
      costo: Math.round(parseNum(r['PCP'], 0)),
      unidad: String(r['unidad'] || 'C/U').trim(),
      proveedor: String(r['Proveedor'] || '').trim(),
    });
  }
  return { data: out, omitidas };
}

function transformarPedidos(rows) {
  const out = [];
  let omitidas = 0;
  for (const r of rows) {
    const nv = r['Nota_Venta'] != null ? String(r['Nota_Venta']).trim() : null;
    if (!nv) { omitidas++; continue; }
    out.push({
      nv,
      estado: r['status_pedido'] ? String(r['status_pedido']).trim() : 'SIN ESTADO',
      cliente: r['RazonSocial'] ? String(r['RazonSocial']).trim() : null,
      rut: r['Rut'] ? normalizarRut(r['Rut']) : null,
      vendedor: r['Vendedor'] ? String(r['Vendedor']).trim() : null,
      canal: normalizarCanal(r['tipo_negocio']),
      fecha_nv: excelDateToStr(r['Fecha Nota de Venta']),
      fecha_entrega: r['Fecha Entrega'] ? String(r['Fecha Entrega']).trim() : null,
      fecha_facturado: excelDateToStr(r['fecha_facturado']),
      direccion: r['direcciondespacho'] ? String(r['direcciondespacho']).trim() : null,
      comuna: r['Comuna'] ? String(r['Comuna']).trim() : null,
      transporte: r['transporte'] ? String(r['transporte']).trim() : null,
      orden_compra: r['ordencompra'] ? String(r['ordencompra']).trim() : null,
    });
  }
  return { data: out, omitidas };
}

function normalizarCanalLocal(raw) {
  if (!raw) return 'Sin canal';
  const s = String(raw).trim();
  const up = s.toUpperCase();
  if (up === 'ECOMMERCE') return 'Ecommerce';
  if (up === 'MERCADO PUBLICO') return 'Mercado Público';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function transformarClientes(rows) {
  const mapa = new Map();
  let omitidas = 0;
  for (const r of rows) {
    const rut = r['Rut'] != null ? String(r['Rut']).trim() : null;
    if (!rut || rut === '3') { omitidas++; continue; }
    const ultimaVenta = r['ultima_venta'] ? String(r['ultima_venta']).trim() : null;
    if (!mapa.has(rut)) {
      mapa.set(rut, {
        rut,
        dv: r['Digito'] ? String(r['Digito']).trim() : null,
        nombre: r['RazonSocial'] ? String(r['RazonSocial']).trim() : null,
        canal: normalizarCanalLocal(r['Tipo_Negocio']),
        vendedor_actual: r['Vendedor'] ? String(r['Vendedor']).trim() : null,
        ultima_venta: ultimaVenta,
        email: r['Email'] ? String(r['Email']).trim() : null,
        fono: r['Fono'] ? String(r['Fono']).trim() : null,
        region: r['Region'] ? String(r['Region']).trim() : null,
        direccion: r['Direccion'] ? String(r['Direccion']).trim() : null,
        ciudad: r['Ciudad'] ? String(r['Ciudad']).trim() : null,
        sucursal: r['Negocio'] ? String(r['Negocio']).trim() : null,
      });
    } else {
      const ex = mapa.get(rut);
      if (ultimaVenta && (!ex.ultima_venta || ultimaVenta > ex.ultima_venta)) {
        ex.ultima_venta = ultimaVenta;
        if (r['Vendedor']) ex.vendedor_actual = String(r['Vendedor']).trim();
      }
    }
  }
  return { data: [...mapa.values()], omitidas };
}

function transformarVentas(rows) {
  const MESES_ORDER = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const porMes = {};
  const porCanal = {};
  const porVendedor = {};
  const porFamilia = {};
  const docsUnicos = new Set();
  let totalPxQ = 0;
  for (const r of rows) {
    const pxq = parseNum(r['PxQ'], 0);
    const canal = String(r['Tipo_Negocio'] || '').trim().toUpperCase();
    const vendedor = String(r['Vendedor'] || '').trim();
    const familia = String(r['Familia'] || '').trim();
    const mes = String(r['Mes'] || '').trim().toLowerCase();
    const doc = r['NroDocumento'] ? String(r['NroDocumento']) : null;
    totalPxQ += pxq;
    if (doc && !docsUnicos.has(doc)) docsUnicos.add(doc);
    if (!porMes[mes]) porMes[mes] = { PxQ: 0, documentos: 0 };
    porMes[mes].PxQ += pxq;
    if (doc) porMes[mes].documentos++;
    if (!porCanal[canal]) porCanal[canal] = { PxQ: 0, clientes: new Set() };
    porCanal[canal].PxQ += pxq;
    if (r['Rut'] && String(r['Rut']) !== '3') porCanal[canal].clientes.add(String(r['Rut']));
    if (vendedor) {
      if (!porVendedor[vendedor]) porVendedor[vendedor] = { PxQ: 0, documentos: 0 };
      porVendedor[vendedor].PxQ += pxq;
      if (doc) porVendedor[vendedor].documentos++;
    }
    if (familia) porFamilia[familia] = (porFamilia[familia] || 0) + pxq;
  }
  const por_mes = {};
  MESES_ORDER.forEach(m => { if (porMes[m]) por_mes[m] = { PxQ: Math.round(porMes[m].PxQ), documentos: porMes[m].documentos }; });
  const por_canal = {};
  for (const [k, v] of Object.entries(porCanal)) por_canal[k] = { PxQ: Math.round(v.PxQ), clientes: v.clientes.size };
  const por_vendedor = {};
  for (const [k, v] of Object.entries(porVendedor)) por_vendedor[k] = { PxQ: Math.round(v.PxQ), documentos: v.documentos };
  const por_familia = Object.entries(porFamilia).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([familia, PxQ], i) => ({ familia, PxQ: Math.round(PxQ), rank: i + 1 }));
  const data = {
    periodo: new Date().getFullYear().toString(),
    generado_en: new Date().toISOString(),
    por_mes,
    por_canal,
    por_vendedor,
    por_familia,
    total_PxQ: Math.round(totalPxQ),
    total_documentos: docsUnicos.size,
  };
  return { data, omitidas: 0 };
}

function transformarEquipos(rows) {
  const hasCanal = rows.some(r => r['Canal'] != null);
  if (!hasCanal) return { data: null, omitidas: rows.length };

  const equipos = { canales: {}, ejecutivos: { ecommerce: [], mayorista: [] }, pipeline_estados: [], asignacion: {} };
  for (const r of rows) {
    const canal = r['Canal'] ? String(r['Canal']).trim() : null;
    if (!canal) continue;
    const correo = r['Correo'] ? String(r['Correo']).trim() : null;
    const fono = r['Fono Empresa'] ? String(r['Fono Empresa']).trim() : null;
    const cartera = r['Cartera'] ? String(r['Cartera']).split(';').map(s => s.trim()) : [];
    const tipo = canal.toLowerCase().includes('ecommerce') ? 'ecommerce' : 'mayorista';
    if (correo) {
      equipos.ejecutivos[tipo].push({ nombre: canal, email: correo, fono: fono || '', cartera });
    }
  }
  return { data: equipos, omitidas: 0 };
}

router.get('/meta', requireAuth, requireAdmin, (req, res) => {
  return res.json(leerMeta());
});

router.post('/subir', requireAuth, requireAdmin, upload.single('archivo'), (req, res, next) => {
  try {
    const file = req.file;
    const tipo = (req.body.tipo || '').trim();

    if (!file) return res.status(400).json({ error: 'Sin archivo', message: 'Se requiere un archivo.' });
    if (!['catalogo', 'pedidos', 'clientes', 'ventas', 'equipos'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido', message: 'tipo debe ser catalogo, pedidos, clientes, ventas o equipos.' });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.csv', '.xlsx'].includes(ext)) {
      return res.status(400).json({ error: 'Formato inválido', message: 'Solo se aceptan archivos .csv y .xlsx.' });
    }

    const rows = parsearArchivo(file.buffer, ext);
    const meta = leerMeta();
    const ahora = new Date().toISOString();

    if (tipo === 'catalogo') {
      const { data, omitidas } = transformarCatalogo(rows);
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'catalogo.json'), JSON.stringify(data, null, 2));
      meta.catalogo = { ultima_carga: ahora, total: data.length };
      guardarMeta(meta);
      return res.json({ ok: true, tipo, filas_procesadas: data.length, filas_omitidas: omitidas, mensaje: `${data.length} SKUs cargados.` });
    }

    if (tipo === 'pedidos') {
      const { data, omitidas } = transformarPedidos(rows);
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'notas-pedido.json'), JSON.stringify(data, null, 2));
      meta.pedidos = { ultima_carga: ahora, total: data.length };
      guardarMeta(meta);
      return res.json({ ok: true, tipo, filas_procesadas: data.length, filas_omitidas: omitidas, mensaje: `${data.length} NVs cargadas.` });
    }

    if (tipo === 'clientes') {
      const { data, omitidas } = transformarClientes(rows);
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'clientes.json'), JSON.stringify(data, null, 2));
      meta.clientes = { ultima_carga: ahora, total: data.length };
      guardarMeta(meta);
      return res.json({ ok: true, tipo, filas_procesadas: data.length, filas_omitidas: omitidas, mensaje: `${data.length} clientes cargados.` });
    }

    if (tipo === 'ventas') {
      const { data } = transformarVentas(rows);
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'ventas-resumen.json'), JSON.stringify(data, null, 2));
      meta.ventas = { ultima_carga: ahora, total_documentos: data.total_documentos, total_PxQ: data.total_PxQ };
      guardarMeta(meta);
      return res.json({ ok: true, tipo, filas_procesadas: rows.length, filas_omitidas: 0, mensaje: `Ventas compiladas: ${data.total_documentos} documentos.` });
    }

    if (tipo === 'equipos') {
      const { data, omitidas } = transformarEquipos(rows);
      if (!data) {
        return res.json({ ok: false, tipo, filas_procesadas: 0, filas_omitidas: omitidas, mensaje: 'Formato de equipos no reconocido. Usar el template.' });
      }
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'equipos.json'), JSON.stringify(data, null, 2));
      meta.equipos = { ultima_carga: ahora, configurado: true };
      guardarMeta(meta);
      return res.json({ ok: true, tipo, filas_procesadas: rows.length, filas_omitidas: omitidas, mensaje: 'Equipos cargados.' });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/estado', requireAuth, (req, res) => {
  return res.json(leerMeta());
});

router.post('/csv', requireAuth, express.text({ type: 'text/csv', limit: '10mb' }), async (req, res, next) => {
  try {
    let tipo, contenido;
    if (typeof req.body === 'string') {
      contenido = req.body;
      tipo = (req.query.tipo || '').trim();
    } else if (req.body && typeof req.body === 'object') {
      tipo = (req.body.tipo || '').trim();
      let raw = req.body.contenido || '';
      if (raw && !/[\r\n,]/.test(raw.substring(0, 200))) {
        try {
          const decoded = Buffer.from(raw, 'base64').toString('utf8');
          if (decoded.includes(',') || decoded.includes('\n')) raw = decoded;
        } catch (_) {}
      }
      contenido = raw;
    } else {
      return res.status(400).json({ error: 'Datos inválidos', message: 'Envíe el CSV como text/csv o JSON con { tipo, contenido }.' });
    }
    if (!tipo || !contenido) return res.status(400).json({ error: 'Datos incompletos', message: 'tipo y contenido son requeridos.' });

    const rows = parsearArchivo(Buffer.from(contenido), '.csv');
    const meta = leerMeta();
    const ahora = new Date().toISOString();

    if (tipo === 'catalogo') {
      const { data, omitidas } = transformarCatalogo(rows);
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'catalogo.json'), JSON.stringify(data, null, 2));
      meta.catalogo = { ultima_carga: ahora, total: data.length };
      guardarMeta(meta);
      return res.status(201).json({ tipo, filas: data.length, omitidas, modo: 'replace' });
    }
    if (tipo === 'pedidos') {
      const { data, omitidas } = transformarPedidos(rows);
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'notas-pedido.json'), JSON.stringify(data, null, 2));
      meta.pedidos = { ultima_carga: ahora, total: data.length };
      guardarMeta(meta);
      return res.status(201).json({ tipo, filas: data.length, omitidas, modo: 'replace' });
    }
    if (tipo === 'clientes') {
      const { data, omitidas } = transformarClientes(rows);
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'clientes.json'), JSON.stringify(data, null, 2));
      meta.clientes = { ultima_carga: ahora, total: data.length };
      guardarMeta(meta);
      return res.status(201).json({ tipo, filas: data.length, omitidas, modo: 'replace' });
    }
    if (tipo === 'ventas') {
      const { data } = transformarVentas(rows);
      fs.writeFileSync(path.join(DATA_CRUZEIRO, 'ventas-resumen.json'), JSON.stringify(data, null, 2));
      meta.ventas = { ultima_carga: ahora, total_documentos: data.total_documentos, total_PxQ: data.total_PxQ };
      guardarMeta(meta);
      return res.status(201).json({ tipo, filas: rows.length, omitidas: 0, modo: 'replace' });
    }
    return res.status(400).json({ error: 'Tipo no soportado por /csv', message: 'Use /subir para este tipo.' });
  } catch (err) {
    next(err);
  }
});

router.post('/sync-repo', requireAuth, (_req, res) => {
  return res.json({ sincronizado: false, mensaje: 'Conector externo no configurado' });
});

module.exports = router;
