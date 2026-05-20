# Codebase Summary

## Overview

**YesScale/OpenRouter Telegram AI Bot** — 28 TypeScript files (~3,500 LOC) implementing a production-ready Telegram bot with OpenRouter AI integration, streaming responses, file analysis, and session management.

**Entry Point**: `src/index.ts` (80 LOC)  
**Runtime**: Node.js 18+, long polling mode  
**Language**: TypeScript (strict mode)

## Directory Structure

```
src/
├── index.ts                          (80 LOC)    Entry point, graceful shutdown
├── config/
│   ├── bot.config.ts               (168 LOC)    Bot/session/rate-limit config (Zod)
│   └── openrouter.config.ts         (92 LOC)    OpenRouter API config (Zod)
├── bot/
│   ├── bot.ts                       (113 LOC)    Grammy bot factory, middleware/handler registration
│   ├── commands/
│   │   ├── start.command.ts          (23 LOC)    /start → welcome message
│   │   ├── help.command.ts           (23 LOC)    /help → help text
│   │   ├── new.command.ts            (30 LOC)    /new → clear conversation history
│   │   ├── clear.command.ts          (30 LOC)    /clear → history alias
│   │   └── index.ts                   (8 LOC)    Command exports
│   ├── handlers/
│   │   ├── text.handler.ts          (191 LOC)    Text messages → streaming AI response
│   │   ├── photo.handler.ts          (84 LOC)    Photo upload → AI image summary
│   │   ├── document.handler.ts      (114 LOC)    PDF/DOCX/text files → parse + AI summary
│   │   ├── image.handler.ts         (244 LOC)    Image analysis (vision model, streaming)
│   │   └── index.ts                   (8 LOC)    Handler exports
│   └── middlewares/
│       ├── session.middleware.ts     (76 LOC)    Load/save UserSession per message
│       ├── ratelimit.middleware.ts   (86 LOC)    Per-user sliding window rate limiting
│       ├── error.middleware.ts       (94 LOC)    Global error handler + BotCustomError
│       └── index.ts                   (7 LOC)    Middleware exports
├── services/
│   ├── openrouter.service.ts        (632 LOC)    OpenRouter API (text, vision, streaming, retry)
│   ├── conversation.service.ts      (225 LOC)    Conversation history management
│   ├── file.service.ts              (233 LOC)    File upload handling, disk persistence
│   └── storage.service.ts           (204 LOC)    In-memory session storage, auto-cleanup
├── types/
│   ├── session.types.ts             (423 LOC)    All domain types (UserSession, ConversationMessage, etc.)
│   └── index.ts                      (25 LOC)    Type exports
└── utils/
    ├── constants.ts                 (267 LOC)    COMMANDS, MESSAGES, LIMITS, RETRY_CONFIG
    ├── formatter.ts                 (296 LOC)    Markdown→HTML, message splitting, truncation
    ├── logger.ts                    (172 LOC)    Winston logger + logUserAction, logApiCall
    └── file-parser.ts               (153 LOC)    PDF/DOCX/text/JSON/image parsing
```

**Total**: ~3,500 LOC across 28 files

## Key Files & Responsibilities

### Entry Point & Bootstrap

**`src/index.ts`** (80 LOC)
- Main async function: bot creation, command setup, graceful shutdown
- Signal handlers: SIGINT, SIGTERM, uncaughtException, unhandledRejection
- Logs startup banner with bot info (username, ID, name)
- Long polling mode (not webhook)

### Configuration (Zod Validation)

**`src/config/bot.config.ts`** (168 LOC)
- Environment schema: BOT_TOKEN (required), NODE_ENV, LOG_LEVEL, timeouts, rate limits
- Exports `botConfig` object with typed interface
- Validation error exit with detailed messages

