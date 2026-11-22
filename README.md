<div align="center">
  <img src="docs/images/icon.svg" alt="FVM Orbit Icon" width="112" height="112" />

  <h1>FVM Orbit</h1>

  <p>
    <strong>为 <a href="https://github.com/btwld/fvm">btwld/fvm</a> 打造的跨平台原生桌面端与系统托盘 GUI 空间指挥台（支持 macOS &amp; Windows）</strong>
  </p>

  <p>
    基于 <strong>Tauri v2 + Rust + React 19 + TypeScript + Tailwind CSS v4</strong> 构建，直连本机 <code>fvm</code> CLI 与 <code>fvm api</code> JSON 引擎，无黑盒、无侵入、原生安装包仅 ~3–6 MB。
  </p>

  <p>
    <a href="https://hanklee9820.github.io/fvm-orbit/"><strong>项目官网与使用说明（中 / EN）</strong></a>
    &nbsp;·&nbsp;
    <a href="https://github.com/hanklee9820/fvm-orbit/releases"><strong>下载安装包 (Releases)</strong></a>
    &nbsp;·&nbsp;
    <a href="https://github.com/btwld/fvm"><strong>btwld/fvm 官方仓库</strong></a>
    &nbsp;·&nbsp;
    <a href="https://fvm.app/documentation/getting-started/overview"><strong>FVM 官方文档</strong></a>
  </p>

  <p>
    <strong>简体中文</strong>
    &nbsp;·&nbsp;
    <a href="README_EN.md"><strong>English</strong></a>
  </p>
</div>

---

## 为什么做 FVM Orbit（与 [btwld/fvm](https://github.com/btwld/fvm) 的关系）

