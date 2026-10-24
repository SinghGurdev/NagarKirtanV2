// Pure live-tracking logic: takes the previous live state and one update
// from the lead phone, returns the next live state. No AWS calls here, so it
// can be tested locally (tools/test-live.mjs).

import { prepareLeg, snap, distance, pointAt } from "./geo.mjs";

export const DEFAULT_SPEED = 0.894; // m/s, about 2 mph
const TURN_SOON = 150; // m: say "Turning right onto…" this close to a turn
const OFF_ROUTE = 120; // m from the route counts as off it
const ARRIVE_RADIUS = 120; // m from the end of a leg counts as arrived
const LEAVE_PARK = 200; // m out along the return leg counts as departed
const SAMPLE_WINDOW = 15 * 60 * 1000; // pace is measured over the last 15 min
const BACKTRACK = 150; // m: GPS jitter smaller than this never moves us backwards

/** Route legs with geometry prepared, keyed by id ("outbound", "return"). */
export function prepareRoute(route) {
  return Object.fromEntries(route.legs.map((l) => [l.id, prepareLeg(l)]));
}

export function emptyState() {
  return {
    status: "not-started", // not-started | live | paused | ended
    phase: "outbound", // outbound | at-park | return
    updatedAt: null,
    lead: null,
    snapped: null,
    leg: null,
    progressMeters: 0,
    legMeters: null,
    offRoute: false,
    street: null,
    nextTurn: null,
    turnSoon: false,
    speedMps: null,
    actual: {},
    eta: {},
    samples: [],
    battery: null,
  };
}

// --- time helpers -----------------------------------------------------------

function tzOffsetMs(utcMs, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - utcMs;
}

/** "11:00" on the event date in the event's time zone, as epoch ms. */
export function plannedMs(content, hhmm) {
  const [y, m, d] = content.event.date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  return guess - tzOffsetMs(guess, content.event.timezone);
}

const iso = (ms) => new Date(ms).toISOString();

function planned(content) {
  const t = (id) => {
    const ev = content.schedule.find((e) => e.id === id);
    return ev ? plannedMs(content, ev.time) : null;
  };
  return {
    departGurdwara: t("depart-gurdwara"),
    arrivePark: t("arrive-park"),
    departPark: t("depart-park"),
    arriveGurdwara: t("arrive-gurdwara"),
  };
}

// --- pace and ETAs ----------------------------------------------------------

function pace(samples) {
  if (samples.length < 2) return DEFAULT_SPEED;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = (last.t - first.t) / 1000;
  if (dt < 120) return DEFAULT_SPEED;
  const v = (last.d - first.d) / dt;
  // A procession stops and starts; keep the estimate within sane bounds.
  return Math.min(2.0, Math.max(0.3, v));
}

function etas(s, route, content, now) {
  const p = planned(content);
  const out = route.outbound.length;
  const back = route.return.length;
  const returnTrip = p.arriveGurdwara && p.departPark ? p.arriveGurdwara - p.departPark : back / DEFAULT_SPEED;
  const eta = {};
  const v = s.speedMps || DEFAULT_SPEED;

  if (s.phase === "outbound") {
    const arrive = now + ((out - s.progressMeters) / v) * 1000;
    eta["arrive-park"] = iso(arrive);
    if (p.departPark && p.arrivePark) {
      const late = Math.max(0, arrive - p.arrivePark);
      const depart = p.departPark + late;
      eta["depart-park"] = iso(depart);
      eta["arrive-gurdwara"] = iso(depart + returnTrip);
    }
  } else if (s.phase === "at-park") {
    if (p.departPark && p.arrivePark) {
      const arrived = s.actual["arrive-park"] ? Date.parse(s.actual["arrive-park"]) : now;
      const late = Math.max(0, arrived - p.arrivePark);
      const depart = Math.max(now, p.departPark + late);
      eta["depart-park"] = iso(depart);
      eta["arrive-gurdwara"] = iso(depart + returnTrip);
    }
  } else if (s.phase === "return") {
    eta["arrive-gurdwara"] = iso(now + ((back - s.progressMeters) / v) * 1000);
  }
  return eta;
}

// --- street and turn --------------------------------------------------------

function streetAndTurn(leg, progress) {
  // Street = the last turn already reached (or the starting street), so the
  // street name and the next turn always agree.
  const done = leg.turns.filter((t) => t.atMeters <= progress + 5);
  const street = done.length ? done[done.length - 1].onto : leg.startStreet;
  const next = leg.turns.find((t) => t.atMeters > progress + 5) ?? null;
  const inMeters = next ? Math.round(next.atMeters - progress) : null;
  return {
    street,
    nextTurn: next ? { direction: next.direction, onto: next.onto, inMeters } : null,
    turnSoon: next ? inMeters <= TURN_SOON : false,
  };
}

// --- main -------------------------------------------------------------------

