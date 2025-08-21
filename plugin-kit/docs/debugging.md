# Plugin Development Kit - Debugging Guide

This guide covers debugging and testing utilities provided by the Plugin Development Kit.

## Overview

The Plugin Development Kit includes comprehensive debugging and testing utilities to help you develop, test, and debug your plugins effectively.

## Debugging CLI Tool

The debug CLI provides an interactive command-line interface for debugging and testing plugins.

### Installation

```bash
npm install -g @plugin-kit/cli
# or
npx @plugin-kit/cli debug
```

### Usage

Start the debug CLI:

```bash
# From plugin directory
npx pdk-debug

# Or specify plugin path
npx pdk-debug debug ./my-plugin
```

### Available Commands

#### `help`
Show available commands and usage examples.

```bash
pdk-debug> help
```

#### `test`
Run plugin tests with various options.

```bash
# Run all tests
pdk-debug> test ./my-plugin

# Run specific test suite
pdk-debug> test ./my-plugin --suite integration

# Run with verbose output
pdk-debug> test ./my-plugin --verbose
```

#### `debug`
Enable debug mode for a plugin with verbose logging.

```bash
pdk-debug> debug ./my-plugin --verbose
```

#### `profile`
Profile plugin performance for specific functions.

```bash
# Profile entire plugin
pdk-debug> profile ./my-plugin

# Profile specific function
pdk-debug> profile ./my-plugin --function analyze
```

#### `logs`
View debug logs with optional saving.

```bash
# View logs
pdk-debug> logs

# Save logs to file
pdk-debug> logs --save ./debug.log
```

#### `validate`
Validate plugin structure and configuration.

```bash
pdk-debug> validate ./my-plugin
```

#### `mock`
Setup mock responses for API testing.

```bash
# Setup mock
pdk-debug> mock setup --endpoint /api/completion --response ./mock.json

# List mocks
pdk-debug> mock list

# Clear all mocks
pdk-debug> mock clear
```

## Testing Framework

The testing framework provides utilities for writing comprehensive plugin tests.

### Test Structure

Create tests in your plugin's `tests/` directory:

```typescript
// tests/basic.test.ts
import { PluginTest, TestSuite } from '@plugin-kit/testing';

export const tests: TestSuite = {
  name: 'basic-functionality',
  description: 'Test basic plugin functionality',
  tests: [
    {
      name: 'plugin-loads-correctly',
      description: 'Verify plugin loads without errors',
      testFunction: async (context) => {
        const plugin = require('../src/index');
        context.assert.notEqual(plugin, null);
        return { success: true };
      }
    },
    {
      name: 'handles-invalid-input',
      description: 'Test error handling for invalid input',
      testFunction: async (context) => {
        const result = await somePluginFunction(null);
        context.assert.equal(result.success, false);
        return { success: true };
      }
    }
  ]
};
```

### Running Tests

#### Using Jest

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/completion.test.ts
```

#### Using Test Runner

```typescript
import { TestUtils } from '@plugin-kit/testing';

const testRunner = TestUtils.createTestRunner({
  pluginPath: './my-plugin',
  testDataDir: './my-plugin/test-data',
  verbose: true
});

const results = await testRunner.runTestSuite(testSuite);
console.log(testRunner.generateReport());
```

### Test Utilities

#### Mock Server

Create mock responses for external API calls:

```typescript
import { TestUtils } from '@plugin-kit/testing';

const mockServer = TestUtils.createMockServer();

// Add mock response
mockServer.addMock({
  endpoint: '/api/completion',
  method: 'POST',
  status: 200,
  data: { completion: 'mock response' },
  delay: 100
});

// Use in tests
const response = await mockServer.mockRequest('/api/completion', 'POST');
```

#### Performance Profiling

Profile plugin performance:

```typescript
import { TestUtils } from '@plugin-kit/testing';

const profiler = TestUtils.createProfiler();

// Profile a function
const endProfile = profiler.start('analyze-function');
await analyzeFunction(input);
endProfile();

// Get metrics
const metrics = profiler.getMetrics();
console.log(`Average time: ${metrics['analyze-function'].avg}ms`);
```

#### Data Helpers

Generate test data:

```typescript
const testData = context.data.generate('test-${i}', 10);
// Creates: ['test-0', 'test-1', ..., 'test-9']

// Load test data
const sample = context.data.load('sample-input.json');

