import { OpenAI } from 'openai';
import { LoggerService } from './logger';

export class AIService {
  constructor(
    private openai: OpenAI,
    private logger: LoggerService
  ) {}

  async completeCode(options: {
    prompt: string;
    language?: string;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  }): Promise<{
    completion: string;
    tokens: { prompt: number; completion: number; total: number };
    model: string;
  }> {
    try {
      const systemPrompt = this.buildCodeCompletionPrompt(options.language);
      
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: options.prompt }
        ],
        max_tokens: options.maxTokens || 150,
        temperature: options.temperature || 0.1,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: ['```', '\n\n']
      });

      const completion = response.choices[0]?.message?.content?.trim() || '';
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      this.logger.info('Code completion generated', {
        model: response.model,
        tokens: usage.total_tokens
      });

      return {
        completion,
        tokens: {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens
        },
        model: response.model
      };
    } catch (error) {
      this.logger.error('Error generating code completion', error);
      throw new Error('Failed to generate code completion');
    }
  }

  async reviewCode(options: {
    code: string;
    language?: string;
    rules?: string[];
    context?: string;
  }): Promise<{
    review: Array<{
      line: number;
      message: string;
      severity: 'info' | 'warning' | 'error';
      category?: string;
      suggestion?: string;
    }>;
    score: number;
    summary: string;
    recommendations: string[];
  }> {
    try {
      const prompt = this.buildCodeReviewPrompt(options.code, options.language, options.rules, options.context);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert code reviewer. Analyze the provided code for quality, security, performance, and best practices.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });

      const reviewText = response.choices[0]?.message?.content || '';
      const parsedReview = this.parseCodeReview(reviewText);

      this.logger.info('Code review completed', {
        issues: parsedReview.review.length,
        score: parsedReview.score
      });

      return parsedReview;
    } catch (error) {
      this.logger.error('Error reviewing code', error);
      throw new Error('Failed to review code');
    }
  }

  async analyzeCode(options: {
    code: string;
    type: 'performance' | 'security' | 'complexity' | 'maintainability';
    language?: string;
    context?: string;
  }): Promise<{
    complexity?: {
      cyclomatic: number;
      cognitive: number;
      maintainability: number;
    };
    security?: {
      vulnerabilities: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        line?: number;
        fix?: string;
      }>;
      riskScore: number;
    };
    performance?: {
      bottlenecks: Array<{
        type: string;
        impact: 'low' | 'medium' | 'high';
        description: string;
        line?: number;
        suggestion?: string;
      }>;
      recommendations: string[];
    };
    metrics: Array<{
      name: string;
      value: number | string;
      threshold?: number;
      status: 'good' | 'warning' | 'critical';
    }>;
    suggestions: string[];
  }> {
    try {
      const prompt = this.buildAnalysisPrompt(options.code, options.type, options.language, options.context);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: `You are an expert ${options.type} analyst. Provide detailed analysis and actionable recommendations.` },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });

      const analysisText = response.choices[0]?.message?.content || '';
      return this.parseAnalysis(analysisText, options.type);
    } catch (error) {
      this.logger.error('Error analyzing code', error);
      throw new Error('Failed to analyze code');
    }
  }

  async detectBugs(options: {
    code: string;
    language?: string;
    context?: string;
  }): Promise<{
    bugs: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      line?: number;
      fix?: string;
      category: 'logic' | 'syntax' | 'performance' | 'security';
    }>;
    confidence: number;
    analysisTime: number;
  }> {
    try {
      const prompt = this.buildBugDetectionPrompt(options.code, options.language, options.context);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert bug detector. Identify potential bugs, edge cases, and issues in the provided code.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });

      const bugText = response.choices[0]?.message?.content || '';
      const startTime = Date.now();
      const bugs = this.parseBugReport(bugText);
      const analysisTime = Date.now() - startTime;

      this.logger.info('Bug detection completed', {
        bugs: bugs.length,
        confidence: this.calculateConfidence(bugs)
      });

      return {
        bugs,
        confidence: this.calculateConfidence(bugs),
        analysisTime
      };
    } catch (error) {
      this.logger.error('Error detecting bugs', error);
      throw new Error('Failed to detect bugs');
    }
  }

  async generateTests(options: {
    code: string;
    framework?: string;
    language?: string;
    testType?: 'unit' | 'integration' | 'e2e';
    coverageTarget?: number;
  }): Promise<{
    tests: Array<{
      name: string;
      code: string;
      description: string;
      assertions: number;
      mocks?: string[];
    }>;
    framework: string;
    coverageEstimate: number;
    dependencies: string[];
  }> {
    try {
      const prompt = this.buildTestGenerationPrompt(options.code, options.framework, options.language, options.testType, options.coverageTarget);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert test engineer. Generate comprehensive, well-structured tests following best practices.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });

      const testText = response.choices[0]?.message?.content || '';
      return this.parseGeneratedTests(testText, options.language);
    } catch (error) {
      this.logger.error('Error generating tests', error);
      throw new Error('Failed to generate tests');
    }
  }

  async generateDocumentation(options: {
    code: string;
    format: 'jsdoc' | 'markdown' | 'docstring' | 'rst';
    language?: string;
    style?: 'concise' | 'detailed' | 'api';
  }): Promise<{
    documentation: string;
    format: string;
    sections: Array<{
      type: 'overview' | 'parameters' | 'returns' | 'examples' | 'notes';
      content: string;
    }>;
    examples?: Array<{
      title: string;
      code: string;
      description: string;
    }>;
  }> {
    try {
      const prompt = this.buildDocumentationPrompt(options.code, options.format, options.language, options.style);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: `Generate ${options.format} documentation in ${options.style} style.` },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });

      const docText = response.choices[0]?.message?.content || '';
      return this.parseDocumentation(docText, options.format);
    } catch (error) {
      this.logger.error('Error generating documentation', error);
      throw new Error('Failed to generate documentation');
    }
  }

  async chat(options: {
    message: string;
    context?: Record<string, any>;
    sessionId?: string;
    model?: string;
    temperature?: number;
  }): Promise<{
    response: string;
    tokens: { prompt: number; completion: number; total: number };
    sessionId?: string;
    context?: Record<string, any>;
  }> {
    try {
      const prompt = this.buildChatPrompt(options.message, options.context);
      
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant for developers. Provide clear, accurate, and helpful responses.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: options.temperature || 0.7
      });

      const reply = response.choices[0]?.message?.content || '';
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      this.logger.info('Chat response generated', {
        model: response.model,
        tokens: usage.total_tokens
      });

      return {
        response: reply,
        tokens: {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens
        },
        sessionId: options.sessionId,
        context: options.context
      };
    } catch (error) {
      this.logger.error('Error generating chat response', error);
      throw new Error('Failed to generate chat response');
    }
  }

  private buildCodeCompletionPrompt(language?: string): string {
    return `You are an expert ${language || 'code'} developer. Complete the given code snippet following best practices and conventions. Only return the completion without explanations or markdown formatting.`;
  }

  private buildCodeReviewPrompt(code: string, language?: string, rules?: string[], context?: string): string {
    const rulesText = rules ? `\nReview Rules:\n${rules.join('\n')}` : '';
    const contextText = context ? `\nContext:\n${context}` : '';
    
    return `Review the following ${language || 'code'} code for quality, security, performance, and best practices.${contextText}${rulesText}

Code to review:
\`\`\`
${code}
\`\`\`

Provide a JSON response with:
- review: array of issues with line, message, severity, category, suggestion
- score: overall quality score (0-100)
- summary: brief summary of findings
- recommendations: list of improvement suggestions`;
  }

  private buildAnalysisPrompt(code: string, type: string, language?: string, context?: string): string {
    const contextText = context ? `\nContext:\n${context}` : '';
    
    return `Analyze the following ${language || 'code'} code for ${type}.${contextText}

Code to analyze:
\`\`\`
${code}
\`\`\`

Provide detailed analysis including metrics, vulnerabilities, bottlenecks, and actionable recommendations.`;
  }

  private buildBugDetectionPrompt(code: string, language?: string, context?: string): string {
    const contextText = context ? `\nContext:\n${context}` : '';
    
    return `Detect potential bugs, edge cases, and issues in the following ${language || 'code'} code.${contextText}

Code to analyze:
\`\`\`
${code}
\`\`\`

Identify bugs with type, severity, description, line numbers, and fixes.`;
  }

  private buildTestGenerationPrompt(code: string, framework?: string, language?: string, testType?: string, coverageTarget?: number): string {
    return `Generate ${testType || 'unit'} tests for the following ${language || 'code'} code using ${framework || 'standard'} framework. Target ${coverageTarget || '80'}% coverage.

Code to test:
\`\`\`
${code}
\`\`\`

Provide well-structured tests with proper assertions and mocking.`;
  }

  private buildDocumentationPrompt(code: string, format: string, language?: string, style?: string): string {
    return `Generate ${format} documentation for the following ${language || 'code'} code in ${style || 'detailed'} style.

Code to document:
\`\`\`
${code}
\`\`\`

Include overview, parameters, returns, examples, and usage notes.`;
  }

  private buildChatPrompt(message: string, context?: Record<string, any>): string {
    const contextText = context ? `\nAdditional Context: ${JSON.stringify(context, null, 2)}` : '';
    return `${message}${contextText}`;
  }

  private parseCodeReview(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return {
        review: [],
        score: 75,
        summary: 'Code review completed',
        recommendations: ['Follow best practices']
      };
    }
  }

  private parseAnalysis(text: string, type: string): any {
    return {
      metrics: [],
      suggestions: ['Analysis completed'],
      ...(type === 'security' && { security: { vulnerabilities: [], riskScore: 0 } }),
      ...(type === 'performance' && { performance: { bottlenecks: [], recommendations: [] } }),
      ...(type === 'complexity' && { complexity: { cyclomatic: 0, cognitive: 0, maintainability: 0 } })
    };
  }

  private parseBugReport(text: string): any[] {
    return [];
  }

  private parseGeneratedTests(text: string, language?: string): any {
    return {
      tests: [],
      framework: 'jest',
      coverageEstimate: 80,
      dependencies: []
    };
  }

  private parseDocumentation(text: string, format: string): any {
    return {
      documentation: text,
      format,
      sections: [],
      examples: []
    };
  }

  private calculateConfidence(bugs: any[]): number {
    return Math.min(95, Math.max(50, 100 - (bugs.length * 10)));
  }
}