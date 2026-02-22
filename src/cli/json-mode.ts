import { Agent } from '@/agent/agent';
import type { ApprovalDecision, DoneEvent, JsonSuccessOutput, JsonErrorOutput } from '@/agent/types';
import { JsonSuccessOutputSchema, JsonErrorOutputSchema } from '@/agent/types';
import { DEFAULT_MODEL } from '@/model/llm';
import { resolveProvider } from '@/providers';

export function buildSuccessOutput(
  query: string,
  doneEvent: DoneEvent,
  model: string,
): JsonSuccessOutput {
  const output: JsonSuccessOutput = {
    success: true as const,
    query,
    answer: doneEvent.answer,
    model,
    toolCalls: doneEvent.toolCalls,
    iterations: doneEvent.iterations,
    duration: doneEvent.totalTime,
  };
  if (doneEvent.tokenUsage) {
    output.tokenUsage = doneEvent.tokenUsage;
  }
  return JsonSuccessOutputSchema.parse(output);
}

export function buildErrorOutput(
  query: string,
  error: unknown,
): JsonErrorOutput {
  const message = error instanceof Error ? error.message : String(error);
  return JsonErrorOutputSchema.parse({
    success: false as const,
    query,
    error: message,
  });
}

export function resolveModel(flagModel?: string): { model: string; provider: string } {
  const model = flagModel || process.env.DEXTER_MODEL || DEFAULT_MODEL;
  const provider = resolveProvider(model);
  return { model, provider: provider.id };
}

async function readStdinQuery(): Promise<string | undefined> {
  // Only read stdin if data is being piped in (not a TTY)
  if (process.stdin.isTTY) return undefined;

  // Use a timeout to avoid hanging when stdin is not actually piped
  return new Promise<string | undefined>((resolve) => {
    let data = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        process.stdin.removeAllListeners();
        process.stdin.pause();
        resolve(undefined);
      }
    }, 100);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        const trimmed = data.trim();
        resolve(trimmed || undefined);
      }
    });
    process.stdin.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(undefined);
      }
    });
    process.stdin.resume();
  });
}

export async function runJsonMode(
  query: string | undefined,
  options: { model?: string } = {},
): Promise<void> {
  // Stdout isolation: redirect console.log/info/debug to stderr during execution
  const origLog = console.log;
  const origInfo = console.info;
  const origDebug = console.debug;
  console.log = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n');
  console.info = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n');
  console.debug = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n');

  let resolvedQuery = query || '';

  try {
    // Resolve query from argument or stdin
    resolvedQuery = query || (await readStdinQuery()) || '';
    if (!resolvedQuery) {
      const errorOutput = buildErrorOutput('', new Error('No query provided. Pass a query as an argument or pipe via stdin.'));
      origLog(JSON.stringify(errorOutput, null, 2));
      process.exit(2);
    }

    // Resolve model
    const { model, provider } = resolveModel(options.model);

    // Create agent with auto-approval for non-interactive mode
    const agent = Agent.create({
      model,
      modelProvider: provider,
      maxIterations: 10,
      requestToolApproval: async () => 'allow-once' as ApprovalDecision,
    });

    // Collect events from agent run
    let doneEvent: DoneEvent | undefined;
    for await (const event of agent.run(resolvedQuery)) {
      if (event.type === 'done') {
        doneEvent = event;
      }
    }

    if (!doneEvent) {
      throw new Error('Agent completed without producing a result.');
    }

    const output = buildSuccessOutput(resolvedQuery, doneEvent, model);
    origLog(JSON.stringify(output, null, 2));
    process.exit(0);
  } catch (err) {
    const errorOutput = buildErrorOutput(resolvedQuery, err);
    origLog(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  } finally {
    console.log = origLog;
    console.info = origInfo;
    console.debug = origDebug;
  }
}
