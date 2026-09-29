const { rateLimit } = require('express-rate-limit');

// Per-IP limiters. Counters live in process memory, so with several app
// instances each one enforces its own limit.

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Consistent JSON 429 body, with seconds until the window resets.
function tooManyRequests(message) {
  return (req, res, next, options) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);
    res.status(options.statusCode).json({ error: 'Too many requests', message, retryAfter });
  };
}

// POST /api/links — 20 new links per 15 minutes per IP
const createLinkLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests('Link creation limit reached, please try again later.'),
});

// /auth/* — 10 failed attempts per 15 minutes per IP. Successful requests
// aren't counted, so legitimate users aren't locked out but brute-forcing is.
const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests('Too many authentication attempts, please try again later.'),
});

module.exports = { createLinkLimiter, authLimiter };
