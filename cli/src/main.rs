use std::io::{Read, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;
use std::process;

use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};

const APP_DIR: &str = "com.kenzhang.parallax";
const STATE_FILE: &str = "state.json";

#[derive(Parser)]
#[command(name = "px")]
#[command(about = "Talk to the parallax app from inside a pane")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Print info about the current group / pane
    Context,
    /// Read or modify notes for the current group
    Notes {
        #[command(subcommand)]
        action: Option<NotesAction>,
    },
    /// Group commands
    Group {
        #[command(subcommand)]
        action: GroupAction,
    },
    /// Pane commands (operate on the focused pane in the current group)
    Pane {
        #[command(subcommand)]
        action: PaneAction,
    },
}

#[derive(Subcommand)]
enum NotesAction {
    /// Print current notes (default if no subcommand)
    Show,
    /// Append text to the current group's notes (newline-separated)
    Append {
        #[arg(trailing_var_arg = true, required = true)]
        text: Vec<String>,
    },
    /// Replace the current group's notes
    Set {
        #[arg(trailing_var_arg = true, required = true)]
        text: Vec<String>,
    },
    /// Empty the current group's notes
    Clear,
}

#[derive(Subcommand)]
enum GroupAction {
    /// List all groups (id prefix · name · active marker)
    List,
    /// Rename the current group
    Rename { name: String },
    /// Create a new group (does NOT switch the active pane to it)
    New { name: String },
    /// Switch the active group by name or id
    Activate { reference: String },
}

#[derive(Subcommand)]
enum PaneAction {
    /// Split the focused pane. h = side-by-side, v = stacked
    Split {
        #[arg(value_parser = ["h", "v"])]
        dir: String,
    },
    /// Move focus to the next or previous pane in the group
    Focus {
        #[arg(value_parser = ["next", "prev"])]
        direction: String,
    },
    /// Close the focused pane
    Close,
    /// Send text to the focused pane (no newline unless --enter is passed)
    Send {
        /// Append a carriage return after the text (i.e. "press Enter")
        #[arg(short, long)]
        enter: bool,
        #[arg(trailing_var_arg = true, required = true)]
        text: Vec<String>,
    },
}

#[derive(Deserialize)]
struct GroupView {
    id: String,
    name: String,
    notes: String,
}

#[derive(Deserialize)]
struct StateView {
    groups: Vec<GroupView>,
    #[serde(rename = "activeGroupId")]
    active_group_id: Option<String>,
}

#[derive(Serialize)]
struct Request<'a> {
    cmd: &'a str,
    group: String,
    pane: String,
    args: serde_json::Value,
}

#[derive(Deserialize)]
struct Response {
    ok: bool,
    error: Option<String>,
}

fn state_path() -> PathBuf {
    dirs::data_dir()
        .expect("could not locate user data directory")
        .join(APP_DIR)
        .join(STATE_FILE)
}

fn load_state() -> Result<StateView, String> {
    let path = state_path();
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("could not read {}: {}", path.display(), e))?;
    serde_json::from_str(&raw).map_err(|e| format!("invalid state.json: {}", e))
}

fn env_required(key: &str) -> Result<String, String> {
    std::env::var(key).map_err(|_| {
        format!(
            "{} not set; are you inside a parallax pane?",
            key
        )
    })
}

fn send(cmd: &str, args: serde_json::Value) -> Result<(), String> {
    let group = env_required("PARALLAX_GROUP")?;
    let pane = std::env::var("PARALLAX_PANE").unwrap_or_default();
    let sock = env_required("PARALLAX_SOCK")?;
    let req = Request { cmd, group, pane, args };
    let line = serde_json::to_string(&req).map_err(|e| e.to_string())?;
    let mut stream = UnixStream::connect(&sock)
        .map_err(|_| "parallax app is not running".to_string())?;
    stream.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    stream.write_all(b"\n").map_err(|e| e.to_string())?;
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|e| e.to_string())?;
    let parsed: Response = serde_json::from_str(response.trim_end())
        .map_err(|e| format!("invalid response from app: {}", e))?;
    if parsed.ok {
        Ok(())
    } else {
        Err(parsed.error.unwrap_or_else(|| "command failed".into()))
    }
}

fn current_group<'a>(state: &'a StateView, group_id: &str) -> Option<&'a GroupView> {
    state.groups.iter().find(|g| g.id == group_id)
}

