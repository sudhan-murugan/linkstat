const { validationResult } = require('express-validator');

// Runs after express-validator chains; responds 400 with field errors if any failed.
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  res.status(400).json({
    error: 'Validation failed',
    details: result.array().map((e) => ({ field: e.path, message: e.msg })),
  });
}

module.exports = validate;
