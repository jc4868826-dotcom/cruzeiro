'use strict';
const dataStore = require('../data/dataStore');

// ─── Sinónimos de búsqueda ───────────────────────────────────────────────────
const SINONIMOS_BUSQUEDA = {
  'basurero':  'contenedor basura',
  'basureros': 'contenedor basura',
  'tacho':     'contenedor basura',
  'tachos':    'contenedor basura',
  'papelero':  'contenedor basura',
  'papeleros': 'contenedor basura',
  'zocalo':    'perfil zocalo',
  'zocalos':   'perfil zocalo',
  'tapete':    'alfombra piso',
  'tapetes':   'alfombra piso',
  'caucho':    'goma',
  'cauchos':   'goma',
  'cinta':     'banda transportadora',
  'sello':     'perfil sellante',
  'sellos':    'perfil sellante',
};

function _aplicarSinonimos(query) {
  return query.toLowerCase().split(/\s+/).map(token =>
    SINONIMOS_BUSQUEDA[token] || token
  ).join(' ');
}

// ─── Búsquedas ────────────────────────────────────────────────────────────────

const MESES_ES = { ene:1, jan:1, feb:2, mar:3, abr:4, apr:4, may:5, jun:6, jul:7, ago:8, aug:8, sep:9, oct:10, nov:11, dic:12, dec:12 };

function _parseFechaEmision(str) {
  if (!str) return null;
  const parts = String(str).trim().toLowerCase().split('-');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const mes = MESES_ES[m];
  if (!mes) return null;
  const anio = parseInt(y) + (parseInt(y) < 100 ? 2000 : 0);
  return new Date(anio, mes - 1, parseInt(d));
}

function _calcularEsMayoristaActivo(rutDigitos) {
  const ventasFtp = dataStore.getVentasFTPRaw();
  const fuente = ventasFtp.length ? ventasFtp : dataStore.getVentasRaw();
  const limite = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  return fuente.some(v => {
    const rutV = String(v.rut || v.Rut || '').replace(/\D/g, '');
    if (rutV !== rutDigitos) return false;
    const fecha = _parseFechaEmision(v.fechaEmision || v.FechaEmision);
    return fecha && fecha >= limite;
  });
}

function buscarClientePorRut(inputRut) {
  const soloDigitos = String(inputRut).replace(/[^0-9]/g, '');

  // 1. Buscar en ventasMap (Excel)
  const map = dataStore.getVentasMap();
  let cliente = null;
  if (map.has(soloDigitos)) {
    cliente = map.get(soloDigitos);
  } else {
    for (const [k, v] of map) {
      if (soloDigitos.startsWith(k) || k.startsWith(soloDigitos)) { cliente = v; break; }
    }
  }

  // 2. Si no encontrado, buscar en FTP clientes
  if (!cliente) {
    const ftpMap = dataStore.getClientesFTP();
    if (ftpMap.has(soloDigitos)) {
      cliente = ftpMap.get(soloDigitos);
    } else {
      for (const [k, v] of ftpMap) {
        if (soloDigitos.startsWith(k) || k.startsWith(soloDigitos)) { cliente = v; break; }
      }
    }
  }

  if (!cliente) return null;

  // 3. Calcular esMayoristaActivo
  const esMayoristaActivo = _calcularEsMayoristaActivo(soloDigitos);
  return { ...cliente, esMayoristaActivo };
}

function buscarCotizacionesPorRut(rutInput) {
  const soloDigitos = String(rutInput).replace(/[^0-9]/g, '');
  if (!soloDigitos) return [];
  return dataStore.getCotizacionesFTP()
    .filter(c => {
      const rutC = String(c.rut).replace(/[^0-9]/g, '');
      return soloDigitos === rutC || soloDigitos.startsWith(rutC) || rutC.startsWith(soloDigitos);
    })
    .sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));
}

function buscarEjecutivo(username) {
  return dataStore.getEjecutivos().find(e => e.username === username) || null;
}

