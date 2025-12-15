import {
  GoogleGenerativeAI,
  GenerativeModel,
} from '@google/generative-ai';
import { geminiConfig } from '../config/gemini.config';
import { TextGenerationRequest, ImageAnalysisRequest, ApiResponse, GeminiStreamChunk, UploadedFile, ConversationMessage } from '../types';
import { logger, logApiCall, logError } from '../utils/logger';
import { RETRY_CONFIG, ERROR_CODES } from '../utils/constants';

/**
 * Gemini API Service
 * Handles all interactions with Google Gemini AI
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private textModel: GenerativeModel;
  private visionModel: GenerativeModel;

  constructor() {
    // Initialize Gemini AI
    this.genAI = new GoogleGenerativeAI(geminiConfig.apiKey);

    // Initialize text model
    this.textModel = this.genAI.getGenerativeModel({
      model: geminiConfig.models.text,
      generationConfig: geminiConfig.generationConfig,
      safetySettings: geminiConfig.safetySettings,
    });

    // Initialize vision model
    this.visionModel = this.genAI.getGenerativeModel({
      model: geminiConfig.models.vision,
      generationConfig: geminiConfig.generationConfig,
      safetySettings: geminiConfig.safetySettings,
    });

    logger.info('Gemini service initialized', {
      textModel: geminiConfig.models.text,
      visionModel: geminiConfig.models.vision,
    });
  }

  /**
   * Generate text response with conversation context
   */
  async generateText(request: TextGenerationRequest): Promise<ApiResponse<string>> {
    const startTime = Date.now();

    try {
      logger.info(`Generating text for user ${request.userId}`, {
        promptLength: request.prompt.length,
        historyLength: request.conversationHistory.length,
      });

      // Start a chat session with history
      const chat = this.textModel.startChat({
        history: this.formatHistoryForGemini(request.conversationHistory),
        generationConfig: request.settings
          ? {
              ...geminiConfig.generationConfig,
              temperature: request.settings.temperature ?? geminiConfig.generationConfig.temperature,
              maxOutputTokens: request.settings.maxTokens ?? geminiConfig.generationConfig.maxOutputTokens,
            }
          : geminiConfig.generationConfig,
      });

      // Send message
      const result = await this.retryWithBackoff(async () => {
        return await chat.sendMessage(request.prompt);
      });

      const response = result.response;
      const text = response.text();

      const duration = Date.now() - startTime;
      logApiCall('Gemini', 'generateText', duration, true);

      logger.info(`Generated ${text.length} characters for user ${request.userId}`);

      return {
        success: true,
        data: text,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logApiCall('Gemini', 'generateText', duration, false);
      logError(error as Error, 'generateText', {
        userId: request.userId,
        promptLength: request.prompt.length,
      });

      return {
        success: false,
        error: (error as Error).message,
        errorCode: ERROR_CODES.GEMINI_API_ERROR,
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

      // Start a chat session with history
      const chat = this.textModel.startChat({
        history: this.formatHistoryForGemini(request.conversationHistory),
        generationConfig: request.settings
          ? {
              ...geminiConfig.generationConfig,
              temperature: request.settings.temperature ?? geminiConfig.generationConfig.temperature,
              maxOutputTokens: request.settings.maxTokens ?? geminiConfig.generationConfig.maxOutputTokens,
            }
          : geminiConfig.generationConfig,
      });

      // Send message with streaming
      const result = await chat.sendMessageStream(request.prompt);

      let index = 0;
      for await (const chunk of result.stream) {
        const text = chunk.text();
        yield {
          text,
          done: false,
          index: index++,
        };
      }

      // Final chunk
      yield {
        text: '',
        done: true,
        index: index,
      };

      logger.info(`Completed streaming for user ${request.userId}`);
    } catch (error) {
      logError(error as Error, 'generateTextStream', {
        userId: request.userId,
      });
      throw error;
    }
  }

  /**
   * Analyze image with optional text prompt
   */
  async analyzeImage(request: ImageAnalysisRequest): Promise<ApiResponse<string>> {
    const startTime = Date.now();

    try {
      logger.info(`Analyzing image for user ${request.userId}`, {
        mimeType: request.mimeType,
        hasPrompt: !!request.prompt,
      });

      // Prepare image data
      const imageData =
        typeof request.imageData === 'string'
          ? request.imageData
          : request.imageData.toString('base64');

      // Create parts for the request
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Add text prompt if provided
      if (request.prompt) {
        parts.push({ text: request.prompt });
      } else {
        parts.push({ text: 'Describe this image in detail.' });
      }

      // Add image data
      parts.push({
        inlineData: {
          mimeType: request.mimeType,
          data: imageData,
        },
      });

      // Generate content
      const result = await this.retryWithBackoff(async () => {
        return await this.visionModel.generateContent(parts);
      });

      const response = result.response;
      const text = response.text();

      const duration = Date.now() - startTime;
      logApiCall('Gemini', 'analyzeImage', duration, true);

      logger.info(`Analyzed image for user ${request.userId}: ${text.length} characters`);

      return {
        success: true,
        data: text,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logApiCall('Gemini', 'analyzeImage', duration, false);
      logError(error as Error, 'analyzeImage', {
        userId: request.userId,
        mimeType: request.mimeType,
      });

      return {
        success: false,
        error: (error as Error).message,
        errorCode: ERROR_CODES.GEMINI_API_ERROR,
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

      // Prepare image data
      const imageData =
        typeof request.imageData === 'string'
          ? request.imageData
          : request.imageData.toString('base64');

      // Create parts for the request
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Add text prompt
      if (request.prompt) {
        parts.push({ text: request.prompt });
      } else {
        parts.push({ text: 'Describe this image in detail.' });
      }

      // Add image data
      parts.push({
        inlineData: {
          mimeType: request.mimeType,
          data: imageData,
        },
      });

      // Generate content stream
      const result = await this.visionModel.generateContentStream(parts);

      let index = 0;
      for await (const chunk of result.stream) {
        const text = chunk.text();
        yield {
          text,
          done: false,
          index: index++,
        };
      }

      // Final chunk
      yield {
        text: '',
        done: true,
        index: index,
      };

      logger.info(`Completed image analysis stream for user ${request.userId}`);
    } catch (error) {
      logError(error as Error, 'analyzeImageStream', {
        userId: request.userId,
      });
      throw error;
    }
  }

  /**
   * Format conversation history for Gemini API
   */
  private formatHistoryForGemini(
    history: TextGenerationRequest['conversationHistory']
  ): Array<{
    role: string;
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  }> {
    return history.map((msg) => {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Add text
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      // Add image if present
      if (msg.hasImage && msg.imageData && msg.imageMimeType) {
        parts.push({
          inlineData: {
            mimeType: msg.imageMimeType,
            data: msg.imageData,
          },
        });
      }

      return {
        role: msg.role === 'model' ? 'model' : 'user',
        parts,
      };
    });
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
            RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt),
            RETRY_CONFIG.MAX_DELAY
          );

          logger.warn(`API call failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
            error: lastError.message,
          });

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

      if (history.length > 0) {
        const chat = this.textModel.startChat({
          history: history.map(msg => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
        });

        const result = await chat.sendMessage(fullPrompt);
        return result.response.text();
      }

      const result = await this.textModel.generateContent(fullPrompt);
      return result.response.text();
    } catch (error) {
      logger.error('Gemini file context error:', error);
      throw new Error('Failed to generate response with file context');
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

      if (history.length > 0) {
        const chat = this.textModel.startChat({
          history: history.map(msg => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
        });

        const result = await chat.sendMessageStream(fullPrompt);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) yield text;
        }
      } else {
        const result = await this.textModel.generateContentStream(fullPrompt);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) yield text;
        }
      }
    } catch (error) {
      logger.error('Gemini stream with file context error:', error);
      throw error;
    }
  }

  /**
   * Generate file summary
   */
  async generateFileSummary(file: UploadedFile): Promise<string> {
    try {
      if (file.fileType === 'image' && file.base64) {
        const result = await this.visionModel.generateContent([
          { text: 'Provide a brief summary of what you see in this image.' },
          {
            inlineData: {
              data: file.base64,
              mimeType: file.mimeType,
            },
          },
        ]);
        return result.response.text();
      }

      const contentPreview = file.content.substring(0, 3000);
      const prompt = `Please provide a concise summary (2-3 sentences) of this ${file.fileType} file named "${file.fileName}":\n\n${contentPreview}`;

      const result = await this.textModel.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      logger.error('File summary generation error:', error);
      return 'Summary generation failed';
    }
  }

  /**
   * Build file context string for prompt
   */
  private buildFileContext(files: UploadedFile[]): string {
    if (files.length === 0) return '';

    let context = '=== UPLOADED FILES CONTEXT ===\n\n';

    files.forEach((file, index) => {
      context += `File ${index + 1}: "${file.fileName}" (${file.fileType})\n`;
      context += `Uploaded: ${file.uploadedAt.toLocaleString()}\n`;

      if (file.fileType === 'image') {
        context += `Content: [Image - requires vision analysis]\n`;
        if (file.summary) {
          context += `Summary: ${file.summary}\n`;
        }
      } else {
        const maxLength = 10000;
        const content = file.content.length > maxLength
          ? file.content.substring(0, maxLength) + '\n\n[Content truncated due to length...]'
          : file.content;
        context += `Content:\n${content}\n`;
      }

      context += '\n' + '-'.repeat(50) + '\n\n';
    });

    return context;
  }

  /**
   * Build prompt with file context
   */
  private buildPromptWithContext(prompt: string, fileContext: string): string {
    if (!fileContext) return prompt;

    return `${fileContext}\n\n=== USER QUESTION ===\n${prompt}\n\nPlease answer based on the uploaded files above. If the question references specific files by name, focus on those. Otherwise, use all available context.`;
  }

  /**
   * Check if Gemini API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.textModel.generateContent('Test');
      return !!result.response.text();
    } catch (error) {
      logger.error('Gemini health check failed:', error);
      return false;
    }
  }
}

/**
 * Singleton instance of Gemini service
 */
export const geminiService = new GeminiService();