fn cmd_context() -> Result<(), String> {
    let group_id = env_required("PARALLAX_GROUP")?;
    let pane = std::env::var("PARALLAX_PANE").unwrap_or_else(|_| "?".into());
    let state = load_state()?;
    let name = current_group(&state, &group_id)
        .map(|g| g.name.as_str())
        .unwrap_or("(unknown)");
    println!("group: {}  ({})", name, group_id);
    println!("pane:  {}", pane);
    Ok(())
}

fn cmd_notes_show() -> Result<(), String> {
    let group_id = env_required("PARALLAX_GROUP")?;
    let state = load_state()?;
    let group = current_group(&state, &group_id)
        .ok_or_else(|| "current group not found in state.json".to_string())?;
    if group.notes.is_empty() {
        return Ok(());
    }
    print!("{}", group.notes);
    if !group.notes.ends_with('\n') {
        println!();
    }
    Ok(())
}

fn cmd_notes_append(text: &[String]) -> Result<(), String> {
    let joined = text.join(" ");
    send("notes.append", serde_json::json!({ "text": joined }))
}

fn cmd_notes_set(text: &[String]) -> Result<(), String> {
    let joined = text.join(" ");
    send("notes.set", serde_json::json!({ "text": joined }))
}

fn cmd_notes_clear() -> Result<(), String> {
    send("notes.set", serde_json::json!({ "text": "" }))
}

fn cmd_group_list() -> Result<(), String> {
    let state = load_state()?;
    let active = state.active_group_id.as_deref();
    for g in &state.groups {
        let marker = if Some(g.id.as_str()) == active { "*" } else { " " };
        let prefix = g.id.get(..8).unwrap_or(&g.id);
        println!("{} {}  {}", marker, prefix, g.name);
    }
    Ok(())
}

fn cmd_group_rename(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("name cannot be empty".into());
    }
    send("group.rename", serde_json::json!({ "name": name }))
}

fn cmd_group_new(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("name cannot be empty".into());
    }
    send("group.new", serde_json::json!({ "name": name }))
}

fn cmd_group_activate(reference: &str) -> Result<(), String> {
    let state = load_state()?;
    let lower = reference.to_lowercase();
    let by_id = state.groups.iter().find(|g| g.id == reference);
    let resolved_id: String = if let Some(g) = by_id {
        g.id.clone()
    } else {
        let by_name: Vec<&GroupView> = state
            .groups
            .iter()
            .filter(|g| g.name.to_lowercase() == lower)
            .collect();
        match by_name.len() {
            0 => return Err(format!("no group matched '{}'", reference)),
            1 => by_name[0].id.clone(),
            _ => {
                return Err(format!(
                    "'{}' matches multiple groups; use the id (see `px group list`)",
                    reference
                ))
            }
        }
    };
    send("group.activate", serde_json::json!({ "id": resolved_id }))
}

fn cmd_pane_split(dir: &str) -> Result<(), String> {
    send("pane.split", serde_json::json!({ "dir": dir }))
}

fn cmd_pane_focus(direction: &str) -> Result<(), String> {
    send("pane.focus", serde_json::json!({ "direction": direction }))
}

fn cmd_pane_close() -> Result<(), String> {
    send("pane.close", serde_json::json!({}))
}

fn cmd_pane_send(text: &[String], enter: bool) -> Result<(), String> {
    let joined = text.join(" ");
    send(
        "pane.send",
        serde_json::json!({ "text": joined, "enter": enter }),
    )
}

fn run() -> Result<(), String> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Context => cmd_context(),
        Commands::Notes { action } => match action.unwrap_or(NotesAction::Show) {
            NotesAction::Show => cmd_notes_show(),
            NotesAction::Append { text } => cmd_notes_append(&text),
            NotesAction::Set { text } => cmd_notes_set(&text),
            NotesAction::Clear => cmd_notes_clear(),
        },
        Commands::Group { action } => match action {
            GroupAction::List => cmd_group_list(),
            GroupAction::Rename { name } => cmd_group_rename(&name),
            GroupAction::New { name } => cmd_group_new(&name),
            GroupAction::Activate { reference } => cmd_group_activate(&reference),
        },
        Commands::Pane { action } => match action {
            PaneAction::Split { dir } => cmd_pane_split(&dir),
            PaneAction::Focus { direction } => cmd_pane_focus(&direction),
            PaneAction::Close => cmd_pane_close(),
            PaneAction::Send { enter, text } => cmd_pane_send(&text, enter),
        },
    }
}

fn main() {
    if let Err(e) = run() {
        eprintln!("px: {}", e);
        process::exit(1);
    }
}
