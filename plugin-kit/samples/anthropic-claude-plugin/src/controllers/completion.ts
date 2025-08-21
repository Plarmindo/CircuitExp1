import { Request, Response } from 'express';
import { AIService, CompletionRequest } from '../services/ai';
import { ValidationService } from '../services/validation';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class CompletionController {
  private aiService: AIService;
  private validation: ValidationService;
  private metrics: MetricsService;
  private logger: LoggerService;

  constructor(
    aiService: AIService,
    validation: ValidationService,
    metrics: MetricsService,
    logger: LoggerService
  ) {
    this.aiService = aiService;
    this.validation = validation;
    this.metrics = metrics;
    this.logger = logger;
  }

  async complete(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Validate input
      const validationResult = this.validation.sanitizeAndValidate<CompletionRequest>(req.body, 'completion');
      if (!validationResult.valid) {
        this.metrics.recordRequest('POST', '/api/completion', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          details: validationResult.errors,
          requestId
        });
        return;
      }

      const { code, language, context, maxTokens, temperature } = validationResult.data!;

      this.logger.info('Code completion request', {
        requestId,
        language,
        codeLength: code.length,
        contextLength: context?.length || 0
      });

      // Generate completion
      const completion = await this.aiService.completeCode({
        code,
        language,
        context,
        temperature,
        maxTokens
      });

      this.metrics.recordRequest('POST', '/api/completion', 200, Date.now() - startTime);
      this.metrics.recordAIUsage(completion.model || 'claude-3-sonnet-20240229', completion.tokens?.prompt || 0, completion.tokens?.completion || 0);

      res.json({
        success: true,
        data: {
          completion: completion.content,
          language,
          model: completion.model,
          usage: completion.tokens,
          suggestions: this.parseSuggestions(completion.content)
        },
        requestId
      });

    } catch (error) {
      this.metrics.recordRequest('POST', '/api/completion', 500, Date.now() - startTime);
      this.metrics.recordError('completion', '/api/completion', error instanceof Error ? error.message : 'Unknown error');
      
      this.logger.error('Code completion failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate completion',
        message: error instanceof Error ? error.message : 'Internal server error',
        requestId
      });
    }
  }

  async completeStream(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Validate input
      const validationResult = this.validation.sanitizeAndValidate<CompletionRequest>(req.body, 'completion');
      if (!validationResult.valid) {
        this.metrics.recordRequest('POST', '/api/completion/stream', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          details: validationResult.errors,
          requestId
        });
        return;
      }

      const { code, language, context, temperature, maxTokens } = validationResult.data!;

      this.logger.info('Streaming code completion request', {
        requestId,
        language,
        codeLength: code.length,
        contextLength: context?.length || 0
      });

      // Set up streaming response
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      let totalTokens = 0;
      let completionText = '';

      // Generate completion
      const result = await this.aiService.completeCode({
        code,
        language,
        context,
        maxTokens,
        temperature
      });

      res.json({
        success: true,
        data: {
          completion: result.content,
          language,
          model: result.model,
          usage: result.tokens,
          requestId
        }
      });

      this.metrics.recordRequest('POST', '/api/completion/stream', 200, Date.now() - startTime);
      this.metrics.recordAIUsage(result.model, result.tokens.prompt, result.tokens.completion);

      this.metrics.recordRequest('POST', '/api/completion/stream', 200, Date.now() - startTime);


    } catch (error) {
      this.metrics.recordRequest('POST', '/api/completion/stream', 500, Date.now() - startTime);
      this.metrics.recordError('completion-stream', '/api/completion/stream', error instanceof Error ? error.message : 'Unknown error');
      
      this.logger.error('Streaming code completion failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate completion',
          message: error instanceof Error ? error.message : 'Internal server error',
          requestId
        });
      } else {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: error instanceof Error ? error.message : 'Internal server error' 
        })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      }
    }
  }

  async suggest(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Validate input
      const validationResult = this.validation.sanitizeAndValidate<CompletionRequest>(req.body, 'completion');
      if (!validationResult.valid) {
        this.metrics.recordRequest('POST', '/api/completion/suggest', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          details: validationResult.errors,
          requestId
        });
        return;
      }

      const { code, language, context, temperature } = validationResult.data!;

      this.logger.info('Code suggestion request', {
        requestId,
        language,
        codeLength: code.length,
        contextLength: context?.length || 0
      });

      // Generate suggestions
      const suggestions = await this.aiService.completeCode({
        code,
        language,
        context,
        temperature
      });

      this.metrics.recordRequest('POST', '/api/completion/suggest', 200, Date.now() - startTime);
      this.metrics.recordAIUsage('claude-3-sonnet-20240229', suggestions.tokens.prompt, suggestions.tokens.completion);

      res.json({
        success: true,
        data: {
          suggestions: suggestions.content,
          language,
          model: suggestions.model,
          usage: suggestions.tokens,
          count: suggestions.content.length
        },
        requestId
      });

    } catch (error) {
      this.metrics.recordRequest('POST', '/api/completion/suggest', 500, Date.now() - startTime);
      this.metrics.recordError('suggestion', '/api/completion/suggest', error instanceof Error ? error.message : 'Unknown error');
      
      this.logger.error('Code suggestions failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate suggestions',
        message: error instanceof Error ? error.message : 'Internal server error',
        requestId
      });
    }
  }

  private parseSuggestions(completion: string): string[] {
    // Parse completion into individual suggestions
    const lines = completion.split('\n').filter(line => line.trim());
    const suggestions: string[] = [];
    
    for (const line of lines) {
      if (line.trim() && !line.trim().startsWith('//')) {
        suggestions.push(line.trim());
      }
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}