**`src/config/openrouter.config.ts`** (92 LOC)
- OpenRouter API key, base URL, model names, temperature/top-p, timeout
- Free models: llama-3.3-70b (text), gemma-3-27b (vision)
- System instruction (helpful AI assistant persona)
- Retry config: 3 retries, 1s initial delay, 2x multiplier

### Bot Core

**`src/bot/bot.ts`** (113 LOC)
- Grammy bot factory: creates bot with session middleware, error middleware, rate-limit middleware
- Registers all commands (/start, /help, /new, /clear)
- Registers all handlers (text, photo, document, image)
- `setBotCommands()`: publishes commands to Telegram API

### Commands

- **start.command.ts** (23 LOC): Welcome message, feature list, quick help
- **help.command.ts** (23 LOC): Detailed command list + usage examples
- **new.command.ts** (30 LOC): `conversationService.clearHistory()` → reset session
- **clear.command.ts** (30 LOC): Alias for `/new`

### Handlers (Message Processing)

**`text.handler.ts`** (191 LOC)
- Core flow: Extract text → add to history → stream response via OpenRouter → update Telegram message
- Typing indicator (AbortController pattern, 1s interval)
- 1s throttle on message edits to avoid "content too similar" errors
- File context: prepend uploaded files to prompt if present
- Split long responses (>4096 chars)

**`photo.handler.ts`** (84 LOC)
- Download Telegram photo → upload to file service → extract metadata
- File context RAG: compress summary + prepend to next user message
- Store in `session.uploadedFiles`

**`document.handler.ts`** (114 LOC)
- Validate file type: PDF, DOCX, TXT, JSON, code files
- Parse via `fileParser.ts` utilities
- Max 10MB, max 10k chars per file
- Store parsed content in session for RAG

**`image.handler.ts`** (244 LOC)
- Similar to text but uses `aiService.analyzeImageStream()` (vision model)
- Download Telegram photo, upload to disk, base64 encode
- Stream vision API response with typing indicator
- Rate limited: 5 images/min per user

### Middlewares

**`session.middleware.ts`** (76 LOC)
- Load session from in-memory storage (userId key)
- Create new session if not exists
- Save session after middleware chain completes
- Default max history: 20 messages (configurable)

**`ratelimit.middleware.ts`** (86 LOC)
- Per-user sliding window: 20 msg/min, 5 img/min
- Track timestamps in session.rateLimitState
- Reject if limit exceeded, user-friendly error message
- Window duration: 60s

**`error.middleware.ts`** (94 LOC)
- Catch all handler errors
- `BotCustomError` class: code, message, statusCode
- Log stack trace (internal only, no user message exposed)
- Send user-friendly error reply

### Services

**`openrouter.service.ts`** (455 LOC)
- Uses **OpenAI SDK (v4.x)** for API communication (replaced raw fetch)
- `generateText(request)`: non-streaming text generation
- `generateStream(request)`: streaming text response via SDK
- `generateStreamWithFileContext(prompt, files, history)`: RAG streaming
- `analyzeImage(request)`: non-streaming vision
- `analyzeImageStream(request)`: streaming vision response
- `buildImageMessages()`: extracted helper for vision message formatting (DRY)
- `mapSdkError()`: preserves API error details (402, 429) via OpenAI.APIError
- `retryWithBackoff()`: exponential backoff (1s → 2s → 4s), early-abort for 401/402
- Request timeout: 120s (free tier cold start tolerance)
- Logs API calls with timing

**`conversation.service.ts`** (225 LOC)
- `addUserMessage()`: append to history, trim if >maxHistoryLength
- `addAssistantMessage()`: similar for AI responses
- `getConversationHistory()`: retrieve all messages
- `clearHistory()`: reset to empty
- Type: Array<ConversationMessage> with role, content, timestamp

**`file.service.ts`** (233 LOC)
- Download Telegram files via `ctx.api.downloadFile(fileId)`
- Save to disk: `./uploads/{userId}/{fileId}`
- Extract metadata: fileName, fileSize, fileType (pdf/docx/text/image/code/data)
- Return UploadedFile interface

