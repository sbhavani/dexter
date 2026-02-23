import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { sendMessageTelegram, sendChatAction, setWebhook, getMe } from './outbound.js';

describe('Telegram Outbound', () => {
  const mockBotToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const mockChatId = '123456789';

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn() as jest.Mock;
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendMessageTelegram', () => {
    test('sends text message successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await expect(
        sendMessageTelegram(mockBotToken, mockChatId, 'Hello, world!')
      ).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockBotToken}/sendMessage`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: mockChatId,
            text: 'Hello, world!',
            parse_mode: 'Markdown',
          }),
        })
      );
    });

    test('throws error on API failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request: chat not found'),
      } as Response);

      await expect(
        sendMessageTelegram(mockBotToken, mockChatId, 'Test message')
      ).rejects.toThrow('Telegram API error: 400 Bad Request: chat not found');
    });

    test('includes Markdown parse_mode in request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await sendMessageTelegram(mockBotToken, mockChatId, 'Test');

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.parse_mode).toBe('Markdown');
    });
  });

  describe('sendChatAction', () => {
    test('sends typing action successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await expect(
        sendChatAction(mockBotToken, mockChatId, 'typing')
      ).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockBotToken}/sendChatAction`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            chat_id: mockChatId,
            action: 'typing',
          }),
        })
      );
    });

    test('sends upload_photo action successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await expect(
        sendChatAction(mockBotToken, mockChatId, 'upload_photo')
      ).resolves.toBeUndefined();

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.action).toBe('upload_photo');
    });

    test('defaults to typing action', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await sendChatAction(mockBotToken, mockChatId);

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.action).toBe('typing');
    });

    test('throws error on API failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      } as Response);

      await expect(
        sendChatAction(mockBotToken, mockChatId, 'typing')
      ).rejects.toThrow('Telegram API error: 400 Bad Request');
    });
  });

  describe('setWebhook', () => {
    test('sets webhook successfully', async () => {
      const webhookUrl = 'https://example.com/webhook';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await expect(
        setWebhook(mockBotToken, webhookUrl)
      ).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockBotToken}/setWebhook`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            url: webhookUrl,
          }),
        })
      );
    });

    test('throws error on API failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request: invalid webhook URL'),
      } as Response);

      await expect(
        setWebhook(mockBotToken, 'invalid-url')
      ).rejects.toThrow('Telegram API error: 400 Bad Request: invalid webhook URL');
    });
  });

  describe('getMe', () => {
    test('returns bot info on success', async () => {
      const botInfo = {
        id: 123456789,
        first_name: 'Test Bot',
        username: 'test_bot',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true, result: botInfo }),
      } as Response);

      const result = await getMe(mockBotToken);

      expect(result).toEqual(botInfo);
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockBotToken}/getMe`
      );
    });

    test('returns null on HTTP error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await getMe(mockBotToken);

      expect(result).toBeNull();
    });

    test('returns null when API returns ok: false', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: false }),
      } as Response);

      const result = await getMe(mockBotToken);

      expect(result).toBeNull();
    });

    test('returns null when result is missing', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response);

      const result = await getMe(mockBotToken);

      expect(result).toBeNull();
    });
  });
});
