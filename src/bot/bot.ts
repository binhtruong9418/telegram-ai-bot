import { Bot } from 'grammy';
import { BotContext } from '../types';
import { botConfig } from '../config/bot.config';
import { logger } from '../utils/logger';
import { COMMANDS } from '../utils/constants';

// Import middlewares
import { sessionMiddleware, rateLimitMiddleware, errorHandler } from './middlewares';

// Import command handlers
import { startCommand, helpCommand, newCommand, clearCommand } from './commands';

// Import message handlers
import { textHandler, documentHandler, photoHandler } from './handlers';

/**
 * Create and configure the Grammy bot instance
 */
export const createBot = (): Bot<BotContext> => {
  // Initialize bot
  const bot = new Bot<BotContext>(botConfig.token);

  logger.info('Initializing bot...');

  // ============================================
  // Register middlewares
  // ============================================

  // Session middleware (load/save user sessions)
  bot.use(sessionMiddleware);

  // Rate limiting middleware
  bot.use(rateLimitMiddleware);

  logger.info('Middlewares registered');

  // ============================================
  // Register command handlers
  // ============================================

  bot.command(COMMANDS.START, startCommand);
  bot.command(COMMANDS.HELP, helpCommand);
  bot.command(COMMANDS.NEW, newCommand);
  bot.command(COMMANDS.CLEAR, clearCommand);

  logger.info('Commands registered:', {
    commands: [COMMANDS.START, COMMANDS.HELP, COMMANDS.NEW, COMMANDS.CLEAR],
  });

  // ============================================
  // Register message handlers
  // ============================================

  // Photo handler - handles image uploads
  bot.on('message:photo', photoHandler);

  // Document handler - handles PDF, DOCX, and other files
  bot.on('message:document', documentHandler);

  // Text handler (all text messages that aren't commands)
  bot.on('message:text', async (ctx, next) => {
    // Skip if it's a command
    if (ctx.message.text.startsWith('/')) {
      await next();
      return;
    }
    await textHandler(ctx);
  });

  logger.info('Message handlers registered (text, photo, document)');

  // ============================================
  // Error handling
  // ============================================

  bot.catch(errorHandler);

  logger.info('Error handler registered');

  // ============================================
  // Bot information
  // ============================================

  bot.api.getMe().then((botInfo) => {
    logger.info('Bot initialized successfully:', {
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name,
    });
  }).catch((error) => {
    logger.error('Failed to get bot info:', error);
  });

  return bot;
};

/**
 * Set bot commands for BotFather menu
 */
export const setBotCommands = async (bot: Bot<BotContext>): Promise<void> => {
  try {
    await bot.api.setMyCommands([
      { command: COMMANDS.START, description: 'Start the bot' },
      { command: COMMANDS.HELP, description: 'Show help message' },
      { command: COMMANDS.NEW, description: 'Start new conversation' },
      { command: COMMANDS.CLEAR, description: 'Clear conversation history' },
    ]);

    logger.info('Bot commands set successfully');
  } catch (error) {
    logger.error('Failed to set bot commands:', error);
  }
};
