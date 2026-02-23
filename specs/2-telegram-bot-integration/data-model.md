# Data Model: Telegram Bot Integration

## Entities

### TelegramInboundMessage

Represents an inbound message received from Telegram.

```typescript
type TelegramInboundMessage = {
  // Identification
  messageId: string;
  accountId: string;
  chatId: string;
  chatType: 'direct' | 'group';

  // Sender information
  from: string;           // User ID (numeric string)
  senderId: string;
  senderName?: string;    // first_name from Telegram

  // Message content
  body: string;           // Text content
  timestamp: number;      // Unix timestamp

  // Response capabilities
  reply: (text: string) => Promise<void>;
};
```

### TelegramAccountConfig

Configuration for a Telegram bot account.

```typescript
type TelegramAccountConfig = {
  accountId: string;
  name?: string;
  enabled: boolean;
  botToken: string;           // Telegram Bot API token
  webhookPath: string;        // Webhook URL path
  allowFrom: string[];        // Allowed user IDs or "*" for all
};
```

### GatewayConfig Extension

```typescript
type GatewayConfig = {
  // ... existing fields
  channels: {
    whatsapp: { /* existing */ };
    telegram?: {
      enabled: boolean;
      accounts: Record<string, TelegramAccountConfig>;
      allowFrom: string[];
    };
  };
};
```

---

## Relationships

```
TelegramInboundMessage
  ├── belongs to TelegramAccountConfig (via accountId)
  ├── identified by chatId (session key component)
  └── responds via reply() method
```

---

## State Transitions

### Message Processing Flow

```
1. Webhook receives POST request
2. Parse Telegram Update payload
3. Create TelegramInboundMessage
4. Route to agent (via session store)
5. Process through agent
6. Send response via reply()
```

### Account Lifecycle

```
Disabled → Enabled → Configured → Running
    ↓         ↓          ↓          ↓
  skip     check      verify    start HTTP
           config    botToken   server
```

---

## Validation Rules

### TelegramAccountConfig
- `botToken`: Required, non-empty string matching pattern `^\d+:[\w-]+$`
- `webhookPath`: Required, must start with `/`, no query params
- `allowFrom`: Array of string user IDs or `["*"]`

### TelegramInboundMessage
- `chatId`: Required, numeric string
- `body`: Required for text messages, may be empty for media-only
- `timestamp`: Required, valid Unix timestamp

---

## Session Key Format

For session management, Telegram uses the format:

```
telegram:{chat_id}
```

This allows sessions to be keyed by Telegram chat ID while remaining distinct from other channels.
