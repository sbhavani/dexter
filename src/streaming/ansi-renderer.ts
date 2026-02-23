import chalk from 'chalk';
import type { StreamController } from './stream-controller.js';
import type { StreamType } from './types.js';

/**
 * ANSI escape codes for terminal formatting
 */
const ANSI = {
  /** Reset formatting */
  RESET: '\x1b[0m',
  /** Bold */
  BOLD: '\x1b[1m',
  /** Dim */
  DIM: '\x1b[2m',
  /** Italic */
  ITALIC: '\x1b[3m',
  /** Underline */
  UNDERLINE: '\x1b[4m',
  /** Clear line from cursor to end */
  CLEAR_LINE: '\x1b[K',
  /** Move cursor up n lines */
  CURSOR_UP: (n: number) => `\x1b[${n}A`,
  /** Carriage return */
  CR: '\r',
};

/**
 * Color themes for different stream types
 */
interface StreamColors {
  prefix: (text: string) => string;
  content: (text: string) => string;
}

/**
 * Default stream color themes
 */
const STREAM_COLORS: Record<StreamType, StreamColors> = {
  thinking: {
    prefix: (text: string) => chalk.cyan.bold(text),
    content: (text: string) => chalk.cyan.dim(text),
  },
  tool: {
    prefix: (text: string) => chalk.yellow.bold(text),
    content: (text: string) => chalk.yellow(text),
  },
  answer: {
    prefix: (text: string) => chalk.green.bold(text),
    content: (text: string) => chalk.white(text),
  },
};

/**
 * Renders streaming content with ANSI escape codes for colors and cursor control.
 */
export class ANSIStreamRenderer {
  private controller: StreamController;
  private useColor: boolean;
  private currentLineLength: number = 0;

  constructor(controller: StreamController) {
    this.controller = controller;
    this.useColor = controller.isColorEnabled();
  }

  /**
   * Render thinking content with streaming
   */
  renderThinking(delta: string): void {
    this.render(delta, 'thinking');
  }

  /**
   * Render tool result content with streaming
   */
  renderToolResult(delta: string): void {
    this.render(delta, 'tool');
  }

  /**
   * Render answer content with streaming
   */
  renderAnswer(delta: string): void {
    this.render(delta, 'answer');
  }

  /**
   * Internal render method
   */
  private render(delta: string, type: StreamType): void {
    if (!delta) {
      return;
    }

    // Format the content
    let formatted: string;
    if (this.useColor) {
      const colors = STREAM_COLORS[type];
      formatted = colors.content(delta);
    } else {
      formatted = delta;
    }

    // Write to controller
    switch (type) {
      case 'thinking':
        this.controller.writeThinking(formatted);
        break;
      case 'tool':
        this.controller.writeToolResult('default', formatted);
        break;
      case 'answer':
        this.controller.writeAnswer(formatted);
        break;
    }

    // Track line length for cursor control
    this.currentLineLength += delta.length;
  }

  /**
   * Clear current line (for overwriting)
   */
  clearLine(): void {
    if (!this.useColor) {
      return;
    }
    this.controller.carriageReturn();
    this.controller.clearLine();
    this.currentLineLength = 0;
  }

  /**
   * Move cursor up and clear line (for updating content)
   */
  moveUpAndClear(lines: number = 1): void {
    if (!this.useColor) {
      return;
    }
    for (let i = 0; i < lines; i++) {
      this.controller.moveUp(1);
    }
    this.controller.clearLine();
    this.currentLineLength = 0;
  }

  /**
   * Flush all pending content
   */
  flush(): void {
    this.controller.flushAll();
  }

  /**
   * Render a complete line (with newline)
   */
  renderLine(content: string, type: StreamType): void {
    this.flush();
    if (this.useColor) {
      const colors = STREAM_COLORS[type];
      this.controller.writeLine(colors.content(content));
    } else {
      this.controller.writeLine(content);
    }
  }

  /**
   * Render thinking prefix
   */
  renderThinkingPrefix(): void {
    if (this.useColor) {
      const prefix = STREAM_COLORS.thinking.prefix('[Thinking] ');
      this.controller.writeThinking(prefix);
    } else {
      this.controller.writeThinking('[Thinking] ');
    }
  }

  /**
   * Render tool prefix
   */
  renderToolPrefix(toolName: string): void {
    if (this.useColor) {
      const prefix = STREAM_COLORS.tool.prefix(`[${toolName}] `);
      this.controller.writeToolResult(toolName, prefix);
    } else {
      this.controller.writeToolResult(toolName, `[${toolName}] `);
    }
  }

  /**
   * Render answer prefix
   */
  renderAnswerPrefix(): void {
    if (this.useColor) {
      // No prefix for answer to keep it clean
      return;
    }
  }

  /**
   * Update color support
   */
  setColorEnabled(enabled: boolean): void {
    this.useColor = enabled;
  }

  /**
   * Get current line length
   */
  getLineLength(): number {
    return this.currentLineLength;
  }

  /**
   * Reset line length tracking
   */
  resetLineLength(): void {
    this.currentLineLength = 0;
  }
}
