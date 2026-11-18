import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import argon2 from 'argon2';
import { dataDir, dbFile } from './config.js';

// Ensure data directory exists
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      must_change_password INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0
    );

  CREATE TABLE IF NOT EXISTS individuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS event_participants (
    event_id INTEGER NOT NULL REFERENCES events(id),
    individual_id INTEGER NOT NULL REFERENCES individuals(id),
    PRIMARY KEY (event_id, individual_id)
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id),
    individual_id INTEGER NOT NULL REFERENCES individuals(id),
    title TEXT,
    price TEXT,
    url TEXT,
    image_url TEXT,
    purchased INTEGER NOT NULL DEFAULT 0,
    added_by_user_id INTEGER,
    added_by_guest_token TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guest_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id),
    token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scrape_cache (
    url TEXT PRIMARY KEY,
    title TEXT,
    price TEXT,
    image_url TEXT,
    scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: ensure must_change_password and is_admin columns exist
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('must_change_password')) {
  db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
}
if (!userColumns.includes('is_admin')) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
}

// Migration: ensure is_active column exists on events
const eventColumns = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
if (!eventColumns.includes('is_active')) {
  db.exec('ALTER TABLE events ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
}

// Seed default admin if not present
const existingAdmin = db
  .prepare('SELECT id FROM users WHERE email = ?')
  .get('admin@changeme.com');
if (!existingAdmin) {
  const adminHash = await argon2.hash('admin123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  db.prepare(
    'INSERT INTO users (email, password_hash, display_name, must_change_password, is_admin) VALUES (?, ?, ?, ?, ?)'
  ).run('admin@changeme.com', adminHash, 'Admin', 1, 1);
}

export default db;
