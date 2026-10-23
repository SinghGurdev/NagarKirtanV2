import { esc, directionsUrl } from "../data.js";

// Step 2: details and directions. Steps 3-4 add the map above them.
export const parking = {
  id: "parking",
  label: "Parking",
  title: "Parking",
  render(content) {
    const p = content.parking;
    const gurdwara = content.venues.gurdwara;
    return `
      <header class="page-head">
        <div><h1>Parking</h1></div>
      </header>
      <section class="card">
        <h2>${esc(p.name || "Nagar Kirtan parking")}</h2>
        <p>Parking for ${esc(gurdwara.name)}</p>
        <div class="details${p.details ? "" : " details--empty"}">${
          p.details ? esc(p.details) : "Parking details coming soon."
        }</div>
        <a class="btn-primary" href="${directionsUrl(p.lat, p.lng)}" target="_blank" rel="noopener">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8z"/></svg>
          Get directions
        </a>
        <p class="btn-note">Opens Apple Maps on iPhone, Google Maps on Android</p>
      </section>
    `;
  },
};