[FVM（Flutter Version Management）](https://github.com/btwld/fvm) 是 Flutter 生态最主流的多版本管理 CLI 工具，能够为每个项目独立绑定精确的 Flutter SDK 版本、Flavor 环境与自定义 Fork。

**FVM Orbit 是 `btwld/fvm` 的跨平台原生可视化桌面伴侣（支持 macOS & Windows）**：

- **100% 原生驱动，零配置侵入**：不造轮子、不改写 FVM 规范。所有数据直接来自本机 `fvm api context / list / releases / project / cleanup`，所有操作均调用真实的 `fvm` 子进程并遵循标准 `.fvmrc` 与 `~/fvm/versions`（Windows 为 `%USERPROFILE%\fvm\versions`）目录结构。
- **全透明 CLI 控制台**：GUI 中的每一次点击都在底部实时流式输出对应的 `fvm ...` 命令与 stdout/stderr 日志，支持一键复制命令与随时中止下载/构建进程。
- **外部终端双向同步**：内置 Rust `notify` 文件系统监听，当你在终端手动执行 `fvm use` 或 `fvm install` 时，FVM Orbit 会自动刷新视图与拓扑关系。
- **全链路中英文国际化（i18n）**：原生支持 **跟随系统 / 简体中文 / English** 三态无缝切换，一次性覆盖前端六大工作舱、macOS 原生顶部应用菜单、跨平台系统托盘与 Rust 后端诊断输出。

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
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-releases-dark.png" />
        <source media="(prefers-color-scheme: light)" srcset="docs/images/app-releases-light.png" />
        <img src="docs/images/app-releases-dark.png" alt="FVM Orbit 版本宇宙" />
      </picture>
      <p align="center"><sub>版本宇宙 · 官方发布库、Commit Hash 与自定义 Fork 直装</sub></p>
    </td>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-cleanup-dark.png" />
        <source media="(prefers-color-scheme: light)" srcset="docs/images/app-cleanup-light.png" />
        <img src="docs/images/app-cleanup-dark.png" alt="FVM Orbit 瘦身雷达" />
      </picture>
      <p align="center"><sub>瘦身雷达 · 磁盘占用透视、同系补丁零下载收拢与闲置清理</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/images/app-topology-light.png" alt="FVM Orbit 浅色模式" />
      <p align="center"><sub>浅色模式 · 随系统外观自动适配</sub></p>
    </td>
    <td width="50%" valign="middle">
      <div align="center">
        <img src="docs/images/icon.svg" alt="Dark App Icon" width="88" />
        &nbsp;&nbsp;&nbsp;
        <img src="docs/images/icon-light.svg" alt="Light App Icon" width="88" />
        <p><sub>原生跨平台桌面体验（macOS &amp; Windows）· 支持中英双语一键切换、深浅双版应用图标切换、<code>⌘,</code> / <code>Ctrl+,</code> 设置中心（网络代理 / 图标 / 语言 / 更新）、系统托盘常驻、可拖拽调高实时 CLI 控制台与 <code>⌘K</code> / <code>Ctrl+K</code> 全局命令面板</sub></p>
      </div>
    </td>
  </tr>
</table>

---

## 核心功能与 FVM CLI 能力映射

| 功能模块 | 对应 `btwld/fvm` 指令 | 视觉与交互亮点 |
| --- | --- | --- |
| **引力拓扑台** | `fvm use` / `fvm api project` | 左侧项目与 Flavor 槽位、右侧本地缓存 SDK、中间像素级 SVG 贝塞尔连线；原生目录选择器绑定项目、即时 `.fvmrc` 预览与 `--pin` / `--skip-pub-get` / `--skip-setup` / `--force` 开关 |
| **版本宇宙** | `fvm releases` / `fvm install` / `fvm global` / `fvm remove` | 4 渠道精选卡片（`stable / beta / dev / master`）、Commit Hash / Fork 直装（支持 `--no-setup`）、一键设为全局、Finder / 资源管理器直达缓存目录 |
| **瘦身雷达** | `fvm cleanup` / `fvm api cleanup` / `fvm destroy` | 精确核算每个缓存 SDK 与 `cache.git` 磁盘体积；一键执行 FVM 4.3 **同系小版本补丁零下载收拢**，区分受保护升级目标与安全可清理池 |
| **Spawn 并发测试舱** | `fvm spawn` / `fvm flavor` / `fvm exec` | Rust Tokio 并行拉起多个 Flutter SDK / Flavor 进程，并排流式对比输出、耗时与退出码，支持随时中止 |
| **体检 & IDE / MCP** | `fvm doctor` / `fvm api context` | 自动检测 `PATH` 中系统 Flutter 遮蔽 FVM 全局路径的问题，支持 macOS 备份安全写入 `~/.zshrc` 与 Windows 自动写入用户 `Path`；巡检 VS Code / IntelliJ `.idea` / Melos，并一键复制 **Dart MCP Server** 配置 JSON |
| **Forks & 全局配置** | `fvm fork` / `fvm config` | 管理自定义 Flutter Fork 别名（如鸿蒙版/公司内网分支）、清华镜像源一键切换与 Git Reference Cache 开关 |
| **设置中心 (`⌘,` / `Ctrl+,`) & 代理** | `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` 注入 | 支持 **直连模式**（清除代理变量并注入 `NO_PROXY=*`）、**跟随系统代理**（macOS `scutil --proxy` / Windows 注册表自动探测）与 **自定义 HTTP/HTTPS/SOCKS5 代理**（内置 Clash/Surge/V2Ray 预设与连通性延迟测试），并提供深浅双版应用图标、语言设置与应用内检查更新 |
| **全链路国际化 (i18n)** | 前端 UI + 原生菜单 + 托盘 + Rust 后端 | 支持 **跟随系统（macOS `NSLocale` / Windows `GetUserDefaultUILanguage`）/ 简体中文 (`zh-CN`) / English (`en-US`)**；标题栏 `中/EN` 按钮、`⌘,` / `Ctrl+,` 设置中心与 `⌘K` / `Ctrl+K` 命令面板均可零延迟切换并实时刷新原生菜单与系统托盘 |
| **原生桌面集成（macOS & Windows）** | 全部高频操作 | macOS 菜单栏 / Windows 系统托盘常驻 1 秒切全局 SDK、`⌘K` / `Ctrl+K` 全局命令面板、跟随系统/浅色/深色三态主题、底部可拖拽调高且记忆高度的透明 CLI 控制台 |

---

## 国际化（i18n）支持说明

FVM Orbit 内置从前端界面到原生系统外壳、再到 Rust 后端的 **全链路中英文国际化引擎**：

- **支持语言与系统自动识别**：
  - **`跟随系统 (System)`**（默认）：启动时由 Rust 后端通过 macOS `NSLocale.preferredLanguages()`、Windows `GetUserDefaultUILanguage()`（及 `LC_ALL` / `LC_MESSAGES` / `LANG` 回退）自动探测系统首选语言，匹配为简体中文或 English。
  - **`简体中文 (zh-CN)`** / **`English (en-US)`**：可显式锁定界面语言，偏好配置持久化保存于应用配置目录 `language.txt`（前端同步镜像至 `localStorage` 实现首屏零闪烁渲染）。
- **三处便捷切换入口**：
  1. **顶部标题栏快切**：点击主窗口右上角的语言胶囊按钮（`中` / `EN`），1 秒切换中英文。
  2. **设置中心 (`⌘,` / `Ctrl+,`)**：按下 `⌘,`（Windows 为 `Ctrl+,`）或点击顶栏齿轮图标 / macOS 菜单栏 `FVM Orbit → 设置…`，在 **「界面语言 / Interface Language」** 标签页中选择 `跟随系统语言`、`简体中文` 或 `English`。
  3. **全局命令面板 (`⌘K` / `Ctrl+K`)**：按下 `⌘K`（Windows 为 `Ctrl+K`），输入 `语言`、`lang`、`Chinese` 或 `English` 即可直接回车切换。
- **全栈实时联动（无需重启应用）**：
  - **React 前端全视图**：六大工作舱、快切舱浮窗、设置中心、命令面板、实时 CLI 控制台与 Toast 通知即时重绘，并拥有编译期 TypeScript 字典键完整性校验。
  - **macOS 原生顶部应用菜单（App Menu）**：切换瞬间通过 Tauri IPC 动态重建 macOS 屏幕顶部菜单栏（`关于 FVM Orbit / 设置… / 文件 / 编辑 / 显示 / 窗口` ↔ `About FVM Orbit / Settings… / File / Edit / View / Window`）。
  - **跨平台系统托盘（System Tray）**：macOS 菜单栏 / Windows 系统托盘菜单项、全局 SDK 状态头与图标悬浮 Tooltip 同步切换为对应语言。
  - **Rust 后端诊断与日志**：CLI 控制台注入的代理提示、网络连通性探测结果、`PATH` 写入反馈及错误诊断信息均按当前语言输出。

---

## 下载安装 (Releases)

前往 **[GitHub Releases](https://github.com/hanklee9820/fvm-orbit/releases)** 下载对应平台的预编译安装包：

| 平台 | 架构 | 安装包格式 |
| --- | --- | --- |
| **macOS** | Apple Silicon (`aarch64` / M1–M4) | `.dmg` / `.app.tar.gz` |
| **macOS** | Intel (`x86_64`) | `.dmg` / `.app.tar.gz` |
| **Windows** | 64-bit (`x64`) | `-setup.exe` (NSIS) / `.msi` (WiX) |
| **Windows** | ARM64 (`aarch64`) | `-setup.exe` (NSIS) |

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

```powershell
# Windows (Chocolatey，管理员 PowerShell)
choco install fvm

# 或 Windows (Scoop，无需管理员权限)
scoop install fvm

# 验证安装（建议在 Windows 设置中开启「开发者模式」以支持符号链接）
fvm --version
```

---

## 本地开发与打包

需要本地环境已安装 **Node.js（推荐 `>= 20`）**、**`pnpm`** 与 **Rust 工具链**：
- **macOS**：另需 Xcode Command Line Tools。
- **Windows**：另需 **Microsoft C++ Build Tools (MSVC)** 与 **WebView2 Runtime**（Windows 11 默认自带）。

> **说明**：Tauri v2 依赖各平台原生构建工具链（macOS 产出 `.app` / `.dmg`，Windows 产出 `.exe` / `.msi`），不支持在 macOS 上直接交叉打包 Windows 安装包；如需跨平台同时产出四端安装包，请使用下方的 `pnpm release` 触发 GitHub Actions 云端打包。

### 本地开发

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
```

### 打包 macOS（`.app` / `.dmg`）

```bash
# 在 macOS 上打包当前架构（Apple Silicon 或 Intel）
pnpm tauri:build
open "src-tauri/target/release/bundle/macos/FVM Orbit.app"

# 可选：交叉打包 Intel (x86_64) 或 Apple Silicon (aarch64)
rustup target add x86_64-apple-darwin
pnpm tauri:build -- --target x86_64-apple-darwin
```

### 打包 Windows（`-setup.exe` / `.msi`）

```powershell
# 在 Windows x64 上打包（默认同时产出 NSIS -setup.exe 与 WiX .msi）
pnpm tauri:build
explorer src-tauri\target\release\bundle\nsis
# 产物目录:
#   src-tauri\target\release\bundle\nsis\FVM Orbit_<version>_x64-setup.exe
#   src-tauri\target\release\bundle\msi\FVM Orbit_<version>_x64_en-US.msi

# 在 Windows 上打包 ARM64（仅 NSIS 安装包）
rustup target add aarch64-pc-windows-msvc
pnpm tauri:build -- --target aarch64-pc-windows-msvc --bundles nsis
```

### 一键跨平台云端发版（GitHub Actions）

```bash
# 自动同步版本号、打 v* 标签并触发 GitHub Actions 四端并行构建与发布
# （macOS arm64 / macOS x64 / Windows x64 / Windows ARM64）
pnpm release patch          # 或 pnpm release minor / pnpm release 0.2.0
```

---

## 致谢

- [btwld/fvm](https://github.com/btwld/fvm) — 强大的 Flutter Version Management CLI 与 JSON API
- [Tauri v2](https://v2.tauri.app/) — 轻量、安全、原生的 Rust 跨平台桌面应用框架
