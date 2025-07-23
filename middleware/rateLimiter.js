const rateLimit = require('express-rate-limit');
const db = require('../backend/src/config/database');

// Express-rate-limit instance: 3 requests per user/IP per 5 minutes
const emergencyAlertLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: {
    success: false,
    message: 'Too many emergency alerts submitted. Please wait before trying again.'
  },
  keyGenerator: (req) => req.user?.id || req.ip
});

// Middleware to check if rate limiting is enabled for the user's center
async function checkRateLimitEnabled(req, res, next) {
  let enabled = true;
  if (req.user?.center_id) {
    try {
      const result = await db.query(
        'SELECT emergency_alert_rate_limit_enabled FROM centers WHERE id = $1',
        [req.user.center_id]
      );
      enabled = result.rows[0]?.emergency_alert_rate_limit_enabled !== false;
    } catch (err) {
      // If DB check fails, default to enabled for safety
      enabled = true;
    }
  }
  req.rateLimitEnabled = enabled;
  next();
}

// Middleware to apply the limiter only if enabled
function conditionalRateLimit(req, res, next) {
  if (req.rateLimitEnabled) {
    return emergencyAlertLimiter(req, res, next);
  }
  next();
}

module.exports = { checkRateLimitEnabled, conditionalRateLimit }; 