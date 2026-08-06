'use strict';

const personalidad = require('./personalidad.json');
const db = require('../data/db');
const logger = require('../utils/logger');
const { OPENAI_API_KEY } = require('../config');
const datos = require('./datos');

// ─── In-memory conversation state (keyed by phone) ───────────────────────────
// { etapa, canal, rut, ejecutivoAsignado, clienteNombre }
const conversationStates = new Map();

function getEstado(phone) {
  return conversationStates.get(phone) || {
    etapa: null,
    canal: null,
    rut: null,
    ejecutivoAsignado: null,
    clienteNombre: null,
    subcategoriasActivas: null,
    intentos_rut_fallidos: 0,
    skusConfirmados: [],
  };
}

function setEstado(phone, patch) {
  const prev = getEstado(phone);
  conversationStates.set(phone, { ...prev, ...patch });
}

function resetEstado(phone) {
  conversationStates.delete(phone);
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
    ? conocimientoContexto.slice(0, 5).join('\n\n')
    : '';

  const mensajesPrevios = historialConv.length;
  const recienIdentificado = contextoCliente?.rut && mensajesPrevios > 2;

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
    clienteSeccion = `
=== CLIENTE MAYORISTA IDENTIFICADO ===
Empresa: ${contextoCliente.empresa}
RUT: ${contextoCliente.rut}
Ejecutivo asignado: ${ejNombreCtx}
${ejContacto ? `Contacto ejecutivo: ${ejContacto}` : ''}
Pedidos activos: ${pedidosTexto}
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
    if (seccionesCte.length > 0) clienteSeccion = seccionesCte.join('\n\n') + '\n';
  }

  return `${clienteSeccion}
Eres Cru, vendedor experto de Cruzeiro Empresas, especialistas en gomas, cauchos y materiales industriales en Chile. Eres cálido, cercano y directo — como un buen vendedor chileno que conoce sus productos de memoria. Máximo 3 oraciones por mensaje. Siempre terminas con UNA sola pregunta. Muestra interés genuino.

═══════════════════════════════════
FLUJO DE CONVERSACIÓN — OBLIGATORIO
Sigue estos pasos EN ORDEN. No te saltes ninguno.
═══════════════════════════════════

PASO 0 — SALUDO (solo si el historial está vacío):
"¡Hola! Bienvenido a Cruzeiro 😊 Somos especialistas en gomas, cauchos, pisos, seguridad vial y mucho más. ¿En qué te puedo ayudar hoy?"

PASO 1 — EL CLIENTE MENCIONA LO QUE BUSCA:
Pregunta: "¿Ya eres cliente de Cruzeiro?"

PASO 2 — IDENTIFICACIÓN:
SI DICE QUE NO → cliente nuevo ecommerce, sigue al PASO 3.
SI DICE QUE SÍ → "¿Me das el RUT de tu empresa? Así te identifico en el sistema y accedes a tus precios y condiciones de cliente."
  - RUT encontrado → "¡Te encontré en el sistema, [Empresa]! 👋 Tu ejecutivo es [nombre]. ¿Seguimos aquí o prefieres que [nombre] te contacte directamente?"
  - RUT no encontrado → trátalo como cliente nuevo ecommerce, sigue al PASO 3.

PASO 3 — INDAGAR (una pregunta a la vez):
Antes de mostrar cualquier producto, entiende el contexto. Haz UNA sola pregunta:
"¿Para qué espacio lo necesitas?" o "¿Interior o exterior?" o "¿Uso doméstico o industrial?"
Nunca dos preguntas a la vez.

PASO 4 — ORIENTAR (sin mostrar productos ni precios aún):
Con la respuesta del cliente, explica brevemente qué tipo de producto le conviene y por qué.
Usa el CONOCIMIENTO TÉCNICO disponible.

PASO 5 — PREGUNTAR CANTIDAD (obligatorio antes de mostrar precios):
SIEMPRE pregunta cuánto necesita ANTES de mostrar precios.
La pregunta debe ser específica según la unidad de medida del producto encontrado en el catálogo:
- Unidad MT, M2 o ROL → "¿Cuántos metros cuadrados necesitas cubrir?" (o metros lineales si es perfil/rodón)
- Unidad C/U y el producto es grada/peldaño → "¿Cuántos peldaños tiene la escalera?"
- Unidad C/U y el producto es pastelón/palmeta/baldosa → "¿Cuántos m² necesitas cubrir?"
- Unidad C/U y el producto es basurero, papelero, señalética, tachón, tacha, protector, cinta, correa, oring, o-ring, plancha, perfil, o cualquier ítem que se compra por pieza → "¿Cuántas unidades necesitas?"
- Unidad KG → "¿Cuántos kilos aproximadamente necesitas?"
- Unidad LT o litro → "¿Cuántos litros necesitas?"
- Si no está claro → "¿Para qué lo vas a usar y cuánto necesitas aproximadamente?"
NUNCA preguntes m² para productos que se venden por pieza o unidad individual.
NUNCA muestres precio antes de saber la cantidad.

PASO 6 — PRESENTAR (solo después de tener la cantidad):
Con la cantidad confirmada, muestra 2-3 opciones del catálogo.
Muestra SOLO nombre y precio de cada opción — sin SKU todavía.
Si el catálogo tiene variante por rollo Y por metro, presenta AMBAS y explica la diferencia.

PASO 7 — CONFIRMAR ELECCIÓN Y DAR SKU:
Cuando el cliente elige una opción, entrega el SKU exacto y el precio final con cantidad.
Ejemplo: "Perfecto. Son 48 unidades del Pastelón Caucho Negro 25mm 50x50cm, SKU I272PASN2550, a $6.990 c/u = $335.520 total."

PASO 8 — COMPLEMENTOS PROACTIVOS:
Solo ofrece un complemento si cumple LAS DOS condiciones:
  (a) aparece en el CATÁLOGO DE PRODUCTOS DISPONIBLES con precio válido (> $1)
  (b) es directamente necesario para instalar o usar el producto principal
Si el complemento no está en el catálogo con precio válido → NO lo ofrezcas. Punto.
Si lo ofreces y el cliente dice que sí → dale el SKU y precio del catálogo inmediatamente.
NUNCA digas "te confirmo el precio" de un complemento que ya ofreciste — si no tienes precio, no lo ofrezcas.

PASO 9 — CERRAR:
"Perfecto. Puedes agregar todo directo al carrito en https://cruzeirogomas.cl/carrito/ buscando por SKU, o si prefieres te conecto con un ejecutivo. ¿Qué prefieres?"

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
CATÁLOGO DE PRODUCTOS DISPONIBLES
Solo estos puedes ofrecer — nunca inventes otros
═══════════════════════════════════
${catalogoTexto}`;
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

async function llamarOpenAI(texto, productosContexto, historial = [], contextoCliente = null, conocimientoContexto = null) {
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
        { role: 'user', content: texto },
      ],
      max_tokens: 350,
      temperature: 0.4,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    logger.warn(`Bot: OpenAI falló (${err.message}), usando fallback`);
    return null;
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
  // Se usa solo si el lead no tiene nombre aún. No sobreescribe nombre de empresa.
  const leadUpdate = {};
  if (nombrePerfil && !getEstado(phone).clienteNombre) {
    leadUpdate.nombre = nombrePerfil;
    setEstado(phone, { clienteNombre: nombrePerfil });
  }

  // ── Limpiar estado si es conversación nueva (evita herencia de sesiones previas) ──
  if (!conversacionExistente || (conversacionExistente.mensajes || []).length <= 1) {
    resetEstado(phone);
  }

  // ── PASO 1: Leer estado actual ────────────────────────────────────────────
  const estado = getEstado(phone);
  const historialConv = (conversacionExistente?.mensajes || [])
    .filter(m => m.rol === 'cliente' || m.rol === 'bot');

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
        const cliente = datos.buscarClientePorRut(rutExtraido);
        if (cliente) {
          const vendedorActual = cliente.vendedor_actual || '';
          let ejecutivoUsername = datos.resolverEjecutivo(vendedorActual);
          const ejecutivoNombre = ejecutivoUsername ? (datos.buscarEjecutivo(ejecutivoUsername)?.nombre || null) : null;
          // FIX 3: usar esMayoristaActivo (calculado por ftpLoader) en lugar de campo canal del Excel
          const canalCliente = cliente.esMayoristaActivo === true ? 'mayorista' : 'ecommerce';
          setEstado(phone, {
            etapa: 'activo',
            canal: canalCliente,
            rut: rutNorm,
            ejecutivoAsignado: ejecutivoUsername,
            clienteNombre: cliente.nombre || null,
          });
          leadUpdate.nombre = cliente.nombre || '';
          leadUpdate.empresa = cliente.nombre || '';
          leadUpdate.rut = rutNorm;
          leadUpdate.segmento = canalCliente;
          leadUpdate.canal = canalCliente;
          leadUpdate.ejecutivo_asignado = ejecutivoUsername || null;
          leadUpdate.ejecutivo_nombre = ejecutivoNombre || ejecutivoUsername || '';
          if (cliente.direccion) leadUpdate.direccion = cliente.direccion;
          if (cliente.ciudad)    leadUpdate.ciudad    = cliente.ciudad;
          if (cliente.fono)      leadUpdate.fono      = cliente.fono;
          if (cliente.email)     leadUpdate.email     = cliente.email;
          if (cliente.ultima_venta) leadUpdate.ultima_compra = cliente.ultima_venta;
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
  const mencionaPedido = /pedido|mi pedido|nota de venta|NV\s*\d|cuando llega|despacho|entrega|tracking/i.test(texto);
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
    };
    if (mencionaCotizacion) {
      contextoCliente.cotizaciones = datos.buscarCotizacionesPorRut(estadoActual.rut)
        .slice(0, 5)
        .map(c => `Fecha: ${c.fecha} | SKU: ${c.codigo} | Producto: ${c.descripcion} | Precio cotizado: $${Number(c.precioCotizado).toLocaleString('es-CL')} | Estado: ${c.estado}`);
    }
  } else if (estadoActual.rut && (mencionaPedido || mencionaCotizacion)) {
    contextoCliente = { rut: estadoActual.rut, esEcommerce: true };
    if (mencionaPedido) contextoCliente.pedidos = datos.buscarPedidosPorRut(estadoActual.rut);
    if (mencionaCotizacion) {
      contextoCliente.cotizaciones = datos.buscarCotizacionesPorRut(estadoActual.rut)
        .slice(0, 5)
        .map(c => `Fecha: ${c.fecha} | SKU: ${c.codigo} | Producto: ${c.descripcion} | Precio cotizado: $${Number(c.precioCotizado).toLocaleString('es-CL')} | Estado: ${c.estado}`);
    }
  }

  // ── MODO SILENCIOSO MAYORISTA ─────────────────────────────────────────────
  if (estadoActual.rut && estadoActual.canal === 'mayorista' && contextoCliente) {
    const ejNombre = contextoCliente.ejecutivoNombre || 'nuestro ejecutivo de ventas';
    const ejFono   = contextoCliente.ejecutivoFono   || null;
    const empresa  = contextoCliente.empresa || estadoActual.clienteNombre || 'Cliente';

    let respuestaMayorista;
    if (!estadoActual.alertaMayoristaEnviada) {
      await sendWhatsAppAlert(estadoActual.ejecutivoAsignado, phone, estadoActual.rut, historialConv);
      setEstado(phone, { alertaMayoristaEnviada: true });
      leadUpdate.etapa_pipeline = 'Contactado';
      leadUpdate.ejecutivo_asignado = estadoActual.ejecutivoAsignado;
      respuestaMayorista = `Hola, ${empresa}. Tu ejecutivo ${ejNombre} ya fue notificado y te contactará a la brevedad.${ejFono ? ` Si necesitas algo urgente puedes escribirle directamente al ${ejFono}.` : ''}`;
    } else {
      respuestaMayorista = `Tu ejecutivo ${ejNombre} ya fue notificado. Quedamos atentos.`;
    }

    const conversacionM = await _guardarMensajes(phone, texto, respuestaMayorista, conversacionExistente, canal_tipo);
    try {
      const todosLeadsM = await db.getAll('leads');
      const leadExistenteM = todosLeadsM.find(l => l.rut === estadoActual.rut) || null;
      const leadIdM = leadExistenteM?.id || conversacionM?.lead_id;
      if (leadIdM && Object.keys(leadUpdate).length > 0) {
        await db.update('leads', leadIdM, leadUpdate);
      }
      if (conversacionM?.id && !conversacionM.lead_id && leadIdM) {
        await db.update('conversaciones', conversacionM.id, { lead_id: leadIdM });
      }
    } catch (e) {
      console.error('[bot] Error grabando lead mayorista:', e.message);
    }
    return { respuesta: respuestaMayorista, derivar: false, conversacion: conversacionM, leadUpdate, estado: getEstado(phone) };
  }

  // ── PASO 4: Detección silenciosa de afirmación de contacto ───────────────
  if (estadoActual.ejecutivoAsignado && contextoCliente) {
    const ultimoBotTexto = historialConv.filter(m => m.rol === 'bot').slice(-1)[0]?.texto || '';
    const botOfrecioContacto = /quieres que|te contacte|te llame|llamarte|ponerte en contacto/i.test(ultimoBotTexto);
    const clienteAfirma = /\b(sí|si|claro|dale|ok|bueno|perfecto|que me llame|por favor|porfa|afirmativo|adelante|va)\b/i.test(texto.toLowerCase());
    if (botOfrecioContacto && clienteAfirma) {
      await sendWhatsAppAlert(estadoActual.ejecutivoAsignado, phone, estadoActual.rut, historialConv);
      leadUpdate.etapa_pipeline = 'Contactado';
      if (conversacionExistente?.lead_id) {
        await db.update('leads', conversacionExistente.lead_id, {
          etapa_pipeline: 'Contactado',
          ejecutivo_asignado: estadoActual.ejecutivoAsignado,
        });
      }
    }
  }

  // ── PASO 5-6: Buscar productos relevantes ────────────────────────────────
  // Query con mensajes del cliente + últimos mensajes del bot (para capturar
  // contexto cuando el cliente responde "si" a una oferta del bot)
  const mensajesCliente = historialConv
    .filter(m => m.rol === 'cliente')
    .slice(-5)
    .map(m => m.texto);

  const mensajesBot = historialConv
    .filter(m => m.rol === 'bot')
    .slice(-3)
    .map(m => m.texto);

  const queryAcumulado = [...mensajesCliente, ...mensajesBot, texto].join(' ');

  const canalActual = estadoActual?.canal || conversacionExistente?.canal || 'ecommerce';
  const productosCtx = getCatalogAdapter().buscar(queryAcumulado, canalActual);
  const conocimientoCtx = getCatalogAdapter().buscarConocimiento(queryAcumulado);

  // ── PASO 7: Hint de identificación para el system prompt ─────────────────
  let identificacionHint = '';
  if (estadoActual.rut_no_encontrado) {
    identificacionHint = '';
  } else if (estadoActual.intentos_rut_fallidos === 1) {
    identificacionHint = '';
  } else if (mencionaCotizacion && !estadoActual.rut) {
    identificacionHint = 'El cliente pregunta por una cotización anterior. Pídele el RUT para buscarla en el sistema.';
  } else if (!estadoActual.rut && historialConv.length < 4) {
    identificacionHint = 'En el próximo intercambio, si no lo has hecho, pregunta naturalmente si el cliente ha comprado antes con nosotros.';
  } else if (!estadoActual.rut && historialConv.length >= 4) {
    identificacionHint = 'Ya llevas varios mensajes sin identificar al cliente. Menciona naturalmente que podrías atenderlo mejor si supieras si es cliente habitual.';
  }
  const ctxParaPrompt = identificacionHint
    ? { ...(contextoCliente || {}), _hint: identificacionHint }
    : contextoCliente;

  // ── PASO 8: Llamar a OpenAI ───────────────────────────────────────────────
  let respuesta = await llamarOpenAI(texto, productosCtx, historialConv, ctxParaPrompt, conocimientoCtx)
    || `Estoy aquí para ayudarte. ¿En qué puedo orientarte?`;

  // ── Capturar SKUs mencionados en la respuesta del bot ──────────────────
  const _skuRegex = /\bSKU[:\s]+([A-Z0-9][A-Z0-9]{3,}(?:[-][A-Z0-9]+)?)/gi;
  const _skusEnRespuesta = [];
  let _skuMatch;
  while ((_skuMatch = _skuRegex.exec(respuesta)) !== null) {
    _skusEnRespuesta.push(_skuMatch[1].trim());
  }
  if (_skusEnRespuesta.length > 0) {
    const _estadoSkus = getEstado(phone);
    const _skusActuales = _estadoSkus.skusConfirmados || [];
    const _skusSet = new Map(_skusActuales.map(s => [s.sku, s]));
    for (const sku of _skusEnRespuesta) {
      if (!_skusSet.has(sku)) _skusSet.set(sku, { sku, cantidad: 1 });
    }
    setEstado(phone, { skusConfirmados: [..._skusSet.values()] });
  }

  // ── Reemplazar link carrito genérico por link pre-cargado ──────────────
  const { generarLinkCarrito } = require('../utils/wooCart');
  const _estadoFinal = getEstado(phone);
  const _skusParaCarrito = _estadoFinal.skusConfirmados || [];
  if (
    _skusParaCarrito.length > 0 &&
    respuesta.includes('cruzeirogomas.cl/carrito')
  ) {
    const _linkGenerado = generarLinkCarrito(_skusParaCarrito);
    if (_linkGenerado) {
      respuesta = respuesta.replace(
        /https?:\/\/cruzeirogomas\.cl\/carrito\/?[^\s)]*/g,
        _linkGenerado
      );
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

    if (!leadExistente?.familia_interes && Array.isArray(productosCtx) && productosCtx.length > 0) {
      const _fam = productosCtx[0].padre_familia || productosCtx[0].Padre_familia;
      if (_fam) leadUpdate.familia_interes = _fam;
    }

    const _CALIDAD_ORDEN = ['bajo', 'medio', 'alto', 'convertido'];
    const _canalCalidad = estadoActual.canal || conversacionExistente?.canal || 'ecommerce';
    let _calidadCalc = 'bajo';
    if (_canalCalidad === 'mayorista') {
      if (leadUpdate.etapa_pipeline === 'Contactado') {
        _calidadCalc = 'convertido';
      } else if (estadoActual.rut || leadExistente?.rut) {
        _calidadCalc = 'alto';
      } else if (historialConv.filter(m => m.rol === 'cliente').length > 1) {
        _calidadCalc = 'medio';
      }
    } else {
      if (
        respuesta.includes('cruzeirogomas.cl/carrito') ||
        leadUpdate.etapa_pipeline === 'Contactado' ||
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
    // ─────────────────────────────────────────────────────────────────────────

    if (leadId) {
      // Siempre asegurar que el phone quede registrado en el lead
      const patch = { ...leadUpdate };
      if (!leadExistente?.phone) patch.phone = phone;
      if (!leadExistente?.telefono) patch.telefono = phone;
      if (Object.keys(patch).length > 0) {
        await db.update('leads', leadId, patch);
        console.log('[bot] Lead actualizado:', leadId, JSON.stringify(patch).slice(0, 100));
      }
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

module.exports = { detectarIntencion, procesarMensaje, resetEstado };
