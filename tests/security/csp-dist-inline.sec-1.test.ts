import { expect, test } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// SEC-1: Audit built dist/index.html for inline <style> tags or style attributes.
// If dist not present (e.g. in a clean test run before build), the test is skipped.

test('SEC-1 dist index has no inline style tags or style= attributes', () => {
  const distIndex = path.join(__dirname, '..', '..', 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.warn('[SEC-1] dist/index.html not found – skipping inline style audit');
    return; // skip
  }
  const html = fs.readFileSync(distIndex, 'utf8');
  // No <style>...</style>
  expect(/<style[\s>]/i.test(html)).toBe(false);
  // No style="..." attributes (allowing favicon link etc.)
  expect(/ style="[^"]+"/i.test(html)).toBe(false);
});
