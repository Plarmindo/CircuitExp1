import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}
function srgbToLin(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map(srgbToLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  const L1 = Math.max(la, lb);
  const L2 = Math.min(la, lb);
  return (L1 + 0.05) / (L2 + 0.05);
}
function extract(css: string, selector: string) {
  const re = new RegExp(
    selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}',
    'm'
  );
  const m = css.match(re);
  if (!m) return {};
  const out: Record<string, string> = {};
  const varRe = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let vm;
  while ((vm = varRe.exec(m[1])) !== null) {
    out['--' + vm[1]] = vm[2].trim();
  }
  return out;
}

describe('Accent color focus outline contrast', () => {
  it('accent token has >=3:1 contrast against panel & background in both themes', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/MetroUI.css'),
      'utf8'
    );
    const light = extract(css, '.metro-ui.light');
    const dark = extract(css, '.metro-ui.dark');
    for (const theme of [light, dark]) {
      expect(theme['--accent']).toBeTruthy();
      expect(theme['--panel']).toBeTruthy();
      expect(theme['--bg']).toBeTruthy();
      const crPanel = contrast(theme['--accent'], theme['--panel']);
      const crBg = contrast(theme['--accent'], theme['--bg']);
      // WCAG recommends focus indicators be clearly visible; 3:1 minimum vs adjacent colors
      expect(crPanel).toBeGreaterThanOrEqual(3);
      expect(crBg).toBeGreaterThanOrEqual(3);
    }
  });
});
