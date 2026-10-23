import { icons } from "../icons.js";
import { esc, formatDate } from "../data.js";

// Home banner follows the event poster: royal blue, gold Gurmukhi title,
// date pill and the dedication line. All wording comes from content.json.
export const home = {
  id: "home",
  label: "Home",
  title: "Nagar Kirtan",
  render(content) {
    const { event, venues } = content;
    const g = venues.gurdwara;
    const date = formatDate(event.date);
    return `
      <header class="hero">
        ${event.dedicationPa ? `<div class="hero-dedication" lang="pa">${esc(event.dedicationPa)}</div>` : ""}
        <div class="hero-inner">
          <h1 class="hero-title" lang="pa">${esc(event.titlePa || event.name)}</h1>
          ${event.subtitlePa ? `<div class="hero-subtitle-pa" lang="pa">${esc(event.subtitlePa)}</div>` : ""}
          <div class="hero-subtitle">${esc(event.subtitle || event.name)}</div>
          <div class="hero-date">
            ${event.datePa ? `<span lang="pa">${esc(event.datePa)}</span>` : ""}
            <small>${date ? esc(date) : "Date to be announced"}</small>
          </div>
          <div class="hero-place">
            ${g.namePa ? `<span lang="pa">${esc(g.namePa)}</span>` : esc(g.name)}
            <small>${esc(g.name)} · ${esc(g.address)}</small>
          </div>
        </div>
      </header>

      ${
        event.welcome
          ? `<section class="card"><h2>Welcome</h2><p>${esc(event.welcome)}</p></section>`
          : ""
      }

      <div class="quick-grid">
        <a class="quick-link" href="#/parade">${icons.parade(24)}Nagar Kirtan<span>Where it is now</span></a>
        <a class="quick-link" href="#/schedule">${icons.schedule(24)}Schedule<span>Times update live</span></a>
        <a class="quick-link" href="#/parking">${icons.parking(24)}Parking<span>Directions to the lot</span></a>
        <a class="quick-link" href="#/grounds">${icons.grounds(24)}Grounds<span>Food, restrooms, first aid</span></a>
      </div>
    `;
  },
};
