const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { register, login } = require('../controllers/auth');

const router = Router();

const emailRule = body('email').trim().isEmail().withMessage('Must be a valid email').toLowerCase();

router.post(
  '/register',
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required (max 100 chars)'),
  emailRule,
  // bcrypt only uses the first 72 bytes, so cap it there
  body('password')
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be 8-72 characters'),
  validate,
  register
);

router.post(
  '/login',
  emailRule,
  body('password').isString().notEmpty().withMessage('Password is required'),
  validate,
  login
);

module.exports = router;
