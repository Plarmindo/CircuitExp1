# CircuitExp1 Plugin API Documentation

## Overview

The CircuitExp1 plugin system provides a comprehensive API for extending the application's functionality while maintaining security and stability. This document outlines all available endpoints, authentication mechanisms, and usage patterns.

## Core API Endpoints

### Plugin Registration

#### Register Plugin
```typescript
POST /api/plugins/register
```

Registers a new plugin with the system.

**Request Body:**
```json
{
  "metadata": {
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "description": "Plugin description",
    "author": "Author Name",
    "license": "MIT",
    "engines": {
      "circuitexp1": ">=0.0.0"
    }
  },
  "code": "/* plugin code */"
}
```

**Response:**
```json
{
  "success": true,
  "pluginId": "my-plugin",
  "status": "registered"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid plugin metadata
- `409 Conflict`: Plugin ID already exists
- `422 Unprocessable Entity`: Validation errors

### Plugin Management

#### List Plugins
```typescript
GET /api/plugins
```

Lists all registered plugins.

**Query Parameters:**
- `status`: Filter by status (registered, enabled, disabled)
- `type`: Filter by plugin type

**Response:**
```json
{
  "plugins": [
    {
      "id": "my-plugin",
      "name": "My Plugin",
      "version": "1.0.0",
      "status": "enabled",
      "description": "Plugin description",
      "author": "Author Name"
    }
  ]
}
```

#### Enable Plugin
```typescript
POST /api/plugins/:pluginId/enable
```

Enables a registered plugin.

**Response:**
```json
{
  "success": true,
  "status": "enabled"
}
```

#### Disable Plugin
```typescript
POST /api/plugins/:pluginId/disable
```

Disables an enabled plugin.

**Response:**
```json
{
  "success": true,
  "status": "disabled"
}
```

#### Get Plugin Info
```typescript
GET /api/plugins/:pluginId
```

Gets detailed information about a specific plugin.

**Response:**
```json
{
  "id": "my-plugin",
  "metadata": {
    "name": "My Plugin",
    "version": "1.0.0",
    "description": "Plugin description",
    "author": "Author Name",
    "homepage": "https://example.com",
    "repository": "https://github.com/user/repo"
  },
  "status": "enabled",
  "configuration": {
    "setting1": "value1",
    "setting2": "value2"
  },
  "stats": {
    "activationCount": 5,
    "lastActivated": "2024-01-15T10:30:00Z"
  }
}
```

### Configuration Management

#### Get Plugin Configuration
```typescript
GET /api/plugins/:pluginId/config
```

Gets the current configuration for a plugin.

**Response:**
```json
{
  "pluginId": "my-plugin",
  "config": {
    "setting1": "value1",
    "setting2": "value2"
  }
}
```

#### Update Plugin Configuration
```typescript
PUT /api/plugins/:pluginId/config
```

Updates plugin configuration.

**Request Body:**
```json
{
  "setting1": "new-value",
  "setting2": "new-value2"
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "setting1": "new-value",
    "setting2": "new-value2"
  }
}
```

### Event System

#### Subscribe to Events
```typescript
POST /api/events/subscribe
```

Subscribes to system events.

**Request Body:**
```json
{
  "pluginId": "my-plugin",
  "events": ["theme:changed", "config:changed"]
}
```

**Response:**
```json
{
  "subscriptionId": "sub-123",
  "events": ["theme:changed", "config:changed"]
}
```

#### Emit Event
```typescript
POST /api/events/emit
```

Emits a custom event.

**Request Body:**
```json
{
  "event": "custom:event",
  "data": { "key": "value" },
  "target": "*" // or specific plugin ID
}
```

### Data Storage

#### Store Data
```typescript
POST /api/data/:pluginId
```

Stores plugin-specific data.

**Request Body:**
```json
{
  "key": "user-preferences",
  "value": {
    "theme": "dark",
    "layout": "grid"
  }
}
```

#### Retrieve Data
```typescript
GET /api/data/:pluginId/:key
```

Retrieves stored plugin data.

**Response:**
```json
{
  "key": "user-preferences",
  "value": {
    "theme": "dark",
    "layout": "grid"
  }
}
```

#### Delete Data
```typescript
DELETE /api/data/:pluginId/:key
```

Deletes stored plugin data.

### UI Integration

#### Register Component
```typescript
POST /api/ui/components/register
```

Registers a new UI component.

**Request Body:**
```json
{
  "pluginId": "my-plugin",
  "componentType": "toolbar",
  "componentName": "MyToolbar",
  "componentCode": "/* React component code */",
  "props": {
    "title": "My Toolbar",
    "icon": "settings"
  }
}
```

#### Unregister Component
```typescript
DELETE /api/ui/components/:componentId
```

Unregisters a UI component.

### File System Access

#### Read File
```typescript
GET /api/fs/read
```

Reads a file with sandboxed access.

**Query Parameters:**
- `path`: Relative path within plugin's sandbox
- `encoding`: File encoding (default: 'utf8')

**Response:**
```json
{
  "content": "file content here",
  "size": 1024,
  "modified": "2024-01-15T10:30:00Z"
}
```

#### Write File
```typescript
POST /api/fs/write
```

Writes a file with sandboxed access.

**Request Body:**
```json
{
  "path": "config/settings.json",
  "content": "{ \"key\": \"value\" }",
  "encoding": "utf8"
}
```

### Network Access

#### Fetch Resource
```typescript
POST /api/network/fetch
```

Fetches external resources with security controls.

**Request Body:**
```json
{
  "url": "https://api.example.com/data",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer token"
  },
  "timeout": 5000
}
```

**Response:**
```json
{
  "status": 200,
  "data": { "response": "data" },
  "headers": { "content-type": "application/json" }
}
```

## Authentication & Authorization

### API Key Authentication

All API endpoints require authentication using API keys:

```http
Authorization: Bearer <plugin-api-key>
```

### Permission Levels

- **basic**: Read-only access to plugin data and configuration
- **standard**: Full plugin management (register, enable, disable)
- **admin**: System-wide plugin management and configuration

### Obtaining API Keys

```typescript
POST /api/auth/token
```

**Request Body:**
```json
{
  "pluginId": "my-plugin",
  "permissions": ["basic", "standard"]
}
```

**Response:**
```json
{
  "token": "plugin-api-key-here",
  "expires": "2024-12-31T23:59:59Z",
  "permissions": ["basic", "standard"]
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "additional context"
    }
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `PLUGIN_NOT_FOUND` | Plugin does not exist | 404 |
| `PLUGIN_ALREADY_EXISTS` | Plugin ID already registered | 409 |
| `INVALID_PLUGIN_METADATA` | Plugin metadata validation failed | 422 |
| `SECURITY_VIOLATION` | Security policy violation | 403 |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded | 429 |
| `NETWORK_ERROR` | Network access failed | 502 |
| `FILESYSTEM_ERROR` | File system operation failed | 500 |
| `CONFIG_ERROR` | Configuration validation failed | 400 |

