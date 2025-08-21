import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { Logger } from 'winston';

export class CompletionController {
  private aiService: AIService;
  private validationService: ValidationService;
  private logger: Logger;

  constructor(aiService: AIService, validationService: ValidationService, logger: Logger) {
    this.aiService = aiService;
    this.validationService = validationService;
    this.logger = logger;
  }

  async handleCompletion(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validationService.validate(req.body, 'completion');
      if (!validation.valid) {
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      const { prompt, provider, model, temperature, maxTokens } = req.body;
      
      this.logger.info('Processing completion request', { prompt: prompt.substring(0, 100), provider, model });

      const result = await this.aiService.completeCode(prompt, {
        provider,
        model,
        temperature,
        maxTokens
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in completion handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleStreamingCompletion(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validationService.validate(req.body, 'completion');
      if (!validation.valid) {
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      const { prompt, provider, model, temperature, maxTokens } = req.body;
      
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Mock streaming response
      const words = ['Hello', 'from', 'the', 'AI', 'assistant'];
      for (const word of words) {
        res.write(`data: ${word} `);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      this.logger.error('Error in streaming completion handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}