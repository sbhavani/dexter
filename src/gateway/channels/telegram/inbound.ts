import type {
  TelegramUpdate,
  TelegramInboundMessage,
  TelegramMessage,
} from './types.js';
import { formatSenderName, formatReplyJid } from './types.js';
import type { TelegramAccountConfig } from '../../config.js';

/**
 * Transform a Telegram Update to an internal inbound message
 * Returns null if the update should be ignored
 */
export function transformUpdateToInbound(
  update: TelegramUpdate,
  accountId: string,
): TelegramInboundMessage | null {
  // Only handle message updates (not edited messages or callbacks for now)
  const message = update.message;
  if (!message) {
    return null;
  }

  // Transform to internal format
  return {
    accountId,
    messageId: message.message_id,
    chatId: message.chat.id,
    chatType: message.chat.type,
    senderId: message.from?.id ?? 0,
    senderName: message.from ? formatSenderName(message.from) : undefined,
    body: message.text || '',
    replyToJid: formatReplyJid(message.chat),
  };
}

/**
 * Check if the sender is allowed to interact with the bot
 */
export function isSenderAllowed(
  senderId: number,
  senderName: string | undefined,
  account: TelegramAccountConfig,
  chatType: 'private' | 'group' | 'supergroup' | 'channel',
): boolean {
  const { allowFrom, dmPolicy, groupPolicy } = account;

  // Allow all if wildcard
  if (allowFrom.includes('*')) {
    return true;
  }

  // Check based on chat type
  const isGroup = chatType === 'group' || chatType === 'supergroup';
  const policy = isGroup ? groupPolicy : dmPolicy;

  switch (policy) {
    case 'open':
      return true;
    case 'disabled':
      return false;
    case 'allowlist':
    case 'pairing':
      // Check if sender ID or name is in allowlist
      const senderIdStr = String(senderId);
      return allowFrom.includes(senderIdStr) ||
             allowFrom.some(allowed => senderName && senderName.includes(allowed));
    default:
      return false;
  }
}

/**
 * Check if the message should be processed
 * Returns an error message if the message should be rejected, null if it should be processed
 */
export function shouldProcessMessage(
  inbound: TelegramInboundMessage,
  account: TelegramAccountConfig,
): string | null {
  // T028: Ignore empty/whitespace messages
  if (!inbound.body.trim()) {
    return null; // Ignore silently
  }

  // Check access control
  if (!isSenderAllowed(inbound.senderId, inbound.senderName, account, inbound.chatType)) {
    return 'Sorry, you are not authorized to use this bot.';
  }

  // T015: Handle message type filtering (text only)
  // Non-text messages will have empty body, so we handle this by checking
  // if the message has content - for now, only text messages are supported

  return null;
}

/**
 * Create a rejection response for unsupported message types
 */
export function createUnsupportedMessageResponse(): string {
  return 'I can only process text messages. Please send your request as text.';
}

/**
 * Create an authorization failure response
 */
export function createAuthFailureResponse(): string {
  return 'Sorry, you are not authorized to use this bot. Please contact the bot administrator.';
}

/**
 * Create a rate limit response
 */
export function createRateLimitResponse(): string {
  return 'Too many requests. Please wait a moment and try again.';
}

/**
 * Create a timeout response
 */
export function createTimeoutResponse(): string {
  return 'The request took too long to process. Please try again.';
}

/**
 * Create a generic error response
 */
export function createErrorResponse(): string {
  return 'An error occurred while processing your request. Please try again later.';
}