function buscarPedidosPorRut(rutInput) {
  const soloDigitos = String(rutInput).replace(/[^0-9]/g, '');
  return dataStore.getPedidos().filter(p => {
    const rutP = String(p.rut).replace(/[^0-9]/g, '');
    return soloDigitos === rutP || soloDigitos.startsWith(rutP) || rutP.startsWith(soloDigitos);
  });
}

function getTodosCatalogo()      { return dataStore.getCatalogo(); }
function cargarTodosEjecutivos() { return dataStore.getEjecutivos(); }
function cargarClientes()        { return [...dataStore.getVentasMap().values()]; }
function cargarPedidos()         { return dataStore.getPedidos(); }

// ─── Mapa vendedor → username ejecutivo ──────────────────────────────────────

const MAPA_EJECUTIVOS = {
  // ── Cartera Nicolás Pacheco ──────────────────────────────────────────────
  'NICOLAS PACHECO':              'nicolas.pacheco',
  'NICOLÁS PACHECO':              'nicolas.pacheco',
  'MARIA JOSE UTCHES':            'nicolas.pacheco',
  'MARÍA JOSE UTCHES':            'nicolas.pacheco',
  'ALEJANDRO PARRA':              'nicolas.pacheco',

  // ── Cartera Irma Jara ────────────────────────────────────────────────────
  'IRMA JARA':                    'irma.jara',
  'IRMA JARA (SANTIAGO)':         'irma.jara',
  'JAIME GONZALEZ':               'irma.jara',
  'JAIME GONZÁLEZ':               'irma.jara',

  // ── Cartera Marcos Diamond ───────────────────────────────────────────────
  'MARCOS DIAMOND':               'marcos.diamond',

  // ── Cartera Alejandro Oxman ──────────────────────────────────────────────
  'ALEJANDRO OXMAN':              'alejandro.oxman',

  // ── Cartera Cynthia Romo (jefa mayorista) ────────────────────────────────
  'CYNTHIA ROMO':                 'cynthia.romo',
  'CADENAS':                      'cynthia.romo',
  'CLAUDIA MARTINEZ GALARCE':     'cynthia.romo',
  'CLAUDIA MARTÍNEZ GALARCE':     'cynthia.romo',
  'ANDRES VARELA':                'cynthia.romo',
  'GUSTAVO CARDONA':              'cynthia.romo',
  'GERARDO AGUIRRE':              'cynthia.romo',
  'JOEL MOYA':                    'cynthia.romo',
  'LUIS BUSTOS MENA':             'cynthia.romo',
  'LUIS MUÑOZ':                   'cynthia.romo',

  // ── Jaime Cornejo (ecommerce + locales + canales internos) ───────────────
  'JAIME CORNEJO':                'jaime.cornejo',
  'MARCELO VALENZUELA':           'jaime.cornejo',
  'SOPORTE WEB':                  'jaime.cornejo',
  'TIENDA ONLINE':                'jaime.cornejo',
  'VENTA MESON':                  'jaime.cornejo',
  'VENTA MESÓN':                  'jaime.cornejo',
  'VENTAS OFICINA':               'jaime.cornejo',
  'VENTASSANTIAGO':               'jaime.cornejo',
  'VENTA A LOCAL PORTUGAL 696':   'jaime.cornejo',
  'VENTA A LOCAL QUILICURA':      'jaime.cornejo',
  'VENTA A LOCAL RONDIZZONI':     'jaime.cornejo',
};

function resolverEjecutivo(vendedor) {
  if (!vendedor) return null;
  const norm = String(vendedor).trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [k, u] of Object.entries(MAPA_EJECUTIVOS)) {
    const kn = k.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (norm === kn) return u;
  }
  return null;
}

// ─── Clasificación por RUT: dos búsquedas FTP ────────────────────────────────
// Retorna { canal, tipo, cliente, razonSocial, ejecutivo }
// tipo: 'nuevo' (no en Clientes.csv) | 'inactivo' (sin ventas 180d) | 'activo' (tiene ventas)

