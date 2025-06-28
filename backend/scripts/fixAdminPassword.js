const bcrypt = require('bcrypt');
const { pool } = require('../src/config/database');

async function fixAdminPassword() {
  try {
    console.log('🔧 Fixing admin@beachsafety.com password...');
    
    // Hash the correct password
    const password = 'Admin123!';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Update the user in the database
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE email = 'admin@beachsafety.com'
    `;
    
    const result = await pool.query(query, [hashedPassword]);
    
    if (result.rowCount > 0) {
      console.log('✅ Successfully updated admin@beachsafety.com password');
      console.log('📧 Email: admin@beachsafety.com');
      console.log('🔑 Password: Admin123!');
      console.log('🔐 New hash: ' + hashedPassword);
    } else {
      console.log('❌ User admin@beachsafety.com not found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing admin password:', error);
  } finally {
    await pool.end();
  }
}

fixAdminPassword(); 