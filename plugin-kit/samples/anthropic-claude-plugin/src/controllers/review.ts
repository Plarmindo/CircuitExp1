import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class ReviewController {
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

  async review(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Validate input
      const validationResult = this.validation.sanitizeAndValidate(req.body, 'review');
      if (!validationResult.valid) {
        this.metrics.recordRequest('POST', '/api/review', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          details: validationResult.errors,
          requestId
        });
        return;
      }

      const data = validationResult.data as any;
      const { code, language, context, reviewType } = data;
      const model = data.model || 'claude-3-sonnet-20240229';

      this.logger.info('Code review request', {
        requestId,
        language,
        codeLength: code.length,
        contextLength: context?.length || 0,
        reviewType,
        model: model || 'default'
      });

      // Generate review
      const review = await this.aiService.reviewCode({
        code,
        language,
        context,
        reviewType,

      });

      this.metrics.recordRequest('POST', '/api/review', 200, Date.now() - startTime);
      this.metrics.recordAIUsage(model || 'claude-3-sonnet-20240229', review.tokens.prompt, review.tokens.completion);

      res.json({
        success: true,
        data: {
          review: review.content,
          language,
          reviewType,
          model: review.model,
          usage: {
            prompt_tokens: review.tokens.prompt,
            completion_tokens: review.tokens.completion,
            total_tokens: review.tokens.total
          },
          issues: this.parseIssues(review.content),
          summary: this.extractSummary(review.content)
        },
        requestId
      });

    } catch (error) {
      this.metrics.recordRequest('POST', '/api/review', 500, Date.now() - startTime);
      this.metrics.recordError('review', '/api/review/quick', error instanceof Error ? error.message : 'Unknown error');
      
      this.logger.error('Code review failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate review',
        message: error instanceof Error ? error.message : 'Internal server error',
        requestId
      });
    }
  }

  async quickReview(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Validate input
      const validationResult = this.validation.sanitizeAndValidate(req.body, 'review');
      if (!validationResult.valid) {
        this.metrics.recordRequest('POST', '/api/review/quick', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const data = validationResult.data as any;
        const { code, language, context } = data;
        const model = data.model || 'claude-3-sonnet-20240229';
        const temperature = data.temperature || 0.3;

      this.logger.info('Quick code review request', {
        requestId,
        language,
        codeLength: code.length,
        contextLength: context?.length || 0,
        model: model || 'default'
      });

      // Generate quick review
      const review = await this.aiService.reviewCode({
        code,
        language,
        context,
        reviewType: 'quick'
      });

      this.metrics.recordRequest('POST', '/api/review/quick', 200, Date.now() - startTime);
      this.metrics.recordAIUsage(model || 'claude-3-sonnet-20240229', review.tokens.prompt, review.tokens.completion);

      res.json({
        success: true,
        data: {
          review: review.content,
          language,
          reviewType: 'quick',
          model: review.model,
          usage: {
            prompt_tokens: review.tokens.prompt,
            completion_tokens: review.tokens.completion,
            total_tokens: review.tokens.total
          },
          issues: this.parseQuickIssues(review.content),
          score: this.extractScore(review.content)
        },
        requestId
      });

    } catch (error) {
      this.metrics.recordRequest('POST', '/api/review/quick', 500, Date.now() - startTime);
      this.metrics.recordError('quick-review', '/api/review/quick', error instanceof Error ? error.message : 'Unknown error');
      
      this.logger.error('Quick code review failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate quick review',
        message: error instanceof Error ? error.message : 'Internal server error',
        requestId
      });
    }
  }

  async detailedReview(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Validate input
      const validationResult = this.validation.sanitizeAndValidate(req.body, 'review');
      if (!validationResult.valid) {
        this.metrics.recordRequest('POST', '/api/review/detailed', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const data = validationResult.data as any;
        const { code, language, context } = data;
        const model = data.model || 'claude-3-sonnet-20240229';
        const temperature = data.temperature || 0.3;

      this.logger.info('Detailed code review request', {
        requestId,
        language,
        codeLength: code.length,
        contextLength: context?.length || 0,
        model: model || 'claude-3-sonnet-20240229'
      });

      // Generate detailed review
      const review = await this.aiService.reviewCode({
        code,
        language,
        context,
        reviewType: 'detailed'
      });

      this.metrics.recordRequest('POST', '/api/review/detailed', 200, Date.now() - startTime);
      this.metrics.recordAIUsage(model || 'claude-3-sonnet-20240229', review.tokens.prompt, review.tokens.completion);

      res.json({
        success: true,
        data: {
          review: review.content,
          language,
          reviewType: 'detailed',
          model: review.model,
          usage: review.tokens,
          issues: this.parseDetailedIssues(review.content),
          recommendations: this.extractRecommendations(review.content),
          summary: this.extractDetailedSummary(review.content)
        },
        requestId
      });

    } catch (error) {
      this.metrics.recordRequest('POST', '/api/review/detailed', 500, Date.now() - startTime);
      this.metrics.recordError('detailed-review', '/api/review/detailed', error instanceof Error ? error.message : 'Unknown error');
      
      this.logger.error('Detailed code review failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate detailed review',
        message: error instanceof Error ? error.message : 'Internal server error',
        requestId
      });
    }
  }

  private parseIssues(reviewContent: string): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    line?: number;
    suggestion?: string;
  }> {
    const issues = [];
    const lines = reviewContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Parse issues based on common patterns
      if (trimmed.includes('Issue:') || trimmed.includes('Problem:')) {
        const issue = this.parseIssueLine(trimmed);
        if (issue) {
          issues.push(issue);
        }
      }
    }

    return issues;
  }

  private parseQuickIssues(reviewContent: string): Array<{
    severity: 'low' | 'medium' | 'high';
    count: number;
    description: string;
  }> {
    const issues = [];
    const lines = reviewContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Parse quick issues summary
      if (trimmed.match(/\d+\s+(high|medium|low)\s+priority\s+issues?/i)) {
        const match = trimmed.match(/(\d+)\s+(high|medium|low)\s+priority\s+issues?/i);
        if (match) {
          issues.push({
            severity: match[2].toLowerCase() as 'low' | 'medium' | 'high',
            count: parseInt(match[1]),
            description: trimmed
          });
        }
      }
    }

    return issues;
  }

  private parseDetailedIssues(reviewContent: string): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    line?: number;
    file?: string;
    suggestion?: string;
    code?: string;
  }> {
    const issues = [];
    const lines = reviewContent.split('\n');
    
    let currentIssue = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.match(/^(Issue|Problem|Warning|Error):/i)) {
        if (currentIssue) {
          issues.push(currentIssue);
        }
        
        currentIssue = {
          type: trimmed.split(':')[0],
          severity: this.determineSeverity(trimmed),
          description: trimmed.split(':').slice(1).join(':').trim(),
          line: this.extractLineNumber(trimmed),
          file: this.extractFileName(trimmed),
          suggestion: '',
          code: ''
        };
      } else if (currentIssue && trimmed.startsWith('Suggestion:')) {
        currentIssue.suggestion = trimmed.replace('Suggestion:', '').trim();
      } else if (currentIssue && trimmed.startsWith('```')) {
        // Skip code blocks for now
      }
    }

    if (currentIssue) {
      issues.push(currentIssue);
    }

    return issues;
  }

  private extractSummary(reviewContent: string): string {
    const lines = reviewContent.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('summary:') || line.toLowerCase().includes('overview:')) {
        return line.split(':').slice(1).join(':').trim();
      }
    }
    return 'Code review completed successfully';
  }

  private extractDetailedSummary(reviewContent: string): {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    summary: string;
  } {
    const issues = this.parseIssues(reviewContent);
    const summary = {
      totalIssues: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      summary: this.extractSummary(reviewContent)
    };

    return summary;
  }

  private extractRecommendations(reviewContent: string): string[] {
    const recommendations = [];
    const lines = reviewContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
        recommendations.push(trimmed.replace(/^[-•\d+\.\s]+/, '').trim());
      }
    }

    return recommendations.slice(0, 5);
  }

  private extractScore(reviewContent: string): number {
    const scoreMatch = reviewContent.match(/score:\s*(\d+)/i) || reviewContent.match(/(\d+)\s*\/\s*10/i);
    if (scoreMatch) {
      return parseInt(scoreMatch[1]);
    }
    return 7; // Default score
  }

  private parseIssueLine(line: string): any {
    const severityMatch = line.match(/(critical|high|medium|low)/i);
    const typeMatch = line.match(/(security|performance|style|complexity|bug)/i);
    
    return {
      type: typeMatch ? typeMatch[1].toLowerCase() : 'general',
      severity: severityMatch ? severityMatch[1].toLowerCase() as 'low' | 'medium' | 'high' | 'critical' : 'medium',
      description: line.replace(/^(Issue|Problem):/i, '').trim(),
      line: this.extractLineNumber(line)
    };
  }

  private determineSeverity(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const lower = text.toLowerCase();
    if (lower.includes('critical') || lower.includes('security')) return 'critical';
    if (lower.includes('high') || lower.includes('performance')) return 'high';
    if (lower.includes('medium')) return 'medium';
    return 'low';
  }

  private extractLineNumber(text: string): number | undefined {
    const match = text.match(/line\s+(\d+)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractFileName(text: string): string | undefined {
    const match = text.match(/file:\s*(\S+)/i);
    return match ? match[1] : undefined;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}