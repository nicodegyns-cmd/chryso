#!/usr/bin/env node
/**
 * Start script that loads .env BEFORE requiring anything
 * This ensures process.env is correct before Next.js compiles and bundles code
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load .env synchronously BEFORE starting Next.js
function loadEnv(envPath) {
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      let count = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.substring(0, eqIndex);
            const value = trimmed.substring(eqIndex + 1);
            process.env[key] = value;
            if (key === 'DATABASE_URL') {
              count++;
              console.log(`[STARTUP] Set DATABASE_URL from .env:`, value.substring(0, 60) + '...');
            }
          }
        }
      }
      if (count === 0) {
        console.warn('[STARTUP] DATABASE_URL not found in .env!');
      }
      return true;
    }
  } catch (err) {
    console.error('[STARTUP] Error loading .env:', err.message);
  }
  return false;
}

// Try to find and load .env
const possiblePaths = [
  path.resolve(__dirname, '.env'),
  '/home/ubuntu/chryso/.env',
  '/var/www/chryso/.env',
];

let loaded = false;
for (const envPath of possiblePaths) {
  if (loadEnv(envPath)) {
    loaded = true;
    break;
  }
}

if (!loaded) {
  console.warn('[STARTUP] WARNING: .env file not found!');
  console.log('[STARTUP] process.env.DATABASE_URL:', process.env.DATABASE_URL || 'NOT SET');
}

console.log('[STARTUP] Final env state:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 80) + '...' : 'NOT SET');

// Now start Next.js via 'next start' command
const args = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['start'];
console.log('[STARTUP] Launching Next.js with args:', args.join(' '));

const next = spawn('npx', ['next', ...args], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env
});

next.on('error', (err) => {
  console.error('[STARTUP] Failed to start Next.js:', err);
  process.exit(1);
});

next.on('exit', (code) => {
  console.log('[STARTUP] Next.js exited with code:', code);
  process.exit(code);
});

