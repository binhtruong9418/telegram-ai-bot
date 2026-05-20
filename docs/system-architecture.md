# System Architecture

## High-Level Overview

```
┌────────────────────────────────────────────────────────────────┐
│                      Telegram Users                             │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                    Telegram Bot API                             │
│                   (Long Polling Mode)                           │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                    Grammy Framework                             │
│              (Update Router, Context)                           │
└────────────────────┬───────────────────────────────────────────┘
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
    Commands      Handlers      Middlewares
   (4 commands)  (4 handlers)  (3 middlewares)
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
  Session        RateLimit         Error
  Middleware     Middleware        Middleware
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
    Text Handler  Photo Handler  Document Handler  Image Handler
    (streaming)   (store)        (parse)           (vision stream)
       │             │             │                 │
       └─────────────┼─────────────┴─────────────────┘
                     │
                     ▼
         ┌───────────────────────────────┐
         │   OpenRouter Service          │
         │  (OpenAI-compatible API)      │
         │   - generateStream()          │
         │   - analyzeImageStream()      │
         │   - Retry with backoff        │
         └───────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────────────┐
         │    OpenRouter API              │
         │  (https://openrouter.ai/v1)   │
         │                               │
         │  - llama-3.3-70b (text)       │
         │  - gemma-3-27b (vision)       │
         └───────────────────────────────┘
```

## Component Architecture

### 1. Entry Point Layer (`src/index.ts`)

**Responsibility**: Bootstrap, lifecycle management

```typescript
main()
  ├─ Create bot instance (Grammy)
  ├─ Register commands + handlers
  ├─ Setup graceful shutdown (SIGTERM, SIGINT)
  ├─ Handle uncaught exceptions
  └─ Start long polling
```

**Flow**:
1. Load `.env` + validate config (Zod)
2. Instantiate Grammy bot with middleware chain
3. Register 4 commands + 4 handlers
4. Attach process signal handlers
5. `bot.start({ onStart: ... })` → long polling begins
6. On signal: `bot.stop()` → cleanup sessions → exit

**Graceful Shutdown Chain**:
```
SIGTERM/SIGINT
  ↓
shutdown(signal)
  ├─ bot.stop() — stop polling
  ├─ shutdownSessionStorage() — cleanup Map
  └─ process.exit(0)
```

### 2. Configuration Layer

**`bot.config.ts`** (168 LOC)
- Zod schema validation at startup
- Fail-fast on missing/invalid env vars
- Exports typed `botConfig` object with `as const`

**`openrouter.config.ts`** (108 LOC)
- `createOpenRouterClient()`: Factory function instantiating OpenAI SDK with OpenRouter base URL
- Configures SDK with API key, timeout, custom headers (HTTP-Referer, X-Title)
- Default models: llama-3.3-70b (text), gemma-3-27b (vision)
- System instruction (helpful AI persona)
- Note: maxRetries set to 0 (custom `retryWithBackoff()` in service handles retries)

### 3. Middleware Stack

All middlewares execute **before** handler, and **after** handler (cleanup phase):

#### a. Session Middleware (`76 LOC`)

```
Before Handler:
  userId = ctx.from.id
  session = getSession(userId) OR createNewSession()
  ctx.session = session

Handler Executes:
  Modifies ctx.session (history, files, rateLimitState)

After Handler:
  saveSession(userId, ctx.session)
```

**Key Methods**:
- `getSession(userId)`: Retrieve from Map or create
- `saveSession(userId, session)`: Persist to Map
- Auto-cleanup on startup: scan Map, remove expired sessions (>1h)

#### b. Rate Limit Middleware (`86 LOC`)

```
Check sliding window:
  now = Date.now()
  if (now - windowStart > 60000) → reset counters & windowStart
  else → check if count < limit

Reject if exceeded:
  Send user message: "Rate limit exceeded. Try again in X seconds."
  Save session
  Return (skip handler)

Else:
  Continue to handler
  Handler can safely increment counters
```

