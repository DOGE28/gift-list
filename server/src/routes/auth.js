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

function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one capital letter';
  if (!/[^a-zA-Z0-9 ]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

function userResponse(user) {
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      mustChangePassword: !!user.must_change_password,
      isAdmin: !!user.is_admin,
    },
  };
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
    const passwordError = validatePassword(password);
    if (passwordError) {
      throw httpError(400, passwordError);
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

    const user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId);
    res.status(201).json(userResponse(user));
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

    res.json(userResponse(user));
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
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) {
    throw httpError(401, 'User not found');
  }
  res.json(userResponse(user));
});

// POST /api/auth/change-credentials
router.post(
  '/change-credentials',
  requireAuth,
  handle(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw httpError(400, 'email and password are required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail.length < 3 || normalizedEmail.length > 254) {
      throw httpError(400, 'Invalid email');
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      throw httpError(400, passwordError);
    }

    // Check if the new email is already taken by another user
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(normalizedEmail, req.user.id);
    if (existing) {
      throw httpError(409, 'Email already in use');
    }

    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    db.prepare(
      'UPDATE users SET email = ?, password_hash = ?, must_change_password = 0 WHERE id = ?'
    ).run(normalizedEmail, hash, req.user.id);

    const user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(req.user.id);

    const token = signToken(user.id);
    setAuthCookie(res, token);

    res.json(userResponse(user));
  })
);

export default router;
