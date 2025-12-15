import { BotContext } from '../../types';
import { logError } from '../../utils/logger';
import { MESSAGES, ERROR_CODES } from '../../utils/constants';
import { BotError, GrammyError, HttpError } from 'grammy';

/**
 * Custom error class for bot errors
 */
export class BotCustomError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage?: string
  ) {
    super(message);
    this.name = 'BotCustomError';
  }
}

/**
 * Error handler middleware
 * Catches and handles all errors in the bot
 */
export const errorHandler = async (err: BotError<BotContext>): Promise<void> => {
  const ctx = err.ctx;
  const error = err.error;

  // Log the error
  logError(error as Error, 'Bot Error Handler', {
    userId: ctx.from?.id,
    username: ctx.from?.username,
    updateType: ctx.update.message ? 'message' : ctx.update.callback_query ? 'callback_query' : 'unknown',
  });

  // Determine user-friendly error message
  let userMessage: string = MESSAGES.ERROR_GENERIC;

  if (error instanceof BotCustomError) {
    // Custom bot error with user message
    userMessage = error.userMessage || MESSAGES.ERROR_GENERIC;
  } else if (error instanceof GrammyError) {
    // Grammy-specific error
    if (error.message.includes('rate limit')) {
      userMessage = MESSAGES.ERROR_RATE_LIMIT;
    } else if (error.message.includes('message is too long')) {
      userMessage = MESSAGES.ERROR_MESSAGE_TOO_LONG;
    }
  } else if (error instanceof HttpError) {
    // HTTP error from Telegram API
    userMessage = '❌ Network error. Please try again in a moment.';
  }

  // Try to send error message to user
  try {
    if (ctx.chat) {
      await ctx.reply(userMessage, {
        parse_mode: undefined, // Don't use parse mode for error messages
      });
    }
  } catch (replyError) {
    // If we can't send the error message, log it
    logError(replyError as Error, 'Error Handler - Reply Failed', {
      originalError: (error as Error).message,
    });
  }
};

/**
 * Async error wrapper
 * Wraps async handlers to catch errors
 */
export const asyncErrorHandler = <T extends BotContext>(
  handler: (ctx: T) => Promise<void>
) => {
  return async (ctx: T): Promise<void> => {
    try {
      await handler(ctx);
    } catch (error) {
      // Convert to BotError and let error handler deal with it
      throw new BotError(error as Error, ctx);
    }
  };
};

/**
 * Create a custom bot error
 */
export const createBotError = (
  message: string,
  code: string = ERROR_CODES.INTERNAL_ERROR,
  userMessage?: string
): BotCustomError => {
  return new BotCustomError(message, code, userMessage);
};
