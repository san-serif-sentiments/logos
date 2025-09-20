import * as vscode from 'vscode';
import { ConfigManager, Role } from '../config';
import { LogosRouter } from '../router';
import * as fs from 'fs';

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatMessagePayload {
  type: 'chat';
  text: string;
  role: Role;
  overrideModel?: string;
}

interface ClearMessagePayload {
  type: 'clear';
}

interface InsertMessagePayload {
  type: 'insert';
  text: string;
}

type IncomingMessage = ChatMessagePayload | ClearMessagePayload | InsertMessagePayload | { type: 'ready' };

const HISTORY_KEY = 'logos.chatHistory';

export class LogosPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private history: StoredMessage[];
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly router: LogosRouter,
    private readonly config: ConfigManager
  ) {
    this.history = context.workspaceState.get<StoredMessage[]>(HISTORY_KEY, []);
    this.disposables.push(
      this.config.onDidChange(() => {
        this.postConfig();
      })
    );
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        vscode.Uri.joinPath(this.context.extensionUri, 'src', 'panel'),
      ],
    };

    webview.html = this.getHtml(webview);

    webview.onDidReceiveMessage((message: IncomingMessage) => {
      this.handleMessage(message);
    });

    this.postState();
  }

  public reveal(): void {
    if (this.view?.show) {
      this.view.show(true);
    } else {
      vscode.commands.executeCommand('logos.chat.focus');
    }
  }

  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private async handleMessage(message: IncomingMessage): Promise<void> {
    switch (message.type) {
      case 'chat':
        await this.handleChat(message);
        break;
      case 'clear':
        this.clearHistory();
        break;
      case 'insert':
        await this.insertIntoEditor(message.text);
        break;
      case 'ready':
        this.postState();
        break;
      default:
        break;
    }
  }

  private async handleChat(message: ChatMessagePayload): Promise<void> {
    const trimmed = message.text.trim();
    if (!trimmed) {
      return;
    }

    const userEntry: StoredMessage = {
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    this.history.push(userEntry);
    this.persistHistory();
    this.postState();

    if (!this.view) {
      return;
    }

    let assistantResponse = '';
    try {
      await this.router.chat({
        role: message.role,
        overrideModel: message.overrideModel,
        history: this.history.map((entry) => ({ role: entry.role, content: entry.content })),
        stream: true,
        onToken: (token) => {
          assistantResponse += token;
          this.view?.webview.postMessage({ type: 'chatStream', token });
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Logos chat failed: ${messageText}`);
      this.view.webview.postMessage({ type: 'chatError', message: messageText });
      return;
    }

    const assistantEntry: StoredMessage = {
      role: 'assistant',
      content: assistantResponse.trim(),
      timestamp: Date.now(),
    };
    this.history.push(assistantEntry);
    this.persistHistory();
    this.postState();
    this.view.webview.postMessage({ type: 'chatComplete' });
  }

  private clearHistory(): void {
    this.history = [];
    this.persistHistory();
    this.postState();
  }

  private async insertIntoEditor(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Logos: No active editor to insert text.');
      return;
    }
    await editor.edit((builder) => {
      const position = editor.selection.active;
      builder.insert(position, text);
    });
  }

  private persistHistory(): void {
    if (this.history.length > 40) {
      this.history = this.history.slice(-40);
    }
    void this.context.workspaceState.update(HISTORY_KEY, this.history);
  }

  private postState(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.postMessage({
      type: 'state',
      history: this.history,
      config: this.buildConfigSnapshot(),
    });
  }

  private postConfig(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.postMessage({
      type: 'config',
      config: this.buildConfigSnapshot(),
    });
  }

  private buildConfigSnapshot() {
    const cfg = this.config.get();
    return {
      models: {
        writer: cfg.writerModel,
        coder: cfg.coderModel,
        scratchpad: cfg.scratchModel,
        default: cfg.defaultModel,
      },
      streaming: cfg.enableStreaming,
    };
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'panel', 'webview.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'panel', 'webview.css'));
    const templateUri = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'panel', 'webview.html');
    const nonce = this.getNonce();
    const template = fs.readFileSync(templateUri.fsPath, { encoding: 'utf8' });
    return template
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{styleUri\}\}/g, styleUri.toString())
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
      .replace(/\{\{nonce\}\}/g, nonce);
  }

  private getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
