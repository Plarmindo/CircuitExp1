#!/usr/bin/env node

const fs = require('fs');

// Core source files with remaining unused variables
const coreSourceFixes = {
  'src/components/ResponsiveMetroStage.tsx': [
    { from: 'ResponsiveMetroStage as _ResponsiveMetroStage,', to: 'ResponsiveMetroStage as _ResponsiveMetroStage,' },
    { from: 'LayoutPointV2 as _LayoutPointV2,', to: 'LayoutPointV2 as _LayoutPointV2,' },
  ],

  'src/components/SimpleMetroStage.tsx': [
    { from: 'RouteCommand as _RouteCommand,', to: 'RouteCommand as _RouteCommand,' },
  ],

  'src/visualization/layout-v2.ts': [
    { from: 'const layoutForceDirected = ', to: 'const _layoutForceDirected = ' },
    { from: '(monitor) =>', to: '(_monitor) =>' },
  ],

  'src/visualization/performance/batch-renderer.ts': [
    { from: 'LayoutPointV2 as _LayoutPointV2,', to: 'LayoutPointV2 as _LayoutPointV2,' },
    { from: 'GraphAdapter as _GraphAdapter,', to: 'GraphAdapter as _GraphAdapter,' },
    { from: '(instanceCount) =>', to: '(_instanceCount) =>' },
    { from: '(type) =>', to: '(_type) =>' },
  ],

  'src/visualization/performance/force-directed-layout.ts': [
    { from: 'GraphNode as _GraphNode,', to: 'GraphNode as _GraphNode,' },
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
    { from: 'Suspense as _Suspense,', to: 'Suspense as _Suspense,' },
  ],

  'src/visualization/stage/render.ts': [
    { from: 'MetroDebugWindow as _MetroDebugWindow,', to: 'MetroDebugWindow as _MetroDebugWindow,' },
  ],

  'plugin-kit/src/testing/plugin-test-utils.ts': [
    { from: '} catch (error) {', to: '} catch (_error) {' },
  ],
};

function fixCoreSourceVars(filePath, fixes) {
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

// Process core source files
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(coreSourceFixes)) {
  if (fixCoreSourceVars(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} core source files with unused variable fixes`);
