# Implementation Plan: Telegram Bot Integration

## Technical Context

### Unknowns (Resolved via Research)

| Unknown | Resolution |
|---------|------------|
| HTTP server for webhooks | Use Node.js native `http` module |
| Telegram API client | Use native `fetch` with Telegram Bot API |
| Message types to support | Text first, then media incrementally |
| Webhook security | Verify bot token in Authorization header |

### Dependencies

- **Telegram Bot API**: REST API at `https://api.telegram.org/bot{TOKEN}`
- **HTTP Server**: Native Node.js `http` module
- **Session Store**: Reuse existing gateway session store

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Test-First | ✅ PASS | Will add tests for webhook endpoint and message handling |
| CLI-First | ✅ PASS | Gateway runs via CLI, no UI changes needed |
| Observability | ✅ PASS | Debug logging to existing debug log |
| Safety & Loop Prevention | ✅ PASS | Inherits from agent runner |
| Simplicity (YAGNI) | ✅ PASS | Native http module, no new dependencies |

---

## Phase 1: Foundation

### Task 1.1: Extend ChannelId Type

**File**: `src/gateway/channels/types.ts`

Add 'telegram' to ChannelId union:
```typescript
export type ChannelId = 'whatsapp' | 'telegram';
```

### Task 1.2: Extend GatewayConfig Schema

**File**: `src/gateway/config.ts`

Add Telegram configuration:
- Add `TelegramAccountSchema` (botToken, webhookPath, allowFrom)
- Update `GatewayConfigSchema` to include `channels.telegram`
- Add helper functions: `listTelegramAccountIds`, `resolveTelegramAccount`

---

## Phase 2: Telegram Plugin Implementation

### Task 2.1: Create Telegram Types

**File**: `src/gateway/channels/telegram/types.ts`

Define:
- `TelegramInboundMessage` - inbound message structure
- `TelegramUpdate` - Telegram webhook payload type
- `TelegramUser` - user info type
- `TelegramChat` - chat info type

### Task 2.2: Create Telegram Inbound Handler

**File**: `src/gateway/channels/telegram/inbound.ts`

Implement:
- `parseTelegramUpdate()` - parse webhook payload
- `createTelegramInboundMessage()` - convert to internal format
- `handleWebhookRequest()` - HTTP request handler

### Task 2.3: Create Telegram Outbound Handler

**File**: `src/gateway/channels/telegram/outbound.ts`

Implement:
- `sendMessageTelegram()` - send text message via Bot API
- `sendChatAction()` - send typing indicator

### Task 2.4: Create Telegram Plugin

**File**: `src/gateway/channels/telegram/plugin.ts`

Implement `createTelegramPlugin()`:
- Config adapter (listAccountIds, resolveAccount, isEnabled, isConfigured)
- Gateway adapter (startAccount starts HTTP server)
- Status defaults

### Task 2.5: Create Telegram Index

**File**: `src/gateway/channels/telegram/index.ts`

Export all modules and types for the gateway to use.

---

## Phase 3: Gateway Integration

### Task 3.1: Update Gateway to Load Telegram Plugin

**File**: `src/gateway/gateway.ts`

1. Import Telegram plugin
2. Create plugin instance alongside WhatsApp
3. Create channel manager for Telegram
4. Add `handleTelegramInbound()` function (similar to handleInbound but for Telegram)
5. Start both managers in `startGateway()`

### Task 3.2: Update Routing

**File**: `src/gateway/routing/resolve-route.ts`

Support 'telegram' channel in route resolution.

---

## Phase 4: Testing

### Task 4.1: Unit Tests

**Files**: Create test files alongside source:
- `src/gateway/channels/telegram/inbound.test.ts`
- `src/gateway/channels/telegram/outbound.test.ts`

Test:
- Webhook payload parsing
- Message conversion
- Send message function

### Task 4.2: Integration Test

Test end-to-end:
- Mock Telegram API
- Send test webhook
- Verify message processing
- Verify response sent

---

## Gate: Implementation Complete

Before proceeding to task generation, verify:
- [ ] All source files created
- [ ] Config schema validates correctly
- [ ] Tests pass
- [ ] Gateway starts with both plugins

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Webhook not reachable | High | Document public URL requirement |
| Bot token security | High | Store in gateway.json, warn not to commit |
| Rate limiting | Medium | Implement message queuing if needed |
| Media handling | Low | Deferred to future iteration |

---

## Dependencies

- **WhatsApp Plugin**: Reference for channel plugin pattern
- **Session Store**: Existing gateway/sessions/store.ts
- **Config Module**: Existing gateway/config.ts

---

## Quick Start (for documentation)

```bash
# 1. Create Telegram bot via @BotFather on Telegram
# 2. Add bot token to gateway.json

# Example gateway.json:
{
  "gateway": { "accountId": "default", "logLevel": "info" },
  "channels": {
    "whatsapp": { "enabled": true, "accounts": {}, "allowFrom": [] },
    "telegram": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
          "webhookPath": "/webhooks/telegram",
          "allowFrom": ["*"]
        }
      }
    }
  },
  "bindings": []
}

# 3. Start gateway
bun start gateway
```

**Note**: The webhook URL must be publicly accessible (Telegram requirement). Use a tunnel like ngrok for local development.
