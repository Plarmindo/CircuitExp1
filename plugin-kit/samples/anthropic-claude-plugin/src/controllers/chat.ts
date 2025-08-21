import { Request, Response } from 'express';
import { AIService, ChatRequest } from '../services/ai';
import { ValidationService } from '../services/validation';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class ChatController {
  constructor(
    private aiService: AIService,
    private validationService: ValidationService,
    private metricsService: MetricsService,
    private logger: LoggerService
  ) {}

  async chat(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { message, context, conversationId, systemPrompt } = req.body;

      // Validate input
      const validation = this.validationService.sanitizeAndValidate({
        message,
        context,
        history: [],
        maxTokens: 800,
        temperature: 0.7
      }, 'chat');

      if (!validation.valid) {
        this.metricsService.recordRequest('POST', '/api/chat', 400, Date.now() - startTime);
        res.status(400).json({ error: validation.errors });
        return;
      }

      this.logger.info('Processing chat request', { conversationId });

      const result = await this.aiService.chat({
        message,
        context,
        history: [],
        maxTokens: 800,
        temperature: 0.7
      });

      this.metricsService.recordRequest('POST', '/api/chat', 200, Date.now() - startTime);
      this.metricsService.recordAIUsage('claude-3-5-sonnet-20241022', result.tokens?.prompt || 0, result.tokens?.completion || 0);

      res.json({
        response: result.content,
        conversationId: conversationId || this.generateConversationId(),
        tokens: result.tokens,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Chat failed', { error: errorMessage, conversationId: req.body.conversationId });
      this.metricsService.recordRequest('POST', '/api/chat', 500, Date.now() - startTime);
      this.metricsService.recordError('chat', '/api/chat', errorMessage);
      
      res.status(500).json({
        error: 'Chat failed',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async chatStream(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { message, context, conversationId, systemPrompt } = req.body;

      // Validate input
      const validation = this.validationService.sanitizeAndValidate({
        message,
        context,
        history: [],
        maxTokens: 800,
        temperature: 0.7
      }, 'chat');

      if (!validation.valid) {
        this.metricsService.recordRequest('POST', '/api/chat/stream', 400, Date.now() - startTime);
        res.status(400).json({ error: validation.errors });
        return;
      }

      this.logger.info('Starting chat stream', { conversationId });

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const result = await this.aiService.chat({
        message,
        context,
        history: [],
        maxTokens: 800,
        temperature: 0.7
      });

      res.json({
        response: result.content,
        conversationId: conversationId || this.generateConversationId(),
        tokens: result.tokens,
        timestamp: new Date().toISOString()
      });

      this.metricsService.recordRequest('POST', '/api/chat/stream', 200, Date.now() - startTime);
      this.metricsService.recordAIUsage(result.model || 'claude-3-5-sonnet-20241022', result.tokens?.prompt || 0, result.tokens?.completion || 0);

    } catch (error) {
      this.logger.error('Chat stream failed', { error: error instanceof Error ? error.message : String(error) });
      this.metricsService.recordRequest('POST', '/api/chat/stream', 500, Date.now() - startTime);
      this.metricsService.recordError('chat_stream', '/api/chat/stream', error instanceof Error ? error.message : String(error));
      
      res.status(500).json({
        error: 'Chat stream failed',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async clearConversation(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { conversationId } = req.body;

      if (!conversationId) {
        this.metricsService.recordRequest('POST', '/api/chat/clear', 400, Date.now() - startTime);
        res.status(400).json({ error: 'Conversation ID is required' });
        return;
      }

      this.logger.info('Clearing conversation', { conversationId });

      // In a real implementation, you would clear the conversation from storage
      // For now, we'll just acknowledge the request
      this.metricsService.recordRequest('POST', '/api/chat/clear', 200, Date.now() - startTime);

      res.json({
        success: true,
        message: `Conversation ${conversationId} cleared`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Clear conversation failed', { error: errorMessage });
      this.metricsService.recordRequest('POST', '/api/chat/clear', 500, Date.now() - startTime);
      this.metricsService.recordError('clear_conversation', '/api/chat/clear', errorMessage);
      
      res.status(500).json({
        error: 'Clear conversation failed',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async getConversationHistory(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { conversationId } = req.query;

      if (!conversationId) {
        this.metricsService.recordRequest('GET', '/api/chat/history', 400, Date.now() - startTime);
        res.status(400).json({ error: 'Conversation ID is required' });
        return;
      }

      this.logger.info('Getting conversation history', { conversationId });

      // In a real implementation, you would retrieve the conversation from storage
      // For now, we'll return a placeholder response
      this.metricsService.recordRequest('GET', '/api/chat/history', 200, Date.now() - startTime);

      res.json({
        conversationId,
        messages: [],
        totalMessages: 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Get conversation history failed', { error: errorMessage });
      this.metricsService.recordRequest('GET', '/api/chat/history', 500, Date.now() - startTime);
      this.metricsService.recordError('get_conversation_history', '/api/chat/history', errorMessage);
      
      res.status(500).json({
        error: 'Get conversation history failed',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}