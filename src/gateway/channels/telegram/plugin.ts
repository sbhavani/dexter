import type { GatewayConfig, TelegramAccountConfig } from '../../config.js';
import { listTelegramAccountIds, resolveTelegramAccount } from '../../config.js';
import type { ChannelPlugin } from '../types.js';
import { startTelegramChannel, type TelegramInboundMessage } from './index.js';

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
        await startTelegramChannel({
          accountId: ctx.accountId,
          botToken: ctx.account.botToken,
          allowFrom: ctx.account.allowFrom,
          allowGroups: ctx.account.allowGroups,
          abortSignal: ctx.abortSignal,
          heartbeatSeconds: params.loadConfig().gateway.heartbeatSeconds,
          onMessage: params.onMessage,
          onStatus: (status) => {
            ctx.setStatus({
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
