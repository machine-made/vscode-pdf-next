import * as assert from 'assert';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import {
  findPdfNext,
  localPathFor,
  opensInPdfNext,
  pdfNextCandidates,
  type LaunchEnvironment,
} from '../../pdfNextLauncher';

function environment(
  platform: LaunchEnvironment['platform'],
  env: Record<string, string>,
  installed: string[] = [],
): LaunchEnvironment {
  return {
    platform,
    env,
    home: platform === 'win32' ? 'C:\\Users\\ada' : '/home/ada',
    exists: (file) => installed.includes(file),
  };
}

export function assertPdfNextLauncher(): void {
  for (const name of ['a.pdf', 'b.MD', 'notes.markdown', 'fig.JPEG']) {
    assert.ok(opensInPdfNext(name), name);
  }
  for (const name of ['a.tex', 'md', 'a.pdf.bak', '']) {
    assert.ok(!opensInPdfNext(name), name);
  }

  const windows = environment('win32', {
    Path: 'C:\\Windows;"C:\\Tools"',
    LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local',
    ProgramFiles: 'C:\\Program Files',
  });
  assert.deepStrictEqual(pdfNextCandidates(windows), [
    'C:\\Windows\\pdf-next.exe',
    'C:\\Tools\\pdf-next.exe',
    'C:\\Users\\ada\\AppData\\Local\\pdf-next\\pdf-next.exe',
    'C:\\Program Files\\pdf-next\\pdf-next.exe',
  ]);

  const mac = environment('darwin', { PATH: '/opt/homebrew/bin:/usr/bin' }, [
    '/home/ada/Applications/pdf-next.app/Contents/MacOS/pdf-next',
  ]);
  assert.deepStrictEqual(findPdfNext(undefined, mac), {
    found: true,
    file: '/home/ada/Applications/pdf-next.app/Contents/MacOS/pdf-next',
  });
  assert.deepStrictEqual(
    findPdfNext('/home/ada/Applications/pdf-next.app/', mac),
    {
      found: true,
      file: '/home/ada/Applications/pdf-next.app/Contents/MacOS/pdf-next',
    },
  );

  const linux = environment('linux', { PATH: '/home/ada/bin:/usr/bin' }, [
    '/usr/bin/pdf-next',
  ]);
  assert.deepStrictEqual(findPdfNext('', linux), {
    found: true,
    file: '/usr/bin/pdf-next',
  });
  assert.deepStrictEqual(findPdfNext('  /opt/pdf-next  ', linux), {
    found: false,
    configured: '/opt/pdf-next',
  });
  assert.deepStrictEqual(findPdfNext(undefined, environment('linux', {})), {
    found: false,
  });

  const file = { scheme: 'file', authority: '', path: '/a/b.md' };
  assert.deepStrictEqual(
    localPathFor({ ...file, fsPath: '/a/b.md' }, 'linux'),
    {
      ok: true,
      file: '/a/b.md',
    },
  );
  const wsl = {
    scheme: 'vscode-remote',
    authority: 'wsl+Ubuntu-24.04',
    path: '/home/ada/paper/notes.md',
    fsPath: '/home/ada/paper/notes.md',
  };
  assert.deepStrictEqual(localPathFor(wsl, 'win32'), {
    ok: true,
    file: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\ada\\paper\\notes.md',
  });
  assert.deepStrictEqual(localPathFor(wsl, 'linux'), {
    ok: false,
    reason: 'remote',
  });
  assert.deepStrictEqual(
    localPathFor({ ...wsl, authority: 'ssh-remote+box' }, 'win32'),
    { ok: false, reason: 'remote' },
  );
  assert.deepStrictEqual(
    localPathFor(
      { scheme: 'untitled', authority: '', path: 'Untitled-1', fsPath: '' },
      'linux',
    ),
    { ok: false, reason: 'untitled' },
  );
}

export interface StubPdfNext {
  binary: string;
  record: string;
  recordedArguments: () => string[] | undefined;
}

// A stand-in for pdf-next that writes the arguments it got, one per line.
// POSIX only: Node does not start .cmd files without a shell on Windows.
export function writeStubPdfNext(): StubPdfNext {
  const directory = mkdtempSync(path.join(tmpdir(), 'pdf-next-stub-'));
  const binary = path.join(directory, 'pdf-next');
  const record = path.join(directory, 'arguments.txt');
  writeFileSync(
    binary,
    `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a"; done > ${JSON.stringify(`${record}.tmp`)}\nmv ${JSON.stringify(`${record}.tmp`)} ${JSON.stringify(record)}\n`,
  );
  chmodSync(binary, 0o755);
  return {
    binary,
    record,
    recordedArguments: () => {
      try {
        return readFileSync(record, 'utf8').split('\n').filter(Boolean);
      } catch {
        return undefined;
      }
    },
  };
}
