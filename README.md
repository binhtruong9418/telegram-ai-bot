# YesScale AI Telegram Bot

A production-ready Telegram bot powered by YesScale AI (OpenAI-compatible API). This bot provides an intelligent conversational interface with support for text conversations, image analysis, file attachments, and context-aware responses.

## Features

- **Conversational AI**: Natural conversations powered by YesScale AI
- **Multi-turn Context**: Maintains conversation history (up to 20 messages)
- **Image Analysis**: Analyze images using vision models (GPT-4o, Claude, etc.)
- **File Attachments**: Support for PDF, DOCX, and text file analysis
- **Streaming Responses**: Real-time streaming responses with typing indicators
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **Session Management**: Automatic session cleanup and management
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Production Ready**: Logging, monitoring, and graceful shutdown support

## Tech Stack

- **Runtime**: Node.js v18+
- **Language**: TypeScript (strict mode)
- **Bot Framework**: Grammy
- **AI API**: YesScale AI (OpenAI-compatible)
- **Logging**: Winston
- **Validation**: Zod
- **Session Storage**: In-memory (Redis-ready architecture)

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- YesScale API Key (from [YesScale.io](https://yescale.io/))

## Installation

1. **Clone the repository**:

    ```bash
    git clone <repository-url>
    cd yescale-telegram-bot
    ```

2. **Install dependencies**:

    ```bash
    npm install
    ```

3. **Create environment file**:

    ```bash
    cp .env.example .env
    ```

4. **Configure environment variables**:

    Edit `.env` and add your credentials:

    ```env
    BOT_TOKEN=your_telegram_bot_token
    YESCALE_API_KEY=your_yescale_api_key
    ```

## Configuration

### Required Environment Variables

- `BOT_TOKEN`: Your Telegram bot token from @BotFather
- `YESCALE_API_KEY`: Your YesScale API key from [YesScale.io](https://yescale.io/)

### Optional Environment Variables

| Variable               | Default                     | Description                              |
| ---------------------- | --------------------------- | ---------------------------------------- |
| `NODE_ENV`             | `development`               | Environment mode                         |
| `LOG_LEVEL`            | `info`                      | Logging level (error, warn, info, debug) |
| `SESSION_TIMEOUT`      | `3600000`                   | Session timeout in milliseconds (1 hour) |
| `MAX_HISTORY_LENGTH`   | `20`                        | Maximum conversation history length      |
| `RATE_LIMIT_MESSAGES`  | `20`                        | Text messages per minute per user        |
| `RATE_LIMIT_IMAGES`    | `5`                         | Images per minute per user               |
| `YESCALE_BASE_URL`     | `https://api.yescale.io/v1` | YesScale API base URL                    |
| `YESCALE_TEXT_MODEL`   | `gpt-4o`                    | AI model for text generation             |
| `YESCALE_VISION_MODEL` | `gpt-4o`                    | AI model for vision/image analysis       |
| `YESCALE_TEMPERATURE`  | `0.7`                       | AI generation temperature (0.0 to 2.0)   |

See `.env.example` for complete configuration options.

## Usage

### Development Mode

Run the bot in development mode with auto-reload:

```bash
npm run dev
```

### Production Mode

1. Build the TypeScript code:

    ```bash
    npm run build
    ```

2. Start the bot:
    ```bash
    npm start
    ```

### Type Checking

Check TypeScript types without compiling:

```bash
npm run type-check
```

## Bot Commands

| Command  | Description                               |
| -------- | ----------------------------------------- |
| `/start` | Show welcome message and introduction     |
| `/help`  | Display available commands and usage      |
| `/new`   | Start a new conversation (clears context) |
| `/clear` | Clear conversation history                |

## Features in Detail

YesScale AI

- Maintains conversation context for natural multi-turn conversations
- Supports up to 20 messages in history
- Automatic context pruning when limit is reached
- Multiple AI models available (GPT-4o, Claude, Gemini, DeepSeek, etc.)
- Maintains conversation context for natural multi-turn conversations
- Supports up to 20 messages in history
- Automatic context pruning when limit is reached

### Image Analysis

- Send images directly to the bot for analysis
- Add captions to ask specific questions about images
- Supports JPEG, PNG, WebP, HEIC, and HEIF formats
- Maximum file size: 10MB for photos, 50MB for documents

### Streaming Responses

- Real-time streaming of AI responses
- Typing indicator while processing
- Progressive message updates during generation
- Automatic message splitting for long responses

### Rate Limiting

- 20 text messages per minute per user
- 5 images per minute per user
- Automatic reset every minute
- User-friendly error messages when limits are reached

### Session Management

- Automatic session creation for new users
- Session persistence across bot restarts (in production with Redis)
- Automatic cleanup of inactive sessions (after 1 hour)
- Per-user conversation history and settings

## Project Structure

yescale-telegram-bot/
├── src/
│ ├── index.ts # Entry point
│ ├── config/
│ │ ├── bot.config.ts # Bot configuration
│ │ └── yescale.config.ts # YesScale API config
│ ├── bot/
│ │ ├── bot.ts # Grammy bot instance
│ │ ├── commands/ # Command handlers
│ │ ├── handlers/ # Message handlers
│ │ └── middlewares/ # Custom middlewares
│ ├── services/
│ │ ├── yescale.service.ts # YesScale API integration
│ │ ├── conversation.service.ts # Conversation management
│ │ ├── file.service.ts # File handling
│ │ └── storage.service.ts # Data persistence
│ ├── types/
│ │ ├── session.types.ts # Type definitions
│ │ └── index.ts
│ └── utils/
│ ├── logger.ts # Winston logger
│ ├── constants.ts # Constants
│ ├── formatter.ts # Message formatting
│ └── file-parser.ts # File parsing utilities
│ └── formatter.ts # Message formatting
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md

````

## Development

### Code Style

This project uses:
- TypeScript strict mode
- ESLint for linting
- Prettier for code formatting

Format code:
```bash
npm run format
````

Lint code:

```bash
npm run lint
```

### Adding New Features

1. **New Commands**: Add handler in `src/bot/commands/`
2. **New Message Handlers**: Add handler in `src/bot/handlers/`
3. **New Middlewares**: Add middleware in `src/bot/middlewares/`
4. **New Services**: Add service in `src/services/`

### Logging

The bot uses Winston for logging with:

- Console transport (colored output)
- File transport (`logs/combined.log`)
- Error file transport (`logs/error.log`)

Log levels: `error`, `warn`, `info`, `debug`

## Deployment

### Using PM2 (Recommended)

1. Install PM2:

    ```bash
    npm install -g pm2
    ```

2. Build the project:

    ```bash
    npm run build
    ```

3. Start with PM2:yescale

    ```bash
    pm2 start dist/index.js --name gemini-bot
    ```

4. Save PM2 configuration:
    ```bash
    pm2 save
    pm2 startup
    ```

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t yescale-telegram-bot .
docker run -d --env-file .env yescale-telegram-bot
```

### Environment Setup

For production deployment:

1. Set `NODE_ENV=production`
2. Set `LOG_LEVEL=info` or `warn`
3. Configure Redis for session storage (optional)
4. Set up log rotation
5. Configure monitoring and alerts

## Troubleshooting

### Bot not responding

1. Check bot token is correct
2. Verify YesScale API key is valid
3. Check logs in `logs/error.log`
4. Ensure bot has internet connectivity
5. Verify YesScale API status at [status.yescale.io](https://status.yescale.io/status/global)

### Rate limit errors

- Default limits: 20 messages/min, 5 images/min
- Adjust in `.env` file with `RATE_LIMIT_MESSAGES` and `RATE_LIMIT_IMAGES`
- Limits reset every minute

### Image analysis not working

1. Verify image format is supported (JPEG, PNG, WebP, HEIC, HEIF)
2. Check fyou're using a vision-capable model (gpt-4o, gpt-4-turbo, claude-3-opus, etc.)
3. Check YesScale API quota and balancePI is enabled
4. Check Gemini API quota

### Memory issues

- Reduce `MAX_HISTORY_LENGTH` to store fewer messages
- Reduce `SESSION_TIMEOUT` to cleanup sessions faster
- Consider implementing Redis for production

## API Limits

### Telegram API

- Maximum message length: 4096 characters
- Maximum photo size: 10MB
- Maximum document size: 50MB

### YesScale AI

- Rate limits vary by plan and model
- Check your quota and balance in YesScale dashboard
- API status: [status.yescale.io](https://status.yescale.io/status/global)
- No VPN required, global access

## Security

- Never commit `.env` file with real credentials
- Use environment variables for all secrets
- Implement rate limiting (included)
- Validate all user inputs (included)
- Keep dependencies updated

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:

- Open an issue on GitHub
- Check existing documentation
- Review logs in `logs/` directory

## Acknowledgments

- Built with [YesScale AI](https://yescale.io
- Powered by [Google Gemini AI](https://deepmind.google/technologies/gemini/)
- Logging by [Winston](https://github.com/winstonjs/winston)

---

Made with ❤️ for the Telegram and AI community
