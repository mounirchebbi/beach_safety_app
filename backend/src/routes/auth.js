const express = require('express');
const { body } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  register,
  login,
  getMe,
  updateProfile,
  logout
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

// Routes
router.post('/register', validateRegistration, asyncHandler(register));
router.post('/login', validateLogin, asyncHandler(login));
router.get('/me', verifyToken, asyncHandler(getMe));
router.put('/profile', verifyToken, validateProfileUpdate, asyncHandler(updateProfile));
router.post('/logout', verifyToken, asyncHandler(logout));

module.exports = router; 