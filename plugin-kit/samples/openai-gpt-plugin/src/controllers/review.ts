import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class ReviewController {
  constructor(
    private ai: AIService,
    private validation: ValidationService,
    private metrics: MetricsService,
    private logger: LoggerService
  ) {}

  async review(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validationResult = this.validation.validate('codeReview', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/review', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { code, language, rules, context } = validationResult.data!;

      this.logger.info('Code review requested', { 
        language, 
        codeLength: code.length,
        rulesCount: rules?.length || 0
      });

      // Generate review
      const result = await this.ai.reviewCode({
        code,
        language,
        rules,
        context
      });

      // Record metrics
      this.metrics.recordAIUsage('gpt-4', 0, 0); // Approximate token usage
      this.metrics.recordRequest('/api/review', 200, Date.now() - startTime);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Code review failed', error);
      this.metrics.recordError('review_error', '/api/review');
      this.metrics.recordRequest('/api/review', 500, Date.now() - startTime);

      res.status(500).json({
        success: false,
        error: 'Failed to review code',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async quickReview(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { code, language } = req.body;

      if (!code || typeof code !== 'string') {
        this.metrics.recordRequest('/api/review/quick', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Code is required'
        });
        return;
      }

      this.logger.info('Quick code review requested', { 
        language, 
        codeLength: code.length
      });

      // Quick review with default settings
      const result = await this.ai.reviewCode({
        code,
        language,
        rules: ['basic-quality', 'security-check']
      });

      // Simplify response for quick review
      const simplified = {
        score: result.score,
        issues: result.review.filter(r => r.severity === 'error' || r.severity === 'warning'),
        summary: result.summary
      };

      this.metrics.recordRequest('/api/review/quick', 200, Date.now() - startTime);

      res.json({
        success: true,
        data: simplified
      });
    } catch (error) {
      this.logger.error('Quick code review failed', error);
      this.metrics.recordError('quick_review_error', '/api/review/quick');
      this.metrics.recordRequest('/api/review/quick', 500, Date.now() - startTime);

      res.status(500).json({
        success: false,
        error: 'Failed to perform quick review',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}