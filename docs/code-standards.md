# Code Standards & Conventions

## TypeScript Configuration

All code follows **strict TypeScript mode** (`tsconfig.json`):

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Rule**: No `any` types, no untyped parameters/returns. If typing is complex, define an interface in `types/`.

## File & Naming Conventions

### File Organization

```
src/
├── config/          → Environment & API configuration (Zod-validated)
├── bot/             → Grammy bot, commands, handlers, middlewares
├── services/        → Business logic, external API integration
├── types/           → TypeScript interfaces & types
└── utils/           → Helpers, formatters, constants, logging
```

### Naming Rules

| Category | Convention | Example |
|----------|-----------|---------|
| **Files** | kebab-case | `openrouter.service.ts`, `text.handler.ts` |
| **Exports (Classes/Interfaces)** | PascalCase | `OpenRouterService`, `BotContext` |
| **Functions/Variables** | camelCase | `generateText()`, `parseEnv()` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_HISTORY_LENGTH`, `RETRY_CONFIG` |
| **Types** | PascalCase suffix | `UserSession`, `ConversationMessage` |

### Service Naming Pattern

Services are **classes** with lowercase singleton exports:

```typescript
// src/services/openrouter.service.ts
export class OpenRouterService {
  // Implementation
}

export const openrouterService = new OpenRouterService();
```

**Usage**: `import { openrouterService } from './services/openrouter.service'`

## Code Structure

### File Size Limits

- **Max 250 LOC per file** (strict)
- If exceeding: split into focused modules
- Example: `openrouter.service.ts` (632 LOC) is an exception due to complexity, future refactor to:
  - `openrouter.service.ts` (core, ~250 LOC)
  - `openrouter-streaming.ts` (streaming logic)
  - `openrouter-vision.ts` (vision model logic)
  - `openrouter-retry.ts` (retry strategy)

### Command/Handler Structure

Each command/handler is a **named export function**:

```typescript
// src/bot/commands/start.command.ts
export const startCommand = async (ctx: BotContext): Promise<void> => {
  // Implementation
};
```

**In bot.ts**:
```typescript
bot.command('start', startCommand);
```

### Middleware Pattern

Middlewares are **named export functions** returning Promise<void>:

```typescript
// src/bot/middlewares/session.middleware.ts
export const sessionMiddleware = async (ctx: BotContext, next: NextFunction): Promise<void> => {
  // Load session
  ctx.session = getSession(ctx.from!.id);
  await next();
  // Save session
  saveSession(ctx.from!.id, ctx.session);
};
```

### Error Handling

All async operations must have try-catch:

```typescript
try {
  const result = await someAsyncOperation();
  // Handle success
} catch (error) {
  logger.error('Operation failed:', error);
  throw new BotCustomError('USER_MESSAGE', 'code', 500);
}
```

**BotCustomError** (from `error.middleware.ts`):
```typescript
export class BotCustomError extends Error {
  constructor(
    public userMessage: string,
    public code: string,
    public statusCode: number
  ) {
    super(userMessage);
  }
}
```

### Logging Pattern

All user actions and API calls logged via Winston:

```typescript
import { logger, logUserAction, logApiCall } from '../utils/logger';

// User action
logUserAction(userId, username, 'text_message', {
  messageLength: text.length,
  historyLength: history.length,
});

// API call
logApiCall('openrouter', 'generateText', {
  model: 'llama-3.3-70b-instruct:free',
  tokens: 256,
  duration: 1523,
});

// Generic log
logger.info('Session created', { userId, timestamp: Date.now() });
```

### Type Definitions

Keep all domain types in `types/session.types.ts`:

```typescript
export interface UserSession {
  userId: number;
  conversationHistory: ConversationMessage[];
  uploadedFiles: UploadedFile[];
  rateLimitState: RateLimitState;
  metadata: {
    createdAt: Date;
    lastActivity: Date;
  };
}

export interface ConversationMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: Date;
  hasImage?: boolean;
  imageData?: string;
  imageMimeType?: string;
  referencedFiles?: string[];
}
```

**Rule**: No inline types. Export from `types/index.ts`.

## Configuration & Environment

### Zod Schema Validation

All configs must use **Zod validation** at startup:

```typescript
// src/config/bot.config.ts
const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SESSION_TIMEOUT: z.string().transform(Number).pipe(z.number().positive()).default('3600000'),
});

const env = envSchema.parse(process.env);

