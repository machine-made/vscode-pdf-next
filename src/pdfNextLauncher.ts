import * as path from 'path';

type Platform = typeof process.platform;

export const PDF_NEXT_EXTENSIONS = [
  'pdf',
  'md',
  'markdown',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'avif',
  'gif',
  'bmp',
] as const;

export const PDF_NEXT_RELEASES_URL =
  'https://github.com/machine-made/pdf-next/releases/latest';

export interface FileLocation {
  scheme: string;
  authority: string;
  path: string;
  fsPath: string;
}

export interface LaunchEnvironment {
  platform: Platform;
  env: Record<string, string | undefined>;
  home: string;
  exists: (file: string) => boolean;
}

export function opensInPdfNext(fileName: string): boolean {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  return (PDF_NEXT_EXTENSIONS as readonly string[]).includes(extension);
}

function pathModule(platform: Platform): typeof path.posix {
  return platform === 'win32' ? path.win32 : path.posix;
}

function pathEntries(launch: LaunchEnvironment): string[] {
  const value = launch.env.PATH ?? launch.env.Path ?? '';
  const separator = launch.platform === 'win32' ? ';' : ':';
  return value
    .split(separator)
    .map((entry) => entry.trim().replace(/^"(.*)"$/, '$1'))
    .filter((entry) => entry.length > 0);
}

export function pdfNextCandidates(launch: LaunchEnvironment): string[] {
  const join = pathModule(launch.platform).join;
  const binary = launch.platform === 'win32' ? 'pdf-next.exe' : 'pdf-next';
  const candidates = pathEntries(launch).map((entry) => join(entry, binary));
  if (launch.platform === 'win32') {
    for (const root of [
      launch.env.LOCALAPPDATA,
      launch.env.ProgramFiles,
      launch.env['ProgramFiles(x86)'],
    ]) {
      if (root) {
        candidates.push(join(root, 'pdf-next', binary));
      }
    }
  } else if (launch.platform === 'darwin') {
    for (const applications of [
      '/Applications',
      join(launch.home, 'Applications'),
    ]) {
      candidates.push(
        join(applications, 'pdf-next.app', 'Contents', 'MacOS', binary),
      );
    }
  } else {
    candidates.push('/usr/bin/pdf-next', '/usr/local/bin/pdf-next');
  }
  return [...new Set(candidates)];
}

export type PdfNextBinary =
  { found: true; file: string } | { found: false; configured?: string };

export function findPdfNext(
  configuredPath: string | undefined,
  launch: LaunchEnvironment,
): PdfNextBinary {
  let configured = configuredPath?.trim();
  if (
    configured &&
    launch.platform === 'darwin' &&
    /\.app\/?$/.test(configured)
  ) {
    configured = path.posix.join(configured, 'Contents', 'MacOS', 'pdf-next');
  }
  if (configured) {
    return launch.exists(configured)
      ? { found: true, file: configured }
      : { found: false, configured };
  }
  const file = pdfNextCandidates(launch).find(launch.exists);
  return file ? { found: true, file } : { found: false };
}

export type LocalPath =
  { ok: true; file: string } | { ok: false; reason: 'untitled' | 'remote' };

export function localPathFor(
  location: FileLocation,
  platform: Platform,
): LocalPath {
  if (location.scheme === 'file') {
    return { ok: true, file: location.fsPath };
  }
  if (location.scheme === 'untitled') {
    return { ok: false, reason: 'untitled' };
  }
  const distro = location.authority.match(/^wsl\+(.+)$/)?.[1];
  if (
    location.scheme === 'vscode-remote' &&
    distro &&
    platform === 'win32' &&
    location.path.startsWith('/')
  ) {
    const share = location.path.split('/').filter(Boolean).join('\\');
    return {
      ok: true,
      file: `\\\\wsl.localhost\\${decodeURIComponent(distro)}\\${share}`,
    };
  }
  return { ok: false, reason: 'remote' };
}
