mod cli_server;
mod pty;
mod storage;

use pty::PtyRegistry;
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::Emitter;

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
            pty::pty_has_foreground_process,
            storage::state_load,
            storage::state_save,
        ])
        .setup(|app| {
            // Install our own app menu so Cmd+, opens Settings (the default
            // macOS app menu has no Preferences item, but WKWebView still
            // swallows the shortcut). Routing through a real menu accelerator
            // is the most reliable way to claim Cmd+, in a Tauri webview.
            let preferences = MenuItem::with_id(
                app,
                "preferences",
                "Settings…",
                true,
                Some("CmdOrCtrl+,"),
            )?;

            let app_submenu = SubmenuBuilder::new(app, "parallax")
                .about(None)
                .separator()
                .item(&preferences)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .fullscreen()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_submenu, &edit_submenu, &window_submenu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id() == "preferences" {
                    let _ = app_handle.emit("parallax://open-settings", ());
                }
            });

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
