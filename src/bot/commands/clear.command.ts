import { CommandContext } from 'grammy';
import { BotContext } from '../../types';
import { conversationService } from '../../services/conversation.service';
import { MESSAGES } from '../../utils/constants';
import { logUserAction } from '../../utils/logger';

/**
 * /clear command handler
 * Clears conversation history
 */
export const clearCommand = async (ctx: CommandContext<BotContext>): Promise<void> => {
  const user = ctx.from;

  if (!user || !ctx.session) {
    await ctx.reply('Unable to clear history.');
    return;
  }

  // Get message count before clearing
  const messageCount = ctx.session.conversationHistory.length;

  // Clear conversation history
  ctx.session = conversationService.clearHistory(ctx.session);

  logUserAction(user.id, user.username, 'clear_history', {
    clearedMessageCount: messageCount,
  });

  await ctx.reply(MESSAGES.CLEAR_HISTORY);
};
