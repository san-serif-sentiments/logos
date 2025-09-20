import * as vscode from 'vscode';

export type SeverityGate = 'S1' | 'S1S2' | 'off';

export interface LogosConfig {
  defaultModel: string;
  writerModel: string;
  coderModel: string;
  scratchModel: string;
  apiBaseUrl: string;
  maxInputChars: number;
  severityGate: SeverityGate;
  enableStreaming: boolean;
}

function readConfig(): LogosConfig {
  const cfg = vscode.workspace.getConfiguration('logos');
  return {
    defaultModel: cfg.get<string>('defaultModel', 'qwen2.5-coder:7b'),
    writerModel: cfg.get<string>('writerModel', 'llama3.1:8b'),
    coderModel: cfg.get<string>('coderModel', 'qwen2.5-coder:7b'),
    scratchModel: cfg.get<string>('scratchModel', 'phi3:3.8b'),
    apiBaseUrl: cfg.get<string>('apiBaseUrl', 'http://localhost:11434'),
    maxInputChars: cfg.get<number>('maxInputChars', 20000),
    severityGate: cfg.get<SeverityGate>('severityGate', 'S1'),
    enableStreaming: cfg.get<boolean>('enableStreaming', true),
  };
}

export class ConfigManager {
  private current: LogosConfig;
  private readonly emitter = new vscode.EventEmitter<LogosConfig>();

  public readonly onDidChange = this.emitter.event;

  constructor() {
    this.current = readConfig();
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('logos')) {
        this.current = readConfig();
        this.emitter.fire(this.current);
      }
    });
  }

  public get(): LogosConfig {
    return this.current;
  }
}

export type Role = 'writer' | 'coder' | 'scratchpad';

export function getModelForRole(config: LogosConfig, role: Role | undefined, overrideModel?: string): string {
  if (overrideModel && overrideModel.trim().length > 0) {
    return overrideModel.trim();
  }
  switch (role) {
    case 'writer':
      return config.writerModel;
    case 'scratchpad':
      return config.scratchModel;
    case 'coder':
      return config.coderModel;
    default:
      return config.defaultModel;
  }
}
