// command-source logic for iina-cmd-menu
//
// There is no single "all commands" API in IINA, so we combine three sources:
//   1. mpv commands  -> mpv.getNative("command-list")
//   2. IINA-native actions (PiP, music mode, ...) -> hand-curated static list
//   3. Bound key bindings -> input.getAllKeyBindings()
//
// A "command" object handed to the palette has this shape:
//   {
//     id:      string   // stable unique id
//     title:   string   // human label shown in the list
//     subtitle:string   // secondary line (the underlying command / category)
//     shortcut:string   // displayed key combo, or "" if none
//     source: "mpv" | "iina" | "binding"
//     run:    () => void   // executes the command (entry-side only; not serialized)
//   }

const { mpv, core, console } = iina;

// ---------------------------------------------------------------------------
// Source 2: hand-curated IINA-native actions.
// These either aren't mpv commands, or are nicer to express via core.* /
// a specific mpv command. `run` executes entry-side.
// ---------------------------------------------------------------------------
const IINA_ACTIONS = [
  {
    title: "Toggle Play / Pause",
    keywords: "play pause resume space",
    run: () => {
      if (core.status.paused) core.resume();
      else core.pause();
    },
  },
  {
    title: "Stop Playback",
    keywords: "stop halt",
    run: () => core.stop(),
  },
  {
    title: "Toggle Picture-in-Picture",
    keywords: "pip picture in picture float",
    run: () => {
      core.window.pip = !core.window.pip;
    },
  },
  {
    title: "Enter Music Mode (Mini Player)",
    keywords: "music mode mini player audio only",
    // Music mode has no core.* property in the API; it's an IINA input command.
    run: () => mpv.command("script-message-to", ["iina", "music-mode"]),
  },
  {
    title: "Toggle Fullscreen",
    keywords: "fullscreen full screen maximize",
    run: () => {
      core.window.fullscreen = !core.window.fullscreen;
    },
  },
  {
    title: "Toggle Always On Top",
    keywords: "ontop on top float pin",
    run: () => {
      core.window.ontop = !core.window.ontop;
    },
  },
  {
    title: "Toggle Mute",
    keywords: "mute unmute silence volume",
    run: () => {
      core.audio.muted = !core.audio.muted;
    },
  },
  {
    title: "Volume Up",
    keywords: "volume louder up increase",
    run: () => {
      core.audio.volume = Math.min(core.audio.volume + 5, 130);
    },
  },
  {
    title: "Volume Down",
    keywords: "volume quieter down decrease",
    run: () => {
      core.audio.volume = Math.max(core.audio.volume - 5, 0);
    },
  },
  {
    title: "Show Playlist Sidebar",
    keywords: "playlist sidebar queue",
    run: () => {
      core.window.sidebar = "playlist";
    },
  },
  {
    title: "Show Chapters Sidebar",
    keywords: "chapters sidebar",
    run: () => {
      core.window.sidebar = "chapters";
    },
  },
  {
    title: "Hide Sidebar",
    keywords: "hide sidebar close panel",
    run: () => {
      core.window.sidebar = null;
    },
  },
  {
    title: "Seek Forward 10s",
    keywords: "seek forward skip ahead 10",
    run: () => core.seek(10, false),
  },
  {
    title: "Seek Backward 10s",
    keywords: "seek backward rewind back 10",
    run: () => core.seek(-10, false),
  },
  {
    title: "Speed Up (1.25x step)",
    keywords: "speed faster rate",
    run: () => core.setSpeed(core.status.speed * 1.25),
  },
  {
    title: "Slow Down (0.8x step)",
    keywords: "speed slower rate",
    run: () => core.setSpeed(core.status.speed * 0.8),
  },
  {
    title: "Reset Speed (1x)",
    keywords: "speed normal reset rate",
    run: () => core.setSpeed(1),
  },
  {
    title: "Open File…",
    keywords: "open file load",
    run: () => mpv.command("script-binding", ["iina/open-file"]),
  },
];

// ---------------------------------------------------------------------------
// Source 1: mpv commands, enumerated at runtime.
// command-list is an array of { name, args: [{ name, type, optional }] }.
// We surface the *name*; most take args, so running them bare is best-effort
// (mpv uses defaults / no-ops where it can). We only auto-run no-arg commands.
// ---------------------------------------------------------------------------
function getMpvCommands() {
  let list;
  try {
    list = mpv.getNative("command-list");
  } catch (e) {
    console.error("Failed to read mpv command-list: " + e);
    return [];
  }
  if (!Array.isArray(list)) return [];

  return list
    .filter((c) => c && typeof c.name === "string")
    .map((c) => {
      const args = Array.isArray(c.args) ? c.args : [];
      const required = args.filter((a) => a && !a.optional);
      const argSummary = args
        .map((a) => (a && a.optional ? `[${a.name}]` : a && a.name) || "")
        .filter(Boolean)
        .join(" ");
      return {
        name: c.name,
        requiredArgCount: required.length,
        subtitle: argSummary ? `mpv: ${c.name} ${argSummary}` : `mpv: ${c.name}`,
        keywords: `mpv ${c.name} ${argSummary}`,
      };
    });
}

// ---------------------------------------------------------------------------
// Source 3: bound key bindings.
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
 *   "all"   = merged mpv (source 1) + curated IINA actions (source 2),
 *             annotated with any matching bound shortcut.
 *   "bound" = derived purely from key bindings (source 3).
 * @returns {{ commands: object[], runMap: Object<string, () => void> }}
 *   `commands` is JSON-serializable (no functions) for postMessage;
 *   `runMap` maps id -> executor, kept entry-side only.
 */
function buildCommandList(scope) {
  const commands = [];
  const runMap = {};

  // Index bound shortcuts by their action string so we can show them in "all".
  const bindings = getKeyBindings();
  const shortcutByAction = {};
  for (const b of bindings) {
    if (b.action && !shortcutByAction[b.action]) {
      shortcutByAction[b.action] = prettyKey(b.key);
    }
  }

  if (scope === "bound") {
    // Source 3 only.
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
    // Source 2: curated IINA actions first (most useful, hand-labeled).
    IINA_ACTIONS.forEach((a, i) => {
      const id = `iina:${i}`;
      commands.push({
        id,
        title: a.title,
        subtitle: "IINA action",
        shortcut: "",
        source: "iina",
      });
      runMap[id] = a.run;
    });

    // Source 1: mpv commands, annotated with a bound shortcut if one exists.
    getMpvCommands().forEach((c) => {
      const id = `mpv:${c.name}`;
      commands.push({
        id,
        title: c.name,
        subtitle: c.subtitle,
        shortcut: shortcutByAction[c.name] || "",
        source: "mpv",
        requiredArgCount: c.requiredArgCount,
      });
      runMap[id] = () => {
        if (c.requiredArgCount > 0) {
          core.osd(`“${c.name}” needs ${c.requiredArgCount} argument(s); run via a binding.`);
          return;
        }
        try {
          mpv.command(c.name, []);
        } catch (e) {
          console.error(`mpv command ${c.name} failed: ${e}`);
          core.osd(`Command failed: ${c.name}`);
        }
      };
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
