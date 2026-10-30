# vscode-pdf Next by machine-made — fast, secure PDF viewing in VS Code

[![CI](https://github.com/machine-made/vscode-pdf-next/actions/workflows/ci.yml/badge.svg)](https://github.com/machine-made/vscode-pdf-next/actions/workflows/ci.yml)
[![Marketplace](https://img.shields.io/badge/marketplace-vscode--pdf--next-blue)](https://marketplace.visualstudio.com/items?itemName=RicardoFrantz.pdf-preview-next)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![GitHub](https://img.shields.io/badge/github-vscode--pdf--next-blue)](https://github.com/machine-made/vscode-pdf-next)

Open PDFs right inside VS Code — with **true dark mode**, instant live reload
for LaTeX and Typst builds, search, outline navigation, and a
security-hardened PDF.js 6 runtime.

**vscode-pdf Next** is the actively maintained successor to the classic
`tomoki1207.vscode-pdf` extension: same simplicity, modern renderer, and a
much stronger security posture. It is made by machine-made, like the
[pdf-next](https://github.com/machine-made/pdf-next) desktop app: right-click
a PDF or Markdown file and choose **Open in pdf-next** to read it there.

<!-- Add a screenshot or GIF here — this is the single most impactful thing
     for Marketplace conversions. Suggested: a side-by-side of a .tex file and
     the live-reloading PDF preview in dark mode.
![vscode-pdf Next in action](docs/media/screenshot.png)
-->

## Why this extension?

- 🌙 **True dark mode.** Not just inverted colors — Night mode asks PDF.js to
  re-render page content for low-eye-strain reading, with auto theme matching
  and an inversion fallback for scanned documents. Your PDFs finally fit your
  dark setup.
- ⚡ **Fast.** Powered by the latest Mozilla PDF.js — currently
  `pdfjs-dist@6.4.299`, the same engine Firefox uses — with all PDF parsing
  and decoding in a dedicated worker thread so the interface never blocks.
  No telemetry, no network calls, no cloud round-trips: your PDFs never
  leave your machine.
- 🔒 **Secure by design.** Strict webview sandboxing, no shell execution,
  script eval disabled, WebAssembly limited to PDF.js's own image decoders,
  and every release package automatically scanned before publishing. See the
  [security model](#security-model) below.
- 🔁 **Built for TeX/Typst workflows.** Debounced live reload keeps your page,
  zoom, and scroll position exactly where they were — even when your build
  tool deletes and recreates the PDF mid-compile.

## Features

- **Live reload** with debounce and focus preservation — ideal for
  `latexmk`, `tectonic`, `typst watch`, and similar build loops.
- **First-class WSL support**: PDFs on `\\wsl.localhost\...` shares load
  instantly and live-reload works even though VS Code's file watchers can't
  see WSL files (the extension polls as a fallback).
- **Per-PDF state restore**: page, zoom, scroll position, sidebar, and active
  panel come back exactly as you left them.
- **Text search and selection**, with optional copy-on-select.
- **Outline and thumbnail sidebars** for quick navigation in long documents.
- **Inter-PDF links** that work locally and preserve fragments like `#page=2`.
- **Keyboard-first navigation**: vim-style scrolling, paging, and zoom (see
  [shortcuts](#keyboard-shortcuts)).
- **Native printing** via your system viewer, plus an advanced direct-print
  command with a no-shell custom command override.
- **Open in pdf-next**: one right-click sends PDFs, Markdown and images to the
  [pdf-next](https://github.com/machine-made/pdf-next) app (see
  [below](#open-in-pdf-next)).

## Dark mode 🌙

Reading a blinding white PDF in a dark editor is miserable. vscode-pdf Next
ships a full range of appearance modes — cycle them from the toolbar or pin
one with `pdf-preview.appearance.theme`:

| Mode       | What it does                                                              |
| ---------- | ------------------------------------------------------------------------- |
| `auto`     | Follows your VS Code theme for the viewer chrome.                         |
| `dark`     | Dark viewer chrome, original page colors.                                 |
| `night`    | PDF.js re-renders page content in dark colors — real dark pages, not a CSS filter. |
| `reader`   | Warm e-reader sepia pages — comfortable reading without going dark.       |
| `inverted` | Full-page inversion fallback for scanned or image-heavy PDFs.             |

The toolbar button cycles **Night → Reader → Invert** — it never lands back on
plain white pages. Shift+click (or Alt+click) it to go back to normal pages, or
set `pdf-preview.appearance.theme` to make a mode stick for every PDF.

The viewer chrome follows your VS Code theme rather than hardcoded colors, so
the toolbar, sidebar, and the surface behind the pages match whatever theme you
run — including custom ones.

## Open in pdf-next

[pdf-next](https://github.com/machine-made/pdf-next) is machine-made's desktop
viewer for PDFs, Markdown and images: you write in VS Code and read in the
other window, which redraws within a second of each save.

- Right-click a `.pdf`, `.md`, `.markdown` or image file in the Explorer, or
  right-click its editor tab, and choose **Open in pdf-next**. Select several
  files to open them all at once.
- The PDF preview has the same command as a button in its title bar. For
  Markdown editors, turn on `pdf-preview.pdfNext.showInMarkdownTitleBar`.
- If pdf-next is already open, the files go to the window you have.
- An edited file is saved first, because pdf-next reads the file on disk.
- The extension finds pdf-next on your `PATH` and in the folders its
  installers use (`%LOCALAPPDATA%\pdf-next` on Windows, `/Applications` on
  macOS, `/usr/bin` on Linux). Anywhere else, set `pdf-preview.pdfNext.path`.
- In a WSL window on Windows, files are opened through `\\wsl.localhost`.
  Files from SSH or container windows are not on this computer, so pdf-next
  cannot open them.

pdf-next is a separate install: see its
[installation guide](https://github.com/machine-made/pdf-next#install).

## Getting started

Install from the Marketplace (search for **"vscode-pdf Next"**) or from the
command line:

```bash
code --install-extension RicardoFrantz.pdf-preview-next
```

Then just open any `.pdf` file. To make this the default PDF viewer:

```json
"workbench.editorAssociations": {
  "*.pdf": "pdf-preview-next.preview"
}
```

Also available as a VSIX from
[GitHub Releases](https://github.com/machine-made/vscode-pdf-next/releases):

```bash
code --install-extension pdf-preview-next-<version>.vsix --force
```

## Keyboard shortcuts

| Keys                | Action                   |
| ------------------- | ------------------------ |
| `j` `k` `h` `l`     | Scroll                   |
| `n` / `p` (or `.` / `,`) | Next / previous page |
| `g` / `G`           | First / last page        |
| `+` / `-`           | Zoom in / out            |
| `Ctrl+F` / `Cmd+F`  | Find in document         |
| `Ctrl+C` / `Cmd+C`  | Copy selected PDF text   |
| `Ctrl+R` / `Cmd+R`  | Refresh the preview      |
| `Esc`               | Close the find bar       |

## Settings

| Setting                              | Default    | Notes                                                                                    |
| ------------------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| `pdf-preview.default.cursor`         | `select`   | Default cursor tool: `select` or `hand`.                                                 |
| `pdf-preview.default.scale`          | `auto`     | `auto`, `page-actual`, `page-fit`, `page-width`, or a numeric scale such as `1.25`.      |
| `pdf-preview.default.sidebar`        | `false`    | Open the sidebar by default when the selected panel is available.                        |
| `pdf-preview.default.sidebarPanel`   | `outline`  | Initial sidebar panel: `outline` or `thumbnails`.                                        |
| `pdf-preview.default.scrollMode`     | `vertical` | `vertical`, `horizontal`, or `wrapped`.                                                  |
| `pdf-preview.default.spreadMode`     | `none`     | `none`, `odd`, or `even`.                                                                |
| `pdf-preview.reload.automatic`       | `true`     | Auto-refresh previews when the PDF changes; manual reload always remains available.      |
| `pdf-preview.reload.debounceMs`      | `800`      | Delay after file-change notifications before refreshing.                                 |
| `pdf-preview.reload.closeOnDelete`   | `false`    | Close previews when a PDF is deleted; keep disabled for build tools that replace files.  |
| `pdf-preview.appearance.theme`       | `auto`     | `auto`, `light`, `dark`, `night`, `reader`, `dark-pages`, or `inverted`.                 |
| `pdf-preview.appearance.pageGap`     | `normal`   | `compact`, `normal`, or `wide`.                                                          |
| `pdf-preview.copy.autoCopySelection` | `false`    | Opt-in clipboard write when selected PDF text is released with the mouse.                |
| `pdf-preview.printCommand`           | empty      | Restricted custom print command; `{{file}}` is the PDF path. Runs without a shell and is ignored in untrusted workspaces. |
| `pdf-preview.pdfNext.path`           | empty      | Path to pdf-next for **Open in pdf-next**; empty finds it on `PATH` and in the install folders. Restricted. |
| `pdf-preview.pdfNext.saveBeforeOpen` | `true`     | Save an edited file before opening it in pdf-next.                                       |
| `pdf-preview.pdfNext.showInTitleBar` | `true`     | Show the **Open in pdf-next** button on the PDF preview.                                 |
| `pdf-preview.pdfNext.showInMarkdownTitleBar` | `false` | Show the same button on Markdown editors.                                         |

Settings prefixed `pdf-preview.default.*` and appearance/copy settings can be
overridden per workspace folder or resource. Reload settings are global because
they control file watching rather than rendering defaults.

## Commands

| Command                                               | Behavior                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `vscode-pdf Next: Open Preview`                       | Open the selected PDF with this viewer.                                        |
| `vscode-pdf Next: Open Externally`                    | Open the active PDF with the system PDF handler.                               |
| `vscode-pdf Next: Refresh Preview`                    | Refresh without losing page, zoom, scroll, or sidebar state.                   |
| `vscode-pdf Next: Open in System Viewer for Printing` | Open the PDF in your default PDF app for native printing.                      |
| `vscode-pdf Next: Print Directly to Default Printer`  | Advanced: run `pdf-preview.printCommand` or submit to the default CUPS printer. |
| `vscode-pdf Next: Reset View State`                   | Clear saved page, zoom, scroll, and sidebar state for the active PDF.          |
| `vscode-pdf Next: Open in pdf-next`                   | Open the selected PDF, Markdown or image files in the pdf-next app.            |

The toolbar also provides one-click controls for external open, appearance
mode cycling, sidebar toggling, printing, manual refresh, and an auto-reload
toggle.

## Security model

Rendering untrusted PDFs deserves real sandboxing, so this extension treats
security as a feature:

- **Current runtime: `pdfjs-dist@6.4.299`** (Mozilla's PDF.js), kept up to
  date with upstream security fixes.
- Webview scripts are **nonce-bound** with scoped `localResourceRoots`.
- **No dynamic code execution**: the vendored PDF.js 6 runtime contains no
  `eval` or `new Function` (verified by an automated check on every build),
  and the CSP forbids `unsafe-eval` anyway — a malicious PDF cannot run
  arbitrary code. The CSP allows WebAssembly (`wasm-unsafe-eval`) only so
  PDF.js can run its JBIG2 and JPEG 2000 image decoders, which scanned pages
  need. Those two `.wasm` files ship in the package, and the release scanner
  rejects any other `.wasm` file.
- **PDF parsing runs in a sandboxed worker thread**, keeping documents off the
  UI thread; the extension verifies at test time that the real worker spawns.
- The default print path performs **no shell execution**; the optional custom
  print command runs without a shell and is restricted under VS Code
  Workspace Trust. **Open in pdf-next** also starts pdf-next without a
  shell, with the file paths as its only arguments.
- Every release VSIX passes an **automated package scanner** that rejects
  stray source files, maps, tests, and scratch files before publishing.
- **No telemetry, no network access** — everything renders locally.

The codebase was security-audited with **Claude Opus 4.7** (April 2026), and
release automation is hardened too: CI actions pinned by commit SHA and
publishing gated behind a protected environment. Details in
[SECURITY.md](https://github.com/machine-made/vscode-pdf-next/blob/main/SECURITY.md).

## Identity (same family as vscode-diff Next)

| | **vscode-pdf Next** | **vscode-diff Next** |
| -- | ------------------- | -------------------- |
| Repository | `machine-made/vscode-pdf-next` | `machine-made/vscode-diff-next` |
| Display name | `vscode-pdf Next by machine-made` | `vscode-diff Next` |
| Package name | `pdf-preview-next` | `diff-next` |
| Install id | `RicardoFrantz.pdf-preview-next` | `RicardoFrantz.diff-next` |
| Command prefix | `vscode-pdf Next: …` | `vscode-diff Next: …` |

Both are made by machine-made; the Marketplace publisher id for both is
**RicardoFrantz**. Both repos share the same conventions:
`main` branch, `vX.Y.Z` tags, tag-driven release workflow with attached VSIX,
eslint 9 flat config, and a documented security model.

## Coming from `tomoki1207.vscode-pdf`?

You'll feel at home — this project started as a security-hardened fork of that
much-loved extension. What you gain:

- PDF.js upgraded from an aging bundle to the current **PDF.js 6** line, with
  rendering in a real worker thread.
- Live reload that survives TeX-style delete-and-recreate builds.
- View-state restore, dark reading modes, outline/thumbnail sidebars.
- Active maintenance, a documented security model, and automated releases.

This extension is intentionally a *previewer*, not a PDF editor: editing,
persistent annotations, page rearranging, and cloud sync are out of scope —
it stays small, fast, and auditable.

## Contributing & development

Issues and PRs are welcome at
[machine-made/vscode-pdf-next](https://github.com/machine-made/vscode-pdf-next).
See [docs/RELEASING.md](docs/RELEASING.md) for building from source and the
release process, and [docs/MAINTENANCE.md](docs/MAINTENANCE.md) for the
maintenance playbook.

## Credits & license

Made by machine-made. Built on [Mozilla PDF.js](https://github.com/mozilla/pdf.js) and the original
[vscode-pdf](https://github.com/tomoki1207/vscode-pdfviewer) by tomoki1207.
MIT licensed — see [LICENSE](./LICENSE).

## Disclaimer

This software is provided "as is", without warranty of any kind. To the extent
permitted by law, the authors and contributors are not liable for any damage, loss
or claim arising from its use or misuse. You are responsible for how you use it and
for following the laws and rules that apply to you. The full terms are in
[LICENSE](LICENSE).

This extension is not affiliated with or endorsed by Microsoft or Mozilla. Visual
Studio Code is a trademark of Microsoft Corporation. PDF.js is © Mozilla and
contributors, under the Apache License 2.0.
