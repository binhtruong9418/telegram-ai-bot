import OpenAI from "openai";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const openrouterEnvSchema = z.object({
    OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),

    OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
    OPENROUTER_TEXT_MODEL: z.string().default("meta-llama/llama-3.3-70b-instruct:free"),
    OPENROUTER_VISION_MODEL: z.string().default("google/gemma-3-27b-it:free"),
    OPENROUTER_TEMPERATURE: z
        .string()
        .transform(Number)
        .pipe(z.number().min(0).max(2))
        .default("0.7"),
    OPENROUTER_MAX_TOKENS: z
        .string()
        .transform(Number)
        .pipe(z.number().positive())
        .default("2048"),
    OPENROUTER_TOP_P: z
        .string()
        .transform(Number)
        .pipe(z.number().min(0).max(1))
        .default("0.95"),
    OPENROUTER_TIMEOUT: z
        .string()
        .transform(Number)
        .pipe(z.number().positive())
        .default("120000"),
    // Optional: identify your app to OpenRouter (shown in rankings/usage)
    OPENROUTER_APP_URL: z.string().optional(),
    OPENROUTER_APP_TITLE: z.string().optional(),
});

const parseEnv = () => {
    try {
        return openrouterEnvSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("❌ OpenRouter configuration validation failed:");
            error.errors.forEach((err) => {
                console.error(`  - ${err.path.join(".")}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
};

const env = parseEnv();

export const openrouterConfig = {
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,

    models: {
        text: env.OPENROUTER_TEXT_MODEL,
        vision: env.OPENROUTER_VISION_MODEL,
    },

    generationConfig: {
        temperature: env.OPENROUTER_TEMPERATURE,
        maxTokens: env.OPENROUTER_MAX_TOKENS,
        topP: env.OPENROUTER_TOP_P,
    },

    request: {
        timeout: env.OPENROUTER_TIMEOUT,
    },

    // Optional headers sent to OpenRouter for app identification
    appHeaders: {
        referer: env.OPENROUTER_APP_URL,
        title: env.OPENROUTER_APP_TITLE,
    },

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

export type OpenRouterConfig = typeof openrouterConfig;

export const createOpenRouterClient = (): OpenAI => {
    const defaultHeaders: Record<string, string> = {};
    if (openrouterConfig.appHeaders.referer)
        defaultHeaders["HTTP-Referer"] = openrouterConfig.appHeaders.referer;
    if (openrouterConfig.appHeaders.title)
        defaultHeaders["X-Title"] = openrouterConfig.appHeaders.title;

    return new OpenAI({
        apiKey: openrouterConfig.apiKey,
        baseURL: openrouterConfig.baseUrl,
        timeout: openrouterConfig.request.timeout,
        maxRetries: 0, // custom retryWithBackoff handles non-streaming retries
        defaultHeaders,
    });
};
