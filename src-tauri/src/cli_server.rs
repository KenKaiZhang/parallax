use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

const SOCKET_NAME: &str = "parallax.sock";
const EVENT: &str = "parallax://cli";

const ALLOWED_CMDS: &[&str] = &[
    "notes.append",
    "notes.set",
    "group.rename",
    "group.new",
    "group.activate",
    "pane.split",
    "pane.focus",
    "pane.close",
    "pane.send",
];

#[derive(Deserialize, Serialize, Clone)]
pub struct CliMessage {
    pub cmd: String,
    pub group: String,
    #[serde(default)]
    pub pane: String,
    #[serde(default)]
    pub args: serde_json::Value,
}

pub fn socket_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(SOCKET_NAME))
}

/// Install a symlink to the CLI binary at ~/.local/bin/px so that shells which
/// reset PATH (notably Claude Code's shell snapshot) can still find it.
/// ~/.local/bin is on most users' PATH; if not, this is a no-op.
pub fn install_symlink() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let bin_dir = exe.parent().ok_or_else(|| "could not find binary dir".to_string())?;
    let cli_bin = bin_dir.join("px");
    if !cli_bin.exists() {
        return Err(format!("px not found at {}", cli_bin.display()));
    }
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let target_dir = PathBuf::from(home).join(".local").join("bin");
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    let link = target_dir.join("px");
    let _ = fs::remove_file(&link);
    std::os::unix::fs::symlink(&cli_bin, &link).map_err(|e| e.to_string())?;
    // Clean up the previous-name symlink if present (one-time migration).
    let _ = fs::remove_file(target_dir.join("parallax-cli"));
    Ok(link)
}

pub fn start(app: AppHandle) -> Result<(), String> {
    let path = socket_path(&app)?;
    // Remove stale socket from a prior run / crash.
    let _ = fs::remove_file(&path);

    let listener = UnixListener::bind(&path)
        .map_err(|e| format!("failed to bind UDS at {}: {}", path.display(), e))?;

    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            let app_handle = app.clone();
            thread::spawn(move || {
                if let Err(e) = handle_connection(stream, &app_handle) {
                    eprintln!("parallax cli_server: {}", e);
                }
            });
        }
    });
    Ok(())
}

fn handle_connection(mut stream: UnixStream, app: &AppHandle) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    let line = line.trim_end();
    if line.is_empty() {
        return write_response(&mut stream, false, Some("empty request"));
    }
    let msg: CliMessage = match serde_json::from_str(line) {
        Ok(m) => m,
        Err(e) => {
            return write_response(&mut stream, false, Some(&format!("invalid json: {}", e)));
        }
    };
    if !ALLOWED_CMDS.contains(&msg.cmd.as_str()) {
        return write_response(
            &mut stream,
            false,
            Some(&format!("unknown command: {}", msg.cmd)),
        );
    }
    if msg.group.is_empty() {
        return write_response(&mut stream, false, Some("group is required"));
    }
    if let Err(e) = app.emit(EVENT, &msg) {
        return write_response(&mut stream, false, Some(&format!("emit failed: {}", e)));
    }
    write_response(&mut stream, true, None)
}

fn write_response(stream: &mut UnixStream, ok: bool, error: Option<&str>) -> std::io::Result<()> {
    let body = if ok {
        serde_json::json!({ "ok": true }).to_string()
    } else {
        serde_json::json!({ "ok": false, "error": error.unwrap_or("error") }).to_string()
    };
    stream.write_all(body.as_bytes())?;
    stream.write_all(b"\n")?;
    stream.flush()?;
    Ok(())
}
