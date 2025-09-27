#!/usr/bin/env node

const fs = require('fs');

// TypeScript any type fixes - starting with easier ones
const anyTypeFixes = {
  'src/services/metrics-service.ts': [
    { from: '(...args: any[]) => void', to: '(...args: unknown[]) => void' },
    { from: 'emit(event: string, ...args: any[])', to: 'emit(event: string, ...args: unknown[])' },
    { from: 'off(event: string, listener: (...args: any[]) => void)', to: 'off(event: string, listener: (...args: unknown[]) => void)' },
  ],

  'src/services/rate-limiter.ts': [
    { from: 'checkRateLimit(identifier: string, operation: string, metadata?: any)', to: 'checkRateLimit(identifier: string, operation: string, metadata?: Record<string, unknown>)' },
    { from: 'exportMetrics(): any', to: 'exportMetrics(): Record<string, unknown>' },
  ],

  'src/security/security-hardening.ts': [
    { from: '} catch (error: any) {', to: '} catch (error: unknown) {' },
  ],

  'src/security/security-audit.ts': [
    { from: 'payload?: any;', to: 'payload?: Record<string, unknown>;' },
    { from: 'generateRecommendations(stats: any)', to: 'generateRecommendations(stats: Record<string, unknown>)' },
    { from: 'ip.count > 100)) {', to: 'ip.count > 100)) {' }, // This one needs context check
    { from: 'generateHtmlReport(report: any)', to: 'generateHtmlReport(report: Record<string, unknown>)' },
    { from: 'generateMarkdownReport(report: any)', to: 'generateMarkdownReport(report: Record<string, unknown>)' },
  ],

  'src/security/plugin-validator.ts': [
    { from: '} catch (error: any) {', to: '} catch (error: unknown) {' },
    { from: 'let manifest: any = null;', to: 'let manifest: Record<string, unknown> | null = null;' },
    { from: 'extractMetadata(pluginPath: string, content: string, manifest?: any)', to: 'extractMetadata(pluginPath: string, content: string, manifest?: Record<string, unknown>)' },
  ],

  'src/security/security-manager.ts': [
    { from: 'details: any;', to: 'details: Record<string, unknown>;' },
    { from: 'plugins: any[];', to: 'plugins: Record<string, unknown>[];' },
    { from: 'pluginSummary: any,', to: 'pluginSummary: Record<string, unknown>,' },
    { from: 'violations: any[]', to: 'violations: Record<string, unknown>[]' },
  ],

  'src/visualization/modes/mode-registry.ts': [
    { from: 'theme?: any;', to: 'theme?: Record<string, unknown>;' },
  ],

  'src/visualization/performance/performance-monitor.ts': [
    { from: 'Object.values(PIXI.utils.TextureCache).forEach((texture: any) => {', to: 'Object.values(PIXI.utils.TextureCache).forEach((texture: unknown) => {' },
    { from: 'return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {', to: 'return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {' },
    { from: 'descriptor.value = function (...args: any[]) {', to: 'descriptor.value = function (...args: unknown[]) {' },
  ],
};

function fixAnyTypes(filePath, fixes) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const fix of fixes) {
    if (content.includes(fix.from)) {
      content = content.replace(new RegExp(fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fix.to);
      changed = true;
      console.log(`Fixed any type in ${filePath}: ${fix.from} -> ${fix.to}`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }

  return changed;
}

// Process any type fixes
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(anyTypeFixes)) {
  if (fixAnyTypes(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} files with any type fixes`);
