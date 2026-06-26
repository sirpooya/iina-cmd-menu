import React from "react";
import { rank } from "./fuzzy.js";

// The webview can't touch the IINA API directly; it talks to the entry script
// via the injected global `iina` ({ postMessage, onMessage }).
const bridge =
  typeof iina !== "undefined" ? iina : { postMessage() {}, onMessage() {} };

// A small glyph per category, drawn before the title. Purely cosmetic.
const CATEGORY_ICON = {
  File: "􀈕",
  Playback: "􀊃",
  Video: "􀎶",
  Audio: "􀊨",
  Subtitle: "􀖈",
  Window: "􀏝",
};

// Fallback dot when a category has no SF-symbol glyph available in the webview
// font (the glyphs above only render on macOS; we guard with a CSS fallback).
function categoryGlyph(cat) {
  return CATEGORY_ICON[cat] || "•";
}

export default function App() {
  const [commands, setCommands] = React.useState([]);
  const [scope, setScope] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    bridge.onMessage("commands", (data) => {
      setCommands(Array.isArray(data && data.commands) ? data.commands : []);
      setScope((data && data.scope) || "all");
      setQuery("");
      setActive(0);
      focusInput();
    });
    bridge.onMessage("focus", () => {
      setQuery("");
      setActive(0);
      focusInput();
    });
    bridge.postMessage("ready", {});
  }, []);

  const results = React.useMemo(
    () => rank(commands, query.trim()),
    [commands, query],
  );

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

  // Group consecutive results by category so we can render section headers,
  // but only when there's no active query (ranking reorders across categories,
  // so headers only make sense for the unfiltered, in-order list).
  const grouped = React.useMemo(() => buildGroups(results, query.trim()), [
    results,
    query,
  ]);

  return (
    // Clicking the dimmed backdrop (outside the card) dismisses the palette.
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="card" onKeyDown={onKeyDown}>
        <div className="search-row">
          <span className="search-icon" aria-hidden>
            􀊫
          </span>
          <input
            ref={inputRef}
            className="search"
            type="text"
            autoFocus
            spellCheck={false}
            placeholder={
              scope === "bound"
                ? "Search commands with a shortcut…"
                : "Search IINA commands…"
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          {query ? (
            <button
              className="clear"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery("");
                setActive(0);
                focusInput();
              }}
              aria-label="Clear"
            >
              􀁡
            </button>
          ) : null}
        </div>

        <ul className="results" ref={listRef}>
          {results.length === 0 && (
            <li className="empty">No matching commands</li>
          )}
          {grouped.map((entry) =>
            entry.type === "header" ? (
              <li className="section" key={`h:${entry.label}`}>
                {entry.label}
              </li>
            ) : (
              <li
                key={entry.cmd.id}
                className={"row" + (entry.index === active ? " active" : "")}
                onMouseMove={() => setActive(entry.index)}
                onClick={() => runAt(entry.index)}
              >
                <span className="glyph" aria-hidden>
                  {categoryGlyph(entry.cmd.subtitle)}
                </span>
                <div className="labels">
                  <span className="title">{entry.cmd.title}</span>
                  {entry.cmd.subtitle ? (
                    <span className="subtitle">{entry.cmd.subtitle}</span>
                  ) : null}
                </div>
                {entry.cmd.shortcut ? (
                  <span className="shortcut">{entry.cmd.shortcut}</span>
                ) : null}
              </li>
            ),
          )}
        </ul>

        <div className="footer">
          <span className="hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>navigate</span>
          </span>
          <span className="hint">
            <kbd>↵</kbd>
            <span>run</span>
          </span>
          <span className="hint">
            <kbd>esc</kbd>
            <span>close</span>
          </span>
          <span className="count">
            {results.length} {results.length === 1 ? "command" : "commands"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Flatten ranked results into render entries. When the list is unfiltered we
 * interleave category section headers; when filtered we render a flat ranked
 * list (no headers, since ranking crosses categories). Every command entry
 * carries its absolute index into `results` so keyboard nav stays correct.
 */
function buildGroups(results, query) {
  const out = [];
  if (query) {
    results.forEach((cmd, index) => out.push({ type: "cmd", cmd, index }));
    return out;
  }
  let lastCat = null;
  results.forEach((cmd, index) => {
    const cat = cmd.subtitle || "";
    if (cat !== lastCat) {
      out.push({ type: "header", label: cat });
      lastCat = cat;
    }
    out.push({ type: "cmd", cmd, index });
  });
  return out;
}
