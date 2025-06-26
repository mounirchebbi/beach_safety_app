const express = require('express');
const { verifyToken, requireCenterAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getCurrentWeather,
  getWeatherForecast,
  getWeatherHistory
} = require('../controllers/weatherController');

const router = express.Router();

// Routes
router.get('/centers/:id/current', verifyToken, requireCenterAdmin, asyncHandler(getCurrentWeather));
router.get('/centers/:id/forecast', verifyToken, requireCenterAdmin, asyncHandler(getWeatherForecast));
router.get('/centers/:id/history', verifyToken, requireCenterAdmin, asyncHandler(getWeatherHistory));

module.exports = router; 