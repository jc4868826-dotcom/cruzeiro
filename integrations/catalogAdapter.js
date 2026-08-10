'use strict';

const datos = require('../src/bot/datos');
const dataStore = require('../src/data/dataStore');

const SINONIMOS = {
  'piso goma':        ['Pisos de goma', 'Piso plancha', 'Gradas'],
  'goma rollo':       ['Pisos de goma', 'Piso plancha'],
  'pisos goma':       ['Pisos de goma', 'Piso plancha', 'Gradas'],
  'grada':            ['Gradas'],
  'gradas':           ['Gradas'],
  'gradería':         ['Gradas'],
  'escalera':         ['Gradas', 'Escaleras'],
  'escalon':          ['Gradas'],
  'peldaño':          ['Gradas'],
  'pastelón':         ['Pastelones'],
  'pastelon':         ['Pastelones'],
  'caucho':           ['Pastelones', 'Pisos de goma', 'Piso plancha'],
  'antifatiga':       ['Piso plancha'],
  'pvc':              ['Pisos de PVC'],
  'nomad':            ['Pisos de PVC'],
  'pasto':            ['Pasto sintético'],
  'pasto sintetico':  ['Pasto sintético'],
  'empaquetadura':    ['Empaquetaduras'],
  'correa':           ['Correas'],
  'manguera':         ['Mangueras'],
  'cono':             ['Conos'],
  'tope':             ['Lomos de toro y rampas'],
  'lomo de toro':     ['Lomos de toro y rampas'],
  'rampa':            ['Lomos de toro y rampas'],
  'tacha':            ['Tachas'],
  'cinta demarcatoria': ['Cintas demarcatorias'],
  'perfil':           ['Perfiles', 'Perfiles y cornisas'],
  'rodon':            ['Rodón'],
  'rodón':            ['Rodón'],
  'esponja':          ['Esponjas', 'Esponja'],
  'corredera':        ['Correderas'],
  'adhesivo':         ['Adhesivos'],
  'pegamento':        ['Adhesivos'],
  'cola':             ['Adhesivos'],
  'pega':             ['Adhesivos'],
  'agorex':           ['Adhesivos'],
  'gobusa':           ['Adhesivos'],
  'seguridad vial':   ['Conos', 'Tachas', 'Lomos de toro y rampas', 'Estacionamiento', 'Cintas demarcatorias', 'Hitos'],
  'alfombra':         ['Alfombras'],
  'felpudo':          ['Alfombras'],
  'basurero':         ['Basureros y papeleros'],
  'papelera':         ['Basureros y papeleros'],
  'tacho':            ['Basureros y papeleros'],
  'contenedor':       ['Basureros y papeleros', 'Organización'],
  'contenedor de basura': ['Basureros y papeleros'],
  'cubo de basura':   ['Basureros y papeleros'],
  'industrial':       ['Seguridad industrial', 'Basureros y papeleros'],
  'limpieza':         ['Limpiador', 'Desinfectante', 'Desengrasante', 'Lavaloza', 'Destacados Cleanhaus', 'Traperos piso', 'Mopa y repuesto'],
  'artículos de aseo':['Limpiador', 'Desinfectante', 'Desengrasante', 'Lavaloza', 'Traperos piso', 'Mopa y repuesto', 'Basureros y papeleros'],
  'articulos de aseo':['Limpiador', 'Desinfectante', 'Desengrasante', 'Lavaloza', 'Traperos piso', 'Mopa y repuesto', 'Basureros y papeleros'],
  'productos de aseo':['Limpiador', 'Desinfectante', 'Desengrasante', 'Lavaloza', 'Traperos piso', 'Mopa y repuesto'],
  'escoba':           ['Traperos piso', 'Mopa y repuesto', 'Destacados Cleanhaus'],
  'trapero':          ['Traperos piso', 'Mopa y repuesto'],
  'mopa':             ['Mopa y repuesto'],
  'detergente':       ['Detergentes de ropa', 'Destacados Cleanhaus'],
  'cloro':            ['Cloro', 'Cloro ropa', 'Destacados Cleanhaus'],
  'desengrasante':    ['Desengrasante', 'Destacados Cleanhaus'],
  'desinfectante':    ['Desinfectante', 'Destacados Cleanhaus'],
  'hogar':            ['Organización', 'Menaje', 'Decoración', 'Basureros y papeleros'],
  'artículos para el hogar': ['Organización', 'Menaje', 'Decoración', 'Basureros y papeleros'],
  'articulos para el hogar': ['Organización', 'Menaje', 'Decoración', 'Basureros y papeleros'],
  'bolsa de basura':  ['Bolsa de basura'],
  'bolsas de basura': ['Bolsa de basura'],
  'organización':     ['Organización'],
  'menaje':           ['Menaje'],
  'goma':             ['Pisos de goma', 'Piso plancha', 'Gradas'],
  'pisos':            ['Pisos de goma', 'Pisos de PVC', 'Piso plancha', 'Pastelones', 'Gradas'],
  'piso':             ['Pisos de goma', 'Pisos de PVC', 'Piso plancha', 'Pastelones', 'Gradas'],
  'seguridad':        ['Conos', 'Tachas', 'Lomos de toro y rampas', 'Estacionamiento', 'Cintas demarcatorias'],
  'decoracion':       ['Decoración', 'Alfombras', 'Pasto sintético'],
  'ferreteria':       ['Herramientas', 'Adhesivos', 'Perfiles', 'Rodón'],
};

