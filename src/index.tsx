#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { parseArgs } from './cli/parse-args.js';
import { runJsonMode } from './cli/json-mode.js';

// Load environment variables
config({ quiet: true });

const args = parseArgs(process.argv.slice(2));

if (args.json) {
  await runJsonMode(args.query, { model: args.model });
} else {
  await runCli();
}
