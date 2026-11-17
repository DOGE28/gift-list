import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config.js';
import { httpError } from '../util.js';

/**
 * Middleware that requires a valid JWT cookie.
 * Attaches `req.user` with the user's id.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return next(httpError(401, 'Not authenticated'));
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = { id: Number(decoded.sub) };
    next();
  } catch {
    next(httpError(401, 'Invalid or expired token'));
  }
}

/**
 * Middleware that optionally attaches `req.user` if a valid token is present.
 */
export function optionalAuth(req, res, next) {
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = { id: Number(decoded.sub) };
    } catch {
      // No valid token — proceed without auth
    }
  }
  next();
}
