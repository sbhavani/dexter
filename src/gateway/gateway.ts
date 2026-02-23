import { createChannelManager } from './channels/manager.js';
import { createWhatsAppPlugin } from './channels/whatsapp/plugin.js';
import {
  assertOutboundAllowed,
  sendComposing,
  sendMessageWhatsApp,
  type WhatsAppInboundMessage,
} from './channels/whatsapp/index.js';
import { resolveRoute } from './routing/resolve-route.js';
import { resolveSessionStorePath, upsertSessionMeta } from './sessions/store.js';
import { loadGatewayConfig, type GatewayConfig } from './config.js';
import { runAgentForMessage } from './agent-runner.js';
import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sendTextMessage, cleanMarkdownForTelegram, sendTypingIndicator } from './channels/telegram/outbound.js';
import { shouldProcessMessage, createUnsupportedMessageResponse, createErrorResponse, createTimeoutResponse } from './channels/telegram/inbound.js';
import type { TelegramInboundMessage } from './channels/telegram/types.js';

const LOG_PATH = join(homedir(), '.dexter', 'gateway-debug.log');
function debugLog(msg: string) {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
}

export type GatewayService = {
  stop: () => Promise<void>;
  snapshot: () => Record<string, { accountId: string; running: boolean; connected?: boolean }>;
};

