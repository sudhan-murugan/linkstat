const { cacheGet, cacheSet, cacheDel } = require('../config/cache');

// Cache for the redirect hot path: shortCode -> { id, originalUrl }.
// The id is kept so click tracking doesn't need a DB lookup either.

const keyFor = (shortCode) => `link:${shortCode}`;

const getCachedLink = (shortCode) => cacheGet(keyFor(shortCode));

const cacheLink = (link) =>
  cacheSet(keyFor(link.shortCode), { id: String(link._id), originalUrl: link.originalUrl });

const invalidateLinks = (shortCodes) => cacheDel(...shortCodes.map(keyFor));

module.exports = { getCachedLink, cacheLink, invalidateLinks };