**Counts**:
- `rateLimitState.messages`: text message count
- `rateLimitState.images`: photo/image count

#### c. Error Middleware (`94 LOC`)

```
Wrap handler with try-catch:
  ├─ If success: return normally
  └─ If error:
      ├─ Log error + stack trace (internal only)
      ├─ Create BotCustomError
      ├─ Send user-friendly message: ctx.reply(userMessage, { parse_mode: 'HTML' })
      └─ Save session before returning
```

**BotCustomError Interface**:
```typescript
class BotCustomError extends Error {
  userMessage: string;  // What user sees
  code: string;         // Internal error code
  statusCode: number;   // HTTP-like status
}
```

### 4. Handler Layer

Each handler follows **common pattern**:

```
Handler(ctx: BotContext)
  ├─ Extract data from ctx (user, message, files)
  ├─ Validate (check limits, file types)
  ├─ Send typing indicator (if enabled)
  ├─ Call service (openrouter.service)
  │   ├─ Stream response chunks
  │   ├─ Update message periodically (1s throttle)
  │   └─ Catch errors (retry on timeout)
  ├─ Update session (add to history)
  └─ Return (middleware saves session)
```

#### a. Text Handler (`191 LOC`)

```
textHandler(ctx)
  ├─ ctx.session.addUserMessage(userText)
  ├─ Get uploaded files for context
  ├─ Call openrouterService.generateStream() with file context
  ├─ Stream loop:
  │   ├─ Accumulate chunks to fullResponse
  │   ├─ If (now - lastUpdateTime >= 1000):
  │   │   ├─ Edit Telegram message: ctx.api.editMessageText()
  │   │   └─ Update lastUpdateTime
  │   └─ Continue until stream ends
  ├─ ctx.session.addAssistantMessage(fullResponse)
  └─ Session auto-saved by middleware
```

**Special Features**:
- Typing indicator (AbortController pattern)
- 1s throttle on edits (avoid "content too similar" error)
- File context: prepend uploaded files to prompt

#### b. Photo Handler (`84 LOC`)

```
photoHandler(ctx)
  ├─ Download photo via ctx.api.downloadFile()
  ├─ Save to disk: ./uploads/{userId}/{fileId}.jpg
  ├─ Extract metadata (size, dimensions)
  ├─ Generate summary via vision model (quick)
  ├─ Compress summary, prepend to session
  └─ Reply with acknowledgment
```

**Note**: Photo becomes context for next user message.

#### c. Document Handler (`114 LOC`)

```
documentHandler(ctx)
  ├─ Validate: file type in [pdf, docx, txt, json, code]
  ├─ Check size: ≤10MB
  ├─ Download file
  ├─ Parse via fileParser.ts
  │   ├─ parsePdf() → pdf-parse
  │   ├─ parseDocx() → mammoth
  │   ├─ parseText() → UTF-8 decode
  │   └─ parseCode() → syntax highlight
  ├─ Truncate to 10k chars
  ├─ Store in session.uploadedFiles
  ├─ Reply with "Document received and analyzed"
  └─ Content auto-prepended to next user message
```

#### d. Image Handler (`244 LOC`)

```
imageHandler(ctx)
  ├─ Download image via ctx.api.downloadFile()
  ├─ Convert to base64
  ├─ Call openrouterService.analyzeImageStream()
  ├─ Stream vision response
  ├─ Edit message every 1s
  └─ Add to history with hasImage flag
```

**Vision Model**: google/gemma-3-27b-it:free (configurable).

### 5. Service Layer

#### a. OpenRouter Service (`455 LOC`)

Uses **OpenAI SDK v4** for type-safe API calls. Instances created via `createOpenRouterClient()`.

**Core Methods**:

1. **`generateText(request)`** — Non-streaming
   - Build chat messages array (OpenAI.ChatCompletionMessageParam)
   - Call `client.chat.completions.create()` with `stream: false`
   - Return full response + token usage

