'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
const { SESSION_SECRET, NODE_ENV } = require('./config');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

// ─── Route imports ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const leadsRoutes = require('./routes/leads.routes');
const catalogoRoutes = require('./routes/catalogo.routes');
const campanasRoutes = require('./routes/campanas.routes');
const configRoutes = require('./routes/config.routes');
const webhookRoutes = require('./routes/webhook.routes');
const chatTestRoutes = require('./routes/chat-test.routes');
const seguimientoRoutes = require('./modules/seguimiento/routes');
const ejecutivosRoutes = require('./routes/ejecutivos.routes');
const agendaRoutes = require('./routes/agenda.routes');
const archivosRoutes = require('./routes/archivos.routes');
const pipelineRoutes = require('./routes/pipeline.routes');
const dataRealRoutes = require('./routes/data-real.routes');

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

// Trust proxy (for Render, Heroku, etc.)
app.set('trust proxy', 1);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    sameSite: NODE_ENV === 'production' ? 'strict' : 'lax',
  },
}));

// ─── Request logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  },
}));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/campanas', campanasRoutes);
app.use('/api/config', configRoutes);
app.use('/api/chat-test', chatTestRoutes);
app.use('/api/ejecutivos', ejecutivosRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/archivos', archivosRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api', dataRealRoutes);

// Webhooks (no /api prefix — direct Meta URLs)
app.use('/webhook', webhookRoutes);

// Seguimiento del proyecto (Basic Auth)
app.use('/seguimiento', seguimientoRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── SPA catch-all ────────────────────────────────────────────────────────────
// Any GET that isn't an API or static file → serve index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhook') || req.path.startsWith('/seguimiento')) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── 404 for unknown API routes ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'No encontrado', message: `Ruta ${req.method} ${req.path} no existe.` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
