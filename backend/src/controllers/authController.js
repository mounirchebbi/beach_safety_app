const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

// @desc    Register new user
// @route   POST /api/v1/auth/register
// @access  Public (for system admin creation)
const register = asyncHandler(async (req, res) => {
  const { email, password, role, first_name, last_name, phone } = req.body;

  // Validate required fields
  if (!email || !password || !role || !first_name || !last_name) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  // Validate role
  const validRoles = ['system_admin', 'center_admin', 'lifeguard'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be system_admin, center_admin, or lifeguard'
    });
  }

  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const result = await query(
    `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, role, first_name, last_name, phone, created_at`,
    [email, passwordHash, role, first_name, last_name, phone]
  );

  const user = result.rows[0];

  // Generate token
  const token = generateToken(user.id);

  logger.info('User registered successfully', { userId: user.id, email: user.email, role: user.role });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone
      },
      token
    }
  });
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password'
    });
  }

  // Find user by email
  const result = await query(
    'SELECT id, email, password_hash, role, first_name, last_name, phone, center_id, is_active FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const user = result.rows[0];

  // Check if user is active
  if (!user.is_active) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Generate token
  const token = generateToken(user.id);

  logger.info('User logged in successfully', { userId: user.id, email: user.email, role: user.role });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        center_id: user.center_id
      },
      token
    }
  });
});

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await query(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone, u.center_id, u.created_at
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const user = result.rows[0];

  // If user is a lifeguard, get additional info
  if (user.role === 'lifeguard') {
    const lifeguardResult = await query(
      `SELECT l.id, l.certification_level, l.certification_expiry, l.emergency_contact,
              c.id as center_id, c.name as center_name, c.location
       FROM lifeguards l
       JOIN centers c ON c.id = l.center_id
       WHERE l.user_id = $1`,
      [userId]
    );

    if (lifeguardResult.rows.length > 0) {
      user.lifeguard_info = lifeguardResult.rows[0];
    }
  }

  // If user is a center admin, get center info
  if (user.role === 'center_admin' && user.center_id) {
    const centerResult = await query(
      `SELECT c.id, c.name, ST_AsGeoJSON(c.location) as location
       FROM centers c
       WHERE c.id = $1`,
      [user.center_id]
    );

    if (centerResult.rows.length > 0) {
      user.center_info = {
        ...centerResult.rows[0],
        location: JSON.parse(centerResult.rows[0].location)
      };
    }
  }

  res.json({
    success: true,
    data: { user }
  });
});

// @desc    Update user profile
// @route   PUT /api/v1/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { first_name, last_name, phone, current_password, new_password } = req.body;

  // Get current user
  const currentUser = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (currentUser.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update basic info
  const updateFields = [];
  const updateValues = [];
  let paramCount = 1;

  if (first_name) {
    updateFields.push(`first_name = $${paramCount++}`);
    updateValues.push(first_name);
  }

  if (last_name) {
    updateFields.push(`last_name = $${paramCount++}`);
    updateValues.push(last_name);
  }

  if (phone) {
    updateFields.push(`phone = $${paramCount++}`);
    updateValues.push(phone);
  }

  // Update password if provided
  if (current_password && new_password) {
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, currentUser.rows[0].password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);
    
    updateFields.push(`password_hash = $${paramCount++}`);
    updateValues.push(newPasswordHash);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No fields to update'
    });
  }

  updateValues.push(userId);

  // Update user
  const result = await query(
    `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${paramCount}
     RETURNING id, email, role, first_name, last_name, phone`,
    updateValues
  );

  const updatedUser = result.rows[0];

  logger.info('User profile updated', { userId: updatedUser.id });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // You could implement a blacklist for tokens if needed
  logger.info('User logged out', { userId: req.user.id });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @desc    Get all users (System Admin only)
// @route   GET /api/v1/auth/users
// @access  System Admin only
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role, center_id, search } = req.query;
  const offset = (page - 1) * limit;

  let queryText = `
    SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone, u.center_id, u.is_active, u.created_at,
           c.name as center_name
    FROM users u
    LEFT JOIN centers c ON c.id = u.center_id
    WHERE 1=1
  `;

  const queryParams = [];
  let paramCount = 0;

  if (role) {
    paramCount++;
    queryText += ` AND u.role = $${paramCount}`;
    queryParams.push(role);
  }

  if (center_id) {
    paramCount++;
    queryText += ` AND u.center_id = $${paramCount}`;
    queryParams.push(center_id);
  }

  if (search) {
    paramCount++;
    queryText += ` AND (u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
    queryParams.push(`%${search}%`);
  }

  // Get total count
  const countQuery = queryText.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await query(countQuery, queryParams);
  const totalCount = parseInt(countResult.rows[0].count);

  // Get paginated results
  queryText += ` ORDER BY 
    CASE u.role 
      WHEN 'system_admin' THEN 1 
      WHEN 'center_admin' THEN 2 
      WHEN 'lifeguard' THEN 3 
    END, 
    u.created_at ASC 
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  queryParams.push(limit, offset);

  const result = await query(queryText, queryParams);

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
});