function elide(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Clean up markdown for WhatsApp compatibility.
 * - Converts `**text**` (markdown bold) to `*text*` (WhatsApp bold)
 * - Merges adjacent bold sections to prevent literal asterisks showing
 */
function cleanMarkdownForWhatsApp(text: string): string {
  let result = text;
  // Convert markdown bold (**text**) to WhatsApp bold (*text*)
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  // Merge adjacent bold sections: `*foo* *bar*` -> `*foo bar*`
  result = result.replace(/\*([^*]+)\*\s+\*([^*]+)\*/g, '*$1 $2*');
  return result;
}

async function handleInbound(cfg: GatewayConfig, inbound: WhatsAppInboundMessage): Promise<void> {
  const bodyPreview = elide(inbound.body.replace(/\n/g, ' '), 50);
  console.log(`Inbound message ${inbound.from} (${inbound.chatType}, ${inbound.body.length} chars): "${bodyPreview}"`);
  debugLog(`[gateway] handleInbound from=${inbound.from} body="${inbound.body.slice(0, 30)}..."`);
  
  const route = resolveRoute({
    cfg,
    channel: 'whatsapp',
    accountId: inbound.accountId,
    peer: { kind: inbound.chatType, id: inbound.senderId },
  });

  const storePath = resolveSessionStorePath(route.agentId);
  upsertSessionMeta({
    storePath,
    sessionKey: route.sessionKey,
    channel: 'whatsapp',
    to: inbound.from,
    accountId: route.accountId,
    agentId: route.agentId,
  });

  // Start typing indicator loop to keep it alive during long agent runs
  const TYPING_INTERVAL_MS = 5000; // Refresh every 5 seconds
  let typingTimer: ReturnType<typeof setInterval> | undefined;
  
  const startTypingLoop = async () => {
    await sendComposing({ to: inbound.replyToJid, accountId: inbound.accountId });
    typingTimer = setInterval(() => {
      void sendComposing({ to: inbound.replyToJid, accountId: inbound.accountId });
    }, TYPING_INTERVAL_MS);
  };
  
  const stopTypingLoop = () => {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = undefined;
    }
  };

  try {
    // Defense-in-depth: verify outbound destination is allowed before any messaging
    try {
      assertOutboundAllowed({ to: inbound.replyToJid, accountId: inbound.accountId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      debugLog(`[gateway] outbound BLOCKED: ${msg}`);
      console.log(msg);
      return;
    }

    await startTypingLoop();
    console.log(`Processing message with agent...`);
    debugLog(`[gateway] running agent for session=${route.sessionKey}`);
    const startedAt = Date.now();
    const answer = await runAgentForMessage({
      sessionKey: route.sessionKey,
      query: inbound.body,
      model: 'gpt-5.2',
      modelProvider: 'openai',
    });
    const durationMs = Date.now() - startedAt;
    debugLog(`[gateway] agent answer length=${answer.length}`);
    
    // Stop typing loop before sending reply
    stopTypingLoop();

    if (answer.trim()) {
      // Clean up markdown for WhatsApp and reply
      const cleanedAnswer = cleanMarkdownForWhatsApp(answer);
      debugLog(`[gateway] sending reply to ${inbound.replyToJid}`);
      await sendMessageWhatsApp({
        to: inbound.replyToJid,
        body: `[Dexter] ${cleanedAnswer}`,
        accountId: inbound.accountId,
      });
      console.log(`Sent reply (${answer.length} chars, ${durationMs}ms)`);
      debugLog(`[gateway] reply sent`);
    } else {
      console.log(`Agent returned empty response (${durationMs}ms)`);
      debugLog(`[gateway] empty answer, not sending`);
    }
  } catch (err) {
    stopTypingLoop();
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`Error: ${msg}`);
    debugLog(`[gateway] ERROR: ${msg}`);
  }
}

// T026: Conversation locking - track active conversations per chat
const activeConversations = new Map<string, Promise<void>>();

async function handleTelegramInbound(cfg: GatewayConfig, inbound: TelegramInboundMessage): Promise<void> {
  const conversationKey = `telegram:${inbound.chatId}:${inbound.senderId}`;

  // T026: Check if there's already an active conversation for this user
  const existingConversation = activeConversations.get(conversationKey);
  if (existingConversation) {
    console.log(`[telegram] Conversation already active for ${conversationKey}, ignoring message`);
    debugLog(`[gateway:telegram] blocked concurrent request for ${conversationKey}`);
    return;
  }

  // Get bot token from config
  const botToken = cfg.channels.telegram?.botToken;
  if (!botToken) {
    console.log('[telegram] Bot token not configured');
    await sendTextMessage(inbound.chatId, 'Bot configuration error. Please contact the administrator.');
    return;
  }

  // Check if message should be processed
  const account = cfg.channels.telegram?.accounts?.[inbound.accountId] || {
    accountId: inbound.accountId,
    enabled: true,
    allowFrom: cfg.channels.telegram?.allowFrom || [],
    dmPolicy: 'allowlist',
    groupPolicy: 'allowlist',
  };

  const rejectionReason = shouldProcessMessage(inbound, account);
  if (rejectionReason) {
    await sendTextMessage(inbound.chatId, rejectionReason);
    return;
  }

  const bodyPreview = elide(inbound.body.replace(/\n/g, ' '), 50);
  console.log(`[telegram] Inbound message from ${inbound.senderName || inbound.senderId} (${inbound.chatType}): "${bodyPreview}"`);
  debugLog(`[gateway:telegram] handleInbound from=${inbound.senderId} body="${inbound.body.slice(0, 30)}..."`);

  const route = resolveRoute({
    cfg,
    channel: 'telegram',
    accountId: inbound.accountId,
    peer: { kind: inbound.chatType, id: String(inbound.senderId) },
  });

  const storePath = resolveSessionStorePath(route.agentId);
  upsertSessionMeta({
    storePath,
    sessionKey: route.sessionKey,
    channel: 'telegram',
    to: String(inbound.senderId),
    accountId: route.accountId,
    agentId: route.agentId,
  });

  // T022: Start typing indicator
  const TYPING_INTERVAL_MS = 5000;
  let typingTimer: ReturnType<typeof setInterval> | undefined;

  const startTypingLoop = async () => {
    await sendTypingIndicator(botToken, inbound.chatId);
    typingTimer = setInterval(async () => {
      await sendTypingIndicator(botToken, inbound.chatId);
    }, TYPING_INTERVAL_MS);
  };

  const stopTypingLoop = () => {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = undefined;
    }
  };

  // T026: Register this conversation as active
  const conversationPromise = (async () => {
    try {
      await startTypingLoop();
      console.log(`[telegram] Processing message with agent...`);
      debugLog(`[gateway:telegram] running agent for session=${route.sessionKey}`);

      const startedAt = Date.now();

      // T027: Handle timeout
      const AGENT_TIMEOUT_MS = 120000; // 2 minutes

      const answer = await Promise.race([
        runAgentForMessage({
          sessionKey: route.sessionKey,
          query: inbound.body,
          model: 'gpt-5.2',
          modelProvider: 'openai',
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), AGENT_TIMEOUT_MS)
        ),
      ]);

      const durationMs = Date.now() - startedAt;
      debugLog(`[gateway:telegram] agent answer length=${answer.length}`);

      stopTypingLoop();

      if (answer.trim()) {
        // Clean up markdown for Telegram
        const cleanedAnswer = cleanMarkdownForTelegram(answer);
        debugLog(`[gateway:telegram] sending reply to ${inbound.chatId}`);
        await sendTextMessage(botToken, inbound.chatId, cleanedAnswer);
        console.log(`[telegram] Sent reply (${answer.length} chars, ${durationMs}ms)`);
        debugLog(`[gateway:telegram] reply sent`);
      } else {
        console.log(`[telegram] Agent returned empty response (${durationMs}ms)`);
        debugLog(`[gateway:telegram] empty answer, not sending`);
      }
    } catch (err) {
      stopTypingLoop();
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[telegram] Error: ${msg}`);
      debugLog(`[gateway:telegram] ERROR: ${msg}`);

      // T025: Handle agent processing failures
      let errorMessage = createErrorResponse();
      if (msg.includes('Timeout') || msg.includes('timeout')) {
        errorMessage = createTimeoutResponse();
      }

      await sendTextMessage(botToken, inbound.chatId, errorMessage);
    } finally {
      // T026: Remove from active conversations
      activeConversations.delete(conversationKey);
    }
  })();

  // Register the conversation
  activeConversations.set(conversationKey, conversationPromise);

  // Wait for the conversation to complete (we don't await here to not block)
  // The conversation will remove itself from the map when done
}

export async function startGateway(params: { configPath?: string } = {}): Promise<GatewayService> {
  const cfg = loadGatewayConfig(params.configPath);
  const plugin = createWhatsAppPlugin({
    loadConfig: () => loadGatewayConfig(params.configPath),
    onMessage: async (inbound) => {
      const current = loadGatewayConfig(params.configPath);
      await handleInbound(current, inbound);
    },
  });
  const manager = createChannelManager({
    plugin,
    loadConfig: () => loadGatewayConfig(params.configPath),
  });
  await manager.startAll();

  return {
    stop: async () => {
      await manager.stopAll();
    },
    snapshot: () => manager.getSnapshot(),
  };
}

// Export handler for Telegram webhook to use
export { handleTelegramInbound };

// Function to process Telegram inbound message (called from webhook)
export async function processTelegramInbound(
  inbound: TelegramInboundMessage,
  configPath?: string,
): Promise<void> {
  const cfg = loadGatewayConfig(configPath);
  await handleTelegramInbound(cfg, inbound);
}

