use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const PATH_SEP: char = if cfg!(windows) { ';' } else { ':' };
const PATH_SEP_STR: &str = if cfg!(windows) { ";" } else { ":" };

static RESOLVED_PATH: OnceLock<String> = OnceLock::new();
static RESOLVED_FVM_BIN: OnceLock<String> = OnceLock::new();

/// Resolves the user's full PATH including login-shell PATH and common macOS/Windows/Linux package managers.
/// Packaged desktop bundles often do not inherit interactive terminal PATH unless queried explicitly.
pub fn resolved_path_env() -> &'static str {
    RESOLVED_PATH.get_or_init(|| {
        let mut segments: Vec<String> = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();

        let mut push_list = |raw: &str| {
            for part in raw.split(PATH_SEP) {
                let p = part.trim();
                if !p.is_empty() {
                    let key = if cfg!(windows) {
                        p.to_ascii_lowercase()
                    } else {
                        p.to_string()
                    };
                    if seen.insert(key) {
                        segments.push(p.to_string());
                    }
                }
            }
        };

        // 1. Query login shell PATH on Unix
        #[cfg(unix)]
        {
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
            if let Ok(output) = Command::new(&shell)
                .args(["-lc", "printf %s \"$PATH\""])
                .output()
            {
                if output.status.success() {
                    let s = String::from_utf8_lossy(&output.stdout);
                    push_list(&s);
                }
            }
        }

        // 2. Current process PATH
        if let Ok(curr) = std::env::var("PATH") {
            push_list(&curr);
        }

        // 3. Well-known fallback binary locations
        if let Some(home) = dirs::home_dir() {
            push_list(&home.join("fvm").join("default").join("bin").to_string_lossy());
            #[cfg(not(windows))]
            {
                push_list(&home.join(".pub-cache/bin").to_string_lossy());
                push_list(&home.join(".local/bin").to_string_lossy());
            }
            #[cfg(windows)]
            {
                push_list(&home.join("scoop").join("shims").to_string_lossy());
                push_list(
                    &home
                        .join("AppData")
                        .join("Local")
                        .join("Pub")
                        .join("Cache")
                        .join("bin")
                        .to_string_lossy(),
                );
                push_list(
                    &home
                        .join("AppData")
                        .join("Local")
                        .join("fvm")
                        .to_string_lossy(),
                );
            }
        }

        #[cfg(windows)]
        {
            if let Some(local_data) = dirs::data_local_dir() {
                push_list(
                    &local_data
                        .join("Pub")
                        .join("Cache")
                        .join("bin")
                        .to_string_lossy(),
                );
                push_list(&local_data.join("fvm").to_string_lossy());
            }
            push_list(r"C:\ProgramData\chocolatey\bin");
        }

        #[cfg(not(windows))]
        {
            push_list("/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");
        }

        segments.join(PATH_SEP_STR)
    })
}

/// Resolves the absolute path to the `fvm` executable.
pub fn resolve_fvm_binary() -> &'static str {
    RESOLVED_FVM_BIN.get_or_init(|| {
        if let Some(found) = find_executable_in_path("fvm", resolved_path_env()) {
            return found.to_string_lossy().to_string();
        }
        #[cfg(not(windows))]
        {
            let candidates = ["/opt/homebrew/bin/fvm", "/usr/local/bin/fvm"];
            for cand in candidates {
                if Path::new(cand).is_file() {
                    return cand.to_string();
                }
            }
        }
        #[cfg(windows)]
        {
            let cand = r"C:\ProgramData\chocolatey\bin\fvm.exe";
            if Path::new(cand).is_file() {
                return cand.to_string();
            }
        }
        "fvm".to_string()
    })
}

/// Finds the first matching executable on the provided PATH string.
pub fn find_executable_in_path(bin_name: &str, path_env: &str) -> Option<PathBuf> {
    #[cfg(windows)]
    let candidate_names: Vec<String> = if Path::new(bin_name).extension().is_some() {
        vec![bin_name.to_string()]
    } else {
        vec![
            format!("{bin_name}.exe"),
            format!("{bin_name}.bat"),
            format!("{bin_name}.cmd"),
            bin_name.to_string(),
        ]
    };

    #[cfg(not(windows))]
    let candidate_names: Vec<String> = vec![bin_name.to_string()];

    for dir in path_env.split(PATH_SEP) {
        let dir = dir.trim();
        if dir.is_empty() {
            continue;
        }
        let dir_path = Path::new(dir);
        for name in &candidate_names {
            let candidate = dir_path.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Finds the active `flutter` binary on the user's real login shell / system PATH.
pub fn active_shell_flutter_path() -> Option<String> {
    #[cfg(unix)]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        if let Ok(output) = Command::new(&shell)
            .args(["-lc", "command -v flutter"])
            .output()
        {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !s.is_empty() {
                    return Some(s);
                }
            }
        }
    }
    #[cfg(windows)]
    {
        if let Ok(output) = Command::new("where.exe")
            .arg("flutter")
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if output.status.success() {
                if let Some(first) = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .map(str::trim)
                    .find(|l| !l.is_empty())
                {
                    return Some(first.to_string());
                }
            }
        }
    }
    find_executable_in_path("flutter", resolved_path_env())
        .map(|p| p.to_string_lossy().to_string())
}

