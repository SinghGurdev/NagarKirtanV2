import { icons } from "../icons.js";
import { esc, formatDate } from "../data.js";

export const home = {
  id: "home",
  label: "Home",
  title: "Nagar Kirtan",
  render(content) {
    const { event, venues } = content;
    const date = formatDate(event.date);
    return `
      <header class="page-head">
        <div>
          <h1>${esc(event.name)}</h1>
          <div class="sub">${esc(venues.gurdwara.name)} · ${esc(venues.gurdwara.address)}</div>
        </div>
      </header>

      <section class="card">
        <div class="eyebrow">${date ? esc(date) : "Date to be announced"}</div>
        <h2>Welcome</h2>
        <p>${event.welcome ? esc(event.welcome) : "Details for this year's Nagar Kirtan are on the tabs below."}</p>
      </section>

      <div class="quick-grid">
        <a class="quick-link" href="#/parade">${icons.parade(24)}Parade<span>Where it is now</span></a>
        <a class="quick-link" href="#/schedule">${icons.schedule(24)}Schedule<span>Times update live</span></a>
        <a class="quick-link" href="#/parking">${icons.parking(24)}Parking<span>Directions to the lot</span></a>
        <a class="quick-link" href="#/grounds">${icons.grounds(24)}Grounds<span>Food, restrooms, first aid</span></a>
      </div>
    `;
  },
};