2. **`generateStream(request)`** — Streaming generator
   - Build chat messages array
   - Call `client.chat.completions.create()` with `stream: true`
   - Yield chunks as AsyncGenerator<string>
   - On timeout/error: handled by `retryWithBackoff()`

3. **`generateStreamWithFileContext(prompt, files, history)`** — Streaming with RAG
   - Prepend file contents (10k chars max) to prompt
   - Call generateStream() with augmented prompt
   - Return streaming response

4. **`analyzeImage(request)`** — Non-streaming vision
   - Convert image to base64
   - Build message with `type: 'image_url'` (vision model format)
   - Call `client.chat.completions.create()` with vision model
   - Return analysis + tokens

5. **`analyzeImageStream(request)`** — Streaming vision
   - Similar to analyzeImage but with `stream: true`
   - Yield chunks as AsyncGenerator<string>

6. **`buildImageMessages()`** — Helper for vision prompt construction
   - Encapsulates image message format + system instruction (DRY)

7. **`mapSdkError(error)`** — Error mapping
   - Extracts status code from `OpenAI.APIError`
   - Preserves custom messages for 402 (insufficient_quota) and 429 (rate_limit_exceeded)

**Retry Logic** (`retryWithBackoff()`):
```
Attempt 1 (immediate)
  ├─ 401/402? → Throw immediately (non-retryable)
  ├─ Timeout? → Delay 1s, try again
  └─ Success? → Return

Attempt 2 (after 1s)
  ├─ Timeout? → Delay 2s, try again
  └─ Success? → Return

Attempt 3 (after 2s)
  ├─ Timeout? → Delay 4s, try again
  └─ Success? → Return

Fail (after 4s)
  └─ Throw BotCustomError
```

**SDK Configuration** (in config):
```typescript
new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  timeout: 120000,
  maxRetries: 0,  // Custom retryWithBackoff handles retries
  defaultHeaders: {
    'HTTP-Referer': OPENROUTER_APP_URL,
    'X-Title': OPENROUTER_APP_TITLE,
  }
})
```

#### b. Conversation Service (`225 LOC`)

**Methods**:
- `addUserMessage(session, text)` — Append, trim to maxHistoryLength
- `addAssistantMessage(session, text)` — Append AI response
- `getConversationHistory(session)` — Return array
- `clearHistory(session)` — Reset to empty

**History Trimming**:
```
if (history.length > maxHistoryLength):
  Remove oldest messages until length === maxHistoryLength
```

#### c. File Service (`233 LOC`)

**Methods**:
- `downloadFile(fileId, ctx)` — Download from Telegram API
- `saveFile(buffer, userId, fileId, fileName)` — Save to `./uploads/{userId}/`
- `getFilePath(userId, fileId)` — Construct storage path
- `deleteFile(userId, fileId)` — Remove from disk

**Storage**: `./uploads/{userId}/{fileId}_{timestamp}`

#### d. Storage Service (`204 LOC`)

**In-Memory Storage**:
```typescript
const sessions = new Map<number, UserSession>();
```

**Methods**:
- `getSession(userId)` — Retrieve from Map or create empty
- `saveSession(userId, session)` — Update Map
- `deleteSession(userId)` — Remove from Map
- `shutdownSessionStorage()` — Cleanup, called on SIGTERM
- `startAutoCleanup()` — Periodic scan (30min interval), remove sessions >SESSION_TIMEOUT inactive

**Auto-Cleanup Logic**:
```
Every 30 minutes:
  For each session in sessions.Map:
    if (now - session.metadata.lastActivity > SESSION_TIMEOUT):
      Delete session
```

**Future**: Replace Map with Redis adapter (same interface).

### 6. Type Layer (`types/session.types.ts`, `423 LOC`)

**Core Types**:

