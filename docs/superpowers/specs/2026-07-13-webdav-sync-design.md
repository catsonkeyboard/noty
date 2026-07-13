# WebDAV 同步功能设计

日期:2026-07-13
状态:已确认

## 目标

为 noty 增加 vault 与 WebDAV 服务器之间的双向同步,重点兼容坚果云,同时遵循通用 WebDAV 标准(Nextcloud、InfiniCloud、Alist 等)。

## 需求决策

- **同步模式**:双向同步(本地 ⇄ 远端,含新增/修改/删除)。
- **触发方式**:手动按钮 + 启动时自动同步 + 定时自动同步(默认 10 分钟,可配置;编辑器有未保存内容时跳过该轮)。
- **冲突策略**:保留双方副本。远端版本另存为 `笔记名 (conflict YYYY-MM-DD HHmm).md`,本地版本保留原名并上传。
- **同步范围**:vault 内全部文件(含图片等附件),跳过隐藏文件(`.` 开头)。
- **凭据存储**:WebDAV 密码存系统钥匙串(keyring),不写入 config.json。

## 架构

### 同步算法:三方对比

在 `~/.noty/sync/<vault标识>.json` 存快照,记录上次同步成功时每个文件的:

```
path → { etag, localMtime, size }
```

每次同步:

1. `walkdir` 列出本地文件(mtime/size);
2. PROPFIND 列出远端文件(etag);
3. 与快照三方对比,对每个路径判定「本地是否变更」×「远端是否变更」,生成动作计划;
4. 逐个执行动作,**每完成一个文件立即更新快照**(中途断网可安全续传)。

动作判定表(L=本地相对快照,R=远端相对快照):

| 本地状态 | 远端状态 | 动作 |
|---|---|---|
| 新增 | 不存在 | 上传 |
| 不存在 | 新增 | 下载 |
| 新增 | 新增 | 冲突:远端存为 conflict 副本,本地上传(不比对内容,统一按冲突处理) |
| 修改 | 未变 | 上传 |
| 未变 | 修改 | 下载 |
| 修改 | 修改 | 冲突:远端存为 conflict 副本,本地上传 |
| 删除 | 未变 | 删除远端 |
| 未变 | 删除 | 删除本地 |
| 删除 | 修改 | 下载远端(不删,防丢数据) |
| 修改 | 删除 | 上传本地(不删,防丢数据) |
| 删除 | 删除 | 仅清理快照条目 |
| 未变 | 未变 | 无动作 |

安全原则:PROPFIND 列目录失败时,本轮**绝不执行任何删除动作**。

### Rust 端(新增 `src-tauri/src/sync/` 模块)

- **`webdav.rs`** — 极简 WebDAV 客户端,基于现有 `reqwest`,新增 `quick-xml` 解析 multistatus 响应:
  - 动词:PROPFIND / GET / PUT / MKCOL / DELETE
  - Basic 认证
  - PROPFIND 优先 `Depth: infinity`,服务器不支持(坚果云返回 4xx)时自动降级为逐目录 `Depth: 1`
  - 串行请求 + 指数退避重试,适配坚果云限流(免费版约 600 次/30 分钟)
- **`state.rs`** — 快照读写,原子写(临时文件 + rename,复用 config.rs 模式)
- **`engine.rs`** — 纯函数 `plan(local, remote, snapshot) → Vec<Action>` + 执行器;通过 Tauri 事件推送进度:`sync://progress`、`sync://done`、`sync://error`
- **新增命令**:`sync_now`、`webdav_test_connection`
- **`secrets.rs`** — 增加 `webdav-password` 钥匙串条目(set/get/has/delete)
- **`config.rs`** — `AppConfig` 增加:

  ```jsonc
  "webdav": {
    "url": "https://dav.jianguoyun.com/dav/",
    "username": "...",
    "remoteDir": "noty",
    "syncOnStart": true,
    "autoSyncIntervalMins": 10
  }
  ```

### 前端

- **`SyncStore`(zustand)** — 状态机 `idle / syncing / success / error / conflict`;记录上次同步时间、进度;监听 Tauri 事件;负责启动时同步和定时器(有未保存内容时跳过)。
- **设置对话框「同步」页** — 服务器地址(占位提示坚果云地址)、账号、应用密码、远端目录、「测试连接」按钮、自动同步开关与间隔。
- **状态栏同步指示器** — 点击手动同步;图标随状态变化(转圈/对勾/感叹号);悬停显示上次同步时间;产生冲突文件时提示。
- **同步后刷新** — 下载/删除文件后刷新文件树;当前打开的笔记被远端更新且本地无未保存修改时,自动从磁盘重载(有未保存修改时不动,交由冲突副本机制兜底)。

## 错误处理

- 认证失败 / 网络错误:状态栏显示错误态,可查看详情;不中断应用。
- 中途失败:已完成的文件已入快照,下轮续传;未完成的重新对比。
- PUT 为 WebDAV 原子替换,无需临时文件名。
- 上传前确保远端目录存在(逐级 MKCOL,405 视为已存在)。

## 测试

- `plan()` 纯函数单元测试:覆盖判定表全部 12 种组合。
- XML 解析:用坚果云真实 PROPFIND 响应样本做测试。
- 引擎集成测试:`tempfile` 构造本地 vault,mock 远端列表。
- 前端:SyncStore 状态机测试(vitest)。
