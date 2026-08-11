# Auditoría de archivos — FunnelOS Cruzeiro
**Fecha:** 2026-08-10  
**Commit base:** abc0469  
**Auditor:** Claude Code — análisis estático  

---

## 1. Inventario de archivos de datos

| # | Nombre archivo | Tipo | Ubicación en producción | Método de acceso en código | Cuándo se carga |
|---|---|---|---|---|---|
| 1 | `web.xlsx` | REPO | `/data/cruzeiro/web.xlsx` | `loaders.loadWeb()` → `dataStore.getWebProductos()` | Al arrancar (sync), recarga cada 10 min |
| 2 | `Maestra_Orleans.xlsx` | REPO | `/data/cruzeiro/Maestra_Orleans.xlsx` | `loaders.loadMaestra()` → `dataStore.getMaestraProductos()` | Al arrancar (sync), recarga cada 10 min |
| 3 | `20260709 Ventas 2026.xlsx` | REPO | `/data/cruzeiro/20260709 Ventas 2026.xlsx` | `loaders.loadVentas()` / `loadVentasRaw()` → `dataStore.getVentasMap()` / `getVentasRaw()` | Al arrancar (sync), recarga cada 10 min |
| 4 | `Estado Notas Pedido.xlsx` | REPO | `/data/cruzeiro/Estado Notas Pedido.xlsx` | `loaders.loadPedidos()` → `dataStore.getPedidos()` | Al arrancar (sync), recarga cada 10 min |
| 5 | `Inputs BOT-CRM.xlsx` | REPO | `/data/cruzeiro/Inputs BOT-CRM.xlsx` | `loaders.loadInputs()` → `dataStore.getEjecutivos()` | Al arrancar (sync), recarga cada 10 min |
| 6 | `Usos_Especificaciones.xlsx` | REPO | `/data/cruzeiro/Usos_Especificaciones.xlsx` | `loaders.loadUsos()` → `dataStore.getUsos()` | Al arrancar (sync), recarga cada 10 min |
| 7 | `Clientes.csv` | FTP | FTP server raíz | `ftpLoader.cargarClientesFTP()` → `dataStore.getClientesFTP()` | Al arrancar + recarga automática cada 10 min |
| 8 | `Ventas_OR.csv` | FTP | FTP server raíz | `ftpLoader.cargarVentasFTP()` → `dataStore.getVentasFTPRaw()` | Al arrancar + recarga automática cada 10 min |
| 9 | `Cotizaciones_OR.csv` | FTP | FTP server raíz | `ftpLoader.cargarCotizacionesFTP()` → `dataStore.getCotizacionesFTP()` | Al arrancar + recarga automática cada 10 min |
| 10 | `StockSucursal.csv` | FTP | FTP server raíz | `ftpLoader.cargarStockFTP()` → `dataStore.getStockMap()` | Al arrancar + recarga automática cada 10 min |
| 11 | `WooMap.csv` | FTP | FTP server raíz | `ftpLoader.cargarWooMapFTP()` → `dataStore.getWooMap()` | Al arrancar + recarga automática cada 10 min |
| 12 | `RegPedidos.xlsx` | FTP | FTP server raíz | `ftpLoader.cargarRegPedidosFTP()` → `dataStore.getWooOrders()` | Al arrancar + recarga automática cada 10 min |

**Nota:** La recarga de REPO (archivos estáticos) también se ejecuta cada 10 min mediante `dataStore.startAutoReload()` (`dataStore.js:45`). La recarga FTP se gestiona con `setInterval` en `ftpLoader.js:259`.

---

## 2. Mapa de instancias de consulta

