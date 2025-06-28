const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const weatherService = require('../services/weatherService');

// Get current weather for a center
const getCurrentWeather = asyncHandler(async (req, res) => {
  const { id: centerId } = req.params;
  
  try {
    // Check if center exists and user has access
    const centerResult = await query(
      'SELECT id, name FROM centers WHERE id = $1 AND is_active = true',
      [centerId]
    );

    if (centerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Center not found or inactive'
      });
    }

    const weatherData = await weatherService.getCurrentWeather(centerId);
    
    res.json({
      success: true,
      message: 'Current weather retrieved successfully',
      data: weatherData
    });
  } catch (error) {
    logger.error('Error getting current weather:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve current weather',
      error: error.message
    });
  }
});

// Get weather forecast for a center
const getWeatherForecast = asyncHandler(async (req, res) => {
  const { id: centerId } = req.params;
  
  try {
    // Check if center exists and user has access
    const centerResult = await query(
      'SELECT id, name FROM centers WHERE id = $1 AND is_active = true',
      [centerId]
    );

    if (centerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Center not found or inactive'
      });
    }

    const forecastData = await weatherService.getWeatherForecast(centerId);
    
    res.json({
      success: true,
      message: 'Weather forecast retrieved successfully',
      data: forecastData
    });
  } catch (error) {
    logger.error('Error getting weather forecast:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve weather forecast',
      error: error.message
    });
  }
});

// Get weather history for a center
const getWeatherHistory = asyncHandler(async (req, res) => {
  const { id: centerId } = req.params;
  const { days = 7 } = req.query;
  
  try {
    // Check if center exists and user has access
    const centerResult = await query(
      'SELECT id, name FROM centers WHERE id = $1 AND is_active = true',
      [centerId]
    );

    if (centerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Center not found or inactive'
      });
    }

    // Validate days parameter
    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      return res.status(400).json({
        success: false,
        message: 'Days parameter must be between 1 and 30'
      });
    }

    const historyData = await weatherService.getWeatherHistory(centerId, daysNum);
    
    res.json({
      success: true,
      message: 'Weather history retrieved successfully',
      data: historyData
    });
  } catch (error) {
    logger.error('Error getting weather history:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve weather history',
      error: error.message
    });
  }
});

// Test weather API connection (for debugging)
const testWeatherApi = asyncHandler(async (req, res) => {
  try {
    const testResult = await weatherService.testApiConnection();
    
    res.json({
      success: true,
      message: 'Weather API test completed',
      data: testResult
    });
  } catch (error) {
    logger.error('Error testing weather API:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to test weather API',
      error: error.message
    });
  }
});

module.exports = {
  getCurrentWeather,
  getWeatherForecast,
  getWeatherHistory,
  testWeatherApi
}; 