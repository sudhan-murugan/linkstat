const Link = require('../models/Link');
const { baseUrl } = require('../config/env');
const { generateShortCode, SHORT_CODE_PATTERN } = require('../utils/shortCode');

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
  const link = SHORT_CODE_PATTERN.test(code)
    ? await Link.findOne({ shortCode: code }, { originalUrl: 1 }).lean()
    : null;

  if (!link) return res.status(404).json({ error: 'Short link not found' });
  res.redirect(302, link.originalUrl);
}

module.exports = { createLink, listLinks, redirect };
