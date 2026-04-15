#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Generate cryptographically secure secrets for RutaCero
 *
 * Usage: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('🔐 Generating secure secrets for RutaCero...\n');

// Generate CRON_SECRET
const cronSecret = crypto.randomBytes(32).toString('hex');
console.log('CRON_SECRET (64 chars):');
console.log(cronSecret);
console.log('');

// Generate RECURRENTE_WEBHOOK_SECRET (if needed)
const webhookSecret = crypto.randomBytes(32).toString('hex');
console.log('RECURRENTE_WEBHOOK_SECRET (64 chars):');
console.log(`whsec_${webhookSecret}`);
console.log('');

// Generate JWT_SECRET for admin sessions
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('ADMIN_JWT_SECRET (128 chars):');
console.log(jwtSecret);
console.log('');

console.log('✅ Copy these to your .env.local file');
console.log('⚠️  Never commit these secrets to git!');
