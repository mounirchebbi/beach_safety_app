const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { checkRateLimitEnabled, conditionalRateLimit } = require('../../middleware/rateLimiter');

// Apply rate limiting middleware to emergency alert creation
router.post(
  '/',
  checkRateLimitEnabled,
  conditionalRateLimit,
  alertController.createAlert
);

module.exports = router; 