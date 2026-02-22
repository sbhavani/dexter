const TELEGRAM_API_BASE = 'https://api.telegram.org';

interface SendMessageParams {
  chatId: number | string;
  text: string;
  parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
  replyToMessageId?: number;
  disableWebPagePreview?: boolean;
}

interface SendMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
    };
    text: string;
  };
  description?: string;
}

interface SendChatActionParams {
  chatId: number | string;
  action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_audio' | 'upload_audio' | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note';
}

interface SendChatActionResponse {
  ok: boolean;
  result?: boolean;
  description?: string;
}

async function telegramRequest<T>(botToken: string, method: string, body?: object): Promise<T> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export async function sendMessageTelegram(params: SendMessageParams & { botToken: string }): Promise<number> {
  const { botToken, chatId, text, parseMode, replyToMessageId, disableWebPagePreview } = params;

  const response = await telegramRequest<SendMessageResponse>(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    reply_to_message_id: replyToMessageId,
    disable_web_page_preview: disableWebPagePreview,
  });

  if (!response.ok || !response.result) {
    throw new Error(`Failed to send message: ${response.description}`);
  }

  return response.result.message_id;
}

export async function sendChatAction(params: SendChatActionParams & { botToken: string }): Promise<void> {
  const { botToken, chatId, action } = params;

  const response = await telegramRequest<SendChatActionResponse>(botToken, 'sendChatAction', {
    chat_id: chatId,
    action,
  });

  if (!response.ok) {
    throw new Error(`Failed to send chat action: ${response.description}`);
  }
}

export async function getMe(botToken: string): Promise<{ id: number; first_name: string; username: string }> {
  const response = await telegramRequest<{ ok: boolean; result: { id: number; first_name: string; username: string } }>(botToken, 'getMe');

  if (!response.ok || !response.result) {
    throw new Error('Failed to get bot info');
  }

  return response.result;
}

export async function setWebhook(botToken: string, url: string): Promise<boolean> {
  const response = await telegramRequest<{ ok: boolean; result: boolean; description?: string }>(botToken, 'setWebhook', {
    url,
  });

  if (!response.ok) {
    throw new Error(`Failed to set webhook: ${response.description}`);
  }

  return response.result;
}

export async function deleteWebhook(botToken: string): Promise<boolean> {
  const response = await telegramRequest<{ ok: boolean; result: boolean; description?: string }>(botToken, 'deleteWebhook');

  if (!response.ok) {
    throw new Error(`Failed to delete webhook: ${response.description}`);
  }

  return response.result;
}

export async function getWebhookInfo(botToken: string): Promise<{ url: string; has_custom_certificate: boolean; pending_update_count: number }> {
  const response = await telegramRequest<{ ok: boolean; result: { url: string; has_custom_certificate: boolean; pending_update_count: number } }>(botToken, 'getWebhookInfo');

  if (!response.ok || !response.result) {
    throw new Error('Failed to get webhook info');
  }

  return response.result;
}
