import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { port, webDist as configWebDist } from './config.js';
import { handle } from './util.js';
import { requireAuth } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import eventRoutes from './routes/events.js';
import itemRoutes from './routes/items.js';
import guestRoutes from './routes/guest.js';

const app = express();

// --- Security middleware ---
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// --- Rate limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply API rate limit to all /api routes
app.use('/api', apiLimiter);
// Stricter rate limit on auth routes
app.use('/api/auth', authLimiter);

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/events', itemRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/g', guestRoutes);

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Static web assets ---
// Resolve the web dist directory
let webDist = configWebDist;
if (!webDist || !fs.existsSync(webDist)) {
  // Fallback: check for public/ in the project root
  const publicDir = path.resolve(path.dirname(process.cwd()), 'public');
  if (fs.existsSync(publicDir)) {
    webDist = publicDir;
  } else {
    webDist = path.resolve(process.cwd(), '../web/dist');
  }
}

app.use(express.static(webDist));

// --- 404 for unknown API routes ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- SPA catch-all (Express 5: no wildcard routes, use final middleware) ---
app.use((req, res) => {
  const indexPath = path.join(webDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Web assets not found. Run the web build first.' });
  }
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

// --- Start server ---
// port is already imported from config.js
app.listen(port, () => {
  console.log(`Gift List server listening on port ${port}`);
  console.log(`Web assets: ${webDist}`);
});
