// iina-cmd-menu — main entry
//
// Registers a Cmd+K menu item that toggles a StandaloneWindow command palette,
// builds the command list from the configured search scope, and runs the
// command the webview selects.

const { standaloneWindow, menu, preferences, console } = iina;
const { buildCommandList } = require("./commands.js");

// Point the standalone window at the bundled React UI (path is relative to the
// plugin root). Configure it to look like a floating command palette.
standaloneWindow.loadFile("dist/ui/window/index.html");
standaloneWindow.setProperty({
  title: "Command Menu",
  resizable: false,
  hideTitleBar: true,
  fullSizeContentView: true,
});
standaloneWindow.setFrame(640, 420);

let isOpen = false;
// Latest id -> executor map, rebuilt every time we open the palette.
let runMap = {};

function readScope() {
  // "all" (default) or "bound" — see the preferences page.
  const scope = preferences.get("searchScope");
  return scope === "bound" ? "bound" : "all";
}

function openPalette() {
  const scope = readScope();
  const built = buildCommandList(scope);
  runMap = built.runMap;

  // Send the (serializable) command list to the webview, then show it.
  standaloneWindow.postMessage("commands", {
    commands: built.commands,
    scope,
  });
  standaloneWindow.open();
  isOpen = true;
}

function closePalette() {
  standaloneWindow.close();
  isOpen = false;
}

function togglePalette() {
  if (isOpen) closePalette();
  else openPalette();
}

// --- Webview -> entry messages -------------------------------------------

// The webview asks for a fresh command list (e.g. on its own load).
standaloneWindow.onMessage("ready", () => {
  const scope = readScope();
  const built = buildCommandList(scope);
  runMap = built.runMap;
  standaloneWindow.postMessage("commands", { commands: built.commands, scope });
});

// The user picked a command: run it, then close.
standaloneWindow.onMessage("run", (data) => {
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

// The user dismissed the palette (Esc / blur).
standaloneWindow.onMessage("close", () => {
  closePalette();
});

// --- Menu item + Cmd+K shortcut -------------------------------------------

menu.addItem(
  menu.item("Command Menu", togglePalette, { keyBinding: "Meta+k" }),
);

console.log("iina-cmd-menu loaded");
