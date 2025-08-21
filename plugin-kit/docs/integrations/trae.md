# TRAE Integration Guide

Complete guide for integrating CircuitExp1 AI LLM Plugin Kit with TRAE IDE.

## Overview

The CircuitExp1 AI LLM Plugin Kit provides seamless integration with TRAE IDE through a dedicated adapter that enables AI-powered features directly within TRAE's development environment.

## Installation

### Method 1: TRAE Extension (Recommended)

1. Open TRAE IDE
2. Go to Extensions → Marketplace
3. Search for "CircuitExp1 AI LLM Plugin Kit"
4. Click Install
5. Reload TRAE IDE

### Method 2: Manual Installation

```bash
# Install via npm
npm install @circuitexp1/plugin-kit-trae-adapter

# Or via yarn
yarn add @circuitexp1/plugin-kit-trae-adapter
```

## Configuration

### Basic Configuration

Create `plugin-kit.config.json` in your project root:

```json
{
  "trae": {
    "adapter": {
      "type": "external",
      "endpoint": "http://localhost:3000",
      "apiKey": "your-plugin-kit-api-key"
    },
    "capabilities": {
      "codeCompletion": true,
      "codeReview": true,
      "bugDetection": true,
      "performanceAnalysis": true,
      "documentationGeneration": true,
      "testGeneration": true
    },
    "providers": {
      "openai": {
        "apiKey": "your-openai-key",
        "model": "gpt-4"
      },
      "anthropic": {
        "apiKey": "your-anthropic-key",
        "model": "claude-3-sonnet"
      }
    }
  }
}
```

### Advanced Configuration

```json
{
  "trae": {
    "adapter": {
      "type": "external",
      "endpoint": "https://api.circuitexp1.com/plugin-kit",
      "apiKey": "your-plugin-kit-api-key",
      "timeout": 30000,
      "retryPolicy": {
        "maxRetries": 3,
        "backoffMultiplier": 2
      }
    },
    "ui": {
      "position": "sidebar",
      "theme": "auto",
      "hotkeys": {
        "codeCompletion": "Ctrl+Space",
        "codeReview": "Ctrl+Shift+R",
        "bugDetection": "Ctrl+Shift+B"
      }
    },
    "security": {
      "enableCodeScanning": true,
      "excludePatterns": ["node_modules/**", ".git/**"],
      "maxFileSize": 1048576
    }
  }
}
```

## Features

### 1. AI-Powered Code Completion

```typescript
// TRAE will automatically trigger completion
const calculateTotal = (items: Item[]) => {
  // AI will suggest completion here
  return items.reduce((total, item) => total + item.price, 0);
};
```

### 2. Real-time Code Review

```typescript
// Hover over code to see AI suggestions
function processData(data: any[]) {
  // AI review: Consider using type safety
  // Suggestion: Use generic type parameter instead of 'any'
  return data.map(item => item.value);
}
```

### 3. Bug Detection

```typescript
// AI automatically detects potential issues
const divide = (a: number, b: number) => {
  return a / b; // AI warning: Division by zero risk
};
```

### 4. Performance Analysis

```typescript
// AI analyzes performance bottlenecks
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
  // AI suggests: Use memoization for better performance
}
```

### 5. Documentation Generation

```typescript
// AI generates comprehensive documentation
/**
 * Calculates the total price including tax
 * @param {number} basePrice - The base price before tax
 * @param {number} taxRate - The tax rate as a decimal (e.g., 0.08 for 8%)
 * @returns {number} The total price including tax
 * @example
 * calculateTotalWithTax(100, 0.08) // Returns 108
 */
function calculateTotalWithTax(basePrice: number, taxRate: number): number {
  return basePrice * (1 + taxRate);
}
```

## TRAE-Specific Commands

### Command Palette Integration

Open TRAE Command Palette (`Ctrl+Shift+P`) and use:

- `CircuitExp1: Enable AI Code Completion`
- `CircuitExp1: Review Current File`
- `CircuitExp1: Detect Bugs in Project`
- `CircuitExp1: Generate Documentation`
- `CircuitExp1: Create Tests`

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| AI Code Completion | `Ctrl+Space` |
| Code Review | `Ctrl+Shift+R` |
| Bug Detection | `Ctrl+Shift+B` |
| Generate Docs | `Ctrl+Shift+D` |
| Create Tests | `Ctrl+Shift+T` |

