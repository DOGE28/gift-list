import { Router } from 'express';
import crypto from 'node:crypto';
import { handle, httpError } from '../util.js';
import { requireAuth } from '../middleware/auth.js';
import { filterItemsForViewer } from '../services/privacy.js';
import db from '../db.js';

const router = Router();

router.use(requireAuth);

function getEventWithDetails(db, eventId, viewerId) {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(eventId);
  if (!event) return null;

  // Check visibility
  const isOwner = event.user_id === viewerId;
  const participants = db
    .prepare(
      `SELECT ep.individual_id, i.name, i.user_id as individual_owner
       FROM event_participants ep
       JOIN individuals i ON i.id = ep.individual_id
       WHERE ep.event_id = ?`
    )
    .all(eventId);

  const isParticipantOwner = participants.some((p) => p.individual_owner === viewerId);

  if (!isOwner && !isParticipantOwner) {
    return { visible: false, event };
  }

  return { visible: true, event, participants };
}

// GET /api/events
router.get('/', (req, res) => {
  const events = db
    .prepare('SELECT * FROM events WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);

  // Also get events where viewer owns a participating individual
  const ownedIndividuals = db
    .prepare('SELECT id FROM individuals WHERE user_id = ?')
    .all(req.user.id)
    .map((r) => r.id);

  let visibleEvents = [];
  if (ownedIndividuals.length > 0) {
    const placeholders = ownedIndividuals.map(() => '?').join(',');
    const participantEvents = db
      .prepare(
        `SELECT DISTINCT ep.event_id
         FROM event_participants ep
         WHERE ep.individual_id IN (${placeholders})`
      )
      .all(...ownedIndividuals)
      .map((r) => r.event_id);

    for (const eid of participantEvents) {
      const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(eid);
      if (ev && !events.some((e) => e.id === ev.id)) {
        visibleEvents.push(ev);
      }
    }
  }

  const allEvents = [...events, ...visibleEvents];
    res.json({ events: allEvents });
});

// POST /api/events
router.post('/', handle((req, res) => {
  const { title, description, eventDate } = req.body;
  if (!title || !title.trim()) {
    throw httpError(400, 'title is required');
  }
  if (title.trim().length > 200) {
    throw httpError(400, 'Title too long');
  }

  const result = db
    .prepare('INSERT INTO events (user_id, title, description, event_date, is_active) VALUES (?, ?, ?, ?, 1)')
    .run(req.user.id, title.trim(), description || null, eventDate || null);

  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(event);
}));

// GET /api/events/:id
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = getEventWithDetails(db, id, req.user.id);
  if (!result) {
    throw httpError(404, 'Event not found');
  }
  if (!result.visible) {
    throw httpError(403, 'Not authorized to view this event');
  }

  const items = db
    .prepare('SELECT * FROM items WHERE event_id = ? ORDER BY created_at DESC')
    .all(id);

  const filteredItems = filterItemsForViewer(db, req.user.id, items);

  const tokens = db
    .prepare('SELECT id, token, created_at FROM guest_tokens WHERE event_id = ?')
    .all(id);

  res.json({
    event: result.event,
    participants: result.participants,
    items: filteredItems,
    guestTokens: tokens,
  });
});

// GET /api/events/:id/guest-tokens
router.get('/:id/guest-tokens', (req, res) => {
  const id = parseInt(req.params.id, 10);

  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(id);
  if (!event) {
    throw httpError(404, 'Event not found');
  }
  if (event.user_id !== req.user.id && !req.user.is_admin) {
    throw httpError(403, 'Access denied');
  }

  const tokens = db
    .prepare('SELECT id, token, created_at FROM guest_tokens WHERE event_id = ?')
    .all(id);

  res.json({ tokens });
});

// PUT /api/events/:id
router.put('/:id', handle((req, res) => {
  const id = parseInt(req.params.id, 10);
  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(id);

  if (!event) {
    throw httpError(404, 'Event not found');
  }
  if (event.user_id !== req.user.id) {
    throw httpError(403, 'Not your event');
  }

  const { title, description, eventDate, is_active } = req.body;
  db.prepare('UPDATE events SET title = ?, description = ?, event_date = ?, is_active = ? WHERE id = ?').run(
    title ? title.trim() : event.title,
    description || null,
    eventDate || null,
    is_active === undefined ? event.is_active : is_active ? 1 : 0,
    id
  );

  const updated = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(id);
  res.json(updated);
}));

