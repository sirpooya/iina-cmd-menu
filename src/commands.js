// command-source logic for iina-cmd-menu
//
// The palette mirrors IINA's *menu bar* — the app-level actions a user sees in
// Playback / Video / Audio / Subtitle / Window menus. IINA does not expose its
// menu bar to plugins (menu.items() only returns this plugin's own items), and
// the raw mpv "command-list" is low-level engine plumbing (quit, frame-step…)
// that users don't recognize. So the list below is hand-curated to match what
// IINA itself offers, and each item dispatches via the typed core.* API, an
// IINA script-binding command, or an mpv command behind a friendly label.
//
// Two scopes:
//   "all"   -> the curated IINA menu list below, each annotated with a bound
//              key shortcut if the user has one for the same action.
//   "bound" -> derived purely from the user's key bindings
//              (input.getAllKeyBindings()).
//
// A "command" object handed to the palette has this shape:
//   {
//     id:       string   // stable unique id
//     title:    string   // human label shown in the list
//     subtitle: string   // secondary line (the IINA menu it lives under)
//     shortcut: string   // displayed key combo, or "" if none
//     source:  "iina" | "binding"
//     run:     () => void   // executes the command (entry-side only; not serialized)
//   }

const { mpv, core, console } = iina;

// Dispatch an IINA-native command (the things bound under "iina/..." keys),
// e.g. "iina/open-file", "iina/toggle-pip". These are delivered as a script
// message to IINA itself.
function iinaCmd(name) {
  mpv.command("script-binding", [name]);
}

