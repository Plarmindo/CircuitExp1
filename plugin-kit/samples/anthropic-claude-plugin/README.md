# Anthropic Claude Plugin

A comprehensive AI-powered plugin built on the Plugin Kit framework, leveraging Anthropic's Claude models for advanced code assistance including completion, review, analysis, and chat capabilities.

## 🚀 Features

- **🤖 AI Code Completion**: Intelligent code suggestions powered by Claude 3.5 Sonnet
- **🔍 Code Review**: Automated code reviews with detailed feedback and suggestions
- **📊 Code Analysis**: Deep analysis of code complexity, performance, security, and architecture
- **💬 Interactive Chat**: Conversational AI for coding questions and assistance
- **🐛 Bug Detection**: AI-powered detection of potential bugs and issues
- **🧪 Test Generation**: Automatic generation of unit tests for your code
- **📚 Documentation**: Generate comprehensive documentation for your codebase
- **⚡ Streaming Support**: Real-time streaming responses for chat and completion
- **📈 Metrics & Monitoring**: Comprehensive usage analytics and performance metrics
- **🔒 Security First**: Built-in security features including rate limiting and input validation
- **🎯 Multi-language Support**: Support for 15+ programming languages

## 🛠️ Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Anthropic API key

### Installation

1. **Clone and navigate to the plugin directory:**
   ```bash
   cd plugin-kit/samples/anthropic-claude-plugin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Configure your Anthropic API key:**
   ```bash
   # In .env file
   ANTHROPIC_API_KEY=your_actual_api_key_here
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

### Docker Setup

1. **Using Docker Compose:**
   ```bash
   docker-compose up --build
   ```

2. **Using Docker directly:**
   ```bash
   docker build -t anthropic-claude-plugin .
   docker run -p 3000:3000 --env-file .env anthropic-claude-plugin
   ```

## 📡 API Endpoints

### Health & Configuration
- `GET /health` - Health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /config` - Plugin configuration
- `GET /config/health` - Health configuration

### Code Completion
- `POST /completion` - Standard code completion
- `POST /completion/stream` - Streaming code completion

### Code Review
- `POST /review` - Standard code review
- `POST /review/quick` - Quick code review
- `POST /review/detailed` - Detailed code review

### Code Analysis
- `POST /analysis` - General code analysis
- `POST /analysis/complexity` - Complexity analysis
- `POST /analysis/performance` - Performance analysis
- `POST /analysis/security` - Security analysis
- `POST /analysis/architecture` - Architecture analysis
- `POST /analysis/maintainability` - Maintainability analysis

### Bug Detection
- `POST /bugs/detect` - Detect bugs in code

### Test Generation
- `POST /tests/generate` - Generate unit tests

### Documentation
- `POST /docs/generate` - Generate documentation

### AI Chat
- `POST /chat` - Standard chat
- `POST /chat/stream` - Streaming chat
- `POST /chat/clear` - Clear conversation
- `GET /chat/history` - Get conversation history

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `localhost` |
| `NODE_ENV` | Environment | `development` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `ANTHROPIC_API_URL` | Anthropic API URL | `https://api.anthropic.com/v1/messages` |
| `ANTHROPIC_MODEL` | Default AI model | `claude-3-5-sonnet-20241022` |
| `ANTHROPIC_MAX_TOKENS` | Max tokens per request | `4000` |
| `ANTHROPIC_TEMPERATURE` | Model temperature | `0.1` |
| `API_SECRET_KEY` | Plugin API secret | Generate secure key |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

## 📖 Usage Examples

### Code Completion
```bash
curl -X POST http://localhost:3000/completion \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "code": "function calculateFibonacci(n) {",
    "language": "javascript",
    "context": "This function should calculate the nth Fibonacci number"
  }'
```

### Code Review
```bash
curl -X POST http://localhost:3000/review \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "code": "const users = [];\\nfunction addUser(user) {\\n  users.push(user);\\n}",
    "language": "javascript",
    "reviewType": "detailed"
  }'
```

