# Smart File Manager Plugin System

A comprehensive plugin system for extending the Smart File Manager with drag-and-drop ZIP plugin import capabilities.

## Features

- **Drag-and-Drop ZIP Import**: Install plugins by simply dragging ZIP files
- **Automatic Dependency Management**: Handles Python package installation
- **Version Control & Rollback**: Maintain previous versions with instant rollback
- **Security Sandboxing**: Controlled access to system resources
- **Offline Compatible**: No server connection required
- **Developer Friendly**: Simple plugin creation and testing

## Quick Start

### For Users

1. **Install a Plugin**:
   - Open Plugin Manager from the main menu
   - Drag your plugin ZIP file onto the window
   - Click "Install" when prompted

2. **Manage Plugins**:
   - Use the toggle switches to enable/disable plugins
   - Click rollback to revert to previous versions
   - View plugin details and dependencies

### For Developers

1. **Create a Plugin**:
   ```bash
   # Use the scaffolding tool
   npm run create-plugin hello-world
   
   # Or manually create structure
   mkdir hello-world-plugin
   cd hello-world-plugin
   ```

2. **Plugin Structure**:
   ```
   hello-world-plugin.zip
   ├── plugin.json
   ├── hello-world/
   │   ├── __init__.py
   │   └── main.py
   └── requirements.txt (optional)
   ```

3. **Package and Test**:
   ```bash
   zip -r hello-world-plugin-1.0.0.zip .
   ```

## Plugin System Architecture

```
src/plugins/
├── core/
│   ├── PluginSystem.ts      # Core plugin manager
│   └── types.ts            # Type definitions
├── import/
│   ├── ZipPluginImporter.ts # ZIP import functionality
│   └── __tests__/          # Import system tests
├── deployment/
│   ├── PluginValidator.ts  # Plugin validation
│   └── deploy.ts          # Deployment utilities
├── development/
│   ├── PluginTemplate.ts   # Plugin templates
│   └── scaffolding.js     # Development tools
└── samples/
    ├── hello-world-plugin/ # Example plugin
    └── advanced-plugin/     # Complex example
```

## API Reference

### Core Classes

#### PluginManager
Manages plugin lifecycle and registry.

```typescript
import { PluginManager } from './plugins';

const manager = new PluginManager();
await manager.register(plugin);
await manager.enable('plugin-id');
await manager.disable('plugin-id');
```

#### ZipPluginImporter
Handles ZIP plugin imports with rollback support.

```typescript
import { ZipPluginImporter } from './plugins';

const importer = new ZipPluginImporter();
const result = await importer.importFromZip(zipFile);

if (result.success) {
  console.log(`Installed ${result.plugin.name}`);
}
```

### Plugin Development

#### Basic Plugin Structure

```python
# hello-world/__init__.py
from .main import HelloWorldPlugin

def register():
    return HelloWorldPlugin()
```

```python
# hello-world/main.py
from src.plugins.core import Plugin, PluginAPI

class HelloWorldPlugin(Plugin):
    def __init__(self):
        super().__init__()
        self.name = "Hello World"
        self.version = "1.0.0"
    
    def activate(self):
        print("Hello World plugin activated!")
    
    def deactivate(self):
        print("Hello World plugin deactivated!")
```

#### plugin.json Format

```json
{
  "id": "hello-world",
  "name": "Hello World Plugin",
  "version": "1.0.0",
  "description": "A simple demonstration plugin",
  "author": "Your Name",
  "category": "utility",
  "main": "hello-world/__init__.py",
  "permissions": {
    "fileSystem": ["read"],
    "ui": ["notification"]
  },
  "dependencies": {
    "requests": ">=2.25.0"
  }
}
```

## Plugin Categories

- **themes**: UI themes and styling
- **export**: File export and sharing
- **interaction**: User interaction enhancements
- **analysis**: Data analysis and insights
- **integration**: Third-party integrations

## Security Model

### Permission System

Plugins must declare required permissions in `plugin.json`:

```json
{
  "permissions": {
    "fileSystem": ["read", "write"],
    "network": ["fetch"],
    "system": ["process"],
    "ui": ["modal", "notification"]
  }
}
```

### Sandboxing

- File system access is sandboxed
- Network requests are proxied
- System commands are restricted
- UI interactions are controlled

## Development Workflow

### 1. Setup Development Environment

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### 2. Create Plugin

```bash
# Using scaffolding
npm run create-plugin my-awesome-plugin

# Manual creation
mkdir my-awesome-plugin
cd my-awesome-plugin
```

### 3. Test Plugin

```bash
# Package plugin
zip -r my-awesome-plugin-1.0.0.zip .

# Test import
# Drag ZIP file into Plugin Manager
```

### 4. Publish Plugin

- Create release on GitHub
- Include ZIP file in release assets
- Update plugin.json with version info

## Testing

### Unit Tests

```bash
# Run all plugin tests
npm run test:plugins

# Run specific test suite
npm test src/plugins/import/__tests__/
```

### Integration Tests

```bash
# Test ZIP import flow
npm run test:integration

# Test plugin lifecycle
npm run test:lifecycle
```

## Troubleshooting

### Common Issues

1. **Import fails with "Invalid ZIP structure"**
   - Ensure plugin.json exists and is valid
   - Check plugin directory structure
   - Validate JSON syntax

2. **Dependencies fail to install**
   - Check requirements.txt format
   - Verify package availability
   - Check network connectivity

3. **Plugin fails to activate**
   - Check permission declarations
   - Verify Python syntax
   - Check for missing imports

### Debug Mode

Enable debug logging:

```bash
export DEBUG_PLUGINS=true
npm run dev
```

### Error Codes

- `PLUGIN_IMPORT_INVALID_ZIP`: Invalid ZIP structure
- `PLUGIN_IMPORT_INVALID_JSON`: Invalid plugin.json
- `PLUGIN_IMPORT_DEPENDENCY_FAILED`: Dependency installation failed
- `PLUGIN_ACTIVATION_FAILED`: Plugin activation failed

## Examples

### Hello World Plugin

See `samples/hello-world-plugin/` for a complete example.

### Advanced Plugin

See `samples/advanced-plugin/` for complex plugin with UI components.

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: This README and inline docs

## Changelog

### v1.0.0
- Initial release
- Drag-and-drop ZIP import
- Automatic dependency management
- Rollback system
- Security sandboxing
- Plugin templates and scaffolding