// ---------------------------------------------------------------------------
// The curated IINA menu-bar mirror.
//
// `category` is the IINA menu the item lives under (shown as the subtitle).
// `action`  is the underlying mpv/iina command string used ONLY to look up a
//           matching bound key shortcut for display — it does not drive `run`.
// `run`     actually performs the action (entry-side).
// ---------------------------------------------------------------------------
const IINA_ACTIONS = [
  // ---- File -------------------------------------------------------------
  {
    title: "Open File…",
    category: "File",
    keywords: "open file load browse",
    action: "iina/open-file",
    run: () => iinaCmd("iina/open-file"),
  },
  {
    title: "Open URL…",
    category: "File",
    keywords: "open url network stream link",
    action: "iina/open-url",
    run: () => iinaCmd("iina/open-url"),
  },
  {
    title: "New Window",
    category: "File",
    keywords: "new window",
    action: "iina/new-window",
    run: () => iinaCmd("iina/new-window"),
  },
  {
    title: "Save Current Playlist…",
    category: "File",
    keywords: "save playlist export",
    action: "iina/save-playlist",
    run: () => iinaCmd("iina/save-playlist"),
  },
  {
    title: "Take Screenshot",
    category: "File",
    keywords: "screenshot capture snap photo image",
    action: "screenshot",
    run: () => mpv.command("screenshot", []),
  },

  // ---- Playback ---------------------------------------------------------
  {
    title: "Toggle Play / Pause",
    category: "Playback",
    keywords: "play pause resume space",
    action: "cycle pause",
    run: () => {
      if (core.status.paused) core.resume();
      else core.pause();
    },
  },
  {
    title: "Stop Playback",
    category: "Playback",
    keywords: "stop halt end",
    action: "stop",
    run: () => core.stop(),
  },
  {
    title: "Step Forward One Frame",
    category: "Playback",
    keywords: "frame step forward next advance",
    action: "frame-step",
    run: () => mpv.command("frame-step", []),
  },
  {
    title: "Step Backward One Frame",
    category: "Playback",
    keywords: "frame step backward previous back",
    action: "frame-back-step",
    run: () => mpv.command("frame-back-step", []),
  },
  {
    title: "Seek Forward 10s",
    category: "Playback",
    keywords: "seek forward skip ahead 10 jump",
    action: "seek 10",
    run: () => core.seek(10, false),
  },
  {
    title: "Seek Backward 10s",
    category: "Playback",
    keywords: "seek backward rewind back 10 jump",
    action: "seek -10",
    run: () => core.seek(-10, false),
  },
  {
    title: "Next in Playlist",
    category: "Playback",
    keywords: "next playlist skip track",
    action: "playlist-next",
    run: () => mpv.command("playlist-next", []),
  },
  {
    title: "Previous in Playlist",
    category: "Playback",
    keywords: "previous playlist back track",
    action: "playlist-prev",
    run: () => mpv.command("playlist-prev", []),
  },
  {
    title: "Speed Up (1.25×)",
    category: "Playback",
    keywords: "speed faster rate quicker",
    action: "multiply speed 1.25",
    run: () => core.setSpeed(core.status.speed * 1.25),
  },
  {
    title: "Slow Down (0.8×)",
    category: "Playback",
    keywords: "speed slower rate",
    action: "multiply speed 0.8",
    run: () => core.setSpeed(core.status.speed * 0.8),
  },
  {
    title: "Reset Speed (1×)",
    category: "Playback",
    keywords: "speed normal reset rate default",
    action: "set speed 1",
    run: () => core.setSpeed(1),
  },
  {
    title: "Show Playlist Panel",
    category: "Playback",
    keywords: "playlist sidebar queue panel list",
    action: "iina/toggle-playlist-panel",
    run: () => {
      core.window.sidebar = "playlist";
    },
  },
  {
    title: "Show Chapters Panel",
    category: "Playback",
    keywords: "chapters sidebar panel",
    action: "iina/toggle-chapters-panel",
    run: () => {
      core.window.sidebar = "chapters";
    },
  },

  // ---- Video ------------------------------------------------------------
  {
    title: "Toggle Fullscreen",
    category: "Video",
    keywords: "fullscreen full screen maximize",
    action: "cycle fullscreen",
    run: () => {
      core.window.fullscreen = !core.window.fullscreen;
    },
  },
  {
    title: "Toggle Picture-in-Picture",
    category: "Video",
    keywords: "pip picture in picture float overlay",
    action: "iina/toggle-pip",
    run: () => {
      core.window.pip = !core.window.pip;
    },
  },
  {
    title: "Enter Music Mode (Mini Player)",
    category: "Video",
    keywords: "music mode mini player audio only compact",
    action: "iina/music-mode",
    run: () => mpv.command("script-message-to", ["iina", "music-mode"]),
  },
  {
    title: "Rotate Video 90°",
    category: "Video",
    keywords: "rotate turn orientation 90 clockwise",
    action: "cycle-values video-rotate 90 180 270 0",
    run: () => mpv.command("cycle-values", ["video-rotate", "90", "180", "270", "0"]),
  },
  {
    title: "Aspect Ratio: 16:9",
    category: "Video",
    keywords: "aspect ratio widescreen 16 9",
    action: "set video-aspect-override 16:9",
    run: () => mpv.set("video-aspect-override", "16:9"),
  },
  {
    title: "Aspect Ratio: 4:3",
    category: "Video",
    keywords: "aspect ratio fullscreen classic 4 3",
    action: "set video-aspect-override 4:3",
    run: () => mpv.set("video-aspect-override", "4:3"),
  },
  {
    title: "Aspect Ratio: Default",
    category: "Video",
    keywords: "aspect ratio default reset original",
    action: "set video-aspect-override -1",
    run: () => mpv.set("video-aspect-override", "-1"),
  },
  {
    title: "Flip Vertically",
    category: "Video",
    keywords: "flip vertical mirror upside down vflip",
    action: "vf toggle vflip",
    run: () => mpv.command("vf", ["toggle", "vflip"]),
  },
  {
    title: "Flip Horizontally",
    category: "Video",
    keywords: "flip horizontal mirror hflip",
    action: "vf toggle hflip",
    run: () => mpv.command("vf", ["toggle", "hflip"]),
  },

  // ---- Audio ------------------------------------------------------------
  {
    title: "Toggle Mute",
    category: "Audio",
    keywords: "mute unmute silence volume",
    action: "cycle mute",
    run: () => {
      core.audio.muted = !core.audio.muted;
    },
  },
  {
    title: "Volume Up",
    category: "Audio",
    keywords: "volume louder up increase",
    action: "add volume 5",
    run: () => {
      core.audio.volume = Math.min(core.audio.volume + 5, 130);
    },
  },
  {
    title: "Volume Down",
    category: "Audio",
    keywords: "volume quieter down decrease lower",
    action: "add volume -5",
    run: () => {
      core.audio.volume = Math.max(core.audio.volume - 5, 0);
    },
  },
  {
    title: "Audio Delay +0.1s",
    category: "Audio",
    keywords: "audio delay sync offset later",
    action: "add audio-delay 0.1",
    run: () => {
      core.audio.delay = core.audio.delay + 0.1;
    },
  },
  {
    title: "Audio Delay −0.1s",
    category: "Audio",
    keywords: "audio delay sync offset earlier",
    action: "add audio-delay -0.1",
    run: () => {
      core.audio.delay = core.audio.delay - 0.1;
    },
  },
  {
    title: "Reset Audio Delay",
    category: "Audio",
    keywords: "audio delay sync reset zero",
    action: "set audio-delay 0",
    run: () => {
      core.audio.delay = 0;
    },
  },
  {
    title: "Cycle Audio Track",
    category: "Audio",
    keywords: "audio track language switch next",
    action: "cycle audio",
    run: () => mpv.command("cycle", ["audio"]),
  },

  // ---- Subtitle ---------------------------------------------------------
  {
    title: "Toggle Subtitles",
    category: "Subtitle",
    keywords: "subtitle captions toggle show hide visibility",
    action: "cycle sub-visibility",
    run: () => mpv.command("cycle", ["sub-visibility"]),
  },
  {
    title: "Cycle Subtitle Track",
    category: "Subtitle",
    keywords: "subtitle track language switch next",
    action: "cycle sub",
    run: () => mpv.command("cycle", ["sub"]),
  },
  {
    title: "Load External Subtitle…",
    category: "Subtitle",
    keywords: "subtitle load external file srt add",
    action: "iina/open-sub",
    run: () => iinaCmd("iina/open-sub"),
  },
  {
    title: "Subtitle Delay +0.1s",
    category: "Subtitle",
    keywords: "subtitle delay sync offset later",
    action: "add sub-delay 0.1",
    run: () => {
      core.subtitle.delay = core.subtitle.delay + 0.1;
    },
  },
  {
    title: "Subtitle Delay −0.1s",
    category: "Subtitle",
    keywords: "subtitle delay sync offset earlier",
    action: "add sub-delay -0.1",
    run: () => {
      core.subtitle.delay = core.subtitle.delay - 0.1;
    },
  },
  {
    title: "Reset Subtitle Delay",
    category: "Subtitle",
    keywords: "subtitle delay sync reset zero",
    action: "set sub-delay 0",
    run: () => {
      core.subtitle.delay = 0;
    },
  },

  // ---- Window -----------------------------------------------------------
  {
    title: "Toggle Always On Top",
    category: "Window",
    keywords: "ontop on top float pin above",
    action: "cycle ontop",
    run: () => {
      core.window.ontop = !core.window.ontop;
    },
  },
  {
    title: "Hide Sidebar",
    category: "Window",
    keywords: "hide sidebar close panel",
    action: "iina/hide-sidebar",
    run: () => {
      core.window.sidebar = null;
    },
  },
];

