# Project Overview & PDR: Telegram OpenRouter AI Bot

## Executive Summary

**YesScale/OpenRouter Telegram AI Bot** is a production-ready Telegram bot powered by OpenRouter API (OpenAI-compatible). It provides real-time conversational AI with multi-modal capabilities (text, images, documents), streaming responses, rate limiting, and automatic session management. Deploy via long polling to any server.

## Product Vision

Enable Telegram users to have intelligent, context-aware conversations with state-of-the-art LLMs without API keys or technical knowledge. Deliver instant responses with typing indicators, file analysis, and conversation memory.

## Target Users

- **Primary**: Telegram users seeking instant AI assistance (writing, analysis, coding, creative tasks)
- **Secondary**: Teams building Telegram-native AI features
- **Tertiary**: Developers integrating OpenRouter models into chat interfaces

## Key Features

### Text Conversations
- Multi-turn conversations with up to 20-message history
- Streaming responses with real-time message updates (1s throttle)
- System instruction for helpful, ethical responses
- Temperature/top-p tuning (default: 0.7, 0.95)

### File & Image Analysis
- **Documents**: PDF, DOCX, plain text, JSON, code files (max 10MB)
- **Images**: JPEG, PNG, WebP, HEIC, HEIF (max 10MB)
- **Vision Model**: google/gemma-3-27b-it:free (free tier) or configurable
- **File Context**: Uploaded files prepended to prompts (max 10k chars each)

### Commands
- `/start` — Welcome & introduction
- `/help` — Command list & usage
- `/new` — Clear conversation history
- `/clear` — Alias for `/new`

### Rate Limiting
- 20 text messages/minute per user (sliding window)
- 5 images/minute per user
- Automatic window reset, user-friendly error messages

### Streaming & UX
- Progressive message updates during generation
- Typing indicator (parallel AbortController pattern)
- Auto message splitting for long responses (Telegram 4096 char limit)
- Graceful error handling with bot-level custom errors

### Session Management
- Per-user sessions (userId → UserSession Map)
- 1-hour auto-cleanup (configurable SESSION_TIMEOUT)
- In-memory storage (Redis-ready interface for future scaling)
- Conversation history + uploaded files per session

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript (strict mode) |
| **Bot Framework** | Grammy 1.21+ |
| **AI API** | OpenRouter (OpenAI-compatible) |
| **Free Models** | meta-llama/llama-3.3-70b-instruct:free (text), google/gemma-3-27b-it:free (vision) |
| **Validation** | Zod |
| **Logging** | Winston (console + file) |
| **File Parsing** | pdf-parse, mammoth (DOCX), built-in text/JSON |

## Architecture Layers

```
Telegram Update
  ↓
Grammy Long Polling
  ↓
Middleware Stack (session → rate-limit → error handler)
  ↓
Handlers (text / photo / document / image)
  ↓
OpenRouter Service (streaming, retry, file context)
  ↓
Response Formatter (HTML parse mode, message splitting)
  ↓
Telegram API (send/edit messages)
```

## Key Design Decisions

1. **Long Polling, Not Webhooks**: Easier deployment, no public URL required, suitable for free/indie deployment
2. **Streaming SSE**: OpenRouter SSE `/chat/completions` with exponential backoff retry (1→10s, 3 retries)
3. **Free Tier Models**: Cold starts (60–120s) anticipated, 120s timeout default to handle delays
4. **HTML Parse Mode**: More robust for AI-generated text than Markdown (avoid formatting conflicts)
5. **File Context RAG**: Uploaded files prepended to user message (simple, effective, max 10k chars)
6. **In-Memory Sessions**: Map-based storage for simplicity; Redis interface stub ready for scaling
7. **Per-User Sliding Window**: Rate limit resets per-minute window, user-friendly messages

## Configuration

### Required Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `BOT_TOKEN` | Telegram bot token (@BotFather) | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-xxxxx...` |

