// iina-cmd-menu — main entry
//
// Registers a Cmd+K menu item that toggles a command palette rendered in IINA's
// SIDEBAR — the same docked panel as IINA's Video/Audio/Subtitles inspector.
// The sidebar lives inside the player window (no separate window, no title bar,
// no traffic-light buttons) and is fully interactive by default. Builds the
// command list from the configured search scope and runs the selected command.

const { sidebarView, menu, preferences, console } = iina;
const { buildCommandList } = require("./commands.js");

// Point the sidebar tab at the bundled React UI (path relative to plugin root).
sidebarView.loadFile("dist/ui/window/index.html");

let isOpen = false;
// Latest id -> executor map, rebuilt every time we open the palette.
let runMap = {};

function readScope() {
  // "all" (default) or "bound" — see the preferences page.
  const scope = preferences.get("searchScope");
  return scope === "bound" ? "bound" : "all";
}

function pushCommands() {
  const scope = readScope();
  const built = buildCommandList(scope);
  runMap = built.runMap;
  sidebarView.postMessage("commands", { commands: built.commands, scope });
}

function openPalette() {
  pushCommands();
  sidebarView.show();
  // Ask the webview to clear + focus its search field.
  sidebarView.postMessage("focus", {});
  isOpen = true;
}

function closePalette() {
  sidebarView.hide();
  isOpen = false;
}

function togglePalette() {
  if (isOpen) closePalette();
  else openPalette();
}

// --- Webview -> entry messages --------------------------------------------

// The webview asks for a fresh command list (e.g. on its own load).
sidebarView.onMessage("ready", () => {
  pushCommands();
});

// The user picked a command: run it, then close.
sidebarView.onMessage("run", (data) => {
  const id = data && data.id;
  const run = id && runMap[id];
  closePalette();
  if (typeof run === "function") {
    try {
      run();
    } catch (e) {
      console.error(`Command "${id}" threw: ${e}`);
    }
  } else {
    console.warn(`No executor for command id: ${id}`);
  }
});

// The user dismissed the palette (Esc).
sidebarView.onMessage("close", () => {
  closePalette();
});

// --- Menu item + Cmd+K shortcut -------------------------------------------

menu.addItem(
  menu.item("Command Menu", togglePalette, { keyBinding: "Meta+k" }),
);

console.log("iina-cmd-menu loaded");
