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

function estaEnHorario() {
  const ahora = new Date();
  const offsetSantiago = -4 * 60;
  const santiagoMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000 + offsetSantiago * 60000;
  const santiago = new Date(santiagoMs);
  const dia = santiago.getDay();
  const hora = santiago.getHours();
  return dia >= 1 && dia <= 5 && hora >= 9 && hora < 18;
}

function formatPrice(n) {
  return `$${Number(n).toLocaleString('es-CL')}`;
}

function buildSystemPrompt(productosContexto, contextoCliente = null, conocimientoContexto = null, historialConv = []) {
  const catalogoTexto = Array.isArray(productosContexto) && productosContexto.length > 0
    ? productosContexto.map(p =>
        `• ${p.nombre_web} | $${Number(p.precio||0).toLocaleString('es-CL')} | Stock: ${p.stock ?? 'disponible'} ${p.unidad||''} | SKU: ${p.sku}`
      ).join('\n')
    : 'No encontré productos para esta consulta. Pide más detalles al cliente para afinar la búsqueda.';

  const conocimientoTexto = Array.isArray(conocimientoContexto) && conocimientoContexto.length > 0
    ? conocimientoContexto.slice(0, 5).join('\n\n')
    : '';

  const mensajesPrevios = historialConv.length;
  const recienIdentificado = contextoCliente?.rut && mensajesPrevios > 2;

  let clienteSeccion = '';
  if (contextoCliente?.rut) {
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
    clienteSeccion = `
=== CLIENTE MAYORISTA IDENTIFICADO ===
Empresa: ${contextoCliente.empresa}
RUT: ${contextoCliente.rut}
Ejecutivo asignado: ${ejNombreCtx}
${ejContacto ? `Contacto ejecutivo: ${ejContacto}` : ''}
Pedidos activos: ${pedidosTexto}
${recienIdentificado ? '\nATENCIÓN: El cliente se identificó en medio de la conversación. Lee el historial completo y retoma exactamente desde donde estaban. NO repitas preguntas ya hechas.' : ''}
======================================
`;
  }

  return `${clienteSeccion}
Eres Cru, vendedor experto de Cruzeiro Empresas, especialistas en gomas, cauchos y materiales industriales en Chile. Eres cálido, cercano y directo — como un buen vendedor chileno que conoce sus productos de memoria. Máximo 3 oraciones por mensaje. Siempre terminas con UNA sola pregunta — pero que sea una pregunta que realmente ayude a entender mejor al cliente, no solo para avanzar. Muestra interés genuino. Si el cliente da poca información, indaga con calidez antes de ofrecer productos.

═══════════════════════════════════
FLUJO DE CONVERSACIÓN — OBLIGATORIO
═══════════════════════════════════

PASO 0 — SALUDO (historial vacío):
Saluda con energía y calidez como Cruzeiro. Pregunta qué necesita el cliente. Ejemplo: "¡Hola! Bienvenido a Cruzeiro 😊 Somos especialistas en gomas, cauchos, pisos, seguridad vial y mucho más. ¿En qué te puedo ayudar hoy?"

PASO 1 — EL CLIENTE DICE LO QUE BUSCA:
Muestra interés genuino. Antes de orientarlo pregunta de forma natural: "¡Qué bueno! ¿Ya has comprado antes con nosotros, o es tu primera vez?"

PASO 2 — IDENTIFICACIÓN:
SI DICE QUE NO → Cliente nuevo ecommerce. Ayúdalo con calidez. Sigue al PASO 3.
SI DICE QUE SÍ → Pídele el RUT: "¡Perfecto! ¿Me das el RUT de tu empresa para ubicarte en el sistema?"
  - RUT en el sistema → cliente MAYORISTA. Salúdalo: "¡Hola, [Empresa]! 👋 Tu ejecutivo es [nombre]. ¿Prefieres que [nombre] te contacte, o seguimos aquí?"
  - RUT no en el sistema → trátalo como cliente nuevo ecommerce y sigue al PASO 3.

PASO 3 — INDAGAR:
Haz UNA sola pregunta de contexto. Ejemplos: "¿Para qué espacio lo necesitas?", "¿Interior o exterior?", "¿Uso doméstico o industrial?" — nunca dos preguntas a la vez.

PASO 4 — ORIENTAR:
Con su respuesta explica qué tipo de producto le conviene y por qué. Usa el CONOCIMIENTO TÉCNICO. Sin mostrar productos todavía.

PASO 5 — PRESENTAR:
Menciona 2-3 productos del catálogo con nombre exacto y precio real. El catálogo muestra cada producto así: "• Nombre | $precio | Stock | SKU: XXXXX". Usa esos datos exactos. Ejemplo: "Para escaleras exteriores te van perfecto las gradas de goma estriada. La Grada Estriada Negro 5mm x 300mm x 1200mm vale $7.989 (SKU: I228158559C) y la Grada Estoperol $8.500. ¿Cuántas necesitas?"

PASO 6 — CERRAR:
Cuando el cliente confirma cantidad, di: "Perfecto. Puedes agregar el producto directo al carrito en este link: https://cruzeirogomas.cl/carrito/ — búscalo por nombre o por el SKU [SKU EXACTO DEL CATÁLOGO], o si prefieres te conecto con un ejecutivo. ¿Qué prefieres?"

═══════════════════════════════════
REGLAS ABSOLUTAS
═══════════════════════════════════
- NUNCA ofrezcas productos que no estén en el CATÁLOGO DE PRODUCTOS DISPONIBLES
- El SKU que das al cliente SIEMPRE debe ser el que aparece en el catálogo junto al producto. Si no lo ves claramente, di "búscalo por nombre en cruzeirogomas.cl"
- NUNCA inventes medidas ni especificaciones — usa solo las del nombre del producto en el catálogo
- NUNCA digas que enviarás cotización al teléfono — ofrece el SKU para el carrito o derivar a ejecutivo
- NUNCA pierdas el hilo — lee todo el historial antes de responder
- NUNCA confundas "escalera" con escalera de aluminio — en Cruzeiro escalera = peldaños que necesitan gradas de goma
- Si el cliente pregunta por adhesivos u otros complementos, búscalos primero en el CATÁLOGO antes de decir que no los tienes
- Cuando el cliente pregunte por un pedido específico, usa TODOS los datos disponibles: estado, fecha de entrega, orden de compra, tipo de despacho y dirección. No digas "consulta con tu ejecutivo" si tienes esa información — úsala.
- Responde siempre en español chileno natural

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
  const { testMode = false, canal_tipo = 'web_whatsapp' } = opciones;
  logger.info(`Bot [${phone}]: "${texto.slice(0, 60)}"`);

  const leadUpdate = {};

  // ── PASO 1: Leer estado actual ────────────────────────────────────────────
  const estado = getEstado(phone);
  const historialConv = (conversacionExistente?.mensajes || [])
    .filter(m => m.rol === 'cliente' || m.rol === 'bot');

  // ── PASO 2: Detección silenciosa de RUT (siempre, en cualquier etapa) ────
  if (!estado.rut) {
    const rutExtraido = extraerRut(texto);
    if (rutExtraido) {
      const rutNorm = normalizarRut(rutExtraido);
      const cliente = datos.buscarClientePorRut(rutExtraido);
      if (cliente) {
        const vendedorActual = cliente.vendedor_actual || '';
        let ejecutivoUsername = datos.resolverEjecutivo(vendedorActual);
        const ejecutivoNombre = ejecutivoUsername ? (datos.buscarEjecutivo(ejecutivoUsername)?.nombre || null) : null;
        const canalCliente = (cliente.canal || '').toLowerCase() === 'ecommerce' ? 'ecommerce' : 'mayorista';
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
        leadUpdate.asignado_a = ejecutivoUsername || null;
        leadUpdate.ejecutivo_asignado = ejecutivoUsername || null;
        leadUpdate.ejecutivo_nombre = ejecutivoNombre || ejecutivoUsername || '';
        if (cliente.direccion) leadUpdate.direccion = cliente.direccion;
        if (cliente.ciudad)    leadUpdate.ciudad    = cliente.ciudad;
        if (cliente.fono)      leadUpdate.fono      = cliente.fono;
        if (cliente.email)     leadUpdate.email     = cliente.email;
        if (cliente.ultima_venta) leadUpdate.ultima_compra = cliente.ultima_venta;
      } else {
        setEstado(phone, { etapa: 'activo', canal: 'ecommerce', rut: rutNorm });
        leadUpdate.rut = rutNorm;
        leadUpdate.segmento = 'ecommerce';
        leadUpdate.canal = 'ecommerce';
        const ejecutivosEcom = ['marcelis.arguelles', 'mauricio.santibanez'];
        const ecomIdx = Math.floor(Date.now() / 60000) % ejecutivosEcom.length;
        if (!leadUpdate.ejecutivo_asignado) {
          leadUpdate.ejecutivo_asignado = ejecutivosEcom[ecomIdx];
          leadUpdate.asignado_a = ejecutivosEcom[ecomIdx];
        }
      }
    }
  }

  // Releer estado tras posible actualización
  const estadoActual = getEstado(phone);

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

  // ── PASO 3: Construir contextoCliente si hay rut y canal mayorista ────────
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
          asignado_a: estadoActual.ejecutivoAsignado,
        });
      }
    }
  }

  // ── PASO 5-6: Buscar productos relevantes ────────────────────────────────
  const queryAcumulado = historialConv
    .filter(m => m.rol === 'cliente')
    .slice(-5)
    .map(m => m.texto)
    .concat([texto])
    .join(' ');

  const productosCtx = getCatalogAdapter().buscar(queryAcumulado);
  const conocimientoCtx = getCatalogAdapter().buscarConocimiento(queryAcumulado);

  // ── PASO 7: Hint de identificación para el system prompt ─────────────────
  let identificacionHint = '';
  if (!estadoActual.rut && historialConv.length < 4) {
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

  // ── PASO 9: Fuera de horario (solo primer mensaje) ────────────────────────
  if (!testMode && !estaEnHorario() && historialConv.length === 0) {
    respuesta = personalidad.fuera_de_horario;
  }

  // ── PASO 10: Guardar y retornar ───────────────────────────────────────────
  const conversacion = await _guardarMensajes(phone, texto, respuesta, conversacionExistente, canal_tipo);
  try {
    const todosLeads = await db.getAll('leads');
    const leadExistente = todosLeads.find(l => l.phone === phone || l.telefono === phone);
    const leadId = conversacion?.lead_id || leadExistente?.id;
    if (leadId) {
      if (Object.keys(leadUpdate).length > 0) {
        await db.update('leads', leadId, leadUpdate);
        console.log('[bot] Lead actualizado:', leadId, JSON.stringify(leadUpdate).slice(0, 100));
      }
    } else {
      const nuevoLead = await db.save('leads', {
        phone,
        telefono: phone,
        nombre: leadUpdate.nombre || 'Cliente WhatsApp',
        origen: 'whatsapp',
        estado: 'Nuevo',
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
