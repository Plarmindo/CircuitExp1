// Test data generator for the metro map visualization
// This script will trigger the built-in test data generation

function generateTestData() {
  console.log('Generating test data for metro map...');

  // Trigger the genTree event to create synthetic test data
  const event = new CustomEvent('metro:genTree', {
    detail: {
      breadth: 4, // More branches for a fuller tree
      depth: 3, // Deeper tree structure
      files: 3, // Include files in the structure
    },
  });

  window.dispatchEvent(event);
  console.log('Test data generation triggered!');

  // Wait for completion
  window.addEventListener('metro:genTree:done', () => {
    console.log('Test data generation completed!');

    // Also trigger a layout update to ensure rendering
    setTimeout(() => {
      if (window.__metroDebug && window.__metroDebug.redraw) {
        console.log('Triggering redraw...');
        window.__metroDebug.redraw();
      }
    }, 500);
  });
}

// Auto-trigger test data generation when page loads
if (typeof window !== 'undefined') {
  setTimeout(generateTestData, 1000);
}
