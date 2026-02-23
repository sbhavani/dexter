import type { TelegramAccountConfig } from '../../config.js';

// Telegram Update payload from webhook
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// Telegram Message object
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
}

// Telegram User
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

// Telegram Chat
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

// Telegram Message Entity (for commands, mentions, etc.)
export interface TelegramMessageEntity {
  type: 'bot_command' | 'mention' | 'hashtag' | 'url' | 'text_link';
  offset: number;
  length: number;
  url?: string;
}

// Telegram Callback Query
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

// Internal inbound message format
export interface TelegramInboundMessage {
  accountId: string;
  messageId: number;
  chatId: number;
  chatType: 'private' | 'group' | 'supergroup' | 'channel';
  senderId: number;
  senderName?: string;
  body: string;
  replyToJid: string; // format: `${chatId}`
}

// Telegram Bot API request/response types
export interface TelegramSendMessageRequest {
  chat_id: number | string;
  text: string;
  parse_mode?: 'MarkdownV2' | 'HTML';
  reply_to_message_id?: number;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramSendMessageResponse {
  ok: boolean;
  result?: TelegramMessage;
  error_code?: number;
  description?: string;
}

export interface TelegramSetWebhookRequest {
  url: string;
  secret_token?: string;
  certificate?: unknown;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface TelegramSetWebhookResponse {
  ok: boolean;
  result: boolean;
  description?: string;
}

export interface TelegramGetWebhookInfoResponse {
  ok: boolean;
  result?: TelegramWebhookInfo;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface TelegramChatActionRequest {
  chat_id: number | string;
  action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note';
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

// Channel runtime types
export type TelegramRuntimeSnapshot = {
  accountId: string;
  running: boolean;
  webhookConfigured: boolean;
  lastError?: string | null;
  lastStartAt?: number;
  lastStopAt?: number;
};

export type TelegramChannelContext = {
  accountId: string;
  account: TelegramAccountConfig;
  botToken: string;
  webhookSecret?: string;
  abortSignal: AbortSignal;
  getStatus: () => TelegramRuntimeSnapshot;
  setStatus: (next: Partial<TelegramRuntimeSnapshot>) => TelegramRuntimeSnapshot;
};

// Helper to format sender name
export function formatSenderName(user: TelegramUser): string {
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ');
  }
  return user.username || `User${user.id}`;
}

// Helper to format chat ID for reply
export function formatReplyJid(chat: TelegramChat): string {
  return String(chat.id);
}
