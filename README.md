# Noty

English | [简体中文](README.zh-CN.md)

A local-first, Obsidian-style markdown note-taking app with AI assistance, built with Tauri 2 and React.

Your notes are plain `.md` files in a folder you choose (your **vault**) — no database, no lock-in. Open them with any editor, sync them with any tool.

## Features

- **Local markdown vault** — every note is a plain markdown file with YAML frontmatter (`id`, `created`, `updated`, `tags`); subfolders supported
- **Notion-style editor** — rich-text editing powered by Tiptap, with a `/` slash-command menu for headings, lists, task lists, tables, code blocks (syntax highlighted), quotes and dividers
- **Source mode** — switch to raw markdown editing at any time
- **Multi-tab** — click to open a note in the current tab, `Cmd`/`Ctrl`+click to open it in a new tab
- **File tree sidebar** — create, rename, delete and drag-to-move notes and folders
- **Full-text search** — `Cmd`/`Ctrl`+`K` search palette across the whole vault
- **Outline & properties panel** — heading outline (click to jump) and document metadata in a right-hand panel
- **AI integration** — works with any OpenAI-compatible API (OpenAI, DeepSeek, Ollama, …):
  - *Ask AI*: generate content from a prompt and insert it at the cursor
  - *Summarize note*: streaming summary of the current note
  - API key is stored in the **system keychain**, never on disk
- **Quality of life** — breadcrumb navigation, word count and vault switcher in the status bar, adjustable editor width, dark/light/system theme, auto-save with debounce

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20.19 and [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) stable toolchain
- Platform build tools for Tauri — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

### Develop

```bash
pnpm install
pnpm tauri dev
```

On first launch you will be asked to pick a vault folder (defaults to `Documents/Noty`).

### Test

```bash
pnpm test              # frontend (vitest): markdown roundtrip, word count
cd src-tauri && cargo test   # backend: vault fs, frontmatter, config, SSE streaming
```

### Build

```bash
pnpm tauri build
```

Produces a platform bundle (`.app`/`.dmg` on macOS) under `src-tauri/target/release/bundle/`.

## Configuration

Settings live in `~/.noty/config.json` and can be edited by hand:

```json
{
  "vaultPath": "/Users/you/Documents/Noty",
  "theme": "dark",
  "editorWidth": "normal",
  "llm": {
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o-mini"
  }
}
```

The AI API key is **not** stored here — it is kept in the operating system keychain (set it in *Settings → AI* inside the app).

### Using a local model

Point the base URL at any OpenAI-compatible server, e.g. Ollama:

```json
"llm": { "baseUrl": "http://localhost:11434/v1", "model": "llama3" }
```

## Note Format

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440000
created: 2026-07-04T10:00:00+00:00
updated: 2026-07-04T11:30:00+00:00
tags: []
---

# Your note

Regular markdown content…
```

Files without frontmatter are opened fine — metadata is generated on first save.

## Tech Stack

| Layer | Tech |
| --- | --- |
| Shell | Tauri 2 (Rust) |
| UI | React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · shadcn/ui |
| Editor | Tiptap 3 + official markdown serialization |
| State | Zustand 5 |
| AI | OpenAI-compatible chat completions, streamed via Rust `reqwest` + Tauri IPC channels |
| Secrets | System keychain (`keyring`) |

## License

MIT
