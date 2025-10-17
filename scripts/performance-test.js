/**
 * Performance Testing Script
 * Measures scan performance with various directory sizes
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

console.log('🔬 Performance Testing Suite');
console.log('===========================\n');

// Test configurations
const testSizes = [
  { name: 'Small', size: 100, expectedTime: 1000 }, // <1s
  { name: 'Medium', size: 10000, expectedTime: 10000 }, // <10s
  { name: 'Large', size: 100000, expectedTime: 120000 }, // <2min
];

const results = [];

/**
 * Get directory statistics
 */
async function getDirectoryStats(dirPath) {
  let fileCount = 0;
  let dirCount = 0;
  let totalSize = 0;
  let maxDepth = 0;

  async function walk(currentPath, depth = 0) {
    maxDepth = Math.max(maxDepth, depth);
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        dirCount++;
        await walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        fileCount++;
        try {
          const stat = await fs.stat(fullPath);
          totalSize += stat.size;
        } catch {
          // Ignore stat errors
        }
      }
    }
  }

  await walk(dirPath);

  return {
    files: fileCount,
    directories: dirCount,
    totalNodes: fileCount + dirCount,
    totalSize,
    maxDepth,
  };
}

/**
 * Simulate scan performance test
 */
async function testScanPerformance(testDir, expectedTime) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Get directory stats (simulates scanning)
  const stats = await getDirectoryStats(testDir);

  const duration = Date.now() - startTime;
  const endMemory = process.memoryUsage();

  const memoryDelta = {
    heapUsed: endMemory.heapUsed - startMemory.heapUsed,
    heapTotal: endMemory.heapTotal - startMemory.heapTotal,
    external: endMemory.external - startMemory.external,
    rss: endMemory.rss - startMemory.rss,
  };

  const passed = duration <= expectedTime;

  return {
    ...stats,
    duration,
    expectedTime,
    passed,
    memory: {
      start: startMemory,
      end: endMemory,
      delta: memoryDelta,
    },
    performance: {
      nodesPerSecond: Math.floor((stats.totalNodes / duration) * 1000),
      mbPerSecond: ((stats.totalSize / 1024 / 1024) / (duration / 1000)).toFixed(2),
    },
  };
}

/**
 * Format memory size
 */
function formatMemory(bytes) {
  const mb = bytes / 1024 / 1024;
  if (mb > 1000) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

/**
 * Format duration
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${(ms / 60000).toFixed(2)}min`;
}

/**
 * Print test result
 */
function printResult(testName, result) {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  
  console.log(`\n${testName} Test ${status}`);
  console.log('─'.repeat(50));
  console.log(`Files:           ${result.files.toLocaleString()}`);
  console.log(`Directories:     ${result.directories.toLocaleString()}`);
  console.log(`Total Nodes:     ${result.totalNodes.toLocaleString()}`);
  console.log(`Max Depth:       ${result.maxDepth}`);
  console.log(`Total Size:      ${formatMemory(result.totalSize)}`);
  console.log('');
  console.log(`Duration:        ${formatDuration(result.duration)}`);
  console.log(`Expected:        ${formatDuration(result.expectedTime)}`);
  console.log(`Performance:     ${result.performance.nodesPerSecond.toLocaleString()} nodes/sec`);
  console.log(`Throughput:      ${result.performance.mbPerSecond} MB/sec`);
  console.log('');
  console.log('Memory Usage:');
  console.log(`  Heap Used:     ${formatMemory(result.memory.delta.heapUsed)} (${result.memory.delta.heapUsed > 0 ? '+' : ''}${formatMemory(result.memory.delta.heapUsed)})`);
  console.log(`  Heap Total:    ${formatMemory(result.memory.end.heapTotal)}`);
  console.log(`  RSS:           ${formatMemory(result.memory.end.rss)}`);
}

/**
 * Main test execution
 */
async function main() {
  console.log('Starting performance benchmarks...\n');
  console.log('NOTE: This script measures Node.js file system performance.');
  console.log('For full Electron IPC performance, use the app UI.\n');

  // Check if test directories exist
  const baseTestDir = path.join(os.tmpdir(), 'circuit-exp-perf-tests');
  
  try {
    await fs.access(baseTestDir);
  } catch {
    console.log('⚠️  Test directories not found.');
    console.log('Creating test directories...\n');
    
    // Create test directories
    for (const test of testSizes) {
      console.log(`Creating ${test.name} test directory (${test.size.toLocaleString()} nodes)...`);
      
      const testDir = path.join(baseTestDir, test.name.toLowerCase());
      await fs.mkdir(testDir, { recursive: true });
      
      // Create files
      const filesToCreate = Math.floor(test.size * 0.8);
      const dirsToCreate = Math.floor(test.size * 0.2);
      
      for (let i = 0; i < filesToCreate; i++) {
        const filePath = path.join(testDir, `file-${i}.txt`);
        await fs.writeFile(filePath, `Test file ${i}\n`);
        
        if ((i + 1) % 1000 === 0) {
          process.stdout.write(`\r  Created ${(i + 1).toLocaleString()} files...`);
        }
      }
      
      console.log(`\r  Created ${filesToCreate.toLocaleString()} files`);
      
      for (let i = 0; i < dirsToCreate; i++) {
        const dirPath = path.join(testDir, `subdir-${i}`);
        await fs.mkdir(dirPath, { recursive: true });
        
        // Add a few files to each subdir
        for (let j = 0; j < 3; j++) {
          const filePath = path.join(dirPath, `file-${j}.txt`);
          await fs.writeFile(filePath, `Test file ${j}\n`);
        }
      }
      
      console.log(`  Created ${dirsToCreate.toLocaleString()} directories\n`);
    }
  }

  // Run tests
  for (const test of testSizes) {
    const testDir = path.join(baseTestDir, test.name.toLowerCase());
    
    console.log(`\n🏃 Running ${test.name} test...`);
    
    try {
      const result = await testScanPerformance(testDir, test.expectedTime);
      results.push({
        name: test.name,
        ...result,
      });
      
      printResult(test.name, result);
    } catch (error) {
      console.error(`❌ ${test.name} test failed:`, error.message);
      results.push({
        name: test.name,
        error: error.message,
        passed: false,
      });
    }
  }

  // Print summary
  console.log('\n');
  console.log('=' .repeat(50));
  console.log('PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\nTests Passed: ${passed}/${total}`);
  console.log('');
  
  results.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.name}: ERROR - ${result.error}`);
    } else {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${formatDuration(result.duration)} (${result.performance.nodesPerSecond.toLocaleString()} nodes/sec)`);
    }
  });
  
  console.log('');
  
  // Save results
  const reportPath = path.join(process.cwd(), 'performance-report.json');
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total,
      passed,
      failed: total - passed,
    },
  }, null, 2));
  
  console.log(`📊 Full report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(passed === total ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
