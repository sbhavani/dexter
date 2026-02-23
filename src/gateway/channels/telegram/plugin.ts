import * as http from 'node:http';
import type { GatewayConfig, TelegramAccountConfig } from '../../config.js';
import { listTelegramAccountIds, resolveTelegramAccount } from '../../config.js';
import type { ChannelPlugin } from '../types.js';
import { handleTelegramWebhook, type TelegramInboundMessage } from './inbound.js';

export function createTelegramPlugin(params: {
  loadConfig: () => GatewayConfig;
  onMessage: (msg: TelegramInboundMessage) => Promise<void>;
  httpServer?: http.Server;
}): ChannelPlugin<GatewayConfig, TelegramAccountConfig> {
  return {
    id: 'telegram',
    config: {
      listAccountIds: (cfg) => listTelegramAccountIds(cfg),
      resolveAccount: (cfg, accountId) => resolveTelegramAccount(cfg, accountId),
      isEnabled: (account, cfg) => account.enabled && cfg.channels.telegram?.enabled !== false,
      isConfigured: async (account) => Boolean(account.botToken),
    },
    gateway: {
      startAccount: async (ctx) => {
        const cfg = params.loadConfig();
        const account = resolveTelegramAccount(cfg, ctx.accountId);

        if (!account.botToken) {
          ctx.setStatus({ lastError: 'No bot token configured' });
          return;
        }

        // Start HTTP server if not already running
        const server = params.httpServer ?? startHttpServer(cfg, params.onMessage);

        // Start listening on port
        const port = process.env.TELEGRAM_WEBHOOK_PORT ?? 3000;
        await new Promise<void>((resolve) => {
          server.listen(port, () => {
            console.log(`Telegram webhook server listening on port ${port}`);
            resolve();
          });
        });

        ctx.setStatus({ connected: true });
        console.log(`Telegram bot for account ${ctx.accountId} ready`);
        console.log(`Webhook endpoint: http://localhost:${port}${account.webhookPath}`);
      },
    },
    status: {
      defaultRuntime: {
        accountId: 'default',
        running: false,
        connected: false,
        lastError: null,
      },
    },
  };
}

function startHttpServer(
  cfg: GatewayConfig,
  onMessage: (msg: TelegramInboundMessage) => Promise<void>,
): http.Server {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Find matching account and handle webhook
    const telegramAccounts = cfg.channels.telegram?.accounts ?? {};
    const webhookPath = cfg.channels.telegram?.accounts?.default?.webhookPath ?? '/webhooks/telegram';

    if (req.url === webhookPath) {
      // Get the bot token from Authorization header
      const authHeader = req.headers.authorization ?? '';
      const token = authHeader.replace('Bearer ', '');

      // Find account with matching token
      let matchedAccount: TelegramAccountConfig | null = null;
      for (const [accountId, account] of Object.entries(telegramAccounts)) {
        if (account.botToken === token) {
          matchedAccount = { accountId, ...account } as TelegramAccountConfig;
          break;
        }
      }

      if (!matchedAccount) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const allowedUsers = matchedAccount.allowFrom ?? ['*'];

      try {
        const result = await handleTelegramWebhook(
          req,
          matchedAccount.accountId,
          matchedAccount.botToken,
          allowedUsers,
          onMessage,
        );
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        if (result.error) {
          res.end(JSON.stringify({ error: result.error }));
        } else {
          res.end(JSON.stringify({ ok: true }));
        }
      } catch (err) {
        console.error('Webhook error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  return server;
}
