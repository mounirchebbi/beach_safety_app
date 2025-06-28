const express = require('express');
const { verifyToken, requireCenterAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getCurrentWeather,
  getWeatherForecast,
  getWeatherHistory,
  testWeatherApi
} = require('../controllers/weatherController');
const weatherService = require('../services/weatherService');

const router = express.Router();

// Routes
router.get('/centers/:id/current', verifyToken, requireCenterAdmin, asyncHandler(getCurrentWeather));
router.get('/centers/:id/forecast', verifyToken, requireCenterAdmin, asyncHandler(getWeatherForecast));
router.get('/centers/:id/history', verifyToken, requireCenterAdmin, asyncHandler(getWeatherHistory));

// Test route (no authentication required for debugging)
router.get('/test', asyncHandler(testWeatherApi));

// Manual weather update trigger (for testing)
router.post('/update-all', asyncHandler(async (req, res) => {
  try {
    await weatherService.updateAllCentersWeather();
    res.json({
      success: true,
      message: 'Weather update triggered successfully for all centers'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to trigger weather update',
      error: error.message
    });
  }
}));

module.exports = router; 