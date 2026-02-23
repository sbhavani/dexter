import type { GatewayConfig, TelegramAccountConfig } from '../../config.js';
import { listTelegramAccountIds, resolveTelegramAccount } from '../../config.js';
import type { ChannelPlugin } from '../types.js';
import type { TelegramInboundMessage } from './types.js';

export interface TelegramPluginParams {
  loadConfig: () => GatewayConfig;
  onMessage: (msg: TelegramInboundMessage) => Promise<void>;
}

/**
 * Create the Telegram channel plugin
 * This follows the same pattern as the WhatsApp plugin
 */
export function createTelegramPlugin(params: TelegramPluginParams): ChannelPlugin<GatewayConfig, TelegramAccountConfig> {
  return {
    id: 'telegram',
    config: {
      listAccountIds: (cfg) => listTelegramAccountIds(cfg),
      resolveAccount: (cfg, accountId) => resolveTelegramAccount(cfg, accountId),
      isEnabled: (account, cfg) => account.enabled && cfg.channels.telegram.enabled !== false,
      isConfigured: async (account, cfg) => {
        // Check if bot token is configured
        return Boolean(cfg.channels.telegram.botToken);
      },
    },
    gateway: {
      startAccount: async (ctx) => {
        const cfg = params.loadConfig();
        const { botToken, webhookSecret, webhookUrl } = cfg.channels.telegram;

        if (!botToken) {
          throw new Error('Telegram bot token not configured');
        }

        console.log(`[telegram] Starting Telegram channel for account: ${ctx.accountId}`);

        // The webhook server should be started separately
        // This function just validates configuration
        if (webhookUrl) {
          console.log(`[telegram] Webhook URL configured: ${webhookUrl}`);
        }

        // Set initial status
        ctx.setStatus({
          running: true,
          webhookConfigured: Boolean(webhookUrl),
        });
      },
      stopAccount: async (ctx) => {
        console.log(`[telegram] Stopping Telegram channel for account: ${ctx.accountId}`);
        ctx.setStatus({
          running: false,
        });
      },
    },
    status: {
      defaultRuntime: {
        accountId: 'default',
        running: false,
        webhookConfigured: false,
        lastError: null,
      },
    },
  };
}
