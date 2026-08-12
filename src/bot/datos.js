'use strict';
const dataStore = require('../data/dataStore');

// ─── Sinónimos de búsqueda ───────────────────────────────────────────────────
const SINONIMOS_BUSQUEDA = {
  // Basureros
  'basurero':            'contenedor basura',
  'basureros':           'contenedor basura',
  'tacho':               'contenedor basura',
  'tachos':              'contenedor basura',
  'papelero':            'contenedor basura papelero',
  'papeleros':           'contenedor basura papelero',
  'cubo basura':         'contenedor basura',
  // Bolsas
  'bolsa basura':        'bolsa basura negra',
  'bolsas basura':       'bolsa basura negra',
  'bolsa residuos':      'bolsa basura negra',
  // Mangueras
  'manguera':            'manguera riego jardin',
  'mangueras':           'manguera riego jardin',
  'manguera riego':      'manguera riego jardin',
  'manguera agua':       'manguera riego jardin',
  // Pisos
  'caucho':              'piso goma',
  'cauchos':             'piso goma',
  'tapete':              'alfombra piso nomad',
  'tapetes':             'alfombra piso nomad',
  'felpudo':             'alfombra entrada',
  'peldano':             'grada escalera',
  'escalon':             'grada escalera',
  'pastelón':            'pastelón goma',
  'pastelon':            'pastelón goma',
  // Adhesivos
  'pegamento':           'adhesivo',
  'cola fria':           'adhesivo',
  'agorex':              'adhesivo',
  'gobusa':              'adhesivo gobusa',
  // Seguridad vial
  'lomo toro':           'lomo toro rampa',
  'lomillo':             'lomo toro rampa',
  'tacha':               'tacha reflectante',
  'tachas':              'tacha reflectante',
  'cono':                'cono seguridad vial',
  'conos':               'cono seguridad vial',
  // Perfiles
  'zocalo':              'perfil zocalo rodón',
  'zocalos':             'perfil zocalo rodón',
  'rodon':               'rodón perfil',
  'rodón':               'rodón perfil',
  // Limpieza
  'escoba':              'trapero mopa limpieza',
  'trapero':             'trapero mopa piso',
  'detergente':          'detergente limpieza ropa',
  'cloro':               'cloro desinfectante',
  'desengrasante':       'desengrasante limpieza',
  // Zapatillas/seguridad
  'zapatilla seguridad': 'zapato seguridad industrial',
  'zapato seguridad':    'zapato seguridad industrial',
  'bota seguridad':      'bota seguridad industrial',
  // Organización
  'organizador':         'caja organizadora',
  'cajas':               'caja organizadora almacenamiento',
};

