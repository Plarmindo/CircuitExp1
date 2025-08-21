import { Plugin, PluginAPI } from '@circuitexp1/plugin-kit';
import { OpenAIService } from './services/openai-service';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { PromptEngine } from './services/prompt-engine';
import { ConversationManager } from './services/conversation-manager';

export interface OpenAIGPTPluginConfig {
  enabled: boolean;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  autoSave: boolean;
  showTokenCount: boolean;
}

export class OpenAIGPTPlugin implements Plugin {
  public readonly metadata = {
    id: 'openai-gpt-plugin',
    name: 'OpenAI GPT Plugin',
    version: '1.0.0',
    description: 'Advanced OpenAI GPT integration with chat, code completion, and analysis capabilities',
    author: 'CircuitExp1 Team',
    license: 'MIT',
    category: 'ai-integration' as const,
    ai: {
      platforms: ['openai'] as const,
      capabilities: ['chat-completion', 'code-completion', 'text-analysis'] as const
    }
  };

  private api: PluginAPI | null = null;
  private openaiService: OpenAIService | null = null;
  private promptEngine: PromptEngine | null = null;
  private conversationManager: ConversationManager | null = null;
  private config: OpenAIGPTPluginConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  async activate(api: PluginAPI): Promise<void> {
    this.api = api;
    
    try {
      await this.initializeServices();
      this.registerUIComponents();
      this.registerEventHandlers();
      this.setupCommands();
      
      api.logger.info('OpenAI GPT Plugin activated successfully');
    } catch (error) {
      api.logger.error('Failed to activate OpenAI GPT Plugin', error);
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    if (!this.api) return;

    try {
      await this.cleanup();
      this.api.logger.info('OpenAI GPT Plugin deactivated');
    } catch (error) {
      this.api.logger.error('Error during deactivation', error);
    }

    this.api = null;
    this.openaiService = null;
    this.promptEngine = null;
    this.conversationManager = null;
  }

  async onConfigChange(newConfig: Partial<OpenAIGPTPluginConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    if (this.openaiService) {
      this.openaiService.updateConfig(this.config);
    }
    
    if (this.api) {
      this.api.logger.info('OpenAI GPT Plugin configuration updated');
    }
  }

  private async initializeServices(): Promise<void> {
    if (!this.api) return;

    // Load configuration
    const savedConfig = await this.api.config.get<Partial<OpenAIGPTPluginConfig>>('openai-gpt');
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }

    // Initialize services
    this.openaiService = new OpenAIService(this.api, this.config);
    this.promptEngine = new PromptEngine(this.api);
    this.conversationManager = new ConversationManager(this.api);

    await this.openaiService.initialize();
    await this.conversationManager.initialize();
  }

  private registerUIComponents(): void {
    if (!this.api) return;

    // Register chat panel
    this.api.ui.registerPanel({
      id: 'openai-chat',
      title: 'OpenAI Chat',
      component: ChatPanel,
      icon: '💬',
      position: 'right',
      size: { width: 400 },
      resizable: true,
      closable: true
    });

    // Register settings panel
    this.api.ui.registerPanel({
      id: 'openai-settings',
      title: 'OpenAI Settings',
      component: SettingsPanel,
      icon: '⚙️',
      position: 'center',
      size: { width: 600, height: 500 },
      closable: true
    });

    // Add menu items
    this.api.ui.registerMenuItem({
      id: 'openai-chat-toggle',
      label: 'Toggle OpenAI Chat',
      action: () => this.toggleChatPanel(),
      accelerator: 'CmdOrCtrl+Shift+C'
    });

    this.api.ui.registerMenuItem({
      id: 'openai-settings',
      label: 'OpenAI Settings',
      action: () => this.openSettingsPanel()
    });
  }

  private registerEventHandlers(): void {
    if (!this.api) return;

    // Handle file events
    this.api.events.on('file:opened', async (file) => {
      if (this.config.enabled && this.promptEngine) {
        await this.promptEngine.onFileOpened(file);
      }
    });

    this.api.events.on('selection:changed', async (selection) => {
      if (this.config.enabled && this.promptEngine) {
        await this.promptEngine.onSelectionChanged(selection);
      }
    });

    // Handle configuration changes
    this.api.events.on('config:changed', async (config) => {
      if (config.openai) {
        await this.onConfigChange(config.openai);
      }
    });
  }

