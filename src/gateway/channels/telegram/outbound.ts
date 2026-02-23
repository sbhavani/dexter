const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * Send a text message to a Telegram chat
 */
export async function sendMessageTelegram(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${error}`);
  }
}

/**
 * Send a typing indicator to a Telegram chat
 */
export async function sendChatAction(
  botToken: string,
  chatId: string,
  action: 'typing' | 'upload_photo' | 'record_video' | 'upload_document' | 'find_location' = 'typing',
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}${botToken}/sendChatAction`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      action,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${error}`);
  }
}

/**
 * Set the webhook for a Telegram bot
 */
export async function setWebhook(
  botToken: string,
  webhookUrl: string,
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}${botToken}/setWebhook`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${error}`);
  }
}

/**
 * Get bot info to validate the token
 */
export async function getMe(botToken: string): Promise<{ id: number; first_name: string; username?: string } | null> {
  const url = `${TELEGRAM_API_BASE}${botToken}/getMe`;

  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { ok: boolean; result?: { id: number; first_name: string; username?: string } };

  if (!data.ok || !data.result) {
    return null;
  }

  return data.result;
}
