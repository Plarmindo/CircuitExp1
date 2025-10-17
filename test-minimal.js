// Minimal test to isolate the issue
console.log('Starting minimal test...');

try {
  console.log('Testing CSPManager import...');
  const { CSPManager } = require('./src/security/csp-manager.cjs');
  console.log('CSPManager imported successfully');

  console.log('All imports successful!');
} catch (error) {
  console.error('Import error:', error.message);
  console.error(error.stack);
}
