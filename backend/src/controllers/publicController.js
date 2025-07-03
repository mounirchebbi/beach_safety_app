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
       AND wd.recorded_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
       ORDER BY wd.recorded_at DESC`,
      []
    );

    logger.info('Public weather query result:', {
      totalRows: result.rows.length,
      centers: result.rows.map(row => ({ center_id: row.center_id, center_name: row.center_name, recorded_at: row.recorded_at }))
    });

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

const getLifeguardCounts = asyncHandler(async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        c.id as center_id,
        c.name as center_name,
        COUNT(l.id) as lifeguard_count
       FROM centers c
       LEFT JOIN lifeguards l ON c.id = l.center_id
       LEFT JOIN users u ON l.user_id = u.id
       WHERE c.is_active = true 
       AND (u.is_active = true OR u.is_active IS NULL)
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      []
    );

    const lifeguardCounts = result.rows.map(row => ({
      center_id: row.center_id,
      center_name: row.center_name,
      lifeguard_count: parseInt(row.lifeguard_count)
    }));

    res.json({
      success: true,
      message: 'Lifeguard counts retrieved successfully',
      data: lifeguardCounts
    });
  } catch (error) {
    logger.error('Error getting public lifeguard counts:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lifeguard counts',
      error: error.message
    });
  }
});

const getSafetyFlags = asyncHandler(async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        c.id as center_id,
        c.name as center_name,
        sf.flag_status,
        sf.reason,
        sf.set_at,
        sf.expires_at
       FROM centers c
       LEFT JOIN safety_flags sf ON c.id = sf.center_id
       AND (sf.expires_at IS NULL OR sf.expires_at > CURRENT_TIMESTAMP)
       WHERE c.is_active = true
       ORDER BY c.name`,
      []
    );

    const safetyFlags = result.rows.map(row => ({
      center_id: row.center_id,
      center_name: row.center_name,
      flag_status: row.flag_status || 'green', // Default to green if no flag set
      reason: row.reason || null,
      set_at: row.set_at,
      expires_at: row.expires_at
    }));

    res.json({
      success: true,
      message: 'Safety flags retrieved successfully',
      data: safetyFlags
    });
  } catch (error) {
    logger.error('Error getting public safety flags:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve safety flags',
      error: error.message
    });
  }
});

const getMobileGPSLocation = asyncHandler(async (req, res) => {
  try {
    logger.info('Fetching mobile GPS data from 192.168.1.12:8080');
    
    const axios = require('axios');
    const response = await axios.get('http://192.168.1.12:8080/', {
      timeout: 15000,
      headers: {
        'User-Agent': 'BeachSafetyApp/1.0'
      },
      responseType: 'text' // Handle raw text response
    });

    logger.info('Mobile GPS raw response received:', response.data);
    
    // Parse the raw JSON response
    let data;
    try {
      // The response might contain multiple JSON objects or extra text
      // Find the last valid JSON object in the response
      const jsonMatches = response.data.match(/\{[^}]*"longitude"[^}]*"latitude"[^}]*\}/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // Use the last (most recent) GPS reading
        const lastJson = jsonMatches[jsonMatches.length - 1];
        data = JSON.parse(lastJson);
        logger.info('Parsed GPS data from raw response:', data);
      } else {
        throw new Error('No valid GPS JSON found in response');
      }
    } catch (parseError) {
      logger.error('Failed to parse GPS JSON:', parseError.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS data format received',
        error: parseError.message,
        raw_response: response.data.substring(0, 200) + '...' // Show first 200 chars
      });
    }

    // Parse GPS data with multiple format support
    let latitude, longitude;
    // Use the parsed 'data' from above

    // Handle the specific format from your mobile GPS service
    if (data.latitude && data.longitude) {
      latitude = parseFloat(data.latitude);
      longitude = parseFloat(data.longitude);
    } else if (data.lat && data.lng) {
      latitude = parseFloat(data.lat);
      longitude = parseFloat(data.lng);
    } else if (data.coords) {
      latitude = parseFloat(data.coords.latitude || data.coords.lat);
      longitude = parseFloat(data.coords.longitude || data.coords.lng);
    } else if (data.gps) {
      latitude = parseFloat(data.gps.latitude || data.gps.lat);
      longitude = parseFloat(data.gps.longitude || data.gps.lng);
    } else if (data.position) {
      latitude = parseFloat(data.position.latitude || data.position.lat);
      longitude = parseFloat(data.position.longitude || data.position.lng);
    } else {
      logger.error('No valid GPS coordinates found in mobile data');
      logger.error('Available keys:', Object.keys(data));
      return res.status(400).json({
        success: false,
        message: 'No valid GPS coordinates found in mobile data',
        received_data: data
      });
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates received',
        received_data: data
      });
    }

    const locationData = {
      latitude,
      longitude,
      source: 'mobile_gps',
      raw_data: data
    };

    logger.info('Mobile GPS location parsed successfully:', locationData);

    res.json({
      success: true,
      message: 'Mobile GPS location retrieved successfully',
      data: locationData
    });
  } catch (error) {
    logger.error('Error getting mobile GPS location:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mobile GPS location',
      error: error.message
    });
  }
});

module.exports = {
  getAllCenters,
  getCenterStatus,
  getCurrentWeather,
  getLifeguardCounts,
  getSafetyFlags,
  getMobileGPSLocation
}; 