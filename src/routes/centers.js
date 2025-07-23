const express = require('express');
const router = express.Router();
const centerController = require('../controllers/centerController');
const { verifyToken } = require('../middleware/auth');

// Add PATCH route for rate limit toggle
router.patch('/:centerId/rate-limit', verifyToken, centerController.setRateLimitEnabled);

module.exports = router; 