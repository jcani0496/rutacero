/* eslint-disable @typescript-eslint/no-require-imports */

// Seeds (or updates) the local RutaCero admin user for development / e2e.
// Safe-guarded to only target local Postgres (localhost/127.0.0.1).

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@rutacero.gt').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://rutacero:rutacero@localhost:54329/rutacero';

  let host = 'localhost';
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    // fall through
  }

  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(host);
  if (!isLocal) {
    throw new Error(
      `Refusing to seed admin user: DATABASE_URL host is not local (${host}).`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(
      `INSERT INTO admin_users (
         email, password_hash, display_name, role, is_active,
         password_rotated_at, must_rotate_password, status
       ) VALUES ($1, $2, $3, $4, true, NOW(), false, 'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         role = EXCLUDED.role,
         is_active = true,
         password_rotated_at = NOW(),
         must_rotate_password = false,
         updated_at = NOW()`,
      [email, passwordHash, 'RutaCero Admin', 'SUPER_ADMIN'],
    );
    console.log(`Seeded admin user: ${email} (password updated)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
