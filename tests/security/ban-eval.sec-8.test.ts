import { describe, it, expect } from 'vitest';
import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';

/**
 * Fails if `eval`, `Function` constructor, or dynamic `require` via template strings
 * are detected in any JS/TS source—preventing code-injection primitives.
 */

describe('Security ▸ Prohibit dangerous dynamic code execution', () => {
  // Scan all runtime source – exclude node_modules/build/tests.
  const patterns = [
    '**/*.{js,ts,cjs,cts,mjs,jsx,tsx}',
    '!**/node_modules/**', // exclude node_modules at any depth
    '!build/**',
    '!tests/**',
    '!dist/**',
  ];

  const projectRoot = path.resolve(__dirname, '../../');
  const files = fg.sync(patterns, { cwd: projectRoot, absolute: true, dot: false });

  // Regex detecting eval, new Function(), or require(`${var}`) patterns.
  const forbidden = /\b(eval\s*\(|new\s+Function\s*\(|require\s*\(\s*[`'][^'`]*\$\{)/;

  it('contains no dangerous dynamic code execution constructs', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (forbidden.test(src)) {
        offenders.push(path.relative(projectRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
