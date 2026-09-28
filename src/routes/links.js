const { Router } = require('express');
const { body } = require('express-validator');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createLink, listLinks } = require('../controllers/links');

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

module.exports = router;
