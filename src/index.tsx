#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { runPortfolioCommand } from './portfolio/cli.js';

// Check for CLI commands (non-interactive mode)
const args = process.argv.slice(2);
if (args[0] === 'portfolio') {
  // Run portfolio analysis command
  const portfolioArgs = args.slice(1);
  await runPortfolioCommand(portfolioArgs);
  process.exit(0);
}

// Load environment variables
config({ quiet: true });

await runCli();
