// Parking admin (/parking-admin.html): unlock with the admin PIN (Script
// property ADMIN_PIN), add passes to the Sheet, see every pass and its status,
// and download the QR code for a new pass.
import "../styles/tokens.css";
import "./parking.css";
import QRCode from "qrcode";
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
    const cats = [...new Set(passes.map((p) => p.category).filter(Boolean))];
    $("cats").innerHTML = cats.map((c) => `<option value="${esc(c)}"></option>`).join("");
    suggestId();
    draw();
  } catch (err) {
    $("list").innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function suggestId() {
  if ($("fId").value) return;
  const nums = passes.map((p) => Number(p.id)).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length) $("fId").placeholder = `Next: ${Math.max(...nums) + 1}`;
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
              <button class="btn-link" type="button" data-qr="${esc(p.id)}" style="min-height:32px; font-size:13px">QR code</button>
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

async function showAdded(p, isNew) {
  const url = await QRCode.toDataURL(p.id, { width: 600, margin: 2, errorCorrectionLevel: "M" });
  const box = $("added");
  box.innerHTML = `<div class="${isNew ? "ok-msg" : ""}" style="${isNew ? "" : "border-top:1px solid var(--divider); padding-top:12px"}">
      ${isNew ? `Pass ${esc(p.id)} added to the Sheet.` : `<span class="eyebrow">QR code for pass ${esc(p.id)}</span>`}
    </div>
    <div class="qr-out" style="margin-top:12px">
      <img src="${url}" alt="QR code for pass ${esc(p.id)}" />
      <div style="display:flex; flex-direction:column; gap:8px">
        <div class="serial">${esc(p.id)}</div>
        <div class="muted">Plate ${esc(p.plate)}${p.category ? " · " + esc(p.category) : ""}</div>
        <a class="btn" href="${url}" download="pass-${esc(p.id)}-qr.png">Download QR</a>
      </div>
    </div>`;
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showErr($("addErr"), "");
  $("added").hidden = true;
  const pass = {
    id: normId($("fId").value),
    plate: $("fPlate").value.trim().toUpperCase().replace(/\s+/g, ""),
    category: $("fCat").value.trim(),
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
