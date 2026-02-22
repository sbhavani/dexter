#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { listSessions } from './utils/session-storage.js';

// Load environment variables
config({ quiet: true });

interface CliArgs {
  sessionId: string | null;
  listSessions: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    sessionId: null,
    listSessions: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--session' || arg === '-s') {
      if (i + 1 < args.length) {
        result.sessionId = args[i + 1];
        i++;
      }
    } else if (arg === '--list-sessions' || arg === '-l') {
      result.listSessions = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Dexter CLI - Financial Research Agent

Usage:
  dexter                    Start a new session
  dexter --session <id>    Resume a previous session
  dexter --list-sessions   List all saved sessions
  dexter --help            Show this help message

Options:
  -s, --session <id>      Resume a specific session
  -l, --list-sessions     List all saved sessions
  -h, --help              Show this help message
`);
      process.exit(0);
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();

  if (args.listSessions) {
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.log('No saved sessions found.');
      return;
    }

    console.log('Saved sessions:\n');
    for (const session of sessions) {
      const date = new Date(session.updatedAt).toLocaleString();
      console.log(`  ${session.id}`);
      console.log(`    Messages: ${session.messageCount}`);
      console.log(`    Last updated: ${date}`);
      console.log();
    }
    return;
  }

  await runCli(args.sessionId);
}

await main();
