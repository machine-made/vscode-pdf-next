import { spawn } from 'child_process';
import { statSync } from 'fs';
import { homedir } from 'os';
import * as vscode from 'vscode';
import {
  PDF_NEXT_RELEASES_URL,
  findPdfNext,
  localPathFor,
  opensInPdfNext,
  type LaunchEnvironment,
} from './pdfNextLauncher';

const SETTINGS = 'pdf-preview.pdfNext';

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function launchEnvironment(): LaunchEnvironment {
  return {
    platform: process.platform,
    env: process.env,
    home: homedir(),
    exists: isFile,
  };
}

function targetsFrom(uri: unknown, selected: unknown): vscode.Uri[] {
  if (Array.isArray(selected) && selected.length > 0) {
    return selected.filter(
      (item): item is vscode.Uri => item instanceof vscode.Uri,
    );
  }
  if (uri instanceof vscode.Uri) {
    return [uri];
  }
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (
    tab instanceof vscode.TabInputText ||
    tab instanceof vscode.TabInputCustom
  ) {
    return [tab.uri];
  }
  const editor = vscode.window.activeTextEditor?.document.uri;
  return editor ? [editor] : [];
}

async function saveIfDirty(target: vscode.Uri): Promise<void> {
  const document = vscode.workspace.textDocuments.find(
    (open) => open.uri.toString() === target.toString(),
  );
  if (
    document?.isDirty &&
    vscode.workspace
      .getConfiguration(SETTINGS, target)
      .get<boolean>('saveBeforeOpen', true)
  ) {
    await document.save();
  }
}

async function reportMissing(configured: string | undefined): Promise<void> {
  const message = configured
    ? `pdf-next was not found at ${configured}.`
    : 'pdf-next is not installed, or vscode-pdf Next cannot find it.';
  const choice = await vscode.window.showErrorMessage(
    message,
    'Download pdf-next',
    'Set path',
  );
  if (choice === 'Download pdf-next') {
    await vscode.env.openExternal(vscode.Uri.parse(PDF_NEXT_RELEASES_URL));
  } else if (choice === 'Set path') {
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      `${SETTINGS}.path`,
    );
  }
}

function launch(binary: string, files: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, files, {
      detached: true,
      shell: false,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export async function openInPdfNext(
  uri?: unknown,
  selected?: unknown,
): Promise<void> {
  const targets = targetsFrom(uri, selected).filter((target) =>
    opensInPdfNext(target.path),
  );
  if (targets.length === 0) {
    await vscode.window.showWarningMessage(
      'pdf-next opens PDF, Markdown and image files.',
    );
    return;
  }

  const files: string[] = [];
  for (const target of targets) {
    if (target.scheme !== 'untitled') {
      await saveIfDirty(target);
    }
    const local = localPathFor(target, process.platform);
    if (!local.ok) {
      await vscode.window.showWarningMessage(
        local.reason === 'untitled'
          ? 'Save the file first: pdf-next opens files on disk.'
          : 'pdf-next runs on this computer and cannot open files from a remote window.',
      );
      return;
    }
    files.push(local.file);
  }

  const configured = vscode.workspace
    .getConfiguration(SETTINGS)
    .get<string>('path');
  const binary = findPdfNext(configured, launchEnvironment());
  if (!binary.found) {
    await reportMissing(binary.configured);
    return;
  }
  try {
    await launch(binary.file, files);
  } catch (error) {
    await vscode.window.showErrorMessage(
      `pdf-next could not start: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
