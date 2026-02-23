# Research: Telegram Bot Integration

## Overview

This document captures the technical research and decisions for implementing Telegram bot integration.

## Key Technical Decisions

### Decision 1: HTTP Server for Webhooks

**Choice**: Use Node.js native `http` module
**Rationale**:
- Avoids adding new dependencies (express/fastify)
- Telegram webhooks are simple POST endpoints
- Follows YAGNI principle from constitution

**Alternatives Considered**:
- Express: Adds dependency, more features than needed
- Fastify: Faster but still overkill for single webhook endpoint

---

### Decision 2: Telegram Bot API Client

**Choice**: Use native `fetch` with Telegram Bot API
**Rationale**:
- Telegram Bot API is REST-based with simple endpoints
- No need for additional libraries
- Works with built-in fetch in Bun/Node

**Alternatives Considered**:
- node-telegram-bot-api: Adds dependency, more features than needed
- telegram: Heavy TypeScript SDK

---

### Decision 3: Session Management

**Choice**: Reuse existing session store with Telegram-specific keys
**Rationale**:
- Existing session store already handles persistence
- Only need to change the session key format to include channel
- Follows plugin architecture pattern

**Session Key Format**: `telegram:{chat_id}`

---

### Decision 4: Message Types to Support

**Choice**: Support text first, then media incrementally
**Rationale**:
- Text is 90%+ of user messages
- Follows constitution's YAGNI principle
- Media handling can be added as separate tasks

**Priority Order**:
1. Text messages
2. Photos (download and process as attachments)
3. Voice messages (transcribe if possible)
4. Stickers (ignore or respond with text)

---

### Decision 5: Webhook Security

**Choice**: Verify bot token in webhook requests
**Rationale**:
- Telegram sends bot token as authorization header
- Simple verification without complex auth
- Prevents unauthorized webhook calls

**Implementation**: Check `Authorization` header contains valid bot token

---

## Integration Patterns from WhatsApp

The implementation follows the same plugin architecture as WhatsApp:

1. **plugin.ts**: Creates the ChannelPlugin with config adapters and gateway handlers
2. **inbound.ts**: Handles receiving/parsing messages from Telegram
3. **outbound.ts**: Handles sending messages back to Telegram
4. **types.ts**: Defines TelegramInboundMessage type
5. **config.ts**: Extends GatewayConfig with Telegram account settings

---

## Configuration Schema

```typescript
// Telegram Account Config
{
  accountId: string;
  botToken: string;
  webhookPath: string; // e.g., "/webhooks/telegram"
  allowFrom: string[]; // list of allowed user IDs or "*" for all
}
```

---

## Gateway Integration Points

1. **config.ts**: Add TelegramAccountSchema and update GatewayConfig
2. **typestelegram' to.ts**: Add ' ChannelId union
3. **gateway.ts**: Add TelegramPlugin alongside WhatsAppPlugin
4. **routing/resolve-route.ts**: Support 'telegram' channel

---

## Notes

- Telegram requires webhook URL to be publicly accessible (HTTPS)
- Bot must be started with /start command or have privacy mode disabled
- Telegram has rate limits (30 messages/second)
- Message deduplication using message_id recommended
