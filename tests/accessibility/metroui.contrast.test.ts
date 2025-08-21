import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

// Minimal color utilities
function hexToRgb(hex: string) {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function srgbToLin(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map(srgbToLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string) {
  const la = luminance(hexToRgb(hexA));
  const lb = luminance(hexToRgb(hexB));
  const L1 = Math.max(la, lb);
  const L2 = Math.min(la, lb);
  return (L1 + 0.05) / (L2 + 0.05);
}

function extractThemeVars(cssText: string, themeSelector: string) {
  const re = new RegExp(
    themeSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}',
    'm'
  );
  const m = cssText.match(re);
  if (!m) return {} as Record<string, string>;
  const block = m[1];
  const varRe = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  const out: Record<string, string> = {};
  let vm;
  while ((vm = varRe.exec(block)) !== null) {
    out[`--${vm[1]}`] = vm[2].trim();
  }
  return out;
}

describe('MetroUI color contrast tokens', () => {
  it('light and dark theme text vs panel meet 4.5:1 contrast', () => {
    const cssPath = path.resolve(__dirname, '../../src/components/MetroUI.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const light = extractThemeVars(css, '.metro-ui.light');
    const dark = extractThemeVars(css, '.metro-ui.dark');

    // ensure variables exist
    expect(light['--text']).toBeTruthy();
    expect(light['--panel']).toBeTruthy();
    expect(dark['--text']).toBeTruthy();
    expect(dark['--panel']).toBeTruthy();

    const crLight = contrastRatio(light['--text'], light['--panel']);
    const crDark = contrastRatio(dark['--text'], dark['--panel']);

    // require >= 4.5 for normal text
    expect(crLight).toBeGreaterThanOrEqual(4.5);
    expect(crDark).toBeGreaterThanOrEqual(4.5);
  });
});