  private setupCommands(): void {
    if (!this.api) return;

    // Register commands
    this.api.commands.register({
      id: 'openai:chat',
      title: 'OpenAI Chat',
      handler: () => this.openChatPanel()
    });

    this.api.commands.register({
      id: 'openai:complete-code',
      title: 'Complete Code with OpenAI',
      handler: () => this.completeCode()
    });

    this.api.commands.register({
      id: 'openai:explain-code',
      title: 'Explain Selected Code',
      handler: () => this.explainCode()
    });

    this.api.commands.register({
      id: 'openai:generate-tests',
      title: 'Generate Unit Tests',
      handler: () => this.generateTests()
    });
  }

  private getDefaultConfig(): OpenAIGPTPluginConfig {
    return {
      enabled: true,
      model: 'gpt-4-turbo-preview',
      maxTokens: 2000,
      temperature: 0.7,
      autoSave: true,
      showTokenCount: true,
      systemPrompt: 'You are a helpful AI assistant integrated into CircuitExp1. You can help with coding, analysis, and answering questions about the current project.'
    };
  }

  private toggleChatPanel(): void {
    if (!this.api) return;
    this.api.ui.togglePanel('openai-chat');
  }

  private openChatPanel(): void {
    if (!this.api) return;
    this.api.ui.openPanel('openai-chat');
  }

  private openSettingsPanel(): void {
    if (!this.api) return;
    this.api.ui.openPanel('openai-settings');
  }

  private async completeCode(): Promise<void> {
    if (!this.openaiService || !this.api) return;

    try {
      const selection = await this.api.ui.getSelection();
      if (!selection) {
        this.api.ui.showNotification({
          title: 'Code Completion',
          message: 'Please select some code to complete',
          type: 'warning'
        });
        return;
      }

      const completion = await this.openaiService.completeCode(selection);
      await this.api.ui.insertText(completion);
    } catch (error) {
      this.api.logger.error('Failed to complete code', error);
      this.api.ui.showNotification({
        title: 'Code Completion Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'error'
      });
    }
  }

  private async explainCode(): Promise<void> {
    if (!this.openaiService || !this.api) return;

    try {
      const selection = await this.api.ui.getSelection();
      if (!selection) {
        this.api.ui.showNotification({
          title: 'Code Explanation',
          message: 'Please select code to explain',
          type: 'warning'
        });
        return;
      }

      const explanation = await this.openaiService.explainCode(selection);
      await this.api.ui.showInPanel('openai-chat', explanation);
    } catch (error) {
      this.api.logger.error('Failed to explain code', error);
      this.api.ui.showNotification({
        title: 'Code Explanation Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'error'
      });
    }
  }

  private async generateTests(): Promise<void> {
    if (!this.openaiService || !this.api) return;

    try {
      const selection = await this.api.ui.getSelection();
      const file = await this.api.ui.getCurrentFile();
      
      if (!file) {
        this.api.ui.showNotification({
          title: 'Test Generation',
          message: 'Please open a file to generate tests for',
          type: 'warning'
        });
        return;
      }

      const tests = await this.openaiService.generateTests(
        selection || await this.api.ui.getFileContent(),
        file.name
      );

      const testFileName = file.name.replace(/\..+$/, '.test.$&');
      await this.api.ui.createFile(testFileName, tests);
      
      this.api.ui.showNotification({
        title: 'Tests Generated',
        message: `Tests generated in ${testFileName}`,
        type: 'success'
      });
    } catch (error) {
      this.api.logger.error('Failed to generate tests', error);
      this.api.ui.showNotification({
        title: 'Test Generation Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'error'
      });
    }
  }

  private async cleanup(): Promise<void> {
    if (this.conversationManager) {
      await this.conversationManager.cleanup();
    }
    
    if (this.openaiService) {
      await this.openaiService.cleanup();
    }

    if (this.api) {
      this.api.ui.unregisterPanel('openai-chat');
      this.api.ui.unregisterPanel('openai-settings');
      this.api.ui.unregisterMenuItem('openai-chat-toggle');
      this.api.ui.unregisterMenuItem('openai-settings');
    }
  }
}

// Export for plugin registration
export default OpenAIGPTPlugin;