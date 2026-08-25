# Noty 页面操作与视觉优化设计

日期：2026-08-25
状态：已获用户确认（方案 A：命令注册表驱动 + 令牌化主题）

## 背景与目标

Noty 当前 UI 为 shadcn/ui 默认主题原样未改，全局快捷键仅有 ⌘K 一个。
本次优化两条主线：

1. **操作**：全局快捷键体系、命令面板（⌘P）、TabBar 增强、细节修复包
2. **样式**：「纸·墨」双主题重设计（浅色纸 / 深色夜读墨）、宋体正文、macOS 红绿灯

非目标：不改 Rust 文件/同步/AI 逻辑，不新增运行时依赖。

## 1. 架构总览

```
src/lib/commands.ts              命令注册表（单一事实源）
src/components/CommandPalette/   ⌘P 面板（消费注册表）
src/hooks/useHotkeys.ts          全局键盘监听（消费注册表）
src/App.css                      纸·墨双主题令牌 + 宋体编辑器排版
```

命令注册表条目：

```ts
type Command = {
  id: string;              // "note.new"
  title: string;           // "新建笔记"
  group: "file" | "view" | "tab" | "ai" | "app";
  shortcut?: string;       // display 用 "⌘N"；监听由 useHotkeys 统一解析
  icon?: LucideIcon;
  when?: () => boolean;     // 不可用时面板置灰、快捷键不响应
  run: () => void | Promise<void>;
};
```

Tooltip 统一走 `titleWithShortcut(cmd)` 帮助函数，按钮提示与实际按键永不漂移。

## 2. 快捷键清单（v1）

| 键 | 命令 |
|---|---|
| ⌘N / ⌘⇧N | 新建笔记 / 新建文件夹 |
| ⌘B / ⌘⇧B | 切换侧栏（⌘B 仅编辑器外生效，见冲突处理） |
| ⌘K / ⌘P | 全文搜索 / 命令面板 |
| ⌘E | 富文本 ↔ 源码 |
| ⌘W / ⌘⇧W | 关闭标签 / 关闭全部 |
| ⌘⇧T | 恢复刚关闭的标签 |
| ⌘1…⌘9 | 切换到第 n 个标签 |
| ⌥⌘←/→ | 上/下一个标签 |
| ⌘\ / ⌘⇧\ | 大纲面板 / 属性面板 |
| ⌘, | 设置 |
| ⌘S | 立即 flush 保存（复用 pendingFlush） |
| ⌘⇧F | Ask AI |

### 冲突处理

- 编辑器聚焦时 ⌘B/I/E/U 是 Tiptap 内置格式键：B、I、U **不做全局拦截**（编辑优先）；
  ⌘B 全局侧栏仅在编辑器外生效 —— 折衷：⌘B 绑定改为**仅 UI 焦点**时生效，编辑器内用 ⌘⇧B 切侧栏（面板条目同时注册两个键）。
- ⌘E：禁用 Tiptap 内置 code 快捷键（`StarterKit.configure({ keyboardShortcuts })` 覆盖），全局生效。
- ⌘S：覆盖浏览器默认保存行为（preventDefault），全局生效。

### 输入框聚焦时的行为分类

- **全局命令**（面板/标签/侧栏/设置/保存）：输入框内也生效
- **文本编辑类**：不拦截

## 3. 命令面板（⌘P）

复用 SearchBar 已验证的浮层骨架（居中卡片 + 键盘导航 + Esc 关闭）。两个数据源：

- **命令**：注册表全量，按 group 分组显示；`when()` 为 false 时置灰不可执行
- **快速打开**：vault 树路径客户端过滤（仅文件名匹配；大树全文检索仍走 ⌘K 的 Rust 侧）

匹配算法：subsequence 打分（连续命中加分、词首/边界加分），纯函数实现，无新依赖。
空面板显示「最近打开的 5 个笔记」——EditorStore 新增 `recentPaths: string[]`（openNote 时 unshift 去重，上限 10）。

## 4. TabBar 增强

- 右端 `+` 按钮 → 新建笔记（新标签打开）
- 右键菜单（复用 `ui/context-menu`）：关闭 / 关闭其他 / 关闭右侧
- 拖拽重排：HTML5 DnD 拖动 tab 改变 `tabs` 数组顺序；`dataTransfer` key 与文件树不同（`noty/tab-index`），互不干扰
- 关闭的标签入 `closedTabs` 栈（上限 20），支撑 ⌘⇧T

EditorStore 新增：

```ts
reorderTab: (from: number, to: number) => void;
closedTabs: string[];
reopenTab: () => Promise<void>;   // 弹出栈顶，openNote(newTab)
closeOthers / closeToRight: (path: string) => Promise<void>;
recentPaths: string[];
```

## 5. 细节修复包

