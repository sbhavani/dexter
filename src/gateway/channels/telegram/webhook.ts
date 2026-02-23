import type { Server } from 'bun';
import type { TelegramUpdate } from './types.js';
import { transformUpdateToInbound } from './inbound.js';
import { sendTextMessage, sendTypingIndicator } from './outbound.js';
import { createUnsupportedMessageResponse, createAuthFailureResponse } from './inbound.js';
import type { TelegramAccountConfig, GatewayConfig } from '../../config.js';
import { resolveTelegramAccount } from '../../config.js';
import { handleTelegramInbound } from '../../gateway.js';

export interface TelegramWebhookConfig {
  botToken: string;
  webhookSecret?: string;
  webhookUrl?: string;
  port: number;
  accountId: string;
  account: TelegramAccountConfig;
  onMessage: (inbound: ReturnType<typeof transformUpdateToInbound>) => Promise<void>;
}

export interface TelegramWebhookServer {
  server: Server;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getUrl: () => string;
}

/**
 * Validate webhook secret token
 */
export function validateWebhookSecret(
  secret: string | undefined,
  providedSecret: string | undefined,
): boolean {
  if (!secret) {
    // No secret configured, allow all
    return true;
  }
  if (!providedSecret) {
    // Secret required but not provided
    return false;
  }
  return secret === providedSecret;
}

/**
 * Parse and validate incoming webhook request
 */
export function parseWebhookRequest(
  body: unknown,
): TelegramUpdate | null {
  // T012: Parse Telegram Update payload
  if (!body || typeof body !== 'object') {
    return null;
  }

  const update = body as Record<string, unknown>;

  // Must have update_id
  if (typeof update.update_id !== 'number') {
    return null;
  }

  // For now, only handle message updates
  if (update.message && typeof update.message === 'object') {
    const message = update.message as Record<string, unknown>;

    // Must have message_id and chat
    if (typeof message.message_id !== 'number') {
      return null;
    }
    if (!message.chat || typeof message.chat !== 'object') {
      return null;
    }

    const chat = message.chat as Record<string, unknown>;
    if (typeof chat.id !== 'number' || typeof chat.type !== 'string') {
      return null;
    }

    return body as TelegramUpdate;
  }

  return null;
}

/**
 * Handle incoming webhook request
 */
export async function handleWebhookRequest(
  update: TelegramUpdate,
  config: TelegramWebhookConfig,
): Promise<{ status: number; error?: string }> {
  try {
    // Transform to internal message format
    const inbound = transformUpdateToInbound(update, config.accountId);
    if (!inbound) {
      return { status: 200 }; // Acknowledge but don't process
    }

    // Send typing indicator while processing
    await sendTypingIndicator(config.botToken, inbound.chatId);

    // Handle unsupported message types (empty body but has message)
    if (!inbound.body.trim()) {
      const response = createUnsupportedMessageResponse();
      await sendTextMessage(config.botToken, inbound.chatId, response);
      return { status: 200 };
    }

    // Check authorization
    const isAuthorized = checkAuthorization(inbound, config.account);
    if (!isAuthorized) {
      const response = createAuthFailureResponse();
      await sendTextMessage(config.botToken, inbound.chatId, response);
      return { status: 200 };
    }

    // Return success - actual processing will be handled by the gateway
    return { status: 200 };

  } catch (error) {
    console.error('[telegram webhook] Error processing update:', error);
    return { status: 500, error: String(error) };
  }
}

/**
 * Check if sender is authorized
 */
function checkAuthorization(
  inbound: ReturnType<typeof transformUpdateToInbound>,
  account: TelegramAccountConfig,
): boolean {
  const { allowFrom, dmPolicy, groupPolicy } = account;
  const isGroup = inbound.chatType === 'group' || inbound.chatType === 'supergroup';
  const policy = isGroup ? groupPolicy : dmPolicy;

  if (policy === 'disabled') {
    return false;
  }

  if (policy === 'open' || allowFrom.includes('*')) {
    return true;
  }

  const senderIdStr = String(inbound.senderId);
  return allowFrom.includes(senderIdStr);
}

/**
 * Create HTTP response for webhook
 */
export function createWebhookResponse(
  status: number,
  error?: string,
): Response {
  if (status === 200) {
    return new Response('ok', { status: 200 });
  }
  if (status === 401) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (status === 400) {
    return new Response('Bad Request', { status: 400 });
  }
  return new Response(error || 'Internal Server Error', { status: 500 });
}

/**
 * Get the webhook URL for configuration
 */
export function getWebhookUrl(baseUrl: string, accountId: string): string {
  return `${baseUrl}/webhook/telegram/${accountId}`;
}

/**
 * Create and start the Telegram webhook HTTP server
 * This implements T010: webhook HTTP server
 */