## Integration Examples

### 1. React Component Development

```typescript
// TRAE will provide AI assistance for React components
import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  userId: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // AI will suggest fetch implementation
    fetchUser(userId).then(setUser);
  }, [userId]);
  
  // AI will suggest rendering logic
  return (
    <div>
      {user && (
        <div>
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
      )}
    </div>
  );
};
```

### 2. Node.js API Development

```typescript
// AI assistance for Express.js routes
import express from 'express';

const router = express.Router();

// AI will suggest route structure and validation
router.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // AI will suggest validation logic
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // AI will suggest database operations
    const user = await createUser({ name, email });
    res.json(user);
  } catch (error) {
    // AI will suggest error handling
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## TRAE Settings Integration

### Settings.json Configuration

Add to your TRAE `settings.json`:

```json
{
  "circuitexp1.pluginKit": {
    "enabled": true,
    "endpoint": "http://localhost:3000",
    "apiKey": "your-api-key",
    "capabilities": {
      "codeCompletion": true,
      "codeReview": true,
      "bugDetection": true,
      "performanceAnalysis": true,
      "documentationGeneration": true,
      "testGeneration": true
    }
  },
  "circuitexp1.keybindings": {
    "codeCompletion": "ctrl+space",
    "codeReview": "ctrl+shift+r",
    "bugDetection": "ctrl+shift+b"
  }
}
```

## Testing Integration

### Unit Testing with AI

```typescript
// AI generates comprehensive test cases
describe('UserService', () => {
  let userService: UserService;
  
  beforeEach(() => {
    userService = new UserService();
  });
  
  // AI generates edge case tests
  it('should handle empty user list', async () => {
    const users = await userService.getUsers();
    expect(users).toEqual([]);
  });
  
  // AI generates integration tests
  it('should create user with valid data', async () => {
    const userData = { name: 'John Doe', email: 'john@example.com' };
    const user = await userService.createUser(userData);
    expect(user).toMatchObject(userData);
  });
});
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check if plugin kit service is running
   - Verify endpoint URL in configuration
   - Check firewall settings

2. **API Key Issues**
   - Ensure API key is valid and active
   - Check rate limits
   - Verify permissions

3. **Performance Issues**
   - Adjust timeout settings
   - Enable caching
   - Check network latency

### Debug Mode

Enable debug logging in TRAE:

```json
{
  "circuitexp1.pluginKit": {
    "debug": true,
    "logLevel": "verbose"
  }
}
```

## Advanced Features

### Custom AI Providers

```typescript
// Add custom AI provider
import { PluginKit } from '@circuitexp1/plugin-kit-trae-adapter';

PluginKit.addProvider('custom-ai', {
  endpoint: 'https://your-custom-ai.com/api',
  headers: {
    'Authorization': 'Bearer your-token'
  },
  capabilities: ['code-completion', 'bug-detection']
});
```

### Workspace-Specific Configuration

```json
{
  "circuitexp1.pluginKit": {
    "workspaces": {
      "frontend": {
        "capabilities": {
          "codeCompletion": true,
          "testGeneration": true
        }
      },
      "backend": {
        "capabilities": {
          "performanceAnalysis": true,
          "securityScanning": true
        }
      }
    }
  }
}
```

## Migration from Internal Plugin System

If migrating from CircuitExp1's internal plugin system:

1. **Update Dependencies**
   ```bash
   npm uninstall @circuitexp1/plugin-kit-internal
   npm install @circuitexp1/plugin-kit-trae-adapter
   ```

2. **Update Configuration**
   - Change from internal to external endpoints
   - Update API keys and authentication
   - Migrate plugin configurations

3. **Test Integration**
   - Run compatibility tests
   - Verify all capabilities work
   - Check performance metrics

## Support

- **TRAE-Specific Issues**: Open issue at https://github.com/circuitexp1/plugin-kit-trae-adapter/issues
- **General Support**: integration-support@circuitexp1.com
- **TRAE Community**: https://discord.gg/trae-plugin-kit