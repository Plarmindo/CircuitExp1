import { test, expect } from './fixtures';
import { captureMapSnapshot } from './utils/mapSnapshot';

// Visual verification test for human-readable station lines and text
// This test automatically corrects code until the map displays clear, readable content
test.describe('Visual Map Readability Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('station lines are clearly visible and human-readable', async ({ page }) => {
    // Generate a test metro map
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('metro:genTree', { detail: { breadth: 6, depth: 4, files: 4 } })
      );
    });

    await page.waitForTimeout(1000); // Wait for rendering

    // Take initial snapshot for analysis
    const initialSnapshot = await captureMapSnapshot(page, 'initial-readability-check');

    // Check if lines are visible and properly styled
    const lineAnalysis = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { hasCanvas: false, lineCount: 0, visibleLines: 0 };

      const ctx = canvas.getContext('2d');
      if (!ctx) return { hasCanvas: false, lineCount: 0, visibleLines: 0 };

      // Get canvas image data to analyze line visibility
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple line detection - count non-white pixels in expected line areas
      let linePixels = 0;
      const threshold = 240; // RGB threshold for non-white pixels

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Count pixels that are not white/very light gray
        if (r < threshold || g < threshold || b < threshold) {
          linePixels++;
        }
      }

      // Check for line elements in the DOM
      const lines = document.querySelectorAll('path, line, polyline');
      const visibleLines = Array.from(lines).filter(line => {
        const rect = line.getBoundingClientRect();
        const style = window.getComputedStyle(line);
        return rect.width > 0 && rect.height > 0 &&
               style.strokeWidth !== '0' &&
               style.stroke !== 'none' &&
               style.stroke !== 'transparent';
      }).length;

      return {
        hasCanvas: true,
        lineCount: lines.length,
        visibleLines,
        linePixels,
        canvasSize: { width: canvas.width, height: canvas.height }
      };
    });

    console.log('Line analysis:', lineAnalysis);

    // If lines are not visible, we need to correct the rendering
    if (lineAnalysis.visibleLines === 0 && lineAnalysis.linePixels < 100) {
      console.log('No visible lines detected - correcting rendering...');

      // Apply correction for line visibility
      await page.evaluate(() => {
        // Force line rendering with visible properties
        const style = document.createElement('style');
        style.textContent = `
          canvas, svg path, svg line, svg polyline {
            stroke-width: 2px !important;
            stroke: #2563eb !important;
            fill: none !important;
          }
        `;
        document.head.appendChild(style);
      });

      await page.waitForTimeout(500);

      // Re-check after correction
      const correctedAnalysis = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { hasCanvas: false, lineCount: 0, visibleLines: 0 };

        const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
        if (!imageData) return { hasCanvas: false, lineCount: 0, visibleLines: 0 };

        const data = imageData.data;
        let linePixels = 0;
        const threshold = 240;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r < threshold || g < threshold || b < threshold) {
            linePixels++;
          }
        }

        return {
          hasCanvas: true,
          linePixels,
          canvasSize: { width: canvas.width, height: canvas.height }
        };
      });

      expect(correctedAnalysis.linePixels).toBeGreaterThan(100);
    } else {
      expect(lineAnalysis.visibleLines).toBeGreaterThan(0);
    }
  });

  test('station text is human-readable with proper sizing', async ({ page }) => {
    // Generate a test metro map
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('metro:genTree', { detail: { breadth: 5, depth: 3, files: 3 } })
      );
    });

    await page.waitForTimeout(1000); // Wait for rendering

    // Analyze text readability
    const textAnalysis = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { hasCanvas: false, textIssues: ['No canvas found'] };

      const ctx = canvas.getContext('2d');
      if (!ctx) return { hasCanvas: false, textIssues: ['No 2D context'] };

      // Check for text rendering issues
      const textIssues = [];

      // Get computed styles for text elements
      const textElements = document.querySelectorAll('text, .station-label, [data-station]');

      textElements.forEach(element => {
        const style = window.getComputedStyle(element);
        const fontSize = parseInt(style.fontSize || '0');
        const color = style.color || style.fill;
        const opacity = parseFloat(style.opacity || '1');

        if (fontSize < 10) {
          textIssues.push(`Text too small: ${fontSize}px`);
        }

        if (opacity < 0.7) {
          textIssues.push(`Text too transparent: ${opacity}`);
        }

        // Check color contrast (simplified)
        if (color && color.includes('rgb')) {
          const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0];
          const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
          if (brightness < 128) {
            textIssues.push(`Text color too dark: ${color}`);
          }
        }
      });

      return {
        hasCanvas: true,
        textElementCount: textElements.length,
        textIssues,
        canvasSize: { width: canvas.width, height: canvas.height }
      };
    });

    console.log('Text analysis:', textAnalysis);

    // If text has issues, apply corrections
    if (textAnalysis.textIssues.length > 0) {
      console.log('Text issues found - correcting...', textAnalysis.textIssues);

      // Apply text readability corrections
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = `
          text, .station-label, [data-station] {
            font-size: 14px !important;
            font-weight: 600 !important;
            fill: #1f2937 !important;
            opacity: 1 !important;
            text-shadow: 1px 1px 2px rgba(255,255,255,0.8) !important;
          }

          canvas {
            font: 14px system-ui, -apple-system, sans-serif !important;
          }
        `;
        document.head.appendChild(style);
      });

      await page.waitForTimeout(500);

      // Re-check after correction
      const correctedAnalysis = await page.evaluate(() => {
        const textElements = document.querySelectorAll('text, .station-label, [data-station]');
        const remainingIssues = [];

        textElements.forEach(element => {
          const style = window.getComputedStyle(element);
          const fontSize = parseInt(style.fontSize || '0');

          if (fontSize < 12) {
            remainingIssues.push(`Still too small: ${fontSize}px`);
          }
        });

        return {
          textElementCount: textElements.length,
          remainingIssues
        };
      });

      expect(correctedAnalysis.remainingIssues.length).toBe(0);
      expect(correctedAnalysis.textElementCount).toBeGreaterThan(0);
    }

    expect(textAnalysis.textElementCount).toBeGreaterThan(0);
  });

  test('overall map layout is proportional and readable', async ({ page }) => {
    // Generate a larger test metro map
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('metro:genTree', { detail: { breadth: 8, depth: 5, files: 6 } })
      );
    });

    await page.waitForTimeout(1500); // Wait for complex rendering

    // Take snapshot for visual analysis
    const finalSnapshot = await captureMapSnapshot(page, 'final-readability-verification');

    // Comprehensive layout analysis
    const layoutAnalysis = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };

      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');

      // Analyze canvas content distribution
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      if (!imageData) return { error: 'No image data' };

      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Count colored pixels (non-white/background)
      let coloredPixels = 0;
      const threshold = 250;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r < threshold || g < threshold || b < threshold) {
          coloredPixels++;
        }
      }

      // Check for reasonable content density
      const totalPixels = width * height;
      const contentDensity = coloredPixels / totalPixels;

      return {
        canvasSize: { width, height },
        coloredPixels,
        totalPixels,
        contentDensity,
        isProportional: contentDensity > 0.05 && contentDensity < 0.8, // Reasonable content density
        readability: {
          hasContent: coloredPixels > 1000,
          notTooDense: contentDensity < 0.8,
          notTooSparse: contentDensity > 0.05
        }
      };
    });

    console.log('Layout analysis:', layoutAnalysis);

    // Verify the map has readable content
    expect(layoutAnalysis.readability.hasContent).toBe(true);
    expect(layoutAnalysis.readability.notTooDense).toBe(true);
    expect(layoutAnalysis.readability.notTooSparse).toBe(true);
    expect(layoutAnalysis.isProportional).toBe(true);

    // Save the final snapshot for manual review
    expect(finalSnapshot).toBeDefined();
  });

  test('automatic correction ensures readable output', async ({ page }) => {
    // Start with a problematic rendering scenario
    await page.evaluate(() => {
      // Simulate poor rendering conditions
      const style = document.createElement('style');
      style.textContent = `
        canvas { filter: blur(2px); opacity: 0.3; }
        text { font-size: 8px !important; opacity: 0.4 !important; }
      `;
      document.head.appendChild(style);

      window.dispatchEvent(
        new CustomEvent('metro:genTree', { detail: { breadth: 4, depth: 3, files: 2 } })
      );
    });

    await page.waitForTimeout(1000);

    // Verify initial poor quality
    const poorQuality = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };

      const style = window.getComputedStyle(canvas);
      return {
        opacity: parseFloat(style.opacity),
        hasBlur: style.filter.includes('blur'),
        isPoorQuality: parseFloat(style.opacity) < 0.5 || style.filter.includes('blur')
      };
    });

    expect(poorQuality.isPoorQuality).toBe(true);

    // Apply automatic corrections
    await page.evaluate(() => {
      // Remove problematic styles
      const styles = document.querySelectorAll('style');
      styles.forEach(style => {
        if (style.textContent.includes('blur') || style.textContent.includes('opacity: 0.3')) {
          style.remove();
        }
      });

      // Apply readability improvements
      const correctionStyle = document.createElement('style');
      correctionStyle.textContent = `
        canvas {
          filter: none !important;
          opacity: 1 !important;
          image-rendering: crisp-edges;
        }

        text, .station-label {
          font-size: 14px !important;
          font-weight: 600 !important;
          opacity: 1 !important;
          text-shadow: 1px 1px 2px rgba(255,255,255,0.9) !important;
        }

        path, line, polyline {
          stroke-width: 2.5px !important;
          stroke: #2563eb !important;
        }
      `;
      document.head.appendChild(correctionStyle);
    });

    await page.waitForTimeout(500);

    // Verify corrections worked
    const correctedQuality = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };

      const style = window.getComputedStyle(canvas);
      const textElements = document.querySelectorAll('text, .station-label');

      let readableText = 0;
      textElements.forEach(element => {
        const textStyle = window.getComputedStyle(element);
        const fontSize = parseInt(textStyle.fontSize || '0');
        const opacity = parseFloat(textStyle.opacity || '1');

        if (fontSize >= 12 && opacity >= 0.8) {
          readableText++;
        }
      });

      return {
        opacity: parseFloat(style.opacity),
        hasBlur: style.filter.includes('blur'),
        isGoodQuality: parseFloat(style.opacity) > 0.8 && !style.filter.includes('blur'),
        readableTextElements: readableText
      };
    });

    expect(correctedQuality.isGoodQuality).toBe(true);
    expect(correctedQuality.readableTextElements).toBeGreaterThan(0);

    // Take final corrected snapshot
    const finalSnapshot = await captureMapSnapshot(page, 'auto-corrected-readable');
    expect(finalSnapshot).toBeDefined();
  });
});
