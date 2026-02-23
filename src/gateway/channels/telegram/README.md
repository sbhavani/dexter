# Telegram Channel Integration

This directory contains the Telegram bot integration for the Dexter gateway. It allows users to interact with the agent directly through Telegram by receiving messages via webhooks, processing them through the existing agent system, and responding in the same chat.

## Quick Start

### Prerequisites

1. A Telegram account
2. A bot token from @BotFather

### Step 1: Create a Telegram Bot

1. Open Telegram and search for @BotFather
2. Send `/newbot` to create a new bot
3. Follow the instructions to name your bot
4. Copy the bot token (it looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### Step 2: Configure the Gateway

Add the Telegram configuration to your `~/.dexter/gateway.json`:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN_HERE",
      "webhookSecret": "optional-secret-token",
      "webhookUrl": "https://your-domain.com/webhook/telegram",
      "allowFrom": ["*"]
    }
  },
  "bindings": [
    {
      "agentId": "default",
      "match": {
        "channel": "telegram"
      }
    }
  ]
}
```

### Step 3: Set Up Webhook URL

For Telegram webhooks to work, your server needs a publicly accessible HTTPS URL. Options:

- **Self-hosted**: Deploy to a server with a public IP and domain
- **Tunnel**: Use ngrok or similar to expose localhost
- **Cloud function**: Deploy to AWS Lambda, Vercel, etc.

### Step 4: Register the Webhook

Set the webhook with Telegram:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -d "url=https://your-domain.com/webhook/telegram" \
  -d "secret_token=your-secret-token"
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `enabled` | boolean | Yes | Enable/disable the Telegram channel |
| `botToken` | string | Yes | Your Telegram bot token from @BotFather |
| `webhookSecret` | string | No | Secret token for webhook verification |
| `webhookUrl` | string | No | The public URL for webhooks |
| `accounts` | object | No | Per-account configuration |
| `allowFrom` | array | No | User IDs allowed to interact with the bot (`*` for all) |

### Account Configuration

You can configure multiple Telegram bot accounts:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "BOT_TOKEN_1",
      "accounts": {
        "default": {
          "enabled": true,
          "allowFrom": ["123456789"],
          "dmPolicy": "allowlist",
          "groupPolicy": "open"
        },
        "alternate": {
          "enabled": true,
          "allowFrom": ["*"],
          "dmPolicy": "open",
          "groupPolicy": "open"
        }
      }
    }
  }
}
```

### Access Control Policies

| Policy | Description |
|--------|-------------|
| `allowlist` | Only users in `allowFrom` can interact |
| `open` | Anyone can interact |
| `disabled` | No one can interact |

### Chat Types

- `dmPolicy`: Controls direct messages
- `groupPolicy`: Controls group/supergroup messages

## Environment Variables

You can also configure Telegram using environment variables:

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_WEBHOOK_SECRET="your-secret"
```

## API Reference

### Webhook Endpoint

```
POST /webhook/telegram/:accountId
```

The webhook receives Telegram Update objects and processes them through the agent.

### Health Check

```
GET /health
```

Returns the health status of the gateway.

## Security Considerations

1. **Webhook Secret**: Always set a `webhookSecret` to verify that requests come from Telegram
2. **Access Control**: Use `allowFrom` to restrict who can use the bot
3. **Rate Limiting**: Telegram has a rate limit of 30 messages per second per bot
4. **Bot Token**: Keep your bot token secure; don't commit it to version control

## Troubleshooting

### Webhook Not Working

1. Verify your server is publicly accessible (HTTPS required)
2. Check that the webhook URL is correct
3. Ensure your firewall allows incoming requests from Telegram's IP ranges

### Messages Not Being Processed

1. Check the gateway logs
2. Verify the bot is enabled in configuration
3. Ensure your user ID is in the `allowFrom` list

### Bot Not Responding

1. Check that the agent is running correctly
2. Verify the bot token is correct
3. Check for error messages in the gateway logs

## Architecture

```
Telegram Servers
       │
       ▼
┌──────────────────┐
│  Webhook Server  │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Inbound Handler│
│  - Access Ctrl   │
│  - Message Parse │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Agent Runner    │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Outbound (API)  │
└──────────────────┘
```

## Development

### Running Tests

```bash
bun test src/gateway/channels/telegram/
```

### Type Definitions

See `types.ts` for TypeScript type definitions for Telegram's API objects.

## License

See the project root for license information.