export const botConfig = {
  token: env.BOT_TOKEN,
  logLevel: env.LOG_LEVEL,
  session: { timeout: env.SESSION_TIMEOUT },
} as const;

export type BotConfig = typeof botConfig;
```

**Rules**:
- All env vars validated at startup
- No runtime `.env.missing` errors
- Fail fast with clear error messages
- Type botConfig with `as const`

### Constants

All magic strings/numbers in `utils/constants.ts`:

```typescript
export const COMMANDS = {
  START: { command: 'start', description: 'Show welcome message' },
  HELP: { command: 'help', description: 'Show help text' },
  NEW: { command: 'new', description: 'Clear conversation' },
  CLEAR: { command: 'clear', description: 'Clear history' },
} as const;

export const MESSAGES = {
  WELCOME: 'Welcome to AI Bot!',
  ERROR_NO_MESSAGE: 'Please send a message',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Try again in 1 minute.',
} as const;

export const LIMITS = {
  MAX_MESSAGE_LENGTH: 4096,
  MAX_PHOTO_SIZE: 10 * 1024 * 1024,
  MAX_DOCUMENT_SIZE: 50 * 1024 * 1024,
  MAX_HISTORY_LENGTH: 20,
} as const;

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,
  MULTIPLIER: 2,
} as const;
```

## API Integration Patterns

### OpenRouter Service

Pattern for streaming responses:

```typescript
async *generateStream(request: TextGenerationRequest): AsyncGenerator<string> {
  const messages = [
    { role: 'system', content: systemInstruction },
    ...request.conversationHistory,
    { role: 'user', content: request.prompt },
  ];

  const response = await fetch(`${this.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    },
    body: JSON.stringify({
      model: this.textModel,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  for await (const chunk of readStream(reader, decoder)) {
    const content = extractContent(chunk);
    if (content) yield content;
  }
}
```

**Pattern**: Generator functions for streaming, async/await for non-streaming.

### Retry Logic

Exponential backoff pattern:

```typescript
async retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.MULTIPLIER, i);
        logger.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`, { error: lastError.message });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

## Session & Storage Patterns

### Session Management

In-memory Map with async interface (Redis-ready):

```typescript
const sessions = new Map<number, UserSession>();

export const getSession = (userId: number): UserSession => {
  let session = sessions.get(userId);
  if (!session) {
    session = {
      userId,
      conversationHistory: [],
      uploadedFiles: [],
      rateLimitState: { messages: 0, images: 0, windowStart: Date.now() },
      metadata: { createdAt: new Date(), lastActivity: new Date() },
    };
    sessions.set(userId, session);
  }
  return session;
};

export const saveSession = (userId: number, session: UserSession): void => {
  session.metadata.lastActivity = new Date();
  sessions.set(userId, session);
};
```

**Future**: Replace Map with Redis adapter (interface remains same).

### Rate Limiting

Sliding window pattern:

```typescript
export const checkRateLimit = (
  session: UserSession,
  type: 'message' | 'image'
): boolean => {
  const now = Date.now();
  const window = botConfig.rateLimit.windowMs; // 60s
  const limit = type === 'message' 
    ? botConfig.rateLimit.messagesPerMinute 
    : botConfig.rateLimit.imagesPerMinute;

  // Reset window if expired
  if (now - session.rateLimitState.windowStart > window) {
    session.rateLimitState.messages = 0;
    session.rateLimitState.images = 0;
    session.rateLimitState.windowStart = now;
  }

  const count = type === 'message' 
    ? session.rateLimitState.messages++ 
    : session.rateLimitState.images++;

  return count < limit;
};
```

## Formatter & Message Handling

### Message Formatting

Convert to Telegram HTML (not Markdown):

```typescript
export const convertToTelegramHtml = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')           // Bold
    .replace(/_(.*?)_/g, '<i>$1</i>')                 // Italic
    .replace(/```(.*?)```/gs, '<pre>$1</pre>')        // Code block
    .replace(/`(.*?)`/g, '<code>$1</code>')           // Inline code
    .replace(/</g, '&lt;')                             // Escape special chars
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;');
};

export const splitMessage = (text: string, maxLength: number = 4096): string[] => {
  if (text.length <= maxLength) return [text];

  const messages: string[] = [];
  let current = '';

  const lines = text.split('\n');
  for (const line of lines) {
    if ((current + line).length > maxLength) {
      messages.push(current.trim());
      current = '';
    }
    current += (current ? '\n' : '') + line;
  }

  if (current) messages.push(current.trim());
  return messages;
};
```

## File Parsing

All file parsing centralizes in `utils/file-parser.ts`:

```typescript
export interface ParseResult {
  success: boolean;
  content: string;
  error?: Error;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
  };
}

export const parseFile = async (
  buffer: Buffer,
  fileType: 'pdf' | 'docx' | 'text' | 'image' | 'code' | 'data'
): Promise<ParseResult> => {
  try {
    switch (fileType) {
      case 'pdf':
        return await parsePdf(buffer);
      case 'docx':
        return await parseDocx(buffer);
      case 'text':
        return parseText(buffer);
      case 'code':
        return parseCode(buffer);
      default:
        return { success: false, content: '', error: new Error('Unsupported type') };
    }
  } catch (error) {
    logger.error('File parse failed', { fileType, error });
    return { success: false, content: '', error: error as Error };
  }
};
```

## Grammar & Conventions

### Comments

- **File header**: Describe purpose (optional)
- **Complex functions**: Add JSDoc-style comments
- **Magic numbers**: Explain in-line

```typescript
/**
 * Generate streaming text response via OpenRouter API
 * @param request - Text generation request with history
 * @yields Chunk strings as they arrive from API
 * @throws BotCustomError on API failure after retries
 */
export async *generateStream(request: TextGenerationRequest): AsyncGenerator<string> {
  // Implementation
}

// Rate limit window is 60s, reset every minute
const WINDOW_MS = 60 * 1000;
```

### Imports

Group by category:

```typescript
// External
import { z } from 'zod';
import dotenv from 'dotenv';

// Internal config
import { botConfig } from './bot.config';

// Internal types
import { UserSession, ConversationMessage } from '../types';

// Internal utils
import { logger } from '../utils/logger';
```

## Testing Requirements

### Unit Test Pattern

```typescript
describe('conversationService', () => {
  it('should add user message to history', () => {
    const session: UserSession = {
      userId: 123,
      conversationHistory: [],
      uploadedFiles: [],
      rateLimitState: { messages: 0, images: 0, windowStart: Date.now() },
      metadata: { createdAt: new Date(), lastActivity: new Date() },
    };

    const updated = conversationService.addUserMessage(session, 'Hello');

    expect(updated.conversationHistory).toHaveLength(1);
    expect(updated.conversationHistory[0].role).toBe('user');
    expect(updated.conversationHistory[0].content).toBe('Hello');
  });
});
```

### Integration Test Pattern

Mock Grammy context:

```typescript
describe('textHandler', () => {
  it('should stream response on valid message', async () => {
    const mockCtx = {
      from: { id: 123, username: 'testuser' },
      chat: { id: 123 },
      message: { text: 'Hello', message_id: 1 },
      session: createEmptySession(123),
      reply: jest.fn().mockResolvedValue({ message_id: 2 }),
      api: { editMessageText: jest.fn().mockResolvedValue(undefined) },
    } as any;

    await textHandler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalled();
  });
});
```

## Security Practices

1. **No Secrets in Logs**: Never log API keys, tokens, user messages
2. **Input Validation**: Zod for config, type guards for data
3. **Error Messages**: User-friendly, never expose stack traces
4. **Rate Limiting**: Per-user sliding window (prevent abuse)
5. **File Limits**: Max 10MB uploads, max 10k chars parsed content
6. **Session Cleanup**: Auto-delete after 1 hour inactivity

## Deployment Checklist

- [ ] `NODE_ENV=production` set
- [ ] `LOG_LEVEL=warn` or `error` (not `debug`)
- [ ] `.env` file not committed
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes (no errors)
- [ ] `npm run build` compiles without warnings
- [ ] All `console.log()` replaced with `logger`
- [ ] Error handlers catch all edge cases
- [ ] Rate limits configured appropriately

## Code Review Checklist

- [ ] No `any` types without justification comment
- [ ] All async functions have try-catch
- [ ] File under 250 LOC (or justified)
- [ ] Type imports from `types/`
- [ ] Constants in `utils/constants.ts`
- [ ] Logging calls include context (userId, action)
- [ ] No hardcoded magic strings (use MESSAGES, COMMANDS)
- [ ] Zod validation for external inputs
- [ ] Rate limit checks before expensive operations
- [ ] Session saved after mutations