1. **文件树过滤框**：header 下方常驻输入框，输入即时过滤树并自动展开命中路径的祖先目录，清空恢复；Esc 清空
2. **Breadcrumb 文件夹可点击**：点击 → VaultStore `revealPath(path)` 展开该目录 + 滚动到视口 + 短暂高亮背景
3. **空状态升级**：居中卡片 —— 图标 + 说明 + 「新建笔记 ⌘N」主按钮 + 「搜索 ⌘K」次按钮
4. **选区浮动工具条**：Tiptap v3 BubbleMenu（`@tiptap/react/menus`），选中文本浮现：**B** / *I* / 删除线 / `code` / H2 切换；不占常驻空间；斜杠菜单保持不变

## 6. 纸·墨视觉主题

**签名元素**：朱砂印章红作为唯一强调色，只用于「当前/激活」语义——活动标签底部朱砂条、选中文本朱砂底纹、光标 caret 色。其余全部让位给墨色与纸色。

### 令牌表

| 令牌 | 浅色「纸」 | 深色「夜读墨」 |
|---|---|---|
| background | `#F6F3EC` 暖纸 | `#1A1815` 暖炭 |
| card / popover | `#FBF9F3` | `#211E1A` |
| foreground | `#2B2925` 墨 | `#D9D3C5` 米纸 |
| muted-foreground | `#8D8676` | `#8A8375` |
| border | `#E2DCCE` | `#34302A` |
| accent（朱砂） | `#B5432E` | `#D65942` |
| link（黛青） | `#41627A` | `#7FA3B8` |

侧栏用 card 色阶（比 background 深一档，"背光处"），编辑区最亮（"纸面朝光"），浮层加暖阴影 —— 同一纸色系三个亮度台阶建立层次。实现上 shadcn HSL 令牌结构不变，只改数值并新增 `--accent-warm`（朱砂）与 `--link` 两个令牌。

### 排版

- UI 无衬线：`-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
- **笔记正文衬线**：`"Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif`
  - 标题同栈加重（h1 600 / h2 600 / h3 500），h1/h2 上方大留白
  - 正文行高 1.9，段距放宽
  - 引用块：左侧 3px 墨色竖线 + 斜体
  - 代码块：暖灰纸底（muted 色阶）+ 等宽字体，圆角 6px
- 圆角全局收敛：`--radius: 0.375rem`
- 滚动条、`::selection`（朱砂 15% 底）、caret 色全部跟令牌走
- 深浅主题经 theme-provider 现有 `.dark` class 机制切换，跟随系统默认

### 动效

仅两处：侧栏开合已有 motion 动画保留；命令面板/搜索浮层出入用已有 tw-animate-css。其余不加动画，纸感靠静止的排版本身。

## 7. 窗口控制（平台自适应）

- **macOS**：Rust `setup` 中 `window.set_title_bar_style(Overlay)`（Tauri 2 macOS API）显示原生红绿灯；前端 `platform()` 检测为 macos 时 AppBar 隐藏自绘按钮、左侧 padding 72px 让位，拖拽区不变
- **Windows/Linux**：保持 `decorations: false`，右侧自绘按钮按新主题重绘（hover 用 accent 色，close hover 保持红）

## 8. 错误处理

- 命令 `run` 抛错 → `console.error` + StatusBar 轻量 toast（3s 自动消失，不引依赖）
- 快捷键监听统一在 App 根挂一个 listener（useHotkeys 内部管理），避免各组件重复绑定/泄漏

## 9. 验证计划

- **vitest 单测**（纯函数抽出）：
  - subsequence 打分函数（连续/边界/大小写/空查询）
  - EditorStore 新 reducer：reorderTab / closedTabs 栈 / recentPaths 去重上限
  - 命令注册表 when() 与快捷键解析（meta/ctrl/alt/shift + key 组合）
- **冒烟**：`pnpm tauri dev` 实机验证——
  - 深浅两套主题截图对比（ AppBar/FileTree/TabBar/编辑器/右面板/StatusBar）
  - ⌘P 面板：命令过滤、快速打开、键盘导航、when 置灰
  - BubbleMenu 选区浮现与格式化生效
  - macOS 红绿灯显示 + 拖拽正常
  - TabBar：+ 按钮、右键菜单三项、拖拽重排、⌘⇧T 恢复
  - 快捷键清单逐项过一遍（含编辑器聚焦时的冲突处理）
- **回归**：`pnpm test` 与 `cd src-tauri && cargo test` 全绿

## 10. 实施顺序（供 writing-plans 展开）

1. 主题令牌 + 字体排版（纯 CSS，先行：后续组件直接用新令牌）
2. 命令注册表 + useHotkeys + tooltip 助手
3. EditorStore 扩展（reorder/closedTabs/recentPaths/closeOthers）
4. 命令面板组件
5. TabBar 增强
6. 细节修复包（过滤框 / Breadcrumb / 空状态 / BubbleMenu）
7. 窗口控制平台自适应（Rust + AppBar）
8. 测试补齐 + 实机冒烟
