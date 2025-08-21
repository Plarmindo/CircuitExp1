# Plugin Integration Example

This example demonstrates how to integrate the ZIP plugin import system into your Smart File Manager application.

## Basic Integration

### 1. Initialize Plugin System

```typescript
// src/App.tsx or main application file
import React, { useEffect } from 'react';
import { PluginManager } from './plugins/core/PluginSystem';
import { ZipPluginImporter } from './plugins/import/ZipPluginImporter';

// Create singleton instances
const pluginManager = new PluginManager();
const pluginImporter = new ZipPluginImporter();

function App() {
  useEffect(() => {
    // Initialize plugin system
    const initPlugins = async () => {
      try {
        await pluginManager.initialize();
        console.log('Plugin system ready');
      } catch (error) {
        console.error('Plugin init failed:', error);
      }
    };
    initPlugins();
  }, []);

  return (
    <div>
      {/* Your app content */}
    </div>
  );
}

export { pluginManager, pluginImporter };
```

### 2. Add Plugin Manager UI

```typescript
// src/components/PluginIntegration.tsx
import React from 'react';
import { PluginManagerUI } from './plugins/PluginManagerUI';
import { pluginManager } from '../App';

export const PluginIntegration: React.FC = () => {
  return (
    <div>
      <h2>Plugin Management</h2>
      <PluginManagerUI pluginManager={pluginManager} />
    </div>
  );
};
```

### 3. Add Navigation

```typescript
// Add to your navigation component
import { Link } from 'react-router-dom';

const Navigation: React.FC = () => {
  return (
    <nav>
      <Link to="/plugins">Plugin Manager</Link>
    </nav>
  );
};
```

## Advanced Integration

### 1. Custom Plugin Loading

```typescript
// src/utils/pluginLoader.ts
import { pluginManager, pluginImporter } from '../App';

export class PluginLoader {
  static async loadFromDirectory(directory: string) {
    try {
      const plugins = await pluginManager.scanDirectory(directory);
      for (const pluginPath of plugins) {
        await pluginManager.registerFromPath(pluginPath);
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  }

  static async importFromZip(zipFile: File) {
    try {
      const result = await pluginImporter.importFromZip(zipFile);
      if (result.success) {
        // Refresh plugin list
        await pluginManager.refresh();
        return result;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }
}
```

### 2. Drag-and-Drop Integration

```typescript
// src/components/FileDropZone.tsx
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { PluginLoader } from '../utils/pluginLoader';
import { message } from 'antd';

export const FileDropZone: React.FC = () => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const zipFiles = acceptedFiles.filter(file => 
      file.type === 'application/zip' || file.name.endsWith('.zip')
    );

    for (const zipFile of zipFiles) {
      try {
        const result = await PluginLoader.importFromZip(zipFile);
        message.success(`Plugin "${result.plugin?.name}" installed successfully`);
      } catch (error) {
        message.error(`Failed to install ${zipFile.name}: ${error}`);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip']
    }
  });

  return (
    <div {...getRootProps()} className="drop-zone">
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop plugin ZIP files here...</p>
      ) : (
        <p>Drag 'n' drop plugin ZIP files here, or click to select</p>
      )}
    </div>
  );
};
```

### 3. Plugin Context Provider

```typescript
// src/contexts/PluginContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { pluginManager } from '../App';
import { Plugin } from './plugins/core/PluginSystem';

interface PluginContextType {
  plugins: Plugin[];
  loading: boolean;
  refreshPlugins: () => Promise<void>;
}

const PluginContext = createContext<PluginContextType | undefined>(undefined);

export const PluginProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPlugins = async () => {
    setLoading(true);
    try {
      const registeredPlugins = pluginManager.list();
      setPlugins(registeredPlugins);
    } catch (error) {
      console.error('Failed to refresh plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPlugins();
  }, []);

  return (
    <PluginContext.Provider value={{ plugins, loading, refreshPlugins }}>
      {children}
    </PluginContext.Provider>
  );
};

export const usePlugins = () => {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugins must be used within PluginProvider');
  }
  return context;
};
```

