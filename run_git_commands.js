const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const output = [];
const cwd = 'C:\\xampp\\htdocs\\chryso';

output.push('=== GIT STATUS ===');
try {
  const status = execSync('git --no-pager status', { cwd, encoding: 'utf-8' });
  output.push(status);
} catch (e) {
  output.push('ERROR: ' + e.message);
}

output.push('\n\n=== GIT LOG ===');
try {
  const log = execSync('git --no-pager log --oneline -n 5', { cwd, encoding: 'utf-8' });
  output.push(log);
} catch (e) {
  output.push('ERROR: ' + e.message);
}

output.push('\n\n=== ATTEMPTING GIT PUSH ===');
try {
  const push = execSync('git --no-pager push origin main --force-with-lease', { cwd, encoding: 'utf-8' });
  output.push(push);
} catch (e) {
  output.push('ERROR: ' + e.message);
  output.push('\nSTDERR: ' + e.stderr);
}

const finalOutput = output.join('\n');
console.log(finalOutput);

// Write to file
fs.writeFileSync(path.join(cwd, 'git_output.txt'), finalOutput);
console.log('\n\nRésultats sauvegardés dans: git_output.txt');
