'use strict';

const bcrypt = require('bcryptjs');
const db = require('./db');
const logger = require('../utils/logger');

function buildAdmin() {
  return {
    id: 'admin-001',
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    rol: 'admin',
    nombre: 'Administrador',
    activo: true,
    createdAt: new Date().toISOString(),
  };
}

function buildConfig() {
  return {
    nombre_comercial: 'Cruzeiro Empresas',
    horario: 'Lun-Vie 09:00-18:00',
    zona_horaria: 'America/Santiago',
    moneda: 'CLP',
    pais: 'Chile',
    whatsapp_numero: '+56900000000',
    createdAt: new Date().toISOString(),
  };
}

async function seedIfEmpty() {
  logger.info('Seed: verificando datos iniciales...');

  const usuarios = await db.getAll('usuarios');
  const tieneAdmin = usuarios.some(u => u.rol === 'admin');
  if (!tieneAdmin) {
    logger.info('Seed: creando usuario admin...');
    await db.save('usuarios', buildAdmin());
  }

  await db.getAll('encuestas');

  const configs = await db.getAll('config');
  if (configs.length === 0) {
    logger.info('Seed: sembrando config...');
    await db.save('config', buildConfig());
  }

  logger.info('Seed: completado.');
}

module.exports = { seedIfEmpty };