| Archivo de datos | Tipo | Función que lo usa | Archivo fuente | Línea(s) | Trigger de negocio | Canal | Dato extraído | Uso en respuesta | Estado | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| `web.xlsx` | REPO | `buscarProductos()` rama ecommerce | `datos.js` | 354–385 | Búsqueda de producto por texto del cliente | ECOMMERCE | `sku`, `nombreWeb`, `descripcionCorta`, `precio`, `categoria`, `subcategoria` | Catálogo al prompt GPT; link carrito | OK | Única fuente de precios ecommerce |
| `web.xlsx` | REPO | `buildCatalogo()` | `loaders.js` | 47–73 | Arranque / reload automático | ECOMMERCE | `sku`, `precio_web` | Catalogo unificado (merge con Maestra) | OK | Merge con Maestra por SKU |
| `Maestra_Orleans.xlsx` | REPO | `buscarProductos()` rama mayorista | `datos.js` | 325–351 | Búsqueda de producto por texto del cliente | MAYORISTA | `sku`, `descripcion`, `precioVenta`, `stock`, `familia`, `padreFamilia` | Catálogo al prompt GPT; sin link carrito | OK | Campo leído: `Precio Venta` (con espacio) |
| `Maestra_Orleans.xlsx` | REPO | `buildCatalogo()` | `loaders.js` | 11–28 | Arranque / reload | AMBOS | `descripcion`, `unidad`, `Saldo`, `Precio Venta`, `Familia`, `Padre_familia` | Merge en catálogo unificado | OK | Enriquece web.xlsx con datos mayorista |
| `Usos_Especificaciones.xlsx` | REPO | `buscarConocimiento()` | `catalogAdapter.js` | 146–167 | Cualquier búsqueda de producto (consulta técnica GPT) | AMBOS | `categoria`, `conocimiento` | Sección CONOCIMIENTO TÉCNICO en system prompt | OK | Máx 2 items por query |
| `Usos_Especificaciones.xlsx` | REPO | `_buscarEnUsos()` | `datos.js` | 282–312 | Búsqueda de producto ecommerce/mayorista | AMBOS | `categoria`, `conocimiento` | Solo como enriquecimiento interno (no al GPT directo aquí) | OK | |
| `Estado Notas Pedido.xlsx` | REPO | `buscarPedidosPorRut()` | `datos.js` | 154–159 | Cliente menciona pedido / estado NV | AMBOS | `nv`, `estado`, `rut`, `fecha_entrega`, `orden_compra`, `tipotransporte`, `direcciondespacho`, `comuna` | Sección PEDIDOS ACTIVOS en system prompt | OK | Accedido vía `dataStore.getPedidos()` |
| `Estado Notas Pedido.xlsx` | REPO | `buscarPedidosPorRut()` → contextoCliente | `bot.service.js` | 780–791 | Trigger `mencionaPedido` | AMBOS | Pedidos activos | Mostrado en system prompt del GPT | OK | Condición: `mencionaPedido` regex en texto |
| `Inputs BOT-CRM.xlsx` | REPO | `buscarEjecutivo()` | `datos.js` | 150–152 | Cualquier consulta que involucre ejecutivo | CONFIG | `username`, `nombre`, `email`, `fono` | Nombre/fono ejecutivo en alertas y prompt | OK | Lectura por posición fija de fila (row[9..20]) |
| `Inputs BOT-CRM.xlsx` | REPO | `sendWhatsAppAlert()` | `bot.service.js` | 67 | Derivación a ejecutivo | CONFIG | `fono` del ejecutivo | Destinatario de alerta WhatsApp | OK | `datos.buscarEjecutivo(username)?.fono` |
| `Ventas 2026.xlsx` | REPO | `loadVentas()` / `getVentasMap()` | `loaders.js` | 80–131 | Fallback si FTP no disponible; búsqueda cliente | CONFIG | `Rut`, `RazonSocial`, `ultima_venta`, `Vendedor` | Mapa de clientes para identificación | OK | Solo fallback; producción usa Clientes.csv FTP |
| `Ventas 2026.xlsx` | REPO | `loadVentasRaw()` / `getVentasRaw()` | `loaders.js` | 166–174 | Fallback 180 días si FTP ventas vacío | CONFIG | `Rut`, `FechaEmision` | Determina canal mayorista/ecommerce | OK | `datos.js:97`: `ventasFtp.length ? ventasFtp : dataStore.getVentasRaw()` |
| `Clientes.csv` | FTP | `clasificarPorRut()` — BÚSQUEDA 1 | `datos.js` | 236–244 | RUT detectado en mensaje cliente | AMBOS | `Rut`, `RazonSocial`, `Vendedor`, `Email`, `Celular`, `Giro` | Tipo cliente (activo/inactivo/nuevo), ejecutivo asignado | OK | Clave: solo dígitos del RUT |
| `Clientes.csv` | FTP | `buscarClientePorRut()` | `datos.js` | 106–137 | Búsqueda directa de cliente por RUT | AMBOS | `rut`, `razonSocial`, `vendedor`, `email`, `celular` | Contexto cliente en sistema | OK | Fallback a ventasMap si no encuentra en FTP |
| `Ventas_OR.csv` | FTP | `clasificarPorRut()` — BÚSQUEDA 2 | `datos.js` | 247–256 | RUT detectado, post-identificación en Clientes.csv | AMBOS | `Rut`, `FechaEmision` | Determina canal: mayorista (compra <180d) o ecommerce (inactivo) | ⚠️ | Campo accedido: `v.rut || v.Rut`; fecha: `v.fechaEmision || v.FechaEmision` |
| `Ventas_OR.csv` | FTP | `_calcularEsMayoristaActivo()` | `datos.js` | 94–103 | Verificación adicional de mayorista activo | MAYORISTA | `rut`, `fechaEmision` | Bool: ¿tiene compra en últimos 180d? | ⚠️ | Misma doble búsqueda de campo fecha |
| `Cotizaciones_OR.csv` | FTP | `buscarCotizacionesPorRut()` | `datos.js` | 139–148 | Cliente menciona cotización previa | AMBOS | `rut`, `codigo`, `descripcion`, `precioCotizado`, `estado`, `fecha` | Historial de cotizaciones en system prompt GPT | ⚠️ | Campo RUT leído como `row['RUT']` (mayúsculas); ver Fase 3 |
| `StockSucursal.csv` | FTP | `getCatalogo()` | `dataStore.js` | 49–55 | Toda consulta de catálogo vía `catalogAdapter.buscar()` | AMBOS | `Codigo` (SKU), `Saldo` | Enriquece `saldo_ftp` en cada producto del catálogo unificado | OK | Si `stockMap.size === 0`, retorna catálogo sin stock FTP |
| `WooMap.csv` | FTP | `buildCartUrl()` | `wooCart.js` | 7–22 | Generación de link carrito al detectar `[carrito]` o SKU marker | ECOMMERCE | `SKU → wooId` | URL `cruzeirogomas.cl/carrito/?add-to-cart[]=...` | ⚠️ BUG | Ver Fase 4 |
| `RegPedidos.xlsx` | FTP | `getWooOrdersByRut()` | `bot.service.js` | 782, 792 | Trigger `mencionaPedido` activo | AMBOS | `nroPedido`, `rut`, `estado`, `fecha`, `items[]` | Sección PEDIDOS ONLINE WOOCOMMERCE en system prompt | OK | Filtro 90 días en `buildSystemPrompt()` |

