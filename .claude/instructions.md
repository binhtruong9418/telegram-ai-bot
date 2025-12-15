# PROJECT: GEMINI TELEGRAM BOT

## OBJECTIVE
Create a production-ready Telegram bot that interfaces with Google Gemini AI using Node.js, TypeScript, and Grammy framework. The bot should replicate Gemini AI's core functionality within Telegram.

## TECH STACK
- **Runtime**: Node.js v18+
- **Language**: TypeScript (strict mode)
- **Bot Framework**: Grammy
- **AI API**: @google/generative-ai (Gemini SDK)
- **Session Storage**: Redis (with fallback to in-memory for dev)
- **Logging**: Winston
- **Validation**: Zod
- **Environment**: dotenv

## PROJECT STRUCTURE
```
src/
├── index.ts                    # Entry point
├── config/
│   ├── bot.config.ts          # Bot configuration
│   └── gemini.config.ts       # Gemini API config
├── bot/
│   ├── bot.ts                 # Grammy bot instance
│   ├── commands/              # Command handlers
│   │   ├── index.ts
│   │   ├── start.command.ts
│   │   ├── help.command.ts
│   │   ├── new.command.ts
│   │   ├── clear.command.ts
│   │   └── settings.command.ts
│   ├── handlers/              # Message handlers
│   │   ├── index.ts
│   │   ├── text.handler.ts
│   │   ├── image.handler.ts
│   │   └── photo.handler.ts
│   └── middlewares/           # Custom middlewares
│       ├── index.ts
│       ├── session.middleware.ts
│       ├── error.middleware.ts
│       └── ratelimit.middleware.ts
├── services/
│   ├── gemini.service.ts      # Gemini API integration
│   ├── conversation.service.ts # Conversation management
│   └── storage.service.ts     # Data persistence
├── types/
│   ├── session.types.ts
│   └── gemini.types.ts
└── utils/
    ├── logger.ts
    ├── formatter.ts
    └── constants.ts
```

## CORE FEATURES TO IMPLEMENT

### 1. Commands
- `/start` - Welcome message with bot introduction
- `/help` - Display available commands and usage
- `/new` - Start a new conversation (clear context)
- `/clear` - Clear conversation history
- `/settings` - Show/change model settings (inline keyboard)

### 2. Message Handlers
- **Text Messages**: Send to Gemini with conversation context
- **Images**: Use Gemini Vision API for image analysis
- **Photos with captions**: Combine image + text prompt

### 3. Key Features
- Multi-turn conversations with context memory
- Streaming responses with typing indicator
- Image analysis capabilities
- Per-user conversation history (max 20 messages)
- Rate limiting (20 msg/min per user)
- Error handling with user-friendly messages
- Session timeout after 1 hour of inactivity

## CODING STANDARDS

### TypeScript
- Use strict mode
- Explicit return types for all functions
- Interfaces for all data structures
- No `any` types unless absolutely necessary
- Use enums for constants

### Code Style
- Use async/await (no raw promises)
- Descriptive variable names
- Single responsibility principle
- Extract magic numbers to constants
- Add JSDoc comments for public functions

### Error Handling
- Try-catch blocks for all async operations
- Log all errors with Winston
- User-friendly error messages (no stack traces to users)
- Graceful degradation

### Security
- Validate all user inputs with Zod
- Sanitize file uploads
- Rate limiting per user
- Never log sensitive data (API keys, tokens)
- Use environment variables for secrets

## IMPLEMENTATION PRIORITIES

### Phase 1: Core Setup (Must Have)
1. Project initialization with TypeScript
2. Grammy bot setup with basic commands
3. Gemini API integration for text
4. Simple in-memory session storage
5. Basic error handling

### Phase 2: Essential Features (Must Have)
1. Conversation history management
2. Image handling with Gemini Vision
3. Streaming responses
4. Rate limiting middleware
5. Winston logging

### Phase 3: Polish (Should Have)
1. Redis session storage
2. Settings command with inline keyboard
3. Better error messages
4. Conversation export
5. Health check endpoint

