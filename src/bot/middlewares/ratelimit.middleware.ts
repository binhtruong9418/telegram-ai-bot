import { Middleware } from 'grammy';
import { BotContext } from '../../types';
import { botConfig } from '../../config/bot.config';
import { logRateLimit } from '../../utils/logger';
import { MESSAGES } from '../../utils/constants';

/**
 * Check if rate limit window has expired
 */
const isWindowExpired = (windowStart: Date, windowMs: number): boolean => {
  const now = Date.now();
  const windowStartTime = windowStart.getTime();
  return now - windowStartTime >= windowMs;
};

/**
 * Reset rate limit counters
 */
const resetRateLimit = (session: BotContext['session']): void => {
  if (!session) return;

  session.rateLimit.messageCount = 0;
  session.rateLimit.imageCount = 0;
  session.rateLimit.windowStart = new Date();
};

/**
 * Rate limiting middleware
 * Enforces message and image rate limits per user
 */
export const rateLimitMiddleware: Middleware<BotContext> = async (ctx, next) => {
  // Skip rate limiting for commands
  if (ctx.message?.text?.startsWith('/')) {
    return await next();
  }

  // Skip if no session
  if (!ctx.session) {
    return await next();
  }

  const { rateLimit } = ctx.session;
  const windowMs = botConfig.rateLimit.windowMs;

  // Reset counters if window has expired
  if (isWindowExpired(rateLimit.windowStart, windowMs)) {
    resetRateLimit(ctx.session);
  }

  // Check if message contains an image
  const hasImage = !!(ctx.message?.photo || ctx.message?.document);

  // Check image rate limit
  if (hasImage) {
    const imageLimit = botConfig.rateLimit.imagesPerMinute;

    if (rateLimit.imageCount >= imageLimit) {
      logRateLimit(ctx.session.userId, 'image', rateLimit.imageCount, imageLimit);

      await ctx.reply(MESSAGES.ERROR_IMAGE_RATE_LIMIT);
      return; // Don't proceed
    }

    // Increment image counter
    rateLimit.imageCount++;
  }

  // Check message rate limit
  const messageLimit = botConfig.rateLimit.messagesPerMinute;

  if (rateLimit.messageCount >= messageLimit) {
    logRateLimit(ctx.session.userId, 'message', rateLimit.messageCount, messageLimit);

    await ctx.reply(MESSAGES.ERROR_RATE_LIMIT);
    return; // Don't proceed
  }

  // Increment message counter
  rateLimit.messageCount++;

  // Update last activity
  rateLimit.lastActivity = new Date();

  // Continue to next middleware
  await next();
};
