use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use dashmap::DashMap;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

pub struct PtyEntry {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn portable_pty::Child + Send + Sync>>,
}

#[derive(Default)]
pub struct PtyRegistry {
    inner: DashMap<String, PtyEntry>,
}

#[derive(Debug, Deserialize)]
pub struct SpawnOptions {
    pub cwd: Option<String>,
    pub cols: u16,
    pub rows: u16,
    #[serde(default, rename = "groupId")]
    pub group_id: String,
    #[serde(default, rename = "paneId")]
    pub pane_id: String,
}

#[derive(Debug, Serialize)]
pub struct SpawnResult {
    pub id: String,
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    registry: State<'_, PtyRegistry>,
    opts: SpawnOptions,
) -> Result<SpawnResult, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: opts.rows.max(1),
            cols: opts.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.args(["-l"]);
    if let Some(cwd) = opts.cwd.as_ref().filter(|s| !s.is_empty()) {
        cmd.cwd(cwd);
    } else if let Some(home) = std::env::var_os("HOME") {
        cmd.cwd(home);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Hooks for the parallax-cli binary running inside this shell.
    if let Ok(sock) = crate::cli_server::socket_path(&app) {
        cmd.env("PARALLAX_SOCK", sock);
    }
    if !opts.group_id.is_empty() {
        cmd.env("PARALLAX_GROUP", &opts.group_id);
    }
    if !opts.pane_id.is_empty() {
        cmd.env("PARALLAX_PANE", &opts.pane_id);
    }
    // Make `parallax-cli` discoverable: prepend the directory of the GUI binary
    // (target/debug in dev, .app/Contents/MacOS in release) to PATH.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let existing = std::env::var("PATH").unwrap_or_default();
            cmd.env("PATH", format!("{}:{}", dir.display(), existing));
        }
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let data_event = format!("pty://{}/data", id);
    let exit_event = format!("pty://{}/exit", id);

    let app_for_thread = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = B64.encode(&buf[..n]);
                    if app_for_thread.emit(&data_event, encoded).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = app_for_thread.emit(&exit_event, ());
    });

    registry.inner.insert(
        id.clone(),
        PtyEntry {
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
        },
    );

    Ok(SpawnResult { id })
}

#[tauri::command]
pub fn pty_write(
    registry: State<'_, PtyRegistry>,
    id: String,
    data: String,
) -> Result<(), String> {
    let entry = registry.inner.get(&id).ok_or_else(|| "pty not found".to_string())?;
    let mut writer = entry.writer.lock().map_err(|e| e.to_string())?;
    writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    registry: State<'_, PtyRegistry>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let entry = registry.inner.get(&id).ok_or_else(|| "pty not found".to_string())?;
    let master = entry.master.lock().map_err(|e| e.to_string())?;
    master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(registry: State<'_, PtyRegistry>, id: String) -> Result<(), String> {
    if let Some((_, entry)) = registry.inner.remove(&id) {
        if let Ok(mut child) = entry.child.lock() {
            let _ = child.kill();
        }
    }
    Ok(())
}
