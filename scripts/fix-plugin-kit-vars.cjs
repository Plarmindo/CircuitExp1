#!/usr/bin/env node

const fs = require('fs');

// Plugin-kit files with unused variable fixes
const pluginKitFixes = {
  'plugin-kit/samples/anthropic-claude-plugin/src/controllers/analysis.ts': [
    { from: 'AnalysisRequest,', to: 'AnalysisRequest as _AnalysisRequest,' },
    { from: 'BugDetectionRequest,', to: 'BugDetectionRequest as _BugDetectionRequest,' },
    { from: 'TestGenerationRequest,', to: 'TestGenerationRequest as _TestGenerationRequest,' },
    { from: 'DocumentationRequest,', to: 'DocumentationRequest as _DocumentationRequest,' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/src/controllers/chat.ts': [
    { from: 'ChatRequest,', to: 'ChatRequest as _ChatRequest,' },
    { from: 'const systemPrompt = ', to: 'const _systemPrompt = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/src/controllers/completion.ts': [
    { from: 'const totalTokens = ', to: 'const _totalTokens = ' },
    { from: 'const completionText = ', to: 'const _completionText = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/src/controllers/review.ts': [
    { from: 'const temperature = ', to: 'const _temperature = ' },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/src/services/metrics.ts': [
    { from: "import { performance } from 'perf_hooks';", to: "import { performance as _performance } from 'perf_hooks';" },
  ],

  'plugin-kit/samples/anthropic-claude-plugin/src/services/validation.ts': [
    { from: 'const value = ', to: 'const _value = ' },
  ],

  'plugin-kit/samples/openai-gpt-plugin/src/services/ai.ts': [
    { from: '(text) =>', to: '(_text) =>' },
    { from: '(text, language) =>', to: '(_text, _language) =>' },
    { from: '(promise) =>', to: '(_promise) =>' },
  ],

  'plugin-kit/samples/openai-gpt-plugin/src/services/cache.ts': [
    { from: '(value) =>', to: '(_value) =>' },
  ],

  'plugin-kit/src/debug/debug-cli.ts': [
    { from: '(args) =>', to: '(_args) =>' },
    { from: 'const results = ', to: 'const _results = ' },
    { from: 'const functionName = ', to: 'const _functionName = ' },
    { from: 'const optionalFiles = ', to: 'const _optionalFiles = ' },
    { from: '} catch (error) {', to: '} catch (_error) {' },
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

  'plugin-kit/templates/openai-gpt/src/components/ChatPanel.tsx': [
    { from: 'const response = ', to: 'const _response = ' },
  ],
};

function fixPluginKitUnusedVars(filePath, fixes) {
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

// Process all plugin-kit files
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(pluginKitFixes)) {
  if (fixPluginKitUnusedVars(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} plugin-kit files with unused variable fixes`);
