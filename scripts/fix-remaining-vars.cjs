#!/usr/bin/env node

const fs = require('fs');

// More files with unused variable fixes
const remainingFixes = {
  'src/plugins/core/PluginSystem.ts': [
    { from: '(path) =>', to: '(_path) =>' },
    { from: '(path, content) =>', to: '(_path, _content) =>' },
    { from: '(component) =>', to: '(_component) =>' },
    { from: '(componentId) =>', to: '(_componentId) =>' },
    { from: '(key) =>', to: '(_key) =>' },
    { from: '(key, value) =>', to: '(_key, _value) =>' },
  ],

  'src/plugins/deployment/PluginValidator.ts': [
    { from: 'PluginError,', to: 'PluginError as _PluginError,' },
    { from: 'const deprecatedPatterns = ', to: 'const _deprecatedPatterns = ' },
    { from: '(options) =>', to: '(_options) =>' },
  ],

  'src/plugins/deployment/deploy.ts': [
    { from: 'PluginMetadata,', to: 'PluginMetadata as _PluginMetadata,' },
    { from: 'const backupPath = ', to: 'const _backupPath = ' },
    { from: 'const result = ', to: 'const _result = ' },
  ],

  'src/plugins/development/scaffolding.js': [
    { from: '(index) =>', to: '(_index) =>' },
  ],

  'src/plugins/import/ZipPluginImporter.ts': [
    { from: 'PluginValidationResult,', to: 'PluginValidationResult as _PluginValidationResult,' },
    { from: '} catch (error) {', to: '} catch (_error) {' },
    { from: '(pluginPath) =>', to: '(_pluginPath) =>' },
    { from: 'const pluginId = ', to: 'const _pluginId = ' },
  ],

  'src/plugins/import/__tests__/ZipPluginImporter.test.ts': [
    { from: 'const tempDir = ', to: 'const _tempDir = ' },
    { from: 'const pluginDir = ', to: 'const _pluginDir = ' },
  ],

  'src/plugins/tests/core/PluginSystem.test.ts': [
    { from: 'PluginSystemError,', to: 'PluginSystemError as _PluginSystemError,' },
    { from: '(api) =>', to: '(_api) =>' },
  ],

  'src/plugins/tests/edge-cases/PluginEdgeCases.test.ts': [
    { from: 'const mockPluginAPI = ', to: 'const _mockPluginAPI = ' },
    { from: '} catch (error) {', to: '} catch (_error) {' },
    { from: 'const largeArray = ', to: 'const _largeArray = ' },
    { from: '(i) =>', to: '(_i) =>' },
  ],

  'src/plugins/tests/performance/PluginPerformance.test.ts': [
    { from: 'const mockPluginAPI = ', to: 'const _mockPluginAPI = ' },
    { from: 'const initialMemory = ', to: 'const _initialMemory = ' },
    { from: 'const finalMemory = ', to: 'const _finalMemory = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/src/controllers/chat.ts': [
    { from: 'const systemPrompt = ', to: 'const _systemPrompt = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/src/services/validation.ts': [
    { from: 'const value = ', to: 'const _value = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/tests/run-tests.ts': [
    { from: 'const fs = ', to: 'const _fs = ' },
    { from: '(testName) =>', to: '(_testName) =>' },
    { from: 'const largeArray = ', to: 'const _largeArray = ' },
  ],

  'plugin-kit/samples/openai-gpt-plugin/src/index.ts': [
    { from: '(next) =>', to: '(_next) =>' },
    { from: '(promise) =>', to: '(_promise) =>' },
  ],

  'plugin-kit/templates/basic/src/index.ts': [
    { from: '(next) =>', to: '(_next) =>' },
  ],

  'plugin-kit/templates/basic/src/services/ai.ts': [
    { from: '(options) =>', to: '(_options) =>' },
    { from: '(code) =>', to: '(_code) =>' },
    { from: '(code, options) =>', to: '(_code, _options) =>' },
    { from: '(context) =>', to: '(_context) =>' },
  ],
};

function fixRemainingUnusedVars(filePath, fixes) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const fix of fixes) {
    if (content.includes(fix.from)) {
      content = content.replace(new RegExp(fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fix.to);
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

// Process all remaining files
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(remainingFixes)) {
  if (fixRemainingUnusedVars(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} files with remaining unused variable fixes`);
