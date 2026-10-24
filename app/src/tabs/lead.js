import { esc } from "../data.js";
import { postLive, ago, distanceText } from "../live-data.js";

// Lead device page (#/lead). Not in the tab bar: the phone at the front of
// the Nagar Kirtan opens this link, signs in with the passcode and shares
// its GPS position every 5 seconds while the screen stays on.

const KEY = "nk-lead-passcode";
const SEND_EVERY = 5000;
const store = {
  get: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY);
    } catch {
      /* private mode: passcode is kept for this visit only */
    }
  },
};

const PHASES = [
  { id: "outbound", label: "To the park" },
  { id: "at-park", label: "At the park" },
  { id: "return", label: "Heading back" },
];

const pinIcon =
  '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

export const lead = {
  id: "lead",
  label: "Lead device",
  title: "Lead device",
  hidden: true,
  render() {
    return `
      <header class="page-head">
        <div>
          <h1>Lead device</h1>
          <div class="sub">Only for the phone at the front of the Nagar Kirtan</div>
        </div>
      </header>
      <div id="lead-root"></div>`;
  },

  mount(view) {
    const root = view.querySelector("#lead-root");
    let passcode = store.get();
    let mode = "idle"; // idle | sharing | paused | ended
    let server = null; // summary returned by the endpoint
    let latest = null; // last GPS fix
    let lastSent = null;
    let lastError = null;
    let battery = null;
    let watchId = null;
    let sendTimer = null;
    let tick = null;
    let wakeLock = null;
    let busy = false;

    navigator.getBattery?.()
      .then((b) => {
        const upd = () => (battery = Math.round(b.level * 100));
        upd();
        b.addEventListener("levelchange", upd);
      })
      .catch(() => {});

    // --- talking to the endpoint ---------------------------------------
    async function call(body) {
      try {
        const r = await postLive({ passcode, ...body });
        server = r.state;
        lastError = null;
        return r;
      } catch (e) {
        if (e.status === 401) {
          stopSharing();
          passcode = null;
          store.set(null);
          lastError = "That passcode isn't right. Sign in again.";
          draw();
        } else {
          lastError = e.status ? e.message : "Couldn't reach the server. Retrying…";
        }
        throw e;
      }
    }

    async function sendPosition() {
      if (!latest || busy) return;
      busy = true;
      try {
        await call({
          action: "position",
          lat: latest.coords.latitude,
          lng: latest.coords.longitude,
          accuracy: latest.coords.accuracy,
          battery,
        });
        lastSent = Date.now();
      } catch {
        /* shown in the status line */
      } finally {
        busy = false;
        draw();
      }
    }

    // --- screen wake lock -----------------------------------------------
    async function holdScreen() {
      try {
        wakeLock = await navigator.wakeLock?.request("screen");
      } catch {
        wakeLock = null;
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && mode === "sharing") {
        holdScreen();
        sendPosition();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // --- start / pause / end ----------------------------------------------
    async function startSharing() {
      if (!("geolocation" in navigator)) {
        lastError = "This browser can't share location.";
        return draw();
      }
      if (server?.status === "ended") {
        if (!confirm("The Nagar Kirtan was marked as ended. Start sharing again?")) return;
      }
      if (server?.status === "paused" || server?.status === "ended") {
        await call({ action: "resume" }).catch(() => {});
      }
      mode = "sharing";
      lastError = null;
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const first = !latest;
          latest = pos;
          if (first) sendPosition();
          draw();
        },
        (err) => {
          lastError =
            err.code === 1
              ? "Location is blocked. Allow location for this site in the phone's settings."
              : "Waiting for a GPS fix…";
          draw();
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
      );
      sendTimer = setInterval(sendPosition, SEND_EVERY);
      holdScreen();
      draw();
    }

    function stopSharing() {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearInterval(sendTimer);
      watchId = null;
      sendTimer = null;
      latest = null;
      wakeLock?.release?.().catch(() => {});
      wakeLock = null;
    }

    async function pauseSharing() {
      stopSharing();
      mode = "paused";
      await call({ action: "pause" }).catch(() => {});
      draw();
    }

    async function endNagarKirtan() {
      if (!confirm("End the Nagar Kirtan? The map will show it has returned to the Gurdwara.")) return;
      stopSharing();
      await call({ action: "end" }).catch(() => {});
      mode = "ended";
      draw();
    }

    async function setPhase(phase) {
      await call({ action: "phase", phase }).catch(() => {});
      draw();
    }

    async function startOver() {
      if (!confirm("Clear the live position and arrival times? Use this only for testing.")) return;
      stopSharing();
      await call({ action: "reset" }).catch(() => {});
      mode = "idle";
      draw();
    }

    // --- drawing ------------------------------------------------------------
    function signInView() {
      return `
        <section class="card">
          <h2>Sign in</h2>
          <p>Enter the lead passcode to share this phone's location as the front of the Nagar Kirtan.</p>
          <form id="lead-signin" class="lead-form" autocomplete="off">
            <label for="lead-pass">Passcode</label>
            <input id="lead-pass" name="passcode" type="password" inputmode="text" autocapitalize="none" autocorrect="off" spellcheck="false" required>
            <button class="btn-primary" type="submit">Sign in</button>
            <p class="form-error" role="alert">${lastError ? esc(lastError) : ""}</p>
          </form>
        </section>`;
    }

    function heroText() {
      if (mode === "sharing") {
        return latest
          ? ["Sharing location", "Everyone on the Nagar Kirtan tab sees this phone as the front."]
          : ["Finding GPS…", "Stay outside with a clear view of the sky."];
      }
      if (mode === "paused") return ["Paused", "The map shows the last position. Tap Resume to keep going."];
      if (mode === "ended" || server?.status === "ended") return ["Nagar Kirtan ended", "Sharing is off."];
      return ["Ready", "Tap Start sharing at the front of the Nagar Kirtan."];
    }

    function nowText() {
      if (!server || server.status === "not-started") return "No position sent yet.";
      if (server.phase === "at-park") return "At the park.";
      if (server.offRoute) return "Off the planned route.";
      if (server.turnSoon && server.nextTurn) return `Turning ${server.nextTurn.direction} onto ${server.nextTurn.onto}`;
      const next = server.nextTurn
        ? ` · next: ${server.nextTurn.direction} onto ${server.nextTurn.onto} in ${distanceText(server.nextTurn.inMeters)}`
        : "";
      return server.street ? `On ${server.street}${next}` : "On the route.";
    }

    function signedInView() {
      const [title, sub] = heroText();
      const acc = latest ? `± ${Math.round(latest.coords.accuracy)} m` : "–";
      const phase = server?.phase ?? "outbound";
      return `
        <section class="lead-hero lead-hero--${mode}">
          <div class="lead-ring"><div class="lead-core">${pinIcon}</div></div>
          <div class="lead-title">${title}</div>
          <div class="lead-sub">${sub}</div>
        </section>

        <div class="lead-stats">
          <div class="lead-stat"><span>Last sent</span><strong id="lead-sent">${lastSent ? ago(new Date(lastSent).toISOString()) : "–"}</strong></div>
          <div class="lead-stat"><span>GPS accuracy</span><strong>${acc}</strong></div>
          <div class="lead-stat"><span>Battery</span><strong>${battery != null ? `${battery}%` : "–"}</strong></div>
        </div>
        ${lastError ? `<p class="lead-error" role="alert">${esc(lastError)}</p>` : ""}

        <section class="card lead-now">
          <div class="eyebrow">What people see</div>
          <div class="lead-now-text">${esc(nowText())}</div>
          <div class="lead-phase" role="radiogroup" aria-label="Where the Nagar Kirtan is">
            ${PHASES.map(
              (p) =>
                `<button type="button" role="radio" aria-checked="${p.id === phase}" data-phase="${p.id}">${p.label}</button>`,
            ).join("")}
          </div>
          <p class="lead-hint">This changes on its own. Tap only if it's wrong.</p>
        </section>

        <div class="lead-actions">
          ${
            mode === "sharing"
              ? '<button type="button" class="btn-secondary" id="lead-pause">Pause sharing</button>'
              : `<button type="button" class="btn-kesri" id="lead-start">${mode === "paused" ? "Resume sharing" : "Start sharing"}</button>`
          }
          <button type="button" class="btn-dark" id="lead-end">End Nagar Kirtan</button>
        </div>

        <p class="lead-warn">Keep this page open and the screen on. Sharing stops if the phone locks or you switch apps. Use a power bank.</p>

        <details class="card lead-more">
          <summary>More</summary>
          <button type="button" class="btn-link" id="lead-reset">Start over (clear live position, testing only)</button>
          <button type="button" class="btn-link" id="lead-signout">Sign out of this phone</button>
        </details>`;
    }

    function draw() {
      root.innerHTML = passcode ? signedInView() : signInView();
      root.querySelector("#lead-signin")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const value = e.target.passcode.value.trim().toLowerCase();
        passcode = value;
        try {
          await call({ action: "check" });
          store.set(value);
          if (server?.status === "paused") mode = "paused";
          if (server?.status === "ended") mode = "ended";
        } catch {
          passcode = null;
          if (!lastError) lastError = "Couldn't sign in.";
        }
        draw();
      });
      root.querySelector("#lead-start")?.addEventListener("click", startSharing);
      root.querySelector("#lead-pause")?.addEventListener("click", pauseSharing);
      root.querySelector("#lead-end")?.addEventListener("click", endNagarKirtan);
      root.querySelector("#lead-reset")?.addEventListener("click", startOver);
      root.querySelector("#lead-signout")?.addEventListener("click", () => {
        stopSharing();
        passcode = null;
        store.set(null);
        mode = "idle";
        draw();
      });
      for (const b of root.querySelectorAll("[data-phase]")) {
        b.addEventListener("click", () => setPhase(b.dataset.phase));
      }
    }

    // Keep "Last sent" ticking without redrawing everything.
    tick = setInterval(() => {
      const el = root.querySelector("#lead-sent");
      if (el && lastSent) el.textContent = ago(new Date(lastSent).toISOString());
    }, 1000);

    draw();
    if (passcode) {
      call({ action: "check" })
        .then(() => {
          if (server?.status === "paused") mode = "paused";
          if (server?.status === "ended") mode = "ended";
          draw();
        })
        .catch(() => draw());
    }

    return () => {
      stopSharing();
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  },
};
