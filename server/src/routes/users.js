import { Router } from 'express';
import { handle, httpError } from '../util.js';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

// GET /api/individuals
router.get('/', (req, res) => {
  const individuals = db
    .prepare('SELECT * FROM individuals WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ individuals });
});

// POST /api/individuals
router.post('/', handle((req, res) => {
  const { name, notes } = req.body;
  if (!name || !name.trim()) {
    throw httpError(400, 'name is required');
  }
  if (name.trim().length > 200) {
    throw httpError(400, 'Name too long');
  }

  const result = db
    .prepare('INSERT INTO individuals (user_id, name, notes) VALUES (?, ?, ?)')
    .run(req.user.id, name.trim(), notes || null);

  const individual = db
    .prepare('SELECT * FROM individuals WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(individual);
}));

// PUT /api/individuals/:id
router.put('/:id', handle((req, res) => {
  const id = parseInt(req.params.id, 10);
  const individual = db
    .prepare('SELECT * FROM individuals WHERE id = ?')
    .get(id);

  if (!individual) {
    throw httpError(404, 'Individual not found');
  }
  if (individual.user_id !== req.user.id) {
    throw httpError(403, 'Not your individual');
  }

  const { name, notes } = req.body;
  db.prepare('UPDATE individuals SET name = ?, notes = ? WHERE id = ?').run(
    name ? name.trim() : individual.name,
    notes || null,
    id
  );

  const updated = db
    .prepare('SELECT * FROM individuals WHERE id = ?')
    .get(id);
  res.json(updated);
}));

// DELETE /api/individuals/:id
router.delete('/:id', handle((req, res) => {
  const id = parseInt(req.params.id, 10);
  const individual = db
    .prepare('SELECT * FROM individuals WHERE id = ?')
    .get(id);

  if (!individual) {
    throw httpError(404, 'Individual not found');
  }
  if (individual.user_id !== req.user.id) {
    throw httpError(403, 'Not your individual');
  }

  // Check if individual is part of any events
  const events = db
    .prepare('SELECT event_id FROM event_participants WHERE individual_id = ?')
    .all(id);
  if (events.length > 0) {
    throw httpError(400, 'Cannot delete: individual is part of one or more events');
  }

  db.prepare('DELETE FROM individuals WHERE id = ?').run(id);
  res.json({ ok: true });
}));

export default router;
