import { esc, directionsUrl } from "../data.js";
import { createMap, pin } from "../map.js";

// Parking: map with the lot and the Gurdwara, then details and directions.
export const parking = {
  id: "parking",
  label: "Parking",
  title: "Parking",
  render(content) {
    const p = content.parking;
    const g = content.venues.gurdwara;
    return `
      <div class="map-hero">
        <div class="map-canvas" id="parking-map" aria-label="Map of the parking lot and ${esc(g.name)}" role="region"></div>
        <div class="map-title"><h1>Parking</h1></div>
        <button class="map-btn" type="button" id="parking-fit" aria-label="Show the parking lot and the Gurdwara">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
        </button>
      </div>

      <section class="card sheet">
        <h2>${esc(p.name || "Nagar Kirtan parking")}</h2>
        <p>Parking for ${esc(g.name)}</p>
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

  mount(view, content) {
    const p = content.parking;
    const g = content.venues.gurdwara;
    const el = view.querySelector("#parking-map");
    let handle = null;
    let gone = false;

    const points = [[p.lng, p.lat]];
    if (g.lat && g.lng) points.push([g.lng, g.lat]);

    createMap(el, { fit: points, padding: { top: 150, bottom: 70, left: 70, right: 70 } })
      .then((h) => {
        if (!h || gone) return h?.destroy();
        handle = h;
        const { lib, map } = h;
        pin(lib, {
          className: "map-pin--parking",
          html: '<span class="pin-p">P</span>',
          label: "Parking lot",
          anchor: "center",
        })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        if (g.lat && g.lng) {
          pin(lib, {
            className: "map-pin--place",
            html: `<span class="pin-label">${esc(g.namePa || g.name)}</span>`,
            label: g.name,
          })
            .setLngLat([g.lng, g.lat])
            .addTo(map);
        }
        view.querySelector("#parking-fit")?.addEventListener("click", () => h.frame());
      })
      .catch(() => {
        el.classList.add("map-canvas--error");
        el.textContent = "The map couldn't load. Get directions still works.";
      });

    return () => {
      gone = true;
      handle?.destroy();
    };
  },
};