/// Checks whether the global FVM bin directory has higher PATH priority than any other flutter binary.
pub fn check_path_priority(global_bin_path: &str) -> (Option<String>, bool) {
    let active = active_shell_flutter_path();
    let expected_prefix = Path::new(global_bin_path);
    let ok = match &active {
        Some(resolved) => {
            let p = Path::new(resolved);
            let norm_resolved = resolved.replace('\\', "/").to_ascii_lowercase();
            let norm_expected = global_bin_path
                .replace('\\', "/")
                .trim_end_matches('/')
                .to_ascii_lowercase();
            p.starts_with(expected_prefix)
                || (!norm_expected.is_empty() && norm_resolved.starts_with(&norm_expected))
                || norm_resolved.contains("/fvm/default/bin")
        }
        None => false,
    };
    (active, ok)
}

/// Safely configures FVM global SDK PATH priority (`~/.zshrc` on macOS/Linux, User `Path` on Windows).
pub fn append_fvm_path_to_zshrc() -> Result<String, String> {
    #[cfg(windows)]
    {
        let home = dirs::home_dir().ok_or_else(|| {
            crate::i18n::pick("无法定位用户主目录", "Could not locate user home directory")
                .to_string()
        })?;
        let fvm_bin = home
            .join("fvm")
            .join("default")
            .join("bin")
            .to_string_lossy()
            .to_string();

        let ps_script = format!(
            "$target = '{}'; \
             $cur = [Environment]::GetEnvironmentVariable('Path', 'User'); \
             if ($null -eq $cur) {{ $cur = '' }}; \
             $parts = $cur -split ';' | Where-Object {{ $_ -ne '' }}; \
             if ($parts | Where-Object {{ $_.TrimEnd('\\') -ieq $target.TrimEnd('\\') }}) {{ \
                 Write-Output 'ALREADY_SET'; \
             }} else {{ \
                 $next = (@($target) + $parts) -join ';'; \
                 [Environment]::SetEnvironmentVariable('Path', $next, 'User'); \
                 Write-Output 'UPDATED'; \
             }}",
            fvm_bin.replace('\'', "''")
        );

        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| {
                format!(
                    "{}: {e}",
                    crate::i18n::pick(
                        "更新 Windows 用户 PATH 失败",
                        "Failed to update Windows User PATH"
                    )
                )
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains("ALREADY_SET") {
            return Ok(crate::i18n::pick(
                "Windows 用户 PATH 中已包含 fvm\\default\\bin，请重启终端使其生效。",
                "Windows User PATH already contains fvm\\default\\bin. Restart your terminal to apply.",
            )
            .to_string());
        }
        return Ok(crate::i18n::pick(
            "已将 %USERPROFILE%\\fvm\\default\\bin 写入 Windows 用户 PATH 首位，重新打开终端即生效。",
            "Added %USERPROFILE%\\fvm\\default\\bin to the front of Windows User PATH. Restart your terminal to apply.",
        )
        .to_string());
    }

    #[cfg(not(windows))]
    {
        let home = dirs::home_dir().ok_or_else(|| {
            crate::i18n::pick("无法定位用户主目录", "Could not locate user home directory")
                .to_string()
        })?;
        let zshrc = home.join(".zshrc");
        let export_line = r#"export PATH="$HOME/fvm/default/bin:$PATH""#;

        let existing = if zshrc.exists() {
            std::fs::read_to_string(&zshrc).map_err(|e| {
                format!(
                    "{}: {e}",
                    crate::i18n::pick("读取 ~/.zshrc 失败", "Failed to read ~/.zshrc")
                )
            })?
        } else {
            String::new()
        };

        if existing.contains("fvm/default/bin") {
            return Ok(crate::i18n::pick(
                "~/.zshrc 中已包含 fvm/default/bin 配置，无需重复添加。请重启终端或执行 source ~/.zshrc。",
                "~/.zshrc already contains fvm/default/bin. Restart your terminal or run source ~/.zshrc.",
            )
            .to_string());
        }

        // Create a clean backup before modifying
        if zshrc.exists() {
            let backup = home.join(".zshrc.fvm-orbit.bak");
            let _ = std::fs::copy(&zshrc, &backup);
        }

        let mut updated = existing;
        if !updated.is_empty() && !updated.ends_with('\n') {
            updated.push('\n');
        }
        updated.push_str("\n# Added by FVM Orbit — prioritize FVM global Flutter SDK\n");
        updated.push_str(export_line);
        updated.push('\n');

        std::fs::write(&zshrc, updated).map_err(|e| {
            format!(
                "{}: {e}",
                crate::i18n::pick("写入 ~/.zshrc 失败", "Failed to write ~/.zshrc")
            )
        })?;
        Ok(crate::i18n::pick(
            "已备份 ~/.zshrc.fvm-orbit.bak 并写入 PATH 优先级配置，重新打开终端或运行 source ~/.zshrc 即生效。",
            "Backed up ~/.zshrc.fvm-orbit.bak and updated PATH priority. Restart your terminal or run source ~/.zshrc to apply.",
        )
        .to_string())
    }
}
