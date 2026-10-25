// Sevadar parking scanner (/parking.html). An attendant picks Entry or Exit,
// scans the QR code on a pass (it holds the Pass ID), and the Sheet script
// checks the pass in or out. Entry shows the plate on file first so the
// attendant can match it to the car.
import "../styles/tokens.css";
import "./parking.css";
import { call, esc, normId, fmtTime, fmtDuration, devRibbon } from "./api.js";
import { createReader } from "./qr-reader.js";

devRibbon();

const $ = (id) => document.getElementById(id);
const panel = $("panel");
const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

const state = {
  mode: store.get("parkingMode", "entry") === "exit" ? "exit" : "entry",
  gate: store.get("parkingGate", "Gate 1"),
  busy: false,
  lastHandled: { id: "", at: 0 },
  autoTimer: 0,
};

const I = {
  check: '<svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
  out: '<svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16 12H8M11 8.5L7.5 12l3.5 3.5"/></svg>',
  warn: '<svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  x: '<svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  tick: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
};

// ---- Camera ---------------------------------------------------------------

const reader = createReader($("video"), onScan);

async function startCamera() {
  $("camMsg").hidden = true;
  try {
    await reader.start();
  } catch (err) {
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    $("camMsgText").textContent = denied
      ? "Camera permission is off. Allow camera for this site in the browser settings, then tap below."
      : err?.message || "Couldn't start the camera.";
    $("camMsg").hidden = false;
  }
}
$("camStart").addEventListener("click", startCamera);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) reader.stop();
  else if (panel.hidden) startCamera();
});

// ---- Header, mode, gate ---------------------------------------------------

function renderMode() {
  document.body.classList.toggle("exit-mode", state.mode === "exit");
  for (const b of document.querySelectorAll(".mode button")) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
  $("camTag").textContent = state.mode === "entry" ? "SCANNING FOR ENTRY" : "SCANNING FOR EXIT";
}
for (const b of document.querySelectorAll(".mode button")) {
  b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    store.set("parkingMode", state.mode);
    renderMode();
  });
}

function renderGate() {
  $("gate").textContent = state.gate;
}
$("gate").addEventListener("click", () => {
  const v = window.prompt("Name this gate (shown in the Scan Log):", state.gate);
  if (v && v.trim()) {
    state.gate = v.trim().slice(0, 30);
    store.set("parkingGate", state.gate);
    renderGate();
  }
});

function setNet(ok, text) {
  const n = $("net");
  n.textContent = text || (ok ? "Online" : "Offline");
  n.classList.toggle("off", !ok);
}

function setCount(n) {
  if (typeof n === "number") $("insideCount").textContent = String(n);
}

function setLast(id, what) {
  $("lastId").textContent = id;
  $("lastWhat").textContent = `${what} · ${fmtTime(new Date().toISOString())}`;
}

async function refreshCount() {
  try {
    const r = await call("inside");
    setCount(r.insideCount);
    setNet(true);
    return r;
  } catch (err) {
    setNet(false, /set up/i.test(err.message) ? "Not set up" : "Offline");
    return null;
  }
}

// ---- Busy -----------------------------------------------------------------

async function withBusy(text, fn) {
  state.busy = true;
  $("busyText").textContent = text;
  $("busy").hidden = false;
  try {
    return await fn();
  } finally {
    $("busy").hidden = true;
    state.busy = false;
  }
}

// ---- Scan handling --------------------------------------------------------

function onScan(raw) {
  if (state.busy || !panel.hidden) return;
  const id = normId(raw);
  if (!id) return;
  const now = Date.now();
  // The same pass stays in front of the camera for a moment after a result.
  if (id === state.lastHandled.id && now - state.lastHandled.at < 4000) return;
  state.lastHandled = { id, at: now };
  reader.pause();
  process(id, state.mode);
}

async function process(id, mode) {
  try {
    if (mode === "entry") {
      const r = await withBusy("Checking pass…", () => call("lookup", { passId: id }));
      setNet(true);
      setCount(r.insideCount);
      if (!r.found) return showResult("notFound", { id, mode });
      if (r.pass.inside) return showResult("alreadyInside", { pass: r.pass, insideCount: r.insideCount });
      return showConfirm(r.pass, false);
    }
    return await doCheckout(id);
  } catch (err) {
    showError(err, () => process(id, mode));
  }
}

