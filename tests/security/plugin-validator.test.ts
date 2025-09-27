import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { PluginSecurityValidator } from '../../src/security/plugin-validator';

describe('PluginSecurityValidator', () => {
  const validator = new PluginSecurityValidator();
  const testDir = join(__dirname, 'test-plugins');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('validatePlugin', () => {
    it('should validate a safe plugin successfully', async () => {
      const pluginPath = join(testDir, 'safe-plugin.js');
      const safeContent = `
        // Safe plugin
        console.log('Hello from safe plugin');
        function add(a, b) {
          return a + b;
        }
        export default add;
      `;
      
      await writeFile(pluginPath, safeContent);

      const result = await validator.validatePlugin(pluginPath);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.securityScore).toBeGreaterThan(80);
      expect(result.metadata.name).toBe('safe-plugin');
    });

    it('should reject plugin with eval', async () => {
      const pluginPath = join(testDir, 'eval-plugin.js');
      const dangerousContent = `
        // Dangerous plugin with eval
        const userInput = prompt('Enter code');
        eval(userInput);
      `;
      
      await writeFile(pluginPath, dangerousContent);

      const result = await validator.validatePlugin(pluginPath);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('dangerous')]));
      expect(result.securityScore).toBeLessThan(50);
    });

    it('should reject plugin with hardcoded secrets', async () => {
      const pluginPath = join(testDir, 'secret-plugin.js');
      const secretContent = `
        const apiKey = 'sk-1234567890abcdef1234567890abcdef';
        const password = 'mySuperSecretPassword123';
        console.log('Using API key:', apiKey);
      `;
      
      await writeFile(pluginPath, secretContent);

      const result = await validator.validatePlugin(pluginPath);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('secret')]));
      expect(result.securityScore).toBeLessThan(70);
    });

    it('should validate manifest.json', async () => {
      const pluginPath = join(testDir, 'with-manifest.js');
      const manifestPath = join(testDir, 'manifest.json');
      
      const pluginContent = `console.log('Plugin with manifest');`;
      const manifestContent = JSON.stringify({
        name: 'Test Plugin',
        version: '1.0.0',
        author: 'Test Author',
        description: 'A test plugin with manifest',
        permissions: ['filesystem:read', 'ui:dialog']
      });
      
      await writeFile(pluginPath, pluginContent);
      await writeFile(manifestPath, manifestContent);

      const result = await validator.validatePlugin(pluginPath);
      
      expect(result.valid).toBe(true);
      expect(result.metadata.name).toBe('Test Plugin');
      expect(result.metadata.permissions).toContain('filesystem:read');
    });

    it('should handle missing manifest gracefully', async () => {
      const pluginPath = join(testDir, 'no-manifest.js');
      const pluginContent = `console.log('Plugin without manifest');`;
      
      await writeFile(pluginPath, pluginContent);

      const result = await validator.validatePlugin(pluginPath);
      
      expect(result.valid).toBe(true);
      expect(result.metadata.name).toBe('no-manifest');
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should validate file type restrictions', async () => {
      const pluginPath = join(testDir, 'dangerous.exe');
      const content = 'MZ...'; // EXE header
      
      await writeFile(pluginPath, content);

      const result = await validator.validatePlugin(pluginPath, {
        allowedFileTypes: ['.js', '.ts']
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('File type')]));
    });

    it('should validate file size restrictions', async () => {
      const pluginPath = join(testDir, 'large-plugin.js');
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB
      
      await writeFile(pluginPath, largeContent);

      const result = await validator.validatePlugin(pluginPath, {
        maxFileSize: 5 * 1024 * 1024
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('File size')]));
    });

    it('should handle network access policies', async () => {
      const pluginPath = join(testDir, 'network-plugin.js');
      const networkContent = `
        const https = require('https');
        fetch('https://api.example.com/data');
      `;
      
      await writeFile(pluginPath, networkContent);

      // With network disabled
      let result = await validator.validatePlugin(pluginPath, {
        allowNetwork: false
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('network')]));

      // With network enabled but no allowed domains
      result = await validator.validatePlugin(pluginPath, {
        allowNetwork: true,
        allowedDomains: ['api.trusted.com']
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Domain not allowed')]));

      // With network enabled and correct domain
      result = await validator.validatePlugin(pluginPath, {
        allowNetwork: true,
        allowedDomains: ['api.example.com']
      });
      expect(result.valid).toBe(true);
    });

    it('should detect obfuscated code', async () => {
      const pluginPath = join(testDir, 'obfuscated-plugin.js');
      const obfuscatedContent = `
        const x = '\x48\x65\x6c\x6c\x6f';
        const y = '\u0042\u0059\u0045';
        eval('a' + 'l' + 'e' + 'r' + 't' + '(1)');
      `;
      
      await writeFile(pluginPath, obfuscatedContent);

      const result = await validator.validatePlugin(pluginPath);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('obfuscation')]));
      expect(result.securityScore).toBeLessThan(95);
    });

    it('should validate invalid manifest', async () => {
      const pluginPath = join(testDir, 'invalid-manifest.js');
      const manifestPath = join(testDir, 'manifest.json');
      
      const pluginContent = `console.log('Plugin with invalid manifest');`;
      const invalidManifest = JSON.stringify({
        name: 'Test Plugin',
        // Missing required fields
      });
      
      await writeFile(pluginPath, pluginContent);
      await writeFile(manifestPath, invalidManifest);

      const result = await validator.validatePlugin(pluginPath);
      
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Missing required')]));
    });

    it('should handle file access errors', async () => {
      const nonExistentPath = join(testDir, 'nonexistent.js');

      const result = await validator.validatePlugin(nonExistentPath);
      
      expect(result.valid).toBe(false);
       expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Cannot access')]));
       expect(result.securityScore).toBe(0);
    });
  });

  describe('validatePlugins (batch)', () => {
    it('should validate multiple plugins', async () => {
      const plugins = [];
      
      // Create multiple plugins
      for (let i = 0; i < 3; i++) {
        const pluginPath = join(testDir, `plugin-${i}.js`);
        const content = `console.log('Plugin ${i}');`;
        await writeFile(pluginPath, content);
        plugins.push(pluginPath);
      }

      const results = await validator.validatePlugins(plugins);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.securityScore > 80)).toBe(true);
    });

    it('should handle mixed valid and invalid plugins', async () => {
      const plugins = [];
      
      // Valid plugin
      const validPath = join(testDir, 'valid.js');
      await writeFile(validPath, 'console.log("valid");');
      plugins.push(validPath);

      // Invalid plugin
      const invalidPath = join(testDir, 'invalid.js');
      await writeFile(invalidPath, 'eval("alert(1)");');
      plugins.push(invalidPath);

      const results = await validator.validatePlugins(plugins);
      
      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });
  });

  describe('createSandbox', () => {
    it('should create sandbox with restricted globals', () => {
      const sandbox = validator.createSandbox('/test/plugin.js', {
        allowNetwork: false,
        allowFileSystem: false,
        allowProcess: false,
        allowEval: false,
        allowDynamicImport: false,
        allowedDomains: [],
        maxFileSize: 1024,
        allowedFileTypes: ['.js'],
        requiredPermissions: []
      });

      expect(sandbox.console).toBeDefined();
      expect(sandbox.setTimeout).toBeDefined();
      expect(sandbox.JSON).toBeDefined();
      expect(sandbox.fs).toBeUndefined();
      expect(sandbox.fetch).toBeUndefined();
    });

    it('should create sandbox with file system access', () => {
      const sandbox = validator.createSandbox('/test/plugin.js', {
        allowNetwork: false,
        allowFileSystem: true,
        allowProcess: false,
        allowEval: false,
        allowDynamicImport: false,
        allowedDomains: [],
        maxFileSize: 1024,
        allowedFileTypes: ['.js'],
        requiredPermissions: []
      });

      expect(sandbox.fs).toBeDefined();
      expect(sandbox.fs.readFile).toBeInstanceOf(Function);
      expect(sandbox.fs.writeFile).toBeInstanceOf(Function);
    });

    it('should create sandbox with network access', () => {
      const sandbox = validator.createSandbox('/test/plugin.js', {
        allowNetwork: true,
        allowFileSystem: false,
        allowProcess: false,
        allowEval: false,
        allowDynamicImport: false,
        allowedDomains: ['api.example.com'],
        maxFileSize: 1024,
        allowedFileTypes: ['.js'],
        requiredPermissions: []
      });

      expect(sandbox.fetch).toBeDefined();
      expect(sandbox.fetch).toBeInstanceOf(Function);
    });
  });
});