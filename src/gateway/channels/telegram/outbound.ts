import { logger } from '../../../utils/logger.js';
import type {
  TelegramSendMessageRequest,
  TelegramSendMessageResponse,
  TelegramChatActionRequest,
} from './types.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

// Configuration for retry logic
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 5000;

/**
 * Extract retry-after duration from rate limit response
 */
function getRetryAfter(response: TelegramSendMessageResponse): number | undefined {
  const match = response.description?.match(/retry after (\d+)/i);
  if (match) {
    return parseInt(match[1], 10) * 1000; // Convert to milliseconds
  }
  return undefined;
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a message to a Telegram chat with retry logic for rate limits
 */
export async function sendMessageTelegram(
  botToken: string,
  request: TelegramSendMessageRequest,
  retries: number = MAX_RETRIES,
): Promise<TelegramSendMessageResponse> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
  let lastError: TelegramSendMessageResponse | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json() as TelegramSendMessageResponse;

    // Success - return immediately
    if (result.ok) {
      return result;
    }

    lastError = result;

    // Check if it's a rate limit error
    if (isRateLimitError(result)) {
      // Get retry-after from response if available
      const retryAfter = getRetryAfter(result);
      const waitTime = retryAfter || backoffMs;

      logger.warn(
        `Telegram rate limit hit (attempt ${attempt + 1}/${retries + 1}). ` +
        `Waiting ${waitTime}ms before retry. Error: ${getErrorMessage(result)}`
      );

      // If we have a retry-after from Telegram, use it; otherwise use exponential backoff
      if (retryAfter) {
        await sleep(retryAfter);
      } else if (attempt < retries) {
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      }
      continue;
    }

    // Non-rate-limit error - log and return immediately (no retry)
    logger.error(
      `Telegram API error: ${getErrorMessage(result)} (code: ${result.error_code})`
    );
    return result;
  }

  // All retries exhausted
  logger.error(
    `Telegram API failed after ${retries + 1} attempts. Last error: ${getErrorMessage(lastError!)}`
  );
  return lastError!;
}

/**
 * Send a text message to a chat
 */
export async function sendTextMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyToMessageId?: number,
): Promise<TelegramSendMessageResponse> {
  // T017: Clean markdown for Telegram format
  const cleanedText = cleanMarkdownForTelegram(text);

  return sendMessageTelegram(botToken, {
    chat_id: chatId,
    text: cleanedText,
    parse_mode: 'MarkdownV2',
    reply_to_message_id: replyToMessageId,
  });
}

/**
 * Send a typing indicator to a chat (with rate limit handling)
 * Note: typing indicators are best-effort, so we don't retry aggressively
 */
export async function sendTypingIndicator(
  botToken: string,
  chatId: number | string,
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendChatAction`;

  const request: TelegramChatActionRequest = {
    chat_id: chatId,
    action: 'typing',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json() as TelegramSendMessageResponse;

    if (!result.ok && isRateLimitError(result)) {
      // Silently skip typing indicator on rate limit - not critical
      logger.debug(
        `Telegram typing indicator rate limited, skipping. Error: ${getErrorMessage(result)}`
      );
    }
  } catch (error) {
    // Silently fail for typing indicators - not critical
    logger.debug(`Telegram typing indicator failed: ${error}`);
  }
}

/**
 * T017: Clean markdown for Telegram format
 * Telegram uses MarkdownV2 which has specific escape requirements
 */
export function cleanMarkdownForTelegram(text: string): string {
  let result = text;

  // Escape special characters for MarkdownV2
  // These characters have special meaning: . ! ( ) - + _ { } [ ] # * ~ ` > = | :
  const specialChars = ['.', '!', '(', ')', '-', '+', '_', '{', '}', '[', ']', '#', '*', '~', '`', '>', '=', '|', ':'];

  for (const char of specialChars) {
    // Escape if not already escaped (simple approach)
    // This is a basic implementation - real-world usage might need more sophisticated handling
    result = result.split(char).join(`\\${char}`);
  }

  // Convert common markdown to Telegram format
  // **bold** -> *bold*
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  // *italic* -> _italic_
  result = result.replace(/\*([^*]+)\*/g, '_$1_');
  // `code` -> `code` (keep)
  // ```code``` -> ```code``` (keep)

  // Handle URLs that might contain special chars
  // This is a simplified approach

  // Limit message length (Telegram max is 4096 characters)
  if (result.length > 4000) {
    result = result.slice(0, 4000) + '...\n\n(Message truncated)';
  }

  return result;
}

/**
 * Check if the error is a rate limit error
 */
export function isRateLimitError(response: TelegramSendMessageResponse): boolean {
  return !response.ok &&
    (response.error_code === 429 ||
     response.description?.includes('Too Many Requests') ||
     response.description?.includes('rate'));
}

/**
 * Extract error message from Telegram response
 */
export function getErrorMessage(response: TelegramSendMessageResponse): string {
  if (response.ok) {
    return '';
  }
  return response.description || `Error code: ${response.error_code}`;
}
