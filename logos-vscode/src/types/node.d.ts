declare module 'fs' {
  export function readFileSync(path: string, options?: { encoding?: string }): string;
}

declare module 'util' {
  export function promisify<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => Promise<any>;
}

declare module 'child_process' {
  export function exec(
    command: string,
    callback?: (error: Error | null, stdout: string, stderr: string) => void
  ): void;
}

declare module 'assert' {
  const assert: any;
  export = assert;
}

declare module 'path' {
  export function resolve(...segments: string[]): string;
}

declare module '@vscode/test-electron' {
  export function runTests(options: { extensionDevelopmentPath: string; extensionTestsPath: string }): Promise<void>;
}

declare const __dirname: string;
declare const process: {
  exit(code?: number): void;
};
