import { BotContext } from "../../types";
import { fileService } from "../../services/file.service";
import { openrouterService as aiService } from "../../services/openrouter.service";
import { logger } from "../../utils/logger";

const MAX_FILES = parseInt(process.env["MAX_FILES_PER_USER"] || "10");

/**
 * Photo upload handler
 * Processes image uploads
 */
export const photoHandler = async (ctx: BotContext): Promise<void> => {
    const userId = ctx.from!.id;
    const photo = ctx.message?.photo?.pop(); // Get largest size

    if (!photo || !ctx.session) {
        return;
    }

    try {
        // Check file limit
        if (ctx.session.uploadedFiles.length >= MAX_FILES) {
            await ctx.reply(
                `❌ Maximum ${MAX_FILES} files reached! Use /clear to remove files.`
            );
            return;
        }

        const processingMsg = await ctx.reply("⏳ Analyzing your image...");

        // Download image
        const file = await ctx.api.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error("Failed to download image");
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Generate filename
        const fileName = `image_${Date.now()}.jpg`;

        // Process image
        const uploadedFile = await fileService.processFile(
            buffer,
            fileName,
            "image/jpeg",
            photo.file_id
        );

        // Analyze image with AI
        logger.info(`Analyzing image for user ${userId}`);
        const analysis = await aiService.generateFileSummary(uploadedFile);
        uploadedFile.summary = analysis;

        // Store in session
        ctx.session.uploadedFiles.push(uploadedFile);

        // Delete processing message
        await ctx.api
            .deleteMessage(ctx.chat!.id, processingMsg.message_id)
            .catch(() => {});

        // Send result
        const size = fileService.formatFileSize(uploadedFile.fileSize);
        const totalFiles = ctx.session.uploadedFiles.length;

        await ctx.reply(
            `✅ 🖼️ *Image uploaded!*\n\n` +
                `💾 *Size:* ${size}\n` +
                `📁 *Total files:* ${totalFiles}/${MAX_FILES}\n\n` +
                `📝 *Analysis:*\n${analysis}\n\n` +
                `💡 Ask me more about this image or upload additional files!`,
            { parse_mode: "Markdown" }
        );

        logger.info(`Image uploaded by user ${userId}`);
    } catch (error) {
        logger.error("Photo upload error:", error);
        await ctx.reply("❌ Failed to process image. Please try again.");
    }
};
