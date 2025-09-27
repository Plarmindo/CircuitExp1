#!/usr/bin/env node

const fs = require('fs');

function fixMetroStageUnusedVars() {
  const filePath = 'src/visualization/stage/metro-stage.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  const replacements = [
    // Unused imports
    { from: 'initDebugAPI,', to: 'initDebugAPI as _initDebugAPI,' },
    { from: 'createGraphAdapter,', to: 'createGraphAdapter as _createGraphAdapter,' },

    // Unused state variables
    { from: 'const [layoutNodes, setLayoutNodes] = useState', to: 'const [_layoutNodes, _setLayoutNodes] = useState' },
    { from: 'const [adapter, setAdapter] = useState', to: 'const [_adapter, _setAdapter] = useState' },
    { from: 'const [nodeIndex, setNodeIndex] = useState', to: 'const [_nodeIndex, _setNodeIndex] = useState' },
    { from: 'const [renderStats, setRenderStats] = useState', to: 'const [_renderStats, _setRenderStats] = useState' },
    { from: 'const [lastUpdateTime, setLastUpdateTime] = useState', to: 'const [_lastUpdateTime, _setLastUpdateTime] = useState' },
    { from: 'const [depthCapOverride, setDepthCapOverride] = useState', to: 'const [_depthCapOverride, _setDepthCapOverride] = useState' },

    // Unused handlers
    { from: 'const handleNodeHover = useCallback(', to: 'const _handleNodeHover = useCallback(' },
    { from: 'const updateNode = useCallback(', to: 'const _updateNode = useCallback(' },

    // Unused parameters
    { from: '(type) =>', to: '(_type) =>' },
    { from: '(nodes) =>', to: '(_nodes) =>' },
    { from: '(opts) =>', to: '(_opts) =>' },

    // Unused variables
    { from: 'const loops = ', to: 'const _loops = ' },
  ];

  let changed = false;
  for (const replacement of replacements) {
    if (content.includes(replacement.from)) {
      content = content.replace(new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement.to);
      changed = true;
      console.log(`Fixed: ${replacement.from} -> ${replacement.to}`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

fixMetroStageUnusedVars();
