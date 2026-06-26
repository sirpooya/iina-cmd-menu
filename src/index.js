// iina-cmd-menu — main entry
//
// Registers a Cmd+K menu item that toggles a command palette rendered as a
// chrome-less Overlay drawn directly on top of the video inside the player
// window. Using `overlay` (instead of `standaloneWindow`) means there is NO
// separate window, NO title bar, and NO traffic-light buttons — a true
// Spotlight/Raycast-style overlay. Builds the command list from the configured
// search scope and runs the command the webview selects.
//
// Overlay caveats handled here:
//  - The overlay is non-interactive until `setClickable(true)`; only elements
//    marked `data-clickable` in the HTML receive input (see app.jsx).
//  - The overlay lives inside the player window, so it only appears when a
//    player window is open. That's fine for a playback command palette.

const { overlay, event, menu, preferences, console } = iina;
const { buildCommandList } = require("./commands.js");

// Point the overlay at the bundled React UI (path relative to the plugin root).
overlay.loadFile("dist/ui/window/index.html");
// Enable interaction so the search field and result rows (marked data-clickable)
// can receive clicks and keyboard input.
overlay.setClickable(true);
// Start hidden; toggled by the menu item / Cmd+K.
overlay.hide();

let isOpen = false;
let overlayLoaded = false;
// Latest id -> executor map, rebuilt every time we open the palette.
let runMap = {};
// If the user hits Cmd+K before the overlay webview finishes loading, remember
// to push commands as soon as it signals ready.
let pendingOpen = false;

function readScope() {
  // "all" (default) or "bound" — see the preferences page.
  const scope = preferences.get("searchScope");
  return scope === "bound" ? "bound" : "all";
}

function pushCommands() {
  const scope = readScope();
  const built = buildCommandList(scope);
  runMap = built.runMap;
  overlay.postMessage("commands", { commands: built.commands, scope });
}

function openPalette() {
  if (!overlayLoaded) {
    // Webview not ready yet; show it now and send commands on load.
    pendingOpen = true;
    overlay.show();
    isOpen = true;
    return;
  }
  pushCommands();
  overlay.show();
  // Tell the webview to (re)focus its search field.
  overlay.postMessage("focus", {});
  isOpen = true;
}

function closePalette() {
  overlay.hide();
  isOpen = false;
}

function togglePalette() {
  if (isOpen) closePalette();
  else openPalette();
}

// --- Overlay lifecycle ----------------------------------------------------

// Fires when the overlay's HTML/JS has finished loading.
event.on("iina.plugin-overlay-loaded", () => {
  overlayLoaded = true;
  if (pendingOpen) {
    pendingOpen = false;
    pushCommands();
    overlay.postMessage("focus", {});
  }
});

// --- Webview -> entry messages --------------------------------------------

// The webview asks for a fresh command list (e.g. on its own load).
overlay.onMessage("ready", () => {
  overlayLoaded = true;
  pushCommands();
  if (pendingOpen) {
    pendingOpen = false;
    overlay.postMessage("focus", {});
  }
});

// The user picked a command: run it, then close.
overlay.onMessage("run", (data) => {
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

// The user dismissed the palette (Esc / backdrop click).
overlay.onMessage("close", () => {
  closePalette();
});

// --- Menu item + Cmd+K shortcut -------------------------------------------

menu.addItem(
  menu.item("Command Menu", togglePalette, { keyBinding: "Meta+k" }),
);

console.log("iina-cmd-menu loaded");
