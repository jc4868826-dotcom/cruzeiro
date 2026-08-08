'use strict';
const path = require('path');
const xlsx = require('xlsx');

const MAESTRA_FILE = process.env.MAESTRA_FILE || 'Maestra_Orleans.xlsx';
const WEB_FILE     = process.env.WEB_FILE     || 'web.xlsx';
const VENTAS_FILE  = process.env.VENTAS_FILE  || '20260709 Ventas 2026.xlsx';
const PEDIDOS_FILE = process.env.PEDIDOS_FILE || 'Estado Notas Pedido.xlsx';
const INPUTS_FILE  = process.env.INPUTS_FILE  || 'Inputs BOT-CRM.xlsx';

function loadMaestra(excelDir) {
  const wb = xlsx.readFile(path.join(excelDir, MAESTRA_FILE));
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: null });
  const map = new Map();
  for (const r of rows) {
    const row = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), v]));
    const sku = String(row['Codigo'] || '').trim();
    if (!sku) continue;
    map.set(sku, {
      descripcion:  row['descripcion']    || '',
      unidad:       row['unidad']         || 'C/U',
      stock:        row['Saldo']        != null ? Number(row['Saldo'])        : null,
      precioVenta:  row['Precio Venta'] != null ? Number(row['Precio Venta']) : null,
      familia:      row['Familia']        || '',
      padreFamilia: row['Padre_familia']  || '',
    });
  }
  return map;
}

function loadWeb(excelDir) {
  const wb = xlsx.readFile(path.join(excelDir, WEB_FILE));
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['web'], { defval: null });
  return rows
    .filter(r => r['SKU'])
    .map(r => ({
      sku:              String(r['SKU']).trim(),
      nombreWeb:        r['Nombre Web']        || '',
      descripcionCorta: r['Descripción Corta'] || '',
      precio:           r['Precio (CLP)'] != null ? Number(r['Precio (CLP)']) : null,
      categoria:        r['Categoría']    || '',
      subcategoria:     r['Subcategoría'] || '',
      urlImagen:        r['URL Imagen']   || '',
    }));
}

function buildCatalogo(maestraMap, webArray) {
  return webArray.map(item => {
    const h1    = maestraMap.get(item.sku) || {};
    const precio_web       = item.precio != null && item.precio > 1 ? item.precio : null;
    const precio_mayorista = h1.precioVenta != null && h1.precioVenta > 1 ? h1.precioVenta : null;

    return {
      sku:                  item.sku,
      nombre_web:           item.nombreWeb,
      descripcion:          item.descripcionCorta,
      precio_web,
      precio_mayorista,
      precio:               precio_web,        // ← default para no romper nada existente
      precio_lista:         precio_mayorista,
      categoria:            item.categoria,
      subcategoria:         item.subcategoria,
      imagen_url:           item.urlImagen,
      familia:              h1.familia      || '',
      padre_familia:        h1.padreFamilia || '',
      unidad:               h1.unidad       || 'C/U',
      stock:                h1.stock !== undefined ? h1.stock : null,
      tiene_stock:          (h1.stock === null || h1.stock === undefined || h1.stock > 0),
      atributos:            '',
      conocimiento_tecnico: '',
    };
  });
}

function excelDateToISO(serial) {
  if (typeof serial !== 'number') return null;
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0];
}

function loadVentas(excelDir) {
  const wb = xlsx.readFile(path.join(excelDir, VENTAS_FILE));
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: null });

  const groups = new Map();
  for (const r of rows) {
    const rutDigits = String(r.Rut || '').replace(/[^0-9]/g, '');
    if (!rutDigits) continue;
    if (!groups.has(rutDigits)) groups.set(rutDigits, []);
    groups.get(rutDigits).push(r);
  }

  const result = new Map();
  for (const [rutDigits, grupo] of groups) {
    const sorted = [...grupo].sort((a, b) => {
      const av = typeof a.ultima_venta === 'number' ? a.ultima_venta : -Infinity;
      const bv = typeof b.ultima_venta === 'number' ? b.ultima_venta : -Infinity;
      return bv - av;
    });
    const filaReciente = sorted[0];

    const porFecha = [...grupo].sort((a, b) => {
      const af = typeof a.FechaEmision === 'number' ? a.FechaEmision : -Infinity;
      const bf = typeof b.FechaEmision === 'number' ? b.FechaEmision : -Infinity;
      return bf - af;
    });
    const ultimos_productos = [];
    for (const r of porFecha) {
      const cod = String(r.CODIGO || '').trim();
      if (cod && !ultimos_productos.includes(cod)) {
        ultimos_productos.push(cod);
        if (ultimos_productos.length >= 5) break;
      }
    }

    result.set(rutDigits, {
      rut:             rutDigits,
      dv:              String(filaReciente.Digito    || '').trim(),
      nombre:          filaReciente.RazonSocial      || '',
      vendedor_actual: filaReciente.Vendedor         || '',
      direccion:       filaReciente.Direccion        || '',
      ciudad:          filaReciente.Ciudad           || '',
      comuna:          filaReciente.Comuna           || '',
      fono:            String(filaReciente.Fono      || ''),
      email:           filaReciente.Email            || '',
      celular:         String(filaReciente.Celular   || ''),
      ultima_venta:    excelDateToISO(filaReciente.ultima_venta),
      ultimos_productos,
    });
  }
  return result;
}