function _aplicarSinonimos(query) {
  let q = query.toLowerCase().trim();
  // Aplicar frases largas primero para evitar solapamiento
  const entradas = Object.entries(SINONIMOS_BUSQUEDA)
    .sort((a, b) => b[0].split(' ').length - a[0].split(' ').length || b[0].length - a[0].length);
  for (const [k, v] of entradas) {
    const re = new RegExp('(^|\\s)' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'g');
    q = q.replace(re, `$1${v}`);
  }
  // Deduplicar tokens resultantes (evita expansión doble)
  const seen = new Set();
  return q.trim().split(/\s+/).filter(t => t && !seen.has(t) && seen.add(t)).join(' ');
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

// ─── Mapa ejecutivos canónico (retorna objeto con contacto completo) ─────────

const EJECUTIVOS_MAP = {
  'IRMA JARA':       { nombre: 'Irma Jara',        email: 'i.jara@cruzeirogomas.cl',      telefono: '+56933826837' },
  'MARCOS DIAMOND':  { nombre: 'Marcos Diamond',    email: 'mdiamond@cruzeirogomas.cl',    telefono: '+56975681156' },
  'NICOLAS PACHECO': { nombre: 'Nicolás Pacheco',   email: 'npacheco@cruzeiroempresas.cl', telefono: '+56933826837' },
  'ALEJANDRO OXMAN': { nombre: 'Alejandro Oxman',   email: 'aoxman@cruzeiroempresas.cl',   telefono: '+56932327146' },
  // Aliases cartera ex-ejecutivos → Nicolás Pacheco
  'ALEJANDRO PARRA':   { nombre: 'Nicolás Pacheco', email: 'npacheco@cruzeiroempresas.cl', telefono: '+56933826837' },
  'MARIA JOSE UTCHES': { nombre: 'Nicolás Pacheco', email: 'npacheco@cruzeiroempresas.cl', telefono: '+56933826837' },
  // Alias cartera → Cynthia Romo
  'CLAUDIA MARTINEZ':  { nombre: 'Cynthia Romo',    email: 'cromos@cruzeiroempresas.cl',   telefono: '+56932327135' },
  '__DEFAULT__':       { nombre: 'Cynthia Romo',    email: 'cromos@cruzeiroempresas.cl',   telefono: '+56932327135' },
};

function resolverEjecutivoObj(vendedorRaw) {
  if (!vendedorRaw) return EJECUTIVOS_MAP['__DEFAULT__'];
  const norm = String(vendedorRaw)
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();
  for (const [key, val] of Object.entries(EJECUTIVOS_MAP)) {
    if (key === '__DEFAULT__') continue;
    if (norm.includes(key)) return val;
  }
  return EJECUTIVOS_MAP['__DEFAULT__'];
}

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
  'CLAUDIA MARTINEZ':             'cynthia.romo',
  'CLAUDIA MARTÍNEZ':             'cynthia.romo',
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

// ─── Parser de fechas para Estado_Notas_Pedido ───────────────────────────────

function _parseFechaNV(str) {
  if (!str) return null;
  const s = String(str).trim();
  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD-MM-YYYY o DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  // Fallback: formato dd-mon-yy (mismo que Ventas_OR)
  return _parseFechaEmision(s);
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

  // BÚSQUEDA 2: Estado_Notas_Pedido (FTP) — últimos 180 días
  // Si no está disponible, fallback a Ventas_OR.csv
  const limite = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const estadoPedidos = dataStore.getEstadoPedidos();
  let tieneCompraReciente = false;
  let vendedorReciente = clienteRaw.vendedor || '';

  if (estadoPedidos.length > 0) {
    // Rut en Estado_Notas_Pedido es numérico sin puntos ni guión
    const filasRut = estadoPedidos.filter(p => p.rut === rutDigitos);
    const reciente = filasRut
      .filter(p => { const f = p._fechaNVParsed || _parseFechaNV(p.fechaNV); return f && f >= limite; })
      .sort((a, b) => {
        const fa = a._fechaNVParsed || _parseFechaNV(a.fechaNV) || new Date(0);
        const fb = b._fechaNVParsed || _parseFechaNV(b.fechaNV) || new Date(0);
        return fb - fa;
      });
    if (reciente.length > 0) {
      tieneCompraReciente = true;
      vendedorReciente = reciente[0].vendedor || clienteRaw.vendedor || '';
    }
  } else {
    // Fallback: Ventas_OR.csv
    const fuente = dataStore.getVentasFTPRaw().length
      ? dataStore.getVentasFTPRaw()
      : dataStore.getVentasRaw();
    tieneCompraReciente = fuente.some(v => {
      const rutV = String(v.rut || v.Rut || '').replace(/\D/g, '');
      if (rutV !== rutDigitos) return false;
      const fecha = _parseFechaEmision(v.fechaEmision || v.FechaEmision);
      return fecha && fecha >= limite;
    });
    vendedorReciente = clienteRaw.vendedor || '';
  }

  if (tieneCompraReciente) {
    return {
      canal: 'mayorista',
      tipo: 'activo',
      cliente: clienteRaw,
      razonSocial: clienteRaw.razonSocial || '',
      ejecutivo: vendedorReciente,
    };
  }
  return {
    canal: 'ecommerce',
    tipo: 'inactivo',
    cliente: clienteRaw,
    razonSocial: clienteRaw.razonSocial || '',
    ejecutivo: vendedorReciente,
  };
}

// ─── Búsqueda de pedidos en Estado_Notas_Pedido (FTP) ────────────────────────

function buscarEstadoPedidosPorRut(rutInput) {
  const rutDigitos = String(rutInput).replace(/\D/g, '');
  if (!rutDigitos) return [];
  const estadoPedidos = dataStore.getEstadoPedidos();
  return estadoPedidos
    .filter(p => p.rut === rutDigitos)
    .sort((a, b) => {
      const fa = a._fechaNVParsed || _parseFechaNV(a.fechaNV) || new Date(0);
      const fb = b._fechaNVParsed || _parseFechaNV(b.fechaNV) || new Date(0);
      return fb - fa;
    });
}

// ─── Búsqueda de productos ────────────────────────────────────────────────────

const _norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const STOPWORDS = new Set([
  'de','la','el','los','las','para','con','sin','un','una','en','y','o',
  'por','que','del','al','se','es','no','si','ya','mas','eso','esto',
  'bien','ok','solo','todo','nada','pero','como','muy','me','te','mi',
  'tu','nos','le','lo','su','hay','son','fue','esta','este','hola',
  'gracias','bueno','buena'
]);

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

function buscarProductos(termino, canal, opciones = {}) {
  // PASO 1: Tokenizar con sinónimos y stopwords
  const queryConSinonimos = _aplicarSinonimos(termino);
  const queryNorm = _norm(queryConSinonimos);
  const tokens = queryNorm.split(/\s+/).filter(t => t && t.length >= 3 && !STOPWORDS.has(t));
  if (!tokens.length) return { productos: [], conocimientoTecnico: '', totalEncontrados: 0, query: queryNorm };

  // PASO 2: Buscar directo en el catálogo según canal
  let todos;

  if (canal === 'mayorista') {
    todos = dataStore.getMaestraProductos()
      .map(p => {
        const precio = Number(p.precioVenta || 0);
        if (precio <= 1) return null;
        if (p.stock != null && p.stock === 0) return null;
        const textoNombre = _norm(p.descripcion || '');
        const textoCategoria = _norm((p.padreFamilia || '') + ' ' + (p.familia || ''));
        const hitsNombre = tokens.filter(t => textoNombre.includes(t)).length;
        const hitsCategoria = tokens.filter(t => textoCategoria.includes(t)).length;
        const scorePonderado = (hitsNombre * 3 + hitsCategoria * 2) / (tokens.length * 3);
        if (scorePonderado < 0.15) return null;
        return {
          _score: scorePonderado,
          sku:              p.sku || '',
          nombre_web:       p.descripcion || '',
          descripcion:      p.descripcion || '',
          precio:           precio,
          precio_web:       0,
          precio_mayorista: precio,
          subcategoria:     p.familia || '',
          familia:          p.familia || '',
          categoria:        p.padreFamilia || '',
          unidad:           p.unidad || 'C/U',
          stock:            p.stock != null ? p.stock : null,
        };
      })
      .filter(Boolean);
  } else {
    // Ecommerce: solo web.xlsx
    todos = dataStore.getWebProductos()
      .map(p => {
        const precio = Number(p.precio || 0);
        if (precio <= 1) return null;
        // Expandir abreviaturas conocidas del catálogo ("Mang." → "manguera")
        const nombreExpand = (p.nombreWeb || '').replace(/\bMang\b\.?/gi, 'manguera');
        const textoNombre = _norm(nombreExpand);
        const textoDesc = _norm(p.descripcionCorta || '');
        const textoCategoria = _norm((p.categoria || '') + ' ' + (p.subcategoria || ''));
        const hitsNombre = tokens.filter(t => textoNombre.includes(t)).length;
        const hitsDesc = tokens.filter(t => textoDesc.includes(t)).length;
        const hitsCategoria = tokens.filter(t => textoCategoria.includes(t)).length;
        const scorePonderado = (hitsNombre * 3 + hitsCategoria * 2 + hitsDesc * 1) / (tokens.length * 3);
        if (scorePonderado < 0.15) return null;
        return {
          _score: scorePonderado,
          sku:              p.sku || '',
          nombre_web:       p.nombreWeb || '',
          descripcion:      p.descripcionCorta || p.nombreWeb || '',
          precio:           precio,
          precio_web:       precio,
          precio_mayorista: 0,
          subcategoria:     p.subcategoria || '',
          familia:          p.subcategoria || '',
          categoria:        p.categoria || '',
          unidad:           'C/U',
          stock:            null,
          imagen:           p.urlImagen || '',
        };
      })
      .filter(Boolean);
  }

  // PASO 3: Ordenar por score desc, luego precio asc
  todos.sort((a, b) => b._score - a._score || a.precio - b.precio);

  const totalEncontrados = todos.length;
  const productos = todos.slice(0, 10).map(({ _score, ...rest }) => rest);

  // PASO 4: Enriquecer con Usos_Especificaciones (solo contexto GPT)
  const familiaUso = _buscarEnUsos(queryConSinonimos, tokens);
  let conocimientoTecnico = '';
  if (familiaUso) {
    const uso = dataStore.getUsos().find(u => u.categoria === familiaUso);
    if (uso) conocimientoTecnico = uso.conocimiento || '';
  }

  return { productos, conocimientoTecnico, totalEncontrados, query: queryNorm };
}

module.exports = {
  buscarClientePorRut,
  buscarCotizacionesPorRut,
  buscarEjecutivo,
  buscarPedidosPorRut,
  buscarEstadoPedidosPorRut,
  resolverEjecutivo,
  resolverEjecutivoObj,
  clasificarPorRut,
  buscarProductos,
  getTodosCatalogo,
  cargarTodosEjecutivos,
  cargarClientes,
  cargarPedidos,
};