### Error Handling Examples

#### Handling Plugin Registration Errors
```typescript
try {
  await pluginAPI.register(plugin);
} catch (error) {
  if (error.code === 'PLUGIN_ALREADY_EXISTS') {
    console.error('Plugin already registered');
  } else if (error.code === 'INVALID_PLUGIN_METADATA') {
    console.error('Validation errors:', error.details.errors);
  }
}
```

## Rate Limiting

### Limits

- **Registration**: 10 requests per minute
- **Configuration**: 100 requests per minute
- **Data Storage**: 1000 requests per minute
- **Network**: 50 requests per minute

### Headers

Rate limit information is provided in response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Plugin Events Webhook

Subscribe to plugin lifecycle events:

```typescript
POST /api/webhooks/subscribe
```

**Request Body:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": [
    "plugin:enabled",
    "plugin:disabled",
    "plugin:error"
  ],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload

```json
{
  "event": "plugin:enabled",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "pluginId": "my-plugin",
    "pluginName": "My Plugin"
  }
}
```

## SDK & Libraries

### TypeScript SDK

```typescript
import { PluginSDK } from '@circuitexp1/plugin-sdk';

const sdk = new PluginSDK({
  apiKey: 'your-api-key',
  baseURL: 'http://localhost:5175/api'
});

// Register a plugin
await sdk.plugins.register({
  metadata: pluginMetadata,
  activate: async (api) => {
    // Plugin activation logic
  }
});
```

### JavaScript SDK

```javascript
const CircuitExp1 = require('@circuitexp1/plugin-sdk');

const sdk = new CircuitExp1.PluginSDK({
  apiKey: 'your-api-key'
});

// Enable a plugin
await sdk.plugins.enable('my-plugin');
```

## Testing

### Test Endpoints

#### Test Plugin Registration
```typescript
POST /api/test/plugins/register
```

**Request Body:** Same as registration endpoint
**Response:** Test registration without persisting

#### Test Configuration
```typescript
POST /api/test/config/validate
```

**Request Body:**
```json
{
  "pluginId": "test-plugin",
  "config": {
    "test": "value"
  }
}
```

## Migration Guide

### From v1 to v2 API

#### Breaking Changes
- Plugin IDs must be kebab-case
- Configuration validation is stricter
- API keys now expire after 30 days

#### Migration Steps
1. Update plugin metadata format
2. Add required fields to configuration
3. Update API key handling
4. Test with new validation rules

## Support & Troubleshooting

### Common Issues

#### Plugin Won't Activate
- Check plugin metadata for required fields
- Verify API key permissions
- Check browser console for errors

#### Configuration Not Saving
- Ensure configuration schema is valid
- Check for validation errors in response
- Verify plugin has write permissions

#### Network Requests Failing
- Check security policy settings
- Verify allowed domains
- Check for CORS issues

### Debug Mode

Enable debug logging:

```typescript
POST /api/debug/enable
```

**Request Body:**
```json
{
  "pluginId": "my-plugin",
  "level": "debug"
}
```

### Support Channels

- **Documentation**: https://docs.circuitexp1.com/plugins
- **Issues**: https://github.com/circuitexp1/plugins/issues
- **Discord**: https://discord.gg/circuitexp1
- **Email**: plugins@circuitexp1.com