const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all shifts for a center
// @route   GET /api/v1/shifts
// @access  Center Admin
const getAllShifts = asyncHandler(async (req, res) => {
  const centerAdminId = req.user.id;
  
  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id, c.name as center_name
     FROM centers c
     JOIN users admin ON admin.center_id = c.id
     WHERE admin.id = $1 AND admin.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Get all shifts for this center with lifeguard information
  const result = await query(
    `SELECT s.id, s.lifeguard_id, s.center_id, s.start_time, s.end_time, s.status,
            s.check_in_time, s.check_in_location, s.check_out_time, s.created_at, s.updated_at,
            u.first_name, u.last_name, u.email, u.phone,
            c.name as center_name
     FROM shifts s
     JOIN lifeguards l ON l.id = s.lifeguard_id
     JOIN users u ON u.id = l.user_id
     JOIN centers c ON c.id = s.center_id
     WHERE s.center_id = $1
     ORDER BY s.start_time DESC`,
    [centerId]
  );

  logger.info('Retrieved shifts for center', {
    centerId,
    count: result.rows.length,
    adminId: centerAdminId
  });

  res.json({
    success: true,
    count: result.rows.length,
    data: result.rows
  });
});

// @desc    Get shift by ID
// @route   GET /api/v1/shifts/:id
// @access  Center Admin
const getShiftById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const centerAdminId = req.user.id;

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id
     FROM centers c
     JOIN users admin ON admin.center_id = c.id
     WHERE admin.id = $1 AND admin.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Get the specific shift
  const result = await query(
    `SELECT s.id, s.lifeguard_id, s.center_id, s.start_time, s.end_time, s.status,
            s.check_in_time, s.check_in_location, s.check_out_time, s.created_at, s.updated_at,
            u.first_name, u.last_name, u.email, u.phone,
            c.name as center_name
     FROM shifts s
     JOIN lifeguards l ON l.id = s.lifeguard_id
     JOIN users u ON u.id = l.user_id
     JOIN centers c ON c.id = s.center_id
     WHERE s.id = $1 AND s.center_id = $2`,
    [id, centerId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  logger.info('Retrieved shift by ID', {
    shiftId: id,
    centerId,
    adminId: centerAdminId
  });

  res.json({
    success: true,
    data: result.rows[0]
  });
});

// @desc    Create a new shift
// @route   POST /api/v1/shifts
// @access  Center Admin
const createShift = asyncHandler(async (req, res) => {
  const {
    lifeguard_id,
    start_time,
    end_time,
    status = 'scheduled'
  } = req.body;

  const centerAdminId = req.user.id;

  // Validate required fields
  if (!lifeguard_id || !start_time || !end_time) {
    return res.status(400).json({
      success: false,
      message: 'Lifeguard ID, start time, and end time are required'
    });
  }

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id, c.name as center_name
     FROM centers c
     JOIN users admin ON admin.center_id = c.id
     WHERE admin.id = $1 AND admin.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Verify the lifeguard belongs to this center
  const lifeguardResult = await query(
    `SELECT l.id, u.first_name, u.last_name
     FROM lifeguards l
     JOIN users u ON u.id = l.user_id
     WHERE l.id = $1 AND l.center_id = $2`,
    [lifeguard_id, centerId]
  );

  if (lifeguardResult.rows.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Lifeguard not found or does not belong to this center'
    });
  }

  // Check for overlapping shifts for the same lifeguard
  const overlapResult = await query(
    `SELECT id FROM shifts 
     WHERE lifeguard_id = $1 
     AND status != 'cancelled'
     AND (
       (start_time <= $2 AND end_time > $2) OR
       (start_time < $3 AND end_time >= $3) OR
       (start_time >= $2 AND end_time <= $3)
     )`,
    [lifeguard_id, start_time, end_time]
  );

  if (overlapResult.rows.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Shift overlaps with existing shift for this lifeguard'
    });
  }

  // Create the shift
  const shiftResult = await query(
    `INSERT INTO shifts (lifeguard_id, center_id, start_time, end_time, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, lifeguard_id, center_id, start_time, end_time, status, created_at, updated_at`,
    [lifeguard_id, centerId, start_time, end_time, status]
  );

  // Get the complete shift data
  const completeResult = await query(
    `SELECT s.id, s.lifeguard_id, s.center_id, s.start_time, s.end_time, s.status,
            s.check_in_time, s.check_in_location, s.check_out_time, s.created_at, s.updated_at,
            u.first_name, u.last_name, u.email, u.phone,
            c.name as center_name
     FROM shifts s
     JOIN lifeguards l ON l.id = s.lifeguard_id
     JOIN users u ON u.id = l.user_id
     JOIN centers c ON c.id = s.center_id
     WHERE s.id = $1`,
    [shiftResult.rows[0].id]
  );

  logger.info('Created new shift', {
    shiftId: shiftResult.rows[0].id,
    lifeguardId: lifeguard_id,
    centerId,
    adminId: centerAdminId,
    startTime: start_time,
    endTime: end_time
  });

  res.status(201).json({
    success: true,
    message: 'Shift created successfully',
    data: completeResult.rows[0]
  });
});

