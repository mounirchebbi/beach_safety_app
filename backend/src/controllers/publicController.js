const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

const getAllCenters = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Get all centers (public) - Implementation pending',
    data: []
  });
});

const getCenterStatus = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Get center status (public) - Implementation pending',
    data: {}
  });
});

const getCurrentWeather = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Get current weather (public) - Implementation pending',
    data: {}
  });
});

module.exports = {
  getAllCenters,
  getCenterStatus,
  getCurrentWeather
}; 