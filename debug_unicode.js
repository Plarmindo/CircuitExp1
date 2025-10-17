const { SecurityHardening } = require('./dist/security/security-hardening.js');
const security = new SecurityHardening();

const unicodeInputs = [
  '🔒 Security test',
  '日本語のテキスト',
  'العربية',
  'русский текст',
  '🚀 Special chars: !@#$%^&*()'
];

unicodeInputs.forEach(input => {
  const result = security.validateInput(input, 'text');
  console.log(`Input: ${input}`);
  console.log(`Result: valid=${result.valid}, sanitized='${result.sanitized}'`);
  console.log(`Match: ${result.valid && result.sanitized === input}`);
  console.log('---');
});