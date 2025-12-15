import { CommandContext } from 'grammy';
import { BotContext } from '../../types';
import { MESSAGES } from '../../utils/constants';
import { logUserAction } from '../../utils/logger';

/**
 * /start command handler
 * Displays welcome message and introduction
 */
export const startCommand = async (ctx: CommandContext<BotContext>): Promise<void> => {
  const user = ctx.from;

  if (!user) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  logUserAction(user.id, user.username, 'start_command');

  await ctx.reply(MESSAGES.WELCOME, {
    parse_mode: 'Markdown',
  });
};
