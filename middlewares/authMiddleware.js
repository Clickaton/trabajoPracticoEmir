export const authGuard = (req, res, next) => {
  const publicPaths = ['/login', '/register'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  if (req.session?.user) {
    return next();
  }

  return res.redirect('/login');
};

import { inferRoleFromDoc } from '../utils/roleUtil.js';

export const requireRole = (...allowedRoles) => (req, res, next) => {
  const user = req.session?.user;

  if (!user) {
    return res.redirect('/login');
  }

  const normalized = inferRoleFromDoc(user) || user.role || 'alumno';
  console.log('[authMiddleware] session user:', user);
  console.log('[authMiddleware] normalized role ->', normalized);
  req.session.user.role = normalized;

  if (allowedRoles.includes(normalized)) {
    return next();
  }

  if (req.accepts('html')) {
    return res.status(403).send('Acceso denegado');
  }

  return res.status(403).json({ error: 'Acceso denegado' });
};