function normalizar(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function detectarSubcategorias(qNorm) {
  const subcats = new Set();
  for (const [clave, cats] of Object.entries(SINONIMOS)) {
    const claveNorm = normalizar(clave);
    // Word-boundary check: evita que "tope" matchee dentro de "estoperol"
    const re = new RegExp('(?:^|\\s)' + claveNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)');
    if (re.test(qNorm)) {
      for (const c of cats) subcats.add(c);
    }
  }
  return subcats;
}

function aplicarPrecioCanal(p, canal) {
  const precio = canal === 'mayorista'
    ? (p.precio_mayorista || p.precio_web || p.precio)
    : (p.precio_web       || p.precio);
  return { ...p, precio };
}

function buscar(query, canal = 'ecommerce') {
  const catalogo = datos.getTodosCatalogo();
  const q = normalizar(query);
  const tokens = q.split(/\s+/).filter(t => t.length > 2);
  if (!tokens.length) return [];

  const subcatsFromSinonimos = detectarSubcategorias(q);

  const scored = catalogo.map(p => {
    const nombre = normalizar(p.nombre_web);
    const subcat = normalizar(p.subcategoria);
    const cat    = normalizar(p.categoria);
    const desc   = normalizar(p.descripcion);

    let score = 0;
    for (const t of tokens) {
      if (nombre.includes(t)) score += 4;
      if (subcat.includes(t)) score += 3;
      if (cat.includes(t))    score += 2;
      if (desc.includes(t))   score += 1;
    }

    if (subcatsFromSinonimos.size > 0 && subcatsFromSinonimos.has(p.subcategoria)) {
      score += 10;
    }

    return { p, score };
  })
  .filter(x => {
    if (x.score === 0) return false;
    if (x.p.saldo_ftp !== null && x.p.saldo_ftp !== undefined && x.p.saldo_ftp <= 0) return false;
    return true;
  })
  .sort((a, b) => b.score - a.score || (b.p.tiene_stock ? 1 : 0) - (a.p.tiene_stock ? 1 : 0));

  if (!scored.length && subcatsFromSinonimos.size > 0) {
    return buscarPorSubcategorias([...subcatsFromSinonimos], canal);
  }

  return scored.slice(0, 8).map(x => aplicarPrecioCanal(x.p, canal));
}

function buscarConocimiento(query) {
  if (!query || !query.trim()) return [];
  const usos = dataStore.getUsos();
  if (!usos.length) return [];

  const q = normalizar(query);
  const tokens = q.split(/\s+/).filter(t => t.length > 2);
  if (!tokens.length) return [];

  const scored = usos.map(u => {
    const texto = normalizar(u.categoria + ' ' + u.conocimiento);
    const score = tokens.reduce((s, t) => s + (texto.includes(t) ? 1 : 0), 0);
    return { u, score };
  })
  .filter(x => x.score > 0)
  .sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map(x => ({
    familia: x.u.categoria,
    conocimiento: x.u.conocimiento,
  }));
}

function buscarPorSubcategorias(subcategorias, canal = 'ecommerce') {
  const catalogo = datos.getTodosCatalogo();
  const subcatsNorm = subcategorias.map(s => s.toLowerCase().trim());
  return catalogo
    .filter(p =>
      subcatsNorm.includes((p.subcategoria || '').toLowerCase().trim()) &&
      (p.saldo_ftp === null || p.saldo_ftp === undefined || p.saldo_ftp > 0)
    )
    .sort((a, b) => {
      if (b.tiene_stock !== a.tiene_stock) return b.tiene_stock ? 1 : -1;
      return (a.precio || 0) - (b.precio || 0);
    })
    .slice(0, 8)
    .map(p => aplicarPrecioCanal(p, canal));
}

function listarSubcategorias() {
  const catalogo = datos.getTodosCatalogo();
  return [...new Set(catalogo.map(p => p.subcategoria).filter(Boolean))].sort();
}

function obtenerResumenCatalogo() {
  const catalogo = datos.getTodosCatalogo();
  const resumen = {};
  for (const p of catalogo) {
    if (!p.subcategoria) continue;
    if (p.stock !== null && p.stock <= 0) continue;
    if (!resumen[p.subcategoria]) resumen[p.subcategoria] = [];
    if (resumen[p.subcategoria].length < 5) resumen[p.subcategoria].push(p);
  }
  return resumen;
}

function obtenerTodoElConocimiento() {
  return dataStore.getUsos().slice(0, 10).map(u => u.conocimiento);
}

function getTodos() {
  return datos.getTodosCatalogo();
}

function extraerSkuBase(sku) {
  const segmentos = sku.split('-');
  if (segmentos.length >= 3) return sku; // ≥3 segmentos → cada SKU es único (ej: P357002-40-248)
  return segmentos.slice(0, -1).join('-') || sku; // 2 segmentos → agrupar por prefijo (ej: I271PIST01NE)
}

function agruparVariantes(productos) {
  const grupos = new Map();

  for (const p of productos) {
    // SKU base: ≥3 segmentos → SKU completo (no agrupa); 2 segmentos → prefijo antes del último guión
    const skuBase = extraerSkuBase(p.sku);

    // Extraer ancho desde nombre_web (ej: "X 1 mt" o "X1,6 mt" o "X1,0MT")
    const matchAncho = (p.nombre_web || '').match(/[Xx]\s*(\d+[,.]\d+|\d+)\s*m/i);
    const ancho = matchAncho ? parseFloat(matchAncho[1].replace(',', '.')) : null;

    if (!grupos.has(skuBase)) {
      grupos.set(skuBase, {
        skuBase,
        nombre: p.nombre_web,
        subcategoria: p.subcategoria,
        ancho,
        variantes: [],
      });
    }

    const grupo = grupos.get(skuBase);

    // Actualizar ancho si el grupo aún no lo tiene
    if (!grupo.ancho && ancho) grupo.ancho = ancho;

    // Determinar tipo de variante según nombre y precio
    const nombreLower = (p.nombre_web || '').toLowerCase();
    const esRollo = nombreLower.includes('rollo') || p.sku.includes('-20') || p.sku.includes('-25');
    const esPorMetro = !esRollo && (p.unidad === 'MT' || p.unidad === 'mt' || p.unidad === 'ML');

    // Solo agregar si tiene precio válido (> 1)
    if (!p.precio || p.precio <= 1) continue;

    grupo.variantes.push({
      sku: p.sku,
      tipo: esRollo ? 'rollo' : esPorMetro ? 'metro' : 'unidad',
      precio: p.precio,
      stock: p.stock,
      unidad: p.unidad || 'C/U',
      nombre_web: p.nombre_web,
    });
  }

  // Ordenar variantes: metro primero, luego rollo, luego unidad
  for (const grupo of grupos.values()) {
    grupo.variantes.sort((a, b) => {
      const orden = { metro: 0, unidad: 1, rollo: 2 };
      return (orden[a.tipo] ?? 3) - (orden[b.tipo] ?? 3);
    });
  }

  // Enriquecer grupos: para cada grupo que tenga rollo pero no metro,
  // buscar la variante metro por SKU base en el catálogo completo
  const todoCatalogo = datos.getTodosCatalogo();

  for (const grupo of grupos.values()) {
    const tieneMetro = grupo.variantes.some(v => v.tipo === 'metro');
    if (!tieneMetro) {
      // Buscar en catálogo completo productos cuyo SKU base coincida
      // y sean de tipo metro (unidad MT/mt/ML y sin guion en SKU)
      const variantesMetro = todoCatalogo.filter(p => {
        const base = extraerSkuBase(p.sku);
        const esMetro = (p.unidad === 'MT' || p.unidad === 'mt' || p.unidad === 'ML');
        const precioValido = p.precio && p.precio > 1;
        const stockFtpOk = (p.saldo_ftp === null || p.saldo_ftp === undefined || p.saldo_ftp > 0);
        const stockMaestraOk = p.stock === null || p.stock > 0;
        const stockOk = stockFtpOk && stockMaestraOk;
        return base === grupo.skuBase && esMetro && precioValido && stockOk && !p.sku.includes('-');
      });

      for (const p of variantesMetro) {
        grupo.variantes.unshift({
          sku: p.sku,
          tipo: 'metro',
          precio: p.precio,
          stock: p.stock,
          unidad: p.unidad || 'MT',
          nombre_web: p.nombre_web,
        });
        // Actualizar ancho desde la variante metro si el grupo aún no lo tiene
        if (!grupo.ancho) {
          const matchAncho = (p.nombre_web || '').match(/[Xx]\s*(\d+[,.]\d+|\d+)\s*m/i);
          if (matchAncho) grupo.ancho = parseFloat(matchAncho[1].replace(',', '.'));
        }
      }
    }
  }

  return [...grupos.values()].filter(g => g.variantes.length > 0);
}

module.exports = { buscar, buscarConocimiento, buscarPorSubcategorias, listarSubcategorias, obtenerResumenCatalogo, obtenerTodoElConocimiento, getTodos, agruparVariantes };
