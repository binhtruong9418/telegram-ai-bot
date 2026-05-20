import { BotContext } from "../../types";
import { PhotoSize } from "grammy/types";
import { openrouterService as aiService } from "../../services/openrouter.service";
import { conversationService } from "../../services/conversation.service";
import { botConfig } from "../../config/bot.config";
import { logUserAction, logger } from "../../utils/logger";
import {
    MESSAGES,
    SUPPORTED_IMAGE_TYPES,
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
 * Download image from Telegram servers
 */
const downloadImage = async (
    ctx: BotContext,
    fileId: string
): Promise<Buffer> => {
    try {
        const file = await ctx.api.getFile(fileId);
        const filePath = file.file_path;

        if (!filePath) {
            throw new Error("File path not available");
        }

        // Get bot token from context
        const token = ctx.api.token;

        // Download file
        const response = await fetch(
            `https://api.telegram.org/file/bot${token}/${filePath}`
        );

        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        logger.error("Error downloading image:", error);
        throw createBotError(
            `Failed to download image: ${(error as Error).message}`,
            "IMAGE_DOWNLOAD_ERROR",
            MESSAGES.ERROR_IMAGE_DOWNLOAD
        );
    }
};

/**
 * Image message handler
 * Processes images using Gemini Vision API
 */
export const imageHandler = async (ctx: BotContext): Promise<void> => {
    const user = ctx.from;
    const message = ctx.message;

    if (!user || !ctx.session || !message) {
        return;
    }

    // Get image from photo or document
    const photo = message.photo;
    const document = message.document;

    let fileId: string | undefined;
    let mimeType = "image/jpeg";

    if (photo && photo.length > 0) {
        // Get largest photo size
        const largestPhoto = photo.reduce(
            (prev: PhotoSize, current: PhotoSize) =>
                current.file_size &&
                prev.file_size &&
                current.file_size > prev.file_size
                    ? current
                    : prev
        );
        fileId = largestPhoto.file_id;
    } else if (document && document.mime_type?.startsWith("image/")) {
        fileId = document.file_id;
        mimeType = document.mime_type;
    }

    if (!fileId) {
        return;
    }

    // Check if MIME type is supported
    if (!SUPPORTED_IMAGE_TYPES.includes(mimeType as never)) {
        await ctx.reply(MESSAGES.ERROR_INVALID_IMAGE);
        return;
    }

    // Get caption (if any)
    const caption = message.caption?.trim() || undefined;

    logUserAction(user.id, user.username, "image_message", {
        hasCaption: !!caption,
        mimeType,
        historyLength: ctx.session.conversationHistory.length,
    });

    // Start typing indicator
    const abortController = new AbortController();
    let typingPromise: Promise<void> | undefined;

    if (botConfig.message.showTypingIndicator) {
        typingPromise = sendTypingIndicator(ctx, abortController.signal);
    }

    try {
        // Download image
        const imageBuffer = await downloadImage(ctx, fileId);
        const base64Image = imageBuffer.toString("base64");

        // Add user message to conversation history (with image)
        const userMessage = caption || "Analyzing image...";
        ctx.session = conversationService.addUserMessage(
            ctx.session,
            userMessage,
            true,
            base64Image,
            mimeType
        );

        // Analyze image using Gemini Vision
        const request = {
            imageData: base64Image,
            mimeType,
            prompt: caption,
            userId: user.id,
        };

        let fullResponse = "";
        let lastUpdateTime = 0;
        const UPDATE_INTERVAL = 1000;
        let sentMsgId: number | null = null;

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
                // Ignore streaming edit errors
            }
        };

        for await (const chunk of aiService.analyzeImageStream(request)) {
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

        // Stop typing indicator
        abortController.abort();
        if (typingPromise) {
            await typingPromise.catch(() => {});
        }

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
                    try { await ctx.api.editMessageText(ctx.chat!.id, existingMsgId, chunk); }
                    catch { /* identical content */ }
                }
            } else {
                try {
                    await ctx.reply(chunk, { parse_mode: "HTML" });
                } catch {
                    await ctx.reply(chunk);
                }
            }
        }

        ctx.session = conversationService.addModelMessage(ctx.session, fullResponse);

        logUserAction(user.id, user.username, "image_response_sent", {
            responseLength: fullResponse.length,
        });
    } catch (error) {
        // Stop typing indicator
        abortController.abort();
        if (typingPromise) {
            await typingPromise.catch(() => {});
        }

        logger.error(`Error processing image for user ${user.id}:`, error);

        throw createBotError(
            `Failed to process image: ${(error as Error).message}`,
            "IMAGE_PROCESSING_ERROR",
            MESSAGES.ERROR_IMAGE_PROCESSING
        );
    }
};
