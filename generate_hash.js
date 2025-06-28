const bcrypt = require('bcrypt');

async function generateHash() {
  try {
    const password = '123';
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Generated bcrypt hash for "123":');
    console.log(hash);
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

generateHash(); 