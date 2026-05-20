import { openrouterConfig } from "../config/openrouter.config";
import {
    TextGenerationRequest,
    ImageAnalysisRequest,
    ApiResponse,
    GeminiStreamChunk,
    UploadedFile,
    ConversationMessage,
} from "../types";
import { logger, logApiCall, logError } from "../utils/logger";
import { RETRY_CONFIG, ERROR_CODES } from "../utils/constants";

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content:
        | string
        | Array<{
              type: "text" | "image_url";
              text?: string;
              image_url?: {
                  url: string;
                  detail?: "auto" | "low" | "high";
              };
          }>;
}

interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * OpenRouter AI Service
 * Handles all interactions with OpenRouter API (OpenAI-compatible)
 */
export class OpenRouterService {
    private baseUrl: string;
    private apiKey: string;
    private textModel: string;
    private visionModel: string;
    private extraHeaders: Record<string, string>;

    constructor() {
        this.baseUrl = openrouterConfig.baseUrl;
        this.apiKey = openrouterConfig.apiKey;
        this.textModel = openrouterConfig.models.text;
        this.visionModel = openrouterConfig.models.vision;

        // Build optional OpenRouter identification headers
        this.extraHeaders = {};
        if (openrouterConfig.appHeaders.referer) {
            this.extraHeaders["HTTP-Referer"] = openrouterConfig.appHeaders.referer;
        }
        if (openrouterConfig.appHeaders.title) {
            this.extraHeaders["X-Title"] = openrouterConfig.appHeaders.title;
        }

        logger.info("OpenRouter service initialized", {
            baseUrl: this.baseUrl,
            textModel: this.textModel,
            visionModel: this.visionModel,
        });
    }

    async generateText(
        request: TextGenerationRequest
    ): Promise<ApiResponse<string>> {
        const startTime = Date.now();

        try {
            logger.info(`Generating text for user ${request.userId}`, {
                promptLength: request.prompt.length,
                historyLength: request.conversationHistory.length,
            });

            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: openrouterConfig.systemInstruction,
                },
                ...this.formatHistory(request.conversationHistory),
                {
                    role: "user",
                    content: request.prompt,
                },
            ];

            const result = await this.retryWithBackoff(async () => {
                return await this.chatCompletion(
                    messages,
                    this.textModel,
                    request.settings
                );
            });

            const text = result.choices[0]?.message?.content || "";
            const duration = Date.now() - startTime;
            logApiCall("OpenRouter", "generateText", duration, true);
            logger.info(`Generated ${text.length} characters for user ${request.userId}`);

