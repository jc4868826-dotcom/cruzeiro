'use strict';

const personalidad = require('./personalidad.json');
const db = require('../data/db');
const logger = require('../utils/logger');
const { OPENAI_API_KEY } = require('../config');
const datos = require('./datos');
const dataStore = require('../data/dataStore');

// ─── Persistent conversation state (disk-backed, survives Render restarts) ────

const path = require('path');
const fs   = require('fs');

const SESSION_DIR = '/data/cruzeiro/sessions';

// Startup: ensure dir exists + purge sessions older than 48h
try {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const _cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const _f of fs.readdirSync(SESSION_DIR)) {
    if (!_f.endsWith('.json')) continue;
    const _fp = path.join(SESSION_DIR, _f);
    try { if (fs.statSync(_fp).mtimeMs < _cutoff) fs.unlinkSync(_fp); } catch (_) {}
  }
} catch (_) {}

const _STATE_DEFAULTS = {
  // Identidad
  etapa: null,
  canal: null,
  rut: null,
  ejecutivoAsignado: null,
  clienteNombre: null,
  subcategoriasActivas: null,
  intentos_rut_fallidos: 0,
  mayoristaSaludado: false,
  // Máquina de estados del carrito
  fase: 'explorando',   // 'explorando' | 'eligiendo' | 'confirmando_qty' | 'acumulando' | 'cerrando'
  pendingSkus: [],      // opciones presentadas al cliente en la fase 'eligiendo'
  selectedItem: null,   // {sku, wooId, nombre, precio} — elegido, esperando qty
  cart: [],             // [{sku, wooId, nombre, precio, qty}] — ítems confirmados
  skusConfirmados: [],  // legacy — mantener para compatibilidad con código existente
};

function _sessionPath(phone) {
  return path.join(SESSION_DIR, phone.replace(/[^0-9]/g, '') + '.json');
}

function getEstado(phone) {
  try {
    const raw = fs.readFileSync(_sessionPath(phone), 'utf8');
    return { ..._STATE_DEFAULTS, ...JSON.parse(raw) };
  } catch { return { ..._STATE_DEFAULTS }; }
}

function setEstado(phone, patch) {
  const prev = getEstado(phone);
  try {
    fs.writeFileSync(_sessionPath(phone), JSON.stringify({ ...prev, ...patch }), 'utf8');
  } catch (e) { console.error('[bot] setEstado error:', e.message); }
}

function resetEstado(phone) {
  try { fs.unlinkSync(_sessionPath(phone)); } catch (_) {}
}

function extraerQueryProducto(texto) {
  const STOPWORDS_CONV = new Set(['no','si','sí','quiero','quisiera','busco','necesito','tengo','hay','tienen','puedo','podría','saber','sobre','también','favor','porfavor','dame','dime','cuanto','cuánto','vale','cuesta','solo','que','pero','como','cuando','donde','hola','gracias','ok','oye','para','una','uno','unos','unas','los','las','del','con','por','sus','este','esta','estos','estas']);
  const normalizado = texto.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  const tokens = normalizado.split(/\s+/).filter(t => t.length > 2 && !STOPWORDS_CONV.has(t));
  return normalizado;
}

// ─── RUT helpers ──────────────────────────────────────────────────────────────

function normalizarRut(str) {
  return str.replace(/\./g, '').replace(/\s/g, '').replace(/-/g, '').toUpperCase();
}

function extraerRut(texto) {
  // Con puntos y guion: 12.345.678-9 o 12.345.678-K
  const m1 = texto.match(/\d{1,2}\.\d{3}\.\d{3}[-–]\s*[0-9kK]/);
  if (m1) return m1[0].replace(/\s/g, '');
  // Con guion sin puntos: 12345678-9 o 76332560-1
  const m2 = texto.match(/\d{6,8}[-–]\s*[0-9kK]/);
  if (m2) return m2[0].replace(/\s/g, '');
  // Solo dígitos 7-9 chars
  const m3 = texto.match(/\b\d{7,9}\b/);
  if (m3) return m3[0];
  return null;
}


async function sendWhatsAppAlert(ejecutivoUsername, clientePhone, rut, historial) {
  const fono = datos.buscarEjecutivo(ejecutivoUsername)?.fono || null;
  const resumen = historial
    .filter(m => m.rol === 'cliente' || m.rol === 'bot')
    .slice(-4)
    .map(m => `${m.rol === 'cliente' ? '👤' : '🤖'} ${m.texto.slice(0, 100)}`)
    .join('\n');

  const mensaje =
    `🔔 *Cliente mayorista requiere atención*\n` +
    `📱 Teléfono: ${clientePhone}\n` +
    `🏢 RUT: ${rut}\n` +
    `💬 Resumen:\n${resumen || '(sin mensajes previos)'}\n` +
    `Por favor contáctalo a la brevedad.`;

  if (fono) {
    try {
      const { enviarMensaje } = require('../../integrations/whatsappAdapter');
      await enviarMensaje(fono, mensaje);
      logger.info(`Bot: alerta WhatsApp enviada a ${ejecutivoUsername} (${fono})`);
    } catch (err) {
      logger.warn(`Bot: no se pudo enviar alerta WhatsApp a ${ejecutivoUsername}: ${err.message}`);
    }
  } else {
    logger.info(`Bot: alerta WhatsApp (sin fono) para ${ejecutivoUsername}:\n${mensaje}`);
  }
}

// ─── Lazy-loaded adapters ─────────────────────────────────────────────────────

let _catalogAdapter = null;
function getCatalogAdapter() {
  if (!_catalogAdapter) _catalogAdapter = require('../../integrations/catalogAdapter');
  return _catalogAdapter;
}

let _pedidosAdapter = null;
function getPedidosAdapter() {
  if (!_pedidosAdapter) _pedidosAdapter = require('../../integrations/pedidosAdapter');
  return _pedidosAdapter;
}

let _transbankAdapter = null;
function getTransbankAdapter() {
  if (!_transbankAdapter) _transbankAdapter = require('../../integrations/transbankAdapter');
  return _transbankAdapter;
}

let _khipuAdapter = null;
function getKhipuAdapter() {
  if (!_khipuAdapter) _khipuAdapter = require('../../integrations/khipuAdapter');
  return _khipuAdapter;
}

