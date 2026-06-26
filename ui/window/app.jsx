import React from "react";
import { rank } from "./fuzzy.js";

// The webview can't touch the IINA API directly; it talks to the entry script
// via the injected global `iina` ({ postMessage, onMessage }).
const bridge = typeof iina !== "undefined" ? iina : { postMessage() {}, onMessage() {} };

export default function App() {
  const [commands, setCommands] = React.useState([]);
  const [scope, setScope] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  // Receive the command list from the entry script.
  React.useEffect(() => {
    bridge.onMessage("commands", (data) => {
      setCommands(Array.isArray(data && data.commands) ? data.commands : []);
      setScope((data && data.scope) || "all");
      // Reset the palette to a fresh state each time it's (re)populated.
      setQuery("");
      setActive(0);
      focusInput();
    });
    // The window may be reused across opens; ask for a refresh when shown.
    bridge.onMessage("focus", () => {
      setQuery("");
      setActive(0);
      focusInput();
    });
    // Tell the entry we're loaded and ready for data.
    bridge.postMessage("ready", {});
  }, []);

  const results = React.useMemo(() => rank(commands, query.trim()), [commands, query]);

  // Keep the active index in range as results change.
  React.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Keep the highlighted row scrolled into view.
  React.useEffect(() => {
    const el = listRef.current && listRef.current.children[active];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [active]);

  function focusInput() {
    // Defer so the element exists / window is shown.
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
  }

  function runAt(i) {
    const cmd = results[i];
    if (cmd) bridge.postMessage("run", { id: cmd.id });
  }

  function close() {
    bridge.postMessage("close", {});
  }

  function onKeyDown(e) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        runAt(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  }

  return (
    <div className="palette" onKeyDown={onKeyDown}>
      <input
        ref={inputRef}
        className="search"
        type="text"
        autoFocus
        spellCheck={false}
        placeholder={
          scope === "bound"
            ? "Search commands with a shortcut…"
            : "Search commands…"
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
      />
      <ul className="results" ref={listRef}>
        {results.length === 0 && (
          <li className="empty">No matching commands</li>
        )}
        {results.map((cmd, i) => (
          <li
            key={cmd.id}
            className={"row" + (i === active ? " active" : "")}
            onMouseMove={() => setActive(i)}
            onClick={() => runAt(i)}
          >
            <div className="labels">
              <span className="title">{cmd.title}</span>
              {cmd.subtitle ? (
                <span className="subtitle">{cmd.subtitle}</span>
              ) : null}
            </div>
            {cmd.shortcut ? (
              <span className="shortcut">{cmd.shortcut}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> run</span>
        <span><kbd>esc</kbd> close</span>
        <span className="count">{results.length} commands</span>
      </div>
    </div>
  );
}
