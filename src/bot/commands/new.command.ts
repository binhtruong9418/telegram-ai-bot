import { CommandContext } from 'grammy';
import { BotContext } from '../../types';
import { conversationService } from '../../services/conversation.service';
import { MESSAGES } from '../../utils/constants';
import { logUserAction } from '../../utils/logger';

/**
 * /new command handler
 * Starts a new conversation by clearing the context
 */
export const newCommand = async (ctx: CommandContext<BotContext>): Promise<void> => {
  const user = ctx.from;

  if (!user || !ctx.session) {
    await ctx.reply('Unable to start new conversation.');
    return;
  }

  // Get message count before clearing
  const messageCount = ctx.session.conversationHistory.length;

  // Clear conversation history
  ctx.session = conversationService.clearHistory(ctx.session);

  logUserAction(user.id, user.username, 'new_conversation', {
    previousMessageCount: messageCount,
  });

  await ctx.reply(MESSAGES.NEW_CONVERSATION);
};
