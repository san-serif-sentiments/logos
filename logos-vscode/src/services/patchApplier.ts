import * as vscode from 'vscode';
import { applyPatch as applyUnifiedPatch } from 'diff';

export async function applyPatchToEditor(editor: vscode.TextEditor, patch: string): Promise<boolean> {
  const trimmed = patch.trim();
  if (!trimmed) {
    vscode.window.showInformationMessage('Logos: No patch provided.');
    return false;
  }

  const original = editor.document.getText();
  const patched = applyUnifiedPatch(original, patch);
  if (patched === undefined || patched === false) {
    vscode.window.showErrorMessage('Logos: Unable to apply patch automatically. Opening patch for manual review.');
    const doc = await vscode.workspace.openTextDocument({ language: 'diff', content: patch });
    await vscode.window.showTextDocument(doc, { preview: false });
    return false;
  }

  if (patched === original) {
    vscode.window.showInformationMessage('Logos: Patch did not change the document.');
    return false;
  }

  const fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(original.length)
  );

  await editor.edit((builder) => {
    builder.replace(fullRange, patched);
  });

  const changeRange = computeChangedRange(patched, original, editor.document);
  if (changeRange) {
    editor.selection = new vscode.Selection(changeRange.start, changeRange.end);
    editor.revealRange(changeRange, vscode.TextEditorRevealType.InCenter);
  }

  return true;
}

function computeChangedRange(after: string, before: string, doc: vscode.TextDocument): vscode.Range | undefined {
  if (after === before) {
    return undefined;
  }

  let start = 0;
  const minLength = Math.min(after.length, before.length);
  while (start < minLength && after[start] === before[start]) {
    start += 1;
  }

  let endBefore = before.length - 1;
  let endAfter = after.length - 1;
  while (endBefore >= start && endAfter >= start && before[endBefore] === after[endAfter]) {
    endBefore -= 1;
    endAfter -= 1;
  }

  const startPos = doc.positionAt(start);
  const endPos = doc.positionAt(endAfter + 1);
  return new vscode.Range(startPos, endPos);
}
