interface LogFn {
  <T extends object>(obj: object, msg?: string, ...args: any[]): void;
  (obj: unknown, msg?: string, ...args: any[]): void;
  (msg: string, ...args: any[]): void;
}

export interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

const noop = () => {};

export const defaultLogger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};
