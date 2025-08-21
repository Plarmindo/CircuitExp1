import OpenAI from 'openai';
import { PluginAPI } from '@circuitexp1/plugin-kit';
import { OpenAIGPTPluginConfig } from '../index';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: number;
}

export interface CodeCompletionRequest {
  code: string;
  language?: string;
  cursorPosition?: number;
  context?: string;
}

export interface CodeExplanationRequest {
  code: string;
  language?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
}

export interface TestGenerationRequest {
  code: string;
  fileName: string;
  framework?: string;
  testType?: 'unit' | 'integration' | 'e2e';
}

export class OpenAIService {
  private client: OpenAI | null = null;
  private api: PluginAPI;
  private config: OpenAIGPTPluginConfig;
  private messageHistory: ChatMessage[] = [];

  constructor(api: PluginAPI, config: OpenAIGPTPluginConfig) {
    this.api = api;
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required. Please configure it in settings.');
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true
    });

    await this.loadMessageHistory();
  }

  updateConfig(newConfig: OpenAIGPTPluginConfig): void {
    this.config = newConfig;
    
    if (newConfig.apiKey && this.client) {
      this.client = new OpenAI({
        apiKey: newConfig.apiKey,
        dangerouslyAllowBrowser: true
      });
    }
  }

  async sendChatMessage(message: string): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      this.messageHistory.push(userMessage);

      // Prepare messages for API
      const messages = [
        ...(this.config.systemPrompt ? [{ role: 'system' as const, content: this.config.systemPrompt }] : []),
        ...this.messageHistory.map(msg => ({ role: msg.role as any, content: msg.content }))
      ];

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Add assistant response to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content,
        timestamp: Date.now(),
        tokens: response.usage?.total_tokens
      };
      this.messageHistory.push(assistantMessage);

      // Save history if auto-save is enabled
      if (this.config.autoSave) {
        await this.saveMessageHistory();
      }

      return content;
    } catch (error) {
      this.api.logger.error('Failed to send chat message', error);
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async completeCode(request: CodeCompletionRequest): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = this.buildCodeCompletionPrompt(request);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert code completion AI. Provide only the code completion without explanations or additional text. Ensure the completion is syntactically correct and follows best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: Math.min(this.config.maxTokens, 500),
        temperature: 0.1
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      this.api.logger.error('Failed to complete code', error);
      throw new Error(`Code completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async explainCode(request: CodeExplanationRequest): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = this.buildCodeExplanationPrompt(request);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are a code explanation expert. Provide clear, concise explanations of the provided code. Adapt your explanation to the ${request.level || 'intermediate'} level.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.api.logger.error('Failed to explain code', error);
      throw new Error(`Code explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateTests(request: TestGenerationRequest): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = this.buildTestGenerationPrompt(request);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are a test generation expert. Generate comprehensive ${request.testType || 'unit'} tests for the provided code using ${request.framework || 'Jest'} framework. Ensure tests cover edge cases and provide good code coverage.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.2
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.api.logger.error('Failed to generate tests', error);
      throw new Error(`Test generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeCode(code: string, language?: string): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = `Analyze the following ${language || 'code'} and provide insights about:
- Code quality and best practices
- Potential improvements
- Security considerations
- Performance optimizations

Code:
${code}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a code analysis expert. Provide detailed, actionable insights about the provided code.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.api.logger.error('Failed to analyze code', error);
      throw new Error(`Code analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getMessageHistory(): ChatMessage[] {
    return [...this.messageHistory];
  }

  clearMessageHistory(): void {
    this.messageHistory = [];
    this.saveMessageHistory();
  }

  async saveConversation(name: string): Promise<void> {
    if (!this.api) return;

    const conversation = {
      name,
      messages: this.messageHistory,
      timestamp: Date.now(),
      config: this.config
    };

    await this.api.storage.set(`conversations/${name}`, conversation);
  }

  async loadConversation(name: string): Promise<void> {
    if (!this.api) return;

    const conversation = await this.api.storage.get(`conversations/${name}`);
    if (conversation) {
      this.messageHistory = conversation.messages || [];
      this.config = { ...this.config, ...conversation.config };
    }
  }

  private async loadMessageHistory(): Promise<void> {
    if (!this.api) return;

    const history = await this.api.storage.get('chat-history');
    if (history) {
      this.messageHistory = history.messages || [];
    }
  }

  private async saveMessageHistory(): Promise<void> {
    if (!this.api) return;

    await this.api.storage.set('chat-history', {
      messages: this.messageHistory,
      timestamp: Date.now()
    });
  }

  private buildCodeCompletionPrompt(request: CodeCompletionRequest): string {
    const { code, language, cursorPosition, context } = request;
    
    let prompt = `Complete the following ${language || 'code'}:

${code}`;

    if (cursorPosition) {
      prompt += `

Cursor position: ${cursorPosition}`;
    }

    if (context) {
      prompt += `

Context: ${context}`;
    }

    return prompt;
  }

  private buildCodeExplanationPrompt(request: CodeExplanationRequest): string {
    const { code, language, level } = request;
    
    return `Explain the following ${language || 'code'} at a ${level || 'intermediate'} level:

${code}

Please provide:
1. What the code does
2. Key concepts or patterns used
3. Any important considerations`;
  }

  private buildTestGenerationPrompt(request: TestGenerationRequest): string {
    const { code, fileName, framework, testType } = request;
    
    return `Generate ${testType || 'unit'} tests for the following code using ${framework || 'Jest'}:

File: ${fileName}

Code:
${code}

Requirements:
- Include setup and teardown if needed
- Test both happy path and edge cases
- Use descriptive test names
- Include assertions for expected behavior`;
  }

  async cleanup(): Promise<void> {
    if (this.config.autoSave) {
      await this.saveMessageHistory();
    }
    
    this.client = null;
  }
}