export function createWebhookServer(config: TelegramWebhookConfig): TelegramWebhookServer {
  const { port, accountId, botToken, webhookSecret, account, onMessage } = config;

  let serverUrl = `http://localhost:${port}`;

  const server: Server = Bun.serve({
    port,
    fetch(req, server) {
      // Update server URL with actual port in case it was assigned
      serverUrl = `http://${server.hostname}:${server.port}`;

      const url = new URL(req.url);

      // T011: Validate webhook secret for all endpoints
      const authHeader = req.headers.get('x-telegram-bot-api-secret-token');
      if (!validateWebhookSecret(webhookSecret, authHeader)) {
        console.log(`[telegram webhook] Unauthorized request from ${req.headers.get('origin') || 'unknown'}`);
        return createWebhookResponse(401);
      }

      // Health check endpoint
      if (url.pathname === '/webhook/telegram/health' || url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok', channel: 'telegram', accountId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Main webhook endpoint - support /webhook/telegram and /webhook/telegram/:accountId
      const webhookPathMatch = url.pathname.match(/^\/webhook\/telegram(?:\/(.+))?$/);
      if (!webhookPathMatch) {
        return createWebhookResponse(404);
      }

      const pathAccountId = webhookPathMatch[1] || accountId;

      // Only accept POST requests
      if (req.method !== 'POST') {
        return createWebhookResponse(405); // Method Not Allowed
      }

      // T012: Parse Telegram Update payload
      return (async () => {
        try {
          const body = await req.json();
          const update = parseWebhookRequest(body);

          if (!update) {
            // T023: Invalid webhook payload - return 400
            console.log('[telegram webhook] Failed to parse update payload');
            return createWebhookResponse(400);
          }

          // Transform to internal message format
          const inbound = transformUpdateToInbound(update, pathAccountId);
          if (!inbound) {
            // Not a message we can process - acknowledge but don't process
            return createWebhookResponse(200);
          }

          // Send typing indicator while processing
          await sendTypingIndicator(botToken, inbound.chatId);

          // Handle unsupported message types (empty body but has message)
          if (!inbound.body.trim()) {
            const response = createUnsupportedMessageResponse();
            await sendTextMessage(botToken, inbound.chatId, response);
            return createWebhookResponse(200);
          }

          // Check authorization
          const isAuthorized = checkAuthorization(inbound, account);
          if (!isAuthorized) {
            const response = createAuthFailureResponse();
            await sendTextMessage(botToken, inbound.chatId, response);
            return createWebhookResponse(200);
          }

          // Call the message handler to process the message through the agent
          if (onMessage) {
            await onMessage(inbound);
          }

          return createWebhookResponse(200);
        } catch (error) {
          console.error('[telegram webhook] Error processing update:', error);
          return createWebhookResponse(500, String(error));
        }
      })();
    },
  });

  return {
    server,
    start: async () => {
      console.log(`[telegram] Webhook server listening on http://${server.hostname}:${server.port}`);
      console.log(`[telegram] Webhook URL: ${serverUrl}/webhook/telegram/${accountId}`);
    },
    stop: async () => {
      server.stop();
      console.log(`[telegram] Webhook server stopped`);
    },
    getUrl: () => serverUrl,
  };
}

/**
 * Telegram gateway service interface
 */
export interface TelegramGatewayService {
  stop: () => Promise<void>;
  getUrl: () => string;
}

/**
 * Start the Telegram gateway - runs the webhook server and processes messages
 * This is the main entry point for the gateway:telegram CLI command
 */
export async function startTelegramGateway(
  config: GatewayConfig,
  port: number = 8080,
): Promise<TelegramGatewayService> {
  const telegramConfig = config.channels.telegram;

  if (!telegramConfig.enabled) {
    console.log('[telegram] Telegram channel is not enabled in config');
    console.log('[telegram] Set channels.telegram.enabled to true in gateway.json');
    throw new Error('Telegram channel is not enabled');
  }

  if (!telegramConfig.botToken) {
    console.log('[telegram] Telegram bot token not configured');
    console.log('[telegram] Set channels.telegram.botToken in gateway.json');
    throw new Error('Telegram bot token not configured');
  }

  const accountId = config.gateway.accountId || 'default';
  const account = resolveTelegramAccount(config, accountId);

  console.log(`[telegram] Starting Telegram gateway for account: ${accountId}`);

  const server = createWebhookServer({
    botToken: telegramConfig.botToken,
    webhookSecret: telegramConfig.webhookSecret,
    port,
    accountId,
    account,
    onMessage: async (inbound) => {
      // Process the message through the gateway's handler (if inbound is valid)
      if (inbound) {
        await handleTelegramInbound(config, inbound);
      }
    },
  });

  await server.start();

  return {
    stop: async () => {
      await server.stop();
    },
    getUrl: () => server.getUrl(),
  };
}
