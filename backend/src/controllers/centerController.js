const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all centers
// @route   GET /api/v1/centers
// @access  System Admin only
const getAllCenters = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, description, ST_AsGeoJSON(location) as location, address, phone, email, operating_hours, created_at, updated_at, is_active FROM centers WHERE is_active = true ORDER BY name'
  );

  const centers = result.rows.map(row => ({
    ...row,
    location: JSON.parse(row.location)
  }));

  res.json({
    success: true,
    count: centers.length,
    data: centers
  });
});

// @desc    Get center by ID
// @route   GET /api/v1/centers/:id
// @access  Private
const getCenterById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    'SELECT id, name, description, ST_AsGeoJSON(location) as location, address, phone, email, operating_hours, created_at, updated_at, is_active FROM centers WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found'
    });
  }

  const center = {
    ...result.rows[0],
    location: JSON.parse(result.rows[0].location)
  };

  res.json({
    success: true,
    data: center
  });
});

// @desc    Create new center
// @route   POST /api/v1/centers
// @access  System Admin only
const createCenter = asyncHandler(async (req, res) => {
  const { name, description, location, address, phone, email, operating_hours } = req.body;

  // Handle operating_hours - convert empty string to null, validate JSON
  let processedOperatingHours = null;
  if (operating_hours && operating_hours !== '') {
    if (typeof operating_hours === 'string') {
      try {
        processedOperatingHours = JSON.parse(operating_hours);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid operating hours format'
        });
      }
    } else if (typeof operating_hours === 'object') {
      processedOperatingHours = operating_hours;
    }
  }

  const result = await query(
    `INSERT INTO centers (name, description, location, address, phone, email, operating_hours)
     VALUES ($1, $2, ST_GeomFromText($3, 4326), $4, $5, $6, $7)
     RETURNING id, name, description, ST_AsGeoJSON(location) as location, address, phone, email, operating_hours, created_at, updated_at, is_active`,
    [name, description, `POINT(${location.lng} ${location.lat})`, address, phone, email, processedOperatingHours]
  );

  const center = {
    ...result.rows[0],
    location: JSON.parse(result.rows[0].location)
  };

  logger.info('Center created', { centerId: center.id, name: center.name });

  res.status(201).json({
    success: true,
    message: 'Center created successfully',
    data: center
  });
});

// @desc    Update center
// @route   PUT /api/v1/centers/:id
// @access  Center Admin or System Admin
const updateCenter = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, location, address, phone, email, operating_hours } = req.body;

  // Handle operating_hours - convert empty string to null, validate JSON
  let processedOperatingHours = null;
  if (operating_hours && operating_hours !== '') {
    if (typeof operating_hours === 'string') {
      try {
        processedOperatingHours = JSON.parse(operating_hours);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid operating hours format'
        });
      }
    } else if (typeof operating_hours === 'object') {
      processedOperatingHours = operating_hours;
    }
  }

  const result = await query(
    `UPDATE centers 
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         location = COALESCE(ST_GeomFromText($3, 4326), location),
         address = COALESCE($4, address),
         phone = COALESCE($5, phone),
         email = COALESCE($6, email),
         operating_hours = COALESCE($7, operating_hours),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $8
     RETURNING id, name, description, ST_AsGeoJSON(location) as location, address, phone, email, operating_hours, created_at, updated_at, is_active`,
    [name, description, location ? `POINT(${location.lng} ${location.lat})` : null, address, phone, email, processedOperatingHours, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found'
    });
  }

  const center = {
    ...result.rows[0],
    location: JSON.parse(result.rows[0].location)
  };

  logger.info('Center updated', { centerId: center.id, name: center.name });

  res.json({
    success: true,
    message: 'Center updated successfully',
    data: center
  });
});

// @desc    Delete center
// @route   DELETE /api/v1/centers/:id
// @access  System Admin only
const deleteCenter = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    'UPDATE centers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, name',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found'
    });
  }

  logger.info('Center deactivated', { centerId: id, name: result.rows[0].name });

  res.json({
    success: true,
    message: 'Center deactivated successfully'
  });
});

// @desc    Get center lifeguards
// @route   GET /api/v1/centers/:id/lifeguards
// @access  Center Admin or System Admin
const getCenterLifeguards = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT l.id, l.certification_level, l.certification_expiry, l.emergency_contact, l.created_at,
            u.id as user_id, u.email, u.first_name, u.last_name, u.phone, u.role
     FROM lifeguards l
     JOIN users u ON u.id = l.user_id
     WHERE l.center_id = $1 AND u.is_active = true
     ORDER BY u.first_name, u.last_name`,
    [id]
  );

  res.json({
    success: true,
    count: result.rows.length,
    data: result.rows
  });
});

// @desc    Get center shifts
// @route   GET /api/v1/centers/:id/shifts
// @access  Center Admin or System Admin
const getCenterShifts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { start_date, end_date } = req.query;

  let queryText = `
    SELECT s.id, s.start_time, s.end_time, s.status, s.check_in_time, s.check_out_time, s.created_at,
           l.id as lifeguard_id, u.first_name, u.last_name, u.email
    FROM shifts s
    JOIN lifeguards l ON l.id = s.lifeguard_id
    JOIN users u ON u.id = l.user_id
    WHERE s.center_id = $1
  `;

  const queryParams = [id];

  if (start_date && end_date) {
    queryText += ' AND s.start_time >= $2 AND s.start_time <= $3';
    queryParams.push(start_date, end_date);
  }

  queryText += ' ORDER BY s.start_time DESC';

  const result = await query(queryText, queryParams);

  res.json({
    success: true,
    count: result.rows.length,
    data: result.rows
  });
});

// @desc    Get center weather data
// @route   GET /api/v1/centers/:id/weather
// @access  Center Admin or System Admin
const getCenterWeather = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 24 } = req.query; // Default to last 24 records

  const result = await query(
    `SELECT id, temperature, wind_speed, wind_direction, precipitation, wave_height, current_speed, visibility, recorded_at
     FROM weather_data
     WHERE center_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2`,
    [id, limit]
  );

  res.json({
    success: true,
    count: result.rows.length,
    data: result.rows
  });
});

module.exports = {
  getAllCenters,
  getCenterById,
  createCenter,
  updateCenter,
  deleteCenter,
  getCenterLifeguards,
  getCenterShifts,
  getCenterWeather
}; 