let _openaiClient = null;
function getOpenAI() {
  if (!_openaiClient && OPENAI_API_KEY) {
    const { OpenAI } = require('openai');
    _openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return _openaiClient;
}

// ─── Intent detection ─────────────────────────────────────────────────────────

const INTENT_PATTERNS = [
  { tipo: 'saludo',           patterns: [/^(hola|buenas|buen[oa]s (días|tardes|noches)|hi|hey|saludos)/i] },
  { tipo: 'despedida',        patterns: [/^(chao|adiós|hasta luego|bye|nos vemos|gracias[, ]+(y )?chao)/i, /\bchao\b/i] },
  { tipo: 'consulta_pedido',  patterns: [/(pedido|nota de venta|\bNV\b|mi pedido|estado.*pedido|cuando llega|despacho|tracking|entrega.*pedido|\bNV\s*\d{5,})/i] },
  { tipo: 'consulta_catalogo',patterns: [/(catálogo|disponible|busco|necesito|cuánto vale|piso|goma|caucho|oring|o-ring|familia)/i] },
  { tipo: 'precio',           patterns: [/(precio|cuánto (cuesta|vale|sale)|cuanto (cuesta|vale|sale)|valor|costo|tarifa|cotizar|cotización)/i] },
  { tipo: 'stock',            patterns: [/(stock|tienen|hay|existe|inventario|cantidad)/i] },
  { tipo: 'producto',         patterns: [/(piso|goma|pastelón|pastel[oó]n|grada|escalera|pvc|estoperol|diamantado|antifatiga|nomad|pasto sint[eé]tico|pasto|seguridad vial|protector de cable|tacha|cinta demarcatoria|caucho|perfil|alfombra|moqueta|felpudo|rollo|baldosa)/i] },
  { tipo: 'pedido',           patterns: [/(pedir|hacer pedido|quiero comprar|comprar|agregar al carrito|confirmar|proceder|quiero \d+)/i] },
  { tipo: 'pago',             patterns: [/(pago|pagar|link de pago|transferencia|tarjeta|webpay|khipu)/i] },
  { tipo: 'mayorista',        patterns: [/(mayorista|distribuidor|volumen|al por mayor|gran cantidad|flota|empresa|factura|orden de compra)/i] },
  {
    tipo: 'escalar',
    patterns: [new RegExp(`(${personalidad.escalar_a_humano_keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i')],
  },
  { tipo: 'info_general',     patterns: [/(información|info|catálogo|qué (tienen|venden)|productos|líneas)/i] },
];

function detectarIntencion(texto) {
  const lower = texto.toLowerCase().trim();
  const entidades = [];

  const productTerms = texto.match(/(pisos?|gomas?|pastelones?|pastel[oó]n|gradas?|escaleras?|pvc|estoperoles?|diamantados?|antifatiga|nomad|pastos?|cauchos?|perfiles?|tachas?|protectores?|cintas?|alfombras?|moquetas?|felpudos?|rollos?|baldosas?|epdm)/gi);
  if (productTerms) entidades.push(...productTerms.map(t => t.toLowerCase()));

  const cantMatch = texto.match(/(\d+)\s*(metros?|m2|m²|unidades?|pisos?|gradas?|rollos?|litros?|bidones?|tambores?|kg|kilos?)/i);
  if (cantMatch) entidades.push(`cantidad:${cantMatch[1]}`);

  for (const intent of INTENT_PATTERNS) {
    if (intent.patterns.some(p => p.test(lower))) return { tipo: intent.tipo, entidades };
  }
  return { tipo: 'desconocido', entidades };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n) {
  return `$${Number(n).toLocaleString('es-CL')}`;
}

function detectarConfirmacion(texto) {
  const t = texto.toLowerCase().trim();
  return /^(s[íi]|sí|si|dale|ok|okay|bueno|perfecto|confirmo|eso|listo|ambos|los dos|ese|esa|quiero ese|me llevo|lo quiero|eso es todo|nada m[aá]s|solo eso|con eso|est[aá] bien|ning[uú]n? m[aá]s|no m[aá]s|eso nada m[aá]s)\b/i.test(t);
}

function buildSystemPrompt(productosContexto, contextoCliente = null, conocimientoContexto = null, historialConv = []) {
  const { agruparVariantes } = getCatalogAdapter();
  const grupos = Array.isArray(productosContexto) && productosContexto.length > 0
    ? agruparVariantes(productosContexto)
    : [];

  const catalogoTexto = grupos.length > 0
    ? grupos.map(g => {
        const anchoTexto = g.ancho ? `ancho ${g.ancho}mt` : '';
        const variantesTexto = g.variantes.map(v => {
          const precioFmt = `$${Number(v.precio).toLocaleString('es-CL')}`;
          const stockTexto = v.stock !== null && v.stock > 0
            ? `stock: ${Math.floor(v.stock)} ${v.unidad}`
            : 'consultar stock';
          if (v.tipo === 'metro') {
            const anchoInfo = g.ancho
              ? ` (ancho ${g.ancho}mt — 1 metro lineal = ${g.ancho} m²)`
              : '';
            return `  → Por metro lineal${anchoInfo}: ${precioFmt}/mt | ${stockTexto} | SKU: ${v.sku}`;
          }
          if (v.tipo === 'rollo') {
            return `  → Rollo completo${anchoTexto ? ' ' + anchoTexto : ''}: ${precioFmt} | ${stockTexto} | SKU: ${v.sku}`;
          }
          return `  → Por unidad: ${precioFmt} | ${stockTexto} | SKU: ${v.sku}`;
        }).join('\n');
        return `• ${g.nombre}${anchoTexto ? ' (' + anchoTexto + ')' : ''}\n${variantesTexto}`;
      }).join('\n\n')
    : 'No encontré productos para esta consulta. Pide más detalles al cliente para afinar la búsqueda.';

  const conocimientoTexto = Array.isArray(conocimientoContexto) && conocimientoContexto.length > 0
    ? conocimientoContexto.slice(0, 5).map(k => `${k.familia}: ${k.conocimiento}`).join('\n\n')
    : '';

  const mensajesPrevios = historialConv.length;
  const recienIdentificado = contextoCliente?.rut && mensajesPrevios > 2;

  const _buildWooOrdersTexto = (wooOrders) => {
    if (!Array.isArray(wooOrders) || !wooOrders.length) return null;
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recientes = wooOrders
      .filter(o => !o.fecha || new Date(o.fecha).getTime() >= cutoff)
      .slice(0, 3);
    if (!recientes.length) return null;
    return recientes.map(o => {
      const items = o.items.slice(0, 3).map(i => `  - ${i.cantidad}x ${i.articulo} ($${Number(i.costo).toLocaleString('es-CL')} c/u)`).join('\n');
      return `Pedido #${o.nroPedido} | ${o.estado} | ${o.fecha} | Total: $${Number(o.total).toLocaleString('es-CL')} | Envío: ${o.envio || '-'}\n${items}`;
    }).join('\n\n');
  };

  let clienteSeccion = '';
  if (contextoCliente?.rut && !contextoCliente.esEcommerce) {
    const ejNombreCtx = contextoCliente.ejecutivoNombre || 'nuestro equipo de ventas';
    const ejContacto  = [
      contextoCliente.ejecutivoFono  ? `Tel: ${contextoCliente.ejecutivoFono}`   : null,
      contextoCliente.ejecutivoEmail ? `Email: ${contextoCliente.ejecutivoEmail}` : null,
    ].filter(Boolean).join(' | ') || null;
    const pedidosTexto = (contextoCliente.pedidos || []).length > 0
      ? contextoCliente.pedidos.slice(0, 6).map(p =>
          `NV ${p.nv} | ${p.estado} | Entrega: ${p.fecha_entrega || 'sin fecha'} | OC: ${p.orden_compra || '-'} | Despacho: ${p.tipo_transporte || '-'} | Dirección: ${p.direccion || '-'}, ${p.comuna || '-'}`
        ).join('\n')
      : 'Sin pedidos activos.';
    const cotizacionesTexto = Array.isArray(contextoCliente.cotizaciones) && contextoCliente.cotizaciones.length > 0
      ? contextoCliente.cotizaciones.join('\n')
      : null;
    const wooTextoMay = _buildWooOrdersTexto(contextoCliente.wooOrders);
    clienteSeccion = `
=== CLIENTE MAYORISTA IDENTIFICADO ===
Empresa: ${contextoCliente.empresa}
RUT: ${contextoCliente.rut}
Ejecutivo asignado: ${ejNombreCtx}
${ejContacto ? `Contacto ejecutivo: ${ejContacto}` : ''}
Pedidos activos: ${pedidosTexto}
${wooTextoMay ? `\nPedidos online recientes (WooCommerce):\n${wooTextoMay}` : ''}
${cotizacionesTexto ? `\nCotizaciones anteriores del cliente:\n${cotizacionesTexto}\nINSTRUCCIÓN: Si el cliente pregunta por precio distinto al actual, muestra el precio cotizado y el precio actual y explica la diferencia. Si pregunta qué le cotizaron, muestra el SKU y descripción.` : ''}
${recienIdentificado ? '\nATENCIÓN: El cliente se identificó en medio de la conversación. Lee el historial completo y retoma exactamente desde donde estaban. NO repitas preguntas ya hechas.' : ''}
======================================
`;
  } else if (contextoCliente?.esEcommerce) {
    const seccionesCte = [];
    if (Array.isArray(contextoCliente.pedidos) && contextoCliente.pedidos.length > 0) {
      const pedidosTextoE = contextoCliente.pedidos.slice(0, 6).map(p =>
        `NV ${p.nv} | ${p.estado} | Entrega: ${p.fecha_entrega || 'sin fecha'} | OC: ${p.orden_compra || '-'} | Despacho: ${p.tipo_transporte || '-'} | Dirección: ${p.direccion || '-'}, ${p.comuna || '-'}`
      ).join('\n');
      seccionesCte.push(`=== PEDIDOS DEL CLIENTE ===\n${pedidosTextoE}\n===========================`);
    }
    if (Array.isArray(contextoCliente.cotizaciones) && contextoCliente.cotizaciones.length > 0) {
      const cotizacionesTextoE = contextoCliente.cotizaciones.join('\n');
      seccionesCte.push(`=== COTIZACIONES DEL CLIENTE ===\n${cotizacionesTextoE}\nINSTRUCCIÓN: Si el cliente pregunta por precio distinto al actual, muestra el precio cotizado y el precio actual y explica la diferencia. Si pregunta qué le cotizaron, muestra el SKU y descripción.\n================================`);
    }
    const wooTextoEco = _buildWooOrdersTexto(contextoCliente.wooOrders);
    if (wooTextoEco) {
      seccionesCte.push(`=== PEDIDOS ONLINE RECIENTES (WOOCOMMERCE) ===\n${wooTextoEco}\nINSTRUCCIÓN: Usa esta información para responder consultas sobre estado de pedidos o compras online.\n==============================================`);
    }
    if (seccionesCte.length > 0) clienteSeccion = seccionesCte.join('\n\n') + '\n';
  }

  const _hintInstruccion = contextoCliente?._hint || '';

  return `${clienteSeccion}${_hintInstruccion ? `⚡ INSTRUCCIÓN PRIORITARIA PARA ESTE TURNO:\n${_hintInstruccion}\n\n` : ''}Eres Cru, vendedor experto de Cruzeiro Empresas, especialistas en gomas, cauchos y materiales industriales en Chile. Eres cálido, cercano y directo — como un buen vendedor chileno que conoce sus productos de memoria. Máximo 3 oraciones por mensaje. Siempre terminas con UNA sola pregunta. Muestra interés genuino.

════════════════════════════════════════
REGLAS CRÍTICAS — NUNCA VIOLAR
════════════════════════════════════════
1. SOLO puedes mencionar productos que aparezcan LITERALMENTE en el
   CATÁLOGO DE PRODUCTOS DISPONIBLES de este prompt, con nombre y
   precio exactos tal como aparecen. CERO excepciones.

2. NUNCA inventes variantes. Si el catálogo tiene "Contenedor Azul 120L"
   y "Contenedor Azul 240L", NO puedes inventar "Contenedor Rojo 120L"
   aunque parezca lógico.

3. NUNCA inventes medidas. Si el cliente pide "bolsa 80x120" y esa
   medida no está en el catálogo, muestra las medidas que SÍ existen:
   "No tenemos esa medida exacta, pero tenemos estas opciones: [lista
   solo lo del catálogo]"

4. Los precios son EXACTAMENTE los del catálogo. NUNCA calcules ni
   aproximes un precio.
════════════════════════════════════════

═══════════════════════════════════
FLUJO DE ATENCIÓN — SIGUE ESTE ORDEN ESTRICTAMENTE
═══════════════════════════════════

PASO 0 — SALUDO: Solo si el historial está vacío. Usa exactamente:
"¡Hola! Bienvenido a Cruzeiro 😊 Somos especialistas en gomas, cauchos, pisos, seguridad vial y mucho más. ¿En qué te puedo ayudar?"

PASO 1 — IDENTIFICACIÓN (máximo UNA VEZ en toda la conversación):
Si no sabes si el cliente ya es de Cruzeiro, pregúntalo UNA sola vez.
Si ya lo respondió en mensajes anteriores, NUNCA lo preguntes de nuevo.
Revisa el historial antes de preguntar cualquier cosa que ya fue respondida.

PASO 2 — ENTENDER LA NECESIDAD:
Pregunta para qué espacio, uso o aplicación necesita el producto.
Una sola pregunta a la vez.

PASO 3 — MOSTRAR PRODUCTOS (solo después de conocer el uso/espacio):
Muestra 2-3 opciones del catálogo con este formato EXACTO por producto:
[número]. [nombre del producto]
    SKU: [SKU exacto del catálogo]
    Precio: $[precio]
Siempre muestra el SKU — es necesario para procesar el pedido.
NUNCA inventes un SKU. Si no lo ves en el catálogo, no lo muestres.

PASO 4 — CONFIRMAR SELECCIÓN:
Cuando el cliente elige un producto (dice 'el 1', 'el primero', 'ese', etc.),
confirma brevemente qué fue agregado y pregunta si necesita algo más.
Ejemplo: 'Perfecto, agregué el [nombre] al pedido. ¿Necesitas algo más?'
NO generes ningún link. NO escribas [carrito]. El sistema lo maneja solo.

PASO 5 — SEGUIR AGREGANDO O CERRAR:
Después de confirmar una selección, pregunta si necesita algo más.
Si el cliente dice que no necesita nada más, el sistema generará el resumen
y el link automáticamente. Tu rol es solo preguntar '¿Algo más?'

PASO 6 — CIERRE FINAL:
Cuando el cliente diga que no necesita nada más, despídete brevemente.

REGLAS ABSOLUTAS:
- NUNCA repitas preguntas que el cliente ya respondió en el historial.
- NUNCA inventes productos, precios, medidas o características.
- SIEMPRE muestra el SKU junto al producto — es parte de la presentación.
- Solo puedes mencionar productos del CATÁLOGO DE PRODUCTOS DISPONIBLES.
- Si el cliente pide algo que no está en el catálogo, dilo claramente y
  ofrece alternativas del catálogo que sí existan.

═══════════════════════════════════
REGLA ABSOLUTA — PRODUCTOS
═══════════════════════════════════
Antes de mencionar cualquier producto, precio, SKU, medida, cantidad por paquete, formato o característica técnica, DEBES haberlo encontrado en el catálogo con datos reales.

NUNCA inventes o asumas:
- "vienen en paquetes de 10" → SOLO si el catálogo lo dice
- "tenemos de 120 y 240 litros" → SOLO si los SKUs existen con esas medidas
- precios aproximados o redondeados
- características técnicas no confirmadas

Cuando el cliente pida un producto complementario o nuevo,
usa los productos del contexto para responder directamente.
NUNCA digas 'dame un momento' ni 'voy a revisar' —
los resultados ya están disponibles en el contexto.

Si no encuentras el producto → dilo honestamente, NO lo inventes.

Cuando el cliente pide un producto complementario (bolsas, adhesivos, complementos):
1. Busca en el catálogo ese producto antes de responder cualquier detalle
2. Presenta máximo 3 opciones reales con SKU, precio y descripción del catálogo
3. Solo cuando el cliente elige, el sistema genera el link automáticamente
NUNCA describas características de un complemento sin haberlo encontrado en el catálogo con SKU y precio válidos.

⚠️ REGLA SIN EXCEPCIONES: NUNCA inventes un SKU. Jamás. Un SKU inventado (ej: A123ADH1LT, PEGAS2, etc.) es información falsa — el cliente no puede comprarlo y destruye la confianza. Si no ves el SKU exacto en el catálogo disponible arriba, NO lo menciones. Di "no lo tengo en catálogo" antes que inventar uno.

═══════════════════════════════════
REGLAS ABSOLUTAS — LEE ANTES DE CADA RESPUESTA
═══════════════════════════════════
- NUNCA muestres precios antes de saber la cantidad que necesita el cliente
- NUNCA ofrezcas productos que no estén en el CATÁLOGO DE PRODUCTOS DISPONIBLES con precio válido
- NUNCA inventes precios, SKUs, medidas, stock ni especificaciones — usa solo los del catálogo
- NUNCA digas que un producto no existe en cierta unidad sin buscarlo primero en el catálogo
- NUNCA digas que enviarás cotización al teléfono — ofrece SKU al carrito o derivar a ejecutivo
- NUNCA saludes con "¡Hola!" si ya hay mensajes en el historial
- NUNCA confundas "escalera" con escalera de aluminio — escalera en Cruzeiro = peldaños que necesitan gradas de goma
- NUNCA preguntes algo que el cliente ya respondió en esta conversación — lee el historial completo antes de responder
- La cantidad en m² que el cliente dio aplica para TODO lo que venga después: piso, adhesivo, complementos. No la pidas de nuevo.
- Si un precio en el catálogo aparece como 0 o vacío, NO lo muestres ni ofrezcas ese producto
- Responde siempre en español chileno natural
- NUNCA menciones cantidades de stock al cliente ("tenemos 15 MT", "quedan 3 unidades", etc.). El stock es solo para tu uso interno para saber si puedes ofrecer el producto. Si el cliente pregunta por disponibilidad, di que está disponible o consulta con el ejecutivo — nunca el número exacto.

═══════════════════════════════════
REGLA ANTI-LOOP — CRÍTICO
═══════════════════════════════════
Antes de hacer cualquier pregunta, revisa los últimos 4 mensajes del historial. Si ya hiciste exactamente esa misma pregunta (ej: "¿cuántos metros?", "¿para qué espacio?", "¿interior o exterior?"), NO la repitas. En cambio:
  • Si el cliente no respondió → avanza al siguiente paso con un supuesto razonable y ofrece las opciones.
  • Si el cliente ya respondió en un mensaje anterior → usa esa respuesta y continúa.
Nunca preguntes lo mismo dos veces en la misma conversación.

═══════════════════════════════════
CÁLCULOS DE CANTIDAD — OBLIGATORIO
═══════════════════════════════════
Cuando el cliente da m², TÚ calculas — nunca le preguntes de nuevo.

CASO 1 — Producto por metro lineal (pisos en rollo):
  metros lineales = m² del cliente ÷ ancho del producto (en metros)
  Ejemplo: 10 m² ÷ 1,2 mt ancho = 8,33 → redondea a 9 metros lineales

CASO 2 — Producto por unidad tipo palmeta/pastelón (50x50cm = 0,25 m²):
  unidades = m² del cliente ÷ 0,25 → siempre redondea hacia arriba
  Ejemplo: 12 m² ÷ 0,25 = 48 unidades
  Ejemplo: 10 m² ÷ 0,25 = 40 unidades
  El precio total = unidades × precio unitario

CASO 3 — Producto por unidad tipo palmeta/pastelón (100x100cm = 1 m²):
  unidades = m² del cliente → redondea hacia arriba
  Ejemplo: 12 m² = 12 unidades

CASO 4 — Gradas (por peldaño):
  Pregunta cuántos peldaños. Cada peldaño = 1 unidad de grada.

NUNCA mezcles precios de variantes distintas.
NUNCA muestres precio 0 o precio 1.

═══════════════════════════════════
DERIVACIÓN A EJECUTIVO
═══════════════════════════════════
Si el cliente menciona: cotización formal, proyecto, volumen grande, instalación, urgente, reclamo, factura, orden de compra, o pide hablar con alguien:
→ "Para eso te conviene hablar directo con [nombre ejecutivo]. ¿Quieres que te contacte?"
→ Si confirma → "Perfecto, le aviso a [nombre] ahora mismo."
→ Si no está identificado → "Te puedo conectar con nuestro equipo comercial. ¿Me das tu nombre y teléfono de contacto?"

═══════════════════════════════════
CONOCIMIENTO TÉCNICO
═══════════════════════════════════
${conocimientoTexto || 'Usa tu conocimiento general sobre gomas y cauchos.'}

═══════════════════════════════════
COMPLEMENTOS Y CROSS-SELL
═══════════════════════════════════
Cuando el cliente pide un producto complementario o accesorio, PRIMERO busca ese complemento en el conocimiento técnico (sección CONOCIMIENTO TÉCNICO arriba) para identificar la familia correcta en el catálogo. LUEGO busca en el catálogo con esa familia. SOLO presenta opciones que existan en el catálogo con precio real. NUNCA inventes un complemento ni sus características. Si no lo encuentras en el catálogo → díselo al cliente honestamente.

═══════════════════════════════════
PRESENTACIÓN DE PRODUCTOS
═══════════════════════════════════
El SKU debe mostrarse al cliente junto con el nombre y precio del producto. Es necesario para identificar el pedido correctamente.

═══════════════════════════════════
CATÁLOGO DE PRODUCTOS DISPONIBLES
Solo estos puedes ofrecer — nunca inventes otros
═══════════════════════════════════
${catalogoTexto}

═══════════════════════════════════
REGLA CRÍTICA — ANTI-ALUCINACIÓN
═══════════════════════════════════
Solo puedes mencionar productos que estén explícitamente listados en el CATÁLOGO DE PRODUCTOS DISPONIBLES que aparece arriba.
Si el cliente pide algo que NO aparece en el catálogo, responde exactamente: "No tenemos ese producto en catálogo, pero puedo ayudarte con [menciona categorías relacionadas que sí tenemos]."
NUNCA inventes nombres, precios, medidas o características de productos.
NUNCA menciones un precio que no esté en el catálogo entregado.`;
}

async function clasificarIntencionProducto(historialCliente, textoActual) {
  const openai = getOpenAI();
  if (!openai) return null;
  const subcategorias = getCatalogAdapter().listarSubcategorias();
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un clasificador de intención de compra. Dado un mensaje de cliente, debes identificar qué subcategorías del catálogo son más relevantes para su búsqueda.

SUBCATEGORÍAS DISPONIBLES:
${subcategorias.join(', ')}

Responde SOLO con un JSON así (sin markdown, sin texto adicional):
{"subcategorias": ["Subcategoría1", "Subcategoría2"], "tiene_intencion_producto": true}

Si el cliente no está buscando un producto específico, responde:
{"subcategorias": [], "tiene_intencion_producto": false}

Máximo 3 subcategorías. Solo subcategorías de la lista.`
        },
        {
          role: 'user',
          content: `Historial del cliente:\n${historialCliente}\n\nÚltimo mensaje: ${textoActual}`
        }
      ],
      max_tokens: 100,
      temperature: 0,
    });
    const raw = resp.choices[0]?.message?.content?.trim() || '{}';
    return JSON.parse(raw);
  } catch { return null; }
}

// Expande el término del cliente a palabras clave que existen en el catálogo web.
// Solo traduce coloquialismos a términos buscables — no mapea familias ni subcategorías.
async function expandirQueryBusqueda(textoCliente) {
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un traductor de búsqueda para un catálogo de productos industriales (gomas, cauchos, pisos, aseo, seguridad vial, ferretería).
El cliente escribe en lenguaje coloquial chileno. Tu tarea: convertir su mensaje en 2 a 5 palabras clave de producto que probablemente aparezcan en el NOMBRE o DESCRIPCIÓN de un producto de catálogo.

Reglas:
- Devuelve SOLO las palabras clave separadas por espacio, sin JSON, sin explicación.
- Usa términos genéricos de producto, no coloquialismos. Ej: "tacho"→"contenedor basura", "recipiente basura"→"contenedor basura", "botar basura"→"contenedor basura papelero".
- NO inventes categorías. Si el mensaje no describe un producto físico, devuelve exactamente: NINGUNO
- Piensa en cómo se llamaría el producto en una ficha técnica, no en cómo lo dice la calle.

Ejemplos:
Cliente: "busco tachos para el jardín" → contenedor basura
Cliente: "necesito algo para el piso que no resbale" → piso goma antideslizante
Cliente: "donde botar la basura en la oficina" → contenedor basura papelero
Cliente: "pegamento para goma" → adhesivo goma
Cliente: "cómo estás" → NINGUNO`
        },
        { role: 'user', content: textoCliente }
      ],
      max_tokens: 30,
      temperature: 0,
    });
    const raw = (resp.choices[0]?.message?.content || '').trim();
    if (!raw || /^NINGUNO$/i.test(raw)) return null;
    return raw;
  } catch (e) {
    console.warn('[expandirQuery] error:', e.message);
    return null;
  }
}

