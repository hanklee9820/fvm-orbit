<div align="center">
  <img src="docs/images/icon.svg" alt="FVM Orbit Icon" width="112" height="112" />

  <h1>FVM Orbit</h1>

  <p>
    <strong>为 <a href="https://github.com/btwld/fvm">btwld/fvm</a> 打造的原生 macOS 桌面端与菜单栏 GUI 空间指挥台</strong>
  </p>

  <p>
    基于 <strong>Tauri v2 + Rust + React 19 + TypeScript + Tailwind CSS v4</strong> 构建，直连本机 <code>fvm</code> CLI 与 <code>fvm api</code> JSON 引擎，无黑盒、无侵入、安装包仅 ~9 MB。
  </p>

  <p>
    <a href="https://hanklee9820.github.io/fvm-orbit/"><strong>项目官网与使用说明</strong></a>
    &nbsp;·&nbsp;
    <a href="https://github.com/btwld/fvm"><strong>btwld/fvm 官方仓库</strong></a>
    &nbsp;·&nbsp;
    <a href="https://fvm.app/documentation/getting-started/overview"><strong>FVM 官方文档</strong></a>
  </p>
</div>

---

## 为什么做 FVM Orbit（与 [btwld/fvm](https://github.com/btwld/fvm) 的关系）

[FVM（Flutter Version Management）](https://github.com/btwld/fvm) 是 Flutter 生态最主流的多版本管理 CLI 工具，能够为每个项目独立绑定精确的 Flutter SDK 版本、Flavor 环境与自定义 Fork。

**FVM Orbit 是 `btwld/fvm` 的原生可视化桌面伴侣**：

- **100% 原生驱动，零配置侵入**：不造轮子、不改写 FVM 规范。所有数据直接来自本机 `fvm api context / list / releases / project / cleanup`，所有操作均调用真实的 `fvm` 子进程并遵循标准 `.fvmrc` 与 `~/fvm/versions` 目录结构。
- **全透明 CLI 控制台**：GUI 中的每一次点击都在底部实时流式输出对应的 `fvm ...` 命令与 stdout/stderr 日志，支持一键复制命令与随时中止下载/构建进程。
- **外部终端双向同步**：内置 Rust `notify` 文件系统监听，当你在终端手动执行 `fvm use` 或 `fvm install` 时，FVM Orbit 会自动刷新视图与拓扑关系。

---

## 应用界面预览

### 引力拓扑台（支持深色 / 浅色 / 跟随系统）

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-topology-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="docs/images/app-topology-light.png" />
    <img src="docs/images/app-topology-dark.png" alt="FVM Orbit 引力拓扑台" width="100%" />
  </picture>
</p>

<table>
  <tr>
    <td width="50%">
      <img src="docs/images/app-topology-light.png" alt="FVM Orbit 浅色模式" />
      <p align="center"><sub>浅色模式 · 项目 ↔ SDK 实时引力连线与 Flavor 管理</sub></p>
    </td>
    <td width="50%">
      <img src="docs/images/app-releases-dark.png" alt="FVM Orbit 版本宇宙" />
      <p align="center"><sub>版本宇宙 · 官方发布库、Commit Hash 与自定义 Fork 直装</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/images/app-cleanup-dark.png" alt="FVM Orbit 瘦身雷达" />
      <p align="center"><sub>瘦身雷达 · 磁盘占用透视、同系补丁零下载收拢与闲置清理</sub></p>
    </td>
    <td width="50%" valign="middle">
      <div align="center">
        <img src="docs/images/icon.svg" alt="Dark App Icon" width="88" />
        &nbsp;&nbsp;&nbsp;
        <img src="docs/images/icon-light.svg" alt="Light App Icon" width="88" />
        <p><sub>原生 macOS 体验 · 支持深浅双版 Dock 图标外观切换、菜单栏托盘常驻、可拖拽调高实时 CLI 控制台与 <code>⌘K</code> 全局命令面板</sub></p>
      </div>
    </td>
  </tr>
</table>

---

## 核心功能与 FVM CLI 能力映射

| 功能模块 | 对应 `btwld/fvm` 指令 | 视觉与交互亮点 |
| --- | --- | --- |
| **引力拓扑台** | `fvm use` / `fvm api project` | 左侧项目与 Flavor 槽位、右侧本地缓存 SDK、中间像素级 SVG 贝塞尔连线；原生目录选择器绑定项目、即时 `.fvmrc` 预览与 `--pin` / `--skip-pub-get` / `--skip-setup` / `--force` 开关 |
| **版本宇宙** | `fvm releases` / `fvm install` / `fvm global` / `fvm remove` | 4 渠道精选卡片（`stable / beta / dev / master`）、Commit Hash / Fork 直装（支持 `--no-setup`）、一键设为全局、Finder 直达缓存目录 |
| **瘦身雷达** | `fvm cleanup` / `fvm api cleanup` / `fvm destroy` | 精确核算每个缓存 SDK 与 `cache.git` 磁盘体积；一键执行 FVM 4.3 **同系小版本补丁零下载收拢**，区分受保护升级目标与安全可清理池 |
| **Spawn 并发测试舱** | `fvm spawn` / `fvm flavor` / `fvm exec` | Rust Tokio 并行拉起多个 Flutter SDK / Flavor 进程，并排流式对比输出、耗时与退出码，支持随时中止 |
| **体检 & IDE / MCP** | `fvm doctor` / `fvm api context` | 自动检测登录 Shell `$PATH` 中系统 Flutter 遮蔽 `~/fvm/default/bin` 的问题并支持备份安全写入 `~/.zshrc`；巡检 VS Code / IntelliJ `.idea` / Melos，并一键复制 **Dart MCP Server** 配置 JSON |
| **Forks & 全局配置** | `fvm fork` / `fvm config` | 管理自定义 Flutter Fork 别名（如鸿蒙版/公司内网分支）、清华镜像源一键切换、Git Reference Cache 开关与深浅 Dock 图标切换 |
| **原生 macOS 集成** | 全部高频操作 | 菜单栏常驻托盘 1 秒切全局 SDK、`⌘K` 全局命令面板、跟随系统/浅色/深色三态主题、底部可拖拽调高且记忆高度的透明 CLI 控制台 |

---

## 前置依赖

使用前请确保本机已安装 [btwld/fvm](https://github.com/btwld/fvm)（推荐 `>= 4.0`，完整支持 `fvm api` JSON 接口与 `fvm cleanup`）：

```bash
# macOS (Homebrew)
brew tap leoafarias/fvm
brew install fvm

# 验证安装
fvm --version
```

---

## 本地开发与打包

需要本地环境已安装 Node.js（推荐 `>= 20`）、`pnpm` 与 Rust 工具链：

```bash
# 克隆仓库
git clone https://github.com/hanklee9820/fvm-orbit.git
cd fvm-orbit

# 安装前端依赖
pnpm install

# 启动 Tauri 桌面端热重载开发模式
pnpm tauri:dev

# 仅前端 TypeScript 校验与构建
pnpm build

# 打包 macOS 原生 .app / .dmg
pnpm tauri:build
```

---

## 致谢

- [btwld/fvm](https://github.com/btwld/fvm) — 强大的 Flutter Version Management CLI 与 JSON API
- [Tauri v2](https://v2.tauri.app/) — 轻量、安全、原生的 Rust 跨平台桌面应用框架