```typescript
interface UserSession {
  userId: number;
  conversationHistory: ConversationMessage[];
  uploadedFiles: UploadedFile[];
  rateLimitState: RateLimitState;
  metadata: {
    createdAt: Date;
    lastActivity: Date;
  };
}

interface ConversationMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: Date;
  hasImage?: boolean;
  imageData?: string;
  imageMimeType?: string;
  referencedFiles?: string[];
}

interface UploadedFile {
  fileId: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'text' | 'image' | 'code' | 'data';
  mimeType: string;
  fileSize: number;
  uploadTime: Date;
  storagePath: string;
}

interface RateLimitState {
  messages: number;      // Current window count
  images: number;        // Current window count
  windowStart: number;   // Timestamp of window start
}

type BotContext = Context<UserSession>;  // Grammy Context + session
```

### 7. Utility Layer

#### a. Constants (`267 LOC`)

Centralized: `COMMANDS`, `MESSAGES`, `LIMITS`, `RETRY_CONFIG`, `TYPING_CONFIG`

```typescript
export const COMMANDS = { START, HELP, NEW, CLEAR };
export const MESSAGES = { WELCOME, ERROR_*, RATE_LIMIT_* };
export const LIMITS = { MAX_MESSAGE_LENGTH, MAX_PHOTO_SIZE, MAX_HISTORY_LENGTH };
export const RETRY_CONFIG = { MAX_RETRIES, INITIAL_DELAY, MULTIPLIER };
```

#### b. Formatter (`296 LOC`)

- `convertToTelegramHtml(markdown)` — Convert to HTML parse mode
- `splitMessage(text, maxLength)` — Split at word boundaries
- `truncateText(text, maxLength, suffix)` — Ellipsis

#### c. Logger (`172 LOC`)

Winston instance with:
- **Console transport**: Colored, timestamped
- **File transports**: `logs/combined.log`, `logs/error.log`

Helpers:
- `logUserAction(userId, username, action, details)` — User events
- `logApiCall(service, method, details)` — API calls
- `logStartup()` — Startup banner

#### d. File Parser (`153 LOC`)

- `parsePdf(buffer)` → pdf-parse → text extraction
- `parseDocx(buffer)` → mammoth → text extraction
- `parseText(buffer)` → UTF-8 decode
- `parseJson(buffer)` → format as string
- `parseCode(buffer)` → syntax-aware formatting
- `parseImage(buffer)` → metadata + base64

**Returns**:
```typescript
interface ParseResult {
  success: boolean;
  content: string;
  error?: Error;
  metadata?: { pageCount?, wordCount?, language? };
}
```

## Data Flow: Message Processing

### Text Message Flow

```
User sends "Hello"
  ↓
Telegram → Long polling
  ↓
Grammy routes to textHandler(ctx)
  ↓
session.middleware BEFORE:
  ctx.session = getSession(userId) OR createNewSession()
  ↓
ratelimit.middleware:
  Check: messages < 20/min? YES → continue
  ↓
textHandler(ctx):
  ├─ conversationService.addUserMessage("Hello")
  ├─ Get uploadedFiles (if any)
  ├─ openrouterService.generateStreamWithFileContext("Hello", files, history)
  ├─ FOR EACH chunk:
  │   ├─ Accumulate fullResponse
  │   ├─ IF (now - lastUpdateTime >= 1000):
  │   │   ├─ ctx.api.editMessageText(text, HTML)
  │   │   └─ lastUpdateTime = now
  │   └─ CONTINUE
  ├─ conversationService.addAssistantMessage(fullResponse)
  └─ Return
  ↓
session.middleware AFTER:
  saveSession(userId, ctx.session)
  ↓
Bot replies to user with HTML message
```

### Image Upload Flow

