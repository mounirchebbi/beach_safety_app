const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'myapp_db',
  user: process.env.DB_USER || 'myapp_user',
  password: process.env.DB_PASSWORD || '123',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection function
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, PostGIS_Version() as postgis_version');
    client.release();
    
    logger.info('Database connection test successful');
    logger.info(`Current time: ${result.rows[0].current_time}`);
    logger.info(`PostGIS version: ${result.rows[0].postgis_version}`);
    
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error.message);
    return false;
  }
};

// Query function with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error:', error);
    throw error;
  }
};

// Get client for transactions
const getClient = async () => {
  return await pool.connect();
};

// Close pool
const closePool = async () => {
  await pool.end();
  logger.info('Database pool closed');
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  closePool
}; 