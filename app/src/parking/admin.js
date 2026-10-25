// Parking admin (/parking-admin.html): unlock with the admin PIN (Script
// property ADMIN_PIN), add passes to the Sheet, see every pass and its status,
// and download the QR code for a new pass.
import "../styles/tokens.css";
import "./parking.css";
import { passFile } from "./pass-image.js";
import { call, esc, normId, fmtTime, devRibbon } from "./api.js";

devRibbon();

const $ = (id) => document.getElementById(id);
const PIN_KEY = "parkingAdminPin";
let pin = "";
let passes = [];

function savedPin() {
  try {
    return sessionStorage.getItem(PIN_KEY) || "";
  } catch {
    return "";
  }
}
function savePin(v) {
  try {
    if (v) sessionStorage.setItem(PIN_KEY, v);
    else sessionStorage.removeItem(PIN_KEY);
  } catch {
    /* ignore */
  }
}

function showErr(el, msg) {
  el.textContent = msg;
  el.hidden = !msg;
}

async function unlock(p) {
  await call("adminCheck", { pin: p });
  pin = p;
  savePin(p);
  $("pinForm").hidden = true;
  $("main").hidden = false;
  $("lock").hidden = false;
  await load();
}

$("pinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter || $("pinForm").querySelector("button");
  btn.disabled = true;
  showErr($("pinErr"), "");
  try {
    await unlock($("pin").value.trim());
  } catch (err) {
    showErr($("pinErr"), err.message);
  } finally {
    btn.disabled = false;
  }
});

$("lock").addEventListener("click", () => {
  pin = "";
  savePin("");
  location.reload();
});

