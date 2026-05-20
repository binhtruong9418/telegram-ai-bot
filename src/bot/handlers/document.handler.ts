import { BotContext } from "../../types";
import { fileService } from "../../services/file.service";
import { openrouterService as aiService } from "../../services/openrouter.service";
import { logger } from "../../utils/logger";


const MAX_FILES = parseInt(process.env["MAX_FILES_PER_USER"] || "10");

/**
 * Document upload handler
 * Processes PDF, DOCX, and other document files
 */
export const documentHandler = async (ctx: BotContext): Promise<void> => {
    const userId = ctx.from!.id;
    const document = ctx.message?.document;

    if (!document || !ctx.session) {
        return;
    }

    try {
        // Validate file size
        if (document.file_size) {
            const maxSize = fileService.getMaxFileSizeBytes();
            if (document.file_size > maxSize) {
                await ctx.reply(
                    `❌ *File too large!*\n\n` +
                        `Maximum: ${fileService.getMaxFileSizeMB()}MB\n` +
                        `Your file: ${fileService.formatFileSize(document.file_size)}`,
                    { parse_mode: "Markdown" }
                );
                return;
            }
        }

        // Check file limit
        if (ctx.session.uploadedFiles.length >= MAX_FILES) {
            await ctx.reply(
                `❌ *Maximum ${MAX_FILES} files reached!*\n\n` +
                    `Use /files to view your files\n` +
                    `Use /forget <filename> to remove files\n` +
                    `Use /clear to remove all files`,
                { parse_mode: "Markdown" }
            );
            return;
        }

        // Show processing message
        const processingMsg = await ctx.reply("⏳ Processing your file...");

        // Download file from Telegram
        const file = await ctx.api.getFile(document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error("Failed to download file");
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Process file
        const uploadedFile = await fileService.processFile(
            buffer,
            document.file_name || "unknown",
            document.mime_type || "application/octet-stream",
            document.file_id
        );

        // Generate AI summary
        logger.info(`Generating summary for ${uploadedFile.fileName}`);
        const summary = await aiService.generateFileSummary(uploadedFile);
        uploadedFile.summary = summary;

        // Store in session
        ctx.session.uploadedFiles.push(uploadedFile);

        // Delete processing message
        await ctx.api
            .deleteMessage(ctx.chat!.id, processingMsg.message_id)
            .catch(() => {});

        // Send success message
        const icon = fileService.getFileIcon(uploadedFile.fileType);
        const size = fileService.formatFileSize(uploadedFile.fileSize);
        const totalFiles = ctx.session.uploadedFiles.length;

        // Escape special characters for Markdown
        const escapedFileName = uploadedFile.fileName.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
        const escapedSummary = summary.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

        await ctx.reply(
            `✅ ${icon} *File uploaded successfully!*\n\n` +
                `📄 *Name:* \`${escapedFileName}\`\n` +
                `📊 *Type:* ${uploadedFile.fileType}\n` +
                `💾 *Size:* ${size}\n` +
                `📁 *Total files:* ${totalFiles}/${MAX_FILES}\n\n` +
                `📝 *Summary:*\n${escapedSummary}\n\n` +
                `💡 Ask me anything about this file!`,
            { parse_mode: "Markdown" }
        );

        logger.info(
            `File uploaded by user ${userId}: ${uploadedFile.fileName}`
        );
    } catch (error) {
        logger.error("Document upload error:", error);
        await ctx.reply(
            "❌ *Failed to process file*\n\n" +
                "Supported formats: PDF, DOCX, TXT, MD, code files, CSV, JSON",
            { parse_mode: "Markdown" }
        );
    }
};