### Optional Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Environment mode (development \| production \| test) |
| `LOG_LEVEL` | `info` | Winston log level (error \| warn \| info \| debug \| verbose \| http \| silly) |
| `SESSION_TIMEOUT` | `3600000` | Session cleanup delay in ms (1 hour) |
| `MAX_HISTORY_LENGTH` | `20` | Max conversation messages to retain |
| `RATE_LIMIT_MESSAGES` | `20` | Text messages per minute per user |
| `RATE_LIMIT_IMAGES` | `5` | Image uploads per minute per user |
| `MAX_MESSAGE_LENGTH` | `4096` | Telegram message size limit (do not change) |
| `SHOW_TYPING_INDICATOR` | `true` | Show typing indicator during processing |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter API base URL |
| `OPENROUTER_TEXT_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` | Text generation model |
| `OPENROUTER_VISION_MODEL` | `google/gemma-3-27b-it:free` | Image analysis model |
| `OPENROUTER_TEMPERATURE` | `0.7` | Sampling temperature (0–2) |
| `OPENROUTER_MAX_TOKENS` | `2048` | Max tokens per response |
| `OPENROUTER_TOP_P` | `0.95` | Nucleus sampling threshold |
| `OPENROUTER_TIMEOUT` | `120000` | API request timeout in ms (2 min for cold starts) |
| `OPENROUTER_APP_URL` | — | Your app URL (for OpenRouter rankings) |
| `OPENROUTER_APP_TITLE` | — | Your app name (for OpenRouter rankings) |
| `REDIS_URL` | — | Redis connection URL (optional, for future use) |
| `TZ` | `UTC` | Timezone for logging |

## Success Criteria

### Functional
- ✅ Bot responds to `/start`, `/help`, `/new`, `/clear` commands
- ✅ Text messages trigger streaming OpenRouter API calls
- ✅ Conversation history persists per user (20-message limit)
- ✅ Images analyzed via vision model
- ✅ PDFs, DOCX, text files parsed and included in prompts
- ✅ Rate limits enforced (20 msg/min, 5 img/min per user)
- ✅ Typing indicator shown during processing
- ✅ Long messages split and sent separately
- ✅ Graceful shutdown on SIGINT/SIGTERM

### Non-Functional
- ✅ TypeScript strict mode, no `any` types
- ✅ Error handler catches and logs all exceptions
- ✅ Winston logging to console + file (combined.log, error.log)
- ✅ <5s startup time (excluding first OpenRouter cold start)
- ✅ <100MB RAM footprint (100 concurrent sessions)
- ✅ >99% uptime (0 crashes on unhandled exceptions)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| OpenRouter free tier cold starts (60–120s) | Medium | 120s timeout, inform users, use paid tier if needed |
| SSE stream interruptions | Medium | Exponential backoff (1→10s), max 3 retries |
| Session memory growth | Low | 1-hour auto-cleanup, configurable MAX_HISTORY_LENGTH |
| Rate limit gaming | Low | Per-user sliding window, reset per minute |
| Large file uploads (10MB) | Low | File size validated, memory efficiently parsed |

## Roadmap (Phases)

1. **Phase 1** (Current): Core bot + OpenRouter integration, streaming, file support
2. **Phase 2**: Redis session persistence, multi-language support
3. **Phase 3**: Analytics dashboard, usage quotas, premium tiers
4. **Phase 4**: Webhook mode, clustering, horizontal scaling

## Compliance & Security

- **No sensitive data logging**: Prompts/responses never logged to file
- **Rate limiting**: Prevent abuse, per-user sliding window
- **Input validation**: Zod schemas for all config + API payloads
- **Error messages**: User-friendly, no stack traces exposed
- **Session cleanup**: Auto-delete inactive sessions (1 hour default)
- **Environment secrets**: `.env` not committed, `.env.example` provided

## Deployment Options

| Method | Pros | Cons |
|--------|------|------|
| **Node.js + PM2** (recommended) | Simple, fast, native | Requires server management |
| **Docker** | Reproducible, scalable | Larger image size |
| **Vercel Functions** (future) | Serverless, auto-scaling | Cold starts, cost structure |

See `deployment-guide.md` for step-by-step instructions.

## Success Metrics

- **Uptime**: >99% across 30-day periods
- **Response Time**: <2s for text, <3s for images (excl. OpenRouter cold start)
- **User Retention**: Track daily active users (DAU) / monthly active users (MAU)
- **Error Rate**: <1% (API errors + client errors combined)
- **File Success Rate**: >98% (PDFs/DOCX parsed successfully)
