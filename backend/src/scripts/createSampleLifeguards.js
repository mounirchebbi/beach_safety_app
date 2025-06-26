const pool = require('../config/database');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const sampleLifeguards = [
  {
    email: 'john.smith@beachsafety.com',
    firstName: 'John',
    lastName: 'Smith',
    phone: '+1-555-0101',
    employeeId: 'LG001',
    certificationLevel: 'Senior',
    certificationExpiry: '2025-12-31',
    emergencyContact: '+1-555-0102',
    availabilityStatus: 'available'
  },
  {
    email: 'sarah.johnson@beachsafety.com',
    firstName: 'Sarah',
    lastName: 'Johnson',
    phone: '+1-555-0103',
    employeeId: 'LG002',
    certificationLevel: 'Advanced',
    certificationExpiry: '2025-08-15',
    emergencyContact: '+1-555-0104',
    availabilityStatus: 'available'
  },
  {
    email: 'mike.davis@beachsafety.com',
    firstName: 'Mike',
    lastName: 'Davis',
    phone: '+1-555-0105',
    employeeId: 'LG003',
    certificationLevel: 'Basic',
    certificationExpiry: '2025-06-30',
    emergencyContact: '+1-555-0106',
    availabilityStatus: 'on_leave'
  },
  {
    email: 'emma.wilson@beachsafety.com',
    firstName: 'Emma',
    lastName: 'Wilson',
    phone: '+1-555-0107',
    employeeId: 'LG004',
    certificationLevel: 'Supervisor',
    certificationExpiry: '2026-03-15',
    emergencyContact: '+1-555-0108',
    availabilityStatus: 'available'
  },
  {
    email: 'david.brown@beachsafety.com',
    firstName: 'David',
    lastName: 'Brown',
    phone: '+1-555-0109',
    employeeId: 'LG005',
    certificationLevel: 'Advanced',
    certificationExpiry: '2025-11-20',
    emergencyContact: '+1-555-0110',
    availabilityStatus: 'unavailable'
  }
];

async function createSampleLifeguards() {
  try {
    // Get the first center (assuming it exists)
    const centerResult = await pool.query('SELECT id FROM centers LIMIT 1');
    
    if (centerResult.rows.length === 0) {
      logger.error('No centers found. Please create a center first.');
      return;
    }
    
    const centerId = centerResult.rows[0].id;
    logger.info(`Creating sample lifeguards for center: ${centerId}`);

    for (const lifeguardData of sampleLifeguards) {
      // Check if user already exists
      const userCheckResult = await pool.query('SELECT id FROM users WHERE email = $1', [lifeguardData.email]);
      
      let userId;
      if (userCheckResult.rows.length > 0) {
        userId = userCheckResult.rows[0].id;
        logger.info(`User ${lifeguardData.email} already exists, skipping user creation`);
      } else {
        // Create new user
        const defaultPassword = 'Lifeguard123!';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        
        const userResult = await pool.query(`
          INSERT INTO users (email, first_name, last_name, phone, role, password_hash)
          VALUES ($1, $2, $3, $4, 'lifeguard', $5)
          RETURNING id
        `, [
          lifeguardData.email,
          lifeguardData.firstName,
          lifeguardData.lastName,
          lifeguardData.phone,
          passwordHash
        ]);
        
        userId = userResult.rows[0].id;
        logger.info(`Created user: ${lifeguardData.email}`);
      }

      // Check if lifeguard already exists
      const lifeguardCheckResult = await pool.query('SELECT id FROM lifeguards WHERE user_id = $1', [userId]);
      
      if (lifeguardCheckResult.rows.length > 0) {
        logger.info(`Lifeguard for ${lifeguardData.email} already exists, skipping`);
        continue;
      }

      // Create lifeguard record
      await pool.query(`
        INSERT INTO lifeguards (
          user_id, center_id, employee_id, certification_level, 
          certification_expiry, emergency_contact, availability_status, hire_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
      `, [
        userId,
        centerId,
        lifeguardData.employeeId,
        lifeguardData.certificationLevel,
        lifeguardData.certificationExpiry,
        lifeguardData.emergencyContact,
        lifeguardData.availabilityStatus
      ]);

      logger.info(`Created lifeguard: ${lifeguardData.firstName} ${lifeguardData.lastName} (${lifeguardData.employeeId})`);
    }

    logger.info('Sample lifeguards created successfully');
  } catch (error) {
    logger.error('Error creating sample lifeguards:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
createSampleLifeguards(); 