/**
 * Applies one update. `input.action` is one of:
 *   position {lat, lng, accuracy?, battery?}
 *   phase {phase}      lead device corrects outbound / at-park / return
 *   pause | resume | end | reset
 */
export function apply(prev, input, { route, content, now }) {
  const s = structuredClone(prev ?? emptyState());
  const stamp = iso(now);

  switch (input.action) {
    case "reset":
      return { ...emptyState(), updatedAt: stamp };
    case "pause":
      if (s.status === "live") s.status = "paused";
      s.updatedAt = stamp;
      return s;
    case "resume":
      // Also undoes an accidental "end" (arrival time is cleared).
      if (s.status === "ended") delete s.actual["arrive-gurdwara"];
      if (s.status === "paused" || s.status === "ended") s.status = "live";
      s.updatedAt = stamp;
      return s;
    case "end":
      s.status = "ended";
      s.actual["arrive-gurdwara"] ??= stamp;
      s.eta = {};
      s.turnSoon = false;
      s.updatedAt = stamp;
      return s;
    case "phase": {
      if (!["outbound", "at-park", "return"].includes(input.phase)) throw new Error("bad phase");
      s.phase = input.phase;
      if (input.phase === "at-park") s.actual["arrive-park"] ??= stamp;
      if (input.phase === "return") {
        s.actual["depart-park"] ??= stamp;
        s.samples = [];
      }
      if (s.status === "not-started") s.status = "live";
      s.updatedAt = stamp;
      s.eta = etas(s, route, content, now);
      return s;
    }
    case "position":
      break;
    default:
      throw new Error("unknown action");
  }

  if (s.status === "ended") return s; // a stray update after the end changes nothing
  s.status = "live";
  s.lead = { lat: input.lat, lng: input.lng, accuracy: input.accuracy ?? null };
  if (typeof input.battery === "number") s.battery = input.battery;

  const here = [input.lng, input.lat];
  const out = route.outbound;
  const back = route.return;

  // Phase changes happen on their own as the lead phone moves.
  if (s.phase === "outbound") {
    const sn = snap(out, input.lng, input.lat);
    if (sn.distance < OFF_ROUTE && sn.progress > 60) s.actual["depart-gurdwara"] ??= stamp;
    if (sn.distance < OFF_ROUTE && out.length - sn.progress < ARRIVE_RADIUS) {
      s.phase = "at-park";
      s.actual["arrive-park"] ??= stamp;
    }
  }
  if (s.phase === "at-park") {
    const sn = snap(back, input.lng, input.lat);
    const fromPark = distance(here, back.coordinates[0]);
    if (sn.distance < OFF_ROUTE && sn.progress > LEAVE_PARK && fromPark > LEAVE_PARK) {
      s.phase = "return";
      s.actual["depart-park"] ??= stamp;
      s.samples = []; // time spent at the park says nothing about walking pace
    }
  }

  let tripMeters;
  if (s.phase === "at-park") {
    s.leg = "outbound";
    s.legMeters = Math.round(out.length);
    s.progressMeters = Math.round(out.length);
    s.snapped = out.coordinates[out.coordinates.length - 1];
    s.offRoute = false;
    s.street = null;
    s.nextTurn = null;
    s.turnSoon = false;
    tripMeters = out.length;
  } else {
    const leg = s.phase === "return" ? back : out;
    const sn = snap(leg, input.lng, input.lat);
    s.offRoute = sn.distance > OFF_ROUTE;

    // The procession only moves forward: small backward jumps are GPS
    // jitter (mostly at corners), so hold the previous position instead.
    let progress = sn.progress;
    const before = prev?.leg === leg.id ? prev.progressMeters : null;
    if (before != null && progress < before && progress > before - BACKTRACK) progress = before;
    const at = pointAt(leg, progress);

    s.leg = leg.id;
    s.legMeters = Math.round(leg.length);
    s.progressMeters = Math.round(progress);
    s.snapped = s.offRoute ? null : at.point.map((v) => +v.toFixed(6));
    Object.assign(s, s.offRoute ? { street: null, nextTurn: null, turnSoon: false } : streetAndTurn(leg, progress));
    if (s.phase === "return" && leg.length - progress < ARRIVE_RADIUS && !s.offRoute) {
      s.actual["arrive-gurdwara"] ??= stamp;
    }
    tripMeters = s.phase === "return" ? out.length + progress : progress;
  }

  // Pace from the last 15 minutes of progress along the whole trip.
  s.samples = [...s.samples, { t: now, d: Math.round(tripMeters) }].filter((x) => now - x.t <= SAMPLE_WINDOW);
  if (s.samples.length > 200) s.samples = s.samples.slice(-200);
  s.speedMps = +pace(s.samples).toFixed(3);

  s.updatedAt = stamp;
  s.eta = etas(s, route, content, now);
  return s;
}
