import * as cheerio from 'cheerio';
import db from '../db.js';

/**
 * Scrape product metadata from a URL.
 * Falls back: JSON-LD Product → Open Graph → microdata.
 * Results are cached in the scrape_cache table.
 *
 * @param {string} url - The product URL to scrape
 * @returns {Promise<{title: string|null, price: string|null, imageUrl: string|null}>}
 */
export async function scrapeMetadata(url) {
  // Check cache first
  const cached = db
    .prepare('SELECT title, price, image_url FROM scrape_cache WHERE url = ?')
    .get(url);
  if (cached) {
    return {
      title: cached.title,
      price: cached.price,
      imageUrl: cached.image_url,
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; GiftListBot/1.0; +https://github.com/DOGE28/gift-list)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let title = null;
    let price = null;
    let imageUrl = null;

    // 1. Try JSON-LD Product
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.children.text() || '');
        const products = Array.isArray(data) ? data : [data];
        for (const p of products) {
          if (p['@type'] === 'Product' || (p['@type'] && String(p['@type']).includes('Product'))) {
            if (p.name) title = p.name;
            if (p.offers) {
              const offers = Array.isArray(p.offers) ? p.offers : [p.offers];
              for (const o of offers) {
                if (o.price) {
                  price = String(o.price);
                  break;
                }
              }
            }
            if (p.image) {
              const img = Array.isArray(p.image) ? p.image[0] : p.image;
              imageUrl = typeof img === 'string' ? img : null;
            }
            break;
          }
        }
        if (title) break;
      } catch {
        // Invalid JSON, skip
      }
    }

    // 2. Try Open Graph
    if (!title) {
      const ogTitle = $('meta[property="og:title"]').attr('content');
      if (ogTitle) title = ogTitle;
    }
    if (!price) {
      const ogPrice =
        $('meta[property="og:price"]').attr('content') ||
        $('meta[property="product:price:amount"]').attr('content');
      if (ogPrice) price = ogPrice;
    }
    if (!imageUrl) {
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) imageUrl = ogImage;
    }

    // 3. Try microdata
    if (!title) {
      const microTitle = $('[itemtype*="Product"] [itemprop="name"]').text().trim();
      if (microTitle) title = microTitle;
    }
    if (!price) {
      const microPrice = $('[itemtype*="Product"] [itemprop="price"]').text().trim();
      if (microPrice) price = microPrice;
    }
    if (!imageUrl) {
      const microImage = $('[itemtype*="Product"] [itemprop="image"]').attr('content')
        || $('[itemtype*="Product"] [itemprop="image"]').attr('src');
      if (microImage) imageUrl = microImage;
    }

    // 4. Fallback to page title
    if (!title) {
      title = $('title').text().trim() || null;
    }

    // Store in cache
    db.prepare(
      'INSERT INTO scrape_cache (url, title, price, image_url) VALUES (?, ?, ?, ?)'
    ).run(url, title, price, imageUrl);

    return { title, price, imageUrl };
  } catch (err) {
    console.error(`Scrape failed for ${url}: ${err.message}`);
    // Store a failed cache entry (nulls) to avoid repeated attempts
    db.prepare(
      'INSERT INTO scrape_cache (url, title, price, image_url) VALUES (?, ?, ?, ?)'
    ).run(url, null, null, null);
    return { title: null, price: null, imageUrl: null };
  }
}
