mod cli_server;
mod pty;
mod storage;

use pty::PtyRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(PtyRegistry::default())
        .invoke_handler(tauri::generate_handler![
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            storage::state_load,
            storage::state_save,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            cli_server::start(handle)
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            if let Err(e) = cli_server::install_symlink() {
                eprintln!("parallax: cli symlink install failed: {}", e);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
