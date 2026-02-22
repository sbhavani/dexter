import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Agent } from './agent/agent.js';
import type { AgentEvent, DoneEvent } from './agent/types.js';
import { getSetting } from './utils/config.js';
import {
  buildSuccessResponse,
  buildErrorResponse,
  ErrorCode,
  type JsonResponse,
} from './json-schema.js';

/**
 * Options for executeJsonQuery, enabling dependency injection for testing.
 */
export interface JsonRunnerOptions {
  createAgent?: (config: {
    model: string;
    provider: string;
  }) => { run: (query: string) => AsyncGenerator<AgentEvent> };
  readStdin?: () => Promise<string>;
  isTTY?: boolean;
}

/**
 * Core logic: resolve query, run agent, return structured result.
 * Does NOT call process.exit or write to stdout — the caller handles that.
 */
export async function executeJsonQuery(
  args: string[],
  options?: JsonRunnerOptions,
): Promise<{ response: JsonResponse; exitCode: number }> {
  let model = '';

  try {
    const provider = getSetting('provider', 'openai');
    model = getSetting('modelId', 'gpt-5.2');

    const query = await resolveQuery(args, options);

    if (!query) {
      return {
        response: buildErrorResponse(
          '',
          ErrorCode.NO_QUERY,
          'No query provided. Pass a query as an argument or pipe via stdin.',
          '',
          model,
        ),
        exitCode: 1,
      };
    }

    const agent = options?.createAgent
      ? options.createAgent({ model, provider })
      : Agent.create({
          model,
          modelProvider: provider,
          maxIterations: 10,
          requestToolApproval: async () => 'allow-once',
        });

    let doneEvent: DoneEvent | undefined;

    for await (const event of agent.run(query)) {
      if (event.type === 'tool_start') {
        console.error(`[tool] ${event.tool}`);
      }
      if (event.type === 'done') {
        doneEvent = event;
      }
    }

    if (!doneEvent) {
      return {
        response: buildErrorResponse(
          query,
          ErrorCode.AGENT_ERROR,
          'Agent did not produce a result.',
          '',
          model,
        ),
        exitCode: 1,
      };
    }

    const scratchpadPath = findLatestScratchpadFile();

    return {
      response: buildSuccessResponse(query, doneEvent, scratchpadPath, model),
      exitCode: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = classifyError(error);

    return {
      response: buildErrorResponse(
        args.filter((a) => !a.startsWith('--')).join(' '),
        errorCode,
        errorMessage,
        '',
        model,
      ),
      exitCode: 1,
    };
  }
}

/**
 * Entry point for JSON mode. Calls executeJsonQuery, writes JSON to stdout, exits.
 */
export async function runJson(args: string[]): Promise<void> {
  const { response, exitCode } = await executeJsonQuery(args);
  process.stdout.write(JSON.stringify(response) + '\n');
  process.exit(exitCode);
}

/**
 * Resolve the query from positional args or stdin.
 */
async function resolveQuery(
  args: string[],
  options?: JsonRunnerOptions,
): Promise<string> {
  const positional = args.filter((a) => !a.startsWith('--'));

  if (positional.length > 0) {
    return positional.join(' ').trim();
  }

  const isTTY = options?.isTTY ?? process.stdin.isTTY;
  if (!isTTY) {
    const readStdin = options?.readStdin ?? (() => Bun.stdin.text());
    const input = await readStdin();
    return input.trim();
  }

  return '';
}

/**
 * Classify an error into an ErrorCode.
 */
export function classifyError(error: unknown): ErrorCode {
  if (!(error instanceof Error)) return ErrorCode.UNKNOWN_ERROR;

  const message = error.message.toLowerCase();

  if (
    message.includes('api key') ||
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('rate limit') ||
    message.includes('quota')
  ) {
    return ErrorCode.PROVIDER_ERROR;
  }

  if (
    message.includes('config') ||
    message.includes('settings') ||
    message.includes('not configured') ||
    message.includes('missing')
  ) {
    return ErrorCode.CONFIG_ERROR;
  }

  if (
    message.includes('agent') ||
    message.includes('tool') ||
    message.includes('iteration') ||
    message.includes('timeout')
  ) {
    return ErrorCode.AGENT_ERROR;
  }

  return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Find the most recently created scratchpad file.
 */
function findLatestScratchpadFile(): string {
  try {
    const dir = '.dexter/scratchpad';
    if (!existsSync(dir)) return '';

    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({
        path: join(dir, f),
        mtime: statSync(join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files.length > 0 ? files[0].path : '';
  } catch {
    return '';
  }
}