---

## 3. Verificación de field names

### web.xlsx (hoja: `web`)

| Campo en código (`loaders.js`) | Campo real en archivo | Estado |
|---|---|---|
| `r['SKU']` | `SKU` | ✅ coincide |
| `r['Nombre Web']` | `Nombre Web` | ✅ coincide |
| `r['Descripción Corta']` | `Descripción Corta` | ✅ coincide (con tilde) |
| `r['Precio (CLP)']` | `Precio (CLP)` | ✅ coincide |
| `r['Categoría']` | `Categoría` | ✅ coincide (con tilde) |
| `r['Subcategoría']` | `Subcategoría` | ✅ coincide (con tilde) |
| `r['URL Imagen']` | `URL Imagen` | ✅ coincide |

> **Nota:** En `datos.js:370`, el campo de precio se accede como `p.precio` sobre el objeto ya normalizado (campo `precio` en el objeto retornado por `loadWeb()`). El mapeo `r['Precio (CLP)'] → precio` lo hace `loadWeb()`. Sin riesgo.

---

### Maestra_Orleans.xlsx (hoja: `Hoja1`)

| Campo en código (`loaders.js`) | Campo real en archivo | Estado |
|---|---|---|
| `row['Codigo']` | `Codigo` | ✅ coincide |
| `row['descripcion']` | `descripcion` | ✅ coincide (todo minúsculas) |
| `row['unidad']` | `unidad` | ✅ coincide (todo minúsculas) |
| `row['Saldo']` | `Saldo` | ✅ coincide |
| `row['Precio Venta']` | `Precio Venta` | ✅ coincide (con espacio) |
| `row['Familia']` | `Familia` | ✅ coincide |
| `row['Padre_familia']` | `Padre_familia` | ✅ coincide |

