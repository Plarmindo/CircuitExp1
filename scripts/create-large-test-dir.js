/**
 * Script to create large test directories for performance testing
 * Usage: node scripts/create-large-test-dir.js --size <number> --depth <number>
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Parse command line arguments
const args = process.argv.slice(2);
const sizeArg = args.indexOf('--size');
const depthArg = args.indexOf('--depth');
const nameArg = args.indexOf('--name');

const totalNodes = sizeArg !== -1 ? parseInt(args[sizeArg + 1], 10) : 10000;
const maxDepth = depthArg !== -1 ? parseInt(args[depthArg + 1], 10) : 5;
const dirName = nameArg !== -1 ? args[nameArg + 1] : `perf-test-${totalNodes}-nodes`;

const testDir = path.join(os.tmpdir(), dirName);

console.log('🚀 Performance Test Directory Generator');
console.log('=====================================');
console.log(`Target nodes: ${totalNodes.toLocaleString()}`);
console.log(`Max depth: ${maxDepth}`);
console.log(`Output directory: ${testDir}`);
console.log('');

/**
 * Create a balanced directory tree
 */
async function createDirectoryTree(basePath, remainingNodes, currentDepth) {
  if (remainingNodes <= 0 || currentDepth >= maxDepth) {
    return 0;
  }

  let nodesCreated = 0;

  // Create directory
  await fs.mkdir(basePath, { recursive: true });
  nodesCreated++;

  // Calculate how many files and subdirectories to create at this level
  const filesPerDir = Math.min(20, Math.floor(remainingNodes / 5));
  const subdirsPerDir = currentDepth < maxDepth - 1 ? Math.min(5, Math.floor(remainingNodes / 100)) : 0;

  // Create files
  for (let i = 0; i < filesPerDir && nodesCreated < remainingNodes; i++) {
    const filePath = path.join(basePath, `file-${i}-${Date.now()}.txt`);
    await fs.writeFile(filePath, `Test file ${i}\nCreated: ${new Date().toISOString()}\nDepth: ${currentDepth}\n`);
    nodesCreated++;

    // Progress indicator
    if (nodesCreated % 1000 === 0) {
      process.stdout.write(`\r📝 Created ${nodesCreated.toLocaleString()} nodes...`);
    }
  }

  // Create subdirectories recursively
  if (subdirsPerDir > 0) {
    const nodesPerSubdir = Math.floor((remainingNodes - nodesCreated) / subdirsPerDir);
    
    for (let i = 0; i < subdirsPerDir && nodesCreated < remainingNodes; i++) {
      const subdirPath = path.join(basePath, `subdir-${currentDepth}-${i}`);
      const created = await createDirectoryTree(
        subdirPath,
        Math.min(nodesPerSubdir, remainingNodes - nodesCreated),
        currentDepth + 1
      );
      nodesCreated += created;
    }
  }

  return nodesCreated;
}

/**
 * Create a flat directory with many files (stress test)
 */
async function createFlatDirectory(basePath, fileCount) {
  await fs.mkdir(basePath, { recursive: true });
  
  console.log(`\n📂 Creating flat directory with ${fileCount.toLocaleString()} files...`);
  
  let created = 1; // Count the directory itself
  
  for (let i = 0; i < fileCount; i++) {
    const filePath = path.join(basePath, `file-${String(i).padStart(8, '0')}.txt`);
    await fs.writeFile(filePath, `File ${i}\n`);
    created++;
    
    if (created % 1000 === 0) {
      process.stdout.write(`\r📝 Created ${created.toLocaleString()} nodes...`);
    }
  }
  
  return created;
}

/**
 * Create a deep directory structure (depth stress test)
 */
async function createDeepDirectory(basePath, depth) {
  let currentPath = basePath;
  let created = 0;
  
  console.log(`\n📊 Creating deep directory structure (${depth} levels)...`);
  
  for (let i = 0; i < depth; i++) {
    currentPath = path.join(currentPath, `level-${i}`);
    await fs.mkdir(currentPath, { recursive: true });
    created++;
    
    // Add a few files at each level
    for (let j = 0; j < 3; j++) {
      const filePath = path.join(currentPath, `file-${j}.txt`);
      await fs.writeFile(filePath, `Level ${i}, File ${j}\n`);
      created++;
    }
    
    if (i % 10 === 0) {
      process.stdout.write(`\r📝 Created ${i} levels (${created} nodes)...`);
    }
  }
  
  return created;
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  
  try {
    // Clean up existing directory if it exists
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up existing test directory');
    } catch {
      // Directory doesn't exist, continue
    }
    
    console.log('\n⏳ Generating test structure...\n');
    
    // Create main balanced tree
    const balancedNodes = await createDirectoryTree(
      path.join(testDir, 'balanced'),
      Math.floor(totalNodes * 0.7),
      0
    );
    
    console.log(`\n✅ Balanced tree: ${balancedNodes.toLocaleString()} nodes`);
    
    // Create flat directory (stress test)
    const flatNodes = await createFlatDirectory(
      path.join(testDir, 'flat'),
      Math.floor(totalNodes * 0.2)
    );
    
    console.log(`\n✅ Flat directory: ${flatNodes.toLocaleString()} nodes`);
    
    // Create deep directory (depth test)
    const deepNodes = await createDeepDirectory(
      path.join(testDir, 'deep'),
      Math.min(50, maxDepth * 2)
    );
    
    console.log(`\n✅ Deep directory: ${deepNodes.toLocaleString()} nodes`);
    
    const totalCreated = balancedNodes + flatNodes + deepNodes;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n');
    console.log('✨ Generation Complete!');
    console.log('======================');
    console.log(`Total nodes created: ${totalCreated.toLocaleString()}`);
    console.log(`Time taken: ${duration}s`);
    console.log(`Average rate: ${Math.floor(totalCreated / parseFloat(duration)).toLocaleString()} nodes/sec`);
    console.log('');
    console.log('📁 Test Directory Structure:');
    console.log(`   ${testDir}`);
    console.log(`   ├── balanced/ (${balancedNodes.toLocaleString()} nodes, depth ${maxDepth})`);
    console.log(`   ├── flat/ (${flatNodes.toLocaleString()} nodes, single level)`);
    console.log(`   └── deep/ (${deepNodes.toLocaleString()} nodes, ~50 levels deep)`);
    console.log('');
    console.log('🚀 Ready for performance testing!');
    console.log(`   Use this path in the app: ${testDir}`);
    
    // Create info file
    const infoPath = path.join(testDir, 'TEST_INFO.json');
    await fs.writeFile(infoPath, JSON.stringify({
      created: new Date().toISOString(),
      totalNodes: totalCreated,
      targetNodes: totalNodes,
      maxDepth,
      duration: `${duration}s`,
      structure: {
        balanced: { nodes: balancedNodes, depth: maxDepth },
        flat: { nodes: flatNodes, depth: 1 },
        deep: { nodes: deepNodes, depth: 50 }
      }
    }, null, 2));
    
    console.log(`📄 Test info saved to: ${infoPath}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
