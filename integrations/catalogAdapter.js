'use strict';

const datos = require('../src/bot/datos');

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
  'seguridad vial':   ['Conos', 'Tachas', 'Lomos de toro y rampas', 'Estacionamiento', 'Cintas demarcatorias', 'Hitos'],
  'alfombra':         ['Alfombras'],
  'felpudo':          ['Alfombras'],
  'basurero':         ['Basureros y papeleros', 'Aseo'],
  'papelera':         ['Basureros y papeleros'],
  'tacho':            ['Basureros y papeleros'],
  'industrial':       ['Industrial', 'Aseo', 'Seguridad Vial'],
  'limpieza':         ['Aseo', 'Cleanhaus'],
  'escoba':           ['Aseo'],
  'trapero':          ['Aseo'],
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
    if (qNorm.includes(normalizar(clave))) {
      for (const c of cats) subcats.add(c);
    }
  }
  return subcats;
}

function ordenar(lista) {
  return lista.sort((a, b) => {
    if (a.tiene_stock !== b.tiene_stock) return a.tiene_stock ? -1 : 1;
    return (a.precio || 0) - (b.precio || 0);
  });
}

function buscar(query) {
  const catalogo = datos.getTodosCatalogo();
  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  const tokens = q.split(/\s+/).filter(t => t.length > 2);
  if (!tokens.length) return [];

  const scored = catalogo
    .filter(p => p.stock === null || p.stock > 0)
    .map(p => {
      const texto = [p.nombre_web, p.descripcion, p.subcategoria, p.categoria, p.familia, p.padre_familia, p.atributos]
        .filter(Boolean).join(' ').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g,'');
      const score = tokens.reduce((s, t) => s + (texto.includes(t) ? 1 : 0), 0);
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.p.stock||0) - (a.p.stock||0));

  return scored.slice(0, 8).map(x => x.p);
}

function buscarConocimiento(query) {
  if (!query || !query.trim()) return [];
  const productosMatch = buscar(query);
  return productosMatch
    .map(p => p.conocimiento_tecnico)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 2)
    .map(conocimiento => ({ familia: '', conocimiento }));
}

function buscarPorSubcategorias(subcategorias) {
  const catalogo = datos.getTodosCatalogo();
  const subcatsNorm = subcategorias.map(s => s.toLowerCase().trim());
  return catalogo
    .filter(p => subcatsNorm.includes((p.subcategoria || '').toLowerCase().trim()))
    .sort((a, b) => {
      if (b.tiene_stock !== a.tiene_stock) return b.tiene_stock ? 1 : -1;
      return (a.precio || 0) - (b.precio || 0);
    })
    .slice(0, 8);
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
  const catalogo = datos.getTodosCatalogo();
  return [...new Set(catalogo.map(p => p.conocimiento_tecnico).filter(Boolean))].slice(0, 10);
}

function getTodos() {
  return datos.getTodosCatalogo();
}

module.exports = { buscar, buscarConocimiento, buscarPorSubcategorias, listarSubcategorias, obtenerResumenCatalogo, obtenerTodoElConocimiento, getTodos };
