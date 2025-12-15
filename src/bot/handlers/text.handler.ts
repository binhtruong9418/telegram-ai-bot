import { BotContext } from "../../types";
import { yescaleService as aiService } from "../../services/yescale.service";
import { conversationService } from "../../services/conversation.service";
import { botConfig } from "../../config/bot.config";
import { logUserAction, logger } from "../../utils/logger";
import {
    MESSAGES,
    TELEGRAM_LIMITS,
    TYPING_CONFIG,
} from "../../utils/constants";
import { formatGeminiResponse, splitMessage } from "../../utils/formatter";
import { createBotError } from "../middlewares";

/**
 * Send typing indicator periodically
 */
const sendTypingIndicator = async (
    ctx: BotContext,
    signal: AbortSignal
): Promise<void> => {
    try {
        while (!signal.aborted) {
            await ctx.api.sendChatAction(ctx.chat!.id, "typing");
            await new Promise((resolve) =>
                setTimeout(resolve, TYPING_CONFIG.INTERVAL)
            );
        }
    } catch (error) {
        // Ignore errors from typing indicator
    }
};

/**
 * Text message handler
 * Processes text messages and generates responses using Gemini
 */
export const textHandler = async (ctx: BotContext): Promise<void> => {
    const user = ctx.from;
    const message = ctx.message;

    if (!user || !ctx.session || !message?.text) {
        return;
    }

    const userMessage = message.text.trim();

    if (!userMessage) {
        await ctx.reply(MESSAGES.ERROR_NO_MESSAGE);
        return;
    }

    logUserAction(user.id, user.username, "text_message", {
        messageLength: userMessage.length,
        historyLength: ctx.session.conversationHistory.length,
    });

    // Start typing indicator
    const abortController = new AbortController();
    let typingPromise: Promise<void> | undefined;

    if (botConfig.message.showTypingIndicator) {
        typingPromise = sendTypingIndicator(ctx, abortController.signal);
    }

    try {
        // Add user message to conversation history
        ctx.session = conversationService.addUserMessage(
            ctx.session,
            userMessage
        );

        // Get uploaded files for context
        const files = ctx.session.uploadedFiles || [];
        const history = ctx.session.conversationHistory.slice(0, -1); // Exclude the message we just added

        let fullResponse = "";
        let lastUpdateTime = 0;
        const UPDATE_INTERVAL = 1000; // Update message every 1 second
        let sentMessage: { message_id: number } | null = null;

        // Stream response from Gemini (with or without file context)
        if (files.length > 0) {
            // Use file context streaming
            const stream = aiService.generateStreamWithFileContext(
                userMessage,
                files,
                history
            );

            for await (const text of stream) {
                fullResponse += text;

                // Update message periodically during streaming
                const now = Date.now();
                if (
                    now - lastUpdateTime >= UPDATE_INTERVAL &&
                    fullResponse.trim()
                ) {
                    lastUpdateTime = now;

                    const formattedResponse =
                        formatGeminiResponse(fullResponse);
                    const truncated = formattedResponse.substring(
                        0,
                        TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH
                    );

                    try {
                        if (sentMessage) {
                            // Edit existing message
                            await ctx.api.editMessageText(
                                ctx.chat!.id,
                                sentMessage.message_id,
                                truncated
                            );
                        } else {
                            // Send initial message
                            sentMessage = await ctx.reply(truncated);
                        }
                    } catch (error) {
                        // Ignore edit errors (message might be too similar)
                    }
                }
            }
        } else {
            // No files - use regular text streaming
            for await (const chunk of aiService.generateTextStream({
                prompt: userMessage,
                conversationHistory: history,
                userId: user.id,
                settings: ctx.session.settings,
            })) {
                if (!chunk.done) {
                    fullResponse += chunk.text;

                    const now = Date.now();
                    if (
                        now - lastUpdateTime >= UPDATE_INTERVAL &&
                        fullResponse.trim()
                    ) {
                        lastUpdateTime = now;

                        const formattedResponse =
                            formatGeminiResponse(fullResponse);
                        const truncated = formattedResponse.substring(
                            0,
                            TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH
                        );

                        try {
                            if (sentMessage) {
                                await ctx.api.editMessageText(
                                    ctx.chat!.id,
                                    sentMessage.message_id,
                                    truncated
                                );
                            } else {
                                sentMessage = await ctx.reply(truncated);
                            }
                        } catch (error) {
                            // Ignore edit errors
                        }
                    }
                }
            }
        }

        // Stop typing indicator
        abortController.abort();
        if (typingPromise) {
            await typingPromise.catch(() => {}); // Ignore errors
        }

        // Format final response
        const formattedResponse = formatGeminiResponse(fullResponse);

        // Check if response is too long and needs splitting
        if (formattedResponse.length > TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH) {
            const chunks = splitMessage(formattedResponse);

            // Send all chunks
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0 && sentMessage) {
                    // Update the first message
                    try {
                        await ctx.api.editMessageText(
                            ctx.chat!.id,
                            sentMessage.message_id,
                            chunks[i]
                        );
                    } catch (error) {
                        // Ignore edit errors (message might be identical)
                    }
                } else {
                    // Send new messages for additional chunks
                    await ctx.reply(chunks[i]);
                }
            }
        } else {
            // Send or update single message
            if (sentMessage) {
                try {
                    await ctx.api.editMessageText(
                        ctx.chat!.id,
                        sentMessage.message_id,
                        formattedResponse
                    );
                } catch (error) {
                    // Ignore edit errors (message might be identical)
                }
            } else {
                await ctx.reply(formattedResponse);
            }
        }

        // Add model response to conversation history
        ctx.session = conversationService.addModelMessage(
            ctx.session,
            fullResponse
        );

        logUserAction(user.id, user.username, "response_sent", {
            responseLength: fullResponse.length,
            chunks:
                formattedResponse.length > TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH
                    ? "multiple"
                    : "single",
        });
    } catch (error) {
        // Stop typing indicator
        abortController.abort();
        if (typingPromise) {
            await typingPromise.catch(() => {}); // Ignore errors
        }

        logger.error(
            `Error processing text message for user ${user.id}:`,
            error
        );

        throw createBotError(
            `Failed to process text message: ${(error as Error).message}`,
            "TEXT_PROCESSING_ERROR",
            MESSAGES.ERROR_GEMINI_API
        );
    }
};