```
User sends image
  ↓
Grammy routes to imageHandler(ctx)
  ↓
session.middleware BEFORE:
  ctx.session = getSession(userId)
  ↓
ratelimit.middleware:
  Check: images < 5/min? YES → continue
  ↓
imageHandler(ctx):
  ├─ fileService.downloadFile(imageId)
  ├─ Convert to base64
  ├─ openrouterService.analyzeImageStream(base64, history)
  ├─ Stream vision response
  ├─ conversationService.addAssistantMessage(analysis)
  └─ Return
  ↓
session.middleware AFTER:
  saveSession(userId, ctx.session)
```

### Document Upload Flow

```
User sends PDF
  ↓
Grammy routes to documentHandler(ctx)
  ↓
session.middleware BEFORE:
  ctx.session = getSession(userId)
  ↓
documentHandler(ctx):
  ├─ fileService.downloadFile(docId)
  ├─ fileParser.parsePdf(buffer)
  ├─ Truncate to 10k chars
  ├─ session.uploadedFiles.push(UploadedFile)
  └─ Reply "Document analyzed, prepended to next message"
  ↓
session.middleware AFTER:
  saveSession(userId, ctx.session)
  ↓
Next user message:
  File content automatically prepended to prompt
  ├─ "Document: {filename}\n{parsed content}\n\nUser: {prompt}"
  └─ Stream response with context
```

## Session Lifecycle

```
┌─ New User (userId = 123)
│
├─ Message 1: textHandler
│  ├─ session.middleware: CREATE session
│  ├─ Handler: Add message to history
│  └─ session.middleware: SAVE session
│
├─ Message 2: photoHandler
│  ├─ session.middleware: LOAD session
│  ├─ Handler: Download & analyze photo
│  └─ session.middleware: SAVE session
│
├─ Message 3: textHandler
│  ├─ session.middleware: LOAD session (photo context included)
│  ├─ Handler: Stream response WITH photo context
│  └─ session.middleware: SAVE session
│
├─ (inactive for 1 hour)
│
├─ Auto-cleanup (storage.service)
│  ├─ Scan all sessions
│  ├─ Find: lastActivity > SESSION_TIMEOUT (3600000ms)
│  ├─ Delete from Map
│  └─ Free memory
│
└─ Message 4: textHandler (after cleanup)
   ├─ session.middleware: CREATE new session
   ├─ Handler: Fresh conversation (history cleared)
   └─ session.middleware: SAVE session
```

## Error Handling Layers

```
Handler throws Error
  ↓
error.middleware catches
  ├─ Log stack trace (internal only)
  ├─ Create BotCustomError:
  │  ├─ userMessage: "Sorry, an error occurred. Please try again."
  │  ├─ code: "HANDLER_ERROR"
  │  └─ statusCode: 500
  └─ ctx.reply(userMessage, { parse_mode: 'HTML' })
    ├─ Save session
    └─ Return
  ↓
User sees: "Sorry, an error occurred. Please try again."
Logs show: Full stack trace + context
```

## Concurrency & Limits

| Aspect | Limit | Strategy |
|--------|-------|----------|
| **Concurrent Users** | Unlimited (memory bound) | In-memory Map, auto-cleanup |
| **Messages/Minute** | 20 per user (sliding window) | ratelimit.middleware checks |
| **Images/Minute** | 5 per user (sliding window) | ratelimit.middleware checks |
| **History/Session** | 20 messages | conversationService trims |
| **File Size** | 10MB | File upload validated |
| **File Content** | 10k chars prepended | file-parser truncates |
| **Message Length** | 4096 chars (Telegram limit) | formatter.splitMessage() |
| **API Timeout** | 120 seconds | openrouter.service timeout |

## Scalability Roadmap

### Phase 1 (Current)
- In-memory sessions
- Long polling
- Single Node.js process
- Fits: <1000 concurrent users

### Phase 2
- Replace Map with Redis
- Same interface, different backend
- Fits: <10k concurrent users

### Phase 3
- Webhook mode (not long polling)
- Load balancer + multiple instances
- Fits: >100k concurrent users

### Phase 4
- Message queue (Bull, RabbitMQ)
- Background workers for API calls
- Analytics database
- Fits: Enterprise scale