**`storage.service.ts`** (204 LOC)
- In-memory Map<userId, UserSession>
- `getSession(userId)`: retrieve or create
- `saveSession(userId, session)`: persist to Map
- `shutdownSessionStorage()`: cleanup on SIGTERM
- Auto-cleanup: 1-hour inactivity timeout (configurable SESSION_TIMEOUT)
- Future: Redis adapter ready (interface defined)

### Types

**`session.types.ts`** (423 LOC)
- `UserSession`: userId, conversationHistory[], uploadedFiles[], rateLimitState, metadata
- `ConversationMessage`: role, content, timestamp, hasImage, imageData, imageMimeType, referencedFiles
- `UploadedFile`: fileId, fileName, fileType, mimeType, fileSize, uploadTime, storagePath
- `RateLimitState`: messages/images count, windowStart timestamp
- `TextGenerationRequest`: userId, prompt, conversationHistory, uploadedFiles
- `ImageAnalysisRequest`: userId, imageUrl, base64, conversationHistory
- `ApiResponse<T>`: success, data, error, usage (tokens)
- `BotContext`: Grammy Context + session middleware type

### Utilities

**`constants.ts`** (267 LOC)
- `COMMANDS`: /start, /help, /new, /clear metadata
- `MESSAGES`: error messages, welcome, help text, rate-limit messages (user-facing)
- `LIMITS`: Telegram max sizes (4096 msg, 10MB photo, 50MB document)
- `RETRY_CONFIG`: maxRetries, initialDelay, multiplier
- `TYPING_CONFIG`: interval (1000ms), chunk size (4096 chars)

**`formatter.ts`** (296 LOC)
- `convertToTelegramHtml()`: Markdown-like → Telegram HTML (bold, italic, code blocks, lists)
- `splitMessage()`: Break long responses at \n or word boundaries (max 4096 chars)
- `truncateText()`: Ellipsis truncation with optional suffix
- Handles code block escaping, link formatting

**`logger.ts`** (172 LOC)
- Winston instance with console + file transports
- Log levels: error, warn, info, debug
- Files: `logs/combined.log`, `logs/error.log`
- Helpers: `logUserAction()`, `logApiCall()`, `logStartup()`
- Structured logging: userId, username, action, details

**`file-parser.ts`** (153 LOC)
- `parsePdf()`: pdf-parse library
- `parseDocx()`: mammoth library (extracts text from .docx)
- `parseText()`: UTF-8 text file
- `parseJson()`: JSON structure to formatted string
- `parseCode()`: Syntax-aware code file (detects language)
- `parseImage()`: Image metadata + base64 encoding
- All return: `{ success, content, error, metadata }`

## Data Flow

```
1. Telegram Update arrives via long polling
   ↓
2. Grammy routes to appropriate handler
   ↓
3. session.middleware.ts → Load UserSession from Map
   ↓
4. ratelimit.middleware.ts → Check message/image count
   ↓
5. Handler (text/photo/document/image) executes
   ├─ textHandler: sends typing indicator, streams OpenRouter response
   ├─ photoHandler: downloads, stores, prepends to next message
   ├─ documentHandler: parses file, prepends to next message
   └─ imageHandler: analyzes image via vision model, streams response
   ↓
6. openrouter.service.ts → Fetch from OpenRouter API
   ├─ Streaming: yield chunks as they arrive (SSE)
   └─ Retry: exponential backoff on timeout
   ↓
7. Handler periodically edits Telegram message (1s throttle)
   ↓
8. formatter.ts → Split + convert to HTML
   ↓
9. Telegram API sends message
   ↓
10. session.middleware.ts → Save updated UserSession to Map
```

## Session Lifecycle

