#!/usr/bin/env node

const fs = require('fs');

// React hooks dependency fixes
const reactHooksFixes = {
  'src/components/CanvasMetroMap.tsx': [
    {
      from: `  }, []);`,
      to: `  }, [filePalette]);`,
      context: 'useCallback'
    }
  ],

  'src/components/LondonMetroPrototype.tsx': [
    {
      from: `  }, []);`,
      to: `  }, [londonLines]);`,
      context: 'useCallback with londonLines'
    },
    {
      from: `  }, [zoomLevel]);`,
      to: `  }, [zoomLevel, renderMap]);`,
      context: 'useEffect with renderMap'
    }
  ],

  'src/components/MetroUI.tsx': [
    {
      from: `  }, []);`,
      to: `  }, [currentTheme]);`,
      context: 'useEffect with currentTheme'
    },
    {
      from: `  }, [nodes]);`,
      to: `  }, [nodes, nodes?.length]);`,
      context: 'useEffect with nodes.length'
    }
  ],

  'src/components/PerformanceDashboard.tsx': [
    {
      from: `  }, []);`,
      to: `  }, [collectMetrics]);`,
      context: 'useEffect with collectMetrics'
    }
  ],

  'src/components/SimpleMetroStage.tsx': [
    {
      from: `  }, []);`,
      to: `  }, [setupInteractions]);`,
      context: 'useCallback with setupInteractions'
    }
  ],

  'src/visualization/modes/DrawerExplorerMode.tsx': [
    {
      from: `  }, [tab]);`,
      to: `  }, []);`,
      context: 'useMemo removing unnecessary tab dependency'
    }
  ],

  'src/visualization/modes/SemanticZoomMode.tsx': [
    {
      from: `  }, []);`,
      to: `  }, [focusPath]);`,
      context: 'useEffect with focusPath'
    }
  ]
};

function fixReactHooks(filePath, fixes) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const fix of fixes) {
    // Look for the pattern in context to make sure we're fixing the right hook
    if (content.includes(fix.from)) {
      content = content.replace(fix.from, fix.to);
      changed = true;
      console.log(`Fixed React hook in ${filePath}: ${fix.context}`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }

  return changed;
}

// Process React hooks fixes
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(reactHooksFixes)) {
  if (fixReactHooks(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} files with React hooks dependency fixes`);
