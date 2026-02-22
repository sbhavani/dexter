import { Bot, type Bot as GrammyBot, type NextFunction } from 'grammy';
import type { TelegramInboundMessage, TelegramChannelOptions } from './types.js';
export type { TelegramInboundMessage } from './types.js';

function isAllowed(
  userId: number,
  chatType: 'direct' | 'group' | 'supergroup',
  options: Pick<TelegramChannelOptions, 'allowFrom' | 'allowGroups'>,
): boolean {
  const userIdStr = String(userId);

  // Allow all if wildcard
  if (options.allowFrom.includes('*')) {
    return true;
  }

  // Check if user is in allowlist
  if (options.allowFrom.includes(userIdStr)) {
    return true;
  }

  // Check groups
  if ((chatType === 'group' || chatType === 'supergroup') && options.allowGroups) {
    return true;
  }

  // For direct messages, require allowlist
  if (chatType === 'direct') {
    return false;
  }

  return false;
}

function resolveChatType(chatType: string): 'direct' | 'group' | 'supergroup' {
  if (chatType === 'private') return 'direct';
  return chatType as 'group' | 'supergroup';
}

export async function startTelegramChannel(opts: TelegramChannelOptions): Promise<void> {
  const { botToken, abortSignal, onMessage, onStatus, allowFrom, allowGroups } = opts;

  if (!botToken) {
    onStatus({ connected: false, lastError: 'No bot token configured' });
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const bot = new Bot(botToken);

  // Handle errors
  bot.catch((err) => {
    console.error('[telegram] Error:', err);
    onStatus({ connected: false, lastError: err.message });
  });

  // Middleware to check permissions
  bot.use(async (ctx, next: NextFunction) => {
    if (!ctx.message || !ctx.from) {
      return;
    }

    const chatType = ctx.chat?.type ?? 'private';
    const resolvedChatType = resolveChatType(chatType);

    if (!isAllowed(ctx.from.id, resolvedChatType, { allowFrom, allowGroups })) {
      if (resolvedChatType === 'direct') {
        await ctx.reply('Sorry, you are not authorized to use this bot.');
      }
      return;
    }

    await next();
  });

  // Handle messages
  bot.on('message:text', async (ctx) => {
    const msg = ctx.message;
    if (!msg || !ctx.from || !ctx.chat) {
      return;
    }

    const chatType = resolveChatType(ctx.chat.type);

    // Skip commands (they start with /)
    if (msg.text?.startsWith('/')) {
      // Handle /start command
      if (msg.text === '/start') {
        await ctx.reply('Hello! I am your AI research assistant. Send me a message and I will help you with financial research.');
      }
      return;
    }

    const chatId = ctx.chat.id;
    const fromId = ctx.from.id;
    const senderName = ctx.from.first_name ?? ctx.from.username ?? undefined;

    const inbound: TelegramInboundMessage = {
      id: String(msg.message_id),
      accountId: opts.accountId,
      chatId,
      messageId: msg.message_id,
      chatType,
      from: fromId,
      senderName,
      body: msg.text ?? '',
      timestamp: msg.date,
      reply: async (text: string, parseMode?: 'Markdown' | 'HTML') => {
        await ctx.reply(text, { parse_mode: parseMode });
      },
      sendChatAction: async (action) => {
        await ctx.api.sendChatAction(chatId, action);
      },
    };

    await onMessage(inbound);
  });

  // Handle channel posts
  bot.on('channel_post:text', async (ctx) => {
    const post = ctx.channelPost;
    if (!post || !post.text) {
      return;
    }

    const inbound: TelegramInboundMessage = {
      id: String(post.message_id),
      accountId: opts.accountId,
      chatId: ctx.chat?.id ?? 0,
      messageId: post.message_id,
      chatType: 'direct',
      from: 0,
      body: post.text,
      timestamp: post.date,
      reply: async (text: string, parseMode?: 'Markdown' | 'HTML') => {
        if (ctx.chat) {
          await ctx.api.sendMessage(ctx.chat.id, text, { parse_mode: parseMode });
        }
      },
      sendChatAction: async () => {},
    };

    await onMessage(inbound);
  });

  // Start the bot with long polling
  onStatus({ connected: true });

  console.log(`[telegram] Starting bot for account ${opts.accountId}`);

  // Start polling and keep it running
  await bot.start({
    onStart: () => {
      console.log(`[telegram] Bot started successfully`);
      onStatus({ connected: true });
    },
  });

  // Handle abort signal
  abortSignal.addEventListener('abort', () => {
    console.log(`[telegram] Stopping bot for account ${opts.accountId}`);
    bot.stop();
    onStatus({ connected: false });
  });
}

export function createTelegramBot(botToken: string): GrammyBot {
  return new Bot(botToken);
}
