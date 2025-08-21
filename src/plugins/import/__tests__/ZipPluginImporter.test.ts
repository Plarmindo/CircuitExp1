import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ZipPluginImporter } from '../ZipPluginImporter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs and other dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('os');

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
    mockOs.homedir.mockReturnValue('/home/user');
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.unlinkSync.mockImplementation(() => {});
    mockFs.rmdirSync.mockImplementation(() => {});
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

      mockFs.existsSync.mockReturnValue(true);

      const result = await importer['createBackup'](pluginId, version);
      
      expect(result.success).toBe(true);
      expect(result.backupPath).toContain('backup');
    });

    it('should handle non-existing plugin', async () => {
      const pluginId = 'non-existing';
      const version = '1.0.0';

      mockFs.existsSync.mockReturnValue(false);

      const result = await importer['createBackup'](pluginId, version);
      
      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });
  });

  describe('rollback', () => {
    it('should restore from backup', async () => {
      const rollbackInfo = {
        pluginId: 'test-plugin',
        backupPath: '/home/user/plugins/test-plugin-1.0.0-backup',
        originalPath: '/home/user/plugins/test-plugin-1.0.0'
      };

      mockFs.existsSync.mockReturnValue(true);

      const result = await importer.rollback(rollbackInfo);
      
      expect(result.success).toBe(true);
    });

    it('should handle missing backup', async () => {
      const rollbackInfo = {
        pluginId: 'test-plugin',
        backupPath: '/non-existing-backup',
        originalPath: '/home/user/plugins/test-plugin-1.0.0'
      };

      mockFs.existsSync.mockReturnValue(false);

      const result = await importer.rollback(rollbackInfo);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup not found');
    });
  });

  describe('importFromZip', () => {
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