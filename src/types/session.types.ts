import { Context } from 'grammy';

/**
 * Message role types
 */
export type MessageRole = 'user' | 'model' | 'system';

/**
 * Conversation message interface
 * Represents a single message in the conversation history
 */
export interface ConversationMessage {
  /**
   * Message role (user, model, or system)
   */
  role: MessageRole;

  /**
   * Message content/text
   */
  content: string;

  /**
   * Message timestamp
   */
  timestamp: Date;

  /**
   * Whether this message includes an image
   */
  hasImage?: boolean;

  /**
   * Image data (base64 encoded) if applicable
   */
  imageData?: string;

  /**
   * Image MIME type if applicable
   */
  imageMimeType?: string;

  /**
   * Files referenced in this message (optional)
   */
  referencedFiles?: string[];
}

/**
 * Uploaded file interface
 * Represents a file uploaded by a user
 */
export interface UploadedFile {
  /**
   * Telegram file ID
   */
  fileId: string;

  /**
   * Original filename
   */
  fileName: string;

  /**
   * File type category
   */
  fileType: 'pdf' | 'docx' | 'text' | 'image' | 'code' | 'data';

  /**
   * MIME type
   */
  mimeType: string;

  /**
   * File size in bytes
   */
  fileSize: number;

  /**
   * Upload timestamp
   */
  uploadedAt: Date;

  /**
   * Extracted text content
   */
  content: string;

  /**
   * Base64 encoded image data (for images)
   */
  base64?: string;

  /**
   * AI-generated summary of the file
   */
  summary?: string;
}

/**
 * File statistics interface
 */
export interface FileStats {
  /**
   * Total number of files
   */
  totalFiles: number;

  /**
   * Total size of all files in bytes
   */
  totalSize: number;

  /**
   * Count of files by type
   */
  fileTypes: Record<string, number>;
}

/**
 * User settings interface
 */
export interface UserSettings {
  /**
   * Gemini model to use (text or vision)
   */
  model: 'gemini-pro' | 'gemini-pro-vision';

  /**
   * Temperature for generation (0.0 to 1.0)
   */
  temperature: number;

  /**
   * Whether to show typing indicator
   */
  showTypingIndicator: boolean;

  /**
   * Maximum tokens for generation
   */
  maxTokens: number;
}

/**
 * Rate limit tracking interface
 */
export interface RateLimitInfo {
  /**
   * Number of messages sent in current window
   */
  messageCount: number;

  /**
   * Number of images sent in current window
   */
  imageCount: number;

  /**
   * Timestamp of window start
   */
  windowStart: Date;

  /**
   * Timestamp of last activity
   */
  lastActivity: Date;
}

/**
 * User session interface
 * Stores all user-specific data including conversation history and settings
 */
export interface UserSession {
  /**
   * Telegram user ID
   */
  userId: number;

  /**
   * Telegram username (if available)
   */
  username?: string;

  /**
   * User's first name
   */
  firstName: string;

  /**
   * User's last name (if available)
   */
  lastName?: string;

  /**
   * Conversation history (list of messages)
   */
  conversationHistory: ConversationMessage[];

  /**
   * Uploaded files for this user
   */
  uploadedFiles: UploadedFile[];

  /**
   * User settings
   */
  settings: UserSettings;

  /**
   * Rate limiting information
   */
  rateLimit: RateLimitInfo;

  /**
   * Session creation timestamp
   */
  createdAt: Date;

  /**
   * Last activity timestamp
   */
  lastActive: Date;

  /**
   * Whether the session is active
   */
  isActive: boolean;
}

/**
 * Session storage interface
 * Defines methods for session persistence
 */
export interface SessionStorage {
  /**
   * Get a user's session
   */
  getSession(userId: number): Promise<UserSession | undefined>;

  /**
   * Save or update a user's session
   */
  setSession(userId: number, session: UserSession): Promise<void>;

  /**
   * Delete a user's session
   */
  deleteSession(userId: number): Promise<void>;

  /**
   * Check if a session exists
   */
  hasSession(userId: number): Promise<boolean>;

  /**
   * Get all active sessions
   */
  getAllSessions(): Promise<Map<number, UserSession>>;

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): Promise<number>;
}

/**
 * Extended Grammy context with session data
 */
export interface BotContext extends Context {
  /**
   * Current user session
   */
  session?: UserSession;
}

/**
 * Image analysis request
 */
export interface ImageAnalysisRequest {
  /**
   * Image data (base64 encoded or Buffer)
   */
  imageData: string | Buffer;

  /**
   * Image MIME type
   */
  mimeType: string;

  /**
   * Optional prompt/question about the image
   */
  prompt?: string;

  /**
   * User ID making the request
   */
  userId: number;
}

/**
 * Text generation request
 */
export interface TextGenerationRequest {
  /**
   * User prompt
   */
  prompt: string;

  /**
   * Conversation history for context
   */
  conversationHistory: ConversationMessage[];

  /**
   * User ID making the request
   */
  userId: number;

  /**
   * Optional user settings override
   */
  settings?: Partial<UserSettings>;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /**
   * Whether the request was successful
   */
  success: boolean;

  /**
   * Response data (if successful)
   */
  data?: T;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Error code (if failed)
   */
  errorCode?: string;

  /**
   * Response duration in milliseconds
   */
  duration?: number;
}

/**
 * Gemini streaming chunk
 */
export interface GeminiStreamChunk {
  /**
   * Chunk text content
   */
  text: string;

  /**
   * Whether this is the final chunk
   */
  done: boolean;

  /**
   * Chunk index
   */
  index: number;
}

/**
 * Default user settings
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  model: 'gemini-pro',
  temperature: 0.7,
  showTypingIndicator: true,
  maxTokens: 2048,
};

/**
 * Creates a new empty user session
 */
export const createEmptySession = (
  userId: number,
  username?: string,
  firstName: string = 'User',
  lastName?: string
): UserSession => {
  const now = new Date();

  return {
    userId,
    username,
    firstName,
    lastName,
    conversationHistory: [],
    uploadedFiles: [],
    settings: { ...DEFAULT_USER_SETTINGS },
    rateLimit: {
      messageCount: 0,
      imageCount: 0,
      windowStart: now,
      lastActivity: now,
    },
    createdAt: now,
    lastActive: now,
    isActive: true,
  };
};

/**
 * Type guard to check if a message has an image
 */
export const hasImage = (message: ConversationMessage): boolean => {
  return message.hasImage === true && !!message.imageData;
};
