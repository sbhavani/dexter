#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { setStreamingOverride } from './streaming/terminal-detection.js';

// Parse CLI arguments for streaming mode
function parseCliArgs() {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--stream') {
      setStreamingOverride(true);
    } else if (arg === '--no-stream') {
      setStreamingOverride(false);
    }
  }
}

// Load environment variables
config({ quiet: true });

// Parse CLI args before running CLI
parseCliArgs();

await runCli();
