const pool = require('../config/database');
const { logger } = require('../utils/logger');

const sampleLifeguardEmails = [
  'john.smith@beachsafety.com',
  'sarah.johnson@beachsafety.com',
  'mike.davis@beachsafety.com',
  'emma.wilson@beachsafety.com',
  'david.brown@beachsafety.com'
];

async function removeSampleLifeguards() {
  try {
    logger.info('Starting removal of sample lifeguards...');

    for (const email of sampleLifeguardEmails) {
      // Find the user by email
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      
      if (userResult.rows.length === 0) {
        logger.info(`User ${email} not found, skipping`);
        continue;
      }

      const userId = userResult.rows[0].id;
      logger.info(`Found user ${email} with ID: ${userId}`);

      // Remove lifeguard record first (due to foreign key constraint)
      const lifeguardResult = await pool.query('DELETE FROM lifeguards WHERE user_id = $1 RETURNING id', [userId]);
      
      if (lifeguardResult.rows.length > 0) {
        logger.info(`Removed lifeguard record for ${email}`);
      } else {
        logger.info(`No lifeguard record found for ${email}`);
      }

      // Remove user record
      const userDeleteResult = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
      
      if (userDeleteResult.rows.length > 0) {
        logger.info(`Removed user: ${email}`);
      } else {
        logger.info(`Failed to remove user: ${email}`);
      }
    }

    logger.info('Sample lifeguards removal completed successfully');
  } catch (error) {
    logger.error('Error removing sample lifeguards:', error);
  }
}

// Run the script
removeSampleLifeguards(); 