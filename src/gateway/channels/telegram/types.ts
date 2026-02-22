export type TelegramInboundMessage = {
  id: string;
  accountId: string;
  chatId: number;
  chatType: 'direct' | 'group' | 'supergroup';
  from: number;
  senderName?: string;
  body: string;
  timestamp: number;
  reply: (text: string) => Promise<void>;
};

export type TelegramConfig = {
  botToken: string;
  webhookUrl?: string;
  webhookPort?: number;
};

export type TelegramRuntimeStatus = {
  running: boolean;
  connected: boolean;
  lastError?: string | null;
};
