export interface ParsedArgs {
  json: boolean;
  model?: string;
  query?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let json = false;
  let model: string | undefined;
  const queryParts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--model') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        model = next;
        i++;
      }
    } else if (!arg.startsWith('--')) {
      queryParts.push(arg);
    }
  }

  const query = queryParts.length > 0 ? queryParts.join(' ') : undefined;
  return { json, model, query };
}
