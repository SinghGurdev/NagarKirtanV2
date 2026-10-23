// Loads the event content. Admins will edit this file through the app later,
// so every string from it goes through esc() before it reaches the page.

export async function loadContent() {
  const res = await fetch("/data/content.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`content.json: HTTP ${res.status}`);
  return res.json();
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** "13:00" -> "1:00 PM" */
export function formatTime(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  if (Number.isNaN(h)) return esc(hhmm);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

/** "2026-11-15" -> "Sunday, November 15, 2026" (null when no date set). */
export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Directions link: Apple Maps on iPhone/iPad, Google Maps everywhere else. */
export function directionsUrl(lat, lng) {
  const ua = navigator.userAgent;
  const isApple = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isApple
    ? `https://maps.apple.com/?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
