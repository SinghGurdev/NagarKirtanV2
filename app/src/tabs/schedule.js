import { esc, formatTime, formatDate } from "../data.js";
import { pollLive, ago, clock } from "../live-data.js";

// Schedule: planned times, and on the day the Nagar Kirtan events switch to
// the live estimate (or "Done" with the actual time once they happen).

const SHIFT_MS = 2 * 60 * 1000; // only show a new time when it moved 2+ min
const isLive = (s) => s && s.status !== "not-started";

/** Planned clock time for "HH:MM" on the event day, as epoch ms. */
function plannedMs(content, hhmm) {
  const { date, timezone } = content.event;
  if (!date || !hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const guess = Date.UTC(...date.split("-").map((n, i) => (i === 1 ? n - 1 : +n)), h, m);
  // Shift by the zone's offset at that moment.
  const asZone = new Date(new Date(guess).toLocaleString("en-US", { timeZone: timezone }));
  const asUtc = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }));
  return guess - (asZone - asUtc);
}

function timeCell(ev, content, s) {
  const tz = content.event.timezone;
  const planned = formatTime(ev.time);
  const end = ev.endTime ? `<span class="ev-end">to ${formatTime(ev.endTime)}</span>` : "";
  if (!ev.followsParade || !isLive(s)) return `${planned}${end}`;

  const actual = s.actual?.[ev.id];
  if (actual) return `${clock(actual, tz)}<span class="ev-end ev-end--done">Done</span>`;

  const eta = s.eta?.[ev.id];
  const plan = plannedMs(content, ev.time);
  if (eta && plan != null && Math.abs(Date.parse(eta) - plan) >= SHIFT_MS) {
    return `<span class="ev-new">${clock(eta, tz)}</span><s class="ev-was">${planned}</s>`;
  }
  return `${planned}${end}`;
}

function rowsHtml(content, s) {
  const items = content.schedule;
  return items
    .map((ev, i) => {
      const venue = content.venues[ev.venue];
      const last = i === items.length - 1;
      const done = ev.followsParade && s?.actual?.[ev.id];
      const tag = ev.followsParade
        ? `<span class="ev-tag ev-tag--live">${isLive(s) ? (done ? "Happened" : "Live estimate") : "Updates with the Nagar Kirtan"}</span>`
        : '<span class="ev-tag">Set time</span>';
      return `
        <li class="ev${ev.followsParade ? " ev--parade" : ""}${done ? " ev--done" : ""}${last ? " ev--last" : ""}">
          <span class="ev-rail" aria-hidden="true"><span class="ev-dot${last ? " ev-dot--end" : ""}"></span></span>
          <div class="ev-main">
            <div class="ev-title">${esc(ev.title)}</div>
            <div class="ev-where">${esc(venue?.name ?? ev.venue)}</div>
            ${tag}
          </div>
          <div class="ev-time">${timeCell(ev, content, s)}</div>
        </li>`;
    })
    .join("");
}

export const schedule = {
  id: "schedule",
  label: "Schedule",
  title: "Schedule",
  render(content) {
    const date = formatDate(content.event.date);
    return `
      <header class="page-head">
        <div>
          <h1>Schedule</h1>
          <div class="sub">${date ? esc(date) : "Planned times"}</div>
          <div class="sub sched-live" id="sched-live" hidden></div>
        </div>
      </header>
      <section class="card">
        <ol class="timeline" id="sched-rows">${rowsHtml(content, null)}</ol>
      </section>
      <p class="footnote">Nagar Kirtan times adjust live on the day as it moves.</p>
    `;
  },

  mount(view, content) {
    const rows = view.querySelector("#sched-rows");
    const liveEl = view.querySelector("#sched-live");
    let state = null;
    const showUpdated = () => {
      const on = state && (state.status === "live" || state.status === "paused");
      liveEl.hidden = !on;
      if (on) liveEl.innerHTML = `<span class="badge-live badge-live--small">LIVE</span> Updated ${ago(state.updatedAt)}`;
    };
    const stop = pollLive((s) => {
      state = s;
      rows.innerHTML = rowsHtml(content, s);
      showUpdated();
    });
    const tick = setInterval(showUpdated, 1000);
    return () => {
      stop();
      clearInterval(tick);
    };
  },
};
