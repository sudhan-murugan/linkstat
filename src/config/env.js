// Loads and validates environment variables once, at startup.
require('dotenv').config({ quiet: true });

const required = ['MONGODB_URI'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(', ')} (see .env.example)`);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI,
};
