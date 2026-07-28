'use strict';

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { DATA_DIR } = require('../config');
const logger = require('./logger');

/**
 * Creates a timestamped backup of all JSON files in DATA_DIR.
 * Instead of tar (which requires child_process or external deps), we copy
 * each JSON file into DATA_DIR/backups/<timestamp>/ and write a manifest.json.
 *
 * @returns {Promise<{ backupDir: string, files: string[], timestamp: string }>}
 */
async function crearBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBaseDir = path.join(DATA_DIR, 'backups');
  const backupDir = path.join(backupBaseDir, timestamp);

  // Ensure backup directories exist
  fs.mkdirSync(backupDir, { recursive: true });

  // Find all JSON files in DATA_DIR (not in subdirectories)
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const jsonFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.json'))
    .map(e => e.name);

  const manifest = {
    timestamp,
    source: DATA_DIR,
    backupDir,
    files: [],
    createdAt: new Date().toISOString(),
  };

  for (const filename of jsonFiles) {
    const src = path.join(DATA_DIR, filename);
    const dest = path.join(backupDir, filename);
    try {
      fs.copyFileSync(src, dest);
      manifest.files.push(filename);
    } catch (copyErr) {
      logger.warn(`Backup: no se pudo copiar ${filename}: ${copyErr.message}`);
    }
  }

  // Write manifest
  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  logger.info(`Backup: completado en ${backupDir} — ${manifest.files.length} archivos copiados.`);

  // Prune old backups: keep last 72 (i.e., 3 days at 1/hr)
  try {
    const backupFolders = fs.readdirSync(backupBaseDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort(); // ISO timestamps sort lexicographically = chronologically

    const MAX_BACKUPS = 72;
    if (backupFolders.length > MAX_BACKUPS) {
      const toDelete = backupFolders.slice(0, backupFolders.length - MAX_BACKUPS);
      for (const folder of toDelete) {
        const folderPath = path.join(backupBaseDir, folder);
        fs.rmSync(folderPath, { recursive: true, force: true });
        logger.info(`Backup: eliminado backup antiguo: ${folder}`);
      }
    }
  } catch (pruneErr) {
    logger.warn('Backup: error durante limpieza de backups antiguos:', pruneErr.message);
  }

  return { backupDir, files: manifest.files, timestamp };
}

/**
 * Start automatic backup cron job every 60 minutes.
 * Returns the cron task object (can be .stop()'d).
 */
function iniciarBackupAutomatico() {
  logger.info('Backup automático: iniciando tarea cron cada 60 minutos...');

  // Run immediately on start
  crearBackup().catch(err => logger.error('Backup inicial fallido:', err.message));

  const task = cron.schedule('0 * * * *', async () => {
    logger.info('Backup automático: ejecutando...');
    try {
      await crearBackup();
    } catch (err) {
      logger.error('Backup automático: error:', err.message);
    }
  });

  return task;
}

module.exports = { crearBackup, iniciarBackupAutomatico };
