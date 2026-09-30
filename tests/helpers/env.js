// Runs before each test file (Jest "setupFiles"), before src/config/env.js is loaded.
// Values set here win over .env, since dotenv never overrides existing variables.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://placeholder/overridden-by-mongodb-memory-server';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BASE_URL = 'http://short.test';
process.env.REDIS_URL = ''; // always use the in-memory cache in tests
