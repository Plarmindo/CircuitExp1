import { describe, it, expect } from 'vitest';
import { tokens, setTheme } from '../../src/visualization/style-tokens';

function hexNumToRgb(n: number) {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function srgbToLin(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map(srgbToLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: number, b: number) {
  const la = luminance(hexNumToRgb(a));
  const lb = luminance(hexNumToRgb(b));
  const L1 = Math.max(la, lb);
  const L2 = Math.min(la, lb);
  return (L1 + 0.05) / (L2 + 0.05);
}

// For non-text large graphical UI components (nodes) a 3:1 contrast is generally recommended for discernibility.
// We assert directory/file/aggregated/selected each have >=3:1 vs background in both themes.

(['light', 'dark'] as const).forEach((theme) => {
  describe(`visual palette contrast (${theme})`, () => {
    it('node fills vs background >=3:1', () => {
      setTheme(theme);
      const t = tokens();
      const bg = t.palette.background;
      const ratios: Record<string, number> = {};
      for (const k of ['directory', 'file', 'aggregated', 'selected'] as const) {
        ratios[k] = contrast(t.palette[k], bg);
      }
      Object.values(ratios).forEach((v) => expect(v).toBeGreaterThanOrEqual(3));
    });
    it('hover color distinguishable from background and selected', () => {
      setTheme(theme);
      const t = tokens();
      const bg = t.palette.background;
      const hoverCR = contrast(t.palette.hover, bg);
      const selCR = contrast(t.palette.selected, bg);
      expect(hoverCR).toBeGreaterThanOrEqual(2.5); // slightly lower ok for transient state
      // Ensure hover and selected differ enough (contrast between them >=1.5:1)
      const hoverSel = contrast(t.palette.hover, t.palette.selected);
      expect(hoverSel).toBeGreaterThanOrEqual(1.5);
      expect(selCR).toBeGreaterThanOrEqual(3);
    });
  });
});
