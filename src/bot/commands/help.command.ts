import { CommandContext } from 'grammy';
import { BotContext } from '../../types';
import { MESSAGES } from '../../utils/constants';
import { logUserAction } from '../../utils/logger';

/**
 * /help command handler
 * Displays available commands and usage instructions
 */
export const helpCommand = async (ctx: CommandContext<BotContext>): Promise<void> => {
  const user = ctx.from;

  if (!user) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  logUserAction(user.id, user.username, 'help_command');

  await ctx.reply(MESSAGES.HELP, {
    parse_mode: 'Markdown',
  });
};
