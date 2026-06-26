// Tiny typo/partial-tolerant fuzzy matcher (subsequence scoring), no deps.
//
// score(query, target) returns a number; higher is better, -Infinity = no match.
// Matching is case-insensitive and rewards: consecutive runs, matches at word
// boundaries / start, and earlier matches.

export function score(query, target) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let qi = 0;
  let ti = 0;
  let s = 0;
  let run = 0;
  let prevMatchIdx = -1;

  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      let bonus = 1;
      // Consecutive-match bonus (grows with run length).
      if (prevMatchIdx === ti - 1) {
        run += 1;
        bonus += run * 4;
      } else {
        run = 0;
      }
      // Word-boundary / start-of-string bonus.
      const prevChar = t[ti - 1];
      if (ti === 0 || prevChar === " " || prevChar === "-" || prevChar === "_") {
        bonus += 8;
      }
      // Earlier matches are slightly better.
      bonus += Math.max(0, 3 - ti * 0.05);

      s += bonus;
      prevMatchIdx = ti;
      qi += 1;
    }
    ti += 1;
  }

  // Every query char must have matched in order.
  if (qi < q.length) return -Infinity;

  // Prefer shorter targets when scores are otherwise close.
  s -= t.length * 0.02;
  return s;
}

/**
 * Filter + rank a list of commands against a query.
 * Each command matches against `title`, `subtitle`, and `shortcut`.
 */
export function rank(commands, query) {
  if (!query) return commands;
  const scored = [];
  for (const cmd of commands) {
    const haystack = `${cmd.title} ${cmd.subtitle || ""} ${cmd.shortcut || ""}`;
    // Best of: matching the whole haystack, or just the title (title weighted up).
    const sTitle = score(query, cmd.title);
    const sAll = score(query, haystack);
    const best = Math.max(sTitle + 5, sAll);
    if (best > -Infinity) scored.push({ cmd, best });
  }
  scored.sort((a, b) => b.best - a.best);
  return scored.map((x) => x.cmd);
}
