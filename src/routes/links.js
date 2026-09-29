const { Router } = require('express');
const { body, param, query } = require('express-validator');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createLink, listLinks } = require('../controllers/links');
const { requireLinkOwner, getStats, listClicks } = require('../controllers/analytics');

const router = Router();

router.use(requireAuth); // every /api/links route is protected

router.post(
  '/',
  body('url')
    .trim()
    .isLength({ max: 2048 })
    .withMessage('URL must be at most 2048 characters')
    .isURL({ protocols: ['http', 'https'], require_protocol: true, require_valid_protocol: true })
    .withMessage('Must be a valid http(s) URL, e.g. https://example.com/page'),
  validate,
  createLink
);

router.get('/', listLinks);

// Analytics — owner-only (requireLinkOwner returns 404/403)
const linkIdRule = param('id').isMongoId().withMessage('Invalid link id');

router.get('/:id/stats', linkIdRule, validate, requireLinkOwner, getStats);

router.get(
  '/:id/clicks',
  linkIdRule,
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
    .toInt(),
  validate,
  requireLinkOwner,
  listClicks
);

module.exports = router;
