const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getAllCenters,
  getCenterStatus,
  getCurrentWeather
} = require('../controllers/publicController');

const router = express.Router();

// Routes (no authentication required)
router.get('/centers', asyncHandler(getAllCenters));
router.get('/centers/:id/status', asyncHandler(getCenterStatus));
router.get('/weather/current', asyncHandler(getCurrentWeather));

module.exports = router; 