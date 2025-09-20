import * as vscode from 'vscode';
import { LogosRouter, TaskContext } from './router';
import { ContextResolver, ContextResult } from './services/contextResolver';
import { applyPatchToEditor } from './services/patchApplier';
import { ReviewItem, ReviewResponse } from './services/schema';

export class LogosCommandManager {
  private readonly output = vscode.window.createOutputChannel('Logos');

  constructor(private readonly router: LogosRouter, private readonly contextResolver: ContextResolver) {}

  public register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('logos.reviewSelection', () => this.handleReview()),
      vscode.commands.registerCommand('logos.refactorSelection', () => this.handleRefactor()),
      vscode.commands.registerCommand('logos.explainSelection', () => this.handleExplain()),
      vscode.commands.registerCommand('logos.generateDocsSelection', () => this.handleDocs())
    );
  }

  private async handleReview(): Promise<void> {
    const pick = await vscode.window.showQuickPick(
      [
        { label: 'Use selection', id: 'selection' },
        { label: 'Use current file', id: 'file' },
        { label: 'Use Git diff (staged)', id: 'git-staged' },
        { label: 'Use Git diff (working tree)', id: 'git-working' },
      ],
      { placeHolder: 'Choose review context for Logos' }
    );
    if (!pick) {
      return;
    }

    const context = await this.resolveContext(pick.id as 'selection' | 'file' | 'git-staged' | 'git-working');
    if (!context) {
      return;
    }

    try {
      const response = await this.router.review(context);
      this.presentReview('Review', response);
    } catch (error) {
      this.handleError('Review failed', error);
    }
  }

  private async handleRefactor(): Promise<void> {
    const contextResult = await this.contextResolver.getSelectionOrFile();
    const context = contextResult ? this.toTaskContext(contextResult) : undefined;
    if (!context) {
      return;
    }
    try {
      const response = await this.router.refactor(context);
      this.presentReview('Refactor suggestions', response, true);
    } catch (error) {
      this.handleError('Refactor failed', error);
    }
  }

  private async handleExplain(): Promise<void> {
    const contextResult = await this.contextResolver.getSelectionOrFile();
    const context = contextResult ? this.toTaskContext(contextResult) : undefined;
    if (!context) {
      return;
    }
    try {
      const text = await this.router.explain(context);
      await this.presentTextResult('Explanation', text);
    } catch (error) {
      this.handleError('Explain failed', error);
    }
  }

  private async handleDocs(): Promise<void> {
    const contextResult = await this.contextResolver.getSelectionOrFile();
    const context = contextResult ? this.toTaskContext(contextResult) : undefined;
    if (!context) {
      return;
    }
    try {
      const text = await this.router.generateDocs(context);
      await this.presentTextResult('Generated docs', text);
    } catch (error) {
      this.handleError('Doc generation failed', error);
    }
  }

  private async resolveContext(id: 'selection' | 'file' | 'git-staged' | 'git-working'): Promise<TaskContext | undefined> {
    if (id === 'selection') {
      const result = await this.contextResolver.getSelection();
      return result ? this.toTaskContext(result) : undefined;
    }
    if (id === 'file') {
      const result = await this.contextResolver.getFullFile();
      return result ? this.toTaskContext(result) : undefined;
    }
    if (id === 'git-staged') {
      const result = await this.contextResolver.getGitDiff('staged');
      return result ? this.toTaskContext(result) : undefined;
    }
    if (id === 'git-working') {
      const result = await this.contextResolver.getGitDiff('working');
      return result ? this.toTaskContext(result) : undefined;
    }
    return undefined;
  }

  private toTaskContext(result: ContextResult): TaskContext {
    return {
      content: result.content,
      truncated: result.truncated,
      source: result.source,
      fileName: result.fileName,
      languageId: result.languageId,
    };
  }

  private presentReview(title: string, response: ReviewResponse, allowApply = false): void {
    this.output.appendLine(`=== ${title} ===`);
    this.output.appendLine(response.summary);
    for (const item of response.items) {
      this.output.appendLine(`- [${item.severity}] (${item.category}) lines ${item.lines.start}-${item.lines.end}`);
      this.output.appendLine(`  ${item.message}`);
      if (item.patch.trim()) {
        this.output.appendLine('  Patch available.');
      }
    }
    this.output.appendLine('');
    this.output.show(true);

    const actionable = response.items.filter((item) => item.patch && item.patch.trim().length > 0);
    if (allowApply || actionable.length > 0) {
      this.offerPatchSelection(actionable);
    }
  }

  private async offerPatchSelection(items: ReviewItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const picks = items.map((item, index) => ({
      label: `Apply patch ${index + 1}: [${item.severity}] ${item.category}`,
      description: item.message,
      item,
    }));
    const choice = await vscode.window.showQuickPick(picks, {
      placeHolder: 'Apply a suggested patch from Logos',
    });
    if (!choice) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Logos: No active editor to apply patch.');
      return;
    }
    await applyPatchToEditor(editor, choice.item.patch);
  }

  private async presentTextResult(title: string, text: string): Promise<void> {
    const trimmed = text.trim();
    this.output.appendLine(`=== ${title} ===`);
    this.output.appendLine(trimmed);
    this.output.appendLine('');
    this.output.show(true);

    const action = await vscode.window.showInformationMessage(`${title} ready`, 'Insert into Editor', 'Copy');
    if (!action) {
      return;
    }

    if (action === 'Insert into Editor') {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Logos: No active editor to insert text.');
        return;
      }
      await editor.edit((builder) => {
        const position = editor.selection.active;
        builder.insert(position, `\n${trimmed}\n`);
      });
    } else if (action === 'Copy') {
      await vscode.env.clipboard.writeText(trimmed);
      vscode.window.showInformationMessage('Logos: Copied to clipboard.');
    }
  }

  private handleError(prefix: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`${prefix}: ${message}`);
    this.output.appendLine(`Error: ${message}`);
    this.output.show(true);
  }
}
