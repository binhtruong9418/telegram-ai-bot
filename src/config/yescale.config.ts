import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Environment variable schema for YesScale configuration
 */
const yescaleEnvSchema = z.object({
    // Required
    YESCALE_API_KEY: z.string().min(1, "YESCALE_API_KEY is required"),

    // Optional with defaults
    YESCALE_BASE_URL: z.string().default("https://api.yescale.io/v1"),
    YESCALE_TEXT_MODEL: z.string().default("gpt-4o"),
    YESCALE_VISION_MODEL: z.string().default("gpt-4o"),
    YESCALE_TEMPERATURE: z
        .string()
        .transform(Number)
        .pipe(z.number().min(0).max(2))
        .default("0.7"),
    YESCALE_MAX_TOKENS: z
        .string()
        .transform(Number)
        .pipe(z.number().positive())
        .default("2048"),
    YESCALE_TOP_P: z
        .string()
        .transform(Number)
        .pipe(z.number().min(0).max(1))
        .default("0.95"),
    YESCALE_TIMEOUT: z
        .string()
        .transform(Number)
        .pipe(z.number().positive())
        .default("60000"),
});

/**
 * Parse and validate YesScale environment variables
 */
const parseYescaleEnv = () => {
    try {
        return yescaleEnvSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("❌ YesScale configuration validation failed:");
            error.errors.forEach((err) => {
                console.error(`  - ${err.path.join(".")}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
};

const env = parseYescaleEnv();

/**
 * YesScale API configuration object
 * Centralized configuration for YesScale AI integration (OpenAI-compatible)
 */
export const yescaleConfig = {
    /**
     * YesScale API key
     */
    apiKey: env.YESCALE_API_KEY,

    /**
     * API base URL
     */
    baseUrl: env.YESCALE_BASE_URL,

    /**
     * Model names
     */
    models: {
        /**
         * Text generation model
         */
        text: env.YESCALE_TEXT_MODEL,

        /**
         * Vision/multimodal model
         */
        vision: env.YESCALE_VISION_MODEL,
    },

    /**
     * Generation configuration
     */
    generationConfig: {
        /**
         * Temperature controls randomness (0.0 = deterministic, 2.0 = very random)
         */
        temperature: env.YESCALE_TEMPERATURE,

        /**
         * Maximum number of tokens to generate
         */
        maxTokens: env.YESCALE_MAX_TOKENS,

        /**
         * Top-p sampling: limits to tokens with cumulative probability p
         */
        topP: env.YESCALE_TOP_P,
    },

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
        timeout: env.YESCALE_TIMEOUT,
    },

    /**
     * System instructions for the model
     */
    systemInstruction: `You are a helpful AI assistant integrated into a Telegram bot.
You should:
- Provide clear, accurate, and helpful responses
- Be concise but thorough
- Use proper formatting when appropriate (code blocks, lists, etc.)
- Be friendly and conversational
- If you're unsure about something, admit it rather than making up information
- When analyzing images, describe what you see in detail
- When working with uploaded files, reference them by name and provide detailed analysis`,
} as const;

/**
 * Type definition for YesScale configuration
 */
export type YescaleConfig = typeof yescaleConfig;
