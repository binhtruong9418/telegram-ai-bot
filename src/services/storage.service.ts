import { UserSession, SessionStorage } from '../types';
import { botConfig } from '../config/bot.config';
import { logger, logSession } from '../utils/logger';
import { CLEANUP_INTERVALS } from '../utils/constants';

/**
 * In-memory session storage implementation
 * Uses a Map to store user sessions with automatic cleanup
 */
export class InMemorySessionStorage implements SessionStorage {
  /**
   * Map to store sessions by user ID
   */
  private sessions: Map<number, UserSession>;

  /**
   * Cleanup interval timer
   */
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.sessions = new Map();
    this.startCleanupInterval();
    logger.info('In-memory session storage initialized');
  }

  /**
   * Get a user's session
   */
  async getSession(userId: number): Promise<UserSession | undefined> {
    const session = this.sessions.get(userId);

    if (session) {
      logSession(userId, 'loaded', {
        messageCount: session.conversationHistory.length,
        lastActive: session.lastActive,
      });
    }

    return session;
  }

  /**
   * Save or update a user's session
   */
  async setSession(userId: number, session: UserSession): Promise<void> {
    const isNew = !this.sessions.has(userId);

    this.sessions.set(userId, {
      ...session,
      lastActive: new Date(),
    });

    logSession(userId, isNew ? 'created' : 'updated', {
      messageCount: session.conversationHistory.length,
    });
  }

  /**
   * Delete a user's session
   */
  async deleteSession(userId: number): Promise<void> {
    const deleted = this.sessions.delete(userId);

    if (deleted) {
      logSession(userId, 'cleared');
    }
  }

  /**
   * Check if a session exists
   */
  async hasSession(userId: number): Promise<boolean> {
    return this.sessions.has(userId);
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<Map<number, UserSession>> {
    return new Map(this.sessions);
  }

  /**
   * Clean up expired sessions based on timeout configuration
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    const timeout = botConfig.session.timeout;
    let cleanedCount = 0;

    for (const [userId, session] of this.sessions.entries()) {
      const sessionAge = now - session.lastActive.getTime();

      if (sessionAge > timeout) {
        this.sessions.delete(userId);
        cleanedCount++;
        logSession(userId, 'expired', {
          age: `${Math.round(sessionAge / 1000)}s`,
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions().catch((error) => {
        logger.error('Error during session cleanup:', error);
      });
    }, CLEANUP_INTERVALS.SESSION_CLEANUP);

    logger.info(
      `Session cleanup interval started (every ${CLEANUP_INTERVALS.SESSION_CLEANUP / 1000}s)`
    );
  }

  /**
   * Stop automatic cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      logger.info('Session cleanup interval stopped');
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();
    const timeout = botConfig.session.timeout;

    const activeSessions = sessions.filter(
      (s) => now - s.lastActive.getTime() < timeout
    );

    let oldest: Date | null = null;
    let newest: Date | null = null;

    if (sessions.length > 0) {
      oldest = sessions.reduce((min, s) =>
        s.createdAt < min ? s.createdAt : min,
        sessions[0].createdAt
      );
      newest = sessions.reduce((max, s) =>
        s.createdAt > max ? s.createdAt : max,
        sessions[0].createdAt
      );
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      oldestSession: oldest,
      newestSession: newest,
    };
  }

  /**
   * Clear all sessions (for testing or maintenance)
   */
  async clearAll(): Promise<void> {
    const count = this.sessions.size;
    this.sessions.clear();
    logger.info(`Cleared all ${count} sessions`);
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    this.stopCleanupInterval();
    logger.info('Session storage shut down');
  }
}

/**
 * Singleton instance of session storage
 */
export const sessionStorage = new InMemorySessionStorage();

/**
 * Graceful shutdown handler
 */
export const shutdownSessionStorage = (): void => {
  sessionStorage.shutdown();
};
