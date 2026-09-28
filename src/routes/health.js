const { Router } = require('express');

const router = Router();

// Liveness check for load balancers / uptime monitors.
router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
