import chalk from 'chalk';
import type { TokenEvent, StreamingTokenType } from '../agent/types.js';

/**
 * StreamingRenderer renders token events to the terminal with ANSI styling.
 * It provides visual distinction between different token types (thinking, tool, answer).
 */
export class StreamingRenderer {
  private lastTokenType: StreamingTokenType | null = null;

  /**
   * Render a token event to the terminal
   */
  renderToken(event: TokenEvent): void {
    const styledContent = this.styleContent(event.content, event.tokenType);

    // Print to stdout (not stderr to keep errors separate)
    process.stdout.write(styledContent);

    this.lastTokenType = event.tokenType;
  }

  /**
   * Render a control event (streaming start/end)
   */
  renderControl(message: string, type: 'start' | 'end'): void {
    if (type === 'start') {
      process.stdout.write(chalk.dim('[streaming] ') + message + '\n');
    }
  }

  /**
   * Apply styling based on token type
   */
  private styleContent(content: string, tokenType: StreamingTokenType): string {
    switch (tokenType) {
      case 'thinking':
        // Dim cyan for thinking content
        return chalk.dim.cyan(content);
      case 'tool':
        // Yellow for tool-related content
        return chalk.yellow(content);
      case 'answer':
        // White for final answer content
        return chalk.white(content);
      default:
        return content;
    }
  }

  /**
   * Clear the last rendered content (for cleanup)
   */
  clear(): void {
    // Clear current line
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }

  /**
   * Get the last rendered token type
   */
  getLastTokenType(): StreamingTokenType | null {
    return this.lastTokenType;
  }
}

/**
 * Create a default streaming renderer instance
 */
export function createStreamingRenderer(): StreamingRenderer {
  return new StreamingRenderer();
}
