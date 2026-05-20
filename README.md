# Telegram OpenRouter AI Bot

A production-ready Telegram bot powered by OpenRouter API (OpenAI-compatible). Chat with state-of-the-art LLMs, analyze images, parse documents, with streaming responses and automatic session management.

## Features

- **Text Conversations**: Multi-turn conversations with 20-message history
- **Image Analysis**: Vision models analyze photos, diagrams, screenshots
- **Document Support**: PDF, DOCX, TXT, JSON, code files with content-aware parsing
- **Streaming Responses**: Real-time message updates, typing indicators
- **Rate Limiting**: 20 text/5 image messages per minute per user
- **Session Management**: Auto-cleanup, per-user conversation state
- **Error Handling**: Graceful error messages, logged exceptions
- **Production Ready**: Winston logging, TypeScript strict mode, graceful shutdown

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript (strict mode) |
| Bot Framework | Grammy 1.21+ |
| AI API | OpenRouter (OpenAI-compatible) |
| Logging | Winston |
| Validation | Zod |

## Quick Start

### Prerequisites

- Node.js 18+, npm 9+
- Telegram Bot Token ([@BotFather](https://t.me/botfather))
- OpenRouter API Key ([openrouter.ai](https://openrouter.ai/keys))

### Installation

```bash
git clone <repository-url>
cd telegram-ai-bot
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env`:
```env
BOT_TOKEN=your_telegram_bot_token
OPENROUTER_API_KEY=your_openrouter_api_key
NODE_ENV=development
LOG_LEVEL=info
```

See `docs/deployment-guide.md` for all environment variables.

### Run

**Development** (auto-reload):
```bash
npm run dev
```

**Production** (compile & run):
```bash
npm run build
npm start
```

## Commands

| Command | Effect |
|---------|--------|
| `/start` | Welcome message & feature intro |
| `/help` | Command list & usage guide |
| `/new` | Clear conversation history |
| `/clear` | Alias for `/new` |

## Usage Examples

**Text Chat**:
```
You: What is TypeScript?
Bot: TypeScript is a programming language... [streaming response]
```

**Image Analysis**:
```
You: [send photo]
Bot: This image shows... [vision model analysis]
```

**Document Analysis**:
```
You: [send PDF]
Bot: Document received and analyzed.
You: Summarize the key points
Bot: [streaming response with document context]
```

## Architecture

```
Telegram → Long Polling → Grammy → Middlewares (session → rate-limit → error)
                                    ↓
                              Handlers (text/photo/document/image)
                                    ↓
                            OpenRouter Service (streaming, retry)
                                    ↓
                              OpenRouter API
```

See `docs/system-architecture.md` for detailed architecture.

## Configuration

### Required

- `BOT_TOKEN`: Telegram bot token from @BotFather
- `OPENROUTER_API_KEY`: API key from openrouter.ai

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Environment mode |
| `LOG_LEVEL` | `info` | Winston logging level |
| `SESSION_TIMEOUT` | `3600000` | Session cleanup (1 hour, ms) |
| `MAX_HISTORY_LENGTH` | `20` | Messages to retain per session |
| `RATE_LIMIT_MESSAGES` | `20` | Text msgs/min per user |
| `RATE_LIMIT_IMAGES` | `5` | Image msgs/min per user |
| `OPENROUTER_TEXT_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` | Text model |
| `OPENROUTER_VISION_MODEL` | `google/gemma-3-27b-it:free` | Vision model |
| `OPENROUTER_TEMPERATURE` | `0.7` | Creativity (0–2) |
| `OPENROUTER_MAX_TOKENS` | `2048` | Max response length |
| `OPENROUTER_TIMEOUT` | `120000` | API timeout (2 min, ms) |

See `.env.example` and `docs/deployment-guide.md` for complete reference.

## Project Structure

```
src/
├── index.ts                 Entry point, graceful shutdown
├── config/                  Environment validation (Zod)
├── bot/                     Grammy bot, commands, handlers, middlewares
├── services/                OpenRouter, conversation, file, storage
├── types/                   TypeScript domain types
└── utils/                   Constants, formatters, logger, file parser
```

See `docs/codebase-summary.md` for detailed breakdown.

## Development

### Type Check
```bash
npm run type-check
```

### Lint
```bash
npm run lint
```

### Format
```bash
npm run format
```

## Deployment

### PM2 (Recommended)

```bash
npm run build
pm2 start dist/index.js --name "telegram-ai-bot"
pm2 startup
pm2 save
```

### Docker

```bash
docker build -t telegram-ai-bot .
docker run -d --env-file .env telegram-ai-bot
```

### Systemd (Linux)

See `docs/deployment-guide.md` for systemd service setup.

## Troubleshooting

**Bot not responding?**
1. Verify `BOT_TOKEN` is valid: `curl -s "https://api.telegram.org/bot{TOKEN}/getMe"`
2. Check logs: `tail -f logs/error.log`
3. Ensure process running: `pm2 list` or `docker ps`

**OpenRouter errors?**
1. Check API key is correct
2. Verify quota/balance in OpenRouter dashboard
3. Increase timeout for free tier: `OPENROUTER_TIMEOUT=180000`

**Rate limited?**
1. Adjust `RATE_LIMIT_MESSAGES` / `RATE_LIMIT_IMAGES`
2. Wait 1 minute for window reset

**File upload fails?**
1. Check file <10MB
2. Supported formats: PDF, DOCX, TXT, JSON, images
3. Check logs for parse errors

See `docs/deployment-guide.md` for comprehensive troubleshooting.

## Performance

| Metric | Target |
|--------|--------|
| Startup | <5s (excluding first API cold start) |
| Text Response | <100ms overhead (API time varies) |
| Memory | <100MB per 100 sessions |
| Uptime | >99% (graceful shutdown, auto-cleanup) |

## Security

- No secrets logged (API keys, tokens, messages)
- Input validation via Zod
- Rate limiting to prevent abuse
- User-friendly error messages (no stack traces exposed)
- Session auto-cleanup (1 hour default)
- Never commit `.env` file

## Roadmap

1. **Phase 1** (Current): Core bot, OpenRouter integration, streaming, files
2. **Phase 2**: Redis persistence, multi-language
3. **Phase 3**: Analytics dashboard, usage quotas
4. **Phase 4**: Webhook mode, clustering, horizontal scaling

## Documentation

- **`docs/project-overview-pdr.md`** — Product vision, features, PDR
- **`docs/codebase-summary.md`** — Code structure, file inventory
- **`docs/code-standards.md`** — TypeScript conventions, patterns
- **`docs/system-architecture.md`** — Architecture diagrams, data flow
- **`docs/deployment-guide.md`** — Setup, PM2, Docker, troubleshooting

## Contributing

1. Fork repository
2. Create feature branch
3. Follow `docs/code-standards.md`
4. Run tests & linting: `npm run lint && npm run type-check`
5. Commit with descriptive message
6. Submit pull request

## License

MIT License — see LICENSE file

## Support

- GitHub Issues: Bug reports & feature requests
- Documentation: `docs/` folder
- Logs: `logs/` folder (development)

## Acknowledgments

- Built with [Grammy](https://grammy.dev/) — Telegram bot framework
- Powered by [OpenRouter](https://openrouter.ai/) — LLM API aggregator
- Free models: Llama 3.3, Gemini, Mistral
- Logging: [Winston](https://github.com/winstonjs/winston)

---

**Status**: Production Ready | **Node**: 18+ | **License**: MIT
