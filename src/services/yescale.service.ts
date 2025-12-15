import { yescaleConfig } from "../config/yescale.config";
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

/**
 * OpenAI API Compatible Message Interface
 */
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

/**
 * OpenAI API Compatible Response Interface
 */
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
 * YesScale AI Service
 * Handles all interactions with YesScale AI (OpenAI-compatible API)
 */
export class YescaleService {
    private baseUrl: string;
    private apiKey: string;
    private textModel: string;
    private visionModel: string;

    constructor() {
        this.baseUrl = yescaleConfig.baseUrl;
        this.apiKey = yescaleConfig.apiKey;
        this.textModel = yescaleConfig.models.text;
        this.visionModel = yescaleConfig.models.vision;

        logger.info("YesScale service initialized", {
            baseUrl: this.baseUrl,
            textModel: this.textModel,
            visionModel: this.visionModel,
        });
    }

    /**
     * Generate text response with conversation context
     */
    async generateText(
        request: TextGenerationRequest
    ): Promise<ApiResponse<string>> {
        const startTime = Date.now();

        try {
            logger.info(`Generating text for user ${request.userId}`, {
                promptLength: request.prompt.length,
                historyLength: request.conversationHistory.length,
            });

            // Build messages array
            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: yescaleConfig.systemInstruction,
                },
                ...this.formatHistoryForYescale(request.conversationHistory),
                {
                    role: "user",
                    content: request.prompt,
                },
            ];

            // Make API call
            const result = await this.retryWithBackoff(async () => {
                return await this.chatCompletion(
                    messages,
                    this.textModel,
                    request.settings
                );
            });

            const text = result.choices[0]?.message?.content || "";

            const duration = Date.now() - startTime;
            logApiCall("YesScale", "generateText", duration, true);

            logger.info(
                `Generated ${text.length} characters for user ${request.userId}`
            );

