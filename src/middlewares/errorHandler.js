'use strict';

const logger = require('../utils/logger');

/**
 * Global Express error handler.
 * Must be registered LAST, after all routes.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  if (status >= 500) {
    logger.error(`[${req.method}] ${req.path} — ${status}: ${message}`, err.stack || '');
  } else {
    logger.warn(`[${req.method}] ${req.path} — ${status}: ${message}`);
  }

  res.status(status).json({
    error: err.name || 'Error',
    message,
  });
}

module.exports = errorHandler;