// @desc    Update a shift
// @route   PUT /api/v1/shifts/:id
// @access  Center Admin
const updateShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    lifeguard_id,
    start_time,
    end_time,
    status
  } = req.body;

  const centerAdminId = req.user.id;

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id
     FROM centers c
     JOIN users admin ON admin.center_id = c.id
     WHERE admin.id = $1 AND admin.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Check if shift exists and belongs to this center
  const existingShift = await query(
    'SELECT * FROM shifts WHERE id = $1 AND center_id = $2',
    [id, centerId]
  );

  if (existingShift.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  // If updating lifeguard, verify they belong to this center
  if (lifeguard_id && lifeguard_id !== existingShift.rows[0].lifeguard_id) {
    const lifeguardResult = await query(
      'SELECT id FROM lifeguards WHERE id = $1 AND center_id = $2',
      [lifeguard_id, centerId]
    );

    if (lifeguardResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lifeguard not found or does not belong to this center'
      });
    }
  }

  // Check for overlapping shifts if time is being updated
  if (start_time || end_time) {
    const newStartTime = start_time || existingShift.rows[0].start_time;
    const newEndTime = end_time || existingShift.rows[0].end_time;
    const shiftLifeguardId = lifeguard_id || existingShift.rows[0].lifeguard_id;

    const overlapResult = await query(
      `SELECT id FROM shifts 
       WHERE lifeguard_id = $1 
       AND id != $2
       AND status != 'cancelled'
       AND (
         (start_time <= $3 AND end_time > $3) OR
         (start_time < $4 AND end_time >= $4) OR
         (start_time >= $3 AND end_time <= $4)
       )`,
      [shiftLifeguardId, id, newStartTime, newEndTime]
    );

    if (overlapResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Shift overlaps with existing shift for this lifeguard'
      });
    }
  }

  // Build update query
  const updateFields = [];
  const updateValues = [];
  let paramCount = 1;

  if (lifeguard_id !== undefined) {
    updateFields.push(`lifeguard_id = $${paramCount++}`);
    updateValues.push(lifeguard_id);
  }
  if (start_time !== undefined) {
    updateFields.push(`start_time = $${paramCount++}`);
    updateValues.push(start_time);
  }
  if (end_time !== undefined) {
    updateFields.push(`end_time = $${paramCount++}`);
    updateValues.push(end_time);
  }
  if (status !== undefined) {
    updateFields.push(`status = $${paramCount++}`);
    updateValues.push(status);
  }

  updateFields.push(`updated_at = NOW()`);
  updateValues.push(id);

  const updateQuery = `
    UPDATE shifts 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING id, lifeguard_id, center_id, start_time, end_time, status, created_at, updated_at
  `;

  const updateResult = await query(updateQuery, updateValues);

  // Get the complete updated shift data
  const completeResult = await query(
    `SELECT s.id, s.lifeguard_id, s.center_id, s.start_time, s.end_time, s.status,
            s.check_in_time, s.check_in_location, s.check_out_time, s.created_at, s.updated_at,
            u.first_name, u.last_name, u.email, u.phone,
            c.name as center_name
     FROM shifts s
     JOIN lifeguards l ON l.id = s.lifeguard_id
     JOIN users u ON u.id = l.user_id
     JOIN centers c ON c.id = s.center_id
     WHERE s.id = $1`,
    [id]
  );

  logger.info('Updated shift', {
    shiftId: id,
    centerId,
    adminId: centerAdminId
  });

  res.json({
    success: true,
    message: 'Shift updated successfully',
    data: completeResult.rows[0]
  });
});