async function doCheckin(pass, force) {
  try {
    const r = await withBusy("Checking in…", () => call("checkin", { passId: pass.id, gate: state.gate, force }));
    setNet(true);
    setCount(r.insideCount);
    if (r.result === "checkedIn") {
      setLast(r.pass.id, "In");
      return showResult("checkedIn", r);
    }
    if (r.result === "alreadyInside") return showResult("alreadyInside", r);
    return showResult("notFound", { id: pass.id, mode: "entry" });
  } catch (err) {
    showError(err, () => doCheckin(pass, force));
  }
}

async function doCheckout(id) {
  try {
    const r = await withBusy("Checking out…", () => call("checkout", { passId: id, gate: state.gate }));
    setNet(true);
    setCount(r.insideCount);
    if (r.result === "checkedOut") {
      setLast(r.pass.id, "Out");
      return showResult("checkedOut", r);
    }
    if (r.result === "notInside") return showResult("notInside", r);
    return showResult("notFound", { id, mode: "exit" });
  } catch (err) {
    showError(err, () => doCheckout(id));
  }
}

async function doUndo(r) {
  try {
    const u = await withBusy("Undoing…", () => call("undo", { passId: r.pass.id, before: r.before, gate: state.gate }));
    setCount(u.insideCount);
    setLast(r.pass.id, "Undone");
    closePanel();
  } catch (err) {
    showError(err, () => doUndo(r));
  }
}

// ---- Panels ---------------------------------------------------------------

function openPanel(html, handlers = {}) {
  clearAuto();
  panel.innerHTML = html;
  panel.hidden = false;
  panel.scrollTop = 0;
  panel.onclick = (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const fn = handlers[btn.dataset.act];
    if (fn) {
      clearAuto();
      fn(btn);
    }
  };
}

function closePanel() {
  clearAuto();
  panel.hidden = true;
  panel.innerHTML = "";
  state.lastHandled.at = Date.now(); // ignore the pass still in view
  if (!document.hidden) {
    if (reader.active) reader.resume();
    else startCamera();
  }
}

function clearAuto() {
  clearInterval(state.autoTimer);
  state.autoTimer = 0;
}

function autoReturn(seconds) {
  let left = seconds;
  const el = panel.querySelector("[data-countdown]");
  state.autoTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) return closePanel();
    if (el) el.textContent = `Back to scanner in ${left} s`;
  }, 1000);
}

function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

const fact = (label, value) => `<div><span>${esc(label)}</span><span>${esc(value || "—")}</span></div>`;
const tag = (mode) => (mode === "exit" ? '<span class="tag exit">EXIT</span>' : '<span class="tag">ENTRY</span>');
const notes = (p) => (p && p.notes ? `<div class="note"><strong>Note:</strong> ${esc(p.notes)}</div>` : "");

function showConfirm(pass, force) {
  openPanel(
    `<div class="panel-inner">
      <div class="confirm-head">
        <span class="tag" style="background: var(--entry); color: #fff">ENTRY</span>
        <span class="muted">Pass <strong style="color: var(--text)">${esc(pass.id)}</strong></span>
      </div>
      <div>
        <h1 class="confirm-title">Check the plate</h1>
        <p class="muted" style="font-size: 17px; margin: 6px 0 0">Does the car's license plate match this pass?</p>
      </div>
      <div class="card plate-card">
        <span class="eyebrow">Plate on file</span>
        <div class="plate"><small>CALIFORNIA</small><b>${esc(pass.plate || "—")}</b></div>
        <div class="facts">${fact("Pass #", pass.id)}${fact("Pass type", pass.category)}</div>
        ${notes(pass)}
      </div>
      ${force ? '<p class="muted">This pass was still marked inside. Confirming closes the old visit and checks it in again.</p>' : ""}
      <div class="spacer"></div>
      <button class="btn btn-primary" type="button" data-act="yes" style="min-height: 64px">${I.tick}YES, MATCHES — CHECK IN</button>
      <button class="btn" type="button" data-act="cancel">Cancel and rescan</button>
    </div>`,
    {
      yes: () => doCheckin(pass, force),
      cancel: closePanel,
    },
  );
  buzz(60);
}

