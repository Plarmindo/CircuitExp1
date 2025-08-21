import type { PluginAPI, Plugin } from '../../core/PluginSystem';

export function createMockPluginAPI(): PluginAPI {
  return {
    getVersion: vi.fn().mockReturnValue('1.0.0'),
    getConfig: vi.fn().mockReturnValue({}),
    setConfig: vi.fn(),
    
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    
    log: vi.fn(),
    
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    
    fetch: vi.fn().mockResolvedValue(new Response()),
    
    registerComponent: vi.fn(),
    unregisterComponent: vi.fn(),
    
    getData: vi.fn().mockResolvedValue(null),
    setData: vi.fn().mockResolvedValue(undefined),
    deleteData: vi.fn().mockResolvedValue(undefined)
  };
}

export function createTestPluginAPI(): PluginAPI {
  return createMockPluginAPI();
}

export function createTestPlugin(metadata: Partial<{
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category: string;
  engines: Record<string, string>;
  main: string;
}> = {}): Plugin {
  return {
    metadata: {
      id: metadata.id || 'test-plugin',
      name: metadata.name || 'Test Plugin',
      version: metadata.version || '1.0.0',
      description: metadata.description || 'A test plugin',
      author: metadata.author || 'Test Author',
      license: metadata.license || 'MIT',
      category: metadata.category || 'test',
      engines: metadata.engines || { circuitexp1: '^1.0.0' },
      main: metadata.main || 'index.js'
    },
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn().mockResolvedValue(undefined)
  };
}

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createMemorySpy() {
  const memoryUsage: number[] = [];
  
  const spy = {
    record: () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        memoryUsage.push(process.memoryUsage().heapUsed);
      }
    },
    getUsage: () => memoryUsage,
    getDelta: () => {
      if (memoryUsage.length < 2) return 0;
      return memoryUsage[memoryUsage.length - 1] - memoryUsage[0];
    },
    reset: () => {
      memoryUsage.length = 0;
    }
  };
  
  return spy;
}

export function createPerformanceTimer() {
  let start = performance.now();
  
  return {
    elapsed: () => performance.now() - start,
    reset: () => {
      start = performance.now();
    }
  };
}

export class TestPluginError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TestPluginError';
  }
}

export function expectToBeWithinRange(actual: number, min: number, max: number) {
  expect(actual).toBeGreaterThanOrEqual(min);
  expect(actual).toBeLessThanOrEqual(max);
}

export async function expectAsyncError(
  fn: () => Promise<any>,
  expectedError?: string | RegExp
) {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (expectedError) {
      const message = (error as Error).message;
      if (typeof expectedError === 'string') {
        expect(message).toContain(expectedError);
      } else {
        expect(message).toMatch(expectedError);
      }
    }
  }
}

export function createMockFileSystem() {
  const files = new Map<string, string>();
  
  return {
    writeFile: (path: string, content: string) => {
      files.set(path, content);
    },
    readFile: (path: string) => files.get(path),
    exists: (path: string) => files.has(path),
    delete: (path: string) => files.delete(path),
    list: () => Array.from(files.keys()),
    clear: () => files.clear()
  };
}

export function createMockNetwork() {
  const requests: Array<{ url: string; options?: any }> = [];
  
  return {
    request: (url: string, options?: any) => {
      requests.push({ url, options });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      });
    },
    getRequests: () => requests,
    clear: () => requests.length = 0
  };
}

export function createMockLogger() {
  const logs: Array<{ level: string; message: string; data?: any }> = [];
  
  return {
    info: (message: string, data?: any) => logs.push({ level: 'info', message, data }),
    warn: (message: string, data?: any) => logs.push({ level: 'warn', message, data }),
    error: (message: string, data?: any) => logs.push({ level: 'error', message, data }),
    debug: (message: string, data?: any) => logs.push({ level: 'debug', message, data }),
    getLogs: () => logs,
    clear: () => logs.length = 0
  };
}

export function createMockUI() {
  const elements: Array<{ type: string; id: string; data: any }> = [];
  
  return {
    addMenuItem: (data: any) => elements.push({ type: 'menuItem', id: data.id, data }),
    removeMenuItem: (id: string) => {
      const index = elements.findIndex(e => e.type === 'menuItem' && e.id === id);
      if (index > -1) elements.splice(index, 1);
    },
    showDialog: (data: any) => elements.push({ type: 'dialog', id: data.id, data }),
    addPanel: (data: any) => elements.push({ type: 'panel', id: data.id, data }),
    removePanel: (id: string) => {
      const index = elements.findIndex(e => e.type === 'panel' && e.id === id);
      if (index > -1) elements.splice(index, 1);
    },
    addButton: (data: any) => elements.push({ type: 'button', id: data.id, data }),
    removeButton: (id: string) => {
      const index = elements.findIndex(e => e.type === 'button' && e.id === id);
      if (index > -1) elements.splice(index, 1);
    },
    getElements: () => elements,
    clear: () => elements.length = 0
  };
}