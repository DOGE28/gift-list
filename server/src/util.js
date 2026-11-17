/**
 * Create an HTTP error with a status code.
 */
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Wrap an async route handler so rejected promises are forwarded
 * to Express error middleware (required for Express 5).
 */
export function handle(fn) {
  return (...args) => fn(...args).catch((err) => {
    if (!err.status) err.status = 500;
    throw err;
  });
}

/**
 * Validate a URL string. Returns true if valid.
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse a price string to a number, returning null if not valid.
 */
export function toNumber(value) {
  if (value == null) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
