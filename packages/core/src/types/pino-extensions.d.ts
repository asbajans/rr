// Pino logger type extensions for legacy format support
import pino, { Logger as PinoLogger } from 'pino';

export interface ExtendedLogger extends PinoLogger {
  // Allow legacy format: logger.error('message', error)
  error(message: string, error?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
  trace(message: string, meta?: unknown): void;
  fatal(message: string, error?: unknown): void;
}

declare module 'pino' {
  interface Logger extends ExtendedLogger {}
}