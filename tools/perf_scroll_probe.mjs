import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openViewer } from './webview_harness.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
let runs = 5;
let windows = [
  { width: 1200, height: 800 },
  { width: 1800, height: 1000 },
];
let enforce = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--assert') enforce = true;
  else if (args[i] === '--runs') {
    runs = Number(args[++i]);
    assert(
      Number.isInteger(runs) && runs > 0,
      '--runs must be a positive integer',
    );
  } else if (args[i] === '--window') {
    const match = /^(\d+)x(\d+)$/.exec(args[++i] ?? '');
    assert(match, '--window must be WxH');
    windows = [{ width: Number(match[1]), height: Number(match[2]) }];
    assert(windows[0].width > 0 && windows[0].height > 0);
  } else throw new Error(`Unknown option: ${args[i]}`);
}

function baselineSource(source) {
  const pattern = /const MAX_CANVAS_PIXELS = [0-9_]+;/g;
  assert.equal(
    [...source.matchAll(pattern)].length,
    1,
    'Canvas cap must match once',
  );
  // Decimal spelling also changes the unchanged baseline's source text.
  return source.replace(pattern, 'const MAX_CANVAS_PIXELS = 4194304;');
}

// Runs in the page, observing only the shipped viewer's DOM.
async function measureScroll() {
  const container = document.getElementById('viewerContainer');
  const viewer = document.getElementById('viewer');
  const pages = [...viewer.querySelectorAll('.page')];
  if (pages.length !== 40)
    throw new Error(`Expected 40 pages, got ${pages.length}`);
  const target = pages[12].offsetTop - pages[0].offsetTop;
  if (container.scrollTop > 1 || target <= 0)
    throw new Error('Scroll must start on page 1');
  const entered = new Set();
  let redraws = 0;
  let frames = 0;
  let blurredFrames = 0;
  let lastChange = performance.now();
  const isPageCanvas = (node) =>
    node instanceof HTMLCanvasElement &&
    (node.closest('.canvasWrapper') || node.matches('.detailView'));
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && isPageCanvas(record.target))
        redraws++;
      for (const node of record.addedNodes) {
        if (isPageCanvas(node)) redraws++;
        if (node instanceof Element) {
          for (const canvas of node.querySelectorAll('canvas')) {
            if (isPageCanvas(canvas)) redraws++;
          }
        }
      }
      // Removals also reset the settling timer, without counting as redraws.
      lastChange = performance.now();
    }
  });
  observer.observe(viewer, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['width', 'height'],
  });
  const intersect = (a, b) => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });
  const hasArea = (rect) => rect.right > rect.left && rect.bottom > rect.top;
  const visiblePages = () => {
    const clip = container.getBoundingClientRect();
    return pages
      .map((page, index) => {
        const box = page.getBoundingClientRect();
        const region = intersect(clip, {
          left: box.left + page.clientLeft,
          top: box.top + page.clientTop,
          right: box.left + page.clientLeft + page.clientWidth,
          bottom: box.top + page.clientTop + page.clientHeight,
        });
        return { page, number: index + 1, region };
      })
      .filter(({ region }) => hasArea(region));
  };
  const initial = new Set(visiblePages().map(({ number }) => number));
  function isBlurred({ page, region }) {
    let uncovered = [region];
    for (const canvas of page.querySelectorAll(
      '.canvasWrapper canvas, canvas.detailView',
    )) {
      const rect = canvas.getBoundingClientRect();
      if (
        !canvas.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        }) ||
        rect.width <= 0 ||
        canvas.width / rect.width < 0.95 * devicePixelRatio ||
        canvas.width === 0 ||
        canvas.height === 0
      )
        continue;
      uncovered = uncovered.flatMap((piece) => {
        const overlap = intersect(piece, rect);
        if (!hasArea(overlap)) return [piece];
        return [
          { ...piece, bottom: overlap.top },
          { ...piece, top: overlap.bottom },
          {
            ...piece,
            top: overlap.top,
            bottom: overlap.bottom,
            right: overlap.left,
          },
          {
            ...piece,
            top: overlap.top,
            bottom: overlap.bottom,
            left: overlap.right,
          },
        ].filter(hasArea);
      });
    }
    return uncovered.length > 0;
  }
  const started = performance.now();
  await new Promise((done, reject) => {
    const tick = () => {
      if (performance.now() - started > 180_000) {
        reject(new Error('Scrolling exceeded 180 seconds'));
        return;
      }
      const visible = visiblePages();
      for (const { number } of visible)
        if (!initial.has(number)) entered.add(number);
      frames++;
      if (visible.some(isBlurred)) blurredFrames++;
      if (container.scrollTop >= target) {
        done();
        return;
      }
      const before = container.scrollTop;
      container.scrollTop = Math.min(target, before + 25);
      if (container.scrollTop <= before) {
        reject(new Error('Scroll stopped early'));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await new Promise((done, reject) => {
    const waitStarted = performance.now();
    const tick = () => {
      if (performance.now() - lastChange >= 300) done();
      else if (performance.now() - waitStarted > 30_000)
        reject(new Error('Canvases did not settle'));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  observer.disconnect();
  const finalPage = Math.max(...visiblePages().map(({ number }) => number));
  if (entered.size !== 12)
    throw new Error(`Expected 12 pages entered, got ${entered.size}`);
  if (finalPage < 13) throw new Error(`Scroll ended on page ${finalPage}`);
  const heldMpx =
    [
      ...viewer.querySelectorAll('.canvasWrapper canvas, canvas.detailView'),
    ].reduce((sum, canvas) => sum + canvas.width * canvas.height, 0) /
    1_000_000;
  return {
    redraws,
    pagesEntered: entered.size,
    redrawsPerPage: redraws / entered.size,
    blurredFrames,
    frames,
    blurredFraction: blurredFrames / frames,
    heldMpx,
    finalPage,
  };
}

const results = [];
for (const viewport of windows) {
  for (let run = 1; run <= runs; run++) {
    for (const build of ['baseline', 'shipped']) {
      console.error(
        `${viewport.width}x${viewport.height} ${build} ${run}/${runs}`,
      );
      const viewer = await openViewer({
        pdf: resolve(root, '.work/perf/perf-40pages.pdf'),
        viewport,
        screen: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
        ...(build === 'baseline' ? { mainSource: baselineSource } : {}),
      });
      try {
        const deadline = Date.now() + 60_000;
        while (!viewer.events.some((event) => event.type === 'viewer-ready')) {
          assert(
            Date.now() < deadline,
            `viewer-ready timeout: ${viewer.errors.join('; ')}`,
          );
          assert.equal(viewer.errors.length, 0, viewer.errors.join('; '));
          await viewer.page.waitForTimeout(25);
        }
        const ready = viewer.events.find(
          (event) => event.type === 'viewer-ready',
        );
        assert.equal(ready.workerType, 'worker');
        assert.equal(ready.pagesCount, 40);
        assert(
          Number.isFinite(ready.durationMs),
          'Missing first page duration',
        );
        const metrics = await viewer.page.evaluate(measureScroll);
        assert.equal(viewer.errors.length, 0, viewer.errors.join('; '));
        results.push({
          window: `${viewport.width}x${viewport.height}`,
          build,
          run,
          firstPageMs: ready.durationMs,
          ...metrics,
        });
      } finally {
        await viewer.close();
      }
    }
  }
}
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const medians = [];
for (const viewport of windows) {
  for (const build of ['baseline', 'shipped']) {
    const window = `${viewport.width}x${viewport.height}`;
    const rows = results.filter(
      (row) => row.window === window && row.build === build,
    );
    medians.push({
      window,
      build,
      ...Object.fromEntries(
        [
          'firstPageMs',
          'redrawsPerPage',
          'blurredFrames',
          'frames',
          'blurredFraction',
          'heldMpx',
        ].map((key) => [key, median(rows.map((row) => row[key]))]),
      ),
    });
  }
}
console.log(
  'window | build | firstPageMs | redraws/page | blurredFrames | frames | blurred % | heldMpx',
);
for (const row of medians) {
  console.log(
    `${row.window} | ${row.build} | ${row.firstPageMs.toFixed(1)} | ${row.redrawsPerPage.toFixed(3)} | ${row.blurredFrames} | ${row.frames} | ${(100 * row.blurredFraction).toFixed(2)} | ${row.heldMpx.toFixed(3)}`,
  );
}
const failures = [];
for (const row of medians) {
  const check = (passed, message) => {
    if (!passed) failures.push(`${row.window} ${row.build}: ${message}`);
  };
  if (row.build === 'baseline') {
    check(
      row.redrawsPerPage > 3,
      `redraws/page ${row.redrawsPerPage} must be > 3`,
    );
    check(
      row.blurredFraction > 0.1,
      `blurred fraction ${row.blurredFraction} must be > 0.1`,
    );
  } else {
    const baseline = medians.find(
      (other) => other.window === row.window && other.build === 'baseline',
    );
    check(
      row.redrawsPerPage <= 1.5,
      `redraws/page ${row.redrawsPerPage} exceeds 1.5`,
    );
    check(
      row.blurredFraction <= 0.05,
      `blurred fraction ${row.blurredFraction} exceeds 0.05`,
    );
    check(row.heldMpx <= 96, `heldMpx ${row.heldMpx} exceeds 96`);
    check(
      row.firstPageMs <= 1.1 * baseline.firstPageMs + 50,
      `firstPageMs ${row.firstPageMs} exceeds ${1.1 * baseline.firstPageMs + 50}`,
    );
  }
}
await mkdir(resolve(root, '.work/perf'), { recursive: true });
await writeFile(
  resolve(root, '.work/perf/perf-report.json'),
  JSON.stringify({ runs, results, medians, failures }, null, 2) + '\n',
);
if (enforce && failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
