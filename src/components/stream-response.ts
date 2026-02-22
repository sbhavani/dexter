import chalk from 'chalk';

/**
 * Streaming response mode - streams agent thinking and tool results
 * token-by-token to the terminal using ANSI escape codes.
 */

export interface StreamConfig {
  /** Enable streaming output */
  enabled: boolean;
  /** Write to stdout (default: process.stdout) */
  output?: typeof process.stdout;
  /** Delay between tokens in ms (default: 10) */
  tokenDelay?: number;
  /** Show thinking indicator */
  showThinking?: boolean;
  /** Show cursor during streaming */
  showCursor?: boolean;
}

interface StreamState {
  thinking: string;
  answer: string;
  isStreaming: boolean;
  currentStream: 'thinking' | 'answer' | null;
}

/**
 * ANSI escape codes for terminal control
 */
const ANSI = {
  // Cursor controls
  clearLine: '\r\x1b[2K', // Clear current line
  cursorUp: (n: number) => `\x1b[${n}A`,
  cursorDown: (n: number) => `\x1b[${n}B`,
  cursorForward: (n: number) => `\x1b[${n}C`,
  cursorBack: (n: number) => `\x1b[${n}D`,
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',

  // Styles
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors (256 color)
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

const DEFAULT_CONFIG: Required<StreamConfig> = {
  enabled: false,
  output: process.stdout,
  tokenDelay: 8,
  showThinking: true,
  showCursor: true,
};

/**
 * Token streaming handler for agent responses
 */
export class StreamResponse {
  private config: Required<StreamConfig>;
  private state: StreamState = {
    thinking: '',
    answer: '',
    isStreaming: false,
    currentStream: null,
  };

  constructor(config: StreamConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enable or disable streaming
   */
  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
  }

  /**
   * Check if streaming is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Handle a streaming token
   */
  onToken(token: string, stream: 'thinking' | 'answer', done: boolean) {
    if (!this.config.enabled) return;

    if (done) {
      this.endStream(stream);
      return;
    }

    // Start streaming if not already
    if (!this.state.isStreaming) {
      this.startStream(stream);
    }

    // Only process if token is for the current stream
    if (stream !== this.state.currentStream) {
      // Switch streams if needed
      if (this.state.currentStream === 'thinking' && stream === 'answer') {
        // Finish thinking stream, start answer
        this.endStream('thinking');
        this.startStream('answer');
      } else if (stream === this.state.currentStream) {
        // Just accumulate for current stream
      } else {
        return;
      }
    }

    this.appendToken(token);
  }

  /**
   * Start streaming a new response
   */
  private startStream(stream: 'thinking' | 'answer') {
    this.state.isStreaming = true;
    this.state.currentStream = stream;

    const { output } = this.config;

    if (stream === 'thinking' && this.config.showThinking) {
      output.write('\n');
      output.write(`${ANSI.dim}🤔 ${ANSI.cyan}Thinking${ANSI.reset}${ANSI.dim}:${ANSI.reset} `);
    } else if (stream === 'answer') {
      output.write('\n');
      output.write(`${ANSI.dim}💬 ${ANSI.green}Answer${ANSI.reset}${ANSI.dim}:${ANSI.reset} `);
    }
  }

  /**
   * Append a token to the current stream
   */
  private appendToken(token: string) {
    const { output } = this.config;

    if (this.state.currentStream === 'thinking' && this.config.showThinking) {
      // Stream thinking - use dim cyan color
      output.write(`${ANSI.dim}${ANSI.cyan}${token}${ANSI.reset}`);
    } else if (this.state.currentStream === 'answer') {
      // Stream answer - use green color for content
      output.write(`${ANSI.green}${token}${ANSI.reset}`);
    }

    // Flush output for immediate display
    output.flush?.();
  }

  /**
   * End the current stream
   */
  private endStream(stream: 'thinking' | 'answer') {
    const { output, showCursor } = this.config;

    if (stream === 'thinking') {
      // End thinking - show as completed
      if (this.config.showThinking) {
        output.write(` ${ANSI.dim}${ANSI.yellow}(thinking complete)${ANSI.reset}\n`);
      } else {
        output.write('\n');
      }
      this.state.thinking = '';
    } else if (stream === 'answer') {
      // End answer
      if (showCursor) {
        // Remove cursor if shown
        output.write(`${ANSI.clearLine}\r`);
      }
      output.write('\n');
      this.state.answer = '';
    }

    // Reset state if both streams complete
    if (stream === 'answer') {
      this.state.isStreaming = false;
      this.state.currentStream = null;
    }
  }

  /**
   * Print a thinking message (non-streaming)
   */
  printThinking(message: string) {
    if (!this.config.enabled || !this.config.showThinking) return;

    const { output } = this.config;
    output.write('\n');
    output.write(`${ANSI.dim}🤔 ${ANSI.cyan}Thinking${ANSI.reset}: ${ANSI.cyan}${message}${ANSI.reset}\n`);
    output.flush?.();
  }

  /**
   * Print tool execution start
   */
  printToolStart(tool: string, args: Record<string, unknown>) {
    if (!this.config.enabled) return;

    const { output } = this.config;
    const argsStr = Object.keys(args).length > 0 ? ` ${JSON.stringify(args)}` : '';
    output.write(`${ANSI.dim}🔧 ${ANSI.blue}Tool${ANSI.reset}: ${tool}${ANSI.dim}${argsStr}${ANSI.reset}\n`);
    output.flush?.();
  }

  /**
   * Print tool execution result
   */
  printToolResult(tool: string, result: string, duration: number) {
    if (!this.config.enabled) return;

    const { output } = this.config;
    const truncated = result.length > 200 ? result.slice(0, 200) + '...' : result;
    output.write(`${ANSI.dim}✅ ${ANSI.green}${tool}${ANSI.reset}${ANSI.dim} (${duration}ms)${ANSI.reset}\n`);
    output.write(`${ANSI.dim}${truncated}${ANSI.reset}\n`);
    output.flush?.();
  }

  /**
   * Print final answer (completed)
   */
  printAnswer(answer: string) {
    if (!this.config.enabled) return;

    const { output } = this.config;
    output.write('\n');
    output.write(`${ANSI.bold}${ANSI.green}Answer:${ANSI.reset}\n`);
    output.write(`${answer}\n\n`);
    output.flush?.();
  }

  /**
   * Clear the current streaming line
   */
  clearLine() {
    if (!this.config.enabled) return;
    this.config.output.write(ANSI.clearLine);
  }

  /**
   * Reset the streaming state
   */
  reset() {
    this.state = {
      thinking: '',
      answer: '',
      isStreaming: false,
      currentStream: null,
    };
  }
}

/**
 * Create a default stream response instance
 */
export function createStreamResponse(config: StreamConfig = {}): StreamResponse {
  return new StreamResponse(config);
}
