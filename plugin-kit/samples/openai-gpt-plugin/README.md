# OpenAI GPT Plugin

A production-ready sample plugin that integrates with OpenAI's GPT models to provide AI-powered code completion, review, analysis, and chat functionality.

## Features

- **Code Completion**: AI-powered code suggestions and completions
- **Code Review**: Automated code quality and security analysis
- **Bug Detection**: Intelligent bug identification and fixes
- **Test Generation**: Automatic test case generation
- **Documentation**: Auto-generated code documentation
- **AI Chat**: Conversational AI assistance for coding questions
- **Streaming Support**: Real-time streaming responses for completions and chat
- **Metrics & Monitoring**: Built-in performance and usage tracking
- **Security**: API key authentication, rate limiting, input sanitization
- **Caching**: Response caching for improved performance

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key

### Installation

1. Clone or copy this sample
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key and configuration
   ```

4. Start the server:
   ```bash
   npm start
   ```

### Docker Setup

1. Build and run with Docker:
   ```bash
   docker-compose up --build
   ```

2. The plugin will be available at `http://localhost:3000`

## API Endpoints

### Health & Status
- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /live` - Liveness check

### Code Completion
- `POST /api/completion` - Generate code completions
- `POST /api/completion/stream` - Stream code completions

### Code Review
- `POST /api/review` - Full code review
- `POST /api/review/quick` - Quick code review

### Code Analysis
- `POST /api/analysis` - Analyze code (performance, security, complexity, maintainability)
- `POST /api/analysis/bugs` - Detect bugs
- `POST /api/analysis/tests` - Generate tests
- `POST /api/analysis/docs` - Generate documentation

### AI Chat
- `POST /api/chat` - Send chat message
- `POST /api/chat/stream` - Stream chat responses

### Configuration
- `GET /api/config` - Get plugin configuration
- `POST /api/config` - Update configuration (not implemented)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `localhost` |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_MODEL` | Default AI model | `gpt-4` |
| `API_KEYS` | Comma-separated API keys | Required |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `LOG_LEVEL` | Logging level | `info` |

## Usage Examples

### Code Completion

```bash
curl -X POST http://localhost:3000/api/completion \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "prompt": "function fibonacci(n) {",
    "language": "javascript",
    "maxTokens": 100,
    "temperature": 0.1
  }'
```

### Code Review

```bash
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "code": "function add(a, b) { return a + b; }",
    "language": "javascript",
    "rules": ["security", "performance"]
  }'
```

### Bug Detection

```bash
curl -X POST http://localhost:3000/api/analysis/bugs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "code": "const arr = [1,2,3]; console.log(arr[5]);",
    "language": "javascript"
  }'
```

### AI Chat

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "message": "How do I implement a binary search in Python?",
    "context": "I need it for a sorted array"
  }'
```

## Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── controllers/     # API endpoint handlers
├── services/        # Business logic and AI integration
├── middleware/      # Express middleware
├── routes/          # Route definitions
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Application entry point
```

### Adding New Features

1. Create service methods in `src/services/ai.ts`
2. Add validation schemas in `src/services/validation.ts`
3. Create controller methods in appropriate controller file
4. Add route handlers in `src/routes/`
5. Update configuration if needed

## Security Features

- **API Key Authentication**: All endpoints require valid API keys
- **Rate Limiting**: Configurable rate limiting per IP/API key
- **Input Validation**: Comprehensive input validation and sanitization
- **CORS Protection**: Configurable CORS origins
- **Logging**: Security events and errors are logged
- **Rate Limit Monitoring**: Built-in rate limit tracking and enforcement

## Monitoring & Metrics

The plugin includes built-in metrics collection:

- Request counts and response times
- Error rates and types
- AI token usage and costs
- Cache hit rates
- System health indicators

Access metrics via the `/health` endpoint or view logs in real-time.

## Troubleshooting

### Common Issues

1. **OpenAI API Key Error**
   - Ensure `OPENAI_API_KEY` is set in your environment
   - Check that the key has sufficient credits

2. **Rate Limit Exceeded**
   - Check `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`
   - Monitor usage via metrics

3. **CORS Issues**
   - Verify `CORS_ORIGINS` includes your client domain
   - Check browser console for CORS errors

4. **Memory Issues**
   - Adjust `CACHE_MAX_KEYS` and `CACHE_TTL`
   - Monitor memory usage via `/health`

### Logs

Logs are written to:
- Console (development)
- `logs/app.log` (production)
- Use `LOG_LEVEL=debug` for verbose logging

## License

MIT License - see LICENSE file for details.