> **Nota:** En `datos.js:340`, `buscarProductos()` accede a `p.padreFamilia` que viene del objeto normalizado por `loadMaestra()` (`padreFamilia: row['Padre_familia']`). La normalización la hace el loader, sin problema.  
> En `bot.service.js:1032`, se accede a `productosCtx[0].padre_familia || productosCtx[0].Padre_familia` — doble fallback innecesario pero seguro.

---

### WooMap.csv (FTP — sin header, comma-delimited)

| Campo en código (`ftpLoader.js`) | Formato real esperado | Estado |
|---|---|---|
| `partes[0]` → wooId (columna 0) | ID numérico WooCommerce | ⚠️ no verificable (FTP) |
| `partes[1]` → SKU (columna 1) | SKU alfanumérico del producto | ⚠️ no verificable (FTP) |

> **Riesgo:** `cargarWooMapFTP()` usa `latin1` encoding (`buf.toString('latin1')`). Si el FTP sirve el CSV en UTF-8, los SKUs con caracteres especiales pueden corromperse. Sin embargo, los SKUs del catálogo son alfanuméricos sin tildes, por lo que el riesgo es bajo.  
> **Riesgo crítico:** El mapa resultante es `{ SKU: wooId }`. `buildCartUrl()` busca `wooMap[sku]` primero, luego `wooMap[sku?.toUpperCase()]`. Si el SKU en WooMap usa minúsculas y el catálogo usa mayúsculas (o viceversa), el lookup falla silenciosamente y el carrito no se genera.

---

### Clientes.csv (FTP — semicolón delimitado, según `parseCSV()`)

| Campo en código (`ftpLoader.js:cargarClientesFTP`) | Campo esperado en CSV | Estado |
|---|---|---|
| `row['Rut']` | `Rut` | ⚠️ no verificable (FTP) |
| `row['Digito']` | `Digito` | ⚠️ no verificable (FTP) |
| `row['RazonSocial']` | `RazonSocial` | ⚠️ no verificable (FTP) |
| `row['Vendedor']` | `Vendedor` | ⚠️ no verificable (FTP) |
| `row['Email']` | `Email` | ⚠️ no verificable (FTP) |
| `row['Celular']` | `Celular` | ⚠️ no verificable (FTP) |
| `row['Giro']` | `Giro` | ⚠️ no verificable (FTP) |
| `row['Segmento']` | `Segmento` | ⚠️ no verificable (FTP) |

> **Nota:** El parser `parseCSV()` usa punto y coma (`;`) como delimitador. Si el ERP exporta con coma (`,`) o pipe (`|`), todos los campos quedarán concatenados en una sola columna y el mapa quedará vacío — lo que causaría que NINGÚN cliente sea reconocido.

---

### Ventas_OR.csv (FTP — semicolón delimitado)

| Campo en código (`ftpLoader.js:cargarVentasFTP`) | Campo esperado en CSV | Estado |
|---|---|---|
| `row['Rut']` | `Rut` | ⚠️ no verificable (FTP) |
| `row['FechaEmision']` | `FechaEmision` | ⚠️ no verificable (FTP) |
| `row['precio']` | `precio` (minúsculas) | ⚠️ RIESGO — si el ERP exporta `Precio` el valor queda en 0 |
| `row['Padre_familia']` | `Padre_familia` | ⚠️ no verificable (FTP) |
| `row['Tipo_Negocio']` | `Tipo_Negocio` | ⚠️ no verificable (FTP) |

> **Riesgo activo:** En `datos.js:99`, para determinar los 180 días se accede `v.fechaEmision || v.FechaEmision`. El código aplica doble fallback (lowercase y capital). La lógica es: si Ventas_OR.csv viene de FTP, usa `FechaEmision` (capital F); si cae al fallback xlsx (Ventas 2026.xlsx), usa `FechaEmision` también. **La doble búsqueda es correcta y defensiva.** Sin bug aquí.

---

### Cotizaciones_OR.csv (FTP — semicolón delimitado)

| Campo en código (`ftpLoader.js:cargarCotizacionesFTP`) | Campo esperado en CSV | Estado |
|---|---|---|
| `row['RUT']` | `RUT` (todo mayúsculas) | ❌ MISMATCH POTENCIAL |
| `row['Tipo_Negocio']` | `Tipo_Negocio` | ⚠️ no verificable (FTP) |
| `row['PRECIOCOTIZADO']` | `PRECIOCOTIZADO` (sin espacios) | ⚠️ no verificable (FTP) |
| `row['Total_item']` | `Total_item` | ⚠️ no verificable (FTP) |
| `row['Estado']` | `Estado` | ⚠️ no verificable (FTP) |
| `row['Fecha']` | `Fecha` | ⚠️ no verificable (FTP) |

