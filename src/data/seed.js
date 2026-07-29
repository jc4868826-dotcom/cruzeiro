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

const EJECUTIVOS_SEED = [
  { id: 'ej-marcelis',  username: 'marcelis.arguelles',  nombre: 'Marcelis Arguelles',  rol: 'ejecutivo',      activo: true },
  { id: 'ej-mauricio',  username: 'mauricio.santibanez', nombre: 'Mauricio Santibañez', rol: 'ejecutivo',      activo: true },
  { id: 'ej-jaime-c',   username: 'jaime.cornejo',       nombre: 'Jaime Cornejo',       rol: 'jefe_ecommerce', activo: true },
  { id: 'ej-irma',      username: 'irma.jara',           nombre: 'Irma Jara',           rol: 'ejecutivo',      activo: true },
  { id: 'ej-marcos',    username: 'marcos.diamond',      nombre: 'Marcos Diamond',      rol: 'ejecutivo',      activo: true },
  { id: 'ej-nicolas',   username: 'nicolas.pacheco',     nombre: 'Nicolás Pacheco',     rol: 'ejecutivo',      activo: true },
  { id: 'ej-alejandro', username: 'alejandro.oxman',     nombre: 'Alejandro Oxman',     rol: 'ejecutivo',      activo: true },
  { id: 'ej-cynthia',   username: 'cynthia.romo',        nombre: 'Cynthia Romo',        rol: 'jefe_mayorista', activo: true },
];

async function seedIfEmpty() {
  logger.info('Seed: verificando datos iniciales...');

  const usuarios = await db.getAll('usuarios');
  const tieneAdmin = usuarios.some(u => u.rol === 'admin');
  if (!tieneAdmin) {
    logger.info('Seed: creando usuario admin...');
    await db.save('usuarios', buildAdmin());
  }

  const passwordHash = bcrypt.hashSync('cruzeiro2026', 10);
  for (const ej of EJECUTIVOS_SEED) {
    const existe = usuarios.some(u => u.username === ej.username);
    if (!existe) {
      logger.info(`Seed: creando ejecutivo ${ej.username}...`);
      await db.save('usuarios', {
        ...ej,
        password: passwordHash,
        createdAt: new Date().toISOString(),
      });
    }
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
