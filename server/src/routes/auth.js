import { Router } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { handle, httpError } from '../util.js';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';
import { jwtSecret, cookieSecure } from '../config.js';

const router = Router();

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, jwtSecret, { expiresIn: '7d' });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

// POST /api/auth/register
router.post(
  '/register',
  handle(async (req, res) => {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      throw httpError(400, 'email, password, and displayName are required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail.length < 3 || normalizedEmail.length > 254) {
      throw httpError(400, 'Invalid email');
    }
    if (password.length < 8) {
      throw httpError(400, 'Password must be at least 8 characters');
    }
    if (displayName.length > 100) {
      throw httpError(400, 'Display name too long');
    }

    // Check for existing user
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizedEmail);
    if (existing) {
      throw httpError(409, 'Email already in use');
    }

    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const result = db
      .prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)')
      .run(normalizedEmail, hash, displayName.trim());

    const userId = result.lastInsertRowid;
    const token = signToken(userId);
    setAuthCookie(res, token);

    res.status(201).json({ id: userId, email: normalizedEmail, displayName: displayName.trim() });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  handle(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw httpError(400, 'email and password are required');
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim());

    if (!user) {
      throw httpError(401, 'Invalid email or password');
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      throw httpError(401, 'Invalid email or password');
    }

    const token = signToken(user.id);
    setAuthCookie(res, token);

    res.json({ id: user.id, email: user.email, displayName: user.display_name });
  })
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'Lax',
  });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, email, display_name FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) {
    throw httpError(401, 'User not found');
  }
  res.json({ id: user.id, email: user.email, displayName: user.display_name });
});

export default router;