### 4. Plugin Configuration

```typescript
// src/config/pluginConfig.ts
export const pluginConfig = {
  // Plugin directory
  pluginsDirectory: './plugins',
  
  // Allowed file extensions
  allowedExtensions: ['.zip'],
  
  // Maximum file size (10MB)
  maxFileSize: 10 * 1024 * 1024,
  
  // Security settings
  security: {
    enableSandbox: true,
    maxPermissions: {
      fileSystem: ['read', 'write'],
      network: ['fetch'],
      system: []
    }
  },
  
  // Auto-update settings
  autoUpdate: {
    enabled: false,
    checkInterval: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

## Usage Examples

### 1. Basic Plugin Installation

```typescript
import { PluginManagerUI } from './components/plugins/PluginManagerUI';
import { pluginManager } from './App';

function PluginPage() {
  return (
    <div>
      <h1>Plugin Manager</h1>
      <PluginManagerUI pluginManager={pluginManager} />
    </div>
  );
}
```

### 2. Custom Plugin Uploader

```typescript
import React, { useRef } from 'react';
import { Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { PluginLoader } from './utils/pluginLoader';

function PluginUploader() {
  const handleUpload = async (file: File) => {
    try {
      await PluginLoader.importFromZip(file);
      return true;
    } catch (error) {
      return false;
    }
  };

  return (
    <Upload
      accept=".zip"
      customRequest={({ file, onSuccess, onError }) => {
        handleUpload(file as File)
          .then(() => onSuccess?.(null, file))
          .catch(onError);
      }}
    >
      <Button icon={<UploadOutlined />}>Upload Plugin</Button>
    </Upload>
  );
}
```

### 3. Plugin Status Monitoring

```typescript
import React, { useEffect } from 'react';
import { usePlugins } from './contexts/PluginContext';

function PluginStatus() {
  const { plugins, loading, refreshPlugins } = usePlugins();

  useEffect(() => {
    const interval = setInterval(refreshPlugins, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [refreshPlugins]);

  if (loading) return <div>Loading plugins...</div>;

  return (
    <div>
      <h3>Active Plugins: {plugins.length}</h3>
      {plugins.map(plugin => (
        <div key={plugin.metadata.id}>
          {plugin.metadata.name} - {plugin.metadata.version}
        </div>
      ))}
    </div>
  );
}
```

## Testing Your Integration

### 1. Test Plugin Installation

```typescript
// test/plugin.test.ts
import { pluginManager } from '../src/App';
import { ZipPluginImporter } from '../src/plugins/import/ZipPluginImporter';

describe('Plugin Integration', () => {
  it('should install plugin from ZIP', async () => {
    const zipFile = new File(['mock content'], 'test-plugin.zip');
    const importer = new ZipPluginImporter();
    
    const result = await importer.importFromZip(zipFile);
    expect(result.success).toBe(true);
    
    const plugins = pluginManager.list();
    expect(plugins).toHaveLength(1);
  });
});
```

### 2. Test Plugin Manager UI

```typescript
// test/PluginManagerUI.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PluginManagerUI } from '../src/components/plugins/PluginManagerUI';
import { pluginManager } from '../src/App';

test('renders plugin manager', () => {
  render(<PluginManagerUI pluginManager={pluginManager} />);
  expect(screen.getByText('Plugin Manager')).toBeInTheDocument();
});
```

## Next Steps

1. **Install sample plugins** from the `samples/` directory
2. **Create your own plugin** using the hello-world template
3. **Test the drag-and-drop functionality** with sample ZIP files
4. **Customize the UI** to match your application's design
5. **Add plugin-specific features** to your main application

## Support

For issues or questions:
- Check the troubleshooting section in PLUGIN_IMPORT_GUIDE.md
- Review the sample plugins in the samples/ directory
- Submit issues to the project repository