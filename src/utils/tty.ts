/**
 * TTY detection utilities
 */

import process from 'node:process';

/**
 * Whether we're running in a TTY
 */
export const IS_TTY = process.stdout.isTTY ?? false;

/**
 * Get terminal columns
 */
export function getColumns(): number {
  return process.stdout.columns ?? 80;
}

/**
 * Get terminal rows
 */
export function getRows(): number {
  return process.stdout.rows ?? 24;
}

/**
 * Cursor control ANSI sequences
 */
export const cursorLeft = '\x1b[G'; // Cursor to column 1
export const cursorForward = (n: number) => `\x1b[${n}C`; // Cursor forward n columns
export const cursorBackward = (n: number) => `\x1b[${n}D`; // Cursor backward n columns
export const cursorSave = '\x1b[s'; // Save cursor position
export const cursorRestore = '\x1b[u'; // Restore cursor position

/**
 * Clear sequences
 */
export const clearLine = '\x1b[2K'; // Clear current line
export const clearScreen = '\x1b[2J'; // Clear screen

/**
 * Get cursor position (not widely supported)
 */
export function getCursorPosition(): Promise<{ col: number; row: number }> {
  return new Promise((resolve) => {
    // Request cursor position report
    process.stdout.write('\x1b[6n');

    // Note: This is a simplified version - real implementation would need
    // to read from stdin which is more complex
    resolve({ col: 1, row: 1 });
  });
}