function loadPedidos(excelDir) {
  const wb = xlsx.readFile(path.join(excelDir, PEDIDOS_FILE));
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: null });
  return rows.map(r => ({
    nv:              r.Nota_Venta,
    estado:          r.status_pedido     || '',
    rut:             String(r.Rut || '').replace(/[^0-9]/g, ''),
    razon_social:    r.RazonSocial       || '',
    vendedor:        r.Vendedor          || '',
    fecha_entrega:   r['Fecha Entrega']  || null,
    orden_compra:    r.ordencompra       || '',
    tipo_transporte: r.tipotransporte    || '',
    transporte:      r.transporte        || '',
    direccion:       r.direcciondespacho || '',
    comuna:          r.Comuna            || '',
  }));
}

function loadInputs(excelDir) {
  const wb = xlsx.readFile(path.join(excelDir, INPUTS_FILE));
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Inputs'], { header: 1, defval: null });
  return [
    { username: 'marcelis.arguelles',  nombre: 'Marcelis Arguelles',  email: rows[9]?.[1],  fono: rows[9]?.[2],  rol: 'ecommerce' },
    { username: 'mauricio.santibanez', nombre: 'Mauricio Santibañez', email: rows[10]?.[1], fono: rows[10]?.[2], rol: 'ecommerce' },
    { username: 'jaime.cornejo',       nombre: 'Jaime Cornejo',       email: rows[13]?.[1], fono: rows[13]?.[2], rol: 'jefe_ecommerce' },
    { username: 'irma.jara',           nombre: 'Irma Jara',           email: rows[16]?.[1], fono: rows[16]?.[2], rol: 'mayorista' },
    { username: 'marcos.diamond',      nombre: 'Marcos Diamond',      email: rows[17]?.[1], fono: rows[17]?.[2], rol: 'mayorista' },
    { username: 'nicolas.pacheco',     nombre: 'Nicolás Pacheco',     email: rows[18]?.[1], fono: rows[18]?.[2], rol: 'mayorista' },
    { username: 'alejandro.oxman',     nombre: 'Alejandro Oxman',     email: rows[19]?.[1], fono: rows[19]?.[2], rol: 'mayorista' },
    { username: 'cynthia.romo',        nombre: 'Cynthia Romo',        email: rows[20]?.[1], fono: rows[20]?.[2], rol: 'jefe_mayorista' },
  ];
}

function loadVentasRaw(excelDir) {
  try {
    const wb = xlsx.readFile(path.join(excelDir, VENTAS_FILE));
    const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: null });
    return rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), v])));
  } catch {
    return [];
  }
}

function loadUsos(excelDir) {
  try {
    const wb = xlsx.readFile(path.join(excelDir, 'Usos_Especificaciones.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const filas = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    const usos = [];
    let familiaActual = null;
    let textosActuales = [];

    for (const fila of filas) {
      if (fila[0] != null) {
        if (familiaActual) {
          usos.push({
            categoria: familiaActual,
            conocimiento: textosActuales.join(' ').replace(/\s+/g, ' ').trim(),
          });
        }
        familiaActual = String(fila[0]).trim().replace(/\n/g, ' ');
        textosActuales = [];
      }
      for (let i = 1; i < fila.length; i++) {
        if (fila[i] != null) textosActuales.push(String(fila[i]).trim().replace(/\n/g, ' '));
      }
    }
    if (familiaActual) {
      usos.push({
        categoria: familiaActual,
        conocimiento: textosActuales.join(' ').replace(/\s+/g, ' ').trim(),
      });
    }
    return usos;
  } catch {
    return [];
  }
}

module.exports = { loadMaestra, loadWeb, buildCatalogo, excelDateToISO, loadVentas, loadVentasRaw, loadPedidos, loadInputs, loadUsos };
