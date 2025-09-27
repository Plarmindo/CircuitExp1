import { test, expect } from './fixtures';

test('HTML5 compatibility in Electron @electron', async ({ page }) => {
  // Test HTML5 Canvas support in Electron
  const canvasSupport = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    return {
      supported: !!context,
      contextType: context ? context.constructor.name : null,
      html5Support: window.HTML5_SUPPORT || {}
    };
  });
  
  expect(canvasSupport.supported).toBe(true);
  expect(canvasSupport.contextType).toBe('CanvasRenderingContext2D');
});

test('HTML5 WebGL support in Electron @electron', async ({ page }) => {
  // Test WebGL support in Electron
  const webglSupport = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return {
      supported: !!gl,
      contextType: gl ? gl.constructor.name : null,
      vendor: gl ? gl.getParameter(gl.VENDOR) : null,
      renderer: gl ? gl.getParameter(gl.RENDERER) : null
    };
  });
  
  expect(webglSupport.supported).toBe(true);
  expect(webglSupport.contextType).toBe('WebGLRenderingContext');
});

test('HTML5 SVG support in Electron @electron', async ({ page }) => {
  // Test SVG support in Electron
  const svgSupport = await page.evaluate(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '100');
    svg.appendChild(rect);
    
    return {
      supported: !!svg.createSVGRect,
      elementCount: svg.children.length,
      namespaceSupported: !!rect.namespaceURI
    };
  });
  
  expect(svgSupport.supported).toBe(true);
  expect(svgSupport.elementCount).toBe(1);
  expect(svgSupport.namespaceSupported).toBe(true);
});

test('HTML5 Local Storage in Electron @electron', async ({ page }) => {
  // Test Local Storage support in Electron
  const storageSupport = await page.evaluate(() => {
    try {
      const testKey = 'html5_test_key';
      const testValue = 'html5_test_value';
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      return {
        supported: retrieved === testValue,
        available: !!window.localStorage,
        testPassed: retrieved === testValue
      };
    } catch (e) {
      return { supported: false, available: false, testPassed: false, error: e.message };
    }
  });
  
  expect(storageSupport.supported).toBe(true);
  expect(storageSupport.available).toBe(true);
  expect(storageSupport.testPassed).toBe(true);
});

test('Consistent HTML5 support across environments @electron', async ({ page }) => {
    // Skip this test in web browsers - it's Electron-specific
    const isElectron = await page.evaluate(() => typeof (window as any).electronAPI !== 'undefined');
    if (!isElectron) {
      test.skip();
      return;
    }
    
    // Wait for electronAPI to be available in Electron environment
    await page.waitForFunction(() => typeof (window as any).electronAPI !== 'undefined', { timeout: 10000 });
  
  // Test that HTML5 features are consistently available in Electron
  const consistencyCheck = await page.evaluate(() => {
    const features = {
      canvas: !!document.createElement('canvas').getContext('2d'),
      webgl: !!(document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl')),
      svg: !!document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect,
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage
    };
    
    const allSupported = Object.values(features).every(supported => supported === true);
    
    return {
      features,
      allSupported,
      environment: navigator.userAgent,
      timestamp: new Date().toISOString(),
      electronSpecific: !!window.electronAPI
    };
  });
  
  expect(consistencyCheck.allSupported).toBe(true);
  expect(Object.values(consistencyCheck.features).every(f => f === true)).toBe(true);
  expect(consistencyCheck.electronSpecific).toBe(true);
});