// DELETE /api/events/:id
router.delete('/:id', handle((req, res) => {
  const id = parseInt(req.params.id, 10);
  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(id);

  if (!event) {
    throw httpError(404, 'Event not found');
  }
  if (event.user_id !== req.user.id) {
    throw httpError(403, 'Not your event');
  }

  db.prepare('DELETE FROM events WHERE id = ?').run(id);
  // Cascade: participants, items, guest tokens
  db.prepare('DELETE FROM event_participants WHERE event_id = ?').run(id);
  db.prepare('DELETE FROM items WHERE event_id = ?').run(id);
  db.prepare('DELETE FROM guest_tokens WHERE event_id = ?').run(id);

  res.json({ ok: true });
}));

// POST /api/events/:id/participants
router.post('/:id/participants', handle((req, res) => {
  const eventId = parseInt(req.params.id, 10);
    const { individual_id: individualId } = req.body;

  if (!individualId) {
    throw httpError(400, 'individualId is required');
  }

  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(eventId);
  if (!event) {
    throw httpError(404, 'Event not found');
  }
  if (event.user_id !== req.user.id) {
    throw httpError(403, 'Not your event');
  }

  const individual = db
    .prepare('SELECT * FROM individuals WHERE id = ?')
    .get(individualId);
  if (!individual) {
    throw httpError(404, 'Individual not found');
  }

  // Check if already a participant
  const existing = db
    .prepare('SELECT 1 FROM event_participants WHERE event_id = ? AND individual_id = ?')
    .get(eventId, individualId);
  if (existing) {
    throw httpError(409, 'Individual already participating');
  }

  db.prepare('INSERT INTO event_participants (event_id, individual_id) VALUES (?, ?)')
    .run(eventId, individualId);

  res.status(201).json({ ok: true });
}));

// DELETE /api/events/:id/participants/:individualId
router.delete('/:id/participants/:individualId', handle((req, res) => {
  const eventId = parseInt(req.params.id, 10);
  const individualId = parseInt(req.params.individualId, 10);

  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(eventId);
  if (!event) {
    throw httpError(404, 'Event not found');
  }
  if (event.user_id !== req.user.id) {
    throw httpError(403, 'Not your event');
  }

  const existing = db
    .prepare('SELECT 1 FROM event_participants WHERE event_id = ? AND individual_id = ?')
    .get(eventId, individualId);
  if (!existing) {
    throw httpError(404, 'Participant not found');
  }

  db.prepare('DELETE FROM event_participants WHERE event_id = ? AND individual_id = ?')
    .run(eventId, individualId);

  res.json({ ok: true });
}));

// POST /api/events/:id/guest-tokens
router.post('/:id/guest-tokens', handle((req, res) => {
  const eventId = parseInt(req.params.id, 10);

  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(eventId);
  if (!event) {
    throw httpError(404, 'Event not found');
  }
  if (event.user_id !== req.user.id) {
    throw httpError(403, 'Not your event');
  }

  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO guest_tokens (event_id, token) VALUES (?, ?)')
    .run(eventId, token);

  res.status(201).json({ token, url: `/g/${token}` });
}));

// DELETE /api/events/:id/guest-tokens/:tokenId
router.delete('/:id/guest-tokens/:tokenId', handle((req, res) => {
  const eventId = parseInt(req.params.id, 10);
  const tokenId = parseInt(req.params.tokenId, 10);

  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(eventId);
  if (!event) {
    throw httpError(404, 'Event not found');
  }
  if (event.user_id !== req.user.id) {
    throw httpError(403, 'Not your event');
  }

  const gt = db
    .prepare('SELECT * FROM guest_tokens WHERE id = ? AND event_id = ?')
    .get(tokenId, eventId);
  if (!gt) {
    throw httpError(404, 'Guest token not found');
  }

  db.prepare('DELETE FROM guest_tokens WHERE id = ?').run(tokenId);
  res.json({ ok: true });
}));

export default router;
