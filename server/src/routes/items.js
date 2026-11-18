import { Router } from 'express';
import { handle, httpError, validateUrl } from '../util.js';
import { requireAuth } from '../middleware/auth.js';
import { filterItemsForViewer } from '../services/privacy.js';
import { scrapeMetadata } from '../services/scraper.js';
import db from '../db.js';

const router = Router();

router.use(requireAuth);

function checkEventAccess(eventId, userId) {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(eventId);
  if (!event) return null;

  // Owner can always access
  if (event.user_id === userId) return event;

  // Check if user owns a participating individual
  const participants = db
    .prepare(
      `SELECT i.user_id FROM event_participants ep
       JOIN individuals i ON i.id = ep.individual_id
       WHERE ep.event_id = ?`
    )
    .all(eventId);

  if (participants.some((p) => p.user_id === userId)) return event;

  return null;
}

function checkItemPermission(eventId, individualId, userId) {
  // Check if user is event owner, individual owner, or the one who added the item
  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(eventId);
  if (event && event.user_id === userId) return true;

  const individual = db
    .prepare('SELECT * FROM individuals WHERE id = ?')
    .get(individualId);
  if (individual && individual.user_id === userId) return true;

  return false;
}

// GET /api/events/:id/items
router.get('/:id/items', (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  const event = checkEventAccess(eventId, req.user.id);
  if (!event) {
    throw httpError(403, 'Not authorized to view this event');
  }

  const items = db
    .prepare('SELECT * FROM items WHERE event_id = ? ORDER BY created_at DESC')
    .all(eventId);

  const filtered = filterItemsForViewer(db, req.user.id, items);
        res.json({ items: filtered });
});

// POST /api/events/:id/items
router.post('/:id/items', handle(async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  const event = checkEventAccess(eventId, req.user.id);
  if (!event) {
    throw httpError(403, 'Not authorized to view this event');
  }

    const { individual_id: individualId, title, price, url, purchased } = req.body;

  if (!individualId) {
    throw httpError(400, 'individualId is required');
  }

  // Verify individual is a participant in this event
  const participant = db
    .prepare('SELECT 1 FROM event_participants WHERE event_id = ? AND individual_id = ?')
    .get(eventId, individualId);
  if (!participant) {
    throw httpError(400, 'Individual is not a participant in this event');
  }

  let itemTitle = title || null;
  let itemPrice = price || null;
  let itemUrl = url || null;
  let itemImageUrl = null;

  // Scrape metadata if URL is provided
  if (itemUrl && validateUrl(itemUrl)) {
    const scraped = await scrapeMetadata(itemUrl);
    if (!itemTitle && scraped.title) itemTitle = scraped.title;
    if (!itemPrice && scraped.price) itemPrice = scraped.price;
    itemImageUrl = scraped.imageUrl;
  }

  const result = db
    .prepare(
      `INSERT INTO items (event_id, individual_id, title, price, url, image_url, purchased, added_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      eventId,
      individualId,
      itemTitle,
      itemPrice,
      itemUrl,
      itemImageUrl,
      purchased ? 1 : 0,
      req.user.id
    );

  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(item);
}));

// GET /api/items/:id
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(id);

  if (!item) {
    throw httpError(404, 'Item not found');
  }

  const event = checkEventAccess(item.event_id, req.user.id);
  if (!event) {
    throw httpError(403, 'Not authorized to view this item');
  }

  // Privacy: hide purchased items from the target individual's owner
  const filtered = filterItemsForViewer(db, req.user.id, [item]);
  if (filtered.length === 0) {
    throw httpError(404, 'Item not found');
  }

  res.json(filtered[0]);
});

// PUT /api/items/:id
router.put('/:id', handle((req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(id);

  if (!item) {
    throw httpError(404, 'Item not found');
  }

  // Check permission
  const canModify = checkItemPermission(item.event_id, item.individual_id, req.user.id);
  if (!canModify) {
    throw httpError(403, 'Not authorized to modify this item');
  }

  const { title, price, url, purchased } = req.body;
  db.prepare(
    'UPDATE items SET title = ?, price = ?, url = ?, purchased = ? WHERE id = ?'
  ).run(
    title ?? item.title,
    price ?? item.price,
    url ?? item.url,
    purchased !== undefined ? (purchased ? 1 : 0) : item.purchased,
    id
  );

  const updated = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(id);
  res.json(updated);
}));

// DELETE /api/items/:id
router.delete('/:id', handle((req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(id);

  if (!item) {
    throw httpError(404, 'Item not found');
  }

  const canModify = checkItemPermission(item.event_id, item.individual_id, req.user.id);
  if (!canModify) {
    throw httpError(403, 'Not authorized to delete this item');
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  res.json({ ok: true });
}));

export default router;
