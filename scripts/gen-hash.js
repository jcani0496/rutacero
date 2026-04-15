/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);
    console.log('Password:', password);
    console.log('Hash:', hash);

    // Verify it works
    const isValid = await bcrypt.compare(password, hash);
    console.log('Verification:', isValid);
}

generateHash();
