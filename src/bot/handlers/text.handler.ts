import { BotContext } from "../../types";
import { openrouterService as aiService } from "../../services/openrouter.service";
import { conversationService } from "../../services/conversation.service";
import { botConfig } from "../../config/bot.config";
import { logUserAction, logger } from "../../utils/logger";
import {
    MESSAGES,
    TELEGRAM_LIMITS,
    TYPING_CONFIG,
} from "../../utils/constants";
import { formatAiResponse, splitMessage } from "../../utils/formatter";
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
        const UPDATE_INTERVAL = 1000;
        // Store only the message_id to avoid Grammy type narrowing issues
        let sentMsgId: number | null = null;

        // Helper: edit or send with Markdown, silently ignoring Telegram edit errors
        const streamingUpdate = async (text: string): Promise<void> => {
            try {
                if (sentMsgId !== null) {
                    await ctx.api.editMessageText(ctx.chat!.id, sentMsgId, text, {
                        parse_mode: "HTML",
                    });
                } else {
                    const msg = await ctx.reply(text, { parse_mode: "HTML" });
                    sentMsgId = msg.message_id;
                }
            } catch {
                // Ignore streaming edit errors (content too similar, or mid-stream markdown)
            }
        };

        // Stream response (with or without file context)
        if (files.length > 0) {
            for await (const text of aiService.generateStreamWithFileContext(userMessage, files, history)) {
                fullResponse += text;
                const now = Date.now();
                if (now - lastUpdateTime >= UPDATE_INTERVAL && fullResponse.trim()) {
                    lastUpdateTime = now;
                    await streamingUpdate(
                        formatAiResponse(fullResponse).substring(0, TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH)
                    );
                }
            }
        } else {
            for await (const chunk of aiService.generateTextStream({
                prompt: userMessage,
                conversationHistory: history,
                userId: user.id,
                settings: ctx.session.settings,
            })) {
                if (!chunk.done) {
                    fullResponse += chunk.text;
                    const now = Date.now();
                    if (now - lastUpdateTime >= UPDATE_INTERVAL && fullResponse.trim()) {
                        lastUpdateTime = now;
                        await streamingUpdate(
                            formatAiResponse(fullResponse).substring(0, TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH)
                        );
                    }
                }
            }
        }

        // Stop typing indicator
        abortController.abort();
        if (typingPromise) {
            await typingPromise.catch(() => {});
        }

        // Send final formatted response
        const formattedResponse = formatAiResponse(fullResponse);
        const chunks = formattedResponse.length > TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH
            ? splitMessage(formattedResponse)
            : [formattedResponse];

        const existingMsgId = sentMsgId;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;

            if (i === 0 && existingMsgId !== null) {
                try {
                    await ctx.api.editMessageText(ctx.chat!.id, existingMsgId, chunk, {
                        parse_mode: "HTML",
                    });
                } catch {
                    // Markdown malformed — fall back to plain text
                    try {
                        await ctx.api.editMessageText(ctx.chat!.id, existingMsgId, chunk);
                    } catch { /* identical content */ }
                }
            } else {
                try {
                    await ctx.reply(chunk, { parse_mode: "HTML" });
                } catch {
                    await ctx.reply(chunk);
                }
            }
        }

        // Add model response to conversation history
        ctx.session = conversationService.addModelMessage(ctx.session, fullResponse);

        logUserAction(user.id, user.username, "response_sent", {
            responseLength: fullResponse.length,
            chunks: chunks.length > 1 ? "multiple" : "single",
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
