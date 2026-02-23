export interface CliArgs {
  sessionId: string | null;
  listSessions: boolean;
}

const SESSION_FLAG = '--session';
const LIST_SESSIONS_FLAG = '--list-sessions';

/**
 * Parses CLI arguments for the session management flags.
 */
export function parseCliArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    sessionId: null,
    listSessions: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === LIST_SESSIONS_FLAG) {
      result.listSessions = true;
      continue;
    }

    if (arg === SESSION_FLAG) {
      // Check if there's a value after the flag
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        // Make sure the next arg isn't another flag
        if (!nextArg.startsWith('--')) {
          result.sessionId = nextArg;
          i++; // Skip the next arg since we consumed it
          continue;
        }
      }
      // If no value provided, it will be treated as just the flag being present
      // but we'll treat missing value as error in validation
    }
  }

  return result;
}

/**
 * Validates CLI arguments and returns errors if invalid.
 */
export function validateCliArgs(args: CliArgs): string[] {
  const errors: string[] = [];

  if (args.listSessions && args.sessionId) {
    errors.push('Cannot use both --list-sessions and --session flags together');
  }

  if (args.sessionId !== null) {
    // Validate session ID format (should be YYYYMMDD-HHMMSS)
    const sessionIdPattern = /^\d{8}-\d{6}$/;
    if (!sessionIdPattern.test(args.sessionId)) {
      errors.push(`Invalid session ID format: ${args.sessionId}. Expected format: YYYYMMDD-HHMMSS`);
    }
  }

  return errors;
}
