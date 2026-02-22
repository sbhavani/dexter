#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli, runJsonMode } from './cli.js';

// Load environment variables
config({ quiet: true });

// Parse CLI arguments
const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');

if (jsonIndex !== -1) {
  // JSON mode: --json [prompt...]
  const promptArgs = args.slice(0, jsonIndex).concat(args.slice(jsonIndex + 1));
  const prompt = promptArgs.join(' ').trim();

  if (!prompt) {
    console.error('Error: --json requires a prompt argument');
    console.error('Usage: dexter-ts --json "your prompt here"');
    process.exit(1);
  }

  await runJsonMode(prompt);
} else {
  // Interactive TUI mode (default)
  await runCli();
}
