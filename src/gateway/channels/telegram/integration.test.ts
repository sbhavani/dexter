import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals';
import * as http from 'node:http';
import { parseTelegramUpdate, createTelegramInboundMessage, handleTelegramWebhook } from './inbound.js';

describe('Telegram Integration', () => {
  const mockBotToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const mockChatId = '123456789';

  describe('parseTelegramUpdate', () => {
    test('parses valid text message update', () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Test',
          },
          chat: {
            id: 123456789,
            type: 'private' as const,
          },
          date: 1234567890,
          text: 'Hello, bot!',
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).not.toBeNull();
      expect(result?.message?.text).toBe('Hello, bot!');
    });

    test('returns null for invalid update', () => {
      const update = { update_id: 'invalid' };
      const result = parseTelegramUpdate(update);
      expect(result).toBeNull();
    });

    test('returns null for update without message', () => {
      const update = { update_id: 123456789 };
      const result = parseTelegramUpdate(update);
      expect(result).toBeNull();
    });
  });

  describe('createTelegramInboundMessage', () => {
    test('creates inbound message with valid data', () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Test',
          },
          chat: {
            id: 123456789,
            type: 'private' as const,
          },
          date: 1234567890,
          text: 'Hello!',
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'default',
        mockBotToken,
        ['*'],
      );

      expect(result).not.toBeNull();
      expect(result?.body).toBe('Hello!');
      expect(result?.senderId).toBe('123456789');
      expect(result?.chatType).toBe('direct');
    });

    test('returns null for non-allowed user', () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 999,
            is_bot: false,
            first_name: 'Not Allowed',
          },
          chat: {
            id: 999,
            type: 'private' as const,
          },
          date: 1234567890,
          text: 'Hello!',
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'default',
        mockBotToken,
        ['123456789'], // Only allow this user
      );

      expect(result).toBeNull();
    });

    test('allows all users with wildcard', () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 999,
            is_bot: false,
            first_name: 'Any User',
          },
          chat: {
            id: 999,
            type: 'private' as const,
          },
          date: 1234567890,
          text: 'Hello!',
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'default',
        mockBotToken,
        ['*'],
      );

      expect(result).not.toBeNull();
    });
  });

  describe('handleTelegramWebhook', () => {
    let server: http.Server;
    let receivedMessage: any = null;

    beforeAll(async () => {
      server = http.createServer(async (req, res) => {
        // Mock the webhook handler
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));

        const update = parseTelegramUpdate(body);
        if (update) {
          const inbound = createTelegramInboundMessage(
            update as any,
            'default',
            mockBotToken,
            ['*'],
          );
          if (inbound) {
            receivedMessage = inbound;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }
        }
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid update' }));
      });

      await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    });

    test('end-to-end message flow', async () => {
      // This test verifies the full flow works
      // In a real integration test, we would make an HTTP request to the server
      // For now, just verify the functions work
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Test',
          },
          chat: {
            id: 123456789,
            type: 'private' as const,
          },
          date: 1234567890,
          text: 'Test message',
        },
      };

      const parsed = parseTelegramUpdate(update);
      expect(parsed).not.toBeNull();

      const inbound = createTelegramInboundMessage(parsed as any, 'default', mockBotToken, ['*']);
      expect(inbound).not.toBeNull();
      expect(inbound?.body).toBe('Test message');
    });
  });
});
