'use strict';

/**
 * Middleware: require authenticated session.
 * Returns 401 JSON if no session.usuario exists.
 */
function requireAuth(req, res, next) {
  if (req.path.startsWith('/webhook') || req.path.startsWith('/api/webhook')) {
    return next();
  }
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ error: 'No autorizado', message: 'Debes iniciar sesión para acceder a este recurso.' });
  }
  next();
}

/**
 * Middleware factory: require one of the given roles.
 * Must be used after requireAuth.
 */
function requireRole(roles) {
  return function (req, res, next) {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({ error: 'No autorizado', message: 'Debes iniciar sesión.' });
    }
    const rol = req.session.usuario.rol;
    if (!roles.includes(rol)) {
      return res.status(403).json({ error: 'Prohibido', message: `Se requiere uno de los roles: ${roles.join(', ')}.` });
    }
    next();
  };
}

/**
 * Shorthand: require admin role.
 */
const requireAdmin = requireRole(['admin']);

module.exports = { requireAuth, requireRole, requireAdmin };
