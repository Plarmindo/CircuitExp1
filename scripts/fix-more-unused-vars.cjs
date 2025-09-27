#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files and their specific unused variable fixes
const fileFixes = {
  'src/components/SimpleMetroStage.tsx': [
    { from: 'LayoutNodeLite,', to: 'LayoutNodeLite as _LayoutNodeLite,' },
    { from: 'RouteCommand,', to: 'RouteCommand as _RouteCommand,' },
  ],

  'src/components/plugins/PluginManagerUI.tsx': [
    { from: 'Modal,', to: 'Modal as _Modal,' },
    { from: 'PlusOutlined,', to: 'PlusOutlined as _PlusOutlined,' },
  ],

  'src/visualization/layout-v2.ts': [
    { from: 'const layoutForceDirected = ', to: 'const _layoutForceDirected = ' },
    { from: 'const allNodes = ', to: 'const _allNodes = ' },
    { from: 'const layoutStats = ', to: 'const _layoutStats = ' },
    { from: '(monitor) =>', to: '(_monitor) =>' },
  ],

  'src/visualization/modes/mode-registry.ts': [
    { from: "import React from 'react';", to: "import React as _React from 'react';" },
  ],

  'src/visualization/modes/SplitViewMode.tsx': [
    { from: 'const [selected, setSelected] = useState', to: 'const [_selected, _setSelected] = useState' },
    { from: 'const [hovered, setHovered] = useState', to: 'const [_hovered, _setHovered] = useState' },
  ],

  'src/visualization/performance/batch-renderer.ts': [
    { from: 'Container,', to: 'Container as _Container,' },
    { from: 'LayoutPointV2,', to: 'LayoutPointV2 as _LayoutPointV2,' },
    { from: 'GraphAdapter,', to: 'GraphAdapter as _GraphAdapter,' },
    { from: '(instanceCount) =>', to: '(_instanceCount) =>' },
    { from: 'const vertices = ', to: 'const _vertices = ' },
    { from: '(type) =>', to: '(_type) =>' },
  ],

  'src/visualization/performance/force-directed-layout.ts': [
    { from: 'GraphNode,', to: 'GraphNode as _GraphNode,' },
  ],

  'src/visualization/performance/performance-monitor.ts': [
    { from: 'const updateTime = ', to: 'const _updateTime = ' },
    { from: '} catch (error) {', to: '} catch (_error) {' },
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
    { from: 'const parentNode = ', to: 'const _parentNode = ' },
  ],

  'src/security/csp-manager.ts': [
    { from: 'const nonce = ', to: 'const _nonce = ' },
  ],

  'src/security/security-audit.ts': [
    { from: 'writeFile,', to: 'writeFile as _writeFile,' },
    { from: '} catch (error) {', to: '} catch (_error) {' },
  ],

  'src/security/security-config.ts': [
    { from: '(filename) =>', to: '(_filename) =>' },
  ],

  'src/security/security-manager.ts': [
    { from: 'const fs = ', to: 'const _fs = ' },
  ],

  'src/security/security-middleware.ts': [
    { from: '(operation) =>', to: '(_operation) =>' },
  ],

  'src/services/audit-logger.ts': [
    { from: '(limit) =>', to: '(_limit) =>' },
  ],

  'src/services/error-reporter.ts': [
    { from: 'const log = ', to: 'const _log = ' },
  ],

  'src/services/metrics-service.ts': [
    { from: '} catch (error) {', to: '} catch (_error) {' },
  ],
};

function fixFileUnusedVars(filePath, fixes) {
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

// Process all files
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(fileFixes)) {
  if (fixFileUnusedVars(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} files with unused variable fixes`);
