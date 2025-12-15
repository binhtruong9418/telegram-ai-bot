import { Middleware } from 'grammy';
import { BotContext, createEmptySession } from '../../types';
import { sessionStorage } from '../../services/storage.service';
import { logger } from '../../utils/logger';

/**
 * Session middleware
 * Loads or creates user session for each message
 */
export const sessionMiddleware: Middleware<BotContext> = async (ctx, next) => {
  // Get user information
  const user = ctx.from;

  if (!user) {
    // If no user info, skip session loading
    logger.warn('Message received without user information');
    return await next();
  }

  try {
    // Try to load existing session
    let session = await sessionStorage.getSession(user.id);

    // Create new session if none exists
    if (!session) {
      session = createEmptySession(
        user.id,
        user.username,
        user.first_name,
        user.last_name
      );

      // Save new session
      await sessionStorage.setSession(user.id, session);

      logger.info(`Created new session for user ${user.id} (@${user.username || 'no username'})`);
    } else {
      // Update last active timestamp
      session.lastActive = new Date();

      // Update user info in case it changed
      session.username = user.username;
      session.firstName = user.first_name;
      session.lastName = user.last_name;

      logger.debug(`Loaded existing session for user ${user.id}`);
    }

    // Attach session to context
    ctx.session = session;

    // Continue to next middleware
    await next();

    // Save session after processing (if it exists)
    if (ctx.session) {
      await sessionStorage.setSession(user.id, ctx.session);
      logger.debug(`Saved session for user ${user.id}`);
    }
  } catch (error) {
    logger.error(`Error in session middleware for user ${user.id}:`, error);

    // If session doesn't exist, create temporary one and rethrow
    if (!ctx.session) {
      ctx.session = createEmptySession(
        user.id,
        user.username,
        user.first_name,
        user.last_name
      );
    }

    // Rethrow the error to let error handler deal with it
    throw error;
  }
};
