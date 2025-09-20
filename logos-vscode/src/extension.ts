import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { LogosRouter } from './router';
import { OllamaClient } from './services/ollamaClient';
import { ContextResolver } from './services/contextResolver';
import { LogosCommandManager } from './commands';
import { LogosPanel } from './panel/logosPanel';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = new ConfigManager();
  const client = new OllamaClient(config);
  const router = new LogosRouter(config, client);
  const contextResolver = new ContextResolver(config);
  const commands = new LogosCommandManager(router, contextResolver);

  commands.register(context);

  const panel = new LogosPanel(context, router, config);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('logos.chat', panel),
    vscode.commands.registerCommand('logos.openChat', () => panel.reveal()),
    { dispose: () => panel.dispose() }
  );
}

export function deactivate(): void {
  // No-op – resources are disposed via subscriptions
}
