import { describe, it, expect } from 'bun:test';
import {
  transformUpdateToInbound,
  isSenderAllowed,
  shouldProcessMessage,
  createUnsupportedMessageResponse,
  createAuthFailureResponse,
  createRateLimitResponse,
  createTimeoutResponse,
  createErrorResponse,
} from './inbound';
import type { TelegramUpdate, TelegramInboundMessage, TelegramAccountConfig } from './types';

describe('Telegram Inbound', () => {
  describe('transformUpdateToInbound', () => {
    const validUpdate: TelegramUpdate = {
      update_id: 123456789,
      message: {
        message_id: 1,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'John',
          last_name: 'Doe',
          username: 'johndoe',
        },
        chat: {
          id: 123456789,
          type: 'private',
        },
        text: 'Hello bot',
        date: 1234567890,
      },
    };

    it('should transform valid update to inbound message', () => {
      const result = transformUpdateToInbound(validUpdate, 'default');

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe('default');
      expect(result?.messageId).toBe(1);
      expect(result?.chatId).toBe(123456789);
      expect(result?.chatType).toBe('private');
      expect(result?.senderId).toBe(123456789);
      expect(result?.senderName).toBe('John Doe');
      expect(result?.body).toBe('Hello bot');
    });

    it('should return null for update without message', () => {
      const result = transformUpdateToInbound({ update_id: 123 }, 'default');
      expect(result).toBeNull();
    });

    it('should handle missing from field', () => {
      const updateWithoutFrom: TelegramUpdate = {
        update_id: 123,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          text: 'Hello',
          date: 123,
        },
      };

      const result = transformUpdateToInbound(updateWithoutFrom, 'default');
      expect(result?.senderId).toBe(0);
      expect(result?.senderName).toBeUndefined();
    });

    it('should handle username-only sender', () => {
      const updateWithUsername: TelegramUpdate = {
        update_id: 123,
        message: {
          message_id: 1,
          from: {
            id: 123,
            is_bot: false,
            username: 'johndoe',
          },
          chat: { id: 123, type: 'private' },
          text: 'Test',
          date: 123,
        },
      };

      const result = transformUpdateToInbound(updateWithUsername, 'default');
      expect(result?.senderName).toBe('johndoe');
    });
  });

  describe('isSenderAllowed', () => {
    const baseAccount: TelegramAccountConfig = {
      accountId: 'default',
      enabled: true,
      allowFrom: ['123', '456'],
      dmPolicy: 'allowlist',
      groupPolicy: 'allowlist',
    };

    it('should allow sender in allowlist', () => {
      const result = isSenderAllowed(123, 'John', baseAccount, 'private');
      expect(result).toBe(true);
    });

    it('should deny sender not in allowlist', () => {
      const result = isSenderAllowed(999, 'Jane', baseAccount, 'private');
      expect(result).toBe(false);
    });

    it('should allow all when wildcard is present', () => {
      const accountWithWildcard: TelegramAccountConfig = {
        ...baseAccount,
        allowFrom: ['*'],
      };
      const result = isSenderAllowed(999, 'Jane', accountWithWildcard, 'private');
      expect(result).toBe(true);
    });

    it('should allow all for open policy', () => {
      const openAccount: TelegramAccountConfig = {
        ...baseAccount,
        dmPolicy: 'open',
        allowFrom: [],
      };
      const result = isSenderAllowed(999, 'Jane', openAccount, 'private');
      expect(result).toBe(true);
    });

    it('should deny all for disabled policy', () => {
      const disabledAccount: TelegramAccountConfig = {
        ...baseAccount,
        dmPolicy: 'disabled',
        allowFrom: ['123'],
      };
      const result = isSenderAllowed(123, 'John', disabledAccount, 'private');
      expect(result).toBe(false);
    });

    it('should use groupPolicy for groups', () => {
      const groupAccount: TelegramAccountConfig = {
        ...baseAccount,
        dmPolicy: 'allowlist',
        groupPolicy: 'open',
      };
      const result = isSenderAllowed(999, 'Jane', groupAccount, 'group');
      expect(result).toBe(true);
    });

    it('should match username in allowlist', () => {
      const accountWithUsername: TelegramAccountConfig = {
        ...baseAccount,
        allowFrom: ['johndoe'],
        dmPolicy: 'allowlist',
      };
      const result = isSenderAllowed(999, 'johndoe', accountWithUsername, 'private');
      expect(result).toBe(true);
    });
  });

  describe('shouldProcessMessage', () => {
    const baseInbound: TelegramInboundMessage = {
      accountId: 'default',
      messageId: 1,
      chatId: 123,
      chatType: 'private',
      senderId: 123,
      senderName: 'John',
      body: 'Hello',
      replyToJid: '123',
    };

    const baseAccount: TelegramAccountConfig = {
      accountId: 'default',
      enabled: true,
      allowFrom: ['123'],
      dmPolicy: 'allowlist',
      groupPolicy: 'allowlist',
    };

    it('should return null for valid message from allowed sender', () => {
      const result = shouldProcessMessage(baseInbound, baseAccount);
      expect(result).toBeNull();
    });

    it('should return rejection message for unauthorized sender', () => {
      const unauthorizedInbound = { ...baseInbound, senderId: 999 };
      const result = shouldProcessMessage(unauthorizedInbound, baseAccount);
      expect(result).not.toBeNull();
    });

    it('should return null for empty body (silent ignore)', () => {
      const emptyInbound = { ...baseInbound, body: '   ' };
      const result = shouldProcessMessage(emptyInbound, baseAccount);
      expect(result).toBeNull();
    });
  });

  describe('Response messages', () => {
    it('should return unsupported message response', () => {
      const response = createUnsupportedMessageResponse();
      expect(response).toContain('text');
    });

    it('should return auth failure response', () => {
      const response = createAuthFailureResponse();
      expect(response).toContain('authorized');
    });

    it('should return rate limit response', () => {
      const response = createRateLimitResponse();
      expect(response).toContain('wait');
    });

    it('should return timeout response', () => {
      const response = createTimeoutResponse();
      expect(response).toContain('long');
    });

    it('should return error response', () => {
      const response = createErrorResponse();
      expect(response).toContain('error');
    });
  });
});