### Phase 4: Advanced (Nice to Have)
1. Document file support
2. Voice message transcription
3. Multi-language support
4. Usage analytics
5. Admin commands

## SPECIFIC REQUIREMENTS

### Session Management
- Store per-user conversation history
- Max 20 messages per conversation
- Include timestamps
- Auto-cleanup after 1 hour inactive
- Format: `{ userId: number, messages: Message[], lastActive: Date }`

### Gemini Integration
- Use `gemini-pro` for text
- Use `gemini-pro-vision` for images
- Stream responses in real-time
- Handle rate limits gracefully
- Default temperature: 0.7
- Max output tokens: 2048

### Message Formatting
- Use Markdown for code blocks
- Escape special characters
- Truncate very long messages (>4096 chars)
- Add "✨ Powered by Gemini AI" footer

### Rate Limiting
- 20 messages per minute per user
- 5 images per minute per user
- Return friendly message when exceeded
- Reset counter every minute

## ENVIRONMENT VARIABLES
```
# Required
BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key

# Optional
NODE_ENV=development
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379
SESSION_TIMEOUT=3600000
MAX_HISTORY_LENGTH=20
```

## TESTING CHECKLIST
- [ ] /start command shows welcome
- [ ] /help shows command list
- [ ] Text message gets Gemini response
- [ ] Image upload triggers Vision API
- [ ] Conversation context maintained
- [ ] /new clears context
- [ ] Rate limiting works
- [ ] Error messages are user-friendly
- [ ] Bot recovers from errors
- [ ] Multiple users don't interfere

## SUCCESS CRITERIA
1. Bot responds to messages within 3 seconds
2. Maintains conversation context correctly
3. Handles images with proper analysis
4. No crashes from user input
5. Clean, maintainable code
6. Proper error logging
7. Easy to deploy

## NOTES
- Prioritize code quality over features
- Write production-ready code from start
- Add TODO comments for future enhancements
- Keep functions under 50 lines
- Use dependency injection where appropriate

---

## 🎬 WORKFLOW VỚI CLAUDE CODE

### Prompt để bắt đầu

Copy đoạn này vào Claude Code:
```
I want to build a Telegram bot that integrates with Google Gemini AI. Please create a complete, production-ready implementation following these requirements:

PROJECT SETUP:
1. Initialize a TypeScript Node.js project
2. Install and configure all necessary dependencies
3. Create the folder structure as specified
4. Set up TypeScript with strict mode
5. Add necessary scripts to package.json

CORE IMPLEMENTATION:
1. Grammy bot with command handlers (/start, /help, /new, /clear)
2. Gemini API service with text and image support
3. Session middleware for conversation history
4. Rate limiting middleware
5. Error handling middleware
6. Text message handler with streaming responses
7. Image handler with Gemini Vision API

CONFIGURATION:
1. Create .env.example with all required variables
2. Set up Winston logger with file and console transports
3. Configure Gemini API with proper safety settings
4. Add proper TypeScript types for all data structures

FEATURES:
1. Multi-turn conversations with context (max 20 messages)
2. Streaming responses with typing indicator
3. Image analysis with captions
4. Rate limiting (20 msg/min, 5 images/min per user)
5. Session auto-cleanup after 1 hour
6. Markdown formatting for responses

Please create all files with:
- Complete, working code (no placeholders)
- Proper error handling
- TypeScript strict mode compliance
- Detailed comments
- Production-ready quality

Start by creating the project structure and package.json, then implement each module systematically.
```

---

## 📝 PROMPT TỪNG BƯỚC (Nếu muốn kiểm soát chi tiết)

### Step 1: Project Init
```
Create the initial project structure:
1. package.json with all dependencies (grammy, @google/generative-ai, dotenv, winston, zod)
2. tsconfig.json with strict mode
3. .env.example file
4. .gitignore for Node.js
5. README.md with setup instructions
6. All folder structure as specified

Include proper scripts for dev, build, and start.
```

