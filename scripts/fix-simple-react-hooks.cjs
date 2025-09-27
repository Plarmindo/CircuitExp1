#!/usr/bin/env node

const fs = require('fs');

// Simple React hooks dependency fixes - only the safe ones
const reactHooksFixes = {
  'src/components/CanvasMetroMap.tsx': [
    {
      // Find the useCallback with empty dependency array and add filePalette
      search: /useCallback\(\s*\([^)]*\)\s*=>\s*\{[^}]*\},\s*\[\]\s*\)/,
      replace: (match) => match.replace('[]', '[filePalette]'),
      description: 'Add filePalette to useCallback dependency'
    }
  ],

  'src/components/PerformanceDashboard.tsx': [
    {
      // Find the useEffect with empty dependency array and add collectMetrics
      search: /useEffect\(\s*\(\)\s*=>\s*\{[^}]*collectMetrics[^}]*\},\s*\[\]\s*\)/,
      replace: (match) => match.replace('[]', '[collectMetrics]'),
      description: 'Add collectMetrics to useEffect dependency'
    }
  ],

  'src/visualization/modes/DrawerExplorerMode.tsx': [
    {
      // Remove unnecessary tab dependency from useMemo
      search: /useMemo\([^,]+,\s*\[tab\]\s*\)/,
      replace: (match) => match.replace('[tab]', '[]'),
      description: 'Remove unnecessary tab dependency from useMemo'
    }
  ],

  'src/visualization/modes/SemanticZoomMode.tsx': [
    {
      // Add focusPath to useEffect dependency
      search: /useEffect\(\s*\(\)\s*=>\s*\{[^}]*focusPath[^}]*\},\s*\[\]\s*\)/,
      replace: (match) => match.replace('[]', '[focusPath]'),
      description: 'Add focusPath to useEffect dependency'
    }
  ]
};

function fixSimpleReactHooks(filePath, fixes) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const fix of fixes) {
    if (fix.search.test(content)) {
      const newContent = content.replace(fix.search, fix.replace);
      if (newContent !== content) {
        content = newContent;
        changed = true;
        console.log(`Fixed React hook in ${filePath}: ${fix.description}`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }

  return changed;
}

// Process simple React hooks fixes
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(reactHooksFixes)) {
  if (fixSimpleReactHooks(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} files with simple React hooks fixes`);
