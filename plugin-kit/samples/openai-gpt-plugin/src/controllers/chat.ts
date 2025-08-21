import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class ChatController {
  constructor(
    private ai: AIService,
    private validation: ValidationService,
    private metrics: MetricsService,
    private logger: LoggerService
  ) {}

  async chat(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validationResult = this.validation.validate('chat', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/chat', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { message, context, model, temperature, maxTokens } = validationResult.data!;

      this.logger.info('Chat requested', { 
        messageLength: message.length,
        contextLength: context?.length || 0,
        model,
        temperature,
        maxTokens
      });

      // Generate response
      const result = await this.ai.chat({
        message,
        context,
        model,
        temperature,
        maxTokens
      });

      // Record metrics
      this.metrics.recordAIUsage(result.model, result.tokens.prompt, result.tokens.completion);
      this.metrics.recordRequest('/api/chat', 200, Date.now() - startTime);

      res.json({
        success: true,
        data: {
          response: result.response,
          tokens: result.tokens,
          model: result.model
        }
      });
    } catch (error) {
      this.logger.error('Chat failed', error);
      this.metrics.recordError('chat_error', '/api/chat');
      this.metrics.recordRequest('/api/chat', 500, Date.now() - startTime);

      res.status(500).json({
        success: false,
        error: 'Failed to generate chat response',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async chatStream(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validationResult = this.validation.validate('chat', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/chat/stream', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { message, context, model, temperature, maxTokens } = validationResult.data!;

      this.logger.info('Streaming chat requested', { 
        messageLength: message.length,
        contextLength: context?.length || 0,
        model,
        temperature,
        maxTokens
      });

      // Set up streaming response
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Note: OpenAI streaming would be implemented here
      // For now, we'll simulate streaming with a single response
      const result = await this.ai.chat({
        message,
        context,
        model,
        temperature,
        maxTokens
      });

      // Simulate streaming chunks
      const chunks = result.response.split('\n');
      for (const chunk of chunks) {
        res.write(chunk + '\n');
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
      }

      this.metrics.recordAIUsage(result.model, result.tokens.prompt, result.tokens.completion);
      this.metrics.recordRequest('/api/chat/stream', 200, Date.now() - startTime);

      res.end();
    } catch (error) {
      this.logger.error('Streaming chat failed', error);
      this.metrics.recordError('chat_stream_error', '/api/chat/stream');
      this.metrics.recordRequest('/api/chat/stream', 500, Date.now() - startTime);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate streaming chat response',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      } else {
        res.end();
      }
    }
  }
}