function showResult(kind, r) {
  const p = r.pass || {};
  let html = "";
  const handlers = { next: closePanel };
  if (kind === "checkedIn") {
    html = `<div class="banner in">${tag("entry")}${I.check}<span class="word">CHECKED IN</span><span class="say">Let them through</span></div>
      <div class="panel-inner"><div class="card">
        <span class="eyebrow">Pass #</span><div class="serial">${esc(p.id)}</div>
        <div class="facts">${fact("Time in", fmtTime(p.checkIn))}${fact("Gate", state.gate)}${fact("Plate", p.plate)}${fact("Inside now", String(r.insideCount))}</div>
        ${notes(p)}
      </div><div class="spacer"></div>
      <p class="muted" style="text-align:center" data-countdown>Back to scanner in 3 s</p>
      <button class="btn btn-primary" type="button" data-act="next">SCAN NEXT</button>
      <button class="btn-link" type="button" data-act="undo">Undo this check-in</button></div>`;
    handlers.undo = () => doUndo(r);
    buzz(120);
  } else if (kind === "checkedOut") {
    html = `<div class="banner out">${tag("exit")}${I.out}<span class="word">CHECKED OUT</span><span class="say">Safe travels</span></div>
      <div class="panel-inner"><div class="card">
        <span class="eyebrow">Pass #</span><div class="serial">${esc(p.id)}</div>
        <div class="facts">${fact("Time in", fmtTime(p.checkIn))}${fact("Time out", fmtTime(p.checkOut))}${fact("Plate", p.plate)}${fact("Inside now", String(r.insideCount))}</div>
      </div><div class="spacer"></div>
      <p class="muted" style="text-align:center" data-countdown>Back to scanner in 3 s</p>
      <button class="btn btn-primary" type="button" data-act="next">SCAN NEXT</button>
      <button class="btn-link" type="button" data-act="undo">Undo this check-out</button></div>`;
    handlers.undo = () => doUndo(r);
    buzz(120);
  } else if (kind === "alreadyInside") {
    html = `<div class="banner warn">${tag("entry")}${I.warn}<span class="word">ALREADY INSIDE</span><span class="say">This pass hasn't checked out. Don't let it in.</span></div>
      <div class="panel-inner"><div class="card">
        <span class="eyebrow">Pass #</span><div class="serial">${esc(p.id)}</div>
        <div class="facts">${fact("Checked in", fmtTime(p.checkIn))}${fact("Inside for", fmtDuration(p.checkIn))}${fact("Plate", p.plate)}${fact("Pass type", p.category)}</div>
        ${notes(p)}
      </div><div class="spacer"></div>
      <button class="btn btn-primary" type="button" data-act="next">SCAN NEXT</button>
      <button class="btn" type="button" data-act="fix">Missed checkout — fix and check in</button></div>`;
    handlers.fix = () => showConfirm(p, true);
    buzz([80, 80, 80]);
  } else if (kind === "notInside") {
    html = `<div class="banner warn">${tag("exit")}${I.warn}<span class="word">NOT CHECKED IN</span><span class="say">This pass isn't marked inside.</span></div>
      <div class="panel-inner"><div class="card">
        <span class="eyebrow">Pass #</span><div class="serial">${esc(p.id)}</div>
        <div class="facts">${fact("Plate", p.plate)}${fact("Last out", fmtTime(p.checkOut))}</div>
        <p class="muted" style="margin: 12px 0 0">Nothing to do. Let them leave; the entry scan may have been missed.</p>
      </div><div class="spacer"></div>
      <button class="btn btn-primary" type="button" data-act="next">SCAN NEXT</button></div>`;
    buzz([80, 80, 80]);
  } else {
    html = `<div class="banner bad">${tag(r.mode)}${I.x}<span class="word">NOT A VALID PASS</span><span class="say">This pass # isn't on the pass list</span></div>
      <div class="panel-inner"><div class="card">
        <span class="eyebrow">Scanned value</span><div class="serial">${esc(r.id)}</div>
        <p class="muted" style="margin: 12px 0 0; border-top: 1px solid var(--divider); padding-top: 12px">Check the pass by eye. If it looks real, call a supervisor — it may not be in the Sheet yet.</p>
      </div><div class="spacer"></div>
      <button class="btn btn-primary" type="button" data-act="next">SCAN NEXT</button>
      <button class="btn" type="button" data-act="retype">Re-type pass #</button></div>`;
    handlers.retype = () => showList(true);
    buzz([200, 100, 200]);
  }
  openPanel(html, handlers);
  if (kind === "checkedIn" || kind === "checkedOut") autoReturn(3);
}