// Save test results
context.data.save('test-results.json', results);
```

### Test Examples

#### Controller Tests

```typescript
// tests/controllers/completion.test.ts
describe('CompletionController', () => {
  let controller: CompletionController;
  let mockAiService: jest.Mocked<AIService>;

  beforeEach(() => {
    mockAiService = {
      generateCompletion: jest.fn()
    } as any;
    
    controller = new CompletionController(mockAiService);
  });

  it('should generate completion for valid input', async () => {
    const mockResponse = { completion: 'test code' };
    mockAiService.generateCompletion.mockResolvedValue(mockResponse);

    const result = await controller.generateCompletion({
      prompt: 'test prompt',
      language: 'typescript'
    });

    expect(result).toEqual(mockResponse);
  });
});
```

#### Integration Tests

```typescript
// tests/integration/plugin.test.ts
describe('Plugin Integration', () => {
  let plugin: any;

  beforeAll(async () => {
    plugin = await loadPlugin('./my-plugin');
  });

  it('should handle full workflow', async () => {
    const input = {
      code: 'const x = 5',
      language: 'javascript'
    };

    const result = await plugin.analyze(input);
    
    expect(result).toHaveProperty('analysis');
    expect(result).toHaveProperty('suggestions');
  });
});
```

### Test Configuration

#### Jest Configuration

The kit includes a pre-configured `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

#### Environment Setup

Create `tests/setup.ts` for global test configuration:

```typescript
// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock external dependencies
jest.mock('axios');
jest.mock('fs');
```

## Debugging Techniques

### Console Debugging

Use the built-in logger for structured debugging:

```typescript
import { LoggerService } from '@plugin-kit/services';

const logger = new LoggerService();

// Different log levels
logger.debug('Debug information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred', error);
```

### Breakpoint Debugging

Set breakpoints using the debug CLI:

```bash
pdk-debug> debug ./my-plugin
pdk-debug> breakpoint set ./src/index.ts:42
```

### Memory Profiling

Monitor memory usage:

```typescript
const profiler = TestUtils.createProfiler();

// Monitor memory before
const before = process.memoryUsage();

// Run plugin operation
await plugin.process(largeData);

// Monitor memory after
const after = process.memoryUsage();
console.log('Memory delta:', after.heapUsed - before.heapUsed);
```

### Network Debugging

Debug API calls:

```typescript
// Enable request logging
process.env.DEBUG = 'plugin:*';

// Mock network responses
const mockServer = TestUtils.createMockServer();
mockServer.addMock({
  endpoint: '/api/ai',
  method: 'POST',
  status: 200,
  data: { response: 'test' }
});
```

## Best Practices

### Test Organization

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete workflows
4. **Performance Tests**: Test under load

### Test Data Management

1. **Fixtures**: Store test data in `tests/fixtures/`
2. **Snapshots**: Use Jest snapshots for output validation
3. **Mock Data**: Generate realistic test data
4. **Cleanup**: Always clean up test artifacts

### Error Handling Tests

```typescript
it('should handle network errors gracefully', async () => {
  mockServer.addMock({
    endpoint: '/api/ai',
    method: 'POST',
    status: 500,
    data: { error: 'Server error' }
  });

  const result = await plugin.analyze('test code');
  expect(result.success).toBe(false);
  expect(result.error).toBe('Failed to connect to AI service');
});
```

### Performance Testing

```typescript
it('should complete analysis within timeout', async () => {
  const start = Date.now();
  await plugin.analyze(largeCodebase);
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(5000); // 5 second timeout
});
```

## Troubleshooting

### Common Issues

1. **Test Timeout**: Increase timeout in test configuration
2. **Mock Not Found**: Check mock endpoint and method
3. **Plugin Not Loading**: Validate plugin structure
4. **Memory Leaks**: Use memory profiling tools

### Debug Commands

```bash
# Check plugin structure
pdk-debug> validate ./my-plugin

# View detailed logs
pdk-debug> logs --verbose

# Profile specific function
pdk-debug> profile ./my-plugin --function analyze

# Run with coverage
npm run test:coverage
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Plugin
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

### Coverage Reports

Generate and view coverage reports:

```bash
npm run test:coverage
# Open coverage/lcov-report/index.html
```

This debugging guide provides comprehensive coverage of all debugging and testing utilities available in the Plugin Development Kit.