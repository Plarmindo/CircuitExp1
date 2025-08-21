import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
const jest = vi as unknown as typeof vi;
// Mock built-in modules before importing the thing under test
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmdirSync: vi.fn()
  };
});

// Mock fs-extra to stub directory operations
vi.mock('fs-extra', async () => {
  const actual = await vi.importActual<typeof import('fs-extra')>('fs-extra');
  return {
    ...actual,
    existsSync: vi.fn(),
    readJSON: vi.fn().mockResolvedValue({}),
    readJSONSync: vi.fn().mockReturnValue({}),
    readdirSync: vi.fn().mockReturnValue([]),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    ensureDirSync: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
    removeSync: vi.fn(),
    copy: vi.fn().mockResolvedValue(undefined),
    writeJSON: vi.fn().mockResolvedValue(undefined),
    copySync: vi.fn()
  };
});


import { ZipPluginImporter } from '../../../src/plugins/import/ZipPluginImporter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as fse from 'fs-extra';

// fs already mocked above using vi.mock


const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockOs = os as jest.Mocked<typeof os>;

describe('ZipPluginImporter', () => {
  let importer: ZipPluginImporter;
  let tempDir: string;
  let pluginsDir: string;

  beforeEach(() => {
    tempDir = '/tmp/test';
    pluginsDir = '/home/user/plugins';
    importer = new ZipPluginImporter(pluginsDir);
    
    // Setup mocks
    (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);
    (fse.existsSync as unknown as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as unknown as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as unknown as jest.Mock).mockImplementation(() => {});
    (fs.unlinkSync as unknown as jest.Mock).mockImplementation(() => {});
    (fs.rmdirSync as unknown as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateZipStructure', () => {
    it('should validate correct ZIP structure', async () => {
      const validStructure = [
        'my-plugin/plugin.json',
        'my-plugin/__init__.py',
        'my-plugin/main.py'
      ];

      const result = await importer['validateZipStructure'](validStructure);
      
      expect(result.valid).toBe(true);
      expect(result.pluginName).toBe('my-plugin');
    });

    it('should reject invalid ZIP structure - missing plugin.json', async () => {
      const invalidStructure = [
        'my-plugin/__init__.py',
        'my-plugin/main.py'
      ];

      const result = await importer['validateZipStructure'](invalidStructure);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('plugin.json');
    });

    it('should reject invalid ZIP structure - missing plugin directory', async () => {
      const invalidStructure = [
        'plugin.json',
        'some-file.txt'
      ];

      const result = await importer['validateZipStructure'](invalidStructure);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('plugin directory');
    });
  });

  describe('parsePluginJson', () => {
    it('should parse valid plugin.json', async () => {
      const validJson = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        category: 'test',
        main: 'test-plugin/__init__.py',
        permissions: {}
      };

      const result = await importer['parsePluginJson'](JSON.stringify(validJson));
      
      expect(result.success).toBe(true);
      expect(result.metadata?.id).toBe('test-plugin');
    });

    it('should reject invalid plugin.json - missing required fields', async () => {
      const invalidJson = {
        name: 'Test Plugin',
        version: '1.0.0'
      };

      const result = await importer['parsePluginJson'](JSON.stringify(invalidJson));
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject invalid JSON syntax', async () => {
      const result = await importer['parsePluginJson']('invalid json');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });
  });

  describe('installDependencies', () => {
    it('should install dependencies from requirements.txt', async () => {
      const requirements = 'requests>=2.25.0\npillow>=8.0.0';
      const pluginDir = '/home/user/plugins/test-plugin-1.0.0';

      const result = await importer['installDependencies'](requirements, pluginDir);
      
      expect(result.success).toBe(true);
      expect(result.installed).toEqual(['requests>=2.25.0', 'pillow>=8.0.0']);
    });

    it('should handle empty requirements.txt', async () => {
      const result = await importer['installDependencies']('', '/test/path');
      
      expect(result.success).toBe(true);
      expect(result.installed).toEqual([]);
    });
  });

  describe('createBackup', () => {
    it('should create backup of existing plugin', async () => {
      const pluginId = 'test-plugin';
      const version = '1.0.0';
      const pluginDir = '/home/user/plugins/test-plugin-1.0.0';

      (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);

      const result = await importer['createBackup'](pluginId, version);
      
      expect(result.success).toBe(true);
      expect(result.backupPath).toContain('backup');
    });

    it('should handle non-existing plugin', async () => {
      const pluginId = 'non-existing';
      const version = '1.0.0';

      (fs.existsSync as unknown as jest.Mock).mockReturnValue(false);
      (fse.existsSync as unknown as jest.Mock).mockReturnValue(false);

      const result = await importer['createBackup'](pluginId, version);
      
      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });
  });

  describe.skip('rollback', () => {
    it('should restore from backup', async () => {
      const rollbackInfo = {
        pluginId: 'test-plugin',
        backupPath: '/home/user/plugins/test-plugin-1.0.0-backup',
        originalPath: '/home/user/plugins/test-plugin-1.0.0'
      };

      (fs.existsSync as unknown as jest.Mock).mockImplementation((p:string)=> p.includes('backup'));

      const result = await importer.rollback(rollbackInfo);




      

      expect(result).toBe(true);
    });

    it('should handle missing backup', async () => {
      const rollbackInfo = {
        pluginId: 'test-plugin',
        backupPath: '/non-existing-backup',
        originalPath: '/home/user/plugins/test-plugin-1.0.0'
      };

      (fs.existsSync as unknown as jest.Mock).mockReturnValue(false);

      const result = await importer.rollback(rollbackInfo);




      


      expect(result).toBe(false);
    });
  });

  describe.skip('importFromZip', () => {
    it('should successfully import valid plugin', async () => {
      // This would be a more complex test with actual ZIP file handling
      // For now, we'll test the validation flow
      
      const mockZipFile = new Blob(['mock zip content'], { type: 'application/zip' });
      
      // Mock the ZIP extraction and validation
      jest.spyOn(importer as any, 'extractZip').mockResolvedValue({
        files: [
          'my-plugin/plugin.json',
          'my-plugin/__init__.py'
        ],
        tempDir: '/tmp/test'
      });

      jest.spyOn(importer as any, 'validateZipStructure').mockResolvedValue({
        valid: true,
        pluginName: 'my-plugin'
      });

      jest.spyOn(importer as any, 'parsePluginJson').mockResolvedValue({
        success: true,
        metadata: {
          id: 'my-plugin',
          name: 'My Plugin',
          version: '1.0.0'
        }
      });

      const result = await importer.importFromZip(mockZipFile as any);
      
      expect(result.success).toBe(true);
      expect(result.plugin?.id).toBe('my-plugin');
    });
  });
});