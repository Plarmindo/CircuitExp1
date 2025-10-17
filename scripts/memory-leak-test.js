/**
 * Memory Leak Detection Script
 * Tests for memory leaks during multiple scan operations
 */

import fs from 'fs/promises';
import path from 'path';

console.log('🔍 Memory Leak Detection Suite');
console.log('==============================\n');

/**
 * Force garbage collection if available
 */
function forceGC() {
  if (global.gc) {
    global.gc();
  } else {
    console.warn('⚠️  Garbage collection not exposed. Run with: node --expose-gc');
  }
}

/**
 * Get memory snapshot
 */
function getMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
    timestamp: Date.now(),
  };
}

/**
 * Format memory
 */
function formatMemory(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Simulate directory scan
 */
async function scanDirectory(dirPath) {
  const results = [];
  
  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      results.push({
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        name: entry.name,
      });
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }
  
  await walk(dirPath);
  return results;
}

/**
 * Run memory leak test
 */
async function testMemoryLeak(testDir, iterations = 10) {
  console.log(`Test Directory: ${testDir}`);
  console.log(`Iterations: ${iterations}\n`);
  
  const snapshots = [];
  
  // Baseline measurement
  forceGC();
  await new Promise(resolve => setTimeout(resolve, 100));
  const baseline = getMemorySnapshot();
  snapshots.push({ iteration: 0, ...baseline, label: 'Baseline' });
  
  console.log(`Baseline memory: ${formatMemory(baseline.heapUsed)}\n`);
  
  // Run iterations
  for (let i = 1; i <= iterations; i++) {
    console.log(`Iteration ${i}/${iterations}...`);
    
    // Perform scan
    const startTime = Date.now();
    const results = await scanDirectory(testDir);
    const duration = Date.now() - startTime;
    
    console.log(`  Scanned ${results.length.toLocaleString()} nodes in ${duration}ms`);
    
    // Clear results (simulate cleanup)
    results.length = 0;
    
    // Force GC
    forceGC();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Take snapshot
    const snapshot = getMemorySnapshot();
    snapshots.push({ 
      iteration: i, 
      ...snapshot,
      duration,
      nodeCount: results.length,
    });
    
    const heapGrowth = snapshot.heapUsed - baseline.heapUsed;
    const growthPercent = ((heapGrowth / baseline.heapUsed) * 100).toFixed(2);
    
    console.log(`  Heap used: ${formatMemory(snapshot.heapUsed)} (${heapGrowth > 0 ? '+' : ''}${formatMemory(heapGrowth)}, ${growthPercent}%)\n`);
  }
  
  return { snapshots, baseline };
}

/**
 * Analyze results
 */
function analyzeResults(snapshots, baseline) {
  console.log('\n' + '='.repeat(60));
  console.log('MEMORY LEAK ANALYSIS');
  console.log('='.repeat(60) + '\n');
  
  // Calculate memory growth
  const final = snapshots[snapshots.length - 1];
  const totalGrowth = final.heapUsed - baseline.heapUsed;
  const growthPercent = ((totalGrowth / baseline.heapUsed) * 100).toFixed(2);
  
  console.log('Overall Statistics:');
  console.log(`  Baseline:        ${formatMemory(baseline.heapUsed)}`);
  console.log(`  Final:           ${formatMemory(final.heapUsed)}`);
  console.log(`  Total Growth:    ${totalGrowth > 0 ? '+' : ''}${formatMemory(totalGrowth)} (${growthPercent}%)`);
  console.log('');
  
  // Calculate average growth per iteration
  const iterations = snapshots.length - 1;
  const avgGrowthPerIteration = totalGrowth / iterations;
  
  console.log(`  Iterations:      ${iterations}`);
  console.log(`  Avg Growth/Iter: ${formatMemory(avgGrowthPerIteration)}`);
  console.log('');
  
  // Check for memory leak
  const leakThreshold = baseline.heapUsed * 0.5; // 50% growth is suspicious
  const hasLeak = totalGrowth > leakThreshold;
  
  if (hasLeak) {
    console.log('❌ MEMORY LEAK DETECTED!');
    console.log(`   Memory grew by ${growthPercent}% (threshold: 50%)`);
  } else {
    console.log('✅ NO MEMORY LEAK DETECTED');
    console.log(`   Memory growth is within acceptable range (${growthPercent}% < 50%)`);
  }
  console.log('');
  
  // Memory trend analysis
  console.log('Memory Trend:');
  const firstHalf = snapshots.slice(1, Math.floor(snapshots.length / 2) + 1);
  const secondHalf = snapshots.slice(Math.floor(snapshots.length / 2) + 1);
  
  const firstHalfAvg = firstHalf.reduce((sum, s) => sum + s.heapUsed, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, s) => sum + s.heapUsed, 0) / secondHalf.length;
  
  const trend = secondHalfAvg - firstHalfAvg;
  const trendPercent = ((trend / firstHalfAvg) * 100).toFixed(2);
  
  console.log(`  First half avg:  ${formatMemory(firstHalfAvg)}`);
  console.log(`  Second half avg: ${formatMemory(secondHalfAvg)}`);
  console.log(`  Trend:           ${trend > 0 ? '+' : ''}${formatMemory(trend)} (${trendPercent}%)`);
  console.log('');
  
  if (Math.abs(trend) < baseline.heapUsed * 0.1) {
    console.log('✅ Memory usage is stable across iterations');
  } else {
    console.log('⚠️  Memory usage shows increasing trend');
  }
  
  return {
    hasLeak,
    totalGrowth,
    growthPercent: parseFloat(growthPercent),
    avgGrowthPerIteration,
    trend,
    trendPercent: parseFloat(trendPercent),
  };
}

/**
 * Main execution
 */
async function main() {
  // Check for test directory
  const args = process.argv.slice(2);
  const dirArg = args.indexOf('--dir');
  const iterArg = args.indexOf('--iterations');
  
  const testDir = dirArg !== -1 ? args[dirArg + 1] : 
    path.join(process.env.TEMP || process.env.TMP || '/tmp', 'circuit-perf-100k', 'balanced');
  const iterations = iterArg !== -1 ? parseInt(args[iterArg + 1], 10) : 10;
  
  try {
    await fs.access(testDir);
  } catch {
    console.error('❌ Test directory not found:', testDir);
    console.error('\nPlease run: node scripts/create-large-test-dir.js');
    process.exit(1);
  }
  
  console.log('Starting memory leak detection...\n');
  
  if (!global.gc) {
    console.log('⚠️  Running without --expose-gc flag');
    console.log('    For more accurate results, run with: node --expose-gc\n');
  }
  
  // Run test
  const { snapshots, baseline } = await testMemoryLeak(testDir, iterations);
  
  // Analyze
  const analysis = analyzeResults(snapshots, baseline);
  
  // Save report
  const reportPath = path.join(process.cwd(), 'memory-leak-report.json');
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    testDir,
    iterations,
    baseline,
    snapshots,
    analysis,
  }, null, 2));
  
  console.log(`\n📊 Full report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(analysis.hasLeak ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
