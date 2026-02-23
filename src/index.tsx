#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { parseCliArgs, validateCliArgs } from './utils/cli-args.js';
import { SessionStore } from './utils/session-store.js';

// Load environment variables
config({ quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const cliArgs = parseCliArgs(args);

  // Validate args
  const errors = validateCliArgs(cliArgs);
  if (errors.length > 0) {
    console.error('Error(s):');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const sessionStore = new SessionStore();

  // Handle --list-sessions
  if (cliArgs.listSessions) {
    const sessions = await sessionStore.listSessions();
    if (sessions.length === 0) {
      console.log('No sessions found.');
      return;
    }
    console.log('Available sessions:\n');
    for (const s of sessions) {
      const created = new Date(s.createdAt).toLocaleString();
      const updated = new Date(s.updatedAt).toLocaleString();
      console.log(`  ID: ${s.id}`);
      console.log(`    Created: ${created}`);
      console.log(`    Updated: ${updated}`);
      console.log(`    Messages: ${s.messageCount}`);
      console.log('');
    }
    return;
  }

  // Handle --session <id>
  if (cliArgs.sessionId) {
    const session = await sessionStore.loadSession(cliArgs.sessionId);
    if (!session) {
      console.error(`Error: Session '${cliArgs.sessionId}' not found.`);
      process.exit(1);
    }
    console.log(`Resuming session ${cliArgs.sessionId}...`);
    await runCli(session);
    return;
  }

  // Normal launch (new session)
  await runCli();
}

await main();
