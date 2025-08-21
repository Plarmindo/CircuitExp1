/**
 * Global test setup for Plugin Kit
 */

import * as fs from 'fs';
import * as path from 'path';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.PLUGIN_TEST_MODE = 'true';
  
  // Create test directories
  const testDataDir = path.join(__dirname, 'test-data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
});

// Global test teardown
afterAll(() => {
  // Clean up test artifacts
  const testDataDir = path.join(__dirname, 'test-data');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  createTempDir: () => {
    const tempDir = path.join(__dirname, 'temp', Date.now().toString());
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  },
  
  cleanupTempDir: (dir: string) => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
  
  readFixture: (filename: string) => {
    const fixturePath = path.join(__dirname, 'fixtures', filename);
    return fs.readFileSync(fixturePath, 'utf8');
  },
  
  writeFixture: (filename: string, content: string) => {
    const fixturePath = path.join(__dirname, 'fixtures', filename);
    const fixtureDir = path.dirname(fixturePath);
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    fs.writeFileSync(fixturePath, content);
  }
};

// Mock implementations
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      readdir: jest.fn()
    }
  };
});

// TypeScript declarations
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        createTempDir: () => string;
        cleanupTempDir: (dir: string) => void;
        readFixture: (filename: string) => string;
        writeFixture: (filename: string, content: string) => void;
      };
    }
  }
}