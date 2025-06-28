const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

const getAllCenters = asyncHandler(async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        id, name, description, 
        ST_X(location) as longitude, 
        ST_Y(location) as latitude,
        address, phone, email, operating_hours,
        created_at, updated_at, is_active
       FROM centers 
       WHERE is_active = true 
       ORDER BY name`,
      []
    );

    const centers = result.rows.map(center => ({
      ...center,
      location: {
        type: 'Point',
        coordinates: [parseFloat(center.longitude), parseFloat(center.latitude)]
      }
    }));

    res.json({
      success: true,
      message: 'Centers retrieved successfully',
      data: centers
    });
  } catch (error) {
    logger.error('Error getting public centers:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve centers',
      error: error.message
    });
  }
});

const getCenterStatus = asyncHandler(async (req, res) => {
  const { id: centerId } = req.params;
  
  try {
    // Get center info
    const centerResult = await query(
      `SELECT 
        id, name, description, 
        ST_X(location) as longitude, 
        ST_Y(location) as latitude,
        address, phone, email, operating_hours,
        created_at, updated_at, is_active
       FROM centers 
       WHERE id = $1 AND is_active = true`,
      [centerId]
    );

    if (centerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Center not found or inactive'
      });
    }

    const center = centerResult.rows[0];
    center.location = {
      type: 'Point',
      coordinates: [parseFloat(center.longitude), parseFloat(center.latitude)]
    };

    // Get current safety flag
    const flagResult = await query(
      `SELECT * FROM safety_flags 
       WHERE center_id = $1 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY set_at DESC 
       LIMIT 1`,
      [centerId]
    );

    // Get active lifeguards count
    const lifeguardResult = await query(
      `SELECT COUNT(*) as active_count 
       FROM lifeguards l
       JOIN users u ON l.user_id = u.id
       WHERE l.center_id = $1 AND u.is_active = true`,
      [centerId]
    );

    // Get active alerts count
    const alertResult = await query(
      `SELECT COUNT(*) as active_count 
       FROM emergency_alerts 
       WHERE center_id = $1 AND status IN ('active', 'responding')`,
      [centerId]
    );

    const status = {
      center,
      current_flag: flagResult.rows[0] || null,
      active_lifeguards: parseInt(lifeguardResult.rows[0].active_count),
      active_alerts: parseInt(alertResult.rows[0].active_count),
      last_updated: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Center status retrieved successfully',
      data: status
    });
  } catch (error) {
    logger.error('Error getting center status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve center status',
      error: error.message
    });
  }
});

const getCurrentWeather = asyncHandler(async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        wd.*,
        c.name as center_name,
        ST_X(c.location) as longitude,
        ST_Y(c.location) as latitude
       FROM weather_data wd
       JOIN centers c ON wd.center_id = c.id
       WHERE c.is_active = true
       AND wd.recorded_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
       ORDER BY wd.recorded_at DESC`,
      []
    );

    const weatherData = result.rows.map(row => ({
      ...row,
      location: {
        type: 'Point',
        coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
      }
    }));

    res.json({
      success: true,
      message: 'Current weather retrieved successfully',
      data: weatherData
    });
  } catch (error) {
    logger.error('Error getting public weather:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve weather data',
      error: error.message
    });
  }
});

module.exports = {
  getAllCenters,
  getCenterStatus,
  getCurrentWeather
}; 