// @desc    Delete a shift
// @route   DELETE /api/v1/shifts/:id
// @access  Center Admin
const deleteShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const centerAdminId = req.user.id;

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id
     FROM centers c
     JOIN users admin ON admin.center_id = c.id
     WHERE admin.id = $1 AND admin.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Check if shift exists and belongs to this center
  const shiftResult = await query(
    'SELECT * FROM shifts WHERE id = $1 AND center_id = $2',
    [id, centerId]
  );

  if (shiftResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  // Check if shift is active (cannot delete active shifts)
  if (shiftResult.rows[0].status === 'active') {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete an active shift'
    });
  }

  // Delete the shift
  await query('DELETE FROM shifts WHERE id = $1', [id]);

  logger.info('Deleted shift', {
    shiftId: id,
    centerId,
    adminId: centerAdminId
  });

  res.json({
    success: true,
    message: 'Shift deleted successfully'
  });
});

// @desc    Check in to a shift
// @route   POST /api/v1/shifts/:id/check-in
// @access  Lifeguard
const checkInShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { location } = req.body;
  const lifeguardUserId = req.user.id;

  // Get the lifeguard record for this user
  const lifeguardResult = await query(
    'SELECT l.id as lifeguard_id, l.center_id FROM lifeguards l WHERE l.user_id = $1',
    [lifeguardUserId]
  );

  if (lifeguardResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Lifeguard record not found'
    });
  }

  const lifeguardId = lifeguardResult.rows[0].lifeguard_id;
  const centerId = lifeguardResult.rows[0].center_id;

  // Verify the shift belongs to this lifeguard
  const shiftResult = await query(
    'SELECT * FROM shifts WHERE id = $1 AND lifeguard_id = $2',
    [id, lifeguardId]
  );

  if (shiftResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  const shift = shiftResult.rows[0];

  if (shift.status !== 'scheduled') {
    return res.status(400).json({
      success: false,
      message: 'Shift is not in scheduled status'
    });
  }

  // --- LOCATION CHECK-IN RESTRICTION ---
  // Get center's location and require_location_check_in flag
  const centerResult = await query(
    'SELECT location, require_location_check_in FROM centers WHERE id = $1',
    [centerId]
  );
  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found'
    });
  }
  const center = centerResult.rows[0];
  if (center.require_location_check_in) {
    // Check if lifeguard's location is within 10km of center
    const distanceResult = await query(
      `SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3::geography
      ) AS distance_meters`,
      [location.lng, location.lat, center.location]
    );
    const distance = distanceResult.rows[0].distance_meters;
    if (distance > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Check-in denied: You must be within 10km of the center location.'
      });
    }
  }

  // --- EXISTING VALIDATION LOGIC (date/time window) ---
  // Validation 1: Check if shift is scheduled for the current day
  const shiftStartDate = new Date(shift.start_time);
  const currentDate = new Date();
  const isSameDay = shiftStartDate.toDateString() === currentDate.toDateString();
  
  if (!isSameDay) {
    return res.status(400).json({
      success: false,
      message: `Check-in is only allowed for shifts scheduled for the current day. This shift is scheduled for ${shiftStartDate.toLocaleDateString()}.`
    });
  }

  // Validation 2: Check if shift has already ended
  const shiftEndTime = new Date(shift.end_time);
  if (currentDate > shiftEndTime) {
    return res.status(400).json({
      success: false,
      message: 'Check-in is not allowed for shifts that have already ended.'
    });
  }

  // Validation 3: Check if check-in is within allowed time window (1 hour before to 2 hours after start)
  const shiftStartTime = new Date(shift.start_time);
  const timeDifferenceMs = currentDate.getTime() - shiftStartTime.getTime();
  const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60); // Convert to hours
  
  if (timeDifferenceHours < -1) {
    return res.status(400).json({
      success: false,
      message: 'Check-in is only allowed up to 1 hour before the shift start time.'
    });
  }
  
  if (timeDifferenceHours > 2) {
    return res.status(400).json({
      success: false,
      message: 'Check-in is only allowed up to 2 hours after the shift start time.'
    });
  }

  // Update shift status and check-in time
  const updateResult = await query(
    `UPDATE shifts 
     SET status = 'active', check_in_time = NOW(), check_in_location = ST_SetSRID(ST_MakePoint($1, $2), 4326), updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [location.lng, location.lat, id]
  );

  logger.info('Lifeguard checked in to shift', {
    shiftId: id,
    lifeguardId
  });

  res.json({
    success: true,
    message: 'Successfully checked in to shift',
    data: updateResult.rows[0]
  });
});

// @desc    Check out from a shift
// @route   POST /api/v1/shifts/:id/check-out
// @access  Lifeguard
const checkOutShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lifeguardUserId = req.user.id;

  // Get the lifeguard record for this user
  const lifeguardResult = await query(
    'SELECT l.id as lifeguard_id FROM lifeguards l WHERE l.user_id = $1',
    [lifeguardUserId]
  );

  if (lifeguardResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Lifeguard record not found'
    });
  }

  const lifeguardId = lifeguardResult.rows[0].lifeguard_id;

  // Verify the shift belongs to this lifeguard
  const shiftResult = await query(
    'SELECT * FROM shifts WHERE id = $1 AND lifeguard_id = $2',
    [id, lifeguardId]
  );

  if (shiftResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  const shift = shiftResult.rows[0];

  if (shift.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Shift is not active'
    });
  }

  // Update shift status and check-out time
  const updateResult = await query(
    `UPDATE shifts 
     SET status = 'completed', check_out_time = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  logger.info('Lifeguard checked out from shift', {
    shiftId: id,
    lifeguardId
  });

  res.json({
    success: true,
    message: 'Successfully checked out from shift',
    data: updateResult.rows[0]
  });
});

