'use strict';

const fs = require('fs');
const { PORT, DATA_DIR } = require('./config');
const logger = require('./utils/logger');

// ─── Ensure DATA_DIR exists before anything else ──────────────────────────────
if (!fs.existsSync('/data/cruzeiro')) fs.mkdirSync('/data/cruzeiro', { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
logger.info(`DATA_DIR: ${DATA_DIR}`);

// ─── Imports (after DATA_DIR is ready) ───────────────────────────────────────
const app = require('./app');
const { seedIfEmpty } = require('./data/seed');
const { iniciarBackupAutomatico } = require('./utils/backup');

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // 0. Load Excel data into memory (síncrono, antes de cualquier request)
    const dataStore = require('./data/dataStore');
    dataStore.init();
    dataStore.startAutoReload();

    // 1. Seed initial data if collections are empty
    await seedIfEmpty();

    // 2. Start automatic backup cron (every 60 min)
    iniciarBackupAutomatico();

    // 3. Start Express server
    app.listen(PORT, () => {
      logger.info(`Servidor FunnelOS Cruzeiro escuchando en http://localhost:${PORT}`);
      logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error('Error fatal al iniciar el servidor:', err.message, err.stack);
    process.exit(1);
  }
}

bootstrap();
