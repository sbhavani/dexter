import type { GatewayConfig, TelegramAccountConfig } from '../../config.js';
import { listTelegramAccountIds, resolveTelegramAccount } from '../../config.js';
import type { ChannelPlugin } from '../types.js';
import { monitorTelegramChannel, type TelegramInboundMessage } from './index.js';

export function createTelegramPlugin(params: {
  loadConfig: () => GatewayConfig;
  onMessage: (msg: TelegramInboundMessage) => Promise<void>;
}): ChannelPlugin<GatewayConfig, TelegramAccountConfig> {
  return {
    id: 'telegram',
    config: {
      listAccountIds: (cfg) => listTelegramAccountIds(cfg),
      resolveAccount: (cfg, accountId) => resolveTelegramAccount(cfg, accountId),
      isEnabled: (account, cfg) => account.enabled && cfg.channels.telegram.enabled !== false,
      isConfigured: async (account) => Boolean(account.botToken),
    },
    gateway: {
      startAccount: async (ctx) => {
        const cfg = params.loadConfig();
        const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
        const webhookPort = parseInt(process.env.TELEGRAM_WEBHOOK_PORT || '8080', 10);

        if (!webhookUrl) {
          throw new Error('TELEGRAM_WEBHOOK_URL environment variable is required');
        }

        await monitorTelegramChannel({
          accountId: ctx.accountId,
          botToken: ctx.account.botToken,
          webhookUrl,
          webhookPort,
          abortSignal: ctx.abortSignal,
          onMessage: params.onMessage,
          onStatus: (status) => {
            ctx.setStatus({
              running: status.running,
              connected: status.connected,
              lastError: status.lastError ?? null,
            });
          },
        });
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
