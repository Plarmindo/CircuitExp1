#!/usr/bin/env node

const fs = require('fs');

function fixMetroUIUnusedVars() {
  const filePath = 'src/components/MetroUI.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  const replacements = [
    // Unused handlers
    { from: 'const handleNodeContextMenu = useCallback(', to: 'const _handleNodeContextMenu = useCallback(' },
    { from: 'const handleBackgroundClick = useCallback(', to: 'const _handleBackgroundClick = useCallback(' },
    { from: 'const handleBackgroundContextMenu = useCallback(', to: 'const _handleBackgroundContextMenu = useCallback(' },
    { from: 'const handleLayoutUpdate = useCallback(', to: 'const _handleLayoutUpdate = useCallback(' },

    // Unused error info variables
    { from: 'const errorInfo = ', to: 'const _errorInfo = ' },

    // Unused function parameters
    { from: '(l) =>', to: '(_l) =>' },
    { from: '(l: any) =>', to: '(_l: any) =>' },
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

fixMetroUIUnusedVars();
