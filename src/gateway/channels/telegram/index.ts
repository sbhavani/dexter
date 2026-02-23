// Telegram channel exports
export * from './types.js';
export * from './inbound.js';
export * from './outbound.js';
export * from './webhook.js';
export * from './plugin.js';

// Re-export config types needed externally
export type { TelegramAccountConfig } from '../../config.js';
export { createTelegramPlugin } from './plugin.js';

// Re-export startup function
export { startTelegramGateway, type TelegramGatewayService } from './webhook.js';