> **Riesgo crítico:** `Clientes.csv` usa `Rut` (capital R, lowercase ut). Si el ERP es consistente, `Cotizaciones_OR.csv` podría exportar el campo como `Rut` en lugar de `RUT`. En ese caso, `row['RUT']` retorna `undefined`, los RUT quedan como string vacío `""`, y `buscarCotizacionesPorRut()` nunca encuentra cotizaciones para ningún cliente. El cliente diría "no hay cotizaciones" cuando sí existen.

---

### Estado Notas Pedido.xlsx (hoja: `Hoja1`)

| Campo en código (`loaders.js:loadPedidos`) | Campo real en archivo | Estado |
|---|---|---|
| `r.Nota_Venta` | `Nota_Venta` | ✅ coincide |
| `r.status_pedido` | `status_pedido` | ✅ coincide |
| `r.Rut` | `Rut` | ✅ coincide |
| `r.RazonSocial` | `RazonSocial` | ✅ coincide |
| `r.Vendedor` | `Vendedor` | ✅ coincide |
| `r['Fecha Entrega']` | `Fecha Entrega` | ✅ coincide (con espacio) |
| `r.ordencompra` | `ordencompra` | ✅ coincide (todo minúsculas) |
| `r.tipotransporte` | `tipotransporte` | ✅ coincide |
| `r.transporte` | `transporte` | ✅ coincide |
| `r.direcciondespacho` | `direcciondespacho` | ✅ coincide |
| `r.Comuna` | `Comuna` | ✅ coincide |

> **Nota:** El header `Fecha Nota de Venta` existe en el archivo pero no es accedido por el código. El código usa `Fecha Entrega` (campo correcto para el cliente). Sin problemas.

---

### Ventas 2026.xlsx (hoja: `Hoja1`) — para `loadVentas()` y `loadVentasRaw()`

| Campo en código | Campo real en archivo | Estado |
|---|---|---|
| `r.Rut` | `Rut` | ✅ coincide |
| `r.Digito` | `Digito` | ✅ coincide |
| `r.ultima_venta` | `ultima_venta` | ✅ coincide (todo minúsculas) |
| `r.RazonSocial` | `RazonSocial` | ✅ coincide |
| `r.Vendedor` | `Vendedor` | ✅ coincide |
| `r.FechaEmision` | `FechaEmision` | ✅ coincide |
| `r.CODIGO` | `CODIGO` | ✅ coincide (mayúsculas) |
| `r.Padre_familia` | `Padre_familia` | ✅ coincide |

---

## 4. Análisis bug carrito `[carrito]`

### Flujo completo paso a paso

```
MENSAJE CLIENTE
      ↓
bot.service.js:884 — datos.buscarProductos(query, canal)
  → retorna productosCtx[] con {sku, precio, ...}
      ↓
bot.service.js:888-892 — setEstado(phone, { skuMapActual: skuMap })
  → guarda mapa SKU→producto en estado en memoria (NO en skusConfirmados)
      ↓
bot.service.js:918 — llamarOpenAI(texto, productosCtx, ...)
  → GPT recibe catálogo con SKU_INTERNO visible
  → System prompt: "...escribe exactamente [carrito]..."
  → GPT retorna respuesta con [carrito] (y opcionalmente [SKU:CODE×QTY])
      ↓
MECANISMO 1 — bot.service.js:938-974
  ¿La respuesta incluye [SKU:CODE×QTY]?
    SÍ → extrae items del marker → acumula en skusConfirmados
       → buildCartUrl(skusNuevos) → wooCart.js:buildCartUrl()
         → para cada SKU: busca wooMap[sku] → si existe → agrega a URL
         → construye: https://cruzeirogomas.cl/carrito/?add-to-cart[]=ID&quantity[]=N
       → reemplaza [SKU:...] y [carrito] en la respuesta
       → leadUpdate.link_carrito_enviado = true
    NO → continúa a Mecanismo 2
      ↓
MECANISMO 2 — bot.service.js:977-997
  ¿La respuesta aún incluye [carrito]?
    SÍ → lee skusConfirmados (estado en memoria)
       → si vacío Y esConfirmacion Y skusActuales.length > 0:
             usa skusActuales (primer SKU del productosCtx actual)
       → buildCartUrl(_itemsParaCarrito)
         → si WooMap tiene el SKU → URL válida → reemplaza [carrito]
                                                  → leadUpdate.link_carrito_enviado = true
         → si WooMap NO tiene el SKU → retorna null
                                      → reemplaza [carrito] con texto fallback
    NO → (ya fue reemplazado por mecanismo 1)
```

