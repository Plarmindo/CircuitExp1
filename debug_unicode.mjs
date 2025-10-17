import { SecurityHardening } from './src/security/security-hardening.ts';

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
  if (!result.valid || result.sanitized !== input) {
    console.log(`ERROR: Expected valid=true and sanitized to match input`);
  }
  console.log('---');
});