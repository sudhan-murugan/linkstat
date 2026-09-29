const express = require('express');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const linkRoutes = require('./routes/links');
const { redirect } = require('./controllers/links');
const { authLimiter } = require('./middleware/rateLimit');
const { trustProxy } = require('./config/env');

// Builds the Express app (no network/DB side effects — easy to test).
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', trustProxy);
app.use(express.json({ limit: '10kb' }));

app.use('/health', healthRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/api/links', linkRoutes);

// Public short-link redirect. Must stay last so it doesn't shadow the routes above.
app.get('/:code', redirect);

// 404 for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler (Express 5 forwards rejected async handlers here)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.expose ? err.message : 'Internal server error' });
});

module.exports = app;
