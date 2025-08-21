import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { Logger } from 'winston';

export class ReviewController {
  private aiService: AIService;
  private validationService: ValidationService;
  private logger: Logger;

  constructor(aiService: AIService, validationService: ValidationService, logger: Logger) {
    this.aiService = aiService;
    this.validationService = validationService;
    this.logger = logger;
  }

  async handleReview(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validationService.validate(req.body, 'review');
      if (!validation.valid) {
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      const { code, language, rules } = req.body;
      
      this.logger.info('Processing code review request', { 
        language, 
        codeLength: code.length,
        rules: rules?.length || 0
      });

      const result = await this.aiService.reviewCode(code, { language, rules });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in review handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleQuickReview(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ error: 'Code is required' });
        return;
      }

      const result = await this.aiService.reviewCode(code, { language: 'auto' });

      res.json({
        success: true,
        data: {
          score: result.score,
          issues: result.review.filter(r => r.severity === 'warning' || r.severity === 'error'),
          summary: `Code review completed with score ${result.score}/100`
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in quick review handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}