### Code Analysis
```bash
curl -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "code": "function complexFunction(arr) {\\n  let result = 0;\\n  for(let i = 0; i < arr.length; i++) {\\n    for(let j = 0; j < arr.length; j++) {\\n      result += arr[i] * arr[j];\\n    }\\n  }\\n  return result;\\n}",
    "language": "javascript",
    "analysisType": "performance"
  }'
```

### AI Chat
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "message": "How can I optimize this nested loop for better performance?",
    "context": "Working with large arrays in JavaScript"
  }'
```

### Streaming Chat
```bash
curl -X POST http://localhost:3000/chat/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "message": "Explain async/await in JavaScript",
    "context": "Learning modern JavaScript"
  }'
```

## 🎯 Supported Languages

- **JavaScript/TypeScript**
- **Python**
- **Java**
- **C#**
- **C/C++**
- **Go**
- **Rust**
- **PHP**
- **Ruby**
- **Swift**
- **Kotlin**
- **Scala**
- **HTML/CSS/SCSS/Less**
- **SQL**
- **JSON/YAML/XML**
- **Markdown**

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking

# Testing
npm test            # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Docker
npm run docker:build # Build Docker image
npm run docker:run   # Run with Docker Compose
npm run docker:dev   # Development with Docker
```

### Project Structure

```
anthropic-claude-plugin/
├── src/
│   ├── index.ts              # Main application entry point
│   ├── controllers/          # API route handlers
│   │   ├── health.ts         # Health check endpoints
│   │   ├── completion.ts     # Code completion
│   │   ├── review.ts         # Code review
│   │   ├── analysis.ts       # Code analysis
│   │   ├── chat.ts           # AI chat
│   │   ├── config.ts         # Configuration
│   │   └── index.ts          # Controllers export
│   ├── services/             # Business logic services
│   │   ├── ai.ts             # Anthropic Claude integration
│   │   ├── logger.ts         # Logging service
│   │   ├── cache.ts          # Caching service
│   │   ├── metrics.ts        # Metrics collection
│   │   ├── validation.ts     # Input validation
│   │   ├── security.ts       # Security utilities
│   │   └── index.ts          # Services export
│   └── types/                # TypeScript type definitions
├── logs/                     # Application logs
├── tests/                    # Test files
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Docker Compose setup
├── .env.example             # Environment variables template
└── README.md               # This file
```

## 🔒 Security Features

- **API Key Authentication**: Secure API access with configurable keys
- **Rate Limiting**: Configurable rate limiting per IP/API key
- **Input Validation**: Comprehensive input sanitization and validation
- **CORS Protection**: Configurable CORS settings
- **Helmet Security**: Security headers via Helmet.js
- **Request Logging**: Detailed request/response logging
- **Error Handling**: Secure error handling without data exposure

## 📊 Monitoring & Metrics

The plugin provides comprehensive metrics:

- **Request Metrics**: Response times, status codes, request counts
- **AI Usage**: Token usage, cost tracking, model usage
- **System Metrics**: Memory usage, CPU usage, uptime
- **Error Tracking**: Error types, frequency, stack traces

Access metrics at:
- `GET /health/metrics` - Basic metrics
- `GET /health/detailed` - Detailed system health

## 🚨 Troubleshooting

### Common Issues

1. **API Key Issues**
   ```bash
   # Check if API key is set
   echo $ANTHROPIC_API_KEY
   
   # Verify API key is valid
   curl -H "x-api-key: YOUR_KEY" https://api.anthropic.com/v1/messages
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port 3000
   lsof -i :3000
   
   # Kill process or use different port
   PORT=3001 npm run dev
   ```

3. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   node --max-old-space-size=4096 dist/index.js
   ```

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Health Checks

Check if the service is running:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/live
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude AI models
- [Plugin Kit](https://github.com/plugin-kit) for the plugin framework
- [Express.js](https://expressjs.com) for the web framework
- [TypeScript](https://typescriptlang.org) for type safety

## 📞 Support

- 📧 Email: support@plugin-kit.dev
- 💬 Discord: [Plugin Kit Discord](https://discord.gg/plugin-kit)
- 📖 Documentation: [docs.plugin-kit.dev](https://docs.plugin-kit.dev)
- 🐛 Issues: [GitHub Issues](https://github.com/plugin-kit/anthropic-claude-plugin/issues)