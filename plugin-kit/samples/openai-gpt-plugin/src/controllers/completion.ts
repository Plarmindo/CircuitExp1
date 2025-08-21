import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class CompletionController {
  constructor(
    private ai: AIService,
    private validation: ValidationService,
    private metrics: MetricsService,
    private logger: LoggerService
  ) {}

  async complete(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validationResult = this.validation.validate('codeCompletion', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/completion', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { prompt, language, maxTokens, temperature, model } = validationResult.data!;

      this.logger.info('Code completion requested', { 
        language, 
        maxTokens, 
        temperature, 
        model,
        promptLength: prompt.length 
      });

      // Generate completion
      const result = await this.ai.completeCode({
        prompt,
        language,
        maxTokens,
        temperature,
        model
      });

      // Record metrics
      this.metrics.recordAIUsage(result.model, result.tokens.prompt, result.tokens.completion);
      this.metrics.recordRequest('/api/completion', 200, Date.now() - startTime);

      res.json({
        success: true,
        data: {
          completion: result.completion,
          tokens: result.tokens,
          model: result.model
        }
      });
    } catch (error) {
      this.logger.error('Code completion failed', error);
      this.metrics.recordError('completion_error', '/api/completion');
      this.metrics.recordRequest('/api/completion', 500, Date.now() - startTime);

      res.status(500).json({
        success: false,
        error: 'Failed to generate completion',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async completeStream(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validationResult = this.validation.validate('codeCompletion', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/completion/stream', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { prompt, language, maxTokens, temperature, model } = validationResult.data!;

      this.logger.info('Streaming code completion requested', { 
        language, 
        maxTokens, 
        temperature, 
        model,
        promptLength: prompt.length 
      });

      // Set up streaming response
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Note: OpenAI streaming would be implemented here
      // For now, we'll simulate streaming with a single response
      const result = await this.ai.completeCode({
        prompt,
        language,
        maxTokens,
        temperature,
        model
      });

      // Simulate streaming chunks
      const chunks = result.completion.split('\n');
      for (const chunk of chunks) {
        res.write(chunk + '\n');
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
      }

      this.metrics.recordAIUsage(result.model, result.tokens.prompt, result.tokens.completion);
      this.metrics.recordRequest('/api/completion/stream', 200, Date.now() - startTime);

      res.end();
    } catch (error) {
      this.logger.error('Streaming completion failed', error);
      this.metrics.recordError('completion_stream_error', '/api/completion/stream');
      this.metrics.recordRequest('/api/completion/stream', 500, Date.now() - startTime);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate streaming completion',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      } else {
        res.end();
      }
    }
  }
}