### Punto exacto de fallo

**Condición 1 — WooMap vacío o SKU no mapeado** (`wooCart.js:15-16`):
```js
const wooId = wooMap[sku] || wooMap[sku?.toUpperCase()];
if (!wooId) { console.warn('[wooCart] SKU sin WooID:', sku); continue; }
```
Si ningún SKU de `_itemsParaCarrito` aparece en WooMap, `alguno` queda `false` y `buildCartUrl` retorna `null`. El `[carrito]` se reemplaza por el texto fallback. La respuesta al cliente no tiene link.

**Condición 2 — productosCtx vacío cuando el cliente confirma** (`bot.service.js:922-935`):
```js
const esConfirmacion = detectarConfirmacion(texto);
const skusActuales = (productosCtx || [])
    .filter(p => p.sku)
    .map(p => ({ sku: p.sku, quantity: 1 }));
```
Si el cliente escribe exactamente "sí" o "dale" sin repetir el nombre del producto, el query acumulado `[mensajesCliente, texto].join(' ')` puede NO encontrar productos porque "sí" no matchea ningún token del catálogo. Entonces `productosCtx` = `[]`, `skusActuales` = `[]`, y si `skusConfirmados` también está vacío → fallo garantizado.

**Condición 3 — skusConfirmados no persiste entre reinicios** (`bot.service.js:887-892`):
Los `skusConfirmados` se guardan en `conversationStates` (Map en memoria). Si el proceso de Node se reinicia (deploy, crash, Render restart), el estado se pierde. En el siguiente mensaje, `skusConfirmados = []` y el mecanismo 2 no puede recuperar el contexto del turno anterior.

**Condición 4 — GPT no escribe `[carrito]` aunque debería** (no tiene fix en código):
El GPT puede responder con "Aquí tienes el link:" sin el marcador, o construir una URL fake. En ese caso ningún mecanismo detecta nada y el carrito no se genera. El `RECORDATORIO FINAL` en `llamarOpenAI()` línea 509 intenta mitigarlo pero no es garantía.

### Condición más probable de fallo en producción

```
1. Cliente pregunta por producto → GPT muestra opciones con precios
2. Cliente responde: "dale, quiero ese" (esConfirmacion = true)
3. datos.buscarProductos("dale quiero ese", 'ecommerce') → productosCtx = [] (sin tokens de producto)
4. skusConfirmados = [] (primer mensaje de confirmación)
5. GPT recibe catálogo del turno anterior, puede escribir [carrito]
6. Mecanismo 2: _itemsParaCarrito = [] → buildCartUrl([]) = null
7. Respuesta al cliente: "...Para completar tu compra contáctanos por este medio 😊"
```

---

## 5. Análisis bug pipeline "ganado"

### Funciones que establecen etapa "ganado"

**1. `_avanzarEtapa()` vía `_detectarEventosPipeline()` — bot.service.js:553-556**
```js
const tieneCarrito = respuesta.includes('cruzeirogomas.cl/carrito');
if (tieneCarrito) {
    leadUpdate.link_carrito_enviado = true;
    _avanzarEtapa(leadUpdate, leadExistente, 'ganado');   // ← LÍNEA 555
}
```
Condición: la `respuesta` (ya procesada con URL real) contiene el dominio del carrito.

**2. `inferirEtapaPipeline()` — bot.service.js:579**
```js
if (leadUpdate.link_carrito_enviado) return 'ganado';   // ← LÍNEA 579
```
Condición: cualquier código que setee `leadUpdate.link_carrito_enviado = true` (líneas 973 o 994) fuerza 'ganado' aquí.

**3. `migrarEtapasLegacy()` — bot.service.js:603-604**
```js
if (lead.link_carrito_enviado === true) { nuevaEtapa = 'ganado'; }
```
Solo en arranque del servidor, no durante conversaciones.

### Condición que dispara "ganado" desde el segundo mensaje