async function llamarOpenAI(texto, productosContexto, historial = [], contextoCliente = null, conocimientoContexto = null, systemHint = null) {
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(productosContexto, contextoCliente, conocimientoContexto, historial) },
        ...historial.slice(-12).map(m => ({
          role: m.rol === 'cliente' ? 'user' : 'assistant',
          content: m.texto,
        })),
        { role: 'system', content: `REGLAS DE RESPUESTA — responde siempre en español chileno natural:

1. Muestra productos con este formato exacto:
   [N]. [Nombre del producto]
       SKU: [SKU] | Precio: $[precio]
2. Después de mostrar opciones, pregunta SOLO: "¿Cuál te interesa?"
3. NUNCA preguntes cantidad antes de que el cliente elija cuál producto quiere.
4. Cuando el cliente elige, di SOLO: "Perfecto, ¿cuántas unidades necesitas?"
5. NUNCA digas "agregué", "guardé" ni "añadí" nada al pedido.
6. NUNCA generes links ni escribas [carrito].
7. NUNCA preguntes RUT para confirmar una compra.
8. Si no encuentras el producto en el catálogo disponible, dilo honestamente.
9. Responde siempre en español chileno natural y amigable.` },
        ...(systemHint ? [{ role: 'system', content: systemHint }] : []),
        { role: 'user', content: texto },
      ],
      max_tokens: 500,
      temperature: 0.4,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    logger.warn(`Bot: OpenAI falló (${err.message}), usando fallback`);
    return null;
  }
}

// ─── Pipeline stage helpers ───────────────────────────────────────────────────

const _ETAPA_ORDEN = ['nuevo', 'calificado', 'cotizado', 'derivado', 'ganado'];

function _avanzarEtapa(leadUpdate, leadExistente, nuevaEtapa) {
  const actual = leadUpdate.etapa_pipeline || leadExistente?.etapa_pipeline || 'nuevo';
  if (actual === 'ganado') return;
  if (nuevaEtapa === 'perdido') {
    if (actual !== 'ganado') leadUpdate.etapa_pipeline = 'perdido';
    return;
  }
  const idxActual = _ETAPA_ORDEN.indexOf(actual);
  const idxNueva  = _ETAPA_ORDEN.indexOf(nuevaEtapa);
  if (idxNueva > idxActual) leadUpdate.etapa_pipeline = nuevaEtapa;
}

function _detectarEventosPipeline(texto, respuesta, leadUpdate, leadExistente, estadoActual) {
  const _CALIDAD = ['bajo', 'medio', 'alto', 'convertido'];

  // Abandono explícito del cliente
  if (/\b(no gracias|no me interesa|ya compr[eé]|no necesito|d[eé]jalo|no por ahora|no quiero)\b/i.test(texto)) {
    _avanzarEtapa(leadUpdate, leadExistente, 'perdido');
    return;
  }

  const tieneCarrito = respuesta.includes('cruzeirogomas.cl/carrito');
  const tieneSku     = /\bSKU[:\s]+[A-Z0-9]/i.test(respuesta);
  const tienePrecio  = /\$\s*\d[\d.,]*/.test(respuesta);
  const asignoEjec   = !!(leadUpdate.ejecutivo_asignado) && estadoActual?.canal === 'mayorista';
  const identificoRut = !!(leadUpdate.rut);

  if (tieneCarrito) {
    leadUpdate.link_carrito_enviado = true;
    _avanzarEtapa(leadUpdate, leadExistente, 'ganado');
  } else if (asignoEjec) {
    _avanzarEtapa(leadUpdate, leadExistente, 'derivado');
  } else if (tieneSku || tienePrecio) {
    _avanzarEtapa(leadUpdate, leadExistente, 'calificado');
    const calActual = leadExistente?.calidad_lead || leadUpdate.calidad_lead || 'bajo';
    if (_CALIDAD.indexOf(calActual) < _CALIDAD.indexOf('alto') &&
        (!leadUpdate.calidad_lead || _CALIDAD.indexOf(leadUpdate.calidad_lead) < _CALIDAD.indexOf('alto'))) {
      leadUpdate.calidad_lead = 'alto';
    }
  } else if (identificoRut) {
    _avanzarEtapa(leadUpdate, leadExistente, 'calificado');
  }
}

