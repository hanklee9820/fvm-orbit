use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Watches the user's FVM cache directory (`~/fvm`) in a background OS thread and emits
/// `fvm://fs-changed` (debounced) so external terminal `fvm` runs automatically refresh the GUI.
pub fn spawn_fvm_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let fvm_dir = std::env::var("FVM_CACHE_PATH")
            .map(PathBuf::from)
            .ok()
            .or_else(|| dirs::home_dir().map(|h| h.join("fvm")));

        let Some(root) = fvm_dir else {
            return;
        };

        // Wait gently if ~/fvm does not exist yet
        if !root.exists() {
            let _ = std::fs::create_dir_all(&root);
        }

        let (tx, rx) = channel::<notify::Result<Event>>();
        let Ok(mut watcher) = RecommendedWatcher::new(tx, Config::default()) else {
            return;
        };

        if watcher.watch(&root, RecursiveMode::NonRecursive).is_err() {
            return;
        }
        let versions_dir = root.join("versions");
        if versions_dir.exists() {
            let _ = watcher.watch(&versions_dir, RecursiveMode::NonRecursive);
        }

        let mut last_emit = Instant::now() - Duration::from_secs(10);
        while let Ok(evt_res) = rx.recv() {
            if evt_res.is_ok() && last_emit.elapsed() >= Duration::from_millis(800) {
                last_emit = Instant::now();
                let _ = app.emit("fvm://fs-changed", ());
            }
        }
    });
}