// ---------------------------------------------------------------------------
// Bound key bindings (used both for the "bound" scope and to annotate the
// curated list with shortcuts).
// input.getAllKeyBindings() -> Record<keyCode, { key, action, isIINACommand, comment }>
// Missing in older type defs but present at runtime in IINA 1.4.x; guarded.
// ---------------------------------------------------------------------------
function getKeyBindings() {
  if (typeof input === "undefined" || !input.getAllKeyBindings) {
    console.warn("input.getAllKeyBindings() unavailable; skipping bound commands.");
    return [];
  }
  let bindings;
  try {
    bindings = input.getAllKeyBindings();
  } catch (e) {
    console.error("Failed to read key bindings: " + e);
    return [];
  }
  return Object.keys(bindings || {}).map((code) => {
    const b = bindings[code] || {};
    const keyLabel = b.key || code;
    return {
      key: keyLabel,
      action: b.action || "",
      comment: b.comment || "",
      isIINACommand: !!b.isIINACommand,
    };
  });
}

/**
 * Normalize a command/action string for shortcut matching: lowercase, collapse
 * runs of whitespace, and drop a leading "iina/" prefix. This lets a curated
 * action ("cycle pause", "iina/music-mode") match a key binding's stored action
 * string regardless of minor formatting/prefix differences.
 */
function normalizeAction(action) {
  if (!action) return "";
  return String(action)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^iina\//, "");
}

/** Normalize an mpv key code into a tidy display string, e.g. "Meta+k" -> "⌘K". */
function prettyKey(key) {
  if (!key) return "";
  return key
    .replace(/Meta\+/gi, "⌘")
    .replace(/Cmd\+/gi, "⌘")
    .replace(/Ctrl\+/gi, "⌃")
    .replace(/Alt\+/gi, "⌥")
    .replace(/Shift\+/gi, "⇧")
    .replace(/\bUP\b/g, "↑")
    .replace(/\bDOWN\b/g, "↓")
    .replace(/\bLEFT\b/g, "←")
    .replace(/\bRIGHT\b/g, "→")
    .replace(/\bSPACE\b/gi, "Space");
}

/**
 * Build the command list to send to the palette webview.
 *
 * @param {"all"|"bound"} scope
 *   "all"   = the curated IINA menu-bar mirror, annotated with any matching
 *             bound shortcut.
 *   "bound" = derived purely from key bindings.
 * @returns {{ commands: object[], runMap: Object<string, () => void> }}
 *   `commands` is JSON-serializable (no functions) for postMessage;
 *   `runMap` maps id -> executor, kept entry-side only.
 */
function buildCommandList(scope) {
  const commands = [];
  const runMap = {};

  // Index bound shortcuts by their normalized action string so we can show
  // them next to the matching curated item.
  const bindings = getKeyBindings();
  const shortcutByAction = {};
  for (const b of bindings) {
    if (!b.action) continue;
    const k = normalizeAction(b.action);
    if (k && !shortcutByAction[k]) {
      shortcutByAction[k] = prettyKey(b.key);
    }
  }

  if (scope === "bound") {
    // Source: the user's key bindings only.
    bindings.forEach((b, i) => {
      if (!b.action) return;
      const id = `binding:${i}`;
      const label = b.comment || b.action;
      commands.push({
        id,
        title: label,
        subtitle: b.isIINACommand ? `iina: ${b.action}` : `mpv: ${b.action}`,
        shortcut: prettyKey(b.key),
        source: "binding",
      });
      runMap[id] = () => runRawCommand(b.action, b.isIINACommand);
    });
  } else {
    // The curated IINA menu-bar mirror, annotated with bound shortcuts.
    IINA_ACTIONS.forEach((a, i) => {
      const id = `iina:${i}`;
      commands.push({
        id,
        title: a.title,
        subtitle: a.category,
        shortcut: a.action ? shortcutByAction[normalizeAction(a.action)] || "" : "",
        source: "iina",
      });
      runMap[id] = a.run;
    });
  }

  return { commands, runMap };
}

/** Execute a raw command string from a key binding (e.g. "cycle pause", "seek 10"). */
function runRawCommand(action, isIINACommand) {
  // input bindings store the command as a single string; mpv.command wants
  // (name, args[]). Split on whitespace for a best-effort parse.
  const parts = action.trim().split(/\s+/);
  const name = parts[0];
  const args = parts.slice(1);
  try {
    if (isIINACommand) {
      // IINA commands are dispatched as script-message-to iina.
      mpv.command("script-message-to", ["iina", name, ...args]);
    } else {
      mpv.command(name, args);
    }
  } catch (e) {
    console.error(`Binding command failed (${action}): ${e}`);
    core.osd(`Command failed: ${action}`);
  }
}

module.exports = { buildCommandList };
