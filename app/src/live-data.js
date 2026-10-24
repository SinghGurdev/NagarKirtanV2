// Live Nagar Kirtan data: reading the public state and talking to the
// lead-device endpoint.

let apiPromise = null;
/** The live-tracking endpoint for this site (written at deploy time). */
export function apiUrl() {
  apiPromise ??= fetch("/config/api.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => j.liveApiUrl || null)
    .catch(() => null);
  return apiPromise;
}

/** Latest live state, or null before the first update. */
export async function fetchLive() {
  // The query string only defeats the phone's own cache; CloudFront ignores it.
  const r = await fetch(`/live/state.json?t=${Math.floor(Date.now() / 2000)}`);
  if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return null;
  return r.json();
}

/** Sends an update from the lead device. Throws with .status on failure. */
export async function postLive(body) {
  const url = await apiUrl();
  if (!url) throw Object.assign(new Error("Live tracking isn't set up on this site yet."), { status: 0 });
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { status: r.status });
  return j;
}

/**
 * Calls `cb(state)` now and every `ms` while the page is visible.
 * Returns a stop function.
 */
export function pollLive(cb, ms = 5000) {
  let timer = null;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      cb(await fetchLive());
    } catch {
      /* keep the last state on a network blip */
    }
    if (!stopped && document.visibilityState === "visible") timer = setTimeout(tick, ms);
  };
  const onVis = () => {
    clearTimeout(timer);
    if (document.visibilityState === "visible") tick();
  };
  document.addEventListener("visibilitychange", onVis);
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVis);
  };
}

/** "8 sec ago", "3 min ago", "1 hr ago". */
export function ago(iso, now = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} sec ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} hr ago`;
}

/** Clock time in the event's time zone, e.g. "1:05 PM". */
export function clock(iso, timeZone) {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

export function distanceText(m) {
  const mi = m / 1609.34;
  if (mi >= 0.1) return `${mi.toFixed(1)} mi`;
  return `${Math.max(10, Math.round((m * 3.281) / 10) * 10)} ft`;
}
