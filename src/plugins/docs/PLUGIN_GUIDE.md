# CircuitExp1 Plugin System - Complete Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Plugin Development](#plugin-development)
4. [API Reference](#api-reference)
5. [Deployment & Testing](#deployment--testing)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [Examples](#examples)

## Quick Start

### Creating Your First Plugin

```typescript
// src/plugins/my-first-plugin.ts
import { Plugin, PluginMetadata } from '../core/PluginSystem';

const metadata: PluginMetadata = {
  id: 'my-first-plugin',
  name: 'My First Plugin',
  version: '1.0.0',
  description: 'A simple plugin example',
  author: 'Your Name',
  license: 'MIT',
  main: './dist/index.js',
  engines: {
    circuitexp1: '^0.0.0',
    node: '>=18.0.0'
  },
  dependencies: {
    'lodash': '^4.17.21'
  }
};

export class MyFirstPlugin implements Plugin {
  metadata = metadata;
  
  async activate(api: PluginAPI): Promise<void> {
    console.log('MyFirstPlugin activated!');
    
    // Register a simple component
    api.registerComponent('my-component', {
      render: () => '<div>Hello from MyFirstPlugin!</div>'
    });
  }
  
  async deactivate(): Promise<void> {
    console.log('MyFirstPlugin deactivated!');
  }
}
```

### Testing Your Plugin

```bash
# Validate plugin
npm run validate-plugin ./src/plugins/my-first-plugin.ts

# Deploy to local
npm run deploy-plugin ./src/plugins/my-first-plugin.ts local

# Run tests
npm run test-plugin ./src/plugins/my-first-plugin.ts
```

## Architecture Overview

### Core Components

```
src/plugins/
├── core/
│   ├── PluginSystem.ts      # Core interfaces and manager
│   └── types.ts            # Type definitions
├── development/
│   ├── PluginTemplate.ts   # Development templates
│   └── scaffolding.js      # Plugin generator
├── deployment/
│   ├── PluginValidator.ts  # Validation and testing
│   └── deploy.ts          # Deployment automation
├── docs/
│   ├── API.md             # API documentation
│   └── examples/          # Sample plugins
└── registry/
    └── index.ts           # Plugin registry
```

### Plugin Lifecycle

1. **Discovery**: System scans for available plugins
2. **Validation**: Plugin is validated against security and compatibility rules
3. **Loading**: Plugin code is loaded into memory
4. **Activation**: Plugin's `activate()` method is called
5. **Runtime**: Plugin operates within the system
6. **Deactivation**: Plugin's `deactivate()` method is called
7. **Cleanup**: Plugin resources are released

## Plugin Development

### Plugin Structure

```
my-plugin/
├── package.json           # Plugin metadata
├── src/
│   ├── index.ts          # Main entry point
│   ├── components/       # UI components
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
├── tests/               # Test files
├── docs/                # Documentation
└── dist/               # Built files
```

### package.json Template

```json
{
  "name": "my-circuit-plugin",
  "version": "1.0.0",
  "description": "Description of your plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "validate": "plugin-validator",
    "deploy": "plugin-deploy"
  },
  "engines": {
    "circuitexp1": "^0.0.0",
    "node": ">=18.0.0"
  },
  "dependencies": {
    "react": "^19.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Development Workflow

1. **Setup Development Environment**
   ```bash
   npm install -g @circuitexp1/cli
   circuitexp1 init-plugin my-plugin
   cd my-plugin
   npm install
   ```

2. **Development Mode**
   ```bash
   npm run dev
   # Plugin will be automatically reloaded on changes
   ```

3. **Testing**
   ```bash
   npm test
   npm run test:e2e
   npm run validate
   ```

4. **Building**
   ```bash
   npm run build
   npm run bundle
   ```

## API Reference

### PluginAPI Methods

#### Configuration Management
```typescript
// Get configuration
const config = api.getConfig();

// Set configuration
api.setConfig({ theme: 'dark', debug: true });

// Listen for configuration changes
api.on('config:change', (newConfig) => {
  console.log('Config updated:', newConfig);
});
```

#### Event System
```typescript
// Emit events
api.emit('plugin:loaded', { plugin: 'my-plugin' });

// Listen for events
api.on('theme:change', (theme) => {
  console.log('Theme changed to:', theme);
});

// Remove listeners
api.off('theme:change', handler);
```

#### File System Access
```typescript
// Read file
const content = await api.readFile('/path/to/file.txt');

// Write file
await api.writeFile('/path/to/output.txt', 'content');

// Check if file exists
const exists = await api.exists('/path/to/file.txt');
```

#### Network Requests
```typescript
// Make HTTP requests
const response = await api.fetch('https://api.example.com/data');
const data = await response.json();
```

#### UI Integration
```typescript
// Register UI components
api.registerComponent('my-widget', {
  render: () => <MyWidget />,
  props: { title: 'My Widget' }
});

// Add menu items
api.addMenuItem('My Plugin', '/my-plugin', {
  icon: 'settings',
  description: 'Plugin settings'
});
```

#### Data Storage
```typescript
// Store plugin data
await api.setData('my-key', { value: 42 });

// Retrieve plugin data
const data = await api.getData('my-key');

// Delete plugin data
await api.deleteData('my-key');
```

### Security Policies

```typescript
// Define security policies in plugin metadata
const metadata: PluginMetadata = {
  // ... other fields
  security: {
    permissions: [
      'read:filesystem',
      'write:plugin-data',
      'network:api.example.com'
    ],
    sandbox: true,
    csp: "default-src 'self'"
  }
};
```

## Deployment & Testing

### Deployment Targets

#### Local Development
```bash
npm run deploy-plugin ./my-plugin local
```

#### Staging Environment
```bash
npm run deploy-plugin ./my-plugin staging
```

#### Production
```bash
npm run deploy-plugin ./my-plugin production -- --verify --backup
```

### Automated Testing Pipeline

```yaml
# .github/workflows/plugin-test.yml
name: Plugin Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run validate-plugin
      - run: npm run test-plugin
      - run: npm run security-scan
```

### Validation Checks

```typescript
// Comprehensive validation
const validator = new PluginValidator();
const result = await validator.validatePlugin(myPlugin, {
  strict: true,
  checkSecurity: true,
  checkDependencies: true,
  checkCompatibility: true
});

if (!result.overall) {
  console.error('Validation failed:', result);
}
```

## Troubleshooting

### Common Issues

#### Plugin Not Loading
**Symptoms**: Plugin doesn't appear in the plugin list
**Solutions**:
1. Check plugin ID format (must be kebab-case)
2. Verify metadata completeness
3. Check engine compatibility
4. Look for syntax errors

```bash
# Debug plugin loading
DEBUG=plugins:* npm start
```

#### Security Errors
**Symptoms**: Plugin fails security validation
**Solutions**:
1. Remove use of `eval()` or `new Function()`
2. Use safe DOM manipulation methods
3. Validate all user inputs
4. Follow CSP guidelines

```typescript
// Instead of eval()
const safeFunction = new Function('return ' + userCode); // ❌
const safeFunction = JSON.parse(userCode); // ✅
```

#### Performance Issues
**Symptoms**: Plugin causes slowdowns
**Solutions**:
1. Use lazy loading for heavy components
2. Implement proper cleanup in deactivate()
3. Debounce expensive operations
4. Use React.memo for components

```typescript
// Lazy loading
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

// Cleanup
async deactivate() {
  this.observer?.disconnect();
  this.timer?.clear();
}
```

#### Memory Leaks
**Symptoms**: Memory usage increases over time
**Solutions**:
1. Remove all event listeners in deactivate()
2. Clear intervals and timeouts
3. Disconnect observers
4. Release DOM references

```typescript
class MyPlugin implements Plugin {
  private observers: MutationObserver[] = [];
  private intervals: NodeJS.Timeout[] = [];

  async deactivate() {
    // Clean up observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // Clean up intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }
}
```

## Best Practices

### Security
- Never use `eval()` or `new Function()`
- Always validate user inputs
- Use Content Security Policy (CSP)
- Sanitize HTML content
- Implement proper authentication

### Performance
- Use lazy loading for non-critical components
- Implement proper cleanup
- Cache expensive computations
- Use efficient data structures
- Monitor memory usage

### Maintainability
- Follow semantic versioning
- Write comprehensive tests
- Document all public APIs
- Use TypeScript for type safety
- Implement error boundaries

### User Experience
- Provide clear error messages
- Implement loading states
- Add accessibility features
- Support keyboard navigation
- Test across different devices

## Examples

### Theme Plugin
```typescript
// Theme switching plugin
export class ThemePlugin implements Plugin {
  metadata = {
    id: 'theme-switcher',
    name: 'Theme Switcher',
    version: '1.0.0',
    description: 'Dynamic theme switching plugin'
  };

  async activate(api: PluginAPI): Promise<void> {
    // Register theme components
    api.registerComponent('theme-toggle', ThemeToggle);
    
    // Listen for theme changes
    api.on('theme:change', (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
    });

    // Add theme menu
    api.addMenuItem('Themes', '/themes', {
      icon: 'palette',
      description: 'Manage application themes'
    });
  }
}
```

### Data Export Plugin
```typescript
// Export functionality plugin
export class ExportPlugin implements Plugin {
  metadata = {
    id: 'data-exporter',
    name: 'Data Exporter',
    version: '1.0.0',
    description: 'Export circuit data to various formats'
  };

  async activate(api: PluginAPI): Promise<void> {
    api.registerComponent('export-panel', ExportPanel);
    
    api.addMenuItem('Export', '/export', {
      icon: 'download',
      description: 'Export circuit data'
    });

    // Register export formats
    api.registerExportFormat('json', {
      name: 'JSON',
      extension: '.json',
      mimeType: 'application/json',
      export: async (data) => JSON.stringify(data, null, 2)
    });

    api.registerExportFormat('csv', {
      name: 'CSV',
      extension: '.csv',
      mimeType: 'text/csv',
      export: async (data) => this.convertToCSV(data)
    });
  }

  private convertToCSV(data: any[]): string {
    // CSV conversion logic
    return 'data,converted,to,csv';
  }
}
```

### Real-time Collaboration Plugin
```typescript
// Collaboration features plugin
export class CollaborationPlugin implements Plugin {
  metadata = {
    id: 'realtime-collab',
    name: 'Real-time Collaboration',
    version: '1.0.0',
    description: 'Multi-user real-time editing'
  };

  private socket?: WebSocket;

  async activate(api: PluginAPI): Promise<void> {
    // Initialize WebSocket connection
    this.socket = new WebSocket('wss://collab.example.com');
    
    // Handle incoming changes
    this.socket.onmessage = (event) => {
      const change = JSON.parse(event.data);
      api.emit('circuit:change', change);
    };

    // Listen for local changes
    api.on('circuit:local-change', (change) => {
      this.socket?.send(JSON.stringify(change));
    });

    // Add collaboration UI
    api.registerComponent('collaboration-panel', CollaborationPanel);
  }

  async deactivate(): Promise<void> {
    this.socket?.close();
  }
}
```

## Migration Guide

### From v0.x to v1.0

1. **Update metadata format**
   ```typescript
   // Old
   {
     name: 'my-plugin',
     version: '0.5.0'
   }

   // New
   {
     id: 'my-plugin',
     name: 'My Plugin',
     version: '1.0.0',
     engines: { circuitexp1: '^1.0.0' }
   }
   ```

2. **Update API usage**
   ```typescript
   // Old
   PluginManager.register(myPlugin);

   // New
   await pluginManager.register(myPlugin);
   ```

3. **Add TypeScript types**
   ```typescript
   // New requirement
   interface MyPlugin extends Plugin {
     metadata: PluginMetadata;
   }
   ```

## Support

- **Documentation**: [docs/plugins](https://github.com/CircuitExp1/docs/plugins)
- **Issues**: [GitHub Issues](https://github.com/CircuitExp1/CircuitExp1/issues)
- **Discussions**: [GitHub Discussions](https://github.com/CircuitExp1/CircuitExp1/discussions)
- **Community**: [Discord Server](https://discord.gg/circuitexp1)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Update documentation
5. Submit a pull request

### Development Setup
```bash
git clone https://github.com/CircuitExp1/CircuitExp1.git
cd CircuitExp1
npm install
npm run dev
```

## License

This plugin system is released under the MIT License. See [LICENSE](../LICENSE) for details.