# Gift List PWA

A secure gift-request progressive web app with events, individuals, guest token links, and scraped product metadata.

## Features

- **Events**: Create and manage gift-giving events with participants
- **Individuals**: Track people (individuals) who receive gifts
- **Guest Access**: Share token-based links so guests can add items without an account
- **Item Scraping**: Automatically fetch product metadata (title, price, image) from product URLs
- **Privacy**: Purchased items are hidden from the owner of the target individual
- **PWA**: Installable on mobile devices with offline support

## Tech Stack

- **Backend**: Express 5, better-sqlite3, argon2, JWT (httpOnly cookies)
- **Frontend**: Vite 7, React 19, React Router 7, Vite PWA
- **Security**: helmet, express-rate-limit, argon2 password hashing
- **Scraping**: cheerio (JSON-LD → Open Graph → microdata fallback)

## Running Locally

```bash
# Install dependencies
npm install

# Build the web frontend
npm run build

# Start the server (serves both API and built web app)
npm start
```

The server runs on port **8585** by default.

## Running with Docker

```bash
docker build -t gift-list .
docker run --rm -p 8585:8585 gift-list
```

Or with Docker Compose:

```bash
docker compose up
```

Data is persisted in `./data/`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8585` |
| `JWT_SECRET` | Secret for signing JWTs | auto-generated |
| `COOKIE_SECURE` | Set `true` for HTTPS | `false` |
| `WEB_DIST` | Path to built web assets | auto-detected |
| `DATA_DIR` | Path to SQLite database | `./data` |

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Log in
- `POST /api/auth/logout` — Log out
- `GET /api/auth/me` — Get current user

### Individuals
- `GET /api/individuals` — List your individuals
- `POST /api/individuals` — Create individual
- `PUT /api/individuals/:id` — Update individual
- `DELETE /api/individuals/:id` — Delete individual

### Events
- `GET /api/events` — List events you can see
- `POST /api/events` — Create event
- `GET /api/events/:id` — Get event details
- `PUT /api/events/:id` — Update event
- `DELETE /api/events/:id` — Delete event
- `POST /api/events/:id/participants` — Add participant
- `DELETE /api/events/:id/participants/:individualId` — Remove participant
- `POST /api/events/:id/guest-tokens` — Create guest token
- `DELETE /api/events/:id/guest-tokens/:tokenId` — Revoke guest token

### Items
- `GET /api/events/:id/items` — List items for event
- `POST /api/events/:id/items` — Add item (triggers scrape)
- `PUT /api/items/:id` — Update item
- `DELETE /api/items/:id` — Delete item

### Guest (unauthenticated)
- `GET /api/g/:token` — Get guest event + items
- `POST /api/g/:token/items` — Add item as guest
