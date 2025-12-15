import { z } from 'zod';
import dotenv from 'dotenv';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

// Load environment variables
dotenv.config();

/**
 * Environment variable schema for Gemini configuration
 */
const geminiEnvSchema = z.object({
  // Required
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),

  // Optional with defaults
  GEMINI_TEXT_MODEL: z.string().default('gemini-pro'),
  GEMINI_VISION_MODEL: z.string().default('gemini-pro-vision'),
  GEMINI_TEMPERATURE: z.string().transform(Number).pipe(z.number().min(0).max(1)).default('0.7'),
  GEMINI_MAX_TOKENS: z.string().transform(Number).pipe(z.number().positive()).default('2048'),
  GEMINI_TOP_K: z.string().transform(Number).pipe(z.number().positive()).default('40'),
  GEMINI_TOP_P: z.string().transform(Number).pipe(z.number().min(0).max(1)).default('0.95'),
});

/**
 * Parse and validate Gemini environment variables
 */
const parseGeminiEnv = () => {
  try {
    return geminiEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Gemini configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

const env = parseGeminiEnv();

/**
 * Safety settings for Gemini API
 * Configures content filtering for harmful content
 */
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/**
 * Gemini API configuration object
 * Centralized configuration for Google Gemini AI integration
 */
export const geminiConfig = {
  /**
   * Google Gemini API key
   */
  apiKey: env.GEMINI_API_KEY,

  /**
   * Model names
   */
  models: {
    /**
     * Text generation model
     */
    text: env.GEMINI_TEXT_MODEL,

    /**
     * Vision/multimodal model
     */
    vision: env.GEMINI_VISION_MODEL,
  },

  /**
   * Generation configuration for text model
   */
  generationConfig: {
    /**
     * Temperature controls randomness (0.0 = deterministic, 1.0 = very random)
     */
    temperature: env.GEMINI_TEMPERATURE,

    /**
     * Maximum number of tokens to generate
     */
    maxOutputTokens: env.GEMINI_MAX_TOKENS,

    /**
     * Top-k sampling: limits to top k most likely tokens
     */
    topK: env.GEMINI_TOP_K,

    /**
     * Top-p sampling: limits to tokens with cumulative probability p
     */
    topP: env.GEMINI_TOP_P,
  },

  /**
   * Safety settings to filter harmful content
   */
  safetySettings,

  /**
   * Request configuration
   */
  request: {
    /**
     * Maximum retries for failed requests
     */
    maxRetries: 3,

    /**
     * Initial retry delay in milliseconds
     */
    retryDelay: 1000,

    /**
     * Request timeout in milliseconds
     */
    timeout: 30000,
  },

  /**
   * System instructions for the model
   */
  systemInstruction: {
    text: `You are a helpful AI assistant integrated into a Telegram bot.
You should:
- Provide clear, accurate, and helpful responses
- Be concise but thorough
- Use proper formatting when appropriate (code blocks, lists, etc.)
- Be friendly and conversational
- If you're unsure about something, admit it rather than making up information
- When analyzing images, describe what you see in detail`,
  },
} as const;

/**
 * Type definition for Gemini configuration
 */
export type GeminiConfig = typeof geminiConfig;
