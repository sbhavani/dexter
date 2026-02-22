import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function writeGatewayConfig(configPath: string, config: object): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

describe('telegram config', () => {
  afterEach(() => {
    delete process.env.DEXTER_GATEWAY_CONFIG;
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  test('loads telegram config with bot token from env', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-telegram-'));
    const configPath = join(dir, 'gateway.json');
    const config = {
      gateway: {
        accountId: 'default',
        logLevel: 'info',
      },
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            default: {
              enabled: true,
              dmPolicy: 'open',
            },
          },
        },
      },
      bindings: [],
    };
    writeGatewayConfig(configPath, config);
    process.env.DEXTER_GATEWAY_CONFIG = configPath;
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

    // Load config
    const { loadGatewayConfig, resolveTelegramAccount } = require('../../config.js');
    const cfg = loadGatewayConfig(configPath);
    const account = resolveTelegramAccount(cfg, 'default');

    expect(account.botToken).toBe('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    expect(account.enabled).toBe(true);
    expect(account.dmPolicy).toBe('open');

    rmSync(dir, { recursive: true, force: true });
  });

  test('loads telegram config from config file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-telegram-'));
    const configPath = join(dir, 'gateway.json');
    const config = {
      gateway: {
        accountId: 'default',
        logLevel: 'info',
      },
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            mybot: {
              enabled: true,
              botToken: '123456:TEST_TOKEN_FROM_CONFIG',
              dmPolicy: 'allowlist',
              allowFrom: ['*'],
            },
          },
        },
      },
      bindings: [],
    };
    writeGatewayConfig(configPath, config);
    process.env.DEXTER_GATEWAY_CONFIG = configPath;

    const { loadGatewayConfig, resolveTelegramAccount } = require('../../config.js');
    const cfg = loadGatewayConfig(configPath);
    const account = resolveTelegramAccount(cfg, 'mybot');

    expect(account.botToken).toBe('123456:TEST_TOKEN_FROM_CONFIG');
    expect(account.dmPolicy).toBe('allowlist');
    expect(account.allowFrom).toEqual(['*']);

    rmSync(dir, { recursive: true, force: true });
  });

  test('defaults dmPolicy to open when not specified', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-telegram-'));
    const configPath = join(dir, 'gateway.json');
    const config = {
      gateway: {
        accountId: 'default',
        logLevel: 'info',
      },
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            default: {
              enabled: true,
            },
          },
        },
      },
      bindings: [],
    };
    writeGatewayConfig(configPath, config);
    process.env.DEXTER_GATEWAY_CONFIG = configPath;
    process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN';

    const { loadGatewayConfig, resolveTelegramAccount } = require('../../config.js');
    const cfg = loadGatewayConfig(configPath);
    const account = resolveTelegramAccount(cfg, 'default');

    expect(account.dmPolicy).toBe('open');

    rmSync(dir, { recursive: true, force: true });
  });

  test('listTelegramAccountIds returns default account when no accounts configured', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-telegram-'));
    const configPath = join(dir, 'gateway.json');
    const config = {
      gateway: {
        accountId: 'default',
        logLevel: 'info',
      },
      channels: {
        telegram: {
          enabled: true,
          accounts: {},
        },
      },
      bindings: [],
    };
    writeGatewayConfig(configPath, config);
    process.env.DEXTER_GATEWAY_CONFIG = configPath;

    const { loadGatewayConfig, listTelegramAccountIds } = require('../../config.js');
    const cfg = loadGatewayConfig(configPath);
    const ids = listTelegramAccountIds(cfg);

    expect(ids).toEqual(['default']);

    rmSync(dir, { recursive: true, force: true });
  });

  test('listTelegramAccountIds returns configured accounts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-telegram-'));
    const configPath = join(dir, 'gateway.json');
    const config = {
      gateway: {
        accountId: 'default',
        logLevel: 'info',
      },
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            bot1: { enabled: true },
            bot2: { enabled: true },
          },
        },
      },
      bindings: [],
    };
    writeGatewayConfig(configPath, config);
    process.env.DEXTER_GATEWAY_CONFIG = configPath;

    const { loadGatewayConfig, listTelegramAccountIds } = require('../../config.js');
    const cfg = loadGatewayConfig(configPath);
    const ids = listTelegramAccountIds(cfg);

    expect(ids).toEqual(['bot1', 'bot2']);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe('telegram outbound', () => {
  test('sendMessageTelegram constructs correct API call', async () => {
    // Mock fetch
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    let fetchUrl = '';
    let fetchBody: any = null;

    globalThis.fetch = async (url: string, options: any) => {
      fetchCalled = true;
      fetchUrl = url;
      fetchBody = options?.body ? JSON.parse(options.body) : null;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: 123,
            chat: { id: 123456, type: 'private' },
            text: 'test',
          },
        }),
      };
    };

    const { sendMessageTelegram } = await import('./outbound.js');

    try {
      await sendMessageTelegram({
        botToken: '123456:TEST_TOKEN',
        chatId: 123456,
        text: 'Hello world',
        parseMode: 'MarkdownV2',
      });

      expect(fetchCalled).toBe(true);
      expect(fetchUrl).toContain('sendMessage');
      expect(fetchBody).not.toBeNull();
      expect(fetchBody.chat_id).toBe(123456);
      expect(fetchBody.text).toBe('Hello world');
      expect(fetchBody.parse_mode).toBe('MarkdownV2');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('sendChatAction constructs correct API call', async () => {
    // Mock fetch
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    let fetchUrl = '';
    let fetchBody: any = null;

    globalThis.fetch = async (url: string, options: any) => {
      fetchCalled = true;
      fetchUrl = url;
      fetchBody = options?.body ? JSON.parse(options.body) : null;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: true,
        }),
      };
    };

    const { sendChatAction } = await import('./outbound.js');

    try {
      await sendChatAction({
        botToken: '123456:TEST_TOKEN',
        chatId: 123456,
        action: 'typing',
      });

      expect(fetchCalled).toBe(true);
      expect(fetchUrl).toContain('sendChatAction');
      expect(fetchBody).not.toBeNull();
      expect(fetchBody.chat_id).toBe(123456);
      expect(fetchBody.action).toBe('typing');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('telegram types', () => {
  test('TelegramInboundMessage has correct shape', async () => {
    const { TelegramInboundMessage } = await import('./types.js');

    // Verify the type exists and has expected properties
    const msg: TelegramInboundMessage = {
      id: '1',
      accountId: 'default',
      chatId: 123456,
      chatType: 'direct',
      from: 123456,
      body: 'Hello',
      timestamp: Date.now(),
      reply: async () => {},
    };

    expect(msg.id).toBe('1');
    expect(msg.chatType).toBe('direct');
    expect(typeof msg.reply).toBe('function');
  });
});
