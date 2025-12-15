import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment variable schema for bot configuration
 * Validates all required and optional settings using Zod
 */
const envSchema = z.object({
  // Required
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),

  // Optional with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),

  // Session settings
  SESSION_TIMEOUT: z.string().transform(Number).pipe(z.number().positive()).default('3600000'),
  MAX_HISTORY_LENGTH: z.string().transform(Number).pipe(z.number().positive()).default('20'),

  // Rate limiting
  RATE_LIMIT_MESSAGES: z.string().transform(Number).pipe(z.number().positive()).default('20'),
  RATE_LIMIT_IMAGES: z.string().transform(Number).pipe(z.number().positive()).default('5'),

  // Bot settings
  MAX_MESSAGE_LENGTH: z.string().transform(Number).pipe(z.number().positive()).default('4096'),
  SHOW_TYPING_INDICATOR: z.string().transform(val => val === 'true').default('true'),

  // Redis (optional)
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Timezone
  TZ: z.string().default('UTC'),
});

/**
 * Parse and validate environment variables
 */
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

const env = parseEnv();

/**
 * Bot configuration object
 * Centralized configuration for the Telegram bot
 */
export const botConfig = {
  /**
   * Telegram bot token from @BotFather
   */
  token: env.BOT_TOKEN,

  /**
   * Current environment
   */
  environment: env.NODE_ENV,

  /**
   * Is production environment
   */
  isProduction: env.NODE_ENV === 'production',

  /**
   * Is development environment
   */
  isDevelopment: env.NODE_ENV === 'development',

  /**
   * Logging level
   */
  logLevel: env.LOG_LEVEL,

  /**
   * Session configuration
   */
  session: {
    /**
     * Session timeout in milliseconds (default: 1 hour)
     */
    timeout: env.SESSION_TIMEOUT,

    /**
     * Maximum number of messages to keep in conversation history
     */
    maxHistoryLength: env.MAX_HISTORY_LENGTH,
  },

  /**
   * Rate limiting configuration
   */
  rateLimit: {
    /**
     * Maximum text messages per minute per user
     */
    messagesPerMinute: env.RATE_LIMIT_MESSAGES,

    /**
     * Maximum image messages per minute per user
     */
    imagesPerMinute: env.RATE_LIMIT_IMAGES,

    /**
     * Window duration in milliseconds (1 minute)
     */
    windowMs: 60 * 1000,
  },

  /**
   * Message configuration
   */
  message: {
    /**
     * Maximum message length (Telegram limit is 4096)
     */
    maxLength: env.MAX_MESSAGE_LENGTH,

    /**
     * Show typing indicator while processing
     */
    showTypingIndicator: env.SHOW_TYPING_INDICATOR,
  },

  /**
   * Redis configuration (optional)
   */
  redis: {
    /**
     * Redis connection URL
     */
    url: env.REDIS_URL,

    /**
     * Redis password
     */
    password: env.REDIS_PASSWORD,

    /**
     * Whether Redis is enabled
     */
    enabled: !!env.REDIS_URL,
  },

  /**
   * Timezone for logging
   */
  timezone: env.TZ,
} as const;

/**
 * Type definition for bot configuration
 */
export type BotConfig = typeof botConfig;
