#!/usr/bin/env tsx
import { existsSync } from 'node:fs';
import util from 'node:util';
import {
  resolveWhatsAppAccount,
  loadGatewayConfig,
  saveGatewayConfig,
  getGatewayConfigPath,
  listTelegramAccountIds,
  resolveTelegramAccount,
} from './config.js';
import { loginWhatsApp } from './channels/whatsapp/login.js';
import { startGateway } from './gateway.js';
import { getWebhookUrl, startTelegramGateway } from './channels/telegram/index.js';

// Suppress noisy Baileys Signal protocol session logs
const SUPPRESSED_PREFIXES = [
  'Closing session:',
  'Opening session:',
  'Removing old closed session:',
  'Session already closed',
  'Session already open',
];

const originalLog = console.log;
console.log = (...args: unknown[]) => {
  const formatted = util.format(...args);
  if (SUPPRESSED_PREFIXES.some((prefix) => formatted.startsWith(prefix))) {
    return;
  }
  originalLog.apply(console, args);
};

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'run';
  const subcommand = args[1];

  if (command === 'telegram') {
    await handleTelegramCommand(args.slice(2));
    return;
  }

  if (command === 'login') {
    const cfg = loadGatewayConfig();
    const accountId = cfg.gateway.accountId ?? 'default';
    const account = resolveWhatsAppAccount(cfg, accountId);
    const result = await loginWhatsApp({ authDir: account.authDir });

    // Auto-create gateway.json with the user's phone in allowFrom
    const configPath = getGatewayConfigPath();
    const configExists = existsSync(configPath);
    if (result.phone) {
      const currentAllowFrom = cfg.channels.whatsapp.allowFrom;
      const alreadyAllowed = currentAllowFrom.includes(result.phone);
      if (!configExists || (!alreadyAllowed && currentAllowFrom.length === 0)) {
        cfg.channels.whatsapp.allowFrom = [result.phone];
        saveGatewayConfig(cfg);
        console.log(`Added ${result.phone} to allowFrom in ${configPath}`);
      }
    } else if (!configExists) {
      // Create default config even without phone
      saveGatewayConfig(cfg);
      console.log(`Created default config at ${configPath}`);
      console.log('Add your phone number to channels.whatsapp.allowFrom to receive messages.');
    }
    return;
  }

  const server = await startGateway();
  console.log('Dexter gateway running. Press Ctrl+C to stop.');

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

/**
 * Handle telegram CLI subcommands
 */
async function handleTelegramCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (subcommand === 'set-webhook') {
    await handleSetWebhook(args.slice(1));
    return;
  }

  if (!subcommand || subcommand === 'start') {
    // Start the Telegram gateway server
    const port = args[0] === 'start' ? parseInt(args[1], 10) : parseInt(args[0], 10);
    const serverPort = isNaN(port) ? 8080 : port;
    await startTelegramServer(serverPort);
    return;
  }

  // Default: show help/usage
  console.log(`
Telegram Bot CLI

Usage:
  gateway telegram [command] [options]

Commands:
  start [port]     Start the Telegram webhook server (default port: 8080)
  set-webhook      Configure the Telegram webhook URL

Examples:
  gateway telegram
  gateway telegram start
  gateway telegram start 3000
  gateway telegram set-webhook https://my-bot.example.com
`);
}

async function handleSetWebhook(args: string[]): Promise<void> {
  const baseUrl = args[0];
  const accountId = args[1] ?? 'default';

  if (!baseUrl) {
    console.error('Error: base-url is required');
    console.error('Usage: gateway telegram set-webhook <base-url> [account-id]');
    console.error('Example: gateway telegram set-webhook https://my-bot.example.com');
    process.exit(1);
  }

  // Validate URL format
  try {
    new URL(baseUrl);
  } catch {
    console.error('Error: Invalid URL format. Please provide a valid HTTPS URL.');
    process.exit(1);
  }

  // Load config
  const cfg = loadGatewayConfig();
  const botToken = cfg.channels.telegram.botToken;

  if (!botToken) {
    console.error('Error: Telegram bot token not configured.');
    console.error('Add your bot token to gateway.json:');
    console.error('  { "channels": { "telegram": { "botToken": "YOUR_BOT_TOKEN" } } }');
    process.exit(1);
  }

  // Validate account exists
  const accountIds = listTelegramAccountIds(cfg);
  const resolvedAccount = resolveTelegramAccount(cfg, accountId);

  // Generate webhook URL
  const webhookUrl = getWebhookUrl(baseUrl, accountId);

  console.log(`Setting webhook for account: ${accountId}`);
  console.log(`Webhook URL: ${webhookUrl}`);

  // Call Telegram API to set webhook
  const TELEGRAM_API_BASE = 'https://api.telegram.org';
  const setWebhookUrl = `${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`;

  try {
    const response = await fetch(setWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    });

    const result = await response.json() as { ok: boolean; description?: string; result?: unknown };

    if (!result.ok) {
      console.error(`Error setting webhook: ${result.description || 'Unknown error'}`);
      process.exit(1);
    }

    console.log('Webhook configured successfully!');

    // Save webhook URL to config
    cfg.channels.telegram.webhookUrl = webhookUrl;
    saveGatewayConfig(cfg);
    console.log(`Saved webhook URL to ${getGatewayConfigPath()}`);

    console.log(`
Your Telegram bot is now configured!
- Send /start to your bot to begin
- Make sure the gateway server is running to receive messages
`);
  } catch (error) {
    console.error(`Error calling Telegram API: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Start the Telegram gateway server
 */
async function startTelegramServer(port: number): Promise<void> {
  const cfg = loadGatewayConfig();

  console.log('Starting Telegram gateway...');

  try {
    const service = await startTelegramGateway(cfg, port);
    console.log(`Telegram gateway running on port ${port}`);
    console.log('Press Ctrl+C to stop.');

    const shutdown = async () => {
      await service.stop();
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error(`Failed to start Telegram gateway: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

void run();