```
New User Message
  ↓
session.middleware.ts loads or creates UserSession
  ├─ userId: extracted from ctx.from.id
  ├─ conversationHistory: [] or existing
  ├─ uploadedFiles: [] or existing
  ├─ rateLimitState: { messages: count, images: count, windowStart: timestamp }
  └─ metadata: { createdAt, lastActivity }
  ↓
ratelimit.middleware.ts checks sliding window
  ├─ If limit exceeded: reject, save session, return error
  └─ Else: proceed
  ↓
Handler processes (e.g., textHandler)
  ├─ conversationService.addUserMessage() → append to history
  ├─ openrouter.service.generateStream() → stream response
  ├─ conversationService.addAssistantMessage() → append response
  └─ session.rateLimitState increments
  ↓
session.middleware.ts saves updated session to Map
  ↓
After 1 hour inactivity: storage.service.ts auto-cleanup removes session
```

## Code Patterns

### Error Handling
- `BotCustomError` class in error.middleware.ts
- All handlers wrapped in try-catch
- Error middleware logs + sends user-friendly message

### Streaming
- `generateStream()` yields chunks: `for await (const chunk of stream)`
- Message edit throttle: compare `Date.now() - lastUpdateTime >= 1000`
- Typing indicator: AbortController with parallel sendChatAction loop

### File Context RAG
- Store `uploadedFiles` in session
- Prepend to prompt: `fileContent.slice(0, 10000)` per file
- Simple but effective for context

### Rate Limiting
- Per-user sliding window, stored in session
- Check: `(now - windowStart) > 60000` → reset count
- Otherwise: increment and compare to limit

### Type Safety
- Zod for config validation (fail fast at startup)
- Session type: strongly typed `BotContext<UserSession>`
- All API responses typed (never raw JSON)

## Testing & Validation Strategy

### Unit Tests (planned)
- Config validation (Zod schemas)
- Formatter edge cases (truncation, splitting, HTML escaping)
- Rate limit calculation
- File parsing (mocked files)

### Integration Tests (planned)
- Session lifecycle (create, update, cleanup)
- Command handlers (mocked Telegram API)
- OpenRouter streaming (mocked SSE)

### Manual Testing
- `/start`, `/help`, `/new`, `/clear` commands
- Text message → stream response
- Photo upload → image summary
- PDF/DOCX → parsed + context
- Rate limit: send 21 messages → reject 21st
- Long response → split into multiple messages
- SIGTERM → graceful shutdown

## Performance Characteristics

| Metric | Target | Notes |
|--------|--------|-------|
| Startup | <5s | Exclude first OpenRouter cold start |
| Text Response (excl. API) | <100ms | Streaming overhead |
| Memory per 100 sessions | <50MB | 20-message history + files |
| API Timeout | 120s | Free tier cold starts |
| Typing Indicator | 1s interval | Parallel AbortController |
| Message Edit Throttle | 1s | Avoid Telegram "content too similar" |
| File Parse | <5s | PDF/DOCX up to 10k chars |

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| grammy | ^1.21.1 | Telegram bot framework |
| openai | ^4.x | OpenRouter API client (SDK-based) |
| dotenv | ^16.4.1 | Environment variable loading |
| zod | ^3.22.4 | Config validation |
| winston | ^3.11.0 | Logging (console + file) |
| pdf-parse | ^1.1.1 | PDF text extraction |
| mammoth | ^1.6.0 | DOCX text extraction |
| typescript | ^5.3.3 | TypeScript compiler |

## Future Extension Points

1. **Redis Storage**: Replace `storage.service.ts` Map with Redis adapter
2. **Webhook Mode**: Add `src/bot/webhook.ts` for production scaling
3. **Analytics**: Track usage (messages, tokens, models) in database
4. **Queuing**: Bull/RabbitMQ for backpressure on high-volume
5. **Multi-language**: Add i18n for messages
6. **Model Switching**: Allow users to pick text/vision models
7. **Admin Dashboard**: Web UI for logs, user management, quotas
