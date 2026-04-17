# parallax

A terminal workspace organizer. One window, a sidebar of named **groups**, freeform pane splits inside each group, and a notes pad pinned under the sidebar. Built so processes inside any pane (including Claude Code) can talk back to the app via a small `px` CLI.

> macOS only. Tested on Apple Silicon.

## Requirements

- **Rust** 1.85 or newer (`rustup update stable`)
- **Node.js** 20.x (20.19+ recommended) and npm 10+
- **Xcode Command Line Tools** (`xcode-select --install`)
- `~/.local/bin` on your `PATH` (so the `px` CLI is reachable from your shells; most setups already have this)

## Install & run (dev)

```sh
git clone git@github.com:KenKaiZhang/parallax.git
cd parallax
npm install
cargo build              # builds both the GUI and the px CLI binary
npm run tauri dev        # launches the app
```

First build will take a few minutes (transitive Rust deps). Subsequent runs are fast.

When the app starts, it symlinks the `px` binary into `~/.local/bin/px` so any shell — including Claude Code's — can find it.

## Build a standalone .app

```sh
npm run tauri build
```

The `.app` lands in `src-tauri/target/release/bundle/macos/parallax.app`. Drag it to `/Applications`. Note: the release build currently does **not** bundle `px` as a sidecar — for daily use, keep the dev workflow (`npm run tauri dev`) until that's wired up.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘D` | Split focused pane right |
| `⇧⌘D` | Split focused pane down |
| `⌘W` | Close focused pane |
| `⌘T` | New group |
| `⌘[` / `⌘]` | Previous / next group |
| `⇧⌘[` / `⇧⌘]` | Previous / next pane in current group |
| `⌘B` | Toggle sidebar |

Sidebar group items: double-click to rename, right-click (or trash icon) to delete with confirmation.

## The `px` CLI

Every shell spawned inside a pane has these env vars set: `PARALLAX_SOCK`, `PARALLAX_GROUP`, `PARALLAX_PANE`. The `px` binary uses them to read/mutate the host app's state.

```sh
px context                          # print current group + pane
px notes                            # print active group's notes
px notes append "fixed nav bug"     # append a line
px notes set "rewriting from scratch"
px notes clear
px group list
px group rename "auth-refactor"
px group new "throwaway-experiment"  # creates a group, doesn't switch to it
```

### Use with Claude Code

Open `claude` in a pane, then:

> "There's a CLI on your PATH called `px` — run `px --help` and use the `notes` commands to log a one-line summary of what we work on."

Claude will discover the commands and write into the active group's notes textarea, so when you switch back days later the context is already there.

## Project structure

```
parallax/
├── Cargo.toml          # workspace
├── cli/                # px binary (clap, UDS client)
├── src-tauri/          # GUI: Tauri app, PTY mgmt, UDS server, persistence
└── src/                # frontend: React + xterm.js + Zustand
```

## Tech stack

- **Tauri 2** (Rust backend, web frontend) — small binary, native macOS feel
- **React 19 + TypeScript + Vite**
- **xterm.js** for terminal rendering
- **portable-pty** for spawning shells
- **Zustand** for state
- **Unix domain socket** for the `px` ↔ app channel

## State location

Group/notes/layout state is persisted to:

```
~/Library/Application Support/com.kenzhang.parallax/state.json
```

The UDS the CLI talks to lives next to it as `parallax.sock`.
