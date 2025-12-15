import winston from "winston";
import { botConfig } from "../config/bot.config";
import path from "path";

/**
 * Custom log format combining timestamp, level, and message
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(
        ({ timestamp, level, message, stack, ...metadata }) => {
            let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

            // Add stack trace if present (for errors)
            if (stack) {
                log += `\n${stack}`;
            }

            // Add metadata if present
            if (Object.keys(metadata).length > 0) {
                log += `\n${JSON.stringify(metadata, null, 2)}`;
            }

            return log;
        }
    )
);

/**
 * Create logs directory if it doesn't exist
 */
const logsDir = path.join(process.cwd(), "logs");

/**
 * Winston logger instance
 * Configured with console and file transports
 */
export const logger = winston.createLogger({
    level: botConfig.logLevel,
    format: logFormat,
    transports: [
        // Console transport with colorization
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: true }),
                logFormat
            ),
        }),

        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, "combined.log"),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),

        // File transport for errors only
        new winston.transports.File({
            filename: path.join(logsDir, "error.log"),
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    // Don't exit on uncaught errors
    exitOnError: false,
});

/**
 * Log startup information
 */
export const logStartup = (): void => {
    logger.info("=".repeat(60));
    logger.info("🤖 YesScale AI Telegram Bot Starting");
    logger.info("=".repeat(60));
    logger.info(`Environment: ${botConfig.environment}`);
    logger.info(`Log Level: ${botConfig.logLevel}`);
    logger.info(`Session Timeout: ${botConfig.session.timeout}ms`);
    logger.info(`Max History: ${botConfig.session.maxHistoryLength} messages`);
    logger.info(`Rate Limit: ${botConfig.rateLimit.messagesPerMinute} msg/min`);
    logger.info(`Redis Enabled: ${botConfig.redis.enabled}`);
    logger.info("=".repeat(60));
};

/**
 * Log user action
 */
export const logUserAction = (
    userId: number,
    username: string | undefined,
    action: string,
    details?: Record<string, unknown>
): void => {
    logger.info(`User Action: ${action}`, {
        userId,
        username: username || "unknown",
        action,
        ...details,
    });
};

/**
 * Log error with context
 */
export const logError = (
    error: Error,
    context: string,
    additionalInfo?: Record<string, unknown>
): void => {
    logger.error(`Error in ${context}:`, {
        error: error.message,
        stack: error.stack,
        context,
        ...additionalInfo,
    });
};

/**
 * Log API call
 */
export const logApiCall = (
    service: string,
    endpoint: string,
    duration: number,
    success: boolean
): void => {
    const level = success ? "info" : "warn";
    logger.log(level, `API Call: ${service} - ${endpoint}`, {
        service,
        endpoint,
        duration: `${duration}ms`,
        success,
    });
};

/**
 * Log session event
 */
export const logSession = (
    userId: number,
    event: "created" | "loaded" | "updated" | "expired" | "cleared",
    details?: Record<string, unknown>
): void => {
    logger.debug(`Session ${event}: User ${userId}`, {
        userId,
        event,
        ...details,
    });
};

/**
 * Log rate limit event
 */
export const logRateLimit = (
    userId: number,
    type: "message" | "image",
    count: number,
    limit: number
): void => {
    logger.warn(`Rate limit reached for user ${userId}`, {
        userId,
        type,
        count,
        limit,
    });
};

export default logger;
