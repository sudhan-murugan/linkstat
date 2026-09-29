const { matchedData } = require('express-validator');
const Link = require('../models/Link');
const Click = require('../models/Click');

const TOP_REFERRERS_LIMIT = 10;

// Middleware: loads the link by :id and ensures the caller owns it (404 / 403 otherwise).
// Sets req.link for the handlers below.
async function requireLinkOwner(req, res, next) {
  const link = await Link.findById(req.params.id);
  if (!link) return res.status(404).json({ error: 'Link not found' });
  if (!link.owner.equals(req.user.id)) {
    return res.status(403).json({ error: 'You do not have access to this link' });
  }
  req.link = link;
  next();
}

// GET /api/links/:id/stats
async function getStats(req, res) {
  const linkId = req.link._id;

  const [clicksPerDay, topReferrers] = await Promise.all([
    // Clicks grouped by calendar day (UTC), oldest first
    Click.aggregate([
      { $match: { link: linkId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'UTC' } },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', clicks: 1 } },
    ]),
    // Most common referrers; missing Referer header is reported as "direct"
    Click.aggregate([
      { $match: { link: linkId } },
      { $group: { _id: { $ifNull: ['$referrer', 'direct'] }, clicks: { $sum: 1 } } },
      { $sort: { clicks: -1, _id: 1 } },
      { $limit: TOP_REFERRERS_LIMIT },
      { $project: { _id: 0, referrer: '$_id', clicks: 1 } },
    ]),
  ]);

  // Derived from the Click log so it always matches the series above
  const totalClicks = clicksPerDay.reduce((sum, day) => sum + day.clicks, 0);

  res.json({ linkId: req.link.id, totalClicks, clicksPerDay, topReferrers });
}

// GET /api/links/:id/clicks?page=1&limit=20 — newest first
async function listClicks(req, res) {
  // Express 5's req.query is re-parsed on each access, so read the sanitized ints via matchedData
  const { page = 1, limit = 20 } = matchedData(req, { locations: ['query'] });
  const filter = { link: req.link._id };

  const [clicks, total] = await Promise.all([
    Click.find(filter)
      .sort({ timestamp: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Click.countDocuments(filter),
  ]);

  res.json({
    clicks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

module.exports = { requireLinkOwner, getStats, listClicks };
