import type { IncomingMessage } from 'node:http';
import type { TelegramInboundMessage, TelegramUpdate, TelegramMessage } from './types.js';
import type { TelegramConfig } from './types.js';
import { sendMessageTelegram } from './outbound.js';

/**
 * Parse a Telegram Update from JSON
 */
export function parseTelegramUpdate(body: unknown): TelegramUpdate | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const update = body as Record<string, unknown>;

  if (typeof update.update_id !== 'number') {
    return null;
  }

  // Get the message - could be in different fields
  const message = (update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post) as Record<string, unknown> | undefined;

  if (!message || typeof message !== 'object') {
    return null;
  }

  return body as TelegramUpdate;
}

/**
 * Extract text content from a Telegram message
 */
function extractMessageText(message: TelegramMessage): string {
  if (message.text) {
    return message.text;
  }

  // Handle photo with caption
  if (message.photo && message.photo.length > 0) {
    // Photo messages might have caption in the photo array
    // For now, return empty string for photos without explicit text
    return '';
  }

  // Handle other media types
  if (message.voice) {
    return '[Voice message]';
  }

  if (message.sticker) {
    return '[Sticker]';
  }

  return '';
}

/**
 * Determine chat type from Telegram chat
 */
function getChatType(message: TelegramMessage): 'direct' | 'group' {
  const chat = message.chat;
  if (chat.type === 'private') {
    return 'direct';
  }
  return 'group';
}

/**
 * Check if a user is allowed to message the bot
 */
export function isUserAllowed(userId: string, allowedUsers: string[]): boolean {
  if (allowedUsers.includes('*')) {
    return true;
  }
  return allowedUsers.includes(userId);
}

/**
 * Create an inbound message from a Telegram update
 */
export function createTelegramInboundMessage(
  update: TelegramUpdate,
  accountId: string,
  botToken: string,
  allowedUsers: string[],
): TelegramInboundMessage | null {
  const message = update.message;
  if (!message) {
    return null;
  }

  const from = message.from;
  if (!from) {
    return null;
  }

  const userId = String(from.id);

  // Check allowFrom
  if (!isUserAllowed(userId, allowedUsers)) {
    console.log(`Telegram message from ${userId} not in allowFrom list`);
    return null;
  }

  const chatId = String(message.chat.id);
  const chatType = getChatType(message);
  const body = extractMessageText(message);

  // Skip empty messages
  if (!body) {
    console.log(`Telegram message from ${userId} has no text content`);
    return null;
  }

  const reply = async (text: string): Promise<void> => {
    await sendMessageTelegram(botToken, chatId, text);
  };

  return {
    messageId: String(message.message_id),
    accountId,
    chatId,
    chatType,
    from: userId,
    senderId: userId,
    senderName: from.first_name,
    body,
    timestamp: message.date,
    reply,
  };
}

/**
 * Handle incoming webhook request
 */
export async function handleTelegramWebhook(
  req: IncomingMessage,
  accountId: string,
  botToken: string,
  allowedUsers: string[],
  onMessage: (msg: TelegramInboundMessage) => Promise<void>,
): Promise<{ status: number; error?: string }> {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return { status: 405, error: 'Method not allowed' };
  }

  // Parse body
  let body: unknown;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return { status: 400, error: 'Invalid JSON' };
  }

  // Parse update
  const update = parseTelegramUpdate(body);
  if (!update) {
    return { status: 400, error: 'Invalid Telegram update' };
  }

  // Create inbound message
  const inbound = createTelegramInboundMessage(update, accountId, botToken, allowedUsers);
  if (!inbound) {
    return { status: 200 }; // Return 200 even if we skip the message
  }

  // Process message
  try {
    await onMessage(inbound);
    return { status: 200 };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Error processing Telegram message: ${error}`);
    return { status: 500, error };
  }
}