// @desc    Get user by ID (System Admin only)
// @route   GET /api/v1/auth/users/:id
// @access  System Admin only
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone, u.center_id, u.is_active, u.created_at,
            c.name as center_name
     FROM users u
     LEFT JOIN centers c ON c.id = u.center_id
     WHERE u.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: result.rows[0]
  });
});

// @desc    Create user (System Admin only)
// @route   POST /api/v1/auth/users
// @access  System Admin only
const createUser = asyncHandler(async (req, res) => {
  const { email, password, role, first_name, last_name, phone, center_id } = req.body;

  // Convert empty center_id to null
  const processedCenterId = center_id === '' ? null : center_id;

  // Validate required fields
  if (!email || !password || !role || !first_name || !last_name) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  // Validate role
  const validRoles = ['system_admin', 'center_admin', 'lifeguard'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be system_admin, center_admin, or lifeguard'
    });
  }

  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Validate center_id if provided
  if (processedCenterId) {
    const centerResult = await query(
      'SELECT id FROM centers WHERE id = $1 AND is_active = true',
      [processedCenterId]
    );

    if (centerResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid center ID'
      });
    }
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const result = await query(
    `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, center_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, role, first_name, last_name, phone, center_id, created_at`,
    [email, passwordHash, role, first_name, last_name, phone, processedCenterId]
  );

  const user = result.rows[0];

  // If user is a lifeguard, create lifeguard record
  if (role === 'lifeguard' && processedCenterId) {
    await query(
      `INSERT INTO lifeguards (user_id, center_id, certification_level, certification_expiry)
       VALUES ($1, $2, 'basic', CURRENT_DATE + INTERVAL '1 year')`,
      [user.id, processedCenterId]
    );
  }

  logger.info('User created by system admin', { 
    userId: user.id, 
    email: user.email, 
    role: user.role,
    createdBy: req.user.id 
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: user
  });
});

// @desc    Update user (System Admin only)
// @route   PUT /api/v1/auth/users/:id
// @access  System Admin only
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, role, first_name, last_name, phone, center_id, is_active } = req.body;

  // Convert empty center_id to null
  const processedCenterId = center_id === '' ? null : center_id;

  // Check if user exists
  const existingUser = await query(
    'SELECT id, role FROM users WHERE id = $1',
    [id]
  );

  if (existingUser.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Validate role if provided
  if (role) {
    const validRoles = ['system_admin', 'center_admin', 'lifeguard'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be system_admin, center_admin, or lifeguard'
      });
    }
  }

  // Validate center_id if provided
  if (processedCenterId) {
    const centerResult = await query(
      'SELECT id FROM centers WHERE id = $1 AND is_active = true',
      [processedCenterId]
    );

    if (centerResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid center ID'
      });
    }
  }

  // Update user
  const result = await query(
    `UPDATE users 
     SET email = COALESCE($1, email),
         role = COALESCE($2, role),
         first_name = COALESCE($3, first_name),
         last_name = COALESCE($4, last_name),
         phone = COALESCE($5, phone),
         center_id = COALESCE($6, center_id),
         is_active = COALESCE($7, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $8
     RETURNING id, email, role, first_name, last_name, phone, center_id, is_active, created_at`,
    [email, role, first_name, last_name, phone, processedCenterId, is_active, id]
  );

  const user = result.rows[0];

  logger.info('User updated by system admin', { 
    userId: user.id, 
    updatedBy: req.user.id 
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: user
  });
});

// @desc    Delete user (System Admin only)
// @route   DELETE /api/v1/auth/users/:id
// @access  System Admin only
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user exists
  const existingUser = await query(
    'SELECT id, email, role FROM users WHERE id = $1',
    [id]
  );

  if (existingUser.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Prevent system admin from deleting themselves
  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete your own account'
    });
  }

  // Soft delete user
  await query(
    'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [id]
  );

  logger.info('User deactivated by system admin', { 
    userId: id, 
    deactivatedBy: req.user.id 
  });

  res.json({
    success: true,
    message: 'User deactivated successfully'
  });
});

// @desc    Reset user password (System Admin only)
// @route   POST /api/v1/auth/users/:id/reset-password
// @access  System Admin only
const resetUserPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password) {
    return res.status(400).json({
      success: false,
      message: 'New password is required'
    });
  }

  // Check if user exists
  const existingUser = await query(
    'SELECT id, email FROM users WHERE id = $1',
    [id]
  );

  if (existingUser.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Hash new password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(new_password, saltRounds);

  // Update password
  await query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [passwordHash, id]
  );

  logger.info('User password reset by system admin', { 
    userId: id, 
    resetBy: req.user.id 
  });

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  logout,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword
}; 