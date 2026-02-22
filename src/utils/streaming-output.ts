/**
 * Streaming output utility for terminal with ANSI escape codes.
 * Provides token-by-token streaming for agent thinking and tool results.
 */

import process from 'node:process';
import { IS_TTY, clearLine, cursorLeft, cursorForward } from './tty.js';

/**
 * ANSI escape code utilities
 */
export const Ansi = {
  // Reset sequences
  reset: '\x1b[0m',

  // Text styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Text colors - standard 16 colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  default: '\x1b[39m',

  // Bright colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  // Cursor control
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',

  // Clear
  clearLine: '\x1b[2K',
  clearScreen: '\x1b[2J',
} as const;

/**
 * Streaming output modes
 */
export type StreamMode = 'thinking' | 'tool' | 'answer' | 'tool_result';

/**
 * Streaming configuration
 */
export interface StreamConfig {
  /** Whether to use ANSI codes (false when not a TTY) */
  useAnsi: boolean;
  /** Delay between tokens in ms (0 for instant) */
  tokenDelay: number;
  /** Whether to show cursor during streaming */
  showCursor: boolean;
  /** Custom color for the stream type */
  color: string;
}

/**
 * Default streaming configurations per mode
 */
const DEFAULT_CONFIGS: Record<StreamMode, Partial<StreamConfig>> = {
  thinking: {
    color: Ansi.dim + Ansi.cyan,
    tokenDelay: 0,
  },
  tool: {
    color: Ansi.yellow,
    tokenDelay: 0,
  },
  answer: {
    color: Ansi.white,
    tokenDelay: 0,
  },
  tool_result: {
    color: Ansi.green,
    tokenDelay: 0,
  },
};

/**
 * Streaming output handler for terminal
 */
export class StreamingOutput {
  private buffer: string = '';
  private lineLength: number = 0;
  private config: StreamConfig;
  private mode: StreamMode;
  private isStreaming: boolean = false;
  private writeStream: typeof process.stdout;

  constructor(
    mode: StreamMode,
    customConfig?: Partial<StreamConfig>,
    writeStream: typeof process.stdout = process.stdout
  ) {
    const isTty = writeStream.isTTY ?? IS_TTY;
    this.config = {
      useAnsi: isTty && !process.env.NO_ANSI,
      tokenDelay: customConfig?.tokenDelay ?? DEFAULT_CONFIGS[mode].tokenDelay ?? 0,
      showCursor: customConfig?.showCursor ?? true,
      color: customConfig?.color ?? DEFAULT_CONFIGS[mode].color ?? '',
    };
    this.mode = mode;
    this.writeStream = writeStream;
  }

  /**
   * Start streaming output
   */
  start(): void {
    this.isStreaming = true;
    this.buffer = '';
    this.lineLength = 0;
    if (this.config.useAnsi && this.config.showCursor) {
      this.writeStream.write(Ansi.hideCursor);
    }
  }

  /**
   * Write a token to the stream
   */
  async write(token: string): Promise<void> {
    if (!this.isStreaming) {
      this.start();
    }

    this.buffer += token;

    // Write with ANSI color if enabled
    const coloredToken = this.config.useAnsi ? `${this.config.color}${token}${Ansi.reset}` : token;
    this.writeStream.write(coloredToken);

    // Track line length for cursor management
    this.lineLength += token.length;

    // Apply delay if configured (for visual effect)
    if (this.config.tokenDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.tokenDelay));
    }
  }

  /**
   * Write multiple tokens at once
   */
  async writeTokens(tokens: string[]): Promise<void> {
    for (const token of tokens) {
      await this.write(token);
    }
  }

  /**
   * Write a complete string (possibly with newlines)
   */
  async writeText(text: string): Promise<void> {
    if (!this.isStreaming) {
      this.start();
    }

    this.buffer += text;

    // Handle newlines properly - reset line length tracking
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i > 0) {
        this.writeStream.write('\n');
        this.lineLength = 0;
      }

      if (line.length > 0) {
        const coloredLine = this.config.useAnsi ? `${this.config.color}${line}${Ansi.reset}` : line;
        this.writeStream.write(coloredLine);
        this.lineLength += line.length;
      }
    }

    if (this.config.tokenDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.tokenDelay));
    }
  }

  /**
   * End streaming output
   */
  end(): void {
    this.isStreaming = false;
    if (this.config.useAnsi && this.config.showCursor) {
      this.writeStream.write(Ansi.showCursor);
    }
    // Ensure we end with a newline if there's content
    if (this.buffer.length > 0 && !this.buffer.endsWith('\n')) {
      this.writeStream.write('\n');
    }
  }

  /**
   * Get the current buffered content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Clear the current line (for updates)
   */
  clearLine(): void {
    if (this.config.useAnsi) {
      this.writeStream.write(cursorLeft + Ansi.clearLine);
    } else {
      this.writeStream.write('\n');
    }
    this.lineLength = 0;
  }

  /**
   * Check if currently streaming
   */
  get streaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<StreamConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Global streaming manager that handles multiple concurrent streams
 */
class StreamManager {
  private activeStreams: Map<string, StreamingOutput> = new Map();
  private defaultConfig: Partial<StreamConfig> = {};

  /**
   * Set default configuration for new streams
   */
  setDefaultConfig(config: Partial<StreamConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * Create or get an existing stream by ID
   */
  getOrCreate(mode: StreamMode, id?: string): StreamingOutput {
    const streamId = id ?? mode;
    let stream = this.activeStreams.get(streamId);
    if (!stream) {
      stream = new StreamingOutput(mode, this.defaultConfig);
      this.activeStreams.set(streamId, stream);
    }
    return stream;
  }

  /**
   * End a specific stream
   */
  end(id: string): void {
    const stream = this.activeStreams.get(id);
    if (stream) {
      stream.end();
      this.activeStreams.delete(id);
    }
  }

  /**
   * End all streams
   */
  endAll(): void {
    for (const stream of this.activeStreams.values()) {
      stream.end();
    }
    this.activeStreams.clear();
  }

  /**
   * Check if any stream is active
   */
  get hasActiveStreams(): boolean {
    return this.activeStreams.size > 0;
  }
}

// Global stream manager instance
export const streamManager = new StreamManager();

/**
 * Helper to create a quick streaming output
 */
export function createStream(mode: StreamMode, config?: Partial<StreamConfig>): StreamingOutput {
  return new StreamingOutput(mode, config);
}

/**
 * Stream text with a specific style
 */
export async function streamText(
  text: string,
  mode: StreamMode,
  config?: Partial<StreamConfig>
): Promise<void> {
  const stream = new StreamingOutput(mode, config);
  stream.start();
  await stream.writeText(text);
  stream.end();
}
