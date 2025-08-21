import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class AnalysisController {
  constructor(
    private ai: AIService,
    private validation: ValidationService,
    private metrics: MetricsService,
    private logger: LoggerService
  ) {}

  async analyze(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validationResult = this.validation.validate('codeAnalysis', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/analysis', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { code, language, analysisType, context } = validationResult.data!;

      this.logger.info('Code analysis requested', { 
        language, 
        analysisType,
        codeLength: code.length
      });

      // Perform analysis based on type
      let result;
      switch (analysisType) {
        case 'performance':
          result = await this.ai.analyzePerformance({ code, language, context });
          break;
        case 'security':
          result = await this.ai.analyzeSecurity({ code, language, context });
          break;
        case 'complexity':
          result = await this.ai.analyzeComplexity({ code, language, context });
          break;
        case 'maintainability':
          result = await this.ai.analyzeMaintainability({ code, language, context });
          break;
        default:
          result = await this.ai.analyzeCode({ code, language, analysisType, context });
      }

      // Record metrics
      this.metrics.recordAIUsage('gpt-4', 0, 0); // Approximate token usage
      this.metrics.recordRequest('/api/analysis', 200, Date.now() - startTime);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Code analysis failed', error);
      this.metrics.recordError('analysis_error', '/api/analysis');
      this.metrics.recordRequest('/api/analysis', 500, Date.now() - startTime);

      res.status(500).json({
        success: false,
        error: 'Failed to analyze code',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async detectBugs(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const validationResult = this.validation.validate('bugDetection', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/analysis/bugs', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { code, language, context } = validationResult.data!;

      this.logger.info('Bug detection requested', { 
        language, 
        codeLength: code.length
      });

      const result = await this.ai.detectBugs({ code, language, context });

      this.metrics.recordRequest('/api/analysis/bugs', 200, Date.now() - startTime);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Bug detection failed', error);
      this.metrics.recordError('bug_detection_error', '/api/analysis/bugs');
      this.metrics.recordRequest('/api/analysis/bugs', 500, Date.now() - startTime);

      res.status(500).json({
        success: false,
        error: 'Failed to detect bugs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async generateTests(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const validationResult = this.validation.validate('testGeneration', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/analysis/tests', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { code, language, framework, coverage, context } = validationResult.data!;

      this.logger.info('Test generation requested', { 
        language, 
        framework,
        codeLength: code.length
      });

      const result = await this.ai.generateTests({
        code,
        language,
        framework,
        coverage,
        context
      });

      this.metrics.recordRequest('/api/analysis/tests', 200, Date.now() - startTime);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Test generation failed', error);
      this.metrics.recordError('test_generation_error', '/api/analysis/tests');
      this.metrics.recordRequest('/api/analysis/tests', 500, Date.now() - startTime);

      res.status(500).json({
        success: false,
        error: 'Failed to generate tests',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async generateDocs(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const validationResult = this.validation.validate('docGeneration', req.body);
      if (!validationResult.valid) {
        this.metrics.recordRequest('/api/analysis/docs', 400, Date.now() - startTime);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const { code, language, docType, context } = validationResult.data!;

      this.logger.info('Documentation generation requested', { 
        language, 
        docType,
        codeLength: code.length
      });

      const result = await this.ai.generateDocumentation({
        code,
        language,
        docType,
        context
      });

      this.metrics.recordRequest('/api/analysis/docs', 200, Date.now() - startTime);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Documentation generation failed', error);
      this.metrics.recordError('doc_generation_error', '/api/analysis/docs');
      this.metrics.recordRequest('/api/analysis/docs', 500, Date.now() - startTime);

      res.status(500).json({
        success: false,
        error: 'Failed to generate documentation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}