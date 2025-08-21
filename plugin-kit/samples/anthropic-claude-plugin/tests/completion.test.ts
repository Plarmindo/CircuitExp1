/**
 * Tests for CompletionController
 */

import { CompletionController } from '../src/controllers/completion';
import { AIService } from '../src/services/ai';
import { ValidationService } from '../src/services/validation';
import { MetricsService } from '../src/services/metrics';
import { LoggerService } from '../src/services/logger';

describe('CompletionController', () => {
  let controller: CompletionController;
  let mockAiService: jest.Mocked<AIService>;
  let mockValidationService: jest.Mocked<ValidationService>;
  let mockMetricsService: jest.Mocked<MetricsService>;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockAiService = {
      generateCompletion: jest.fn(),
      generateStreamingCompletion: jest.fn()
    } as any;

    mockValidationService = {
      validate: jest.fn(),
      validateCode: jest.fn()
    } as any;

    mockMetricsService = {
      increment: jest.fn(),
      timing: jest.fn(),
      gauge: jest.fn()
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    controller = new CompletionController(
      mockAiService,
      mockValidationService,
      mockMetricsService,
      mockLoggerService
    );
  });

  describe('generateCompletion', () => {
    it('should generate completion for valid input', async () => {
      const mockRequest = {
        prompt: 'Create a function to calculate fibonacci',
        language: 'typescript',
        maxTokens: 100
      };

      const mockResponse = {
        completion: 'function fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}',
        usage: { prompt_tokens: 10, completion_tokens: 25, total_tokens: 35 }
      };

      mockValidationService.validate.mockReturnValue({ isValid: true });
      mockAiService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await controller.generateCompletion(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockValidationService.validate).toHaveBeenCalledWith(mockRequest);
      expect(mockAiService.generateCompletion).toHaveBeenCalledWith(mockRequest);
      expect(mockMetricsService.increment).toHaveBeenCalledWith('completion.requests.total');
    });

    it('should handle validation errors', async () => {
      const mockRequest = {
        prompt: '',
        language: 'typescript'
      };

      mockValidationService.validate.mockReturnValue({
        isValid: false,
        errors: ['Prompt is required']
      });

      await expect(controller.generateCompletion(mockRequest))
        .rejects.toThrow('Validation failed');

      expect(mockMetricsService.increment).toHaveBeenCalledWith('completion.requests.validation_errors');
    });

    it('should handle AI service errors', async () => {
      const mockRequest = {
        prompt: 'test prompt',
        language: 'typescript'
      };

      mockValidationService.validate.mockReturnValue({ isValid: true });
      mockAiService.generateCompletion.mockRejectedValue(new Error('AI service error'));

      await expect(controller.generateCompletion(mockRequest))
        .rejects.toThrow('Failed to generate completion');

      expect(mockMetricsService.increment).toHaveBeenCalledWith('completion.requests.errors');
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('generateStreamingCompletion', () => {
    it('should stream completion chunks', async () => {
      const mockRequest = {
        prompt: 'test prompt',
        language: 'typescript'
      };

      const mockChunks = [
        { content: 'function test() {', isComplete: false },
        { content: '\n  return true;\n}', isComplete: true }
      ];

      mockValidationService.validate.mockReturnValue({ isValid: true });
      mockAiService.generateStreamingCompletion.mockImplementation(async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      });

      const chunks: any[] = [];
      for await (const chunk of controller.generateStreamingCompletion(mockRequest)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(mockChunks);
      expect(mockMetricsService.increment).toHaveBeenCalledWith('completion.streaming_requests.total');
    });
  });

  describe('generateSuggestions', () => {
    it('should generate code suggestions', async () => {
      const mockRequest = {
        code: 'const x = 5',
        language: 'javascript',
        cursorPosition: 10
      };

      const mockSuggestions = [
        { text: 'const x = 5;', score: 0.9 },
        { text: 'const x = 5;\nconsole.log(x);', score: 0.8 }
      ];

      mockValidationService.validateCode.mockReturnValue({ isValid: true });
      mockAiService.generateCompletion.mockResolvedValue({
        completion: JSON.stringify(mockSuggestions),
        usage: { prompt_tokens: 5, completion_tokens: 15, total_tokens: 20 }
      });

      const result = await controller.generateSuggestions(mockRequest);

      expect(result).toEqual(mockSuggestions);
      expect(mockValidationService.validateCode).toHaveBeenCalledWith(mockRequest.code);
    });
  });
});