/**
 * Filter items for a viewer based on privacy rules.
 *
 * Rule: purchased items are hidden from the owner of the target individual.
 * All other users and guests see purchased items normally.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} viewerId - The user id of the viewer (null for guests)
 * @param {number} individualId - The individual the item is for
 * @param {object} item - The item row
 * @returns {boolean} - true if the item should be visible
 */
export function filterItemForViewer(db, viewerId, individualId, item) {
  // If the item is not purchased, it's always visible
  if (!item.purchased) return true;

  // If the viewer is a guest (no user id), they see everything
  if (viewerId == null) return true;

  // If the viewer owns the individual, hide purchased items
  const owner = db
    .prepare('SELECT user_id FROM individuals WHERE id = ?')
    .get(individualId);

  if (owner && owner.user_id === viewerId) {
    return false;
  }

  return true;
}

/**
 * Filter a list of items for a viewer.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number|null} viewerId - The user id of the viewer (null for guests)
 * @param {object[]} items - Array of item rows
 * @returns {object[]} - Filtered items
 */
export function filterItemsForViewer(db, viewerId, items) {
  return items.filter((item) =>
    filterItemForViewer(db, viewerId, item.individual_id, item)
  );
}
