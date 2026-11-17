import { Router } from 'express';
import { handle, httpError, validateUrl } from '../util.js';
import { optionalAuth } from '../middleware/auth.js';
import { filterItemsForViewer } from '../services/privacy.js';
import { scrapeMetadata } from '../services/scraper.js';
import db from '../db.js';

const router = Router();

// All guest routes use optional auth (guest may not be logged in)
router.use(optionalAuth);

function getGuestEventByToken(token) {
  const gt = db
    .prepare('SELECT * FROM guest_tokens WHERE token = ?')
    .get(token);
  if (!gt) return null;

  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(gt.event_id);
  if (!event) return null;

  const participants = db
    .prepare(
      `SELECT ep.individual_id, i.name
       FROM event_participants ep
       JOIN individuals i ON i.id = ep.individual_id
       WHERE ep.event_id = ?`
    )
    .all(gt.event_id);

  return { event, participants, guestToken: gt };
}

// GET /api/g/:token
router.get('/:token', (req, res) => {
  const result = getGuestEventByToken(req.params.token);
  if (!result) {
    throw httpError(404, 'Invalid guest token');
  }

  // Guests see items without privacy filtering (viewerId = null)
  const items = db
    .prepare('SELECT * FROM items WHERE event_id = ? ORDER BY created_at DESC')
    .all(result.event.id);

  const filtered = filterItemsForViewer(db, null, items);

  res.json({
    event: result.event,
    participants: result.participants,
    items: filtered,
  });
});

// POST /api/g/:token/items
router.post('/:token/items', handle(async (req, res) => {
  const result = getGuestEventByToken(req.params.token);
  if (!result) {
    throw httpError(404, 'Invalid guest token');
  }

  const eventId = result.event.id;
  const { individualId, title, price, url } = req.body;

  if (!individualId) {
    throw httpError(400, 'individualId is required');
  }

  // Verify individual is a participant
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

  if (itemUrl && validateUrl(itemUrl)) {
    const scraped = await scrapeMetadata(itemUrl);
    if (!itemTitle && scraped.title) itemTitle = scraped.title;
    if (!itemPrice && scraped.price) itemPrice = scraped.price;
    itemImageUrl = scraped.imageUrl;
  }

  const tokenValue = req.params.token;
  const resultInsert = db
    .prepare(
      `INSERT INTO items (event_id, individual_id, title, price, url, image_url, purchased, added_by_guest_token)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(eventId, individualId, itemTitle, itemPrice, itemUrl, itemImageUrl, tokenValue);

  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(resultInsert.lastInsertRowid);

  res.status(201).json(item);
}));

export default router;
