import { createChannelManager } from './channels/manager.js';
import { createWhatsAppPlugin } from './channels/whatsapp/plugin.js';
import { createTelegramPlugin } from './channels/telegram/plugin.js';
import {
  assertOutboundAllowed,
  sendComposing,
  sendMessageWhatsApp,
  type WhatsAppInboundMessage,
} from './channels/whatsapp/index.js';
import type { TelegramInboundMessage } from './channels/telegram/types.js';
import { resolveRoute } from './routing/resolve-route.js';
import { resolveSessionStorePath, upsertSessionMeta } from './sessions/store.js';
import { loadGatewayConfig, type GatewayConfig } from './config.js';
import { runAgentForMessage } from './agent-runner.js';
import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

/**
 * Clean up markdown for Telegram compatibility.
 * - Converts `**text**` (markdown bold) to `*text*` (Telegram bold)
 * - Converts `*text*` (markdown italic) to `_text_` (Telegram italic)
 * - Converts `__text__` to `__text__` (Telegram underline)
 * - Converts `~~text~~` to `~text~` (Telegram strikethrough)
 * - Converts ```code``` to ```code``` (Telegram code block)
 */
function cleanMarkdownForTelegram(text: string): string {
  let result = text;
  // Convert markdown bold (**text**) to Telegram bold (*text*)
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  // Convert markdown italic (*text*) to Telegram italic (_text_)
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '_$1_');
  // Convert markdown underline (__text__) to Telegram underline (__text__)
  result = result.replace(/__([^_]+)__/g, '__$1__');
  // Convert markdown strikethrough (~~text~~) to Telegram strikethrough (~text~)
  result = result.replace(/~~([^~]+)~~/g, '~$1~');
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

async function handleTelegramInbound(cfg: GatewayConfig, inbound: TelegramInboundMessage): Promise<void> {
  const bodyPreview = elide(inbound.body.replace(/\n/g, ' '), 50);
  const senderId = String(inbound.from);
  console.log(`Telegram inbound from ${senderId} (${inbound.chatType}, ${inbound.body.length} chars): "${bodyPreview}"`);
  debugLog(`[gateway] handleTelegramInbound from=${senderId} body="${inbound.body.slice(0, 30)}..."`);

  const route = resolveRoute({
    cfg,
    channel: 'telegram',
    accountId: inbound.accountId,
    peer: { kind: inbound.chatType === 'direct' ? 'direct' : 'group', id: senderId },
  });

  const storePath = resolveSessionStorePath(route.agentId);
  upsertSessionMeta({
    storePath,
    sessionKey: route.sessionKey,
    channel: 'telegram',
    to: senderId,
    accountId: route.accountId,
    agentId: route.agentId,
  });

  // Start typing indicator
  const TYPING_INTERVAL_MS = 5000;
  let typingTimer: ReturnType<typeof setInterval> | undefined;

  const startTypingLoop = async () => {
    await inbound.sendChatAction('typing');
    typingTimer = setInterval(async () => {
      await inbound.sendChatAction('typing');
    }, TYPING_INTERVAL_MS);
  };

  const stopTypingLoop = () => {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = undefined;
    }
  };

  try {
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

    stopTypingLoop();

    if (answer.trim()) {
      // Clean up markdown for Telegram and reply
      const cleanedAnswer = cleanMarkdownForTelegram(answer);
      debugLog(`[gateway] sending reply to chat ${inbound.chatId}`);
      await inbound.reply(cleanedAnswer, 'Markdown');
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

export async function startGateway(params: { configPath?: string } = {}): Promise<GatewayService> {
  const cfg = loadGatewayConfig(params.configPath);

  // Create WhatsApp plugin
  const whatsappPlugin = createWhatsAppPlugin({
    loadConfig: () => loadGatewayConfig(params.configPath),
    onMessage: async (inbound) => {
      const current = loadGatewayConfig(params.configPath);
      await handleInbound(current, inbound);
    },
  });

  // Create Telegram plugin
  const telegramPlugin = createTelegramPlugin({
    loadConfig: () => loadGatewayConfig(params.configPath),
    onMessage: async (inbound) => {
      const current = loadGatewayConfig(params.configPath);
      await handleTelegramInbound(current, inbound);
    },
  });

  // Create channel managers for both plugins
  const whatsappManager = createChannelManager({
    plugin: whatsappPlugin,
    loadConfig: () => loadGatewayConfig(params.configPath),
  });

  const telegramManager = createChannelManager({
    plugin: telegramPlugin,
    loadConfig: () => loadGatewayConfig(params.configPath),
  });

  // Start all accounts for both channels
  await whatsappManager.startAll();
  await telegramManager.startAll();

  return {
    stop: async () => {
      await whatsappManager.stopAll();
      await telegramManager.stopAll();
    },
    snapshot: () => {
      const wa = whatsappManager.getSnapshot();
      const tg = telegramManager.getSnapshot();
      return { ...wa, ...tg };
    },
  };
}