            return {
                success: true,
                data: text,
                duration,
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            logApiCall("YesScale", "generateText", duration, false);
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

    /**
     * Generate text response with streaming
     */
    async *generateTextStream(
        request: TextGenerationRequest
    ): AsyncGenerator<GeminiStreamChunk, void, unknown> {
        try {
            logger.info(`Streaming text for user ${request.userId}`, {
                promptLength: request.prompt.length,
                historyLength: request.conversationHistory.length,
            });

            // Build messages array
            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: yescaleConfig.systemInstruction,
                },
                ...this.formatHistoryForYescale(request.conversationHistory),
                {
                    role: "user",
                    content: request.prompt,
                },
            ];

            // Stream API call
            let index = 0;
            for await (const chunk of this.chatCompletionStream(
                messages,
                this.textModel,
                request.settings
            )) {
                yield {
                    text: chunk,
                    done: false,
                    index: index++,
                };
            }

            // Final chunk
            yield {
                text: "",
                done: true,
                index: index,
            };

            logger.info(`Completed streaming for user ${request.userId}`);
        } catch (error) {
            logError(error as Error, "generateTextStream", {
                userId: request.userId,
            });
            throw error;
        }
    }

    /**
     * Analyze image with optional text prompt
     */
    async analyzeImage(
        request: ImageAnalysisRequest
    ): Promise<ApiResponse<string>> {
        const startTime = Date.now();

        try {
            logger.info(`Analyzing image for user ${request.userId}`, {
                mimeType: request.mimeType,
                hasPrompt: !!request.prompt,
            });

            // Prepare image data URL
            const imageData =
                typeof request.imageData === "string"
                    ? request.imageData
                    : request.imageData.toString("base64");

            const imageUrl = `data:${request.mimeType};base64,${imageData}`;

            // Create message with image
            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: yescaleConfig.systemInstruction,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text:
                                request.prompt ||
                                "Describe this image in detail.",
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                                detail: "auto",
                            },
                        },
                    ],
                },
            ];

            // Make API call with vision model
            const result = await this.retryWithBackoff(async () => {
                return await this.chatCompletion(messages, this.visionModel);
            });

            const text = result.choices[0]?.message?.content || "";

            const duration = Date.now() - startTime;
            logApiCall("YesScale", "analyzeImage", duration, true);

            logger.info(
                `Analyzed image for user ${request.userId}: ${text.length} characters`
            );

            return {
                success: true,
                data: text,
                duration,
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            logApiCall("YesScale", "analyzeImage", duration, false);
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

    /**
     * Analyze image with streaming response
     */
    async *analyzeImageStream(
        request: ImageAnalysisRequest
    ): AsyncGenerator<GeminiStreamChunk, void, unknown> {
        try {
            logger.info(`Streaming image analysis for user ${request.userId}`, {
                mimeType: request.mimeType,
                hasPrompt: !!request.prompt,
            });

            // Prepare image data URL
            const imageData =
                typeof request.imageData === "string"
                    ? request.imageData
                    : request.imageData.toString("base64");

            const imageUrl = `data:${request.mimeType};base64,${imageData}`;

            // Create message with image
            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: yescaleConfig.systemInstruction,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text:
                                request.prompt ||
                                "Describe this image in detail.",
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                                detail: "auto",
                            },
                        },
                    ],
                },
            ];

            // Stream API call
            let index = 0;
            for await (const chunk of this.chatCompletionStream(
                messages,
                this.visionModel
            )) {
                yield {
                    text: chunk,
                    done: false,
                    index: index++,
                };
            }

            // Final chunk
            yield {
                text: "",
                done: true,
                index: index,
            };

            logger.info(
                `Completed image analysis stream for user ${request.userId}`
            );
        } catch (error) {
            logError(error as Error, "analyzeImageStream", {
                userId: request.userId,
            });
            throw error;
        }
    }

    /**
     * Generate response with file context
     */
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
                    content: yescaleConfig.systemInstruction,
                },
                ...history.map((msg) => ({
                    role:
                        msg.role === "model"
                            ? ("assistant" as const)
                            : ("user" as const),
                    content: msg.content,
                })),
                {
                    role: "user",
                    content: fullPrompt,
                },
            ];

            const result = await this.chatCompletion(messages, this.textModel);
            return result.choices[0]?.message?.content || "";
        } catch (error) {
            logger.error("YesScale file context error:", error);
            throw new Error("Failed to generate response with file context");
        }
    }

    /**
     * Generate response with file context (streaming)
     */
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
                    content: yescaleConfig.systemInstruction,
                },
                ...history.map((msg) => ({
                    role:
                        msg.role === "model"
                            ? ("assistant" as const)
                            : ("user" as const),
                    content: msg.content,
                })),
                {
                    role: "user",
                    content: fullPrompt,
                },
            ];

            for await (const chunk of this.chatCompletionStream(
                messages,
                this.textModel
            )) {
                if (chunk) yield chunk;
            }
        } catch (error) {
            logger.error("YesScale stream with file context error:", error);
            throw error;
        }
    }

    /**
     * Generate file summary
     */
    async generateFileSummary(file: UploadedFile): Promise<string> {
        try {
            if (file.fileType === "image" && file.base64) {
                const imageUrl = `data:${file.mimeType};base64,${file.base64}`;
                const messages: ChatMessage[] = [
                    {
                        role: "system",
                        content: yescaleConfig.systemInstruction,
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
                                image_url: {
                                    url: imageUrl,
                                    detail: "auto",
                                },
                            },
                        ],
                    },
                ];

                const result = await this.chatCompletion(
                    messages,
                    this.visionModel
                );
                return (
                    result.choices[0]?.message?.content ||
                    "Summary generation failed"
                );
            }

            const contentPreview = file.content.substring(0, 3000);
            const prompt = `Please provide a concise summary (2-3 sentences) of this ${file.fileType} file named "${file.fileName}":\n\n${contentPreview}`;

            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content: yescaleConfig.systemInstruction,
                },
                {
                    role: "user",
                    content: prompt,
                },
            ];

            const result = await this.chatCompletion(messages, this.textModel);
            return (
                result.choices[0]?.message?.content ||
                "Summary generation failed"
            );
        } catch (error) {
            logger.error("File summary generation error:", error);
            return "Summary generation failed";
        }
    }

    /**
     * Format conversation history for YesScale API (OpenAI format)
     */
    private formatHistoryForYescale(
        history: TextGenerationRequest["conversationHistory"]
    ): ChatMessage[] {
        return history.map((msg) => {
            if (msg.hasImage && msg.imageData && msg.imageMimeType) {
                // Message with image
                const imageUrl = `data:${msg.imageMimeType};base64,${msg.imageData}`;
                return {
                    role:
                        msg.role === "model"
                            ? ("assistant" as const)
                            : ("user" as const),
                    content: [
                        {
                            type: "text" as const,
                            text: msg.content,
                        },
                        {
                            type: "image_url" as const,
                            image_url: {
                                url: imageUrl,
                                detail: "auto" as const,
                            },
                        },
                    ],
                };
            } else {
                // Text-only message
                return {
                    role:
                        msg.role === "model"
                            ? ("assistant" as const)
                            : ("user" as const),
                    content: msg.content,
                };
            }
        });
    }

    /**
     * Make a chat completion API call
     */
    private async chatCompletion(
        messages: ChatMessage[],
        model: string,
        settings?: { temperature?: number; maxTokens?: number }
    ): Promise<ChatCompletionResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature:
                    settings?.temperature ??
                    yescaleConfig.generationConfig.temperature,
                max_tokens:
                    settings?.maxTokens ??
                    yescaleConfig.generationConfig.maxTokens,
                top_p: yescaleConfig.generationConfig.topP,
                stream: false,
            }),
            signal: AbortSignal.timeout(yescaleConfig.request.timeout),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `YesScale API error (${response.status}): ${errorText}`
            );
        }

        return (await response.json()) as ChatCompletionResponse;
    }

    /**
     * Make a streaming chat completion API call
     */
    private async *chatCompletionStream(
        messages: ChatMessage[],
        model: string,
        settings?: { temperature?: number; maxTokens?: number }
    ): AsyncGenerator<string> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature:
                    settings?.temperature ??
                    yescaleConfig.generationConfig.temperature,
                max_tokens:
                    settings?.maxTokens ??
                    yescaleConfig.generationConfig.maxTokens,
                top_p: yescaleConfig.generationConfig.topP,
                stream: true,
            }),
            signal: AbortSignal.timeout(yescaleConfig.request.timeout),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `YesScale API error (${response.status}): ${errorText}`
            );
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("No response body");
        }

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
                    if (!trimmedLine || trimmedLine === "data: [DONE]")
                        continue;

                    if (trimmedLine.startsWith("data: ")) {
                        try {
                            const jsonStr = trimmedLine.slice(6);
                            const data = JSON.parse(jsonStr);
                            const content = data.choices?.[0]?.delta?.content;
                            if (content) {
                                yield content;
                            }
                        } catch (e) {
                            logger.warn(
                                "Failed to parse SSE data:",
                                trimmedLine
                            );
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Build file context string for prompt
     */
    private buildFileContext(files: UploadedFile[]): string {
        if (files.length === 0) return "";

        let context = "=== UPLOADED FILES CONTEXT ===\n\n";

        files.forEach((file, index) => {
            context += `File ${index + 1}: "${file.fileName}" (${file.fileType})\n`;
            context += `Uploaded: ${file.uploadedAt.toLocaleString()}\n`;

            if (file.fileType === "image") {
                context += `Content: [Image - requires vision analysis]\n`;
                if (file.summary) {
                    context += `Summary: ${file.summary}\n`;
                }
            } else {
                const maxLength = 10000;
                const content =
                    file.content.length > maxLength
                        ? file.content.substring(0, maxLength) +
                          "\n\n[Content truncated due to length...]"
                        : file.content;
                context += `Content:\n${content}\n`;
            }

            context += "\n" + "-".repeat(50) + "\n\n";
        });

        return context;
    }

    /**
     * Build prompt with file context
     */
    private buildPromptWithContext(
        prompt: string,
        fileContext: string
    ): string {
        if (!fileContext) return prompt;

        return `${fileContext}\n\n=== USER QUESTION ===\n${prompt}\n\nPlease answer based on the uploaded files above. If the question references specific files by name, focus on those. Otherwise, use all available context.`;
    }

    /**
     * Retry a function with exponential backoff
     */
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
                        {
                            error: lastError.message,
                        }
                    );

                    await this.sleep(delay);
                }
            }
        }

        throw lastError;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Check if YesScale API is available
     */
    async healthCheck(): Promise<boolean> {
        try {
            const messages: ChatMessage[] = [
                {
                    role: "user",
                    content: "Test",
                },
            ];
            const result = await this.chatCompletion(messages, this.textModel);
            return !!result.choices[0]?.message?.content;
        } catch (error) {
            logger.error("YesScale health check failed:", error);
            return false;
        }
    }
}

/**
 * Singleton instance of YesScale service
 */
export const yescaleService = new YescaleService();