            return { success: true, data: text, duration };
        } catch (error) {
            const duration = Date.now() - startTime;
            logApiCall("OpenRouter", "generateText", duration, false);
            logError(error as Error, "generateText", {
                userId: request.userId,
                promptLength: request.prompt.length,
            });

            return {
                success: false,
                error: (error as Error).message,
                errorCode: ERROR_CODES.AI_API_ERROR,
                duration,
            };
        }
    }

    async *generateTextStream(
        request: TextGenerationRequest
    ): AsyncGenerator<GeminiStreamChunk, void, unknown> {
        try {
            logger.info(`Streaming text for user ${request.userId}`, {
                promptLength: request.prompt.length,
                historyLength: request.conversationHistory.length,
            });

            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: openrouterConfig.systemInstruction,
                },
                ...this.formatHistory(request.conversationHistory),
                {
                    role: "user",
                    content: request.prompt,
                },
            ];

            let index = 0;
            for await (const chunk of this.chatCompletionStream(
                messages,
                this.textModel,
                request.settings
            )) {
                yield { text: chunk, done: false, index: index++ };
            }

            yield { text: "", done: true, index: index };
            logger.info(`Completed streaming for user ${request.userId}`);
        } catch (error) {
            logError(error as Error, "generateTextStream", { userId: request.userId });
            throw error;
        }
    }

    async analyzeImage(
        request: ImageAnalysisRequest
    ): Promise<ApiResponse<string>> {
        const startTime = Date.now();

        try {
            logger.info(`Analyzing image for user ${request.userId}`, {
                mimeType: request.mimeType,
                hasPrompt: !!request.prompt,
            });

            const imageData =
                typeof request.imageData === "string"
                    ? request.imageData
                    : request.imageData.toString("base64");

            const imageUrl = `data:${request.mimeType};base64,${imageData}`;

            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: openrouterConfig.systemInstruction,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: request.prompt || "Describe this image in detail.",
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageUrl, detail: "auto" },
                        },
                    ],
                },
            ];

            const result = await this.retryWithBackoff(async () => {
                return await this.chatCompletion(messages, this.visionModel);
            });

            const text = result.choices[0]?.message?.content || "";
            const duration = Date.now() - startTime;
            logApiCall("OpenRouter", "analyzeImage", duration, true);
            logger.info(`Analyzed image for user ${request.userId}: ${text.length} characters`);

            return { success: true, data: text, duration };
        } catch (error) {
            const duration = Date.now() - startTime;
            logApiCall("OpenRouter", "analyzeImage", duration, false);
            logError(error as Error, "analyzeImage", {
                userId: request.userId,
                mimeType: request.mimeType,
            });

            return {
                success: false,
                error: (error as Error).message,
                errorCode: ERROR_CODES.AI_API_ERROR,
                duration,
            };
        }
    }

    async *analyzeImageStream(
        request: ImageAnalysisRequest
    ): AsyncGenerator<GeminiStreamChunk, void, unknown> {
        try {
            logger.info(`Streaming image analysis for user ${request.userId}`, {
                mimeType: request.mimeType,
                hasPrompt: !!request.prompt,
            });

            const imageData =
                typeof request.imageData === "string"
                    ? request.imageData
                    : request.imageData.toString("base64");

            const imageUrl = `data:${request.mimeType};base64,${imageData}`;

            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: openrouterConfig.systemInstruction,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: request.prompt || "Describe this image in detail.",
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageUrl, detail: "auto" },
                        },
                    ],
                },
            ];

            let index = 0;
            for await (const chunk of this.chatCompletionStream(messages, this.visionModel)) {
                yield { text: chunk, done: false, index: index++ };
            }

            yield { text: "", done: true, index: index };
            logger.info(`Completed image analysis stream for user ${request.userId}`);
        } catch (error) {
            logError(error as Error, "analyzeImageStream", { userId: request.userId });
            throw error;
        }
    }

    async generateWithFileContext(
        prompt: string,
        files: UploadedFile[],
        history: ConversationMessage[] = []
    ): Promise<string> {
        try {
            const fileContext = this.buildFileContext(files);
            const fullPrompt = this.buildPromptWithContext(prompt, fileContext);

            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: openrouterConfig.systemInstruction,
                },
                ...history.map((msg) => ({
                    role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
                    content: msg.content,
                })),
                { role: "user", content: fullPrompt },
            ];

            const result = await this.chatCompletion(messages, this.textModel);
            return result.choices[0]?.message?.content || "";
        } catch (error) {
            logger.error("OpenRouter file context error:", error);
            throw new Error("Failed to generate response with file context");
        }
    }

    async *generateStreamWithFileContext(
        prompt: string,
        files: UploadedFile[],
        history: ConversationMessage[] = []
    ): AsyncGenerator<string> {
        try {
            const fileContext = this.buildFileContext(files);
            const fullPrompt = this.buildPromptWithContext(prompt, fileContext);

            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: openrouterConfig.systemInstruction,
                },
                ...history.map((msg) => ({
                    role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
                    content: msg.content,
                })),
                { role: "user", content: fullPrompt },
            ];

            for await (const chunk of this.chatCompletionStream(messages, this.textModel)) {
                if (chunk) yield chunk;
            }
        } catch (error) {
            logger.error("OpenRouter stream with file context error:", error);
            throw error;
        }
    }

    async generateFileSummary(file: UploadedFile): Promise<string> {
        try {
            if (file.fileType === "image" && file.base64) {
                const imageUrl = `data:${file.mimeType};base64,${file.base64}`;
                const messages: ChatMessage[] = [
                    {
                        role: "system",
                        content: openrouterConfig.systemInstruction,
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Provide a brief summary of what you see in this image.",
                            },
                            {
                                type: "image_url",
                                image_url: { url: imageUrl, detail: "auto" },
                            },
                        ],
                    },
                ];

                const result = await this.chatCompletion(messages, this.visionModel);
                return result.choices[0]?.message?.content || "Summary generation failed";
            }

            const contentPreview = file.content.substring(0, 3000);
            const prompt = `Please provide a concise summary (2-3 sentences) of this ${file.fileType} file named "${file.fileName}":\n\n${contentPreview}`;

            const messages: ChatMessage[] = [
                { role: "system", content: openrouterConfig.systemInstruction },
                { role: "user", content: prompt },
            ];

            const result = await this.chatCompletion(messages, this.textModel);
            return result.choices[0]?.message?.content || "Summary generation failed";
        } catch (error) {
            logger.error("File summary generation error:", error);
            return "Summary generation failed";
        }
    }

    private formatHistory(
        history: TextGenerationRequest["conversationHistory"]
    ): ChatMessage[] {
        return history.map((msg) => {
            if (msg.hasImage && msg.imageData && msg.imageMimeType) {
                const imageUrl = `data:${msg.imageMimeType};base64,${msg.imageData}`;
                return {
                    role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
                    content: [
                        { type: "text" as const, text: msg.content },
                        {
                            type: "image_url" as const,
                            image_url: { url: imageUrl, detail: "auto" as const },
                        },
                    ],
                };
            }
            return {
                role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
                content: msg.content,
            };
        });
    }

    private buildRequestHeaders(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...this.extraHeaders,
        };
    }

    private async chatCompletion(
        messages: ChatMessage[],
        model: string,
        settings?: { temperature?: number; maxTokens?: number }
    ): Promise<ChatCompletionResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: this.buildRequestHeaders(),
            body: JSON.stringify({
                model,
                messages,
                temperature:
                    settings?.temperature ??
                    openrouterConfig.generationConfig.temperature,
                max_tokens:
                    settings?.maxTokens ??
                    openrouterConfig.generationConfig.maxTokens,
                top_p: openrouterConfig.generationConfig.topP,
                stream: false,
            }),
            signal: AbortSignal.timeout(openrouterConfig.request.timeout),
        });

        if (!response.ok) {
            throw new Error(await this.parseApiError(response));
        }

        const result = (await response.json()) as ChatCompletionResponse;

        // OpenRouter returns content: null on cold start or provider failure
        const content = result.choices?.[0]?.message?.content;
        if (content === null || content === undefined) {
            const finishReason = result.choices?.[0]?.finish_reason;
            throw new Error(
                `OpenRouter returned no content (finish_reason: ${finishReason ?? "unknown"}). ` +
                `This may be a model cold start or provider issue — please retry.`
            );
        }

        return result;
    }

    /** Parse OpenRouter error response: { error: { code, message } } */
    private async parseApiError(response: Response): Promise<string> {
        const text = await response.text();
        try {
            const body = JSON.parse(text) as { error?: { code?: number; message?: string } };
            const msg = body.error?.message ?? text;
            if (response.status === 402) {
                return `OpenRouter: insufficient credits — add credits at openrouter.ai to continue. (${msg})`;
            }
            if (response.status === 429) {
                return `OpenRouter: rate limit exceeded — free models allow limited requests per day. (${msg})`;
            }
            return `OpenRouter API error (${response.status}): ${msg}`;
        } catch {
            return `OpenRouter API error (${response.status}): ${text}`;
        }
    }

    private async *chatCompletionStream(
        messages: ChatMessage[],
        model: string,
        settings?: { temperature?: number; maxTokens?: number }
    ): AsyncGenerator<string> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: this.buildRequestHeaders(),
            body: JSON.stringify({
                model,
                messages,
                temperature:
                    settings?.temperature ??
                    openrouterConfig.generationConfig.temperature,
                max_tokens:
                    settings?.maxTokens ??
                    openrouterConfig.generationConfig.maxTokens,
                top_p: openrouterConfig.generationConfig.topP,
                stream: true,
            }),
            signal: AbortSignal.timeout(openrouterConfig.request.timeout),
        });

        if (!response.ok) {
            throw new Error(await this.parseApiError(response));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || trimmedLine === "data: [DONE]") continue;

                    if (trimmedLine.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(trimmedLine.slice(6));

                            // Detect mid-stream provider error
                            const finishReason = data.choices?.[0]?.finish_reason;
                            if (finishReason === "error") {
                                const errMsg = data.choices?.[0]?.message?.content
                                    ?? data.error?.message
                                    ?? "Unknown streaming error";
                                throw new Error(`OpenRouter stream error: ${errMsg}`);
                            }

                            const content = data.choices?.[0]?.delta?.content;
                            if (content) yield content;
                        } catch (parseErr) {
                            // Re-throw real errors, only warn on JSON parse failures
                            if (parseErr instanceof SyntaxError) {
                                logger.warn("Failed to parse SSE data:", trimmedLine);
                            } else {
                                throw parseErr;
                            }
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private buildFileContext(files: UploadedFile[]): string {
        if (files.length === 0) return "";

        let context = "=== UPLOADED FILES CONTEXT ===\n\n";

        files.forEach((file, index) => {
            context += `File ${index + 1}: "${file.fileName}" (${file.fileType})\n`;
            context += `Uploaded: ${file.uploadedAt.toLocaleString()}\n`;

            if (file.fileType === "image") {
                context += `Content: [Image - requires vision analysis]\n`;
                if (file.summary) context += `Summary: ${file.summary}\n`;
            } else {
                const maxLength = 10000;
                const content =
                    file.content.length > maxLength
                        ? file.content.substring(0, maxLength) + "\n\n[Content truncated due to length...]"
                        : file.content;
                context += `Content:\n${content}\n`;
            }

            context += "\n" + "-".repeat(50) + "\n\n";
        });

        return context;
    }

    private buildPromptWithContext(prompt: string, fileContext: string): string {
        if (!fileContext) return prompt;
        return `${fileContext}\n\n=== USER QUESTION ===\n${prompt}\n\nPlease answer based on the uploaded files above. If the question references specific files by name, focus on those. Otherwise, use all available context.`;
    }

    private async retryWithBackoff<T>(
        fn: () => Promise<T>,
        maxRetries: number = RETRY_CONFIG.MAX_RETRIES
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;

                if (attempt < maxRetries) {
                    const delay = Math.min(
                        RETRY_CONFIG.INITIAL_DELAY *
                            Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt),
                        RETRY_CONFIG.MAX_DELAY
                    );
                    logger.warn(
                        `API call failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
                        { error: lastError.message }
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    async healthCheck(): Promise<boolean> {
        try {
            const messages: ChatMessage[] = [{ role: "user", content: "Test" }];
            const result = await this.chatCompletion(messages, this.textModel);
            return !!result.choices[0]?.message?.content;
        } catch (error) {
            logger.error("OpenRouter health check failed:", error);
            return false;
        }
    }
}

export const openrouterService = new OpenRouterService();
