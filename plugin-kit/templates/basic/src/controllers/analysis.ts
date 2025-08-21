import { Request, Response } from 'express';
import { AIService } from '../services/ai';
import { ValidationService } from '../services/validation';
import { Logger } from 'winston';

export class AnalysisController {
  private aiService: AIService;
  private validationService: ValidationService;
  private logger: Logger;

  constructor(aiService: AIService, validationService: ValidationService, logger: Logger) {
    this.aiService = aiService;
    this.validationService = validationService;
    this.logger = logger;
  }

  async handleAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validationService.validate(req.body, 'analysis');
      if (!validation.valid) {
        res.status(400).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      const { code, type, language } = req.body;
      
      this.logger.info('Processing code analysis request', { 
        type, 
        language, 
        codeLength: code.length 
      });

      const result = await this.aiService.analyzePerformance(code, { type, language });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in analysis handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleBugDetection(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ error: 'Code is required' });
        return;
      }

      const result = await this.aiService.detectBugs(code);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in bug detection handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleTestGeneration(req: Request, res: Response): Promise<void> {
    try {
      const { code, framework } = req.body;
      if (!code) {
        res.status(400).json({ error: 'Code is required' });
        return;
      }

      const result = await this.aiService.generateTests(code, { framework: framework || 'jest' });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in test generation handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleDocumentationGeneration(req: Request, res: Response): Promise<void> {
    try {
      const { code, format } = req.body;
      if (!code) {
        res.status(400).json({ error: 'Code is required' });
        return;
      }

      const result = await this.aiService.generateDocumentation(code);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in documentation generation handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}