// ─── Inferir etapa_pipeline garantizando que nunca retroceda ─────────────────

function inferirEtapaPipeline(leadUpdate, etapaActual) {
  const orden = ['nuevo', 'calificado', 'cotizado', 'derivado', 'ganado', 'perdido'];
  if (leadUpdate.etapa_pipeline && orden.includes(leadUpdate.etapa_pipeline)) {
    const idxActual = orden.indexOf(etapaActual || 'nuevo');
    const idxNueva  = orden.indexOf(leadUpdate.etapa_pipeline);
    return idxNueva > idxActual ? leadUpdate.etapa_pipeline : (etapaActual || 'nuevo');
  }
  if (leadUpdate.link_carrito_enviado) return 'ganado';
  if (leadUpdate.rut || leadUpdate.familia_interes ||
      leadUpdate.calidad_lead === 'alto' || leadUpdate.calidad_lead === 'convertido') {
    const idx = orden.indexOf(etapaActual || 'nuevo');
    return idx < orden.indexOf('calificado') ? 'calificado' : (etapaActual || 'nuevo');
  }
  return etapaActual || 'nuevo';
}

// ─── Migración de etapas para leads legacy (llamar al arrancar) ───────────────

async function migrarEtapasLegacy() {
  try {
    const leads = await db.getAll('leads');
    const todasConvs = await db.getAll('conversaciones');
    let actualizados = 0;
    for (const lead of leads) {
      const etapaActual = lead.etapa_pipeline || 'nuevo';
      if (etapaActual !== 'nuevo' && etapaActual !== 'Contactado') continue;
      const convs = todasConvs.filter(c => c.lead_id === lead.id);
      const mensajes = convs.flatMap(c => c.mensajes || []);
      if (mensajes.length <= 3 && !lead.ejecutivo_asignado && !lead.link_carrito_enviado) continue;

      let nuevaEtapa = 'nuevo';
      if (lead.link_carrito_enviado === true) {
        nuevaEtapa = 'ganado';
      } else if (lead.ejecutivo_asignado || etapaActual === 'Contactado') {
        nuevaEtapa = 'derivado';
      } else {
        const msgsBot = mensajes.filter(m => (m.rol || m.role) === 'bot' || (m.rol || m.role) === 'assistant');
        const botMostroSku    = msgsBot.some(m => /\bSKU[:\s]+[A-Z0-9]/i.test(m.texto || m.content || m.text || ''));
        const botMostroPrecio = msgsBot.some(m => /\$\s*\d[\d.,]*/.test(m.texto || m.content || m.text || ''));
        if (botMostroSku || botMostroPrecio || lead.calidad_lead === 'alto' || lead.calidad_lead === 'convertido') {
          nuevaEtapa = 'calificado';
        }
      }

      if (nuevaEtapa !== etapaActual) {
        await db.update('leads', lead.id, { etapa_pipeline: nuevaEtapa });
        actualizados++;
      }
    }
    if (actualizados > 0) console.log(`[bot] Migración etapas: ${actualizados} leads actualizados.`);
  } catch (e) {
    console.error('[bot] Error en migración de etapas:', e.message);
  }
}

// ─── Cart session helpers ─────────────────────────────────────────────────────

function _norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function _buildResumen(cart) {
  const lineas = cart.map(item => {
    const subtotal = item.precio * item.qty;
    return `• ${item.nombre}\n  SKU: ${item.sku} | Cantidad: ${item.qty} | $${subtotal.toLocaleString('es-CL')}`;
  });
  const total = cart.reduce((s, i) => s + i.precio * i.qty, 0);
  return `Acá está tu pedido:\n\n${lineas.join('\n\n')}\n\n*Total: $${total.toLocaleString('es-CL')}*\n\n¿Confirmas para que te envíe el link de compra?`;
}

function _buildPendingSkus(productosCtx) {
  const wooMapData = dataStore.getWooMap();
  if (!Object.keys(wooMapData).length) console.warn('[bot] WooMap vacío — wooId quedará null');
  return productosCtx.filter(p => p.sku).map(p => {
    const wooId = wooMapData[p.sku] || wooMapData[p.sku?.toUpperCase()] || null;
    if (!wooId) console.warn('[bot] SKU sin wooId:', p.sku);
    return { sku: p.sku, wooId, nombre: p.nombre_web || p.descripcion || p.sku, precio: p.precio || 0 };
  });
}

// ─── Clasificación de intención via GPT ─────────────────────────────────────
// Una llamada liviana que reemplaza TODOS los regex de detección.
// GPT entiende "no", "nah", "ya estoy", "el verde", "2 unidades", etc.
// Costo: ~10 tokens output, ~100 tokens input = centavos por mensaje.

