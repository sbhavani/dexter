#!/usr/bin/env bun
import { config } from 'dotenv';

// Load environment variables
config({ quiet: true });

const args = process.argv.slice(2);

if (args.includes('--json')) {
  const { runJson } = await import('./json-runner.js');
  await runJson(args.filter(a => a !== '--json'));
} else {
  const { runCli } = await import('./cli.js');
  await runCli();
}
