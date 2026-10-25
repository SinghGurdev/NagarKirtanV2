// Talks to the Google Apps Script web app attached to the parking-pass Sheet
// (sheet-script/Code.gs). Its URL comes from /data/parking.json; for testing,
// ?api=<url> on the page saves another one on this phone (?api=reset clears it).

const KEY = "parkingScriptUrl";
let urlPromise = null;

function readLocal() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function scriptUrl() {
  if (!urlPromise) {
    urlPromise = (async () => {
      const param = new URLSearchParams(location.search).get("api");
      if (param) {
        try {
          if (param === "reset") localStorage.removeItem(KEY);
          else localStorage.setItem(KEY, param);
        } catch {
          /* private mode: fall through */
        }
        if (param !== "reset") return param;
      }
      const local = readLocal();
      if (local) return local;
      try {
        const res = await fetch("/data/parking.json", { cache: "no-cache" });
        const cfg = await res.json();
        return cfg.scriptUrl || "";
      } catch {
        return "";
      }
    })();
  }
  return urlPromise;
}

/** Calls an action on the Sheet script. Throws Error(message) on failure. */
export async function call(action, data = {}) {
  const url = await scriptUrl();
  if (!url) throw new Error("Not set up yet: the Sheet script address is missing.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    // text/plain keeps this a "simple" request (no CORS preflight), which
    // Apps Script needs.
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...data }),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new Error(err.name === "AbortError" ? "The Sheet took too long to answer." : "Can't reach the Sheet. Check the phone's signal.");
  } finally {
    clearTimeout(timer);
  }
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error("The Sheet sent back something unexpected. Is the script deployed for Anyone?");
  }
  if (!body.ok) throw new Error(body.error || "Something went wrong.");
  return body;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function normId(v) {
  return String(v ?? "")
    .trim()
    .replace(/^#/, "")
    .replace(/^pass\s*#?\s*/i, "")
    .trim()
    .toUpperCase();
}

export function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function fmtDuration(fromIso, toIso) {
  const a = new Date(fromIso);
  const b = toIso ? new Date(toIso) : new Date();
  if (isNaN(a) || isNaN(b)) return "—";
  const mins = Math.max(0, Math.round((b - a) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h} h ${mins % 60} m` : `${mins} m`;
}

export function devRibbon() {
  if (import.meta.env.VITE_STAGE === "dev") {
    const ribbon = document.createElement("div");
    ribbon.className = "stage-ribbon";
    ribbon.textContent = "Dev site · not live";
    document.body.prepend(ribbon);
    document.title = `[Dev] ${document.title}`;
  }
}
