const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getAllCenters,
  getCenterStatus,
  getCurrentWeather,
  getLifeguardCounts,
  getSafetyFlags,
  getMobileGPSLocation
} = require('../controllers/publicController');

const router = express.Router();

// Routes (no authentication required)
router.get('/centers', asyncHandler(getAllCenters));
router.get('/centers/:id/status', asyncHandler(getCenterStatus));
router.get('/weather/current', asyncHandler(getCurrentWeather));
router.get('/lifeguards/counts', asyncHandler(getLifeguardCounts));
router.get('/safety/flags', asyncHandler(getSafetyFlags));
router.get('/mobile-gps', asyncHandler(getMobileGPSLocation));

module.exports = router; 