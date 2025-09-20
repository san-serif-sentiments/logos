import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigManager } from '../src/config';
import { LogosRouter } from '../src/router';
import { OllamaClient, ChatOptions, GenerateOptions } from '../src/services/ollamaClient';

class MockOllamaClient extends OllamaClient {
  public lastChat?: ChatOptions;
  public lastGenerate?: GenerateOptions;

  constructor(config: ConfigManager) {
    super(config);
  }

  // Override network calls
  public override async chat(options: ChatOptions): Promise<string> {
    this.lastChat = options;
    options.onToken?.('ok');
    return 'ok';
  }

  public override async generate(options: GenerateOptions): Promise<string> {
    this.lastGenerate = options;
    if (options.prompt.includes('schema')) {
      return JSON.stringify({ summary: 'ok', items: [] });
    }
    return 'generated text';
  }
}

suite('Logos Extension', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('logos-local.logos');
    if (!extension) {
      throw new Error('Extension should exist');
    }
    await extension.activate();
  });

  test('commands are registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('logos.reviewSelection'));
    assert.ok(commands.includes('logos.refactorSelection'));
    assert.ok(commands.includes('logos.explainSelection'));
    assert.ok(commands.includes('logos.generateDocsSelection'));
    assert.ok(commands.includes('logos.openChat'));
  });

  test('config manager exposes defaults', () => {
    const manager = new ConfigManager();
    const config = manager.get();
    assert.strictEqual(config.coderModel, 'qwen2.5-coder:7b');
    assert.strictEqual(config.writerModel, 'llama3.1:8b');
    assert.strictEqual(config.apiBaseUrl, 'http://localhost:11434');
  });

  test('router delegates to ollama client', async () => {
    const manager = new ConfigManager();
    const client = new MockOllamaClient(manager);
    const router = new LogosRouter(manager, client);
    await router.chat({ role: 'coder', history: [], stream: false });
    assert.ok(client.lastChat, 'chat should be invoked');
    const review = await router.review({ content: 'function a(){}', source: 'selection', truncated: false });
    assert.ok(client.lastGenerate, 'generate should be invoked');
    assert.strictEqual(review.summary, 'ok');
  });

  test('open chat command resolves without error', async () => {
    await vscode.commands.executeCommand('logos.openChat');
  });
});
