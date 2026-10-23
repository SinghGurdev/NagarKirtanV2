import { icons } from "../icons.js";
import { esc, formatDate } from "../data.js";

// Home follows the event poster: royal-blue banner with the sangat photo,
// gold Gurmukhi title and date, then the poster's announcements, guests,
// invitation and contacts. All wording and images come from content.json.

function hero(event, g) {
  const date = formatDate(event.date);
  return `
    <header class="hero">
      ${event.dedicationPa ? `<div class="hero-dedication" lang="pa">${esc(event.dedicationPa)}</div>` : ""}
      ${
        event.heroImage
          ? `<div class="hero-photo"><img src="${esc(event.heroImage)}" alt="Sangat gathered around the Palki Sahib at a past Nagar Kirtan" width="1333" height="249" fetchpriority="high"></div>`
          : ""
      }
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
          ${g.notePa ? `<span class="hero-note" lang="pa">${esc(g.notePa)}</span>` : ""}
          <small>${esc(g.name)} · ${esc(g.address)}</small>
        </div>
      </div>
    </header>`;
}

function announcements(list = []) {
  if (!list.length) return "";
  return `
    <h2 class="section-title">Program</h2>
    <ul class="announce-list">
      ${list
        .map(
          (a) => `
        <li class="announce card">
          <div class="date-tile" aria-hidden="true">
            <span class="date-tile-month">${esc(a.month)}</span>
            <span class="date-tile-day">${esc(a.days)}</span>
            ${a.dayName ? `<span class="date-tile-dow">${esc(a.dayName)}</span>` : ""}
          </div>
          <div class="announce-body">
            <div class="announce-pa" lang="pa">${esc(a.titlePa)}</div>
            <div class="announce-title">${esc(a.title)}</div>
            <div class="announce-when">${esc(a.when)}</div>
          </div>
        </li>`,
        )
        .join("")}
    </ul>`;
}

function featured(list = []) {
  return list
    .map(
      (f) => `
    <section class="feature card${f.program?.length ? " feature--wide" : ""}">
      <img class="feature-photo" src="${esc(f.image)}" alt="${esc(f.name)}" loading="lazy">
      <div class="feature-body">
        <div class="feature-name-pa" lang="pa">${esc(f.namePa)}</div>
        <div class="feature-name">${esc(f.name)}</div>
        ${(f.linesPa || []).map((l) => `<div class="feature-line" lang="pa">${esc(l)}</div>`).join("")}
        ${
          f.program?.length
            ? `<ul class="feature-program">${f.program.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
            : ""
        }
      </div>
    </section>`,
    )
    .join("");
}

function contacts(list = []) {
  if (!list.length) return "";
  return `
    <h2 class="section-title">For more information</h2>
    <ul class="contacts card">
      ${list
        .map(
          (c) => `
        <li>
          <a class="contact" href="tel:${esc(c.phone.replace(/[^0-9+]/g, ""))}">
            <span class="contact-name">${esc(c.name)}</span>
            <span class="contact-phone">${esc(c.phone)}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>
          </a>
        </li>`,
        )
        .join("")}
    </ul>`;
}

export const home = {
  id: "home",
  label: "Home",
  title: "Nagar Kirtan",
  render(content) {
    const { event, venues } = content;
    return `
      ${hero(event, venues.gurdwara)}

      ${event.welcome ? `<section class="card"><h2>Welcome</h2><p>${esc(event.welcome)}</p></section>` : ""}

      <div class="quick-grid">
        <a class="quick-link" href="#/parade">${icons.parade(24)}Nagar Kirtan<span>Where it is now</span></a>
        <a class="quick-link" href="#/schedule">${icons.schedule(24)}Schedule<span>Sunday's times</span></a>
        <a class="quick-link" href="#/parking">${icons.parking(24)}Parking<span>Directions and trolley</span></a>
        <a class="quick-link" href="#/grounds">${icons.grounds(24)}Grounds<span>Food, restrooms, first aid</span></a>
      </div>

      ${announcements(content.announcements)}
      ${featured(content.featured)}
      ${event.invitationPa ? `<p class="invitation" lang="pa">${esc(event.invitationPa)}</p>` : ""}
      ${contacts(content.contacts)}
    `;
  },
};
