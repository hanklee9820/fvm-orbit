#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const pkgPath = path.join(rootDir, "package.json");
const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");
const cargoLockPath = path.join(rootDir, "src-tauri", "Cargo.lock");

function runGit(args, options = {}) {
  const out = execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
  return typeof out === "string" ? out.trim() : "";
}

function parseSemver(ver) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(ver.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

function resolveTargetVersion(currentVersion, arg) {
  const cur = parseSemver(currentVersion);
  if (!cur) {
    throw new Error(`Invalid current version in tauri.conf.json: ${currentVersion}`);
  }
  const clean = arg.trim();
  if (clean === "patch") {
    return `${cur.major}.${cur.minor}.${cur.patch + 1}`;
  }
  if (clean === "minor") {
    return `${cur.major}.${cur.minor + 1}.0`;
  }
  if (clean === "major") {
    return `${cur.major + 1}.0.0`;
  }
  const explicit = clean.replace(/^v/, "");
  if (!parseSemver(explicit)) {
    throw new Error(
      `Invalid version argument "${arg}". Expected patch | minor | major | <x.y.z> (e.g. 0.1.1)`
    );
  }
  return explicit;
}

function updateCargoTomlVersion(content, nextVersion) {
  // Replace version = "..." inside the [package] section
  return content.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
    `$1${nextVersion}$3`
  );
}

function updateCargoLockVersion(content, nextVersion) {
  // Replace version = "..." inside [[package]] where name = "fvm-orbit"
  return content.replace(
    /(\[\[package\]\]\r?\nname\s*=\s*"fvm-orbit"\r?\nversion\s*=\s*")([^"]+)(")/,
    `$1${nextVersion}$3`
  );
}

function printUsage(currentVersion) {
  const cur = parseSemver(currentVersion) ?? { major: 0, minor: 1, patch: 0 };
  console.log(`
FVM Orbit — 一键发版工具 (Scheme B: v* Tag Trigger)
当前版本: v${currentVersion}

用法:
  pnpm release patch              # 小版本 +1 (v${currentVersion} -> v${cur.major}.${cur.minor}.${cur.patch + 1})
  pnpm release minor              # 次版本 +1 (v${currentVersion} -> v${cur.major}.${cur.minor + 1}.0)
  pnpm release major              # 主版本 +1 (v${currentVersion} -> v${cur.major + 1}.0.0)
  pnpm release <x.y.z>            # 指定版本号 (例如: pnpm release 0.2.0)

可选参数:
  --all, -a                       # 将当前工作区所有未提交改动一并打包进发版提交
  --retag                         # 重新推送当前版本标签以重新触发云端打包
  --dry-run                       # 仅预览将要执行的变更与 Git 命令，不实际写入或推送
`);
}

function main() {
  const rawArgs = process.argv.slice(2);
  const flags = new Set(rawArgs.filter((a) => a.startsWith("-")));
  const positional = rawArgs.filter((a) => !a.startsWith("-"));

  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
  const currentVersion = tauriConf.version;

  if (flags.has("--help") || flags.has("-h") || (positional.length === 0 && !flags.has("--retag"))) {
    printUsage(currentVersion);
    process.exit(0);
  }

  const versionArg = positional[0] ?? currentVersion;
  const nextVersion = resolveTargetVersion(currentVersion, versionArg);
  const tagName = `v${nextVersion}`;
  const isDryRun = flags.has("--dry-run");
  const includeAll = flags.has("--all") || flags.has("-a");
  const allowRetag = flags.has("--retag");

  if (nextVersion === currentVersion && !allowRetag) {
    console.error(
      `\x1b[33m目标版本 (${tagName}) 与当前版本相同。如需重新触发当前版本打包，请执行:\x1b[0m\n  pnpm release ${nextVersion} --retag`
    );
    process.exit(1);
  }

  // Check working tree status
  const statusOut = runGit(["status", "--porcelain"]);
  const dirtyLines = statusOut
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (dirtyLines.length > 0 && !includeAll) {
    console.error(
      `\x1b[33m检测到工作区有未提交的改动:\x1b[0m\n  ${dirtyLines.join("\n  ")}\n\n请先提交改动 (git add . && git commit)，或附加 --all 参数一并提交发版:\n  pnpm release ${versionArg} --all`
    );
    process.exit(1);
  }

  console.log(`\x1b[36m==> 准备发布 FVM Orbit ${tagName} (当前: v${currentVersion})\x1b[0m`);

  if (isDryRun) {
    console.log("  [dry-run] 将同步更新以下文件中的版本号为", nextVersion);
    console.log("    - package.json");
    console.log("    - src-tauri/tauri.conf.json");
    console.log("    - src-tauri/Cargo.toml");
    console.log("    - src-tauri/Cargo.lock");
    console.log(`  [dry-run] 将创建提交 "chore(release): ${tagName}" 并推送标签 ${tagName}`);
    return;
  }

  if (nextVersion !== currentVersion) {
    // 1. package.json
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.version = nextVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

    // 2. src-tauri/tauri.conf.json
    tauriConf.version = nextVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n", "utf8");

    // 3. src-tauri/Cargo.toml
    const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
    fs.writeFileSync(cargoTomlPath, updateCargoTomlVersion(cargoToml, nextVersion), "utf8");

    // 4. src-tauri/Cargo.lock
    if (fs.existsSync(cargoLockPath)) {
      const cargoLock = fs.readFileSync(cargoLockPath, "utf8");
      fs.writeFileSync(cargoLockPath, updateCargoLockVersion(cargoLock, nextVersion), "utf8");
    }
  }

  // Stage files
  if (includeAll) {
    runGit(["add", "-A"]);
  } else if (nextVersion !== currentVersion) {
    runGit([
      "add",
      "package.json",
      "src-tauri/tauri.conf.json",
      "src-tauri/Cargo.toml",
      "src-tauri/Cargo.lock",
    ]);
  }

  // Commit if there are staged changes
  const staged = runGit(["diff", "--cached", "--name-only"]);
  if (staged) {
    console.log(`\x1b[36m==> 创建发版提交: chore(release): ${tagName}\x1b[0m`);
    runGit(["commit", "-m", `chore(release): ${tagName}`], { stdio: "inherit" });
  }

  // If retagging an existing remote tag, delete the remote tag first so GitHub receives a fresh tag push event
  if (allowRetag) {
    try {
      console.log(`\x1b[36m==> 清理远端旧标签 ${tagName}...\x1b[0m`);
      runGit(["push", "origin", `:refs/tags/${tagName}`], { stdio: "inherit" });
    } catch {
      // ignore if remote tag did not exist
    }
  }

  console.log(`\x1b[36m==> 打标签 ${tagName}\x1b[0m`);
  runGit(["tag", "-a", tagName, "-f", "-m", `Release ${tagName}`], { stdio: "inherit" });

  console.log(`\x1b[36m==> 推送 main 分支与 ${tagName} 标签到 GitHub...\x1b[0m`);
  runGit(["push", "origin", "main", `refs/tags/${tagName}`], { stdio: "inherit" });

  console.log(`
\x1b[32m✓ 已成功触发 ${tagName} 自动构建与发布！\x1b[0m
  - GitHub Actions 构建进度: https://github.com/hanklee9820/fvm-orbit/actions
  - GitHub Releases 页面:    https://github.com/hanklee9820/fvm-orbit/releases/tag/${tagName}
`);
}

main();
