import { esc, formatTime, formatDate } from "../data.js";

// Step 2: planned times only. Step 10 adds the live "Now" marker and
// shifts the parade events' times as the parade moves.
export const schedule = {
  id: "schedule",
  label: "Schedule",
  title: "Schedule",
  render(content) {
    const date = formatDate(content.event.date);
    const items = content.schedule;
    const rows = items
      .map((ev, i) => {
        const venue = content.venues[ev.venue];
        const last = i === items.length - 1;
        const tag = ev.followsParade
          ? '<span class="ev-tag ev-tag--live">Updates with the parade</span>'
          : '<span class="ev-tag">Set time</span>';
        return `
          <li class="ev${ev.followsParade ? " ev--parade" : ""}${last ? " ev--last" : ""}">
            <span class="ev-rail" aria-hidden="true"><span class="ev-dot${last ? " ev-dot--end" : ""}"></span></span>
            <div class="ev-main">
              <div class="ev-title">${esc(ev.title)}</div>
              <div class="ev-where">${esc(venue?.name ?? ev.venue)}</div>
              ${tag}
            </div>
            <div class="ev-time">${formatTime(ev.time)}</div>
          </li>`;
      })
      .join("");

    return `
      <header class="page-head">
        <div>
          <h1>Schedule</h1>
          <div class="sub">${date ? esc(date) : "Planned times"}</div>
        </div>
      </header>
      <section class="card">
        <ol class="timeline">${rows}</ol>
      </section>
      <p class="footnote">Parade times will adjust live on the day as the parade moves.</p>
    `;
  },
};
