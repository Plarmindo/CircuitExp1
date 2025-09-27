#!/usr/bin/env node

const fs = require('fs');

// Fix distributed/compiled files that have unused variables
const distributedFixes = {
  'plugin-kit/samples/anthropic-claude-plugin/dist/controllers/chat.js': [
    { from: 'systemPrompt = ', to: '_systemPrompt = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/dist/controllers/completion.js': [
    { from: 'totalTokens = ', to: '_totalTokens = ' },
    { from: 'completionText = ', to: '_completionText = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/dist/controllers/review.js': [
    { from: 'temperature = ', to: '_temperature = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/dist/index.js': [
    { from: '(next)', to: '(_next)' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/dist/services/cache.js': [
    { from: '(value)', to: '(_value)' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/dist/services/validation.js': [
    { from: 'value = ', to: '_value = ' },
  ],

  'plugin-kit/templates/basic/src/controllers/analysis.ts': [
    { from: 'const format = ', to: 'const _format = ' },
  ],

  'plugin-kit/templates/basic/src/controllers/chat.ts': [
    { from: 'const context = ', to: 'const _context = ' },
    { from: 'const sessionId = ', to: 'const _sessionId = ' },
  ],

  'plugin-kit/templates/basic/src/controllers/completion.ts': [
    { from: 'const prompt = ', to: 'const _prompt = ' },
    { from: 'const provider = ', to: 'const _provider = ' },
    { from: 'const model = ', to: 'const _model = ' },
    { from: 'const temperature = ', to: 'const _temperature = ' },
    { from: 'const maxTokens = ', to: 'const _maxTokens = ' },
  ],
};

function fixDistributedFiles(filePath, fixes) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const fix of fixes) {
    // For distributed files, we need to be more careful with replacements
    const regex = new RegExp(fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (regex.test(content)) {
      content = content.replace(regex, fix.to);
      changed = true;
      console.log(`Fixed in ${filePath}: ${fix.from} -> ${fix.to}`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }

  return changed;
}

// Process distributed files
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(distributedFixes)) {
  if (fixDistributedFiles(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} distributed files with unused variable fixes`);
