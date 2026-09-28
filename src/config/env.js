// Loads and validates environment variables once, at startup.
require('dotenv').config({ quiet: true });

const required = ['MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'BASE_URL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(', ')} (see .env.example)`);
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  // Public origin used to build short URLs, without trailing slash
  baseUrl: process.env.BASE_URL.replace(/\/+$/, ''),
};
