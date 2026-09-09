import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

// One JSON file per event, so Pages CMS can give Brie a sortable table with an
// "Add entry" button and one commit per event.
//
// The upcoming/previous split is deliberately NOT done here: GitHub Pages only
// rebuilds on commit, so a build-time split would keep advertising a reading
// the morning after it happened. Every event is rendered into the HTML (so it
// is crawlable) and src/js/events.js moves the past ones at load.
const DIR = "content/events";

export default function () {
  if (!existsSync(DIR)) return [];
  const events = readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")))
    .filter((e) => e && e.date);

  // Newest first. `order` breaks ties for same-day events, replacing the array
  // ordering the old hand-written EVENTS list relied on.
  return events.sort((a, b) => {
    const d = new Date(b.date) - new Date(a.date);
    return d !== 0 ? d : (a.order ?? 0) - (b.order ?? 0);
  });
}
