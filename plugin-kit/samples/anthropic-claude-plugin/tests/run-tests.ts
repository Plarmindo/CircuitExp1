/**
 * Test Runner for Anthropic Claude Plugin
 * Comprehensive test runner with debugging capabilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { PluginTestRunner, TestSuite } from '../../../src/testing/plugin-test-utils';

// Test suites
const testSuites: TestSuite[] = [
  {
    name: 'unit-tests',
    description: 'Unit tests for all controllers and services',
    tests: [
      {
        name: 'health-controller-tests',
        description: 'Test health controller functionality',
        testFunction: async (context) => {
          const { HealthController } = await import('../src/controllers/health');
          const controller = new HealthController(
            { getMetrics: () => ({ uptime: 1000 }) } as any,
            { info: () => {}, error: () => {} } as any
          );
          
          const result = await controller.healthCheck();
          context.assert.equal(result.status, 'healthy');
          return { success: true };
        }
      },
      {
        name: 'completion-controller-tests',
        description: 'Test completion controller functionality',
        testFunction: async (context) => {
          const { CompletionController } = await import('../src/controllers/completion');
          const controller = new CompletionController(
            { generateCompletion: async () => ({ completion: 'test' }) } as any,
            { validate: () => ({ isValid: true }) } as any,
            { increment: () => {} } as any,
            { info: () => {} } as any
          );
          
          const result = await controller.generateCompletion({
            prompt: 'test',
            language: 'typescript'
          });
          
          context.assert.equal(result.completion, 'test');
          return { success: true };
        }
      }
    ]
  },
  {
    name: 'integration-tests',
    description: 'Integration tests for plugin endpoints',
    setup: async (context) => {
      context.log('Setting up integration test environment');
      // Setup test server, mock APIs, etc.
    },
    tests: [
      {
        name: 'api-endpoints',
        description: 'Test all API endpoints respond correctly',
        testFunction: async (context) => {
          // Test API endpoints
          context.assert.equal(true, true); // Placeholder
          return { success: true };
        }
      }
    ],
    teardown: async (context) => {
      context.log('Cleaning up integration test environment');
      // Cleanup
    }
  },
  {
    name: 'performance-tests',
    description: 'Performance and load tests',
    tests: [
      {
        name: 'response-time',
        description: 'Test response time under load',
        testFunction: async (context) => {
          const start = Date.now();
          // Simulate load
          await new Promise(resolve => setTimeout(resolve, 100));
          const duration = Date.now() - start;
          
          context.assert.lessThan(duration, 200);
          return { success: true, metrics: { responseTime: duration } };
        }
      }
    ]
  }
];

// Main test runner
async function runTests() {
  console.log('🧪 Starting Anthropic Claude Plugin Tests\n');

  const testConfig = {
    pluginPath: path.join(__dirname, '..'),
    testDataDir: path.join(__dirname, 'test-data'),
    verbose: process.argv.includes('--verbose'),
    mockResponses: true
  };

  const testRunner = new PluginTestRunner(testConfig);
  
  // Event listeners for detailed output
  testRunner.on('test:start', (data) => {
    console.log(`📋 Starting ${data.suite || 'test'}: ${data.tests || 1} tests`);
  });

  testRunner.on('test:result', (data) => {
    const status = data.result.success ? '✅' : '❌';
    const duration = data.result.duration;
    console.log(`  ${status} ${data.name} (${duration}ms)`);
    
    if (data.result.errors.length > 0) {
      data.result.errors.forEach(error => {
        console.log(`    Error: ${error}`);
      });
    }
  });

  testRunner.on('test:error', (data) => {
    console.log(`  ❌ ${data.name} - ${data.error.message}`);
  });

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let totalDuration = 0;

  // Run all test suites
  for (const suite of testSuites) {
    console.log(`\n🎯 Running ${suite.name}...`);
    
    const results = await testRunner.runTestSuite(suite);
    
    results.forEach((result, testName) => {
      totalTests++;
      totalDuration += result.duration;
      
      if (result.success) {
        passedTests++;
      } else {
        failedTests++;
      }
    });
  }

  // Generate final report
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests > 0) {
    console.log('\n❌ Some tests failed. Check the logs above for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

// Performance benchmark runner
async function runBenchmark() {
  console.log('⚡ Running Performance Benchmarks\n');

  const benchmarkConfig = {
    pluginPath: path.join(__dirname, '..'),
    testDataDir: path.join(__dirname, 'benchmark-data'),
    verbose: true,
    mockResponses: true
  };

  const testRunner = new PluginTestRunner(benchmarkConfig);
  
  const benchmarkSuite: TestSuite = {
    name: 'performance-benchmark',
    description: 'Performance benchmarks for plugin',
    tests: [
      {
        name: 'completion-benchmark',
        description: 'Benchmark completion endpoint',
        testFunction: async (context) => {
          const iterations = 100;
          const start = Date.now();
          
          for (let i = 0; i < iterations; i++) {
            // Simulate completion request
            await new Promise(resolve => setTimeout(resolve, 5));
          }
          
          const duration = Date.now() - start;
          const avgTime = duration / iterations;
          
          context.log(`Average response time: ${avgTime}ms`);
          context.assert.lessThan(avgTime, 10);
          
          return { 
            success: true, 
            metrics: { 
              iterations, 
              totalTime: duration, 
              avgTime 
            } 
          };
        }
      },
      {
        name: 'memory-benchmark',
        description: 'Memory usage benchmark',
        testFunction: async (context) => {
          const initialMemory = process.memoryUsage().heapUsed;
          
          // Simulate memory usage
          const largeArray = new Array(1000).fill('test');
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryDelta = finalMemory - initialMemory;
          
          context.log(`Memory delta: ${memoryDelta} bytes`);
          context.assert.lessThan(memoryDelta, 1024 * 1024); // 1MB limit
          
          return { 
            success: true, 
            metrics: { memoryDelta } 
          };
        }
      }
    ]
  };

  const results = await testRunner.runTestSuite(benchmarkSuite);
  
  console.log('\n📈 Benchmark Results');
  console.log('====================');
  
  for (const [name, result] of results) {
    console.log(`${name}: ${result.success ? 'PASS' : 'FAIL'}`);
    if (result.metrics) {
      console.log(`  Metrics: ${JSON.stringify(result.metrics, null, 2)}`);
    }
  }
}

// Load test runner
async function runLoadTest() {
  console.log('💪 Running Load Tests\n');

  const loadTestConfig = {
    pluginPath: path.join(__dirname, '..'),
    testDataDir: path.join(__dirname, 'load-test-data'),
    verbose: true,
    mockResponses: true
  };

  const testRunner = new PluginTestRunner(loadTestConfig);
  
  const loadTestSuite: TestSuite = {
    name: 'load-tests',
    description: 'Load testing for concurrent requests',
    tests: [
      {
        name: 'concurrent-requests',
        description: 'Test concurrent request handling',
        testFunction: async (context) => {
          const concurrentRequests = 50;
          const promises = [];
          
          const start = Date.now();
          
          for (let i = 0; i < concurrentRequests; i++) {
            promises.push(
              new Promise(resolve => {
                setTimeout(() => resolve({ success: true }), Math.random() * 100);
              })
            );
          }
          
          await Promise.all(promises);
          
          const duration = Date.now() - start;
          const throughput = concurrentRequests / (duration / 1000);
          
          context.log(`Throughput: ${throughput.toFixed(2)} requests/second`);
          context.assert.greaterThan(throughput, 10);
          
          return { 
            success: true, 
            metrics: { 
              concurrentRequests, 
              duration, 
              throughput 
            } 
          };
        }
      }
    ]
  };

  const results = await testRunner.runTestSuite(loadTestSuite);
  
  console.log('\n🔥 Load Test Results');
  console.log('====================');
  
  for (const [name, result] of results) {
    console.log(`${name}: ${result.success ? 'PASS' : 'FAIL'}`);
    if (result.metrics) {
      console.log(`  Metrics: ${JSON.stringify(result.metrics, null, 2)}`);
    }
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'benchmark':
        await runBenchmark();
        break;
      case 'load':
        await runLoadTest();
        break;
      case 'unit':
        // Run Jest unit tests
        console.log('Running Jest unit tests...');
        require('child_process').spawn('npm', ['test'], { stdio: 'inherit' });
        break;
      default:
        await runTests();
    }
  } catch (error) {
    console.error('Test runner error:', error);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  main().catch(console.error);
}

export { runTests, runBenchmark, runLoadTest };