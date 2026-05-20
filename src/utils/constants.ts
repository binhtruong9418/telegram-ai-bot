/**
 * Bot command definitions
 */
export const COMMANDS = {
    START: "start",
    HELP: "help",
    NEW: "new",
    CLEAR: "clear",
    SETTINGS: "settings",
} as const;

/**
 * Bot command descriptions for BotFather
 */
export const COMMAND_DESCRIPTIONS = {
    [COMMANDS.START]: "Start the bot and see welcome message",
    [COMMANDS.HELP]: "Show available commands and usage",
    [COMMANDS.NEW]: "Start a new conversation",
    [COMMANDS.CLEAR]: "Clear conversation history",
    [COMMANDS.SETTINGS]: "View and change bot settings",
} as const;

/**
 * User-facing messages
 */
export const MESSAGES = {
    // Welcome and help
    WELCOME: `👋 *Welcome!*

I'm an AI assistant powered by OpenRouter. I can help you with:
• Answering questions on any topic
• Analyzing images and photos
• Having multi-turn conversations with context
• Providing detailed explanations

*Available Commands:*
/start - Show this welcome message
/help - Get help and see all commands
/new - Start a fresh conversation
/clear - Clear conversation history

Just send me a message or image to get started! 🚀`,

    HELP: `🔧 *Available Commands*

/start - Show welcome message
/help - Display this help message
/new - Start a new conversation (clears context)
/clear - Clear conversation history

*How to use:*

📝 *Text Messages*
Just type your question and I'll respond.

🖼️ *Images*
Send an image and I'll analyze it. You can also add a caption with your question.

💬 *Conversations*
I remember our last 20 messages, so you can have natural back-and-forth conversations.

⚡ *Rate Limits*
• 20 text messages per minute
• 5 images per minute

Need help? Just ask me anything! 💡`,

    NEW_CONVERSATION:
        "🆕 Started a new conversation! Your previous chat history has been cleared.",

    CLEAR_HISTORY: "🗑️ Conversation history cleared successfully!",

    // Error messages
    ERROR_GENERIC:
        "❌ Sorry, something went wrong. Please try again in a moment.",

    ERROR_RATE_LIMIT:
        "⏳ You're sending messages too quickly! Please wait a moment and try again.",

    ERROR_IMAGE_RATE_LIMIT:
        "⏳ You're sending images too quickly! Please wait a moment before sending another image.",

    ERROR_GEMINI_API:
        "❌ I'm having trouble connecting to the AI. Please try again in a moment.",

    ERROR_IMAGE_DOWNLOAD:
        "❌ Sorry, I couldn't download that image. Please try sending it again.",

    ERROR_IMAGE_PROCESSING:
        "❌ Sorry, I couldn't process that image. Please try a different image.",

    ERROR_INVALID_IMAGE:
        "❌ The image format is not supported. Please send a JPEG or PNG image.",

    ERROR_MESSAGE_TOO_LONG:
        "❌ Your message is too long. Please try a shorter message.",

    ERROR_NO_MESSAGE: "❌ Please send a text message or image.",

    // Processing messages
    PROCESSING: "⏳ Processing your request...",

    ANALYZING_IMAGE: "🔍 Analyzing your image...",

    THINKING: "🤔 Let me think about that...",

    FOOTER: "",
} as const;

/**
 * Error codes for internal error handling
 */
export const ERROR_CODES = {
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    IMAGE_DOWNLOAD_FAILED: "IMAGE_DOWNLOAD_FAILED",
    IMAGE_PROCESSING_FAILED: "IMAGE_PROCESSING_FAILED",
    AI_API_ERROR: "AI_API_ERROR",
    INVALID_REQUEST: "INVALID_REQUEST",
    INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

/**
 * Telegram message limits
 */
export const TELEGRAM_LIMITS = {
    /**
     * Maximum message length (characters)
     */
    MAX_MESSAGE_LENGTH: 4096,

    /**
     * Maximum caption length (characters)
     */
    MAX_CAPTION_LENGTH: 1024,

    /**
     * Maximum file size for photos (bytes) - 10MB
     */
    MAX_PHOTO_SIZE: 10 * 1024 * 1024,

    /**
     * Maximum file size for documents (bytes) - 50MB
     */
    MAX_DOCUMENT_SIZE: 50 * 1024 * 1024,
} as const;

/**
 * Supported image MIME types
 */
export const SUPPORTED_IMAGE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
] as const;

/**
 * Message role types for conversation history
 */
export const MESSAGE_ROLES = {
    USER: "user",
    MODEL: "model",
    SYSTEM: "system",
} as const;

/**
 * Session cleanup intervals
 */
export const CLEANUP_INTERVALS = {
    /**
     * How often to check for expired sessions (milliseconds)
     * Default: every 5 minutes
     */
    SESSION_CLEANUP: 5 * 60 * 1000,

    /**
     * How often to reset rate limit counters (milliseconds)
     * Default: every minute
     */
    RATE_LIMIT_RESET: 60 * 1000,
} as const;

/**
 * Retry configuration for API calls
 */
export const RETRY_CONFIG = {
    /**
     * Maximum number of retries
     */
    MAX_RETRIES: 3,

    /**
     * Initial retry delay (milliseconds)
     */
    INITIAL_DELAY: 1000,

    /**
     * Maximum retry delay (milliseconds)
     */
    MAX_DELAY: 10000,

    /**
     * Exponential backoff multiplier
     */
    BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Typing indicator configuration
 */
export const TYPING_CONFIG = {
    /**
     * How often to send typing indicator (milliseconds)
     */
    INTERVAL: 4000,

    /**
     * Maximum duration to show typing indicator (milliseconds)
     */
    MAX_DURATION: 30000,
} as const;

/**
 * Markdown special characters that need escaping for Telegram MarkdownV2
 */
export const MARKDOWN_SPECIAL_CHARS = [
    "_",
    "*",
    "[",
    "]",
    "(",
    ")",
    "~",
    "`",
    ">",
    "#",
    "+",
    "-",
    "=",
    "|",
    "{",
    "}",
    ".",
    "!",
] as const;

/**
 * Regular expressions
 */
export const REGEX = {
    /**
     * Code block pattern
     */
    CODE_BLOCK: /```[\s\S]*?```/g,

    /**
     * Inline code pattern
     */
    INLINE_CODE: /`[^`]+`/g,

    /**
     * URL pattern
     */
    URL: /https?:\/\/[^\s]+/g,
} as const;