function clasificarPorRut(rutRaw) {
  const rutDigitos = String(rutRaw).replace(/\D/g, '');
  if (!rutDigitos) return { canal: 'ecommerce', tipo: 'nuevo', cliente: null };

  // BÚSQUEDA 1: Clientes.csv (FTP clientesMap)
  const ftpMap = dataStore.getClientesFTP();
  let clienteRaw = null;
  if (ftpMap.has(rutDigitos)) {
    clienteRaw = ftpMap.get(rutDigitos);
  } else {
    for (const [k, v] of ftpMap) {
      if (rutDigitos.startsWith(k) || k.startsWith(rutDigitos)) { clienteRaw = v; break; }
    }
  }
  if (!clienteRaw) return { canal: 'ecommerce', tipo: 'nuevo', cliente: null };

  // BÚSQUEDA 2: Ventas_OR.csv — últimos 180 días
  const fuente = dataStore.getVentasFTPRaw().length
    ? dataStore.getVentasFTPRaw()
    : dataStore.getVentasRaw();
  const limite = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const tieneCompraReciente = fuente.some(v => {
    const rutV = String(v.rut || v.Rut || '').replace(/\D/g, '');
    if (rutV !== rutDigitos) return false;
    const fecha = _parseFechaEmision(v.fechaEmision || v.FechaEmision);
    return fecha && fecha >= limite;
  });

  if (tieneCompraReciente) {
    return {
      canal: 'mayorista',
      tipo: 'activo',
      cliente: clienteRaw,
      razonSocial: clienteRaw.razonSocial || '',
      ejecutivo: clienteRaw.vendedor || '',
    };
  }
  return {
    canal: 'ecommerce',
    tipo: 'inactivo',
    cliente: clienteRaw,
    razonSocial: clienteRaw.razonSocial || '',
    ejecutivo: clienteRaw.vendedor || '',
  };
}

// ─── Búsqueda de productos — 3 capas ─────────────────────────────────────────

const _norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function _buscarEnUsos(termino, tokens) {
  const usos = dataStore.getUsos();
  if (!usos.length) return null;
  const termNorm = _norm(termino);

  // 1ª pasada: categoria contiene algún token principal (>4 chars) o match directo
  for (const u of usos) {
    const catNorm = _norm(u.categoria);
    if (!catNorm) continue;
    if (termNorm.includes(catNorm) || catNorm.includes(termNorm)) return u.categoria;
    if (tokens.some(t => t.length > 4 && catNorm.includes(t))) return u.categoria;
  }

  // 2ª pasada: score ponderado (primer token peso 2, resto peso 1)
  let mejorScore = 0;
  let mejorCategoria = null;
  for (const u of usos) {
    const textoNorm = _norm(u.categoria + ' ' + u.conocimiento);
    const tokensMain = tokens.filter(t => t.length > 4);
    if (!tokensMain.length) continue;
    const pesoTotal = tokensMain.reduce((acc, _, i) => acc + (i === 0 ? 2 : 1), 0);
    const hitsConPeso = tokensMain.reduce((acc, t, i) => {
      return acc + (textoNorm.includes(t) ? (i === 0 ? 2 : 1) : 0);
    }, 0);
    const score = hitsConPeso / pesoTotal;
    if (score >= 0.4 && hitsConPeso > mejorScore) {
      mejorScore = hitsConPeso;
      mejorCategoria = u.categoria;
    }
  }
  return mejorCategoria;
}