function showError(err, retry) {
  setNet(false, /set up/i.test(err.message) ? "Not set up" : "Offline");
  openPanel(
    `<div class="banner bad">${I.warn}<span class="word">COULDN'T CHECK</span><span class="say">${esc(err.message)}</span></div>
     <div class="panel-inner"><div class="spacer"></div>
     <button class="btn btn-primary" type="button" data-act="retry">TRY AGAIN</button>
     <button class="btn" type="button" data-act="next">Back to scanner</button></div>`,
    { retry, next: closePanel },
  );
  buzz([200, 100, 200]);
}

// ---- Inside list + typed pass # ------------------------------------------

async function showList(focusType) {
  reader.pause();
  const verb = state.mode === "entry" ? "Check in" : "Check out";
  openPanel(
    `<div class="panel-inner">
      <div class="list-head">
        <button class="icon-btn" type="button" data-act="back" aria-label="Back to scanner">${I.back}</button>
        <h1>Inside now · <span id="lcount">…</span></h1>
      </div>
      <form class="card" id="typeForm">
        <label class="eyebrow" for="typeId">Type a pass # (QR won't scan)</label>
        <div class="inline">
          <input class="input" id="typeId" inputmode="numeric" autocomplete="off" placeholder="Pass #" style="font-weight:700; font-variant-numeric: tabular-nums" />
          <button class="btn btn-primary" type="submit" style="min-height:52px; font-size:16px; background:${state.mode === "entry" ? "var(--entry)" : "var(--exit)"}; color:${state.mode === "entry" ? "#fff" : "#161b33"}">${verb}</button>
        </div>
        <p class="muted" style="margin:8px 0 0">Uses the current mode (${state.mode === "entry" ? "Entry" : "Exit"}). Same checks as a scan.</p>
      </form>
      <div>
        <label class="eyebrow" for="search">Search who's inside</label>
        <input class="input" id="search" type="search" autocomplete="off" placeholder="Pass # or plate" />
      </div>
      <div class="card rows" id="rows"><div class="empty">Loading…</div></div>
    </div>`,
    {
      back: closePanel,
      out: (btn) => doCheckout(btn.dataset.id),
    },
  );
  $("typeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = normId($("typeId").value);
    if (!id) return $("typeId").focus();
    $("typeId").blur();
    state.lastHandled = { id, at: Date.now() };
    process(id, state.mode);
  });
  if (focusType) $("typeId").focus();

  let all = [];
  const draw = () => {
    const q = $("search")?.value.trim().toUpperCase() || "";
    const list = q ? all.filter((p) => p.id.includes(q) || p.plate.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) : all;
    const rows = $("rows");
    if (!rows) return;
    rows.innerHTML = list.length
      ? list
          .map(
            (p) => `<div class="r"><div><div class="id">${esc(p.id)}</div><div class="muted">${esc(p.plate || "—")} · In ${esc(fmtTime(p.checkIn))}</div></div>
            <button class="btn btn-sm" type="button" data-act="out" data-id="${esc(p.id)}">Check out</button></div>`,
          )
          .join("")
      : `<div class="empty">${q ? "No match inside." : "Nobody is checked in."}</div>`;
  };
  $("search").addEventListener("input", draw);
  try {
    const r = await call("inside");
    setNet(true);
    setCount(r.insideCount);
    all = r.passes;
    if ($("lcount")) $("lcount").textContent = String(r.insideCount);
    draw();
  } catch (err) {
    if ($("rows")) $("rows").innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    if ($("lcount")) $("lcount").textContent = "?";
  }
}

$("openType").addEventListener("click", () => showList(true));
$("openList").addEventListener("click", () => showList(false));

// ---- Start ----------------------------------------------------------------

renderMode();
renderGate();
startCamera();
refreshCount();
setInterval(() => {
  if (panel.hidden && !document.hidden) refreshCount();
}, 30000);
