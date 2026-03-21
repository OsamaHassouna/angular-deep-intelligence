import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Angular Deep Intelligence');
  }
  return outputChannel;
}

export function log(message: string): void {
  getOutputChannel().appendLine(`[ADI] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  const errorMsg = error instanceof Error ? error.message : String(error ?? '');
  getOutputChannel().appendLine(`[ADI ERROR] ${message}${errorMsg ? ': ' + errorMsg : ''}`);
}

export function disposeLogger(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}