// @desc    Get lifeguard's own shifts
// @route   GET /api/v1/shifts/my-shifts
// @access  Lifeguard
const getMyShifts = asyncHandler(async (req, res) => {
  const lifeguardUserId = req.user.id;

  // Get the lifeguard record for this user
  const lifeguardResult = await query(
    `SELECT l.id as lifeguard_id, l.center_id, c.name as center_name
     FROM lifeguards l
     JOIN centers c ON c.id = l.center_id
     WHERE l.user_id = $1`,
    [lifeguardUserId]
  );

  if (lifeguardResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Lifeguard record not found'
    });
  }

  const lifeguardId = lifeguardResult.rows[0].lifeguard_id;

  // Get all shifts for this lifeguard
  const result = await query(
    `SELECT s.id, s.start_time, s.end_time, s.status, s.check_in_time, s.check_in_location, 
            s.check_out_time, s.created_at, s.updated_at,
            c.name as center_name, c.id as center_id
     FROM shifts s
     JOIN centers c ON c.id = s.center_id
     WHERE s.lifeguard_id = $1
     ORDER BY s.start_time DESC`,
    [lifeguardId]
  );

  logger.info('Retrieved lifeguard own shifts', {
    lifeguardId,
    userId: lifeguardUserId,
    count: result.rows.length
  });

  res.json({
    success: true,
    count: result.rows.length,
    data: result.rows
  });
});

// @desc    Get lifeguard's current shift
// @route   GET /api/v1/shifts/current/:lifeguardId
// @access  Lifeguard
const getCurrentShift = asyncHandler(async (req, res) => {
  const { lifeguardId } = req.params;
  const lifeguardUserId = req.user.id;

  // Get the lifeguard record for this user
  const lifeguardResult = await query(
    `SELECT l.id as lifeguard_id, l.center_id, c.name as center_name
     FROM lifeguards l
     JOIN centers c ON c.id = l.center_id
     WHERE l.user_id = $1`,
    [lifeguardUserId]
  );

  if (lifeguardResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Lifeguard record not found'
    });
  }

  const userLifeguardId = lifeguardResult.rows[0].lifeguard_id;

  // Verify the requested lifeguard ID matches the authenticated user
  if (userLifeguardId !== lifeguardId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Get current active shift for this lifeguard
  const result = await query(
    `SELECT s.id, s.start_time, s.end_time, s.status, s.check_in_time, s.check_in_location, 
            s.check_out_time, s.created_at, s.updated_at,
            c.name as center_name, c.id as center_id
     FROM shifts s
     JOIN centers c ON c.id = s.center_id
     WHERE s.lifeguard_id = $1 
     AND s.status IN ('active', 'scheduled')
     AND s.start_time <= NOW()
     AND s.end_time >= NOW()
     ORDER BY s.start_time ASC
     LIMIT 1`,
    [lifeguardId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No current shift found'
    });
  }

  logger.info('Retrieved lifeguard current shift', {
    lifeguardId,
    userId: lifeguardUserId,
    shiftId: result.rows[0].id
  });

  res.json({
    success: true,
    data: result.rows[0]
  });
});

