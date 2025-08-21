import { Request, Response } from 'express';
import { AIService, AnalysisRequest, BugDetectionRequest, TestGenerationRequest, DocumentationRequest } from '../services/ai';
import { ValidationService } from '../services/validation';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class AnalysisController {
  constructor(
    private aiService: AIService,
    private validationService: ValidationService,
    private metricsService: MetricsService,
    private logger: LoggerService
  ) {}

  async analyze(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { code, language, context, analysisType = 'general' } = req.body;

      // Validate input
      const validation = this.validationService.sanitizeAndValidate({
        code,
        language,
        context,
        analysisType
      }, 'analysis');

      if (!validation.valid) {
        this.metricsService.recordRequest('POST', '/api/analysis', 400, Date.now() - startTime);
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      this.logger.info('Analyzing code', { language, analysisType });

      // Perform analysis based on type
      const result = await this.aiService.analyzeCode({
        code,
        language,
        context,
        analysisType
      });

      this.metricsService.recordRequest('POST', '/api/analysis', 200, Date.now() - startTime);
      this.metricsService.recordAIUsage('claude-3-5-sonnet-20241022', result.tokens?.prompt || 0, result.tokens?.completion || 0);

      res.json({
        success: true,
        analysis: result.content,
        tokens: result.tokens,
        analysisType
      });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Analysis failed', { error: errorMessage });
        this.metricsService.recordRequest('POST', '/api/analysis', 500, Date.now() - startTime);
        this.metricsService.recordError('analysis_error', '/api/analysis', errorMessage);
        
        res.status(500).json({
          success: false,
          error: 'Analysis failed',
          message: errorMessage
        });
      }
  }

  async detectBugs(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { code, language, context } = req.body;

      // Validate input
      const validation = this.validationService.sanitizeAndValidate({
        code,
        language,
        context
      }, 'bugDetection');

      if (!validation.valid) {
        this.metricsService.recordRequest('POST', '/api/analysis/bugs', 400, Date.now() - startTime);
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      this.logger.info('Detecting bugs', { language });

      const result = await this.aiService.detectBugs({
        code,
        language,
        context
      });

      this.metricsService.recordRequest('POST', '/api/analysis/bugs', 200, Date.now() - startTime);
      this.metricsService.recordAIUsage('claude-3-5-sonnet-20241022', result.tokens?.prompt || 0, result.tokens?.completion || 0);

      res.json({
        success: true,
        bugs: result.content,
        tokens: result.tokens
      });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Bug detection failed', { error: errorMessage });
        this.metricsService.recordRequest('POST', '/api/analysis/bugs', 500, Date.now() - startTime);
        this.metricsService.recordError('bug_detection_error', '/api/analysis/bugs', errorMessage);
        
        res.status(500).json({
          success: false,
          error: 'Bug detection failed',
          message: errorMessage
        });
      }
  }

  async generateTests(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { code, language, testType = 'unit', framework } = req.body;

      // Validate input
      const validation = this.validationService.sanitizeAndValidate({
        code,
        language,
        testType,
        framework
      }, 'testGeneration');

      if (!validation.valid) {
        this.metricsService.recordRequest('POST', '/api/analysis/tests', 400, Date.now() - startTime);
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      this.logger.info('Generating tests', { language, testType, framework });

      const result = await this.aiService.generateTests({
        code,
        language,
        testFramework: framework
      });

      this.metricsService.recordRequest('POST', '/api/analysis/tests', 200, Date.now() - startTime);
      this.metricsService.recordAIUsage('claude-3-5-sonnet-20241022', result.tokens?.prompt || 0, result.tokens?.completion || 0);

      res.json({
        success: true,
        tests: result.content,
        tokens: result.tokens
      });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Test generation failed', { error: errorMessage });
        this.metricsService.recordRequest('POST', '/api/analysis/tests', 500, Date.now() - startTime);
        this.metricsService.recordError('test_generation_error', '/api/analysis/tests', errorMessage);
        
        res.status(500).json({
          success: false,
          error: 'Test generation failed',
          message: errorMessage
        });
      }
  }

  async generateDocs(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { code, language, docType = 'api', style = 'standard' } = req.body;

      // Validate input
      const validation = this.validationService.sanitizeAndValidate({
        code,
        language,
        docType,
        style
      }, 'documentation');

      if (!validation.valid) {
        this.metricsService.recordRequest('POST', '/api/analysis/docs', 400, Date.now() - startTime);
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      this.logger.info('Generating documentation', { language, docType, style });

      const result = await this.aiService.generateDocumentation({
        code,
        language,
        docType,
        context: style
      });

      this.metricsService.recordRequest('POST', '/api/analysis/docs', 200, Date.now() - startTime);
      this.metricsService.recordAIUsage('claude-3-5-sonnet-20241022', result.tokens?.prompt || 0, result.tokens?.completion || 0);

      res.json({
        success: true,
        documentation: result.content,
        docType,
        style,
        tokens: result.tokens
      });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Documentation generation failed', { error: errorMessage });
        this.metricsService.recordRequest('POST', '/api/analysis/docs', 500, Date.now() - startTime);
        this.metricsService.recordError('documentation_error', '/api/analysis/docs', errorMessage);
        
        res.status(500).json({
          success: false,
          error: 'Documentation generation failed',
          message: errorMessage
        });
      }
  }
}