async function load() {
  try {
    const r = await call("adminList", { pin });
    passes = r.passes;
    $("total").textContent = String(passes.length);
    $("inside").textContent = String(r.insideCount);
    fillCategories();
    suggestId();
    draw();
  } catch (err) {
    $("list").innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

// Category is a real dropdown (phones ignore <datalist>): the categories
// already in the Sheet, Sevadar first, plus "Other…" for a new one.
function fillCategories() {
  const sel = $("fCat");
  const keep = sel.value;
  const seen = new Map();
  for (const p of passes) {
    const c = String(p.category || "").trim();
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  if (!seen.has("sevadar")) seen.set("sevadar", "Sevadar");
  const cats = [...seen.values()].sort((a, b) => (a.toLowerCase() === "sevadar" ? -1 : b.toLowerCase() === "sevadar" ? 1 : a.localeCompare(b)));
  sel.innerHTML = cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("") + '<option value="__other">Other…</option>';
  sel.value = keep && [...sel.options].some((o) => o.value === keep) ? keep : cats[0];
  $("fCatOtherWrap").hidden = sel.value !== "__other";
}
$("fCat").addEventListener("change", () => {
  const other = $("fCat").value === "__other";
  $("fCatOtherWrap").hidden = !other;
  if (other) $("fCatOther").focus();
});
function categoryValue() {
  return $("fCat").value === "__other" ? $("fCatOther").value.trim() : $("fCat").value;
}

// Fill in the next Pass ID (highest number in the Sheet + 1); still editable.
function suggestId(force) {
  if ($("fId").value && !force) return;
  const nums = passes.map((p) => Number(p.id)).filter((n) => Number.isFinite(n) && n > 0);
  $("fId").value = nums.length ? String(Math.max(...nums) + 1) : "";
}

function statusChip(p) {
  if (p.inside) return `<span class="chip in">Inside since ${esc(fmtTime(p.checkIn))}</span>`;
  if (p.checkOut) return `<span class="chip">Left ${esc(fmtTime(p.checkOut))}</span>`;
  return '<span class="chip">Not arrived</span>';
}

function draw() {
  const q = $("q").value.trim().toUpperCase();
  const list = q
    ? passes.filter((p) => [p.id, p.plate, p.phone, p.category].some((v) => String(v || "").toUpperCase().includes(q)))
    : passes;
  $("list").innerHTML = list.length
    ? list
        .map(
          (p) => `<div class="r">
            <div style="min-width:0">
              <div class="id">${esc(p.id)} <span style="font-weight:600; color: var(--text-2)">· ${esc(p.plate || "—")}</span></div>
              <div class="muted">${esc([p.category, p.phone].filter(Boolean).join(" · ") || "—")}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px">
              ${statusChip(p)}
              <button class="btn-link" type="button" data-qr="${esc(p.id)}" style="min-height:32px; font-size:13px">Pass</button>
            </div>
          </div>`,
        )
        .join("")
    : `<div class="empty">${q ? "No passes match." : "No passes yet."}</div>`;
}

$("q").addEventListener("input", draw);
$("refresh").addEventListener("click", load);
$("list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-qr]");
  if (!b) return;
  const p = passes.find((x) => x.id === b.dataset.qr);
  if (p) showAdded(p, false);
});

let lastUrl = "";

function shareText(p) {
  return `Nagar Kirtan 2026 ${p.category ? p.category.toLowerCase() + " " : ""}parking pass #${p.id} (plate ${p.plate}). Please show this pass at the parking entrance.`;
}

async function showAdded(p, isNew) {
  const box = $("added");
  box.innerHTML = '<p class="muted">Making the pass…</p>';
  box.hidden = false;
  // Made before the tap so the share sheet opens straight away (phones only
  // allow sharing directly from a tap).
  const { file, url } = await passFile(p);
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = url;
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  box.innerHTML = `<div class="${isNew ? "ok-msg" : ""}" style="${isNew ? "" : "border-top:1px solid var(--divider); padding-top:12px"}">
      ${isNew ? `Pass ${esc(p.id)} added to the Sheet.` : `<span class="eyebrow">Parking pass ${esc(p.id)}</span>`}
    </div>
    <div class="pass-out">
      <img src="${url}" alt="Parking pass ${esc(p.id)} for plate ${esc(p.plate)}" />
      <div class="pass-actions">
        ${canShare ? `<button class="btn btn-primary" type="button" id="sharePass"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>SHARE PASS</button>` : ""}
        <a class="btn" href="${url}" download="${esc(file.name)}">Download pass</a>
        ${canShare ? "" : '<p class="muted" style="margin:0">Sharing works from a phone. On a computer, download the pass and send it.</p>'}
      </div>
    </div>`;
  const btn = $("sharePass");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.share({ files: [file], title: `Parking pass ${p.id}`, text: shareText(p) });
      } catch (err) {
        if (err && err.name !== "AbortError") showErr($("addErr"), "Couldn't open sharing. Use Download pass instead.");
      }
    });
  }
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showErr($("addErr"), "");
  $("added").hidden = true;
  const pass = {
    id: normId($("fId").value),
    plate: $("fPlate").value.trim().toUpperCase().replace(/\s+/g, ""),
    category: categoryValue(),
    phone: $("fPhone").value.trim(),
    notes: $("fNotes").value.trim(),
  };
  if (!pass.id) return showErr($("addErr"), "Enter a Pass ID.");
  if (!pass.plate) return showErr($("addErr"), "Enter the license plate.");
  if (passes.some((p) => p.id === pass.id)) return showErr($("addErr"), `Pass ID ${pass.id} already exists.`);
  $("addBtn").disabled = true;
  $("addBtn").textContent = "ADDING…";
  try {
    const r = await call("adminAdd", { pin, pass });
    $("fId").value = "";
    $("fPlate").value = "";
    $("fPhone").value = "";
    $("fNotes").value = "";
    await load();
    await showAdded(r.pass, true);
  } catch (err) {
    showErr($("addErr"), err.message);
  } finally {
    $("addBtn").disabled = false;
    $("addBtn").textContent = "ADD PASS";
  }
});

// Stay unlocked for this browser tab.
const p0 = savedPin();
if (p0) unlock(p0).catch(() => savePin(""));
