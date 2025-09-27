#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to process (most problematic ones first)
const filesToFix = [
  'debug-issue.js',
  'debug-test.js',
  'verify-fix.js',
  'scripts/verify-signatures.js',
];

function fixUnusedVars(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix specific patterns based on the lint output
  const replacements = [
    // debug-issue.js
    { from: "const { join } = require('path');", to: "const { join: _join } = require('path');" },

    // debug-test.js
    { from: "const fs = require('fs');", to: "const _fs = require('fs');" },

    // verify-fix.js
    { from: "const { join } = require('path');", to: "const { join: _join } = require('path');" },

    // scripts/verify-signatures.js - multiple patterns
    { from: /const result = /g, to: "const _result = " },
    { from: /} catch \(error\) \{/g, to: "} catch (_error) {" },
  ];

  for (const replacement of replacements) {
    if (typeof replacement.from === 'string') {
      if (content.includes(replacement.from)) {
        content = content.replace(replacement.from, replacement.to);
        changed = true;
        console.log(`Fixed in ${filePath}: ${replacement.from} -> ${replacement.to}`);
      }
    } else {
      // RegExp replacement
      if (replacement.from.test(content)) {
        content = content.replace(replacement.from, replacement.to);
        changed = true;
        console.log(`Fixed regex pattern in ${filePath}`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

// Process files
for (const file of filesToFix) {
  fixUnusedVars(file);
}

console.log('Unused variable fixes completed');
