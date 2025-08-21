import { Request, Response } from 'express';
import { Logger } from 'winston';

export class ConfigController {
  private config: any;
  private logger: Logger;

  constructor(config: any, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const safeConfig = {
        name: this.config.name,
        version: this.config.version,
        ai: {
          providers: Object.keys(this.config.ai.providers),
          features: this.config.ai.features
        },
        api: {
          port: this.config.api.port,
          host: this.config.api.host,
          endpoints: this.config.api.endpoints
        },
        logging: {
          level: this.config.logging.level,
          file: this.config.logging.file
        }
      };

      res.json({
        success: true,
        data: safeConfig,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in get config handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { section, updates } = req.body;
      
      if (!section || !updates) {
        res.status(400).json({ error: 'Section and updates are required' });
        return;
      }

      // Validate section exists
      if (!this.config[section]) {
        res.status(400).json({ error: `Section '${section}' not found` });
        return;
      }

      // Apply updates (simplified - in real implementation, use proper validation)
      Object.assign(this.config[section], updates);

      this.logger.info('Configuration updated', { section, updates: Object.keys(updates) });

      res.json({
        success: true,
        message: 'Configuration updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in update config handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error in health handler', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}