# iina-cmd-menu

A **command palette** (⌘K overlay) for the [IINA](https://iina.io) media player on macOS —
think VS Code's command palette, Linear's ⌘K, or Figma's quick actions, but for your video player.

Press **⌘K** to open a fuzzy-search overlay listing every command IINA can run, type a few
(typo-tolerant) characters, hit **Enter**, and it executes — then the palette closes.

---

## Features

- **⌘K to toggle** the palette open/closed (bound via IINA's Menu module, `keyBinding: "Meta+k"`).
- **Fuzzy search** input + results list, auto-focused on open (subsequence matcher, typo/partial tolerant).
- **Keyboard navigation**: ↑/↓ to move, **Enter** to run the highlighted command, **Esc** to close.
  Mouse hover/click works too.
- **Command sources** merged from everything IINA exposes (there is no single "all commands" API):
  1. **mpv commands** — enumerated at runtime via `mpv.getNative("command-list")`.
  2. **IINA-native actions** — PiP, music mode, fullscreen, mute, seek, speed, sidebars, etc. No
     enumeration API exists, so these are a hand-curated static list (see [src/commands.js](src/commands.js))
     mapping a label → its `core.*` call or underlying mpv command.
  3. **Bound key bindings** — `input.getAllKeyBindings()`, keyed by key code, each with its command
     and the shortcut to display.
- **Settings page** (IINA → Preferences → Plugins → Command Menu) with one **search-scope** toggle:
  - **All commands** — merged list from sources 1 + 2, showing the bound shortcut if one exists.
  - **Only commands with a keyboard shortcut** — derived purely from `input.getAllKeyBindings()`.
  - The choice is persisted (`searchScope` preference) and read when the palette builds its list.

### Notes & known limitations

- **`mpv.getNative`, not `getNode`.** The IINA MPV module exposes `getNative<T>(name)`; there is no
  `getNode`. We read `command-list` with `getNative`.
- **mpv commands that require arguments** can't be run bare from the palette (the palette has no
  argument UI). Such commands show their arg signature and, if selected, display an OSD hint to run
  them via a key binding instead. No-argument commands run directly.
- **`input` module type defs are stale.** `input.getAllKeyBindings()` works at runtime in IINA 1.4.x
  but is missing from `iina-plugin-definition@0.0.7`; we ship a supplemental declaration in
  [src/iina-extra.d.ts](src/iina-extra.d.ts) and access `input` defensively so older builds degrade
  gracefully (the "Only bound" scope just returns empty there).
- **Lua-registered bindings.** Key bindings added dynamically at runtime by mpv Lua scripts may not
  appear in `getAllKeyBindings()`. This is an IINA limitation and is not worked around.

---

## Requirements

- **IINA 1.4.0+** (StandaloneWindow + webview messaging; verified on 1.4.3).
- **Node.js** (for the `iina-plugin` CLI and Parcel). Tested with Node 24 / npm 11.

---

## Build & install

The plugin is built with **Parcel** and installed with the official **`iina-plugin` CLI**, which
ships inside the IINA app bundle at `/Applications/IINA.app/Contents/MacOS/iina-plugin` (it is not on
your `PATH` by default — the npm scripts below call it by its full path for you).

```sh
# 1. Install dependencies
npm install

# 2. Build (compiles src/ + ui/ -> dist/, then copies the prefs page)
npm run build

# 3. Symlink into IINA as a development plugin.
#    Creates ~/Library/Application Support/com.colliderli.iina/plugins/iina-cmd-menu.iinaplugin-dev
npm run link

# 4. Restart IINA, then enable the plugin in:
#    IINA → Preferences → Plugins → Command Menu
```

For an iterative loop, run the watcher (rebuilds `dist/` on change):

```sh
npm run dev        # parcel watch
```

To remove the dev symlink:

```sh
npm run unlink
```

### Packaging a release

```sh
npm run pack       # -> iina-cmd-menu.iinaplgz (the installable bundle)
```

Double-click the resulting file (or drop it on IINA) to install for end users.

---

## Usage

1. Open any video (or just launch IINA).
2. Press **⌘K**.
3. Type to filter — e.g. `pip`, `seek`, `mute`, `music`, `fullscreen`.
4. ↑/↓ to highlight, **Enter** to run, **Esc** to dismiss.

Change which commands appear in **IINA → Preferences → Plugins → Command Menu** via the
**Search scope** toggle.

---

## Project structure

```
iina-cmd-menu/
├── Info.json              # bundle manifest (identifier, version, entry, permissions, prefs page + defaults)
├── package.json           # Parcel targets (entry -> dist/, window UI -> dist/ui/window) + scripts
├── .parcelrc              # parcel-optimizer-webview for the webview HTML
├── src/
│   ├── index.js           # MAIN ENTRY: ⌘K menu item, opens window, builds list, runs selected command
│   ├── commands.js        # command-source logic (mpv getNative + curated IINA actions + key bindings)
│   └── iina-extra.d.ts    # supplemental types for the runtime-only `input` module
├── ui/
│   ├── shared.scss        # palette styling (light/dark)
│   ├── pref.html          # Preferences page (search-scope toggle) — copied to dist/pref.html
│   └── window/            # the React command-palette webview
│       ├── index.html
│       ├── index.js       # React 18 createRoot bootstrap
│       ├── app.jsx        # fuzzy input + results list + keyboard nav + iina messaging
│       └── fuzzy.js       # dependency-free fuzzy matcher/ranker
└── dist/                  # build output (referenced by Info.json; git-ignored)
```

### How messaging works

The webview runs in its own JS context and cannot call the IINA API directly. It talks to the entry
script over `postMessage`/`onMessage`:

- Entry → webview: `standaloneWindow.postMessage("commands", { commands, scope })`
- Webview → entry: `iina.postMessage("run", { id })`, `"close"`, and `"ready"`

The entry keeps a `runMap` of `id → () => void` executors (functions can't cross the bridge), so the
webview only ever sends a command **id** back, and the entry runs the matching closure.

---

## License

MIT