**Escenario reproducible:**

```
Mensaje 1 (cliente): "Hola" o "Buenas"
  → Bot saluda, muestra 0 productos (query vacío)
  → etapa: 'nuevo'

Mensaje 2 (cliente): "sí" / "dale" / "ok" / "si"
  → detectarConfirmacion("sí") = true  (línea 173, regex muy amplio)
  → datos.buscarProductos("hola sí", 'ecommerce') puede retornar productos
    (tokens: "hola", "si" → score bajo pero posible match)
  → skusActuales puede tener items si hay match
  → GPT recibe catálogo y el RECORDATORIO FINAL de escribir [carrito]
  → GPT puede escribir [carrito] al interpretar "sí" como confirmación
  → Mecanismo 2 (línea 977): skusConfirmados=[], esConfirmacion=true, skusActuales.length > 0
    → _itemsParaCarrito = skusActuales (primer SKU que matcheó)
    → buildCartUrl() → si SKU está en WooMap → URL real generada
    → leadUpdate.link_carrito_enviado = true (línea 994)
    → _avanzarEtapa → 'ganado' (línea 555)
```

**Causa raíz:** `detectarConfirmacion()` (línea 173) matchea palabras genéricas (`"sí"`, `"ok"`, `"dale"`, `"bueno"`) sin requerir contexto de compra previo. Si el segundo mensaje del cliente es cualquiera de estas palabras (típico en conversación casual), el sistema asume que está confirmando un pedido.

**Línea exacta del bug:**
- `bot.service.js:173` — regex demasiado amplio: `^(s[íi]|sí|si|dale|ok|okay|bueno|perfecto|...)\b`
- Sin verificación de que en el historial haya una oferta de producto previa

**Fix sugerido (no implementado):** Antes de activar el flujo de carrito, verificar que el último mensaje del bot haya presentado productos con precio, y que `historialConv.length >= 4`.

---

## 6. Resumen de riesgos críticos

| Prioridad | Riesgo | Archivo | Línea | Impacto en cliente |
|---|---|---|---|---|
| 🔴 CRÍTICO | Cotizaciones no encontradas si ERP exporta campo `Rut` en lugar de `RUT` | `ftpLoader.js` | 93 | Cliente pide cotizaciones → bot responde "no tenemos registro" aunque sí existan |
| 🔴 CRÍTICO | `[carrito]` reemplazado por texto fallback cuando cliente confirma con "sí/dale" sin repetir producto | `bot.service.js` | 979–991 | Cliente listo para comprar → recibe "contáctanos por este medio" en lugar de link |
| 🔴 CRÍTICO | Pipeline marcado 'ganado' en el segundo mensaje del cliente si escribe "ok", "sí" o "dale" | `bot.service.js` | 173, 555 | Lead se marca como convertido antes de haber ofrecido ningún producto |
| 🟠 ALTO | SKU del catálogo no aparece en WooMap → carrito siempre vacío para ese producto | `wooCart.js` | 15–16 | Producto existe en catálogo pero cliente nunca puede comprarlo online |
| 🟠 ALTO | `skusConfirmados` en memoria volátil: se pierde en cada reinicio de Render | `bot.service.js` | 887–892 | Conversación activa queda sin contexto de carrito tras deploy o crash |
| 🟡 MEDIO | WooMap.csv leído en encoding `latin1` → posible corrupción si FTP sirve UTF-8 | `ftpLoader.js` | 125 | SKUs con caracteres especiales no se mapearían (bajo riesgo dado que los SKUs son alfanuméricos) |
| 🟡 MEDIO | Delimitador `parseCSV()` hardcodeado a `;` — si ERP cambia a `,` todos los CSVs fallan silenciosamente | `ftpLoader.js` | 23 | Toda identificación de clientes, ventas y cotizaciones dejaría de funcionar |
| 🟡 MEDIO | `loadInputs()` lee ejecutivos por posición fija de fila (rows[9..20]) — frágil ante cambios en el Excel | `loaders.js` | 154–163 | Si alguien agrega una fila en Inputs BOT-CRM.xlsx, todos los ejecutivos quedan con datos desplazados |
| 🟢 BAJO | Doble acceso `padre_familia \|\| Padre_familia` en bot.service.js:1032 — innecesario pero inofensivo | `bot.service.js` | 1032 | Ninguno — defensivo redundante |
