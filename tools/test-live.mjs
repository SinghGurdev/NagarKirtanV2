// Simulated walk over the real route through the live-tracking logic.
// Run: node tools/test-live.mjs   (exits non-zero if a check fails)
import { copyFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
copyFileSync(path.join(root, "app/src/geo.js"), path.join(root, "infra/lambda/live/geo.mjs"));
const { apply, emptyState, prepareRoute, plannedMs } = await import("../infra/lambda/live/compute.mjs");
const { pointAt } = await import("../infra/lambda/live/geo.mjs");

const content = JSON.parse(readFileSync(path.join(root, "app/public/data/content.json"), "utf8"));
const route = prepareRoute(JSON.parse(readFileSync(path.join(root, "app/public/data/route.json"), "utf8")));

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
const jitter = ([lng, lat], m) => [lng + (rand() * 2 * m) / 89000, lat + (rand() * 2 * m) / 111000];
const fmt = (ms) => new Date(ms).toLocaleTimeString("en-US", { timeZone: content.event.timezone, hour: "numeric", minute: "2-digit" });

let s = emptyState();
let now = plannedMs(content, "11:04");
const step = 5000;
const speed = 0.8; // m/s, slower than a normal walk
const log = [];
let lastLine = "";
const see = (label) => {
  const turn = s.turnSoon && s.nextTurn ? `Turning ${s.nextTurn.direction} onto ${s.nextTurn.onto}` : s.street ? `On ${s.street}` : s.phase === "at-park" ? "At the park" : "(off route)";
  const line = `${fmt(now)}  ${s.phase.padEnd(8)} ${String(s.progressMeters).padStart(5)} m  ${turn}`;
  if (turn !== lastLine) log.push(`${line}   eta park ${s.eta["arrive-park"] ? fmt(Date.parse(s.eta["arrive-park"])) : "-"}, back ${s.eta["arrive-gurdwara"] ? fmt(Date.parse(s.eta["arrive-gurdwara"])) : "-"}${label ? "  <- " + label : ""}`);
  lastLine = turn;
};
const send = (p, extra = {}) => {
  const [lng, lat] = jitter(p, 12);
  s = apply(s, { action: "position", lat, lng, accuracy: 12, ...extra }, { route, content, now });
};

// Outbound
for (let d = 0; d <= route.outbound.length + 20; d += speed * (step / 1000)) {
  send(pointAt(route.outbound, d).point);
  see();
  now += step;
}
assert.equal(s.phase, "at-park", "should have arrived at the park");
assert.ok(s.actual["depart-gurdwara"] && s.actual["arrive-park"]);
see("arrived");

// 80 minutes at the park, phone wandering near the stage
for (let i = 0; i < (80 * 60 * 1000) / step; i++) {
  send(route.return.coordinates[0]);
  now += step;
}
assert.equal(s.phase, "at-park", "standing at the park keeps the phase");
see("still at the park");

// Return
for (let d = 0; d <= route.return.length + 20; d += speed * (step / 1000)) {
  send(pointAt(route.return, d).point);
  see();
  now += step;
}
assert.equal(s.phase, "return");
assert.ok(s.actual["depart-park"] && s.actual["arrive-gurdwara"], "return times recorded");
s = apply(s, { action: "end" }, { route, content, now });
assert.equal(s.status, "ended");

// Pause / resume and a stray update after the end
const paused = apply({ ...s, status: "live" }, { action: "pause" }, { route, content, now });
assert.equal(paused.status, "paused");
assert.equal(apply(s, { action: "position", lat: 36.64, lng: -119.70 }, { route, content, now }).status, "ended");

console.log(log.join("\n"));
console.log(`\nactual: ${Object.entries(s.actual).map(([k, v]) => `${k} ${fmt(Date.parse(v))}`).join(", ")}`);
console.log(`state file size: ${JSON.stringify(s).length} bytes`);
console.log("all checks passed");
