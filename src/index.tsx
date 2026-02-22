#!/usr/bin/env bun
import { config } from 'dotenv';
import { createInterface } from 'readline';
import { runCli } from './cli.js';
import { SessionManager } from './sessions/index.js';
import type { SessionOptions } from './sessions/index.js';

// Load environment variables
config({ quiet: true });

function parseArgs(argv: string[]): SessionOptions {
  const opts: SessionOptions = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--session' && i + 1 < argv.length) {
      opts.sessionId = argv[i + 1];
      i += 2;
    } else if (arg === '--list-sessions') {
      opts.listSessions = true;
      i++;
    } else if (arg === '--delete-session' && i + 1 < argv.length) {
      opts.deleteSession = argv[i + 1];
      i += 2;
    } else if (arg === '--json') {
      opts.json = true;
      i++;
    } else {
      i++;
    }
  }
  return opts;
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

function padEnd(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

async function handleListSessions(opts: SessionOptions): Promise<void> {
  const manager = new SessionManager();
  const sessions = manager.listSessions();

  if (opts.json) {
    const output = {
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
        exchangeCount: s.exchangeCount,
        model: s.model,
        provider: s.provider,
        firstQuery: s.firstQuery,
        lastQuery: s.lastQuery,
      })),
      count: sessions.length,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  }

  if (sessions.length === 0) {
    console.log('No saved sessions found.');
    process.exit(0);
  }

  // Human-readable table
  console.log(
    `${padEnd('ID', 10)}${padEnd('Created', 21)}${padEnd('Last Active', 21)}${padEnd('Exchanges', 11)}Preview`,
  );
  for (const s of sessions) {
    const preview = s.firstQuery || '(no queries)';
    console.log(
      `${padEnd(s.id, 10)}${padEnd(formatDate(s.createdAt), 21)}${padEnd(formatDate(s.updatedAt), 21)}${padEnd(String(s.exchangeCount), 11)}${preview}`,
    );
  }
  console.log(`\n${sessions.length} session${sessions.length === 1 ? '' : 's'} found.`);
  process.exit(0);
}

async function handleDeleteSession(id: string): Promise<void> {
  const manager = new SessionManager();
  const meta = manager.listSessions().find((s) => s.id === id);

  if (!meta) {
    process.stderr.write(`Error: Session "${id}" not found.\n`);
    process.exit(1);
  }

  const lastActive = formatDate(meta.updatedAt);
  process.stdout.write(
    `Delete session ${id}? (${meta.exchangeCount} exchanges, last active ${lastActive})\nType 'yes' to confirm: `,
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.on('line', (line) => {
      resolve(line.trim());
      rl.close();
    });
  });

  if (answer === 'yes') {
    manager.deleteSession(id);
    console.log(`Session ${id} deleted.`);
  } else {
    console.log('Cancelled.');
  }
  process.exit(0);
}

const opts = parseArgs(process.argv.slice(2));

if (opts.listSessions) {
  await handleListSessions(opts);
} else if (opts.deleteSession) {
  await handleDeleteSession(opts.deleteSession);
} else {
  await runCli(opts);
}
