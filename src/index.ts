import { createBot, setBotCommands } from './bot/bot';
import { shutdownSessionStorage } from './services/storage.service';
import { logger, logStartup } from './utils/logger';
import { botConfig } from './config/bot.config';

/**
 * Main entry point for the Gemini Telegram Bot
 */
const main = async (): Promise<void> => {
  try {
    // Log startup information
    logStartup();

    // Create bot instance
    logger.info('Creating bot instance...');
    const bot = createBot();

    // Set bot commands
    await setBotCommands(bot);

    // Setup graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        // Stop the bot
        await bot.stop();
        logger.info('Bot stopped');

        // Shutdown session storage
        shutdownSessionStorage();

        // Exit process
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled Rejection:', reason);
      shutdown('unhandledRejection');
    });

    // Start the bot
    logger.info('Starting bot...');
    logger.info(`Environment: ${botConfig.environment}`);
    logger.info(`Mode: ${botConfig.isProduction ? 'Production' : 'Development'}`);

    // Start bot with long polling
    await bot.start({
      onStart: (botInfo) => {
        logger.info('='.repeat(60));
        logger.info('✅ Bot started successfully!');
        logger.info(`Bot: @${botInfo.username}`);
        logger.info(`ID: ${botInfo.id}`);
        logger.info(`Name: ${botInfo.first_name}`);
        logger.info('='.repeat(60));
        logger.info('Bot is now listening for messages...');
      },
    });
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
};

// Start the application
main();
