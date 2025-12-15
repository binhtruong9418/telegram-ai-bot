import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { logger } from './logger';

/**
 * File Parser Utility
 * Handles parsing of different file types into text content
 */
export class FileParser {
  /**
   * Parse PDF file to extract text
   */
  async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      logger.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  /**
   * Parse DOCX file to extract text
   */
  async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      logger.error('DOCX parsing error:', error);
      throw new Error('Failed to parse DOCX file');
    }
  }

  /**
   * Parse text file (TXT, MD, code files, etc.)
   */
  parseText(buffer: Buffer): string {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      logger.error('Text parsing error:', error);
      throw new Error('Failed to parse text file');
    }
  }

  /**
   * Parse JSON file with pretty formatting
   */
  async parseJSON(buffer: Buffer): Promise<string> {
    try {
      const text = buffer.toString('utf-8');
      const json = JSON.parse(text);
      return JSON.stringify(json, null, 2);
    } catch (error) {
      // If JSON parsing fails, return as plain text
      logger.warn('JSON parsing failed, returning as plain text');
      return buffer.toString('utf-8');
    }
  }

  /**
   * Convert image buffer to base64 string
   */
  imageToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /**
   * Detect file type from filename and MIME type
   */
  detectFileType(fileName: string, mimeType: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // Image files
    if (mimeType.startsWith('image/')) {
      return 'image';
    }

    // PDF files
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return 'pdf';
    }

    // DOCX files
    if (mimeType.includes('wordprocessingml') || ext === 'docx') {
      return 'docx';
    }

    // Data files
    if (mimeType.includes('json') || ext === 'json') {
      return 'data';
    }
    if (mimeType.includes('csv') || ext === 'csv') {
      return 'data';
    }
    if (ext === 'xml') {
      return 'data';
    }

    // Code files
    const codeExtensions = [
      'js', 'ts', 'jsx', 'tsx',
      'py', 'java', 'cpp', 'c', 'h', 'hpp',
      'cs', 'rb', 'go', 'rs', 'php',
      'swift', 'kt', 'scala', 'sh', 'bash'
    ];
    if (codeExtensions.includes(ext)) {
      return 'code';
    }

    // Text files
    const textExtensions = [
      'txt', 'md', 'log', 'html', 'css',
      'yaml', 'yml', 'toml', 'ini', 'conf'
    ];
    if (textExtensions.includes(ext)) {
      return 'text';
    }

    // Default to text
    return 'text';
  }

  /**
   * Get human-readable file type name
   */
  getFileTypeName(fileType: string): string {
    const names: Record<string, string> = {
      pdf: 'PDF Document',
      docx: 'Word Document',
      text: 'Text File',
      image: 'Image',
      code: 'Code File',
      data: 'Data File',
    };
    return names[fileType] || 'File';
  }

  /**
   * Validate if file type is supported
   */
  isSupported(mimeType: string, fileName: string): boolean {
    const fileType = this.detectFileType(fileName, mimeType);
    return ['pdf', 'docx', 'text', 'image', 'code', 'data'].includes(fileType);
  }
}

/**
 * Singleton instance of FileParser
 */
export const fileParser = new FileParser();
