import Anthropic from '@anthropic-ai/sdk';
import { LoggerService } from './logger';

export interface AIRequest {
  code: string;
  language?: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
}

export interface CompletionRequest extends AIRequest {
  cursorPosition?: number;
  prefix?: string;
  suffix?: string;
}

export interface ReviewRequest extends AIRequest {
  reviewType?: 'detailed' | 'quick';
}

export interface AnalysisRequest extends AIRequest {
  analysisType: 'performance' | 'security' | 'complexity' | 'maintainability';
}

export interface BugDetectionRequest extends AIRequest {
  severity?: 'low' | 'medium' | 'high' | 'all';
}

export interface TestGenerationRequest extends AIRequest {
  testFramework?: string;
  coverageTarget?: number;
}

export interface DocumentationRequest extends AIRequest {
  docType?: 'inline' | 'summary' | 'api';
}

export interface ChatRequest {
  message: string;
  context?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export class AIService {
  private client: Anthropic;
  private logger: LoggerService;
  private defaultModel = 'claude-3-5-sonnet-20241022';

  constructor(logger: LoggerService) {
    this.logger = logger;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  async completeCode(request: CompletionRequest): Promise<AIResponse> {
    const prompt = this.buildCompletionPrompt(request);
    return this.callAI(prompt, request.maxTokens || 1000, request.temperature || 0.1);
  }

  async reviewCode(request: ReviewRequest): Promise<AIResponse> {
    const prompt = this.buildReviewPrompt(request);
    const maxTokens = request.reviewType === 'quick' ? 500 : 1500;
    return this.callAI(prompt, maxTokens, 0.3);
  }

  async analyzeCode(request: AnalysisRequest): Promise<AIResponse> {
    const prompt = this.buildAnalysisPrompt(request);
    return this.callAI(prompt, 1200, 0.2);
  }

  async detectBugs(request: BugDetectionRequest): Promise<AIResponse> {
    const prompt = this.buildBugDetectionPrompt(request);
    return this.callAI(prompt, 1000, 0.2);
  }

  async generateTests(request: TestGenerationRequest): Promise<AIResponse> {
    const prompt = this.buildTestGenerationPrompt(request);
    return this.callAI(prompt, 1500, 0.3);
  }

  async generateDocumentation(request: DocumentationRequest): Promise<AIResponse> {
    const prompt = this.buildDocumentationPrompt(request);
    const maxTokens = request.docType === 'inline' ? 800 : 1200;
    return this.callAI(prompt, maxTokens, 0.2);
  }

  async chat(request: ChatRequest): Promise<AIResponse> {
    const messages = this.buildChatMessages(request);
    return this.callAIWithMessages(messages, request.maxTokens || 800, request.temperature || 0.7);
  }

  private buildCompletionPrompt(request: CompletionRequest): string {
    const language = request.language || 'unknown';
    const context = request.context || '';
    
    return `You are an expert ${language} developer. Provide code completion based on the context.

Context: ${context}

Current code:
\`\`\`${language}
${request.code}
\`\`\`

Complete the code naturally, maintaining consistency with the existing style and patterns.
Focus on providing only the completion, not the full code.

Completion:`;
  }

  private buildReviewPrompt(request: ReviewRequest): string {
    const language = request.language || 'unknown';
    const reviewType = request.reviewType || 'detailed';
    const context = request.context || '';

    const focus = reviewType === 'quick' 
      ? 'Focus on the most critical issues only'
      : 'Provide comprehensive review covering all aspects';

    return `You are a senior ${language} code reviewer. Review the following code for quality, best practices, and potential issues.

Context: ${context}

Code to review:
\`\`\`${language}
${request.code}
\`\`\`

${focus}. Consider:
- Code quality and readability
- Best practices and conventions
- Potential bugs or security issues
- Performance implications
- Maintainability concerns

Provide structured feedback with specific line references when applicable.`;
  }

  private buildAnalysisPrompt(request: AnalysisRequest): string {
    const language = request.language || 'unknown';
    const analysisType = request.analysisType;

    const analysisFocus = {
      performance: 'performance bottlenecks, efficiency improvements, algorithmic complexity',
      security: 'security vulnerabilities, input validation, authentication, data protection',
      complexity: 'code complexity, cyclomatic complexity, maintainability metrics',
      maintainability: 'code organization, readability, testability, documentation needs'
    }[analysisType];

    return `You are a ${language} expert specializing in ${analysisType} analysis. Analyze the following code for ${analysisFocus}.

Code to analyze:
\`\`\`${language}
${request.code}
\`\`\`

Provide detailed analysis with:
- Specific findings and locations
- Severity levels (Critical, High, Medium, Low)
- Concrete improvement suggestions
- Code examples for fixes where applicable`;
  }

  private buildBugDetectionPrompt(request: BugDetectionRequest): string {
    const language = request.language || 'unknown';
    const severity = request.severity || 'all';

    return `You are a ${language} debugging expert. Analyze the following code for potential bugs and issues.

Code to analyze:
\`\`\`${language}
${request.code}
\`\`\`

Find bugs including but not limited to:
- Logic errors
- Null pointer exceptions
- Off-by-one errors
- Race conditions
- Memory leaks
- Incorrect error handling
- Type mismatches

${severity !== 'all' ? `Focus on ${severity} severity issues.` : ''}

Provide:
- Bug description and location
- Root cause analysis
- Suggested fixes with code examples
- Severity classification`;
  }

  private buildTestGenerationPrompt(request: TestGenerationRequest): string {
    const language = request.language || 'unknown';
    const framework = request.testFramework || 'standard';
    const coverageTarget = request.coverageTarget || 80;

    return `You are a ${language} testing expert. Generate comprehensive tests for the following code.

Code to test:
\`\`\`${language}
${request.code}
\`\`\`

Generate tests using ${framework} framework with ${coverageTarget}% coverage target.

Include tests for:
- Happy path scenarios
- Edge cases and boundary conditions
- Error handling
- Invalid inputs
- Performance considerations

Provide complete, runnable test code with proper assertions.`;
  }

  private buildDocumentationPrompt(request: DocumentationRequest): string {
    const language = request.language || 'unknown';
    const docType = request.docType || 'summary';

    const docFormat = {
      inline: 'Generate inline comments explaining complex logic',
      summary: 'Provide a comprehensive function/class documentation',
      api: 'Generate API documentation with parameters, return values, and examples'
    }[docType];

    return `You are a technical documentation expert for ${language}. ${docFormat}.

Code to document:
\`\`\`${language}
${request.code}
\`\`\`

Generate clear, concise documentation following best practices. Include examples where helpful.`;
  }

  private buildChatMessages(request: ChatRequest): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages = request.history || [];
    
    const systemPrompt = `You are an expert programming assistant. Help with:
- Code questions and explanations
- Debugging assistance
- Best practices advice
- Architecture guidance
- Language-specific help

Be helpful, accurate, and provide practical solutions.`;

    const context = request.context ? `Context: ${request.context}\n\n` : '';
    
    return [
      { role: 'user' as const, content: systemPrompt },
      ...messages,
      { role: 'user' as const, content: `${context}${request.message}` }
    ];
  }

  private async callAI(prompt: string, maxTokens: number, temperature: number): Promise<AIResponse> {
    try {
      this.logger.debug('Calling Claude API', { maxTokens, temperature });

      const response = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const result: AIResponse = {
        content: content.text,
        tokens: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens
        },
        model: response.model
      };

      this.logger.debug('Claude API response received', {
        promptTokens: result.tokens.prompt,
        completionTokens: result.tokens.completion,
        totalTokens: result.tokens.total
      });

      return result;
    } catch (error) {
      this.logger.error('Error calling Claude API', error);
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async callAIWithMessages(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number,
    temperature: number
  ): Promise<AIResponse> {
    try {
      this.logger.debug('Calling Claude API with message history', { maxTokens, temperature });

      const response = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: maxTokens,
        temperature,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const result: AIResponse = {
        content: content.text,
        tokens: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens
        },
        model: response.model
      };

      this.logger.debug('Claude API response received', {
        promptTokens: result.tokens.prompt,
        completionTokens: result.tokens.completion,
        totalTokens: result.tokens.total
      });

      return result;
    } catch (error) {
      this.logger.error('Error calling Claude API', error);
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}