const Link = require('../models/Link');
const Click = require('../models/Click');
const { baseUrl } = require('../config/env');
const { generateShortCode, SHORT_CODE_PATTERN } = require('../utils/shortCode');
const { getCachedLink, cacheLink } = require('../utils/linkCache');

const MAX_CODE_ATTEMPTS = 5;

const toResponse = (link) => ({ ...link.toJSON(), shortUrl: `${baseUrl}/${link.shortCode}` });

// POST /api/links
async function createLink(req, res) {
  // Collisions are astronomically rare, but retry on the unique index just in case
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    try {
      const link = await Link.create({
        originalUrl: req.body.url,
        shortCode: generateShortCode(),
        owner: req.user.id,
      });
      return res.status(201).json({ link: toResponse(link) });
    } catch (err) {
      const isCodeCollision = err.code === 11000 && err.keyPattern?.shortCode;
      if (!isCodeCollision || attempt === MAX_CODE_ATTEMPTS) throw err;
    }
  }
}

// GET /api/links
async function listLinks(req, res) {
  const links = await Link.find({ owner: req.user.id }).sort({ createdAt: -1 });
  res.json({ links: links.map(toResponse) });
}

// GET /:code — public redirect. 302 (not 301) so browsers don't cache it
// and every visit reaches the server (needed for click analytics).
async function redirect(req, res) {
  const { code } = req.params;
  if (!SHORT_CODE_PATTERN.test(code)) return res.status(404).json({ error: 'Short link not found' });

  // Serve from cache when possible; on a miss, load from MongoDB and cache it.
  let link = await getCachedLink(code);
  res.set('X-Cache', link ? 'HIT' : 'MISS');

  if (!link) {
    const doc = await Link.findOne({ shortCode: code }, { originalUrl: 1, shortCode: 1 }).lean();
    if (!doc) return res.status(404).json({ error: 'Short link not found' });
    await cacheLink(doc);
    link = { id: String(doc._id), originalUrl: doc.originalUrl };
  }

  // Fire-and-forget: start the writes, but don't await them — a slow or failing
  // analytics write must never delay or break the redirect.
  recordClick(link.id, req).catch((err) => console.error('Click tracking failed:', err.message));

  res.redirect(302, link.originalUrl);
}

// Header values are client-controlled; cap their size before storing.
const MAX_HEADER_LENGTH = 1024;
const clip = (value) => (value ? value.slice(0, MAX_HEADER_LENGTH) : null);

async function recordClick(linkId, req) {
  await Promise.all([
    Click.create({
      link: linkId,
      referrer: clip(req.get('referer')),
      userAgent: clip(req.get('user-agent')),
      ipAddress: req.ip || null,
    }),
    Link.updateOne({ _id: linkId }, { $inc: { clickCount: 1 } }),
  ]);
}

module.exports = { createLink, listLinks, redirect };
