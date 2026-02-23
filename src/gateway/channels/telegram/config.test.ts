import { describe, it, expect, beforeEach } from 'bun:test';
import { GatewayConfigSchema, loadGatewayConfig, listTelegramAccountIds, resolveTelegramAccount } from '../../config';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';

describe('Telegram Configuration', () => {
  const testConfigPath = join(tmpdir(), 'test-gateway-config.json');

  beforeEach(() => {
    // Clean up test config
    try {
      unlinkSync(testConfigPath);
    } catch {
      // File doesn't exist
    }
  });

  it('should load default config with telegram disabled', () => {
    const config = loadGatewayConfig(testConfigPath);
    expect(config.channels.telegram).toBeDefined();
    expect(config.channels.telegram.enabled).toBe(false);
    expect(config.channels.telegram.botToken).toBeUndefined();
  });

  it('should load telegram config from file', () => {
    const configWithTelegram = {
      channels: {
        telegram: {
          enabled: true,
          botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
          webhookSecret: 'my-secret-token',
          webhookUrl: 'https://example.com/webhook',
          accounts: {
            default: {
              accountId: 'default',
              enabled: true,
              allowFrom: ['123456789', '*'],
              dmPolicy: 'allowlist',
              groupPolicy: 'open',
            },
          },
          allowFrom: [],
        },
      },
    };

    writeFileSync(testConfigPath, JSON.stringify(configWithTelegram));
    const config = loadGatewayConfig(testConfigPath);

    expect(config.channels.telegram.enabled).toBe(true);
    expect(config.channels.telegram.botToken).toBe('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    expect(config.channels.telegram.webhookSecret).toBe('my-secret-token');
    expect(config.channels.telegram.webhookUrl).toBe('https://example.com/webhook');
  });

  describe('listTelegramAccountIds', () => {
    it('should return default account when no accounts configured', () => {
      const config = loadGatewayConfig(testConfigPath);
      const ids = listTelegramAccountIds(config);
      expect(ids).toContain('default');
    });

    it('should return configured account IDs', () => {
      const configWithAccounts = {
        channels: {
          telegram: {
            enabled: true,
            botToken: 'test-token',
            accounts: {
              account1: { accountId: 'account1', enabled: true, allowFrom: [], dmPolicy: 'open', groupPolicy: 'open' },
              account2: { accountId: 'account2', enabled: true, allowFrom: [], dmPolicy: 'open', groupPolicy: 'open' },
            },
            allowFrom: [],
          },
        },
      };

      writeFileSync(testConfigPath, JSON.stringify(configWithAccounts));
      const config = loadGatewayConfig(testConfigPath);
      const ids = listTelegramAccountIds(config);

      expect(ids).toContain('account1');
      expect(ids).toContain('account2');
    });
  });

  describe('resolveTelegramAccount', () => {
    it('should return default values for unspecified account', () => {
      const config = loadGatewayConfig(testConfigPath);
      const account = resolveTelegramAccount(config, 'default');

      expect(account.accountId).toBe('default');
      expect(account.enabled).toBe(true);
      expect(account.dmPolicy).toBe('allowlist');
      expect(account.groupPolicy).toBe('allowlist');
    });

    it('should return configured account values', () => {
      const configWithAccount = {
        channels: {
          telegram: {
            enabled: true,
            botToken: 'test-token',
            accounts: {
              mybot: {
                accountId: 'mybot',
                enabled: false,
                name: 'My Bot',
                allowFrom: ['111', '222'],
                dmPolicy: 'open',
                groupPolicy: 'disabled',
              },
            },
            allowFrom: [],
          },
        },
      };

      writeFileSync(testConfigPath, JSON.stringify(configWithAccount));
      const config = loadGatewayConfig(testConfigPath);
      const account = resolveTelegramAccount(config, 'mybot');

      expect(account.accountId).toBe('mybot');
      expect(account.enabled).toBe(false);
      expect(account.name).toBe('My Bot');
      expect(account.allowFrom).toEqual(['111', '222']);
      expect(account.dmPolicy).toBe('open');
      expect(account.groupPolicy).toBe('disabled');
    });

    it('should use channel-level allowFrom when account has none', () => {
      const configWithAllowFrom = {
        channels: {
          telegram: {
            enabled: true,
            botToken: 'test-token',
            accounts: {
              default: {
                accountId: 'default',
                enabled: true,
                allowFrom: [],
                dmPolicy: 'allowlist',
                groupPolicy: 'allowlist',
              },
            },
            allowFrom: ['123', '456', '*'],
          },
        },
      };

      writeFileSync(testConfigPath, JSON.stringify(configWithAllowFrom));
      const config = loadGatewayConfig(testConfigPath);
      const account = resolveTelegramAccount(config, 'default');

      expect(account.allowFrom).toEqual(['123', '456', '*']);
    });
  });
});
