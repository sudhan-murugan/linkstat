const express = require('express');
const healthRoutes = require('./routes/health');

// Builds the Express app (no network/DB side effects — easy to test).
const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.use('/health', healthRoutes);

// 404 for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error' });
});

module.exports = app;