// @desc    Create weekly schedule
// @route   POST /api/v1/shifts/weekly
// @access  Center Admin
const createWeeklySchedule = asyncHandler(async (req, res) => {
  const {
    lifeguard_id,
    start_time,
    end_time,
    days_of_week, // Array of day numbers (0-6, where 0 is Sunday)
    start_date, // Start date for the weekly schedule
    weeks_count = 4 // Number of weeks to create shifts for
  } = req.body;

  const centerAdminId = req.user.id;

  // Validate required fields
  if (!lifeguard_id || !start_time || !end_time || !days_of_week || !start_date) {
    return res.status(400).json({
      success: false,
      message: 'Lifeguard ID, start time, end time, days of week, and start date are required'
    });
  }

  // Validate days_of_week array
  if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Days of week must be a non-empty array'
    });
  }

  // Validate day numbers (0-6)
  const validDays = days_of_week.every(day => day >= 0 && day <= 6);
  if (!validDays) {
    return res.status(400).json({
      success: false,
      message: 'Days of week must be numbers between 0 (Sunday) and 6 (Saturday)'
    });
  }

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id, c.name as center_name
     FROM centers c
     JOIN users admin ON admin.center_id = c.id
     WHERE admin.id = $1 AND admin.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Verify the lifeguard belongs to this center
  const lifeguardResult = await query(
    `SELECT l.id, u.first_name, u.last_name
     FROM lifeguards l
     JOIN users u ON u.id = l.user_id
     WHERE l.id = $1 AND l.center_id = $2`,
    [lifeguard_id, centerId]
  );

  if (lifeguardResult.rows.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Lifeguard not found or does not belong to this center'
    });
  }

  // Parse the start time to get hours and minutes
  const startTimeDate = new Date(`2000-01-01T${start_time}`);
  const endTimeDate = new Date(`2000-01-01T${end_time}`);
  const startHour = startTimeDate.getHours();
  const startMinute = startTimeDate.getMinutes();
  const endHour = endTimeDate.getHours();
  const endMinute = endTimeDate.getMinutes();

  // Parse start date
  const startDate = new Date(start_date);
  if (isNaN(startDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid start date format'
    });
  }

  const createdShifts = [];
  const skippedShifts = [];

  // Create shifts for each week
  for (let week = 0; week < weeks_count; week++) {
    // For each day of the week
    for (const dayOfWeek of days_of_week) {
      // Calculate the date for this day
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (week * 7) + (dayOfWeek - startDate.getDay() + 7) % 7);

      // Create the full start and end times for this day
      const shiftStartTime = new Date(currentDate);
      shiftStartTime.setHours(startHour, startMinute, 0, 0);

      const shiftEndTime = new Date(currentDate);
      shiftEndTime.setHours(endHour, endMinute, 0, 0);

      // Check for overlapping shifts
      const overlapResult = await query(
        `SELECT id FROM shifts 
         WHERE lifeguard_id = $1 
         AND status != 'cancelled'
         AND (
           (start_time <= $2 AND end_time > $2) OR
           (start_time < $3 AND end_time >= $3) OR
           (start_time >= $2 AND end_time <= $3)
         )`,
        [lifeguard_id, shiftStartTime.toISOString(), shiftEndTime.toISOString()]
      );

      if (overlapResult.rows.length > 0) {
        skippedShifts.push({
          date: currentDate.toISOString().split('T')[0],
          reason: 'Overlaps with existing shift'
        });
        continue;
      }

      // Create the shift
      const shiftResult = await query(
        `INSERT INTO shifts (lifeguard_id, center_id, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, lifeguard_id, center_id, start_time, end_time, status, created_at, updated_at`,
        [lifeguard_id, centerId, shiftStartTime.toISOString(), shiftEndTime.toISOString(), 'scheduled']
      );

      createdShifts.push(shiftResult.rows[0]);
    }
  }

  logger.info('Created weekly schedule', {
    lifeguardId: lifeguard_id,
    centerId,
    adminId: centerAdminId,
    startTime: start_time,
    endTime: end_time,
    daysOfWeek: days_of_week,
    weeksCount: weeks_count,
    createdShifts: createdShifts.length,
    skippedShifts: skippedShifts.length
  });

  res.status(201).json({
    success: true,
    message: `Weekly schedule created successfully. ${createdShifts.length} shifts created, ${skippedShifts.length} skipped due to conflicts.`,
    data: {
      created_shifts: createdShifts,
      skipped_shifts: skippedShifts,
      total_created: createdShifts.length,
      total_skipped: skippedShifts.length
    }
  });
});

module.exports = {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  checkInShift,
  checkOutShift,
  getMyShifts,
  getCurrentShift,
  createWeeklySchedule
}; 