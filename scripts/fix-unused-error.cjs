// Script to fix unused _error variables in catch blocks
const fs = require('fs');
const path = require('path');

const files = [
  'scripts/verify-signatures.js',
  'src/plugins/tests/edge-cases/PluginEdgeCases.test.ts',
  'src/plugins/import/ZipPluginImporter.ts',
  'src/visualization/performance/performance-monitor.ts',
  'plugin-kit/src/testing/plugin-test-utils.ts',
  'plugin-kit/src/debug/debug-cli.ts',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  // Replace } catch (_error) { with } catch {
  content = content.replace(/\} catch \(_error\) \{/g, '} catch {');

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    const matches = (originalContent.match(/\} catch \(_error\) \{/g) || []).length;
    console.log(`✅ Fixed ${filePath} (${matches} occurrences)`);
    return true;
  } else {
    console.log(`ℹ️  No changes needed in ${filePath}`);
    return false;
  }
}

console.log('🔧 Fixing unused _error variables...\n');

let totalFixed = 0;
for (const file of files) {
  if (fixFile(file)) {
    totalFixed++;
  }
}

console.log(`\n✨ Fixed ${totalFixed} files`);
console.log('Run `npm run lint` to verify fixes');
