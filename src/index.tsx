#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';

interface CliArgs {
  session: string | null;
  help: boolean;
  listSessions: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    session: null,
    help: false,
    listSessions: false,
  };

  const argv = process.argv.slice(2);
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--session' || arg === '-s') {
      i++;
      if (i < argv.length && !argv[i].startsWith('-')) {
        args.session = argv[i];
      } else {
        console.error('Error: --session requires a session ID argument');
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--list-sessions' || arg === '-l') {
      args.listSessions = true;
    } else if (arg.startsWith('-')) {
      console.error(`Error: Unknown option: ${arg}`);
      process.exit(1);
    } else {
      console.error(`Error: Unexpected argument: ${arg}`);
      process.exit(1);
    }
    i++;
  }

  return args;
}

function printHelp() {
  console.log(`Dexter - AI Agent for Financial Research

Usage: dexter [options]

Options:
  -s, --session <id>    Resume a previous session with the given ID
  -l, --list-sessions   List all saved sessions
  -h, --help            Show this help message

Examples:
  dexter                           Start a new session
  dexter --session my-research    Resume session "my-research"
  dexter --list-sessions          Show all saved sessions`);
}

// Load environment variables
config({ quiet: true });

const args = parseArgs();

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.listSessions) {
  const { listSessions } = await import('./utils/session-storage.js');
  listSessions();
  process.exit(0);
}

await runCli(args.session);
