import { describe, it, expect } from 'vitest';
import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';

/**
 * Renderer code runs in the browser sandbox with limited Node access.
 * This test fails if any source under src/ directly imports or uses the Node `fs` module.
 * All filesystem activity must traverse IPC to the main process instead.
 */

describe('Security ▸ Renderer sandbox forbids Node fs usage', () => {
  const projectRoot = path.resolve(__dirname, '../../');
  const rendererFiles = fg.sync(['src/**/*.{ts,tsx,js,jsx}'], { cwd: projectRoot, absolute: true });

  it('has no `fs` module usage in renderer source', () => {
    const offenders: string[] = [];
    const requireRegex = /require\(['"]fs['"]\)/;
    const importRegex = /from\s+['"]fs['"]/;
    const memberRegex = /\bfs\.[A-Za-z]+/;

    // Exclude CLI tools and test files that legitimately use fs
    const excludedFiles = [
      'src/plugins/development/scaffolding.js',
      'src/plugins/tests/edge-cases/PluginEdgeCases.test.ts',
      'src/plugins/import/__tests__/ZipPluginImporter.test.ts'
    ];

    for (const file of rendererFiles) {
      const relativePath = path.relative(projectRoot, file).replace(/\\/g, '/');
      if (excludedFiles.includes(relativePath)) continue;

      const src = fs.readFileSync(file, 'utf8');
      if (requireRegex.test(src) || importRegex.test(src) || memberRegex.test(src)) {
        offenders.push(relativePath);
      }
    }

    expect(offenders).toEqual([]);
  });
});
