import { type TelegramInboundMessage, type TelegramRuntimeStatus } from './types.js';
import { getMe, setWebhook, deleteWebhook, sendMessageTelegram, sendChatAction } from './outbound.js';

interface MonitorTelegramChannelParams {
  accountId: string;
  botToken: string;
  webhookUrl: string;
  webhookPort?: number;
  abortSignal: AbortSignal;
  onMessage: (msg: TelegramInboundMessage) => Promise<void>;
  onStatus: (status: TelegramRuntimeStatus) => void;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
      title?: string;
    };
    text?: string;
    date: number;
  };
  edited_message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
    };
    text: string;
    edit_date: number;
  };
}

interface TelegramWebhookRequest {
  method?: string;
}

let server: any = null;

export async function monitorTelegramChannel(params: MonitorTelegramChannelParams): Promise<void> {
  const { accountId, botToken, webhookUrl, webhookPort = 8080, abortSignal, onMessage, onStatus } = params;

  let shuttingDown = false;

  const cleanup = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    try {
      await deleteWebhook(botToken);
    } catch (e) {
      console.error('Failed to delete webhook:', e);
    }

    if (server) {
      server.close();
      server = null;
    }

    onStatus({
      running: false,
      connected: false,
    });
  };

  abortSignal.addEventListener('abort', () => {
    cleanup().catch(console.error);
  });

  try {
    // Verify bot token and get bot info
    const botInfo = await getMe(botToken);
    console.log(`Telegram bot logged in as: @${botInfo.username} (ID: ${botInfo.id})`);

    onStatus({
      running: true,
      connected: true,
    });

    // Set up webhook
    const fullWebhookUrl = `${webhookUrl}/telegram/${accountId}`;
    console.log(`Setting Telegram webhook to: ${fullWebhookUrl}`);

    try {
      await setWebhook(botToken, fullWebhookUrl);
    } catch (e) {
      console.error('Failed to set webhook, falling back to polling:', e);
      // Fall back to polling mode if webhook fails
    }

    // Create HTTP server for webhook
    const http = await import('node:http');

    const contentType = params.webhookUrl.startsWith('https') ? 'application/json' : 'application/json';

    server = http.createServer(async (req: any, res: any) => {
      if (req.method === 'POST' && req.url.startsWith(`/telegram/${accountId}`)) {
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const update: TelegramUpdate = JSON.parse(body);

            if (update.message && update.message.text) {
              const msg = update.message;
              const chatType = msg.chat.type === 'private' ? 'direct' :
                msg.chat.type === 'group' ? 'group' : 'supergroup';

              const telegramMessage: TelegramInboundMessage = {
                id: String(msg.message_id),
                accountId,
                chatId: msg.chat.id,
                chatType,
                from: msg.from?.id ?? msg.chat.id,
                senderName: msg.from?.first_name || msg.from?.username,
                body: msg.text,
                timestamp: msg.date,
                reply: async (text: string) => {
                  await sendMessageTelegram({
                    botToken,
                    chatId: msg.chat.id,
                    text,
                    parseMode: 'MarkdownV2',
                    replyToMessageId: msg.message_id,
                  });
                },
              };

              // Send typing action
              sendChatAction({ botToken, chatId: msg.chat.id, action: 'typing' }).catch(console.error);

              // Process message
              await onMessage(telegramMessage);
            }

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            console.error('Error processing Telegram update:', e);
            res.writeHead(500, { 'Content-Type': contentType });
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      } else {
        res.writeHead(404, { 'Content-Type': contentType });
        res.end(JSON.stringify({ ok: false, error: 'Not found' }));
      }
    });

    server.listen(webhookPort, () => {
      console.log(`Telegram webhook server listening on port ${webhookPort}`);
    });

    // Wait for abort signal
    await new Promise<void>((resolve) => {
      abortSignal.addEventListener('abort', () => {
        resolve();
      });
    });

    await cleanup();
  } catch (error) {
    onStatus({
      running: false,
      connected: false,
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function stopTelegramChannel(): Promise<void> {
  if (server) {
    server.close();
    server = null;
  }
}
