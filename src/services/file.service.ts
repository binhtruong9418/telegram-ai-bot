import { UploadedFile, FileStats } from '../types';
import { fileParser } from '../utils/file-parser';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

/**
 * File Service
 * Handles file processing, storage, and management
 */
export class FileService {
  private storagePath: string;
  private maxFileSizeMB: number;

  constructor() {
    this.storagePath = process.env['FILE_STORAGE_PATH'] || './uploads';
    this.maxFileSizeMB = parseInt(process.env['MAX_FILE_SIZE_MB'] || '20');
    this.ensureStorageDir();
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      logger.info(`File storage directory ready: ${this.storagePath}`);
    } catch (error) {
      logger.error('Failed to create storage directory:', error);
    }
  }

  /**
   * Process uploaded file and extract content
   */
  async processFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileId: string
  ): Promise<UploadedFile> {
    const fileType = fileParser.detectFileType(fileName, mimeType);
    let content = '';
    let base64: string | undefined;

    try {
      // Process based on file type
      switch (fileType) {
        case 'pdf':
          logger.info(`Processing PDF: ${fileName}`);
          content = await fileParser.parsePDF(fileBuffer);
          break;

        case 'docx':
          logger.info(`Processing DOCX: ${fileName}`);
          content = await fileParser.parseDOCX(fileBuffer);
          break;

        case 'image':
          logger.info(`Processing image: ${fileName}`);
          base64 = fileParser.imageToBase64(fileBuffer);
          content = '[Image content - requires vision analysis]';
          break;

        case 'data':
          logger.info(`Processing data file: ${fileName}`);
          content = await fileParser.parseJSON(fileBuffer);
          break;

        case 'code':
        case 'text':
          logger.info(`Processing text/code file: ${fileName}`);
          content = fileParser.parseText(fileBuffer);
          break;

        default:
          content = fileParser.parseText(fileBuffer);
      }

      // Save file to disk for persistence
      const filePath = path.join(this.storagePath, `${fileId}_${fileName}`);
      await fs.writeFile(filePath, fileBuffer);

      // Create uploaded file object
      const uploadedFile: UploadedFile = {
        fileId,
        fileName,
        fileType: fileType as any,
        mimeType,
        fileSize: fileBuffer.length,
        uploadedAt: new Date(),
        content,
        base64,
      };

      logger.info(
        `File processed successfully: ${fileName} (${fileType}, ${this.formatFileSize(fileBuffer.length)})`
      );

      return uploadedFile;
    } catch (error) {
      logger.error(`File processing error for ${fileName}:`, error);
      throw new Error(`Failed to process file: ${fileName}`);
    }
  }

  /**
   * Delete file from disk storage
   */
  async deleteFile(fileId: string, fileName: string): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, `${fileId}_${fileName}`);
      await fs.unlink(filePath);
      logger.info(`File deleted from storage: ${fileName}`);
    } catch (error) {
      logger.warn(`Failed to delete file ${fileName}:`, error);
      // Don't throw - file might already be deleted
    }
  }

  /**
   * Delete multiple files from disk storage
   */
  async deleteMultipleFiles(files: UploadedFile[]): Promise<void> {
    const deletePromises = files.map(file =>
      this.deleteFile(file.fileId, file.fileName)
    );
    await Promise.all(deletePromises);
    logger.info(`Deleted ${files.length} files from storage`);
  }

  /**
   * Get statistics about uploaded files
   */
  getFileStats(files: UploadedFile[]): FileStats {
    const stats: FileStats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.fileSize, 0),
      fileTypes: {},
    };

    files.forEach(file => {
      stats.fileTypes[file.fileType] = (stats.fileTypes[file.fileType] || 0) + 1;
    });

    return stats;
  }

  /**
   * Format file size for human-readable display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get emoji icon for file type
   */
  getFileIcon(fileType: string): string {
    const icons: Record<string, string> = {
      pdf: '📄',
      docx: '📝',
      text: '📃',
      image: '🖼️',
      code: '💻',
      data: '📊',
    };
    return icons[fileType] || '📎';
  }

  /**
   * Validate file size
   */
  isValidFileSize(sizeInBytes: number): boolean {
    const maxSizeBytes = this.maxFileSizeMB * 1024 * 1024;
    return sizeInBytes <= maxSizeBytes;
  }

  /**
   * Get max file size in bytes
   */
  getMaxFileSizeBytes(): number {
    return this.maxFileSizeMB * 1024 * 1024;
  }

  /**
   * Get max file size in MB
   */
  getMaxFileSizeMB(): number {
    return this.maxFileSizeMB;
  }

  /**
   * Clean up old files (optional maintenance task)
   */
  async cleanupOldFiles(olderThanDays: number = 30): Promise<number> {
    try {
      const files = await fs.readdir(this.storagePath);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.storagePath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old files`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Error during file cleanup:', error);
      return 0;
    }
  }
}

/**
 * Singleton instance of FileService
 */
export const fileService = new FileService();