async function clasificarIntencion(texto, fase, cart, pendingSkus, selectedItem, historial) {
  const openai = getOpenAI();
  if (!openai) return { tipo: 'OTRO' };

  const cartResumen = (cart || []).map(i => `${i.nombre} x${i.qty}`).join(', ') || 'vacío';
  const opcionesResumen = (pendingSkus || []).map((p, i) => `${i+1}. ${p.nombre}`).join(', ') || 'ninguna';
  const itemPendiente = selectedItem ? selectedItem.nombre : 'ninguno';
  const ultimos3 = (historial || []).slice(-3).map(m => `${m.rol}: ${m.texto}`).join('\n');

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Eres un clasificador de intención para un bot de ventas por WhatsApp.
El cliente está en la fase "${fase}" de su compra.

Carrito actual: ${cartResumen}
Opciones presentadas: ${opcionesResumen}
Producto pendiente de cantidad: ${itemPendiente}

Últimos mensajes:
${ultimos3}

Clasifica el ÚLTIMO mensaje del cliente en exactamente UNA de estas categorías.
Responde SOLO con el código, nada más:

CIERRE — el cliente NO quiere más productos (ej: "no", "eso es todo", "listo", "nah", "ya", "con eso", "no gracias", "estoy bien", "solo eso")
CONFIRMACION — el cliente confirma/acepta algo (ej: "sí", "dale", "ok", "perfecto", "confirmo", "de acuerdo", "va")
SELECCION:N — el cliente elige la opción N de las presentadas (ej: "el 1", "el rojo", "la más barata", "el primero", "ese"). N es el número de opción (1, 2 o 3). Si dice un color o nombre, identifica cuál opción es.
CANTIDAD:N — el cliente indica una cantidad numérica (ej: "2", "necesito 3", "5 unidades", "quiero 10"). N es el número.
SELECCION_Y_CANTIDAD:N:Q — el cliente elige opción N Y da cantidad Q en el mismo mensaje (ej: "2 del rojo", "quiero 3 del primero", "necesito 5 unidades del azul")
PRODUCTO — el cliente pide un producto NUEVO o diferente (ej: "bolsas de basura", "también necesito cinta", "y guantes?")
PREGUNTA — el cliente hace una pregunta sobre los productos (ej: "cuál es mejor?", "de qué material es?", "hay otro color?")
MODIFICAR — el cliente quiere cambiar algo del pedido (ej: "mejor 3 en vez de 2", "quita el rojo", "cambia por el verde")
OTRO — no encaja en ninguna categoría anterior`
      }, {
        role: 'user',
        content: texto
      }],
      max_tokens: 20,
      temperature: 0,
    });

    const raw = (resp.choices[0]?.message?.content || 'OTRO').trim().toUpperCase();

    if (raw === 'CIERRE') return { tipo: 'CIERRE' };
    if (raw === 'CONFIRMACION') return { tipo: 'CONFIRMACION' };
    if (raw === 'PRODUCTO') return { tipo: 'PRODUCTO' };
    if (raw === 'PREGUNTA') return { tipo: 'PREGUNTA' };
    if (raw === 'MODIFICAR') return { tipo: 'MODIFICAR' };

    const selMatch = raw.match(/^SELECCION:(\d+)$/);
    if (selMatch) return { tipo: 'SELECCION', indice: parseInt(selMatch[1]) };

    const qtyMatch = raw.match(/^CANTIDAD:(\d+)$/);
    if (qtyMatch) return { tipo: 'CANTIDAD', cantidad: parseInt(qtyMatch[1]) };

    const syqMatch = raw.match(/^SELECCION_Y_CANTIDAD:(\d+):(\d+)$/);
    if (syqMatch) return { tipo: 'SELECCION_Y_CANTIDAD', indice: parseInt(syqMatch[1]), cantidad: parseInt(syqMatch[2]) };

    return { tipo: 'OTRO' };
  } catch (e) {
    console.error('[clasificarIntencion] Error:', e.message);
    return { tipo: 'OTRO' };
  }
}

// ─── Main processor ───────────────────────────────────────────────────────────

async function procesarMensaje(phone, texto, conversacionExistente = null, opciones = {}) {
  const { testMode = false, canal_tipo = 'web_whatsapp', nombrePerfil = null } = opciones;
  logger.info(`Bot [${phone}]: "${texto.slice(0, 60)}"`);

  if (texto.trim().toLowerCase() === '/reset') {
    resetEstado(phone);
    // Cerrar todas las conversaciones activas del phone (no borrar, solo marcar cerradas)
    const todasConvs = await db.getAll('conversaciones');
    const convsDelPhone = todasConvs.filter(c => c.phone === phone && c.bot_activo !== false);
    for (const conv of convsDelPhone) {
      await db.update('conversaciones', conv.id, { bot_activo: false, cerrada_en: new Date().toISOString() });
    }
    return {
      respuesta: '✅ Sesión reiniciada. Escribe "hola" para comenzar de nuevo.',
      derivar: false,
      conversacion: null,
      leadUpdate: {},
      estado: getEstado(phone),
    };
  }

  // ── Nombre de perfil WhatsApp (Meta) ──────────────────────────────────────
  // Solo en estado (prompts); en DB solo si lead no tiene nombre real (ver patch).
  const leadUpdate = {};
  if (nombrePerfil) setEstado(phone, { clienteNombre: nombrePerfil });

  // ── Limpiar estado si es conversación nueva (evita herencia de sesiones previas) ──
  if (!conversacionExistente || (conversacionExistente.mensajes || []).length <= 1) {
    resetEstado(phone);
  }

  // ── PASO 1: Leer estado actual ────────────────────────────────────────────
  const estado = getEstado(phone);
  const _canalAntesDeProcesar = estado.canal; // snapshot para detectar primera clasificación mayorista
  const historialConv = (conversacionExistente?.mensajes || [])
    .filter(m => {
      const r = m.rol || m.role || m.from || '';
      return r === 'cliente' || r === 'bot' || r === 'user' || r === 'assistant';
    })
    .map(m => ({
      ...m,
      rol: m.rol || (m.role === 'user' ? 'cliente' : m.role === 'assistant' ? 'bot' : (m.from || m.role || m.rol)),
      texto: m.texto || m.content || m.text || '',
    }));

  if (!historialConv || historialConv.length === 0) {
    setEstado(phone, { skusConfirmados: [] });
  }

  // ── PASO 2: Detección silenciosa de RUT (siempre, en cualquier etapa) ────
  if (!estado.rut && !estado.rut_no_encontrado) {
    // FIX 2: si el bot acaba de preguntar "¿eres cliente?" y el cliente dice que no → fijar ecommerce
    const _ultimoBotMsg = historialConv.filter(m => m.rol === 'bot').slice(-1)[0]?.texto || '';
    if (/ya eres cliente|has comprado|eres cliente/i.test(_ultimoBotMsg) &&
        /^(no|nop|nel|para nada|negativo|nunca|tampoco|ni)\b/i.test(texto.trim())) {
      setEstado(phone, { canal: 'ecommerce', rut: null, ejecutivoAsignado: null });
      leadUpdate.segmento = 'ecommerce';
      leadUpdate.canal = 'ecommerce';
    } else {
      const rutExtraido = extraerRut(texto);
      if (rutExtraido) {
        const rutNorm = normalizarRut(rutExtraido);
        const resultado = datos.clasificarPorRut(rutExtraido);
        if (resultado.tipo !== 'nuevo') {
          // Cliente encontrado en Clientes.csv (activo o inactivo)
          const ejecutivoUsername = datos.resolverEjecutivo(resultado.ejecutivo);
          const ejecutivoNombre = ejecutivoUsername
            ? (datos.buscarEjecutivo(ejecutivoUsername)?.nombre || null) : null;
          setEstado(phone, {
            etapa: 'activo',
            canal: resultado.canal,
            rut: rutNorm,
            ejecutivoAsignado: ejecutivoUsername,
            clienteNombre: resultado.razonSocial || null,
            tipoCliente: resultado.tipo,
          });
          leadUpdate.nombre = resultado.razonSocial || '';
          leadUpdate.empresa = resultado.razonSocial || '';
          leadUpdate.rut = rutNorm;
          leadUpdate.segmento = resultado.canal;
          leadUpdate.canal = resultado.canal;
          leadUpdate.ejecutivo_asignado = ejecutivoUsername || null;
          leadUpdate.ejecutivo_nombre = ejecutivoNombre || ejecutivoUsername || '';
          leadUpdate.tipo_cliente = resultado.tipo;
          if (resultado.cliente?.email)   leadUpdate.email = resultado.cliente.email;
          if (resultado.cliente?.celular) leadUpdate.fono  = resultado.cliente.celular;
          if (resultado.cliente?.giro)    leadUpdate.giro  = resultado.cliente.giro;
        } else {
          // RUT no encontrado — manejar reintentos
          const intentosPrevios = estado.intentos_rut_fallidos || 0;
          const nuevosIntentos = intentosPrevios + 1;

          if (nuevosIntentos >= 2) {
            setEstado(phone, {
              etapa: 'activo',
              canal: 'ecommerce',
              intentos_rut_fallidos: nuevosIntentos,
              rut_no_encontrado: true,
            });
            leadUpdate.segmento = 'ecommerce';
            leadUpdate.canal = 'ecommerce';
            const ejecutivosEcom = ['marcelis.arguelles', 'mauricio.santibanez'];
            const ecomIdx = Math.floor(Date.now() / 60000) % ejecutivosEcom.length;
            leadUpdate.ejecutivo_asignado = ejecutivosEcom[ecomIdx];
          } else {
            setEstado(phone, {
              intentos_rut_fallidos: nuevosIntentos,
              rut_fallido_previo: rutNorm,
            });
            // No tocar leadUpdate — no grabar nada del RUT fallido
          }
        }
      }
    }
  }

  // Releer estado tras posible actualización
  const estadoActual = getEstado(phone);
  if (!estadoActual.canal && conversacionExistente?.canal) {
    estadoActual.canal = conversacionExistente.canal;
  }

  // ── Detectar primera clasificación como mayorista → flag para saludo ──────
  const _esPrimeraMayorista = (
    estadoActual.canal === 'mayorista' &&
    _canalAntesDeProcesar !== 'mayorista' &&
    !estadoActual.mayoristaSaludado
  );
  if (_esPrimeraMayorista) {
    setEstado(phone, { mayoristaSaludado: true });
  }

  if (!estadoActual.clienteNombre) {
    const matchNombre = texto.match(/(?:me llamo|soy|mi nombre es)\s+([A-Za-záéíóúñÁÉÍÓÚÑ\s]{3,40})/i);
    if (matchNombre) {
      const nombre = matchNombre[1].trim();
      setEstado(phone, { clienteNombre: nombre });
      leadUpdate.nombre = nombre;
    }
  }

  if (!getEstado(phone).telefonoContacto) {
    const matchTel = texto.match(/(?:\+?56\s*)?9\d{8}/);
    if (matchTel && !extraerRut(texto)) {
      setEstado(phone, { telefonoContacto: matchTel[0] });
      leadUpdate.telefono_contacto = matchTel[0];
    }
  }

  // ── PASO 3: Construir contextoCliente ─────────────────────────────────────
  const mencionaCotizacion = /cotiz|me cotiz|cotización|lo que me cotiz|precio que me dier|me dieron precio|cuánto me cotiz/i.test(texto);
  const mencionaPedido = /pedido|mi pedido|nota de venta|NV\s*\d|cuando llega|despacho|entrega|tracking|mi orden|mi compra|seguimiento|n[uú]mero de pedido|estado de mi/i.test(texto);
  let contextoCliente = null;
  if (estadoActual.rut && estadoActual.canal === 'mayorista') {
    const usuarioEj = estadoActual.ejecutivoAsignado
      ? datos.buscarEjecutivo(estadoActual.ejecutivoAsignado)
      : null;
    contextoCliente = {
      empresa:         estadoActual.clienteNombre || '',
      rut:             estadoActual.rut,
      ejecutivoNombre: usuarioEj?.nombre || 'un ejecutivo de ventas',
      ejecutivoFono:   usuarioEj?.fono   || null,
      ejecutivoEmail:  usuarioEj?.email  || null,
      pedidos:         datos.buscarPedidosPorRut(estadoActual.rut),
      wooOrders:       mencionaPedido ? dataStore.getWooOrdersByRut(estadoActual.rut) : [],
    };
    if (mencionaCotizacion) {
      contextoCliente.cotizaciones = datos.buscarCotizacionesPorRut(estadoActual.rut)
        .slice(0, 5)
        .map(c => `Fecha: ${c.fecha} | SKU: ${c.codigo} | Producto: ${c.descripcion} | Precio cotizado: $${Number(c.precioCotizado).toLocaleString('es-CL')} | Estado: ${c.estado}`);
    }
  } else if (estadoActual.rut && (mencionaPedido || mencionaCotizacion)) {
    contextoCliente = { rut: estadoActual.rut, esEcommerce: true };
    if (mencionaPedido) contextoCliente.pedidos = datos.buscarPedidosPorRut(estadoActual.rut);
    if (mencionaPedido) contextoCliente.wooOrders = dataStore.getWooOrdersByRut(estadoActual.rut);
    if (mencionaCotizacion) {
      contextoCliente.cotizaciones = datos.buscarCotizacionesPorRut(estadoActual.rut)
        .slice(0, 5)
        .map(c => `Fecha: ${c.fecha} | SKU: ${c.codigo} | Producto: ${c.descripcion} | Precio cotizado: $${Number(c.precioCotizado).toLocaleString('es-CL')} | Estado: ${c.estado}`);
    }
  }

  // ── CAMBIO 5: Pedido mencionado sin RUT → pedir RUT directamente ─────────
  const TRIGGERS_PEDIDO_WOO = /pedido|cu[aá]ndo llega|estado.*compra|n[uú]mero.*pedido|nro.*pedido|seguimiento/i;
  if (TRIGGERS_PEDIDO_WOO.test(texto) && !estadoActual.rut) {
    const rPedido = 'Para consultar el estado de tu pedido necesito tu RUT. ¿Me lo puedes dar?';
    const convP = await _guardarMensajes(phone, texto, rPedido, conversacionExistente, canal_tipo);
    return { respuesta: rPedido, derivar: false, conversacion: convP, leadUpdate, estado: getEstado(phone) };
  }

  // ── CAMBIO 6: Cotización mencionada sin RUT → pedir RUT directamente ─────
  const TRIGGERS_COTIZ_RAMA = /cotizaci[oó]n|presupuesto|cotizaron|me.*cotiz|tienen.*precio.*de|me.*mandaron.*precio/i;
  if (TRIGGERS_COTIZ_RAMA.test(texto) && !estadoActual.rut) {
    const rCotiz = 'Para consultar tus cotizaciones necesito tu RUT. ¿Me lo puedes dar?';
    const convC = await _guardarMensajes(phone, texto, rCotiz, conversacionExistente, canal_tipo);
    return { respuesta: rCotiz, derivar: false, conversacion: convC, leadUpdate, estado: getEstado(phone) };
  }

  // ── PASO 4: Detección silenciosa de afirmación de contacto ───────────────
  if (estadoActual.ejecutivoAsignado && contextoCliente) {
    const ultimoBotTexto = historialConv.filter(m => m.rol === 'bot').slice(-1)[0]?.texto || '';
    const botOfrecioContacto = /quieres que|te contacte|te llame|llamarte|ponerte en contacto/i.test(ultimoBotTexto);
    const clienteAfirma = /\b(sí|si|claro|dale|ok|bueno|perfecto|que me llame|por favor|porfa|afirmativo|adelante|va)\b/i.test(texto.toLowerCase());
    if (botOfrecioContacto && clienteAfirma) {
      await sendWhatsAppAlert(estadoActual.ejecutivoAsignado, phone, estadoActual.rut, historialConv);
      leadUpdate.etapa_pipeline = 'derivado';
      if (conversacionExistente?.lead_id) {
        await db.update('leads', conversacionExistente.lead_id, {
          etapa_pipeline: 'derivado',
          ejecutivo_asignado: estadoActual.ejecutivoAsignado,
        });
      }
    }
  }

  // ── BUG 1: Detección explícita de pedido de ejecutivo (ANTES del GPT) ────
  const _PATRON_DERIVACION = [
    /comunica[rme]* con/i, /hablar con/i, /contacta[rme]* con/i,
    /pasa[rme]* con/i, /quiero hablar con/i, /me puedes? comunicar/i,
    /quiero que me llame/i, /dame el contacto de/i, /pon[eme]* en contacto/i,
    /quiero un ejecutivo/i, /ejecutivo de ventas/i, /hablar con alguien/i,
    /quiero hablar con una persona/i, /quiero atenci[oó]n personalizada/i,
  ];
  const _NOMBRES_EJECUTIVOS = {
    marcelis: 'marcelis.arguelles', arguelles: 'marcelis.arguelles',
    mauricio: 'mauricio.santibanez', santibanez: 'mauricio.santibanez',
  };
  if (_PATRON_DERIVACION.some(p => p.test(texto)) && !estadoActual.alertaMayoristaEnviada) {
    const _textoNorm = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let _ejDeriv = null;
    for (const [token, username] of Object.entries(_NOMBRES_EJECUTIVOS)) {
      if (_textoNorm.includes(token)) { _ejDeriv = username; break; }
    }
    if (!_ejDeriv) _ejDeriv = estadoActual.ejecutivoAsignado || 'marcelis.arguelles';
    setEstado(phone, { ejecutivoAsignado: _ejDeriv });
    leadUpdate.ejecutivo_asignado = _ejDeriv;
    leadUpdate.etapa_pipeline = 'derivado';
    const _CALIDAD_ORD = ['bajo', 'medio', 'alto', 'convertido'];
    if (_CALIDAD_ORD.indexOf(leadUpdate.calidad_lead || 'bajo') < 1) leadUpdate.calidad_lead = 'medio';
    if (conversacionExistente?.lead_id) {
      try {
        await db.update('leads', conversacionExistente.lead_id, {
          ejecutivo_asignado: _ejDeriv,
          etapa_pipeline: 'derivado',
        });
      } catch (_e) {}
    }
  }

  // ── Variables de turno (usadas en motor y en hints) ─────────────────────
  const _mensajesCliente = historialConv.filter(m => m.rol === 'cliente');
  const _mensajesBot     = historialConv.filter(m => m.rol === 'bot');

  // ── MOTOR DE ESTADOS ─────────────────────────────────────────────────────
  const { buildCartUrl } = require('../utils/wooCart');
  const canalActual = (estadoActual?.canal || conversacionExistente?.canal || 'ecommerce').toLowerCase().trim();
  const fase = estadoActual.fase || 'explorando';

  let respuesta = null;
  let _systemHint = null;
  let productosCtx = [];
  let conocimientoCtx = [];

  // ── FASE 2: Consulta de pedidos para clientes mayoristas ─────────────────
  const _PEDIDO_KW = /pedido|despacho|nota\s*de\s*venta|factura|entrega|orden|donde\s*est|cuando\s*llega|estado/i;
  if (
    canalActual === 'mayorista' &&
    estadoActual.rut &&
    _PEDIDO_KW.test(texto.normalize('NFD').replace(/[̀-ͯ]/g, ''))
  ) {
    const _pedidosFTP = datos.buscarEstadoPedidosPorRut(estadoActual.rut);
    let _respPedido;
    if (_pedidosFTP.length === 0) {
      _respPedido = 'No encontré pedidos registrados para tu RUT. Si crees que hay un error, escríbeme el número de nota de venta y lo reviso.';
    } else {
      const _top5 = _pedidosFTP.slice(0, 5);
      const _lineas = _top5.map(p =>
        `*NV ${p.notaVenta}* — ${p.statusPedido || p.estado || 'Sin estado'}\n📅 Fecha: ${p.fechaNV || '-'}\n🚚 Entrega estimada: ${p.fechaEntrega || 'sin fecha'}`
      ).join('\n\n');
      _respPedido = `📦 *Tus últimos pedidos:*\n\n${_lineas}\n\n¿Necesitas más detalle sobre alguno?`;

      // Alerta al ejecutivo asignado
      if (estadoActual.ejecutivoAsignado) {
        const _ejAlert = datos.buscarEjecutivo(estadoActual.ejecutivoAsignado);
        const _ejFono = _ejAlert?.fono || _ejAlert?.telefono;
        if (_ejFono) {
          const _pUlt = _pedidosFTP[0];
          const _alertMsg =
            `🔔 *Alerta FunnelOS* — Tu cliente *${estadoActual.clienteNombre || 'cliente'}* ` +
            `(RUT ${estadoActual.rut}) consultó el estado de su pedido.\n` +
            `Última NV: ${_pUlt.notaVenta} — Estado: ${_pUlt.statusPedido || _pUlt.estado}\n` +
            `Revisar si requiere gestión.`;
          try {
            const { enviarMensaje } = require('../../integrations/whatsappAdapter');
            await enviarMensaje(_ejFono, _alertMsg);
          } catch (_e) {
            logger.warn(`[bot] Alerta pedido ejecutivo no enviada: ${_e.message}`);
          }
        }
      }
    }
    const _convPedido = await _guardarMensajes(phone, texto, _respPedido, conversacionExistente, canal_tipo);
    return { respuesta: _respPedido, derivar: false, conversacion: _convPedido, leadUpdate, estado: getEstado(phone) };
  }

  // ── CLASIFICAR INTENCIÓN VIA GPT ─────────────────────────────────────
  const intencion = await clasificarIntencion(
    texto, fase, estadoActual.cart, estadoActual.pendingSkus,
    estadoActual.selectedItem, historialConv
  );
  console.log(`[MOTOR] fase=${fase} intencion=${JSON.stringify(intencion)} texto="${texto.slice(0,40)}"`);

  // ════════════════════════════════════════════════════════════════════════
  // FASE: CERRANDO — esperando confirmación del resumen
  // ════════════════════════════════════════════════════════════════════════
  if (fase === 'cerrando') {
    if (intencion.tipo === 'CONFIRMACION') {
      const _cartItems = estadoActual.cart || [];
      if (_cartItems.length > 0 && (canalActual === 'ecommerce' || !canalActual)) {
        // Re-enriquecer wooIds con el WooMap actual (puede haberse cargado después de acumular)
        const _wooMapFresh = dataStore.getWooMap();
        const _cartEnriquecido = _cartItems.map(item => {
          if (item.wooId) return item;
          const wooId = _wooMapFresh[item.sku] || _wooMapFresh[item.sku?.toUpperCase()] || null;
          if (!wooId) console.warn('[bot/cierre] SKU sin wooId al cerrar:', item.sku);
          return { ...item, wooId };
        });
        console.log('[bot/cierre] cart al cerrar:', JSON.stringify(_cartEnriquecido.map(i => ({ sku: i.sku, wooId: i.wooId, qty: i.qty }))));

        const _url = buildCartUrl(_cartEnriquecido);
        if (_url) {
          respuesta = `¡Listo! 🛒 Aquí está tu link para completar la compra:\n${_url}`;
          leadUpdate.link_carrito_enviado = true;
          leadUpdate.etapa_pipeline = 'ganado';
          setEstado(phone, { fase: 'explorando', cart: [], pendingSkus: [], selectedItem: null });
          if (conversacionExistente?.lead_id) {
            try {
              await db.update('leads', conversacionExistente.lead_id, {
                link_carrito_enviado: true, etapa_pipeline: 'ganado',
                ultima_actividad: new Date().toISOString(),
              });
            } catch (_e) {}
          }
        } else {
          const _skusFallback = _cartEnriquecido.map(i => `${i.sku} x${i.qty || 1}`).join(', ');
          respuesta = `¡Listo! Para completar tu compra ve directamente a nuestra tienda 🛒\nhttps://cruzeirogomas.cl/tienda/\n\nTus productos: ${_skusFallback}`;
          leadUpdate.link_carrito_enviado = true;
          leadUpdate.etapa_pipeline = 'ganado';
          setEstado(phone, { fase: 'explorando', cart: [], pendingSkus: [], selectedItem: null });
        }
      } else {
        respuesta = 'Para completar tu pedido, un ejecutivo te contactará con el detalle.';
      }
      if (respuesta) {
        const _convCerrando = await _guardarMensajes(phone, texto, respuesta, conversacionExistente, canal_tipo);
        return { respuesta, derivar: false, conversacion: _convCerrando, leadUpdate, estado: getEstado(phone) };
      }

    } else if (intencion.tipo === 'MODIFICAR' || intencion.tipo === 'PRODUCTO') {
      setEstado(phone, { fase: 'acumulando' });
      _systemHint = 'El cliente quiere modificar el pedido o agregar algo. Pregunta qué quiere cambiar.';

    } else {
      // Cualquier otra cosa en cerrando → repetir el resumen
      respuesta = _buildResumen(estadoActual.cart || []);
      const _convRes = await _guardarMensajes(phone, texto, respuesta, conversacionExistente, canal_tipo);
      return { respuesta, derivar: false, conversacion: _convRes, leadUpdate, estado: getEstado(phone) };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // FASE: CONFIRMANDO_QTY — esperando cantidad del ítem elegido
  // ════════════════════════════════════════════════════════════════════════
  else if (fase === 'confirmando_qty' && estadoActual.selectedItem) {
    const _item = estadoActual.selectedItem;

    if (intencion.tipo === 'CANTIDAD' || intencion.tipo === 'SELECCION_Y_CANTIDAD') {
      const _qty = intencion.cantidad || 1;
      const _cartActual = estadoActual.cart || [];
      const _idx = _cartActual.findIndex(c => c.sku === _item.sku);
      const _cartNuevo = [..._cartActual];
      if (_idx >= 0) {
        _cartNuevo[_idx] = { ..._cartNuevo[_idx], qty: _qty };
      } else {
        _cartNuevo.push({ ..._item, qty: _qty });
      }
      setEstado(phone, { fase: 'acumulando', cart: _cartNuevo, selectedItem: null, pendingSkus: [] });
      _systemHint = `El cliente confirmó ${_qty} unidad(es) de "${_item.nombre}". Confirma: "Perfecto, ${_qty} ${_item.nombre}." Luego pregunta: "¿Necesitas algo más?" NO digas "agregué".`;

    } else if (intencion.tipo === 'CIERRE') {
      _systemHint = `El cliente quiere cerrar pero aún no indicó cuántas unidades de "${_item.nombre}" necesita. Pregunta SOLO: "¿Cuántas unidades de ${_item.nombre} necesitas?"`;

    } else if (intencion.tipo === 'PRODUCTO') {
      const _qExpVar = await expandirQueryBusqueda(texto);
      let { productos: _prodsVar } = datos.buscarProductos(_qExpVar || texto, canalActual);
      if (_prodsVar.length === 0 && _qExpVar) { _prodsVar = datos.buscarProductos(texto, canalActual).productos; }
      conocimientoCtx = getCatalogAdapter().buscarConocimiento(texto);
      if (_prodsVar.length > 0) {
        productosCtx = _prodsVar;
        const _newPending = _buildPendingSkus(productosCtx);
        setEstado(phone, { fase: 'eligiendo', pendingSkus: _newPending, selectedItem: null });
      } else {
        _systemHint = `No encontré "${texto}" en catálogo. Díselo al cliente y vuelve a preguntar la cantidad de "${_item.nombre}".`;
      }

    } else if (intencion.tipo === 'PREGUNTA') {
      conocimientoCtx = getCatalogAdapter().buscarConocimiento(texto);
      _systemHint = `El cliente preguntó sobre "${_item.nombre}". Responde con lo que sabes. Luego vuelve a preguntar la cantidad.`;

    } else {
      _systemHint = `El cliente no dio una cantidad clara. Repregunta: "¿Cuántas unidades de ${_item.nombre} necesitas?"`;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // FASE: ELIGIENDO — esperando que elija entre opciones
  // ════════════════════════════════════════════════════════════════════════
  else if (fase === 'eligiendo') {
    const _pending = estadoActual.pendingSkus || [];

    if ((intencion.tipo === 'SELECCION' || intencion.tipo === 'SELECCION_Y_CANTIDAD') && _pending.length > 0) {
      const _idxOpc = Math.min(Math.max(0, (intencion.indice || 1) - 1), _pending.length - 1);
      const _item = _pending[_idxOpc];
      const _qty = intencion.cantidad || null;

      if (_qty) {
        const _cartActual = estadoActual.cart || [];
        const _idxCart = _cartActual.findIndex(c => c.sku === _item.sku);
        const _cartNuevo = [..._cartActual];
        if (_idxCart >= 0) { _cartNuevo[_idxCart] = { ..._cartNuevo[_idxCart], qty: _qty }; }
        else { _cartNuevo.push({ ..._item, qty: _qty }); }
        setEstado(phone, { fase: 'acumulando', cart: _cartNuevo, pendingSkus: [], selectedItem: null });
        _systemHint = `El cliente eligió "${_item.nombre}" y necesita ${_qty} unidades. Confirma: "Perfecto, ${_qty} ${_item.nombre}." Luego: "¿Necesitas algo más?"`;
      } else {
        setEstado(phone, { fase: 'confirmando_qty', selectedItem: _item, pendingSkus: [] });
        _systemHint = `El cliente eligió "${_item.nombre}" (SKU: ${_item.sku}, precio: $${Number(_item.precio).toLocaleString('es-CL')}). Pregunta SOLO: "¿Cuántas unidades necesitas?"`;
      }

    } else if (intencion.tipo === 'CIERRE' && (estadoActual.cart || []).length > 0) {
      setEstado(phone, { fase: 'cerrando', pendingSkus: [] });
      respuesta = _buildResumen(estadoActual.cart);
      const _convCierre = await _guardarMensajes(phone, texto, respuesta, conversacionExistente, canal_tipo);
      return { respuesta, derivar: false, conversacion: _convCierre, leadUpdate, estado: getEstado(phone) };

    } else if (intencion.tipo === 'PRODUCTO') {
      const _qExpNuevos = await expandirQueryBusqueda(texto);
      let { productos: _prodsNuevos } = datos.buscarProductos(_qExpNuevos || texto, canalActual);
      if (_prodsNuevos.length === 0 && _qExpNuevos) { _prodsNuevos = datos.buscarProductos(texto, canalActual).productos; }
      conocimientoCtx = getCatalogAdapter().buscarConocimiento(texto);
      if (_prodsNuevos.length > 0) {
        productosCtx = _prodsNuevos;
        const _newPending = _buildPendingSkus(productosCtx);
        setEstado(phone, { fase: 'eligiendo', pendingSkus: _newPending });
      } else {
        _systemHint = `No encontré "${texto}" en catálogo. Díselo al cliente y pregunta cuál de las opciones anteriores prefiere.`;
      }

    } else if (intencion.tipo === 'PREGUNTA') {
      conocimientoCtx = getCatalogAdapter().buscarConocimiento(texto);
      _systemHint = 'El cliente tiene una pregunta sobre los productos. Responde con lo que sabes. Luego pregunta cuál de las opciones prefiere.';

    } else if (intencion.tipo === 'CANTIDAD' && _pending.length === 1) {
      const _item = _pending[0];
      const _qty = intencion.cantidad || 1;
      const _cartActual = estadoActual.cart || [];
      const _cartNuevo = [..._cartActual];
      const _idxCart = _cartActual.findIndex(c => c.sku === _item.sku);
      if (_idxCart >= 0) { _cartNuevo[_idxCart] = { ..._cartNuevo[_idxCart], qty: _qty }; }
      else { _cartNuevo.push({ ..._item, qty: _qty }); }
      setEstado(phone, { fase: 'acumulando', cart: _cartNuevo, pendingSkus: [], selectedItem: null });
      _systemHint = `Solo había una opción y el cliente pidió ${_qty}. Confirma: "Perfecto, ${_qty} ${_item.nombre}." Luego: "¿Necesitas algo más?"`;

    } else {
      _systemHint = 'No entendí la selección del cliente. Muestra las opciones de nuevo con nombre, SKU y precio, y pregunta cuál prefiere.';
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // FASE: ACUMULANDO — tiene ítems, esperando si quiere más
  // ════════════════════════════════════════════════════════════════════════
  else if (fase === 'acumulando') {
    if (intencion.tipo === 'CIERRE' || intencion.tipo === 'CONFIRMACION') {
      const _cart = estadoActual.cart || [];
      if (_cart.length > 0) {
        setEstado(phone, { fase: 'cerrando' });
        respuesta = _buildResumen(_cart);
        const _convCierre = await _guardarMensajes(phone, texto, respuesta, conversacionExistente, canal_tipo);
        return { respuesta, derivar: false, conversacion: _convCierre, leadUpdate, estado: getEstado(phone) };
      } else {
        _systemHint = 'El cliente no necesita nada más. Despídete amablemente.';
      }

    } else if (intencion.tipo === 'PRODUCTO' || intencion.tipo === 'PREGUNTA') {
      const _qExpAcum = await expandirQueryBusqueda(texto);
      let { productos: _prodsAcum } = datos.buscarProductos(_qExpAcum || texto, canalActual);
      if (_prodsAcum.length === 0 && _qExpAcum) { _prodsAcum = datos.buscarProductos(texto, canalActual).productos; }
      conocimientoCtx = getCatalogAdapter().buscarConocimiento(texto);
      if (_prodsAcum.length > 0) {
        productosCtx = _prodsAcum;
        const _newPending = _buildPendingSkus(productosCtx);
        setEstado(phone, { fase: 'eligiendo', pendingSkus: _newPending });
        if (intencion.tipo === 'PREGUNTA') {
          _systemHint = 'El cliente pregunta por algo. Muestra las opciones encontradas con SKU y precio.';
        }
      } else {
        _systemHint = `No encontré "${texto}" en catálogo. Díselo honestamente y pregunta si necesita algo más.`;
      }

    } else if (intencion.tipo === 'MODIFICAR') {
      _systemHint = 'El cliente quiere modificar el pedido. Pregunta qué quiere cambiar.';

    } else {
      // OTRO — intentar buscar producto; si no hay, tratar como cierre
      const _qExpOtro = await expandirQueryBusqueda(texto);
      let { productos: _prodsOtro } = datos.buscarProductos(_qExpOtro || texto, canalActual);
      if (_prodsOtro.length === 0 && _qExpOtro) { _prodsOtro = datos.buscarProductos(texto, canalActual).productos; }
      if (_prodsOtro.length > 0) {
        productosCtx = _prodsOtro;
        const _newPending = _buildPendingSkus(productosCtx);
        setEstado(phone, { fase: 'eligiendo', pendingSkus: _newPending });
      } else {
        const _cart = estadoActual.cart || [];
        if (_cart.length > 0) {
          setEstado(phone, { fase: 'cerrando' });
          respuesta = _buildResumen(_cart);
          const _convCierre = await _guardarMensajes(phone, texto, respuesta, conversacionExistente, canal_tipo);
          return { respuesta, derivar: false, conversacion: _convCierre, leadUpdate, estado: getEstado(phone) };
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // FASE: EXPLORANDO (default) — primera búsqueda
  // ════════════════════════════════════════════════════════════════════════
  else {
    const _ultimoCliente = historialConv.filter(m => m.rol === 'cliente').slice(-1)[0]?.texto || '';
    const _queryProductos = [_ultimoCliente, texto].filter(Boolean).join(' ');

    // ── GUARD: bloquear búsqueda en turnos de identificación ─────────────
    // El bloque de hints (más abajo) corre DESPUÉS de este bloque, así que
    // estadoActual.canal puede no reflejar aún el canal del turno en curso.
    // Usamos señales directas del historial en lugar de depender del estado.
    const _ultimoBotExplorando = _mensajesBot.slice(-1)[0]?.texto || '';
    const _botPreguntoSiEsCliente = /ya eres cliente|eres cliente|cliente de cruzeiro|me das tu rut|dame tu rut/i.test(_ultimoBotExplorando);

    // Turno 2: cliente responde sí/no a "¿eres cliente?" → no buscar todavía
    const _clienteRespondeIdentificacion =
      _botPreguntoSiEsCliente &&
      !estadoActual.rut &&
      /^(no|nop|nel|para nada|negativo|nunca|tampoco|ni|primera vez|nuevo|s[ií]|dale|claro|soy|tengo|afirmativo)\b/i.test(texto.trim());

    // Turno 1: cliente dice qué quiere, bot aún no preguntó si es cliente → no buscar
    const _esTurno1SinIdentificar =
      _mensajesCliente.length === 1 &&
      !estadoActual.rut &&
      !_botPreguntoSiEsCliente;

    if (_clienteRespondeIdentificacion || _esTurno1SinIdentificar) {
      productosCtx = [];
      // Si el cliente dice "no" → fijar canal ecommerce YA, sin esperar al bloque de hints
      if (_clienteRespondeIdentificacion) {
        const _diceNo = /^(no|nop|nel|para nada|negativo|nunca|tampoco|ni|primera vez|nuevo)\b/i.test(texto.trim());
        if (_diceNo) {
          setEstado(phone, { canal: 'ecommerce', rut: null, ejecutivoAsignado: null });
        }
      }
      // No cambiar de fase — el hint de identificación maneja este turno
    } else {
      // Determinar si tenemos suficiente contexto de uso para mostrar catálogo
      const _botYaPregunto = /para qu[eé]|qu[eé] uso|qu[eé] espacio|d[oó]nde lo vas|interior|exterior|aplicaci[oó]n|cu[aá]ntos m|cu[aá]l es el [aá]rea/i.test(_ultimoBotExplorando);
      const _clienteMencionoUso = /para\s+(?:el|la|un|una|mi|\w+)|en\s+(?:el|la|mi|un|una)|(?:interior|exterior|cocina|ba[nñ]o|terraza|pasillo|bodega|garaje|taller|oficina|escalera|rampa|piscina|industria|hospital|colegio|estadio)/i.test(texto);
      const _textoEsCorto = texto.trim().split(/\s+/).length <= 4;
      const _necesitaContexto =
        canalActual !== 'mayorista' &&
        _textoEsCorto &&
        !_botYaPregunto &&
        !_clienteMencionoUso &&
        historialConv.length < 6;

      // Identificación completa: tiene RUT, se confirmó sin RUT, o ya es ecommerce
      const _identificacionCompleta =
        !!estadoActual.rut ||
        !!estadoActual.rut_no_encontrado ||
        estadoActual.canal === 'ecommerce';

      if (_necesitaContexto && _identificacionCompleta) {
        productosCtx = [];
        _systemHint = `El cliente mencionó "${texto}". ANTES de mostrar productos, ` +
          `pregunta UNA sola cosa: ¿para qué espacio o uso lo necesita? ` +
          `(ej: "¿Es para uso industrial, doméstico o comercial?", "¿Dónde lo vas a instalar?"). ` +
          `NO muestres productos todavía.`;
      } else {
        // Si hay producto guardado, expandir solo ese — el uso va a GPT vía historial,
        // no mezclado en la query de búsqueda (evita que "patio" pise a "basureros")
        const _productoPrev = estadoActual.productoBuscado || '';
        const _queryExpandida = _productoPrev
          ? await expandirQueryBusqueda(_productoPrev)
          : await expandirQueryBusqueda(_queryProductos);
        const _queryFinal = _queryExpandida || _productoPrev || _queryProductos;

        let { productos: _prods } = datos.buscarProductos(_queryFinal, canalActual);
        if (_prods.length === 0 && _queryExpandida) {
          _prods = datos.buscarProductos(_queryProductos, canalActual).productos;
        }

        productosCtx = _prods;
        conocimientoCtx = getCatalogAdapter().buscarConocimiento(texto);
        console.log(`[BUSQUEDA] original="${_queryProductos}" expandida="${_queryExpandida || '(none)'}" → ${_prods.length} productos`);

        if (productosCtx.length > 0) {
          const _nuevosSkus = _buildPendingSkus(productosCtx);
          setEstado(phone, { pendingSkus: _nuevosSkus, fase: 'eligiendo' });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // FIN MOTOR — llamar a GPT para generar respuesta si no hay hardcodeada
  // ════════════════════════════════════════════════════════════════════════

  // ── Hint de identificación — UNA sola instrucción por turno ─────────────
  let identificacionHint = '';
  const _turnoCliente  = _mensajesCliente.length;
  const _ultimoBotHint = _mensajesBot.slice(-1)[0]?.texto || '';

  // TURNO 0 — primer mensaje del cliente (historial vacío antes de este turno)
  if (_turnoCliente === 0) {
    identificacionHint =
      'Es el primer mensaje. Saluda brevemente y pregunta solo: "¿En qué te puedo ayudar?" ' +
      'NO preguntes por RUT, NO preguntes para qué uso. Solo saludo + pregunta abierta.';

  // TURNO 1 — cliente ya dijo qué quiere, bot no ha preguntado si es cliente
  } else if (_turnoCliente === 1 && !estadoActual.rut) {
    const _botYaPreguntoCTE = /ya eres cliente|eres cliente|rut|cliente de cruzeiro/i.test(_ultimoBotHint);
    if (!_botYaPreguntoCTE) {
      identificacionHint =
        'El cliente acaba de decir qué necesita. ANTES de buscar productos, pregunta UNA sola cosa: ' +
        '"¿Ya eres cliente de Cruzeiro? Si me das tu RUT te atiendo más rápido, ' +
        'si no, ¡igual te ayudo!" NO muestres productos. NO preguntes el uso todavía.';
    }

  // TURNO 2 — bot preguntó si es cliente, el cliente responde
  } else if (_turnoCliente === 2 && !estadoActual.rut) {
    const _botPreguntoCTE = /ya eres cliente|eres cliente|rut|cliente de cruzeiro/i.test(_ultimoBotHint);
    const _clienteDiceNo  = /^(no|nop|nel|para nada|negativo|nunca|tampoco|ni|primera vez|nuevo)[\s.,!]*/i.test(texto.trim());
    const _clienteDiceSi  = /^(s[ií]|dale|claro|soy|tengo|afirmativo|sí soy|si soy)[\s.,!]*/i.test(texto.trim());

    if (_botPreguntoCTE && _clienteDiceNo) {
      setEstado(phone, { canal: 'ecommerce', rut: null, ejecutivoAsignado: null });
      leadUpdate.segmento = 'ecommerce';
      leadUpdate.canal    = 'ecommerce';
      identificacionHint  =
        'El cliente dijo que NO es cliente de Cruzeiro. Atiéndelo como nuevo, ' +
        'y ahora sí pregunta: "¿Para qué espacio o uso necesitas el producto?"';

    } else if (_botPreguntoCTE && _clienteDiceSi && !extraerRut(texto)) {
      identificacionHint =
        'El cliente dijo que sí es cliente. Pídele el RUT: ' +
        '"¿Me puedes dar tu RUT para buscarte en el sistema?"';
    }
    // Si ya extrajo RUT → el bloque de detección silenciosa (línea ~814) lo procesa solo

  // TURNO 3+ — identificado como mayorista → saludo ejecutivo
  } else if (_esPrimeraMayorista) {
    const _ejSaludo = datos.buscarEjecutivo(estadoActual.ejecutivoAsignado);
    const _ejNombreSaludo    = _ejSaludo?.nombre || 'nuestro ejecutivo de ventas';
    const _razonSocialSaludo = estadoActual.clienteNombre || 'estimado cliente';
    identificacionHint =
      'El cliente acaba de ser identificado como MAYORISTA. ' +
      'Responde EXACTAMENTE con este mensaje (sin agregar nada más):\n' +
      `"Hola ${_razonSocialSaludo}, veo que eres cliente Mayorista de Cruzeiro. ` +
      `Tu ejecutivo asignado es *${_ejNombreSaludo}* — puedes contactarlo directamente ` +
      `si lo prefieres, o seguir conversando conmigo para lo que necesites. 😊"`;

  } else if (estadoActual.rut && estadoActual.tipoCliente === 'inactivo') {
    identificacionHint =
      'El cliente está registrado pero sin compras recientes. ' +
      'Salúdalo: "Te encontramos en el sistema. ¿En qué podemos ayudarte hoy?"';

  } else if (mencionaCotizacion && !estadoActual.rut) {
    identificacionHint = 'El cliente pregunta por una cotización. Pídele el RUT para buscarla.';
  }
  // Si ya está identificado (rut existe y canal definido) → no agregar hint, flujo normal
  const ctxParaPrompt = {
    ...(contextoCliente || {}),
    ...(identificacionHint ? { _hint: identificacionHint } : {}),
  };

  // ── Llamar a OpenAI ───────────────────────────────────────────────────
  respuesta = await llamarOpenAI(texto, productosCtx, historialConv, ctxParaPrompt, conocimientoCtx, _systemHint)
    || 'Estoy aquí para ayudarte. ¿En qué puedo orientarte?';

  // ── FASE 3: Fix placeholder [carrito] si GPT lo escribió por error ───────
  if (respuesta.includes('[carrito]')) {
    const _cartItemsFase3 = estadoActual.cart || [];
    let _urlFase3 = null;
    if (_cartItemsFase3.length > 0) {
      _urlFase3 = buildCartUrl(_cartItemsFase3);
    }
    if (_urlFase3) {
      respuesta = respuesta.replace('[carrito]', _urlFase3);
      leadUpdate.link_carrito_enviado = true;
      setEstado(phone, { fase: 'explorando', cart: [], pendingSkus: [], selectedItem: null });
    } else {
      respuesta = respuesta.replace('[carrito]', 'https://cruzeirogomas.cl/tienda/');
    }
  }

  // ── PASO 10: Guardar y retornar ───────────────────────────────────────────
  const conversacion = await _guardarMensajes(phone, texto, respuesta, conversacionExistente, canal_tipo);
  // ── PASO 10: Upsert de lead con nuevo modelo de identidad ────────────────
  // Clave: RUT si existe (lead empresa), phone sin RUT si no (lead personal)
  // Un mismo phone puede tener N leads con distintos RUT + 1 lead personal
  try {
    const todosLeads = await db.getAll('leads');
    let leadExistente = null;

    if (estadoActual.rut) {
      // Buscar lead por RUT — independiente del phone
      leadExistente = todosLeads.find(l => l.rut === estadoActual.rut) || null;
    } else {
      // Buscar lead personal: mismo phone y sin RUT asignado
      leadExistente = todosLeads.find(l =>
        (l.phone === phone || l.telefono === phone) && !l.rut
      ) || null;
    }

    const leadId = leadExistente?.id || conversacion?.lead_id;

    // ── Clasificación de interés y calidad de lead ────────────────────────────
    const _intencionDet = detectarIntencion(texto);
    if (!leadExistente?.intencion_principal) {
      const _tipo = _intencionDet.tipo;
      if (_tipo !== 'saludo' && _tipo !== 'despedida' && _tipo !== 'desconocido') {
        leadUpdate.intencion_principal = _tipo;
      }
    }

    const _JUNK_FAM = new Set(['', 'Catálogo general', 'Sin clasificar', 'sin_clasificar']);
    const _famActual = leadExistente?.familia_interes || '';
    if ((!_famActual || _JUNK_FAM.has(_famActual)) && Array.isArray(productosCtx) && productosCtx.length > 0) {
      const _fam = productosCtx[0].padre_familia || productosCtx[0].Padre_familia;
      if (_fam && !_JUNK_FAM.has(_fam)) leadUpdate.familia_interes = _fam;
    }

    // Avanzar etapa_pipeline según eventos detectados en este turno
    _detectarEventosPipeline(texto, respuesta, leadUpdate, leadExistente, estadoActual);

    const _CALIDAD_ORDEN = ['bajo', 'medio', 'alto', 'convertido'];
    const _canalCalidad = estadoActual.canal || conversacionExistente?.canal || 'ecommerce';
    let _calidadCalc = 'bajo';
    if (_canalCalidad === 'mayorista') {
      if (leadUpdate.etapa_pipeline === 'derivado') {
        _calidadCalc = 'convertido';
      } else if (estadoActual.rut || leadExistente?.rut) {
        _calidadCalc = 'alto';
      } else if (historialConv.filter(m => m.rol === 'cliente').length > 1) {
        _calidadCalc = 'medio';
      }
    } else {
      if (
        respuesta.includes('cruzeirogomas.cl/carrito') ||
        leadUpdate.etapa_pipeline === 'derivado' ||
        leadUpdate.etapa_pipeline === 'ganado' ||
        /quiero comprar|confirmo|procedo|lo compro|págalo|pagar ahora/i.test(texto) ||
        /cotización formal|quiero cotizar|me mandan cotización|necesito cotización formal/i.test(texto)
      ) {
        _calidadCalc = 'convertido';
      } else if (
        /precio|medida|medidas|dimensi|cuánto|cuanto|link|sku|código|especific|ficha técnica|largo|ancho|espesor|milímetro|mm\b|cantidad|cuántas|cuántos|despacho|envío|forma de pago|transferencia|webpay|khipu/i.test(texto) ||
        (estadoActual.rut && estadoActual.canal === 'ecommerce')
      ) {
        _calidadCalc = 'alto';
      } else if (
        (Array.isArray(productosCtx) && productosCtx.length > 0) ||
        /\b(piso|goma|caucho|pastel[oó]n|grada|escalera|alfombra|rollo|perfil|cinta|tacha|oring|o-ring|epdm|pvc|adhesivo|plancha|baldosa|nomad|seguridad vial|protector|señalética)\b/i.test(texto) ||
        (_intencionDet.tipo !== 'saludo' && _intencionDet.tipo !== 'despedida' &&
         _intencionDet.tipo !== 'desconocido' && historialConv.filter(m => m.rol === 'cliente').length > 1)
      ) {
        _calidadCalc = 'medio';
      }
    }
    const _calidadActual = leadExistente?.calidad_lead || 'bajo';
    const _idxActual = Math.max(0, _CALIDAD_ORDEN.indexOf(_calidadActual));
    const _idxCalc   = Math.max(0, _CALIDAD_ORDEN.indexOf(_calidadCalc));
    leadUpdate.calidad_lead = _CALIDAD_ORDEN[Math.max(_idxActual, _idxCalc)];

    // FIX 2: inferir etapa_pipeline y nunca retroceder
    const etapaActual = leadExistente?.etapa_pipeline || 'nuevo';
    const etapaNueva  = inferirEtapaPipeline(leadUpdate, etapaActual);
    if (etapaNueva !== etapaActual) leadUpdate.etapa_pipeline = etapaNueva;

    if (leadId) {
      // FIX 3: patch siempre incluye etapa_pipeline y ultima_actividad
      const patch = { ...leadUpdate };
      if (nombrePerfil && !patch.nombre && (!leadExistente?.nombre || leadExistente?.nombre === phone)) {
        patch.nombre = nombrePerfil;
      }
      if (!leadExistente?.phone) patch.phone = phone;
      if (!leadExistente?.telefono) patch.telefono = phone;
      const patchFinal = {
        ...patch,
        etapa_pipeline: leadUpdate.etapa_pipeline || etapaActual || 'nuevo',
        ultima_actividad: new Date().toISOString(),
      };
      await db.update('leads', leadId, patchFinal);
      console.log('[bot] Lead actualizado:', leadId, JSON.stringify(patchFinal).slice(0, 100));
      // Vincular conversación al lead si aún no está vinculada
      if (conversacion?.id && !conversacion.lead_id) {
        await db.update('conversaciones', conversacion.id, { lead_id: leadId });
      }
    } else {
      // Crear lead nuevo
      const nuevoLead = await db.save('leads', {
        phone,
        telefono: phone,
        nombre: leadUpdate.nombre || nombrePerfil || 'Cliente WhatsApp',
        origen: 'whatsapp',
        estado: 'Nuevo',
        canal: 'ecommerce',
        segmento: 'ecommerce',
        bot_activo: true,
        ...leadUpdate,
      });
      console.log('[bot] Lead creado:', nuevoLead.id, JSON.stringify(leadUpdate).slice(0, 100));
      if (conversacion?.id) {
        await db.update('conversaciones', conversacion.id, { lead_id: nuevoLead.id });
      }
    }
  } catch (e) {
    console.error('[bot] Error grabando lead:', e.message);
  }
  return { respuesta, derivar: false, conversacion, leadUpdate, estado: getEstado(phone) };
}

// ─── Guardar mensajes en conversación ────────────────────────────────────────

async function _guardarMensajes(phone, textoCliente, textoBot, convExistente, canal_tipo) {
  const ts = new Date().toISOString();
  const mc = { id: `msg-${Date.now()}-c`, rol: 'cliente', texto: textoCliente, timestamp: ts };
  const mb = { id: `msg-${Date.now()}-b`, rol: 'bot',     texto: textoBot,     timestamp: ts };

  if (convExistente) {
    const mensajes = [...(convExistente.mensajes || []), mc, mb];
    return db.update('conversaciones', convExistente.id, { mensajes });
  }
  return db.save('conversaciones', {
    phone, lead_id: null, bot_activo: true,
    canal: 'whatsapp', canal_tipo, bot_mode: 'active',
    mensajes: [mc, mb],
  });
}

function _titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Helpers para búsqueda por atributo de variante ─────────────────────────

function _esAtributoVariante(texto) {
  return /\b(delgad[ao]|grues[ao]|espesor|fino|fina|ancho|angosto|\d+\s*mm|escalera|peldaño|rampa|acceso|pasillo|entrada|exterior|interior|húmedo|mojado|industrial|comercial|doméstico|cocina|baño|terraza|garage|taller|gimnasio|piscina|bodega|oficina|colegio|hospital|estadio|anden|bus|camion|vehiculo|carro|furgon)\b/i.test(texto);
}

function _extraerProductoPrevio(historial) {
  const ultimosBots = historial.filter(m => m.rol === 'bot').slice(-4).reverse();
  for (const msg of ultimosBots) {
    // Product between asterisks: *NOMBRE PRODUCTO*
    const enNegritas = msg.texto.match(/\*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,40})\*/);
    if (enNegritas) return enNegritas[1].trim();
    // After "Tenemos "
    const trasTenemos = msg.texto.match(/[Tt]enemos\s+\*?([A-Za-záéíóúñÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s]{3,40?})\*?(?:\s+disponible|\s+a\s+\$)/);
    if (trasTenemos) return trasTenemos[1].trim();
  }
  return null;
}

module.exports = { detectarIntencion, procesarMensaje, resetEstado, migrarEtapasLegacy };
