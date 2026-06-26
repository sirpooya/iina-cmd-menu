# iina-cmd-menu

A **command palette** (⌘K overlay) for the [IINA](https://iina.io) media player on macOS —
think VS Code's command palette, Linear's ⌘K, or Figma's quick actions, but for your video player.

Press **⌘K** to open a fuzzy-search overlay listing every command IINA can run, type a few
(typo-tolerant) characters, hit **Enter**, and it executes — then the palette closes.

> Status: 🚧 in development. This README is the spec; the bundle is being scaffolded with the
> `iina-plugin` CLI (React webview template).

---

## Features

- **⌘K to toggle** the palette open/closed (bound via IINA's Menu module).
- **Fuzzy search** input + results list, auto-focused on open.
- **Keyboard navigation**: ↑/↓ to move, **Enter** to run the highlighted command, **Esc** to close.
- **Command sources** merged from everything IINA exposes (there is no single "all commands" API):
  1. **mpv commands** — enumerated at runtime via `mpv.getNode("command-list")`.
  2. **IINA-native actions** — PiP, music mode, etc. that aren't mpv commands. No enumeration API
     exists, so these are a hand-curated static list mapping a label → its `core.*` call (or mpv command).
  3. **Bound key bindings** — `input.getAllKeyBindings()`, keyed by key code, each with its command
     and the shortcut to display.
- **Settings page** (in IINA → Preferences) with one toggle for the **search scope**:
  - **All commands** — merged list from sources 1 + 2, showing the bound shortcut if one exists.
  - **Only commands with a keyboard shortcut** — derived purely from `input.getAllKeyBindings()`.
  - The choice is persisted and read when the palette builds its command list.

### Known limitation

Key bindings added dynamically at runtime by mpv Lua scripts may not appear in
`getAllKeyBindings()`. This is an IINA limitation and is not worked around.

---

## Requirements

- **IINA 1.4.0+** (plugin system with StandaloneWindow + webview messaging).
- **Node.js** (for the `iina-plugin` CLI and the bundler).

---

## Build & install

This plugin is scaffolded and built with the official **`iina-plugin` CLI**, which ships inside the
IINA app bundle.

```sh
# 1. Put the CLI on your PATH (it lives inside IINA.app)
export PATH="$PATH:/Applications/IINA.app/Contents/MacOS"
#   …or call it directly as /Applications/IINA.app/Contents/MacOS/iina-plugin

# 2. Install dependencies
npm install

# 3. Build the plugin (compiles src/ -> dist/)
npm run build      # parcel build for the entry script + React UI

# 4. Symlink into IINA for live development.
#    Creates ~/Library/Application Support/IINA/Plugins/<id>.iinaplugin-dev
iina-plugin link .

# 5. (Re)launch IINA. Enable the plugin in:
#    IINA → Preferences → Plugins → iina-cmd-menu
```

For an iterative dev loop, run the watcher and IINA will pick up rebuilds:

```sh
npm run dev        # parcel watch
```

### Packaging a release

```sh
iina-plugin pack .    # produces iina-cmd-menu.iinaplugin
```

Double-click the `.iinaplugin` file (or drop it on IINA) to install.

---

## Usage

1. Open any video (or just launch IINA).
2. Press **⌘K**.
3. Type to filter — e.g. `pip`, `seek`, `mute`, `music`.
4. ↑/↓ to highlight, **Enter** to run, **Esc** to dismiss.

To change which commands appear, open **IINA → Preferences → Plugins → iina-cmd-menu** and flip the
**Search scope** toggle.

---

## Project structure

```
iina-cmd-menu/
├── Info.json              # bundle manifest (identifier, version, entry, permissions, prefs)
├── src/
│   ├── index.ts           # main entry: menu/keybinding, builds command list, runs commands
│   ├── commands.ts        # command-source logic (mpv list + curated IINA actions + bindings)
│   ├── prefs.html         # Preferences settings page (search-scope toggle)
│   └── ui/                # React webview for the palette
│       ├── index.html
│       └── index.tsx      # fuzzy search input + results list + keyboard nav
├── dist/                  # bundled output (referenced by Info.json)
├── package.json
└── README.md
```

---

## License

MIT