### Step 2: Core Config
```
Create configuration files:
1. src/config/bot.config.ts - Bot settings (token, session timeout, rate limits)
2. src/config/gemini.config.ts - Gemini settings (API key, models, generation config)
3. src/utils/logger.ts - Winston logger setup with file rotation
4. src/utils/constants.ts - All constant values

Use Zod for environment variable validation.
```

### Step 3: Type Definitions
```
Create TypeScript type definitions:
1. src/types/session.types.ts - Session, Message, UserSettings interfaces
2. src/types/gemini.types.ts - GeminiRequest, GeminiResponse types

Include proper JSDoc comments.
```

### Step 4: Services
```
Implement service layer:
1. src/services/storage.service.ts - In-memory session storage with Map
2. src/services/conversation.service.ts - Conversation history management
3. src/services/gemini.service.ts - Complete Gemini API integration with streaming

Include error handling and logging in all services.
```

### Step 5: Middlewares
```
Create Grammy middlewares:
1. src/bot/middlewares/session.middleware.ts - Load/save user sessions
2. src/bot/middlewares/ratelimit.middleware.ts - Rate limiting logic
3. src/bot/middlewares/error.middleware.ts - Global error handler

Each middleware should have proper TypeScript types.
```

### Step 6: Commands
```
Implement command handlers:
1. src/bot/commands/start.command.ts - Welcome message
2. src/bot/commands/help.command.ts - Command list
3. src/bot/commands/new.command.ts - Clear conversation
4. src/bot/commands/clear.command.ts - Clear history
5. src/bot/commands/index.ts - Register all commands

Use Grammy's command composer pattern.
```

### Step 7: Message Handlers
```
Create message handlers:
1. src/bot/handlers/text.handler.ts - Handle text with Gemini, streaming response
2. src/bot/handlers/image.handler.ts - Handle images with Gemini Vision
3. src/bot/handlers/index.ts - Register all handlers

Include typing indicator and proper error messages.
```

### Step 8: Bot Setup
```
Create main bot file:
1. src/bot/bot.ts - Initialize Grammy bot, register all middlewares, commands, handlers
2. src/index.ts - Entry point, start bot, handle graceful shutdown

Include health check and proper logging.
```

### Step 9: Testing & Polish
```
Add:
1. Example .env file with comments
2. Comprehensive README with setup, deployment, troubleshooting
3. Add error message constants
4. Add response formatters for better UX
5. Add TODO comments for future features
```

---

## 🔧 DEBUGGING PROMPTS

Khi gặp lỗi, dùng các prompt này:

### Lỗi TypeScript
```
I'm getting TypeScript error: [paste error]

Please:
1. Explain what's causing this error
2. Show the corrected code
3. Explain the fix
```

### Lỗi Runtime
```
The bot crashes with this error: [paste error]

Please:
1. Identify the root cause
2. Add proper error handling
3. Add logging to debug
4. Show the fixed code
```

### Gemini API Issues
```
Gemini API returns: [paste error/response]

Please:
1. Check API request format
2. Verify authentication
3. Add retry logic if needed
4. Show corrected implementation
```

### Performance Issues
```
The bot is slow when [describe scenario]

Please:
1. Identify bottlenecks
2. Suggest optimizations
3. Implement caching if needed
4. Show improved code
```

---

## 🎨 ENHANCEMENT PROMPTS

Sau khi có MVP, dùng để thêm features:

### Redis Integration
```
Replace in-memory storage with Redis:
1. Install ioredis
2. Create RedisStorageService
3. Update session middleware
4. Add Redis connection handling
5. Add graceful shutdown for Redis
```

### Inline Keyboard Settings
```
Add /settings command with inline keyboard:
1. Show current model, temperature settings
2. Buttons to change model (gemini-pro, gemini-1.5-pro)
3. Buttons to adjust temperature (0.5, 0.7, 0.9)
4. Show updated settings after change
```

### Document Support
```
Add support for PDF and document files:
1. Download document from Telegram
2. Extract text content
3. Send to Gemini for analysis
4. Handle large documents (chunking)
```

### Conversation Export
```
Add /export command to download conversation:
1. Format conversation as Markdown
2. Create file and send to user
3. Include timestamps and roles
4. Handle large conversations
```
