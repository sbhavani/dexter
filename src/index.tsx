#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli, runJson } from './cli.js';

// Parse command line arguments
const args = process.argv.slice(2);
const jsonFlagIndex = args.indexOf('--json');

interface CliOptions {
  json: boolean;
  query: string | undefined;
}

const options: CliOptions = {
  json: jsonFlagIndex !== -1,
  query: undefined,
};

if (options.json) {
  // Remove --json flag from args to get the query
  const queryArgs = jsonFlagIndex === 0 ? args.slice(1) : [...args.slice(0, jsonFlagIndex), ...args.slice(jsonFlagIndex + 1)];
  options.query = queryArgs.join(' ').trim() || undefined;
}

// Load environment variables
config({ quiet: true });

if (options.json) {
  await runJson(options.query);
} else {
  await runCli();
}