function _buscarPorFamilia(familia, canal) {
  if (!familia) return [];
  const famNorm = _norm(familia);

  if (canal === 'mayorista') {
    return dataStore.getCatalogo()
      .filter(p => {
        if (!p.precio_mayorista || p.precio_mayorista <= 1) return false;
        return [p.subcategoria, p.familia, p.padre_familia, p.categoria]
          .some(f => { const fn = _norm(f); return fn && (fn.includes(famNorm) || famNorm.includes(fn)); });
      }).slice(0, 10);
  }

  // Ecommerce: solo web.xlsx (camelCase por loaders.js)
  return dataStore.getWebProductos()
    .filter(p => {
      const precio = Number(p.precio || 0);
      if (precio <= 1) return false;
      return [p.subcategoria || '', p.categoria || '', p.nombreWeb || ''].some(f => {
        const fn = _norm(f); return fn && (fn.includes(famNorm) || famNorm.includes(fn));
      });
    }).slice(0, 10)
    .map(p => ({
      sku:              p.sku || '',
      nombre_web:       p.nombreWeb || '',
      descripcion:      p.nombreWeb || '',
      precio:           Number(p.precio || 0),
      precio_web:       Number(p.precio || 0),
      precio_mayorista: 0,
      subcategoria:     p.subcategoria || '',
      familia:          p.subcategoria || '',
      categoria:        p.categoria || '',
      unidad:           'C/U',
      stock:            null,
      imagen:           p.urlImagen || '',
    }));
}

function _buscarTextoLibre(tokens, fuente, canal) {
  const items = fuente === 'web'
    ? dataStore.getWebProductos()
    : dataStore.getMaestraProductos();

  const scored = items
    .map(p => {
      const texto = [
        p.subcategoria || '',
        p.categoria    || '',
        p.nombreWeb    || p.descripcion || '',
        p.descripcionCorta || '',
      ].join(' ');
      const score = tokens.filter(t => _norm(texto).includes(t)).length;
      return { ...p, _score: score };
    })
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);

  if (!scored.length) return [];

  if (fuente === 'web') {
    return scored
      .filter(p => Number(p.precio || 0) > 1)
      .map(p => ({
        sku:              p.sku || '',
        nombre_web:       p.nombreWeb || '',
        descripcion:      p.nombreWeb || '',
        precio:           Number(p.precio || 0),
        precio_web:       Number(p.precio || 0),
        precio_mayorista: 0,
        subcategoria:     p.subcategoria || '',
        familia:          p.subcategoria || '',
        categoria:        p.categoria || '',
        unidad:           'C/U',
        stock:            null,
        imagen:           p.urlImagen || '',
      }));
  }

  // Mayorista: Maestra directamente (camelCase por loaders.js)
  return scored
    .filter(p => Number(p.precioVenta || 0) > 1)
    .map(p => ({
      sku:              p.sku || '',
      nombre_web:       p.descripcion || '',
      descripcion:      p.descripcion || '',
      precio:           Number(p.precioVenta || 0),
      precio_web:       0,
      precio_mayorista: Number(p.precioVenta || 0),
      subcategoria:     p.familia || '',
      familia:          p.familia || '',
      categoria:        p.padreFamilia || '',
      unidad:           p.unidad || 'C/U',
      stock:            null,
    }));
}

function buscarProductos(termino, canal, opciones = {}) {
  const queryNormalizada = _aplicarSinonimos(termino);
  const tokens = _norm(queryNormalizada).split(/\s+/).filter(t => t.length > 3);
  if (!tokens.length) return { resultados: [], capa: 0 };

  const fuente = canal === 'mayorista' ? 'maestra' : 'web';

  // CAPA 1: Usos_Especificaciones → familia → archivo correcto según canal
  const familia = _buscarEnUsos(queryNormalizada, tokens);
  if (familia) {
    const resultados = _buscarPorFamilia(familia, canal);
    if (resultados.length > 0) return { resultados, capa: 1, familia };
  }

  // CAPA 2: texto libre en el archivo correcto según canal
  const resultados2 = _buscarTextoLibre(tokens, fuente, canal);
  if (resultados2.length > 0) return { resultados: resultados2, capa: 2 };

  return { resultados: [], capa: 0 };
}

module.exports = {
  buscarClientePorRut,
  buscarCotizacionesPorRut,
  buscarEjecutivo,
  buscarPedidosPorRut,
  resolverEjecutivo,
  clasificarPorRut,
  buscarProductos,
  getTodosCatalogo,
  cargarTodosEjecutivos,
  cargarClientes,
  cargarPedidos,
};
