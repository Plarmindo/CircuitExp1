#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

function toPascalCase(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return word.toUpperCase();
  }).replace(/\s+/g, '');
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

async function createPlugin() {
  console.log('🔌 CircuitExp1 Plugin Creator\n');
  
  const name = await askQuestion('Plugin name: ');
  const description = await askQuestion('Plugin description: ');
  const author = await askQuestion('Author name: ');
  const category = await askQuestion('Category (themes/export/interaction/analysis/integration): ');
  const license = await askQuestion('License (MIT/Apache-2.0/GPL-3.0): ') || 'MIT';
  
  const pluginId = toKebabCase(name);
  const className = toPascalCase(name) + 'Plugin';
  const pluginDir = path.join(process.cwd(), 'src', 'plugins', 'custom', pluginId);
  
  if (fs.existsSync(pluginDir)) {
    console.error(`❌ Plugin "${pluginId}" already exists!`);
    process.exit(1);
  }
  
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'docs'), { recursive: true });
  
  // Create package.json
  const packageJson = {
    name: `@circuitexp1/plugin-${pluginId}`,
    version: '1.0.0',
    description,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      test: 'vitest',
      lint: 'eslint src --ext .ts,.tsx',
      'lint:fix': 'eslint src --ext .ts,.tsx --fix'
    },
    keywords: ['circuitexp1', 'plugin', category],
    author,
    license,
    peerDependencies: {
      'circuitexp1': '^0.1.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0',
      'vitest': '^1.0.0',
      'eslint': '^8.0.0'
    }
  };
  
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create TypeScript config
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      lib: ['ES2020', 'DOM'],
      declaration: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      moduleResolution: 'node',
      allowSyntheticDefaultImports: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'tests']
  };
  
  fs.writeFileSync(
    path.join(pluginDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );
  
  // Create main plugin file
  const pluginTemplate = `import { Plugin, PluginAPI } from '../../core/PluginSystem';

export interface ${className}Config {
  enabled?: boolean;
  customOption?: string;
}

export class ${className} implements Plugin {
  public readonly metadata = {
    id: '${pluginId}',
    name: '${name}',
    version: '1.0.0',
    description: '${description}',
    author: '${author}',
    license: '${license}',
    category: '${category}'
  };

  private config: ${className}Config;
  private api: PluginAPI | null = null;

  constructor(config: ${className}Config = {}) {
    this.config = {
      enabled: true,
      ...config
    };
  }

  async activate(api: PluginAPI): Promise<void> {
    this.api = api;
    
    if (!this.config.enabled) {
      return;
    }

    console.log(\`🚀 Activating \${this.metadata.name}\`);

    // Register event listeners
    api.events.on('theme:changed', this.handleThemeChange.bind(this));
    api.events.on('file:selected', this.handleFileSelected.bind(this));

    // Add UI components
    this.addUIElements();
    
    // Initialize plugin state
    await this.initialize();
  }

  async deactivate(): Promise<void> {
    if (!this.api) return;

    console.log(\`⏹️  Deactivating \${this.metadata.name}\`);

    // Remove event listeners
    this.api.events.off('theme:changed', this.handleThemeChange.bind(this));
    this.api.events.off('file:selected', this.handleFileSelected.bind(this));

    // Clean up UI components
    this.removeUIElements();
    
    this.api = null;
  }

  private async initialize(): Promise<void> {
    // Initialize your plugin here
    // Example: Load saved settings, setup initial state
  }

  private addUIElements(): void {
    if (!this.api) return;

    // Example: Add menu items, buttons, panels
    this.api.ui.addMenuItem({
      id: \`${pluginId}-settings\`,
      label: '${name} Settings',
      action: () => this.showSettings()
    });
  }

  private removeUIElements(): void {
    if (!this.api) return;

    this.api.ui.removeMenuItem(\`${pluginId}-settings\`);
  }

  private handleThemeChange(theme: string): void {
    console.log(\`Theme changed to: \${theme}\`);
    // Update plugin appearance based on theme
  }

  private handleFileSelected(file: any): void {
    console.log(\`File selected: \${file.name}\`);
    // Handle file selection
  }

  private showSettings(): void {
    if (!this.api) return;

    this.api.ui.showDialog({
      title: '${name} Settings',
      content: \`
        <div>
          <label>
            <input type="checkbox" id="${pluginId}-enabled" \${this.config.enabled ? 'checked' : ''}>
            Enable ${name}
          </label>
          <label>
            Custom Option:
            <input type="text" id="${pluginId}-custom" value="\${this.config.customOption || ''}">
          </label>
        </div>
      \`,
      onConfirm: () => {
        this.config.enabled = (document.getElementById(\`${pluginId}-enabled\`) as HTMLInputElement).checked;
        this.config.customOption = (document.getElementById(\`${pluginId}-custom\`) as HTMLInputElement).value;
        this.saveConfig();
      }
    });
  }

  private saveConfig(): void {
    if (!this.api) return;
    
    this.api.storage.set(\`${pluginId}-config\`, this.config);
  }

  public updateConfig(config: Partial<${className}Config>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }
}

// Export for use as default plugin
export default ${className};

// Export for programmatic use
export { ${className} };`;

  fs.writeFileSync(
    path.join(pluginDir, 'src', 'index.ts'),
    pluginTemplate
  );
  
  // Create test file
  const testTemplate = `import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ${className} } from '../src/index';
import { mockPluginAPI } from '../../core/__mocks__/PluginAPI';

describe('${className}', () => {
  let plugin: ${className};
  let mockAPI: ReturnType<typeof mockPluginAPI>;

  beforeEach(() => {
    plugin = new ${className}();
    mockAPI = mockPluginAPI();
  });

  afterEach(async () => {
    if (plugin) {
      await plugin.deactivate();
    }
  });

  it('should have correct metadata', () => {
    expect(plugin.metadata.id).toBe('${pluginId}');
    expect(plugin.metadata.name).toBe('${name}');
    expect(plugin.metadata.version).toBe('1.0.0');
  });

  it('should activate successfully', async () => {
    await plugin.activate(mockAPI);
    expect(mockAPI.events.on).toHaveBeenCalled();
  });

  it('should handle theme changes', async () => {
    await plugin.activate(mockAPI);
    
    // Simulate theme change
    mockAPI.events.emit('theme:changed', 'dark');
    
    // Add your assertions here
    expect(true).toBe(true); // Replace with actual test
  });

  it('should deactivate cleanly', async () => {
    await plugin.activate(mockAPI);
    await plugin.deactivate();
    
    expect(mockAPI.events.off).toHaveBeenCalled();
  });
});`;

  fs.writeFileSync(
    path.join(pluginDir, 'tests', `${pluginId}.test.ts`),
    testTemplate
  );
  
  // Create README
  const readme = `# ${name}

${description}

## Installation

\`\`\`bash
npm install @circuitexp1/plugin-${pluginId}
\`\`\`

## Usage

\`\`\`typescript
import { ${className} } from '@circuitexp1/plugin-${pluginId}';

const plugin = new ${className}({
  enabled: true,
  customOption: 'value'
});

await plugin.activate(api);
\`\`\`

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| enabled | boolean | true | Enable/disable the plugin |
| customOption | string | - | Custom configuration option |

## Development

\`\`\`bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Lint code
npm run lint
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

${license}`;

  fs.writeFileSync(
    path.join(pluginDir, 'docs', 'README.md'),
    readme
  );
  
  // Create .gitignore
  const gitignore = `node_modules/
dist/
.env
.DS_Store
*.log
coverage/
.nyc_output/
.vscode/
.idea/`;

  fs.writeFileSync(
    path.join(pluginDir, '.gitignore'),
    gitignore
  );
  
  console.log(`\n✅ Plugin "${name}" created successfully!`);
  console.log(`📁 Location: ${pluginDir}`);
  console.log(`📝 Next steps:`);
  console.log(`   1. cd ${pluginDir}`);
  console.log(`   2. npm install`);
  console.log(`   3. npm run build`);
  console.log(`   4. npm test`);
  
  rl.close();
}

// Handle command line arguments
if (require.main === module) {
  createPlugin().catch(console.error);
}

module.exports = { createPlugin };