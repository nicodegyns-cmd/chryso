#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcFile = 'c:\\xampp\\htdocs\\chryso\\pages\\api\\activities.js';
const host = 'ubuntu@sirona-consult.be';
const remoteFile = '/home/ubuntu/chryso/pages/api/activities.js';

console.log('📦 Reading local file...');
let content;
try {
  content = fs.readFileSync(srcFile, 'utf8');
  console.log(`✅ Read ${content.length} bytes`);
} catch (err) {
  console.error('❌ Failed to read file:', err.message);
  process.exit(1);
}

// Create base64 encoded version
console.log('\n🔐 Encoding to base64...');
const b64 = Buffer.from(content).toString('base64');
console.log(`✅ Encoded to ${b64.length} bytes`);

// Send via SSH with base64 decoding
console.log('\n📤 Deploying to VPS...');
try {
  const cmd = `echo "${b64}" | ssh ${host} 'base64 -d > ${remoteFile} && echo "✅ File deployed"'`;
  console.log('Running:', cmd.substring(0, 100) + '...');
  const result = execSync(cmd, { stdio: 'inherit' });
  console.log('✅ Deployment successful');
  
  // Rebuild and restart
  console.log('\n🔨 Building and restarting...');
  execSync(`ssh ${host} "cd /home/ubuntu/chryso && npm run build && pm2 restart chryso && sleep 2 && pm2 logs chryso --lines 50"`, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Deployment failed:', err.message);
  process.exit(1);
}
