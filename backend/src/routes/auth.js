const express = require('express');
const { body } = require('express-validator');
const { verifyToken, requireSystemAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
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
} = require('../controllers/authController');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['system_admin', 'center_admin', 'lifeguard'])
    .withMessage('Invalid role'),
  body('first_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('last_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateProfileUpdate = [
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name cannot be empty'),
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name cannot be empty'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('current_password')
    .optional()
    .notEmpty()
    .withMessage('Current password is required when changing password'),
  body('new_password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

// Validation middleware for user management
const validateUserCreation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['system_admin', 'center_admin', 'lifeguard'])
    .withMessage('Invalid role'),
  body('first_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('last_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('center_id')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      // Check if it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        throw new Error('Center ID must be a valid UUID');
      }
      return true;
    })
    .withMessage('Center ID must be a valid UUID')
];

const validateUserUpdate = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('role')
    .optional()
    .isIn(['system_admin', 'center_admin', 'lifeguard'])
    .withMessage('Invalid role'),
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name cannot be empty'),
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name cannot be empty'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('center_id')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      // Check if it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        throw new Error('Center ID must be a valid UUID');
      }
      return true;
    })
    .withMessage('Center ID must be a valid UUID'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
];

const validatePasswordReset = [
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

// Routes
router.post('/register', validateRegistration, asyncHandler(register));
router.post('/login', validateLogin, asyncHandler(login));
router.get('/me', verifyToken, asyncHandler(getMe));
router.put('/profile', verifyToken, validateProfileUpdate, asyncHandler(updateProfile));
router.post('/logout', verifyToken, asyncHandler(logout));

// System Admin User Management Routes
router.get('/users', verifyToken, requireSystemAdmin, asyncHandler(getAllUsers));
router.get('/users/:id', verifyToken, requireSystemAdmin, asyncHandler(getUserById));
router.post('/users', verifyToken, requireSystemAdmin, validateUserCreation, asyncHandler(createUser));
router.put('/users/:id', verifyToken, requireSystemAdmin, validateUserUpdate, asyncHandler(updateUser));
router.delete('/users/:id', verifyToken, requireSystemAdmin, asyncHandler(deleteUser));
router.post('/users/:id/reset-password', verifyToken, requireSystemAdmin, validatePasswordReset, asyncHandler(resetUserPassword));

module.exports = router; 