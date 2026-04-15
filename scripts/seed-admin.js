/* eslint-disable @typescript-eslint/no-require-imports */

// Seeds (or updates) the local RutaCero admin user for development.
// Safe-guarded to only target local Supabase (localhost/127.0.0.1).

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

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

// Try to load local env.
loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), 'supabase', '.env'));

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@rutacero.gt').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'http://127.0.0.1:54321';

  // Prevent accidental seeding against a non-local Supabase instance.
  const isLocal = /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(supabaseUrl);
  if (!isLocal) {
    throw new Error(
      `Refusing to seed admin user: SUPABASE_URL is not local (${supabaseUrl}). Set SUPABASE_URL to http://127.0.0.1:54321 to seed locally.`
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment (.env.local).');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const passwordHash = await bcrypt.hash(password, 10);

  const { error } = await supabase
    .from('admin_users')
    .upsert(
      {
        email,
        password_hash: passwordHash,
        display_name: 'RutaCero Admin',
        role: 'SUPER_ADMIN',
        is_active: true,
        password_rotated_at: new Date().toISOString(),
        must_rotate_password: false,
      },
      { onConflict: 'email' }
    );

  if (error) {
    throw new Error(`Failed to upsert admin user: ${error.message}`);
  }

  console.log(`Seeded admin user: ${email} (password updated)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
