# Telegram Gateway

Chat with Dexter through Telegram by creating a bot and configuring the gateway. Messages sent to your bot are processed by Dexter and responses are sent back to the same chat.

## Table of Contents

- [✅ Prerequisites](#-prerequisites)
- [🤖 How to Create a Bot](#-how-to-create-a-bot)
- [🚀 How to Run](#-how-to-run)
- [💬 How to Chat](#-how-to-chat)
- [⚙️ Configuration](#️-configuration)
- [🔗 Webhook Setup](#-webhook-setup)
- [🐛 Troubleshooting](#-troubleshooting)

## ✅ Prerequisites

- Dexter installed and working (see main [README](../../../../README.md))
- A Telegram account
- A publicly accessible URL for webhooks (see [Webhook Setup](#-webhook-setup))

## 🤖 How to Create a Bot

1. Open Telegram and search for **@BotFather**
2. Start a chat with BotFather
3. Send `/newbot` to create a new bot
4. Follow the prompts to name your bot (e.g., "Dexter Bot")
5. BotFather will give you an API token - save this token

**Important**: Keep your bot token secure. Do not share it publicly.

## 🚀 How to Run

1. Add the Telegram configuration to your `~/.dexter/gateway.json`:

```json
{
  "gateway": {
    "accountId": "default",
    "logLevel": "info"
  },
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": {},
      "allowFrom": []
    },
    "telegram": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "YOUR_BOT_TOKEN_HERE",
          "webhookPath": "/webhooks/telegram",
          "allowFrom": ["*"]
        }
      }
    }
  },
  "bindings": []
}
```

2. Start the gateway:

```bash
bun run gateway
```

You should see:
```
Telegram webhook server listening on port 3000
Telegram bot for account default ready
Webhook endpoint: http://localhost:3000/webhooks/telegram
Dexter gateway running. Press Ctrl+C to stop.
```

## 💬 How to Chat

Once the gateway is running:

1. Open Telegram and search for your bot by name
2. Start a conversation with your bot (send `/start` or any message)
3. Send a message like "What is Apple's revenue?"
4. Dexter's response will appear in the same chat

**Example conversation:**
```
You: What was NVIDIA's revenue in 2024?
[Dexter]: NVIDIA's revenue for fiscal year 2024 was $60.9 billion...
```

## ⚙️ Configuration

The gateway configuration is stored at `~/.dexter/gateway.json`.

**Configuration options:**

| Setting | Description |
|---------|-------------|
| `channels.telegram.enabled` | Enable/disable the Telegram channel |
| `channels.telegram.accounts.*.botToken` | Your Telegram bot API token |
| `channels.telegram.accounts.*.webhookPath` | Webhook URL path (default: `/webhooks/telegram`) |
| `channels.telegram.accounts.*.allowFrom` | User IDs allowed to message (use `*` for all) |
| `channels.telegram.accounts.*.enabled` | Enable/disable specific account |

**Example with multiple accounts:**
```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "accounts": {
        "personal": {
          "botToken": "BOT_TOKEN_1",
          "allowFrom": ["123456789"]
        },
        "work": {
          "botToken": "BOT_TOKEN_2",
          "allowFrom": ["987654321"]
        }
      }
    }
  }
}
```

## 🔗 Webhook Setup

Telegram requires webhooks to be publicly accessible. For local development:

### Option 1: Using ngrok

```bash
# Install ngrok if needed
brew install ngrok

# Start ngrok tunnel
ngrok http 3000

# Note the HTTPS URL ngrok provides (e.g., https://abc123.ngrok.io)
```

Then set the webhook using the Telegram API:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -d "url=https://your-ngrok-url/webhooks/telegram"
```

### Option 2: Using Cloudflare Tunnel

```bash
# Install cloudflared
brew install cloudflared

# Create tunnel
cloudflared tunnel --url http://localhost:3000

# Set webhook to the provided URL
```

### Production Deployment

In production, ensure your server is accessible via HTTPS and configure the webhook:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -d "url=https://your-domain.com/webhooks/telegram"
```

## 🐛 Troubleshooting

**Bot not receiving messages:**

- Verify your bot token is correct in `gateway.json`
- Check that the webhook is set correctly (`/setWebhook`)
- Ensure the server is publicly accessible

**"Unauthorized" errors:**

- Check that your user ID is in `allowFrom` (or use `["*"]` for all users)
- Verify the bot token matches the one from BotFather

**Debug logs:**

- Check `~/.dexter/gateway-debug.log` for detailed logs

**Messages not being received:**

- Make sure the gateway is running
- Verify the webhook URL is publicly accessible
- Check Telegram API response with `getWebhookInfo`:
  ```bash
  curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
  ```
