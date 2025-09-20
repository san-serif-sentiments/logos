import * as vscode from 'vscode';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import { ConfigManager } from '../config';

const exec = promisify(execCb);

type Source = 'selection' | 'file' | 'git-staged' | 'git-working';

export interface ContextResult {
  content: string;
  truncated: boolean;
  source: Source;
  warning?: string;
  languageId?: string;
  fileName?: string;
}

export class ContextResolver {
  constructor(private readonly config: ConfigManager) {}

  public async getSelectionOrFile(): Promise<ContextResult | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Logos: No active editor.');
      return undefined;
    }

    if (editor.selection && !editor.selection.isEmpty) {
      return this.getSelection();
    }
    return this.getFullFile();
  }

  public async getSelection(): Promise<ContextResult | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Logos: No active editor.');
      return undefined;
    }

    const maxChars = this.config.get().maxInputChars;
    const selection = editor.selection;
    if (!selection || selection.isEmpty) {
      vscode.window.showWarningMessage('Logos: No selection found.');
      return undefined;
    }

    const content = editor.document.getText(selection);
    const source: Source = 'selection';

    const { truncated, value, warning } = this.applyLimit(content, maxChars);
    if (warning) {
      vscode.window.showWarningMessage(warning);
    }

    return {
      content: value,
      truncated,
      source,
      warning,
      languageId: editor.document.languageId,
      fileName: editor.document.fileName,
    };
  }

  public async getFullFile(): Promise<ContextResult | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Logos: No active editor.');
      return undefined;
    }

    const maxChars = this.config.get().maxInputChars;
    const content = editor.document.getText();
    const source: Source = 'file';

    const { truncated, value, warning } = this.applyLimit(content, maxChars);
    if (warning) {
      vscode.window.showWarningMessage(warning);
    }

    return {
      content: value,
      truncated,
      source,
      warning,
      languageId: editor.document.languageId,
      fileName: editor.document.fileName,
    };
  }

  public async getGitDiff(kind: 'staged' | 'working'): Promise<ContextResult | undefined> {
    const maxChars = this.config.get().maxInputChars;
    const repoCheck = await this.isInsideGitRepo();
    if (!repoCheck) {
      vscode.window.showWarningMessage('Logos: Current workspace is not a git repository.');
      return undefined;
    }

    const args = kind === 'staged' ? '--cached -U3' : '-U3';
    try {
      const { stdout } = await exec(`git diff ${args}`);
      if (!stdout.trim()) {
        vscode.window.showInformationMessage('Logos: The selected git diff is empty.');
        return undefined;
      }
      const { truncated, value, warning } = this.applyLimit(stdout, maxChars);
      if (warning) {
        vscode.window.showWarningMessage(warning);
      }
      return {
        content: value,
        truncated,
        source: kind === 'staged' ? 'git-staged' : 'git-working',
        warning,
      };
    } catch (error) {
      vscode.window.showErrorMessage(`Logos: Unable to read git diff - ${String(error)}`);
      return undefined;
    }
  }

  private async isInsideGitRepo(): Promise<boolean> {
    try {
      const { stdout } = await exec('git rev-parse --is-inside-work-tree');
      return stdout.trim() === 'true';
    } catch (error) {
      return false;
    }
  }

  private applyLimit(value: string, maxChars: number): { value: string; truncated: boolean; warning?: string } {
    if (value.length <= maxChars) {
      return { value, truncated: false };
    }
    const truncatedValue = value.slice(0, maxChars);
    const warning = `Logos: Input truncated to ${maxChars} characters. Consider narrowing the selection or using git diff.`;
    return { value: truncatedValue, truncated: true, warning };
  }
}
