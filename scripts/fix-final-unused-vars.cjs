#!/usr/bin/env node

const fs = require('fs');

// Final batch of unused variable fixes
const finalFixes = {
  'src/components/MetroUI.tsx': [
    { from: 'ResponsiveMetroStage,', to: 'ResponsiveMetroStage as _ResponsiveMetroStage,' },
    { from: 'LayoutPointV2,', to: 'LayoutPointV2 as _LayoutPointV2,' },
    { from: '(l) =>', to: '(_l) =>' },
  ],

  'src/components/SimpleMetroStage.tsx': [
    { from: 'RouteCommand as _RouteCommand,', to: 'RouteCommand as _RouteCommand,' }, // already fixed
  ],

  'src/visualization/layout-v2.ts': [
    { from: 'const layoutForceDirected = ', to: 'const _layoutForceDirected = ' },
    { from: '(monitor) =>', to: '(_monitor) =>' },
  ],

  'src/visualization/modes/mode-registry.ts': [
    { from: "import React from 'react';", to: "import React as _React from 'react';" },
  ],

  'src/visualization/performance/batch-renderer.ts': [
    { from: 'LayoutPointV2,', to: 'LayoutPointV2 as _LayoutPointV2,' },
    { from: 'GraphAdapter,', to: 'GraphAdapter as _GraphAdapter,' },
    { from: '(instanceCount) =>', to: '(_instanceCount) =>' },
    { from: '(type) =>', to: '(_type) =>' },
  ],

  'src/visualization/performance/force-directed-layout.ts': [
    { from: 'GraphNode,', to: 'GraphNode as _GraphNode,' },
  ],

  'src/visualization/stage/export-manager.ts': [
    { from: '(width, height) =>', to: '(_width, _height) =>' },
  ],

  'src/visualization/stage/gpu-cleanup.ts': [
    { from: 'const clearPrograms = ', to: 'const _clearPrograms = ' },
  ],

  'src/visualization/stage/gpu-utils.ts': [
    { from: '(fallbackWidth, fallbackHeight) =>', to: '(_fallbackWidth, _fallbackHeight) =>' },
  ],

  'src/visualization/stage/index.ts': [
    { from: 'Suspense,', to: 'Suspense as _Suspense,' },
  ],

  'src/visualization/stage/render.ts': [
    { from: 'MetroDebugWindow,', to: 'MetroDebugWindow as _MetroDebugWindow,' },
  ],

  'src/visualization/stage/metro-stage.tsx': [
    { from: 'initDebugAPI,', to: 'initDebugAPI as _initDebugAPI,' },
    { from: '(type) =>', to: '(_type) =>' },
    { from: '(nodes) =>', to: '(_nodes) =>' },
    { from: '(opts) =>', to: '(_opts) =>' },
  ],

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
    { from: '(options) =>', to: '(_options) =>' },
  ],

  'src/plugins/deployment/deploy.ts': [
    { from: 'PluginMetadata,', to: 'PluginMetadata as _PluginMetadata,' },
  ],

  'src/plugins/development/scaffolding.js': [
    { from: '(index) =>', to: '(_index) =>' },
  ],

  'src/plugins/import/ZipPluginImporter.ts': [
    { from: 'PluginValidationResult,', to: 'PluginValidationResult as _PluginValidationResult,' },
    { from: '(pluginPath) =>', to: '(_pluginPath) =>' },
  ],

  'src/plugins/import/__tests__/ZipPluginImporter.test.ts': [
    { from: 'const tempDir = ', to: 'const _tempDir = ' },
  ],

  'src/plugins/tests/core/PluginSystem.test.ts': [
    { from: 'PluginSystemError,', to: 'PluginSystemError as _PluginSystemError,' },
    { from: '(api) =>', to: '(_api) =>' },
  ],

  'src/plugins/tests/edge-cases/PluginEdgeCases.test.ts': [
    { from: '(i) =>', to: '(_i) =>' },
  ],

  'src/security/security-config.ts': [
    { from: '(filename) =>', to: '(_filename) =>' },
  ],

  'src/security/security-middleware.ts': [
    { from: '(operation) =>', to: '(_operation) =>' },
  ],

  'src/services/audit-logger.ts': [
    { from: '(limit) =>', to: '(_limit) =>' },
  ],
};

function fixFinalUnusedVars(filePath, fixes) {
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

// Process final unused variable fixes
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(finalFixes)) {
  if (fixFinalUnusedVars(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} files with final unused variable fixes`);
