# ZIP Plugin Import System Guide

This guide explains how to use the drag-and-drop ZIP plugin import system for the Smart File Manager.

## Overview

The ZIP plugin import system allows users to install plugins by simply dragging and dropping ZIP files or using the import button. It handles extraction, dependency installation, and provides rollback capabilities.

## ZIP Bundle Structure

Your plugin ZIP file must follow this structure:

```
your-plugin.zip
├── plugin.json                 # Required: Plugin metadata
├── requirements.txt           # Optional: Python dependencies
└── your-plugin/               # Required: Plugin directory
    ├── __init__.py           # Required: Plugin entry point
    ├── main.py               # Required: Main plugin code
    ├── ui/                   # Optional: UI components
    │   ├── components/
    │   └── styles/
    ├── utils/                # Optional: Utility functions
    └── assets/               # Optional: Static assets
```

### plugin.json Format

```json
{
  "id": "my-plugin-id",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A brief description of what your plugin does",
  "author": "Your Name",
  "category": "file-management",
  "main": "your-plugin/__init__.py",
  "permissions": {
    "fileSystem": ["read", "write"],
    "network": ["fetch"],
    "system": ["process"]
  },
  "dependencies": {
    "requests": ">=2.25.0",
    "pillow": "^8.0.0"
  },
  "minVersion": "1.0.0",
  "maxVersion": "2.0.0"
}
```

### Required Fields

- **id**: Unique identifier for your plugin (lowercase, hyphens only)
- **name**: Human-readable plugin name
- **version**: Semantic version (x.y.z)
- **description**: Brief description
- **main**: Entry point file path
- **category**: Plugin category (file-management, analysis, utility, etc.)

### Permissions

Specify what system resources your plugin needs:

- **fileSystem**: ["read", "write", "delete"]
- **network**: ["fetch", "websocket"]
- **system**: ["process", "env"]
- **ui**: ["modal", "notification", "dialog"]

## Installation Methods

### Method 1: Drag and Drop

1. Open the Plugin Manager
2. Drag your plugin ZIP file onto the Plugin Manager window
3. The system will automatically:
   - Validate the ZIP structure
   - Extract to the plugins directory
   - Install dependencies
   - Register the plugin

### Method 2: Import Button

1. Click "Import Plugin" in the Plugin Manager
2. Select your ZIP file from the file dialog
3. Follow the import wizard

## Installation Process

1. **Validation**: Checks ZIP structure and plugin.json
2. **Extraction**: Extracts to `~/Smartfilemanager/plugins/<plugin-name>-<version>/`
3. **Dependencies**: Installs Python dependencies via pip
4. **Registration**: Adds plugin to the system registry
5. **Activation**: Enables the plugin (if requested)

## Rollback System

When updating a plugin:
- The previous version is preserved
- A toggle option appears to revert to the previous version
- Rollback is instant - no re-download required

## Plugin Directory Structure

After installation, plugins are stored in:
```
~/Smartfilemanager/plugins/
├── my-plugin-1.0.0/
│   ├── plugin.json
│   ├── __init__.py
│   └── ...
├── my-plugin-1.1.0/
│   ├── plugin.json
│   ├── __init__.py
│   └── ...
└── my-plugin-2.0.0/
    ├── plugin.json
    ├── __init__.py
    └── ...
```

## Creating Your Plugin

### 1. Create Plugin Structure

```bash
mkdir my-awesome-plugin
cd my-awesome-plugin
mkdir my-awesome-plugin
```

### 2. Create plugin.json

```json
{
  "id": "awesome-plugin",
  "name": "Awesome Plugin",
  "version": "1.0.0",
  "description": "Does awesome things with files",
  "author": "Your Name",
  "category": "file-management",
  "main": "awesome-plugin/__init__.py",
  "permissions": {
    "fileSystem": ["read", "write"]
  }
}
```

### 3. Create __init__.py

```python
from .main import FileProcessorPlugin

def register():
    return FileProcessorPlugin()
```

### 4. Create main.py

```python
from src.plugins.core import Plugin, PluginAPI

class FileProcessorPlugin(Plugin):
    def __init__(self):
        super().__init__()
        self.name = "Awesome Plugin"
        self.version = "1.0.0"
    
    def activate(self):
        # Plugin activation logic
        pass
    
    def deactivate(self):
        # Plugin deactivation logic
        pass
```

### 5. Create requirements.txt (if needed)

```
requests>=2.25.0
pillow>=8.0.0
```

### 6. Create ZIP

```bash
zip -r awesome-plugin-1.0.0.zip .
```

## Troubleshooting

### Common Issues

1. **"Invalid ZIP structure"**
   - Ensure you have plugin.json and the plugin directory
   - Check JSON syntax in plugin.json

2. **"Dependency installation failed"**
   - Check requirements.txt syntax
   - Ensure all dependencies are available via pip

3. **"Plugin ID already exists"**
   - Use a unique plugin ID
   - Consider using reverse domain notation: com.yourname.plugin

4. **"Permission denied"**
   - Check permissions in plugin.json
   - Ensure you only request necessary permissions

### Debug Mode

Enable debug logging:
```bash
export DEBUG_PLUGINS=true
```

## Best Practices

1. **Version Management**
   - Use semantic versioning
   - Test backward compatibility
   - Document breaking changes

2. **Security**
   - Only request necessary permissions
   - Validate all inputs
   - Use secure coding practices

3. **User Experience**
   - Provide clear error messages
   - Include comprehensive documentation
   - Test on different systems

4. **Performance**
   - Lazy load heavy dependencies
   - Cache frequently used data
   - Profile memory usage

## API Reference

### Plugin API Methods

- `register()`: Register your plugin
- `activate()`: Called when plugin is enabled
- `deactivate()`: Called when plugin is disabled
- `get_metadata()`: Return plugin information

### System Integration

- File system access via `PluginAPI.fs`
- Network access via `PluginAPI.network`
- UI integration via `PluginAPI.ui`
- Event system via `PluginAPI.events`

## Examples

See the `samples/` directory for complete plugin examples:
- `hello-world-plugin.zip`: Basic plugin structure
- `file-analyzer-plugin.zip`: Advanced file analysis
- `ui-extension-plugin.zip`: UI component integration

## Support

For issues or questions:
- Check the troubleshooting section
- Review example plugins
- Submit issues to the project repository