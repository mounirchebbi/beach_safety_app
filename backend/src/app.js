const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');

// Import configurations
const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const centerRoutes = require('./routes/centers');
const lifeguardRoutes = require('./routes/lifeguards');
const shiftRoutes = require('./routes/shifts');
const weatherRoutes = require('./routes/weather');
const alertRoutes = require('./routes/alerts');
const reportRoutes = require('./routes/reports');
const publicRoutes = require('./routes/public');
const safetyRoutes = require('./routes/safety');
const safetyZoneRoutes = require('./routes/safetyZones');
const escalationRoutes = require('./routes/escalations');

// Import services
const { initializeSocket, emitWeatherUpdatesToAllCenters } = require('./services/socketService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Initialize socket service
initializeSocket(io);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for public endpoints and health checks
    return req.path.startsWith('/api/v1/public') || req.path === '/health';
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(limiter);
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/centers', centerRoutes);
app.use('/api/v1/lifeguards', lifeguardRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/safety', safetyRoutes);
app.use('/api/v1/safety-zones', safetyZoneRoutes);
app.use('/api/v1/escalations', escalationRoutes);

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use(errorHandler);

// Schedule weather updates every 15 minutes
const WEATHER_UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes

const scheduleWeatherUpdates = () => {
  setInterval(async () => {
    try {
      logger.info('Starting scheduled weather update cycle');
      await emitWeatherUpdatesToAllCenters();
      logger.info('Scheduled weather update cycle completed');
    } catch (error) {
      logger.error('Error in scheduled weather update cycle:', error);
    }
  }, WEATHER_UPDATE_INTERVAL);
};

// Start weather update scheduler
scheduleWeatherUpdates();
logger.info('Weather update scheduler started (every 15 minutes)');

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io }; 