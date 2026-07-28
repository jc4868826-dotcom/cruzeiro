'use strict';

function crearLead(overrides = {}) {
  return {
    nombre:               '',
    telefono:             '',
    email:                null,
    empresa:              '',
    rut:                  null,
    segmento:             'ecommerce',
    canal:                null,
    origen:               'web',
    estado:               'Nuevo',
    etapa_pipeline:       null,
    ejecutivo_nombre:     null,
    direccion:            null,
    ciudad:               null,
    fono:                 null,
    ultima_compra:        null,
    giro:                 null,
    canal_origen:         null,
    notas_libres:         null,
    fecha_ultima_compra:  null,
    resumen_conversacion: null,
    intencion_compra:     null,
    derivado_a:           null,
    fecha_derivacion:     null,
    asignado_a:           null,
    bot_activo:           true,
    notas:                [],
    pipeline_history:     [],
    ...overrides,
  };
}

module.exports = { crearLead };
