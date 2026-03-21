import * as vscode from 'vscode';
import { log } from '../utils/logger';

export interface ChatProvider {
  id: string;
  name: string;
  extensionId: string;
  openCommand: string;
  /** How the command accepts a query: 'object' = { query }, 'string' = raw string, 'none' = clipboard fallback */
  queryFormat: 'object' | 'string' | 'none';
  /** Optional command to focus the chat input after opening (for clipboard-based providers) */
  focusCommand?: string;
}

const KNOWN_PROVIDERS: ChatProvider[] = [
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    extensionId: 'github.copilot-chat',
    openCommand: 'workbench.action.chat.open',
    queryFormat: 'object',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    extensionId: 'anthropic.claude-code',
    openCommand: 'claude-vscode.editor.open',
    queryFormat: 'none',
    focusCommand: 'claude-vscode.focus',
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    extensionId: 'openai.chatgpt',
    openCommand: 'chatgpt.newCodexPanel',
    queryFormat: 'none',
    focusCommand: 'chatgpt.openSidebar',
  },
  {
    id: 'cline',
    name: 'Cline',
    extensionId: 'saoudrizwan.claude-dev',
    openCommand: 'cline.openInNewTab',
    queryFormat: 'none',
  },
  {
    id: 'roo-cline',
    name: 'Roo Code',
    extensionId: 'rooveterinaryinc.roo-cline',
    openCommand: 'roo-cline.openInNewTab',
    queryFormat: 'none',
  },
  {
    id: 'continue',
    name: 'Continue',
    extensionId: 'continue.continue',
    openCommand: 'continue.focusContinueInput',
    queryFormat: 'none',
  },
  {
    id: 'cody',
    name: 'Sourcegraph Cody',
    extensionId: 'sourcegraph.cody-ai',
    openCommand: 'cody.chat.newEditorPanel',
    queryFormat: 'none',
  },
  {
    id: 'amazon-q',
    name: 'Amazon Q',
    extensionId: 'amazonwebservices.amazon-q-vscode',
    openCommand: 'aws.amazonq.explainCode',
    queryFormat: 'none',
  },
  {
    id: 'codegpt',
    name: 'CodeGPT',
    extensionId: 'danielsanmedium.dscodegpt',
    openCommand: 'codegpt.newChat',
    queryFormat: 'none',
  },
  {
    id: 'gemini',
    name: 'Gemini Code Assist',
    extensionId: 'google.gcloud-code-gemini',
    openCommand: 'gcloud-code-gemini.chat.newThread',
    queryFormat: 'none',
  },
];

/** Returns only known providers whose VS Code extension is currently installed. */
export function getInstalledProviders(): ChatProvider[] {
  return KNOWN_PROVIDERS.filter(
    p => vscode.extensions.getExtension(p.extensionId) !== undefined
  );
}

/**
 * Open an AI chat with the given query, respecting the user's adi.chatProvider setting.
 * Returns true if a chat was successfully opened.
 */
export async function openChat(query: string): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('adi');
  const preferredId = config.get<string>('chatProvider', 'auto');
  const installed = getInstalledProviders();

  if (installed.length === 0) {
    return false;
  }

  let provider: ChatProvider | undefined;

  // If user set a specific provider, use it
  if (preferredId !== 'auto') {
    provider = installed.find(p => p.id === preferredId);
    if (!provider) {
      log(`Configured chat provider '${preferredId}' not installed, falling back to auto`);
    }
  }

  // Auto: single provider = use it, multiple = ask
  if (!provider) {
    if (installed.length === 1) {
      provider = installed[0];
    } else {
      const picked = await vscode.window.showQuickPick(
        installed.map(p => ({ label: p.name, description: p.id, provider: p })),
        { placeHolder: 'Select AI chat provider for ADI' }
      );
      if (!picked) {
        return false;
      }
      provider = picked.provider;

      // Offer to remember the choice
      const save = await vscode.window.showInformationMessage(
        `Always use ${provider.name}?`, 'Yes', 'No'
      );
      if (save === 'Yes') {
        await config.update('chatProvider', provider.id, vscode.ConfigurationTarget.Global);
      }
    }
  }

  return executeChat(provider, query);
}

async function ensureExtensionActive(extensionId: string): Promise<void> {
  const ext = vscode.extensions.getExtension(extensionId);
  if (ext && !ext.isActive) {
    log(`Activating extension: ${extensionId}`);
    await ext.activate();
  }
}

async function executeChat(provider: ChatProvider, query: string): Promise<boolean> {
  try {
    // Ensure the target extension is activated before running its commands
    await ensureExtensionActive(provider.extensionId);

    switch (provider.queryFormat) {
      case 'object':
        await vscode.commands.executeCommand(provider.openCommand, { query });
        break;
      case 'string':
        await vscode.commands.executeCommand(provider.openCommand, query);
        break;
      case 'none':
        await vscode.env.clipboard.writeText(query);
        await vscode.commands.executeCommand(provider.openCommand);
        // Try to focus the chat input so user just needs Ctrl+V
        if (provider.focusCommand) {
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            await vscode.commands.executeCommand(provider.focusCommand);
          } catch { /* focus is best-effort */ }
        }
        vscode.window.showInformationMessage('ADI: Prompt copied. Press Ctrl+V to paste it.');
        break;
    }
    log(`Opened ${provider.name} chat`);
    return true;
  } catch (err) {
    log(`Failed to open ${provider.name}: ${err}`);
    return false;
  }
}
