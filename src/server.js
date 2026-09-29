const { port } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { connectCache, disconnectCache } = require('./config/cache');
const app = require('./app');

// Entry point: connect to MongoDB and the cache first, then start accepting requests.
async function start() {
  await connectDB();
  await connectCache(); // never throws: falls back to in-memory if Redis is unavailable

  const server = app.listen(port, () => {
    console.log(`LinkStat listening on http://localhost:${port}`);
  });

  // Graceful shutdown on Ctrl+C / container stop
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await Promise.all([disconnectDB(), disconnectCache()]);
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
