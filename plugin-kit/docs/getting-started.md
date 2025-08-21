# Getting Started with AI LLM Plugin Development

This guide will walk you through creating your first AI LLM plugin for CircuitExp1.

## Prerequisites

Before you begin, ensure you have:

- Node.js 18.0.0 or higher
- npm or yarn package manager
- CircuitExp1 development environment
- LLM platform API credentials

## Installation

### Option 1: Global CLI Installation

```bash
npm install -g @circuitexp1/plugin-kit
circuitexp1-plugin --version
```

### Option 2: Local Development

```bash
git clone https://github.com/your-org/circuitexp1-plugin-kit
cd circuitexp1-plugin-kit
npm install
```

## Creating Your First Plugin

### Step 1: Initialize Plugin

```bash
circuitexp1-plugin create my-ai-assistant --template openai-gpt
```

This creates a new plugin with the following structure:

```
my-ai-assistant/
├── src/
│   ├── index.ts              # Main plugin entry
│   ├── api/
│   │   ├── openai-client.ts  # OpenAI integration
│   │   └── types.ts          # Type definitions
│   ├── components/
│   │   ├── ChatPanel.tsx     # UI components
│   │   └── Settings.tsx
│   ├── services/
│   │   ├── chat-service.ts   # Business logic
│   │   └── prompt-engine.ts  # Prompt management
│   └── utils/
│       ├── validation.ts
│       └── formatting.ts
├── tests/
├── docs/
├── package.json
├── tsconfig.json
└── README.md
```

### Step 2: Configure API Keys

Create a `.env` file in your plugin directory:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_ORG_ID=your-org-id
OPENAI_MODEL=gpt-4-turbo-preview

# General Configuration
DEBUG_MODE=true
LOG_LEVEL=info
MAX_TOKENS=4000
TEMPERATURE=0.7
```

### Step 3: Install Dependencies

```bash
cd my-ai-assistant
npm install
```

### Step 4: Start Development Server

```bash
npm run dev
```

This starts the development server with hot-reload enabled.

## Understanding the Plugin Structure

### Core Files

#### `src/index.ts`
Main plugin entry point that implements the Plugin interface:

```typescript
import { Plugin, PluginAPI } from '@circuitexp1/plugin-kit';
import { OpenAIChatService } from './services/chat-service';
import { SettingsPanel } from './components/Settings';

export class MyAIAssistantPlugin implements Plugin {
  metadata = {
    id: 'my-ai-assistant',
    name: 'My AI Assistant',
    version: '1.0.0',
    description: 'AI-powered chat assistant',
    author: 'Your Name',
    license: 'MIT',
    category: 'ai-integration'
  };

  private chatService: OpenAIChatService;

  async activate(api: PluginAPI): Promise<void> {
    this.chatService = new OpenAIChatService(api);
    
    // Register UI components
    api.ui.registerPanel('ai-chat', ChatPanel);
    api.ui.registerSettings('ai-settings', SettingsPanel);
    
    // Set up event handlers
    api.events.on('file:opened', this.handleFileOpened.bind(this));
  }

  async deactivate(): Promise<void> {
    // Cleanup resources
    this.chatService?.cleanup();
  }
}
```

#### `src/services/chat-service.ts`
Service for handling AI chat functionality:

```typescript
import { PluginAPI } from '@circuitexp1/plugin-kit';
import { OpenAI } from 'openai';

export class OpenAIChatService {
  private client: OpenAI;
  private api: PluginAPI;

  constructor(api: PluginAPI) {
    this.api = api;
    this.client = new OpenAI({
      apiKey: api.config.get('OPENAI_API_KEY'),
    });
  }

  async sendMessage(message: string, context?: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.api.config.get('OPENAI_MODEL'),
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant integrated into CircuitExp1. ${context || ''}`
          },
          { role: 'user', content: message }
        ],
        max_tokens: this.api.config.get('MAX_TOKENS'),
        temperature: this.api.config.get('TEMPERATURE'),
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.api.log('error', 'Failed to send message to OpenAI', error);
      throw error;
    }
  }
}
```

### Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run test            # Run unit tests
npm run test:e2e        # Run end-to-end tests

# Quality assurance
npm run lint            # Run ESLint
npm run type-check      # TypeScript type checking
npm run validate        # Plugin validation

# Deployment
npm run package         # Create plugin package
npm run deploy          # Deploy to registry
```

## Testing Your Plugin

### Unit Tests

Create tests in the `tests/` directory:

```typescript
// tests/chat-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { OpenAIChatService } from '../src/services/chat-service';

describe('OpenAIChatService', () => {
  it('should send message successfully', async () => {
    const mockApi = {
      config: {
        get: vi.fn().mockReturnValue('mock-api-key'),
      },
      log: vi.fn(),
    };

    const service = new OpenAIChatService(mockApi as any);
    
    // Mock OpenAI client
    vi.spyOn(service.client.chat.completions, 'create').mockResolvedValue({
      choices: [{ message: { content: 'Hello from AI!' } }],
    });

    const response = await service.sendMessage('Hello');
    expect(response).toBe('Hello from AI!');
  });
});
```

### Integration Tests

```bash
npm run test:integration
```

## Debugging

### Enable Debug Mode

Set `DEBUG_MODE=true` in your `.env` file to enable detailed logging.

### Debug Commands

```bash
# Run with debug logging
DEBUG=* npm run dev

# Profile performance
npm run dev -- --profile

# Debug specific module
DEBUG=plugin:chat-service npm run dev
```

### Browser DevTools

- Open CircuitExp1 Developer Tools
- Navigate to the Plugins tab
- Select your plugin for debugging
- Use the console for real-time testing

## Next Steps

Now that you have your first plugin running:

1. **Customize the UI**: Modify components in `src/components/`
2. **Add Features**: Implement additional AI capabilities
3. **Optimize Performance**: Profile and optimize your plugin
4. **Add Tests**: Write comprehensive test suites
5. **Deploy**: Package and distribute your plugin

See [Platform Integration](./platform-integration.md) for integrating with specific LLM platforms.