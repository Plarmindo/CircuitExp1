// Generates a simplified SPDX license summary using license-checker
const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('npx license-checker --summary --json', { stdio: 'pipe' }).toString('utf8');
  fs.writeFileSync('licenses-summary.json', output);
  console.log('licenses-summary.json written');
} catch (e) {
  console.error('License audit failed:', e.message);
  process.exit(1);
}
