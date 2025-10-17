const { _electron: electron } = require('playwright');

(async () => {
  console.log('Starting Electron app...');
  const app = await electron.launch({
    args: ['electron-main.cjs'],
    env: { ...process.env, DEV_FORCE_URL: '1' }
  });

  const window = await app.firstWindow();
  console.log('Waiting for app to load...');
  
  // Wait for the page to load
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(3000); // Give time for initialization
  
  console.log('App loaded. Looking for synthetic tree button...');
  
  // Set up console listener BEFORE clicking
  const consoleMessages = [];
  window.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    // Log all messages to see what's happening
    console.log('[BROWSER]', text);
  });
  
  // Try to find the synthetic tree button by title
  const treeButtons = await window.locator('button').all();
  let foundButton = false;
  
  for (const btn of treeButtons) {
    const title = await btn.getAttribute('title');
    const ariaLabel = await btn.getAttribute('aria-label');
    const text = await btn.textContent();
    
    if (title?.includes('Synthetic') || ariaLabel?.includes('Synthetic') || text?.includes('🌱')) {
      console.log('Found synthetic tree button!');
      console.log('  Title:', title);
      console.log('  Aria-label:', ariaLabel);
      console.log('  Text:', text);
      foundButton = true;
      
      await btn.click();
      console.log('Clicked synthetic tree button, waiting for generation...');
      await window.waitForTimeout(3000);
      break;
    }
  }
  
  if (!foundButton) {
    console.log('Synthetic tree button not found. Available buttons:');
    for (const btn of treeButtons.slice(0, 15)) {
      const title = await btn.getAttribute('title');
      const text = await btn.textContent();
      console.log(`  - Title: "${title}", Text: "${text}"`);
    }
  }
  
  // Check for canvas
  const stageContainer = window.locator('.stage-container');
  const box = await stageContainer.boundingBox();
  console.log('\nStage container dimensions:', box);
  
  // Check layout nodes in console
  console.log('\nChecking console messages for layout generation...');
  const layoutMessages = consoleMessages.filter(m => 
    m.includes('Generating layout') || m.includes('Generated') || m.includes('Rendering with layout')
  );
  console.log('Layout-related messages:', layoutMessages);
  
  // Check if any canvas exists
  const canvases = await window.locator('canvas').all();
  console.log(`\nFound ${canvases.length} canvas element(s)`);
  for (let i = 0; i < canvases.length; i++) {
    const canvasBox = await canvases[i].boundingBox();
    console.log(`  Canvas ${i}:`, canvasBox);
  }
  
  console.log('\nTaking screenshot...');
  await window.screenshot({ path: 'test-synthetic-tree.png', fullPage: true });
  
  console.log('\nDone! Check test-synthetic-tree.png');
  await window.waitForTimeout(1000);
  await app.close();
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
