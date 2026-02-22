export type TelegramInboundMessage = {
  id?: string;
  accountId: string;
  chatId: number;
  messageId: number;
  chatType: 'direct' | 'group' | 'supergroup';
  from: number;
  senderName?: string;
  body: string;
  timestamp?: number;
  reply: (text: string, parseMode?: 'Markdown' | 'HTML') => Promise<void>;
  sendChatAction: (action: 'typing' | 'upload_photo' | 'upload_video' | 'upload_document' | 'record_video' | 'record_voice' | 'upload_voice' | 'choose_sticker' | 'find_location' | 'record_video_note' | 'upload_video_note') => Promise<void>;
};

export type TelegramChannelOptions = {
  accountId: string;
  botToken: string;
  allowFrom: string[];
  allowGroups: boolean;
  webhookUrl?: string;
  abortSignal: AbortSignal;
  heartbeatSeconds?: number;
  onMessage: (msg: TelegramInboundMessage) => Promise<void>;
  onStatus: (status: { connected: boolean; lastError?: string }) => void;
};

export type TelegramChannelRuntime = {
  accountId: string;
  running: boolean;
  connected: boolean;
  lastError?: string;
};
