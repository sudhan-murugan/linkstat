const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

const SALT_ROUNDS = 12;
// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync('dummy-password', SALT_ROUNDS);

async function register(req, res) {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const user = await User.create({ name, email, password: hash });
    res.status(201).json({ user });
  } catch (err) {
    // Race: another request registered the same email between the check and insert
    if (err.code === 11000) return res.status(409).json({ error: 'Email is already registered' });
    throw err;
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  const valid = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = jwt.sign({}, jwtSecret, {
    subject: user.id,
    expiresIn: jwtExpiresIn,
    algorithm: 'HS256',
  });
  res.json({ accessToken, tokenType: 'Bearer', expiresIn: jwtExpiresIn });
}

module.exports = { register, login };
