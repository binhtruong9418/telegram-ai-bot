import { TELEGRAM_LIMITS, MARKDOWN_SPECIAL_CHARS, REGEX, MESSAGES } from './constants';

/**
 * Escapes special characters for Telegram MarkdownV2 format
 * Preserves code blocks and inline code
 */
export const escapeMarkdown = (text: string): string => {
  // Store code blocks temporarily
  const codeBlocks: string[] = [];
  let tempText = text.replace(REGEX.CODE_BLOCK, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Store inline code temporarily
  const inlineCodes: string[] = [];
  tempText = tempText.replace(REGEX.INLINE_CODE, (match) => {
    inlineCodes.push(match);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  // Escape special characters in the remaining text
  for (const char of MARKDOWN_SPECIAL_CHARS) {
    tempText = tempText.split(char).join(`\\${char}`);
  }

  // Restore inline code
  inlineCodes.forEach((code, index) => {
    tempText = tempText.replace(`__INLINE_CODE_${index}__`, code);
  });

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    tempText = tempText.replace(`__CODE_BLOCK_${index}__`, block);
  });

  return tempText;
};

/**
 * Formats a message for Telegram with proper escaping and footer
 */
export const formatMessage = (text: string, addFooter: boolean = true): string => {
  let formatted = text.trim();

  // Add footer if requested
  if (addFooter) {
    formatted += MESSAGES.FOOTER;
  }

  return formatted;
};

/**
 * Truncates a message to fit within Telegram's length limit
 * Preserves whole words and adds ellipsis if truncated
 */
export const truncateMessage = (
  text: string,
  maxLength: number = TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH
): string => {
  if (text.length <= maxLength) {
    return text;
  }

  // Find the last space before the limit to avoid cutting words
  const truncationPoint = text.lastIndexOf(' ', maxLength - 3);
  const truncated = text.substring(0, truncationPoint > 0 ? truncationPoint : maxLength - 3);

  return `${truncated}...`;
};

/**
 * Splits a long message into multiple chunks that fit within Telegram's limit
 * Tries to split at natural boundaries (paragraphs, sentences)
 */
export const splitMessage = (
  text: string,
  maxLength: number = TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH
): string[] => {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    // Try to split at paragraph boundary
    let splitPoint = remainingText.lastIndexOf('\n\n', maxLength);

    // If no paragraph boundary, try sentence boundary
    if (splitPoint === -1 || splitPoint < maxLength * 0.5) {
      splitPoint = remainingText.lastIndexOf('. ', maxLength);
    }

    // If no sentence boundary, try any space
    if (splitPoint === -1 || splitPoint < maxLength * 0.5) {
      splitPoint = remainingText.lastIndexOf(' ', maxLength);
    }

    // If still no good split point, just cut at maxLength
    if (splitPoint === -1 || splitPoint < maxLength * 0.5) {
      splitPoint = maxLength;
    }

    chunks.push(remainingText.substring(0, splitPoint).trim());
    remainingText = remainingText.substring(splitPoint).trim();
  }

  return chunks;
};

/**
 * Formats a code block with syntax highlighting hint
 */
export const formatCodeBlock = (code: string, language: string = ''): string => {
  return `\`\`\`${language}\n${code}\n\`\`\``;
};

/**
 * Formats inline code
 */
export const formatInlineCode = (code: string): string => {
  return `\`${code}\``;
};

/**
 * Formats a user mention
 */
export const formatUserMention = (userId: number, name: string): string => {
  return `[${name}](tg://user?id=${userId})`;
};

/**
 * Formats a timestamp in readable format
 */
export const formatTimestamp = (date: Date): string => {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Formats a duration in milliseconds to readable format
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms < 3600000) {
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
};

/**
 * Formats file size in bytes to readable format
 */
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Cleans up text by removing extra whitespace and newlines
 */
export const cleanText = (text: string): string => {
  return text
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .trim();
};

/**
 * Escapes HTML special characters in plain text segments.
 * Required before inserting raw text into Telegram HTML messages.
 */
const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Converts AI markdown output to Telegram HTML format.
 * HTML parse_mode is more robust than Markdown — unbalanced * or _ won't break the whole message.
 * Supported Telegram HTML tags: <b>, <i>, <u>, <s>, <code>, <pre>, <a href>.
 */
export const convertToTelegramHtml = (text: string): string => {
  // Use numeric-only placeholders — no underscores or letters that could match italic/bold regex
  const codeBlocks: string[] = [];
  let result = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = escapeHtml(code.trim());
    const tag = lang ? `<pre><code class="language-${lang}">${escaped}</code></pre>` : `<pre>${escaped}</pre>`;
    codeBlocks.push(tag);
    return `\x02CB${codeBlocks.length - 1}\x03`;
  });

  const inlineCodes: string[] = [];
  result = result.replace(/`([^`]+)`/g, (_match, code) => {
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `\x02IC${inlineCodes.length - 1}\x03`;
  });

  // Escape HTML in remaining text (placeholders use \x02/\x03 which are unaffected)
  result = escapeHtml(result);

  // Convert **bold** → <b>bold</b>
  result = result.replace(/\*\*(.+?)\*\*/gs, '<b>$1</b>');

  // Convert *text* → <i>text</i> (single asterisk only)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, '<i>$1</i>');

  // Convert _text_ → <i>text</i> (single underscore only, not inside words)
  result = result.replace(/(?<=\s|^)_([^_]+)_(?=\s|$|[.,!?])/gm, '<i>$1</i>');

  // Convert # / ## / ### headings → <b>heading</b>
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // Restore inline code and code blocks
  inlineCodes.forEach((code, i) => {
    result = result.replace(`\x02IC${i}\x03`, code);
  });
  codeBlocks.forEach((block, i) => {
    result = result.replace(`\x02CB${i}\x03`, block);
  });

  return result.trim();
};

/**
 * Formats an AI response for Telegram display using HTML parse mode.
 */
export const formatAiResponse = (text: string): string => {
  return convertToTelegramHtml(cleanText(text));
};

/** @deprecated Use formatAiResponse instead */
export const formatGeminiResponse = formatAiResponse;

/**
 * Formats an error message for user display
 */
export const formatErrorMessage = (error: Error, userFriendly: boolean = true): string => {
  if (userFriendly) {
    return MESSAGES.ERROR_GENERIC;
  }

  return `Error: ${error.message}`;
};

/**
 * Validates if text is within Telegram's message length limit
 */
export const isValidMessageLength = (text: string): boolean => {
  return text.length <= TELEGRAM_LIMITS.MAX_MESSAGE_LENGTH;
};

/**
 * Formats conversation history for export
 */
export const formatConversationHistory = (
  messages: Array<{ role: string; content: string; timestamp: Date }>
): string => {
  let formatted = '# Conversation History\n\n';

  messages.forEach((msg, index) => {
    const timestamp = formatTimestamp(msg.timestamp);
    const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';

    formatted += `## Message ${index + 1} - ${role}\n`;
    formatted += `**Time:** ${timestamp}\n\n`;
    formatted += `${msg.content}\n\n`;
    formatted += '---\n\n';
  });

  return formatted;
};
