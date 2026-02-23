import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { parseTelegramUpdate, isUserAllowed, createTelegramInboundMessage } from './inbound.js';

describe('Telegram Inbound - Webhook Payload Parsing', () => {
  const mockBotToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

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
      expect(result?.update_id).toBe(123456789);
      expect(result?.message?.text).toBe('Hello, bot!');
    });

    test('parses edited_message update', () => {
      const update = {
        update_id: 123456790,
        edited_message: {
          message_id: 2,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Test',
          },
          chat: {
            id: 123456789,
            type: 'private' as const,
          },
          date: 1234567891,
          edit_date: 1234567892,
          text: 'Edited message',
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).not.toBeNull();
      expect(result?.edited_message?.text).toBe('Edited message');
    });

    test('parses channel_post update', () => {
      const update = {
        update_id: 123456791,
        channel_post: {
          message_id: 3,
          chat: {
            id: -1001234567890,
            type: 'channel' as const,
            title: 'Test Channel',
          },
          date: 1234567893,
          text: 'Channel post',
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).not.toBeNull();
      expect(result?.channel_post?.text).toBe('Channel post');
    });

    test('parses edited_channel_post update', () => {
      const update = {
        update_id: 123456792,
        edited_channel_post: {
          message_id: 4,
          chat: {
            id: -1001234567890,
            type: 'channel' as const,
            title: 'Test Channel',
          },
          date: 1234567894,
          edit_date: 1234567895,
          text: 'Edited channel post',
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).not.toBeNull();
      expect(result?.edited_channel_post?.text).toBe('Edited channel post');
    });

    test('returns null for null body', () => {
      const result = parseTelegramUpdate(null);
      expect(result).toBeNull();
    });

    test('returns null for undefined body', () => {
      const result = parseTelegramUpdate(undefined);
      expect(result).toBeNull();
    });

    test('returns null for array body', () => {
      const result = parseTelegramUpdate([{ update_id: 123 }]);
      expect(result).toBeNull();
    });

    test('returns null for string body', () => {
      const result = parseTelegramUpdate('invalid');
      expect(result).toBeNull();
    });

    test('returns null for number body', () => {
      const result = parseTelegramUpdate(123);
      expect(result).toBeNull();
    });

    test('returns null when update_id is missing', () => {
      const update = {
        message: {
          message_id: 1,
          from: { id: 123, is_bot: false, first_name: 'Test' },
          chat: { id: 123, type: 'private' as const },
          date: 1234567890,
          text: 'Hello',
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).toBeNull();
    });

    test('returns null when update_id is string', () => {
      const update = {
        update_id: '123456789',
        message: {
          message_id: 1,
          from: { id: 123, is_bot: false, first_name: 'Test' },
          chat: { id: 123, type: 'private' as const },
          date: 1234567890,
          text: 'Hello',
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).toBeNull();
    });

    test('returns null when no message field exists', () => {
      const update = {
        update_id: 123456789,
      };

      const result = parseTelegramUpdate(update);
      expect(result).toBeNull();
    });

    test('returns null when message is null', () => {
      const update = {
        update_id: 123456789,
        message: null,
      };

      const result = parseTelegramUpdate(update);
      expect(result).toBeNull();
    });

    test('returns null when message is not an object', () => {
      const update = {
        update_id: 123456789,
        message: 'not an object',
      };

      const result = parseTelegramUpdate(update);
      expect(result).toBeNull();
    });

    test('handles message with photo but no text', () => {
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
          photo: [
            {
              file_id: 'abc123',
              file_unique_id: 'abc123unique',
              width: 100,
              height: 100,
            },
          ],
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).not.toBeNull();
      expect(result?.message?.photo).toBeDefined();
      expect(result?.message?.photo?.length).toBe(1);
    });

    test('handles message with voice', () => {
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
          voice: {
            file_id: 'voice123',
            file_unique_id: 'voice123unique',
            duration: 10,
          },
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).not.toBeNull();
      expect(result?.message?.voice).toBeDefined();
    });

    test('handles message with sticker', () => {
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
          sticker: {
            file_id: 'sticker123',
            file_unique_id: 'sticker123unique',
            width: 512,
            height: 512,
            is_animated: false,
            is_video: false,
          },
        },
      };

      const result = parseTelegramUpdate(update);
      expect(result).not.toBeNull();
      expect(result?.message?.sticker).toBeDefined();
    });
  });

  describe('isUserAllowed', () => {
    test('allows wildcard', () => {
      expect(isUserAllowed('123456789', ['*'])).toBe(true);
    });

    test('allows specific user', () => {
      expect(isUserAllowed('123456789', ['123456789'])).toBe(true);
    });

    test('allows specific user from list', () => {
      expect(isUserAllowed('123456789', ['111', '222', '123456789'])).toBe(true);
    });

    test('rejects non-allowed user', () => {
      expect(isUserAllowed('123456789', ['111', '222'])).toBe(false);
    });

    test('rejects when user list is empty', () => {
      expect(isUserAllowed('123456789', [])).toBe(false);
    });

    test('handles wildcard with other users', () => {
      expect(isUserAllowed('999', ['*', '123456789'])).toBe(true);
    });
  });

  describe('createTelegramInboundMessage', () => {
    test('creates inbound message from valid update', () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
          },
          chat: {
            id: 123456789,
            type: 'private' as const,
          },
          date: 1234567890,
          text: 'Hello, bot!',
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'account-1',
        mockBotToken,
        ['*'],
      );

      expect(result).not.toBeNull();
      expect(result?.messageId).toBe('1');
      expect(result?.accountId).toBe('account-1');
      expect(result?.chatId).toBe('123456789');
      expect(result?.chatType).toBe('direct');
      expect(result?.senderId).toBe('123456789');
      expect(result?.senderName).toBe('Test');
      expect(result?.body).toBe('Hello, bot!');
      expect(result?.timestamp).toBe(1234567890);
      expect(result?.reply).toBeDefined();
    });

    test('creates inbound message for group chat', () => {
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
            id: -1001234567890,
            type: 'group' as const,
            title: 'Test Group',
          },
          date: 1234567890,
          text: 'Hello group!',
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'account-1',
        mockBotToken,
        ['*'],
      );

      expect(result).not.toBeNull();
      expect(result?.chatType).toBe('group');
      expect(result?.chatId).toBe('-1001234567890');
    });

    test('creates inbound message for supergroup', () => {
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
            id: -1001234567891,
            type: 'supergroup' as const,
            title: 'Test Supergroup',
          },
          date: 1234567890,
          text: 'Hello supergroup!',
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'account-1',
        mockBotToken,
        ['*'],
      );

      expect(result).not.toBeNull();
      expect(result?.chatType).toBe('group');
    });

    test('returns null when message is missing', () => {
      const update = {
        update_id: 123456789,
      };

      const result = createTelegramInboundMessage(
        update as any,
        'account-1',
        mockBotToken,
        ['*'],
      );

      expect(result).toBeNull();
    });

    test('returns null when from is missing', () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          chat: {
            id: 123456789,
            type: 'private' as const,
          },
          date: 1234567890,
          text: 'Hello',
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'account-1',
        mockBotToken,
        ['*'],
      );

      expect(result).toBeNull();
    });

    test('returns null when user not in allow list', () => {
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
        'account-1',
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
        'account-1',
        mockBotToken,
        ['*'],
      );

      expect(result).not.toBeNull();
    });

    test('returns null for empty message text', () => {
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
          // No text, photo without caption
          photo: [
            {
              file_id: 'abc123',
              file_unique_id: 'abc123unique',
              width: 100,
              height: 100,
            },
          ],
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'account-1',
        mockBotToken,
        ['*'],
      );

      // Photo without caption returns empty string body, which is filtered out
      expect(result).toBeNull();
    });

    test('returns null for message with only sticker', () => {
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
          sticker: {
            file_id: 'sticker123',
            file_unique_id: 'sticker123unique',
            width: 512,
            height: 512,
            is_animated: false,
            is_video: false,
          },
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'account-1',
        mockBotToken,
        ['*'],
      );

      // Sticker returns '[Sticker]' as body which is not empty, should work
      expect(result).not.toBeNull();
      expect(result?.body).toBe('[Sticker]');
    });

    test('returns null for message with only voice', () => {
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
          voice: {
            file_id: 'voice123',
            file_unique_id: 'voice123unique',
            duration: 10,
          },
        },
      };

      const result = createTelegramInboundMessage(
        update as any,
        'account-1',
        mockBotToken,
        ['*'],
      );

      // Voice returns '[Voice message]' as body, should work
      expect(result).not.toBeNull();
      expect(result?.body).toBe('[Voice message]');
    });

    test('handles missing optional from fields', () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Test',
            // No last_name, username, language_code
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
        'account-1',
        mockBotToken,
        ['*'],
      );

      expect(result).not.toBeNull();
      expect(result?.senderName).toBe('Test');
    });
  });
});
