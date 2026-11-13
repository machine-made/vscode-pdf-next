import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import Module, { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const originalLoad = Module._load;
let renderPdfPreviewHtml;
try {
  Module._load = function (name, ...args) {
    return name === 'vscode' ? {} : originalLoad.call(this, name, ...args);
  };
  ({ renderPdfPreviewHtml } = require(resolve(root, 'out/src/pdfPreview.js')));
} finally {
  Module._load = originalLoad;
}

const mimeTypes = {
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export async function openViewer({
  pdf,
  viewport,
  screen,
  deviceScaleFactor,
  mainSource,
}) {
  const original = await readFile(resolve(root, 'lib/main.mjs'), 'utf8');
  const main = mainSource ? mainSource(original) : original;
  if (mainSource) {
    assert.equal(typeof main, 'string');
    assert.notEqual(main, original, 'mainSource must change the served text');
  }
  const events = [];
  const errors = [];
  let html;
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      if (pathname === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end(html);
        return;
      }
      const filename = resolve(root, `.${decodeURIComponent(pathname)}`);
      if (
        !['lib', 'out'].some((dir) =>
          filename.startsWith(resolve(root, dir) + sep),
        )
      ) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader(
        'Content-Type',
        mimeTypes[extname(filename)] ?? 'application/octet-stream',
      );
      response.end(
        filename === resolve(root, 'lib/main.mjs')
          ? main
          : await readFile(filename),
      );
    } catch {
      response.writeHead(404).end();
    }
  });
  let browser;
  const close = async () => {
    try {
      await browser?.close();
    } finally {
      await new Promise((done) => server.close(done));
    }
  };
  try {
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', done);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = (path) => `${origin}/${path}`;
    const nonce = randomBytes(16).toString('base64');
    const config = {
      cMapUrl: url('lib/pdfjs/cmaps/'),
      imageResourcesPath: url('lib/pdfjs/web/images/'),
      hash: '',
      path: url('perf-40pages.pdf'),
      standardFontDataUrl: url('lib/pdfjs/standard_fonts/'),
      wasmUrl: url('lib/pdfjs/wasm/'),
      workerSrc: url('lib/pdf.worker-wrapper.mjs'),
      workerBundleUrl: url('lib/pdfjs/build/pdf.worker.min.mjs'),
      polyfillsUrl: url('lib/polyfills.mjs'),
      defaults: {
        cursor: 'select',
        scale: 'page-width',
        sidebar: false,
        sidebarPanel: 'outline',
        scrollMode: 'vertical',
        spreadMode: 'none',
      },
      appearance: { pageGap: 'normal', theme: 'auto' },
      reload: { debounceMs: 800, automatic: true },
      copy: { autoCopySelection: false },
    };
    const csp = [
      "default-src 'none'",
      `connect-src ${origin}`,
      `font-src ${origin}`,
      `img-src blob: data: ${origin}`,
      `script-src 'nonce-${nonce}' 'wasm-unsafe-eval' ${origin}`,
      `style-src 'unsafe-inline' ${origin}`,
      `worker-src ${origin} blob:`,
    ].join('; ');
    html = renderPdfPreviewHtml({
      csp,
      nonce,
      config,
      pdfViewerStylesUri: url('lib/pdfjs/web/pdf_viewer.css'),
      viewerStylesUri: url('lib/pdf.css'),
      mainScriptUri: url('lib/main.mjs'),
    });
    const executablePath = [
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1243/chrome-linux/headless_shell',
      ),
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
      ),
      chromium.executablePath(),
    ].find((candidate) => existsSync(candidate));
    if (!executablePath) {
      console.error('bunx playwright-core install chromium');
      process.exitCode = 2;
      throw new Error('Chromium is missing');
    }
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({
      viewport,
      screen,
      deviceScaleFactor,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    // This bridge is installed before any viewer script and preserves typed data.
    await page.exposeFunction('__recordViewerMessage', (message) =>
      events.push(message),
    );
    await page.addInitScript(
      ({ data }) => {
        let state;
        window.acquireVsCodeApi = () => ({
          getState: () => state,
          setState: (value) => {
            state = value;
          },
          postMessage: (message) => {
            window.__recordViewerMessage(message);
            if (message.type === 'request-document') {
              queueMicrotask(() =>
                window.postMessage(
                  {
                    type: 'document-data',
                    requestId: message.requestId,
                    data: new Uint8Array(data),
                  },
                  '*',
                ),
              );
            }
          },
        });
      },
      { data: Array.from(await readFile(pdf)) },
    );
    await page.goto(origin);
    return {
      page,
      events,
      errors,
      close,
      hostSend: (message) =>
        page.evaluate((value) => window.postMessage(value, '*'), message),
    };
  } catch (error) {
    await close();
    throw error;
  }
}
