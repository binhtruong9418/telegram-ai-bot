import { ConversationMessage, UserSession } from '../types';
import { botConfig } from '../config/bot.config';
import { logger } from '../utils/logger';

/**
 * Conversation service
 * Manages conversation history for users
 */
export class ConversationService {
  /**
   * Add a message to the conversation history
   */
  addMessage(
    session: UserSession,
    role: 'user' | 'model',
    content: string,
    hasImage?: boolean,
    imageData?: string,
    imageMimeType?: string
  ): UserSession {
    const message: ConversationMessage = {
      role,
      content,
      timestamp: new Date(),
      hasImage,
      imageData,
      imageMimeType,
    };

    // Add message to history
    session.conversationHistory.push(message);

    // Trim history if it exceeds max length
    const maxLength = botConfig.session.maxHistoryLength;
    if (session.conversationHistory.length > maxLength) {
      const removed = session.conversationHistory.length - maxLength;
      session.conversationHistory = session.conversationHistory.slice(-maxLength);

      logger.debug(
        `Trimmed ${removed} old messages from user ${session.userId}'s history`
      );
    }

    // Update last active timestamp
    session.lastActive = new Date();

    return session;
  }

  /**
   * Add a user message to conversation history
   */
  addUserMessage(
    session: UserSession,
    content: string,
    hasImage?: boolean,
    imageData?: string,
    imageMimeType?: string
  ): UserSession {
    return this.addMessage(session, 'user', content, hasImage, imageData, imageMimeType);
  }

  /**
   * Add a model response to conversation history
   */
  addModelMessage(session: UserSession, content: string): UserSession {
    return this.addMessage(session, 'model', content);
  }

  /**
   * Get conversation history for Gemini API
   * Formats messages in the required format for Gemini
   */
  getFormattedHistory(session: UserSession): Array<{
    role: string;
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  }> {
    return session.conversationHistory.map((msg) => {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Add text part
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      // Add image part if present
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
   * Clear conversation history for a user
   */
  clearHistory(session: UserSession): UserSession {
    const messageCount = session.conversationHistory.length;
    session.conversationHistory = [];
    session.lastActive = new Date();

    logger.info(`Cleared ${messageCount} messages for user ${session.userId}`);

    return session;
  }

  /**
   * Get conversation statistics
   */
  getStats(session: UserSession): {
    totalMessages: number;
    userMessages: number;
    modelMessages: number;
    messagesWithImages: number;
    oldestMessage: Date | null;
    newestMessage: Date | null;
  } {
    const history = session.conversationHistory;

    const userMessages = history.filter((m) => m.role === 'user').length;
    const modelMessages = history.filter((m) => m.role === 'model').length;
    const messagesWithImages = history.filter((m) => m.hasImage).length;

    let oldest: Date | null = null;
    let newest: Date | null = null;

    if (history.length > 0) {
      oldest = history[0]?.timestamp || null;
      newest = history[history.length - 1]?.timestamp || null;
    }

    return {
      totalMessages: history.length,
      userMessages,
      modelMessages,
      messagesWithImages,
      oldestMessage: oldest,
      newestMessage: newest,
    };
  }

  /**
   * Check if conversation history is empty
   */
  isEmpty(session: UserSession): boolean {
    return session.conversationHistory.length === 0;
  }

  /**
   * Get the last N messages from conversation
   */
  getLastMessages(session: UserSession, count: number): ConversationMessage[] {
    return session.conversationHistory.slice(-count);
  }

  /**
   * Get messages since a specific timestamp
   */
  getMessagesSince(session: UserSession, since: Date): ConversationMessage[] {
    return session.conversationHistory.filter((m) => m.timestamp >= since);
  }

  /**
   * Check if session has recent activity
   */
  hasRecentActivity(session: UserSession, thresholdMs: number = 300000): boolean {
    const now = Date.now();
    const lastActive = session.lastActive.getTime();
    return now - lastActive < thresholdMs;
  }

  /**
   * Export conversation history as text
   */
  exportHistory(session: UserSession): string {
    let exported = `Conversation History - User ${session.userId}\n`;
    exported += `Username: ${session.username || 'N/A'}\n`;
    exported += `Started: ${session.createdAt.toISOString()}\n`;
    exported += `Last Active: ${session.lastActive.toISOString()}\n`;
    exported += `Messages: ${session.conversationHistory.length}\n`;
    exported += '='.repeat(60) + '\n\n';

    session.conversationHistory.forEach((msg, index) => {
      const timestamp = msg.timestamp.toISOString();
      const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
      const imageNote = msg.hasImage ? ' [Image attached]' : '';

      exported += `[${index + 1}] ${timestamp} - ${role}${imageNote}\n`;
      exported += `${msg.content}\n`;
      exported += '-'.repeat(60) + '\n\n';
    });

    return exported;
  }

  /**
   * Get conversation context summary
   * Returns a brief summary of the conversation state
   */
  getContextSummary(session: UserSession): string {
    const stats = this.getStats(session);

    if (stats.totalMessages === 0) {
      return 'No conversation history';
    }

    return `${stats.totalMessages} messages (${stats.userMessages} from user, ${stats.modelMessages} from assistant)${
      stats.messagesWithImages > 0 ? `, ${stats.messagesWithImages} with images` : ''
    }`;
  }
}

/**
 * Singleton instance of conversation service
 */
export const conversationService = new ConversationService();
