import { describe, it, expect } from 'bun:test';
import { parseWebhookRequest, validateWebhookSecret, createWebhookResponse } from './webhook';
import type { TelegramUpdate } from './types';

describe('Telegram Webhook', () => {
  describe('parseWebhookRequest', () => {
    it('should parse a valid message update', () => {
      const validUpdate = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'John',
            last_name: 'Doe',
          },
          chat: {
            id: 123456789,
            type: 'private' as const,
          },
          text: 'Hello bot',
          date: 1234567890,
        },
      };

      const result = parseWebhookRequest(validUpdate);
      expect(result).not.toBeNull();
      expect(result?.update_id).toBe(123456789);
      expect(result?.message?.text).toBe('Hello bot');
    });

    it('should reject update without update_id', () => {
      const invalidUpdate = {
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' as const },
        },
      };

      const result = parseWebhookRequest(invalidUpdate);
      expect(result).toBeNull();
    });

    it('should reject update without message', () => {
      const invalidUpdate = {
        update_id: 123456789,
      };

      const result = parseWebhookRequest(invalidUpdate);
      expect(result).toBeNull();
    });

    it('should reject update with invalid message structure', () => {
      const invalidUpdate = {
        update_id: 123456789,
        message: {
          // missing message_id
          chat: { id: 123, type: 'private' as const },
        },
      };

      const result = parseWebhookRequest(invalidUpdate);
      expect(result).toBeNull();
    });

    it('should reject non-object body', () => {
      expect(parseWebhookRequest(null)).toBeNull();
      expect(parseWebhookRequest('string')).toBeNull();
      expect(parseWebhookRequest([1, 2, 3])).toBeNull();
    });

    it('should parse group chat message', () => {
      const groupUpdate = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            is_bot: false,
            username: 'johndoe',
          },
          chat: {
            id: -123456789,
            type: 'group' as const,
            title: 'Test Group',
          },
          text: '/start',
          date: 1234567890,
        },
      };

      const result = parseWebhookRequest(groupUpdate);
      expect(result).not.toBeNull();
      expect(result?.message?.chat?.type).toBe('group');
    });
  });

  describe('validateWebhookSecret', () => {
    it('should allow request when no secret is configured', () => {
      expect(validateWebhookSecret(undefined, 'any-secret')).toBe(true);
      expect(validateWebhookSecret(undefined, undefined)).toBe(true);
    });

    it('should reject request when secret is required but not provided', () => {
      expect(validateWebhookSecret('my-secret', undefined)).toBe(false);
    });

    it('should reject request when secrets do not match', () => {
      expect(validateWebhookSecret('my-secret', 'wrong-secret')).toBe(false);
    });

    it('should allow request when secrets match', () => {
      expect(validateWebhookSecret('my-secret', 'my-secret')).toBe(true);
    });
  });

  describe('createWebhookResponse', () => {
    it('should return 200 OK for success', () => {
      const response = createWebhookResponse(200);
      expect(response.status).toBe(200);
    });

    it('should return 401 for unauthorized', () => {
      const response = createWebhookResponse(401);
      expect(response.status).toBe(401);
    });

    it('should return 400 for bad request', () => {
      const response = createWebhookResponse(400);
      expect(response.status).toBe(400);
    });

    it('should return 500 for internal error with message', () => {
      const response = createWebhookResponse(500, 'Internal Error');
      expect(response.status).toBe(500);
    });
  });
});
