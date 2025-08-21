import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { Logger } from 'winston';

export class ChatController {
  private aiService: AIService;
  private validationService: ValidationService;
  private logger: Logger;

  constructor(aiService: AIService, validationService: ValidationService, logger: Logger) {
    this.aiService = aiService;
    this.validationService = validationService;
    this.logger = logger;
  }

  async handleChat(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validationService.validate(req.body, 'chat');
      if (!validation.valid) {
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      const { message, context, sessionId } = req.body;
      
      this.logger.info('Processing chat request', { 
        message: message.substring(0, 50), 
        sessionId,
        hasContext: !!context
      });

      const result = await this.aiService.chat(message, { context, sessionId });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in chat handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleStreamingChat(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validationService.validate(req.body, 'chat');
      if (!validation.valid) {
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      const { message, context, sessionId } = req.body;
      
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Mock streaming chat response
      const responses = [
        'Hello! ',
        'I understand you want to discuss: ',
        message,
        '. Let me help you with that.',
        ' [DONE]'
      ];

      for (const response of responses) {
        res.write(`data: ${response}`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      res.write('\n\n');
      res.end();
    } catch (error) {
      this.logger.error('Error in streaming chat handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}