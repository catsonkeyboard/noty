# Noty

[English](README.md) | 简体中文

一款本地优先、类 Obsidian 的 Markdown 笔记应用，内置 AI 助手，基于 Tauri 2 和 React 构建。

笔记以纯 `.md` 文件形式存放在你选择的文件夹（**仓库 / vault**）中——没有数据库、没有格式绑定，可以用任何编辑器打开，用任何工具同步。

## 功能特性

- **本地 Markdown 仓库** — 每篇笔记是一个带 YAML frontmatter（`id`、`created`、`updated`、`tags`）的纯 Markdown 文件，支持子文件夹
- **Notion 风格编辑器** — 基于 Tiptap 的富文本编辑，输入 `/` 唤起命令菜单：标题、列表、任务清单、表格、代码块（语法高亮）、引用、分割线
- **源码模式** — 随时切换为原始 Markdown 文本编辑
- **多标签页** — 点击在当前标签打开笔记，`Cmd`/`Ctrl`+点击在新标签打开
- **文件树侧边栏** — 新建、重命名、删除、拖拽移动笔记和文件夹
- **全文搜索** — `Cmd`/`Ctrl`+`K` 唤起搜索面板，检索整个仓库
- **目录与属性面板** — 右侧面板显示标题大纲（点击跳转）和文档元数据
- **AI 集成** — 兼容任何 OpenAI 格式的 API（OpenAI、DeepSeek、Ollama 等）：
  - *Ask AI*：按提示生成内容并插入光标处
  - *总结笔记*：流式生成当前笔记的摘要
  - API key 存放在**系统钥匙串**中，永不落盘
- **体验细节** — 面包屑导航、状态栏字数统计与仓库切换、编辑区宽度调节、深色/浅色/跟随系统主题、防抖自动保存

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 20.19 与 [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) 稳定版工具链
- Tauri 所需的平台构建工具 — 参见 [Tauri 环境准备指南](https://tauri.app/start/prerequisites/)

### 开发

```bash
pnpm install
pnpm tauri dev
```

首次启动会引导你选择仓库文件夹（默认 `Documents/Noty`）。

### 测试

```bash
pnpm test              # 前端（vitest）：Markdown 往返、字数统计
cd src-tauri && cargo test   # 后端：文件操作、frontmatter、配置、SSE 流式
```

### 打包

```bash
pnpm tauri build
```

产物在 `src-tauri/target/release/bundle/` 下（macOS 为 `.app` / `.dmg`）。

## 配置

配置文件位于 `~/.noty/config.json`，可以直接手动编辑：

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

AI 的 API key **不在**此文件中——它保存在操作系统钥匙串里（在应用内 *Settings → AI* 中设置）。

### 使用本地模型

把 Base URL 指向任何 OpenAI 兼容服务即可，例如 Ollama：

```json
"llm": { "baseUrl": "http://localhost:11434/v1", "model": "llama3" }
```

## 笔记格式

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440000
created: 2026-07-04T10:00:00+00:00
updated: 2026-07-04T11:30:00+00:00
tags: []
---

# 你的笔记

正常的 Markdown 内容……
```

没有 frontmatter 的文件也能正常打开——首次保存时会自动生成元数据。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 外壳 | Tauri 2（Rust） |
| 界面 | React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · shadcn/ui |
| 编辑器 | Tiptap 3 + 官方 Markdown 序列化 |
| 状态管理 | Zustand 5 |
| AI | OpenAI 兼容 chat completions，Rust `reqwest` + Tauri IPC 通道流式传输 |
| 密钥 | 系统钥匙串（`keyring`） |

## 许可证

MIT
