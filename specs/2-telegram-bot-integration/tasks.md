# Tasks: Telegram Bot Integration

**Feature**: Telegram Bot Integration
**Branch**: 2-telegram-bot-integration

## Implementation Strategy

**MVP Scope**: User Story 1 - Core messaging functionality (FR-1, FR-2, FR-3, FR-5)
**Delivery**: Incremental - text messages first, media in future iterations

---

## Phase 1: Foundational

Setup and configuration changes required before any user story implementation.

- [x] T001 Create directory structure for Telegram plugin in src/gateway/channels/telegram/
- [x] T002 Extend ChannelId type in src/gateway/channels/types.ts to include 'telegram'
- [x] T003 Add TelegramAccountSchema to src/gateway/config.ts with botToken, webhookPath, allowFrom fields
- [x] T004 Update GatewayConfigSchema in src/gateway/config.ts to include channels.telegram
- [x] T005 Add listTelegramAccountIds helper function to src/gateway/config.ts
- [x] T006 Add resolveTelegramAccount helper function to src/gateway/config.ts

---

## Phase 2: User Story 1 - Core Telegram Messaging

**Goal**: Users can send messages to the Telegram bot and receive agent responses
**Priority**: P1
**Independent Test**: Send a text message to the bot via webhook and verify agent response is delivered

### Implementation

- [x] T007 [P] [US1] Create Telegram types in src/gateway/channels/telegram/types.ts
- [x] T008 [P] [US1] Create Telegram inbound handler in src/gateway/channels/telegram/inbound.ts
- [x] T009 [P] [US1] Create Telegram outbound handler in src/gateway/channels/telegram/outbound.ts
- [x] T010 [US1] Create Telegram plugin in src/gateway/channels/telegram/plugin.ts
- [x] T011 [US1] Create Telegram index exports in src/gateway/channels/telegram/index.ts
- [x] T012 [US1] Update src/gateway/gateway.ts to load Telegram plugin and add handleTelegramInbound function
- [x] T013 [US1] Update src/gateway/routing/resolve-route.ts to support 'telegram' channel

---

## Phase 3: Testing

- [x] T014 [P] Add unit tests for webhook payload parsing in src/gateway/channels/telegram/inbound.test.ts
- [x] T015 [P] Add unit tests for message sending in src/gateway/channels/telegram/outbound.test.ts
- [x] T016 Add integration test for end-to-end message flow (mock Telegram API)

---

## Phase 4: Polish & Cross-Cutting

- [x] T017 Verify gateway starts successfully with both WhatsApp and Telegram plugins
- [x] T018 Verify config validation rejects invalid bot token format
- [x] T019 Document Telegram setup in README or quickstart guide

---

## Dependency Graph

```
Phase 1 (Foundational)
├── T001: Create directory
├── T002: Extend ChannelId type ──────────────────┐
├── T003: Add TelegramAccountSchema ──────────────┤
├── T004: Update GatewayConfigSchema ─────────────┤
├── T005: Add listTelegramAccountIds ─────────────┤
└── T006: Add resolveTelegramAccount ─────────────┘
                │
                ▼
Phase 2 (US1 - Core Messaging)
├── T007: Create Telegram types ──────────────────┐
├── T008: Create inbound handler ────────────────┤
├── T009: Create outbound handler ────────────────┤
├── T010: Create Telegram plugin ─────────────────┤
├── T011: Create Telegram index ──────────────────┤
├── T012: Update gateway.ts ──────────────────────┤
└── T013: Update routing ─────────────────────────┘
                │
                ▼
Phase 3 (Testing)
├── T014: Unit tests inbound
├── T015: Unit tests outbound
└── T016: Integration test
                │
                ▼
Phase 4 (Polish)
├── T017: Verify gateway startup
├── T018: Verify config validation
└── T019: Documentation
```

---

## Parallel Opportunities

1. **T002-T006** (Phase 1): Can all be done in parallel after T001
2. **T007-T009** (Phase 2): Can be done in parallel as they are independent modules
3. **T014-T015** (Phase 3): Can be done in parallel

---

## Task Count Summary

| Phase | Task Count |
|-------|------------|
| Phase 1: Foundational | 6 |
| Phase 2: US1 Core Messaging | 7 |
| Phase 3: Testing | 3 |
| Phase 4: Polish | 3 |
| **Total** | **19** |

---

## Independent Test Criteria

### User Story 1 (Phase 2)
- Text message sent to bot via webhook is received and parsed correctly
- Message is routed to agent for processing
- Agent response is sent back to the correct Telegram chat
- Session is maintained for multi-turn conversations
