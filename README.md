# FVM Orbit

基于 **Tauri v2 + Rust + React 19 + TypeScript + Tailwind CSS v4 + Zustand** 构建的 macOS Flutter SDK 空间指挥台与菜单栏快切工具，直连本机 `fvm` CLI 与 `fvm api` JSON 引擎。

## 核心功能

- **引力拓扑台（Topology Studio）**：左侧追踪项目与 Flavor 槽位、右侧本地缓存 SDK、中间实时 SVG 贝塞尔连线；支持原生 macOS 目录选择器绑定新项目、即时 `.fvmrc` 预览与 `fvm use` 参数开关（`--pin` / `--skip-pub-get` / `--skip-setup` / `--force`）。
- **版本宇宙（Releases & Installer）**：同步 `fvm api releases` 官方发布库，支持按 Channel / Dart / Commit 检索、任意版本 / Commit Hash / Fork 直装（含 `--no-setup`）、设为全局、在 Finder 中打开与移除缓存。
- **瘦身雷达（Smart Cleanup）**：实时核算每个缓存 SDK 与 `cache.git` 磁盘占用；释放 FVM 4.3 `fvm api cleanup` 能力，一键完成同系小版本补丁零下载收拢与安全清理 `removable` 闲置版本。
- **Spawn 并发测试舱（Spawn & Flavor Matrix）**：Rust Tokio 并行拉起多个 `fvm spawn` / `fvm flavor` / `fvm exec` 进程，实时流式对比输出与耗时，并支持随时中止。
- **体检 & IDE / Dart MCP 联动**：自动检测登录 Shell `$PATH` 中系统 Flutter 遮蔽 `~/fvm/default/bin` 的问题，支持备份并安全写入 `~/.zshrc`；一键复制 VS Code、Dart MCP Server 配置并实时查看 `fvm doctor` 原文。
- **Forks & 全局配置**：可视化管理 `fvm fork add/list/remove` 与 `fvm config`（含清华镜像一键切换与 Git Cache 开关）。
- **原生 macOS 菜单栏常驻托盘 + 实时文件监听 + 透明 CLI 控制台**：支持从菜单栏 1 秒切换全局 SDK；支持跟随系统 / 浅色 / 深色三态主题自动同步；使用 `notify` 监听 `~/fvm`，在外部终端运行 `fvm` 后界面自动同步刷新；底部实时流式输出每条 CLI 命令与日志。

## 本地开发与打包

```bash
# 安装前端依赖
pnpm install

# 启动 Tauri 桌面端热重载开发模式
pnpm tauri:dev

# 仅前端 TypeScript 校验与构建
pnpm build

# 打包 macOS 生产版 .app / .dmg
pnpm tauri:build
```
