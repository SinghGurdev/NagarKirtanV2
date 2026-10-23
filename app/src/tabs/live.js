import { esc, formatTime } from "../data.js";
import { createMap, pin, token } from "../map.js";

// Nagar Kirtan tab: the route on a real map with the Gurdwara, the park and
// the parking lot, plus the turn-by-turn route. Live tracking of the lead
// position is added on top of this (live.json).

let routePromise = null;
const loadRoute = () =>
  (routePromise ??= fetch("/data/route.json", { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`route.json: HTTP ${r.status}`);
    return r.json();
  }));

const miles = (m) => (m / 1609.34).toFixed(m < 1609 ? 2 : 1);

const arrow = (dir) =>
  dir === "left"
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21V11a3 3 0 0 0-3-3H5"/><path d="M9 4 5 8l4 4"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21V11a3 3 0 0 1 3-3h9"/><path d="M15 4l4 4-4 4"/></svg>';

const flagIcon =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffc21a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';
const pinIcon =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffc21a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

function legList(leg, venues) {
  const from = venues[leg.from];
  const to = venues[leg.to];
  const rows = [
    `<li class="turn turn--start"><span class="turn-icon" aria-hidden="true">${flagIcon}</span>
       <div><div class="turn-main">Leave ${esc(from.name)}</div><div class="turn-sub">on ${esc(leg.startStreet)}</div></div></li>`,
    ...leg.turns.map(
      (t) => `<li class="turn"><span class="turn-icon">${arrow(t.direction)}</span>
        <div><div class="turn-main">Turn ${t.direction} onto ${esc(t.onto)}</div>
        <div class="turn-sub">${miles(t.atMeters)} mi</div></div></li>`,
    ),
    `<li class="turn turn--end"><span class="turn-icon" aria-hidden="true">${pinIcon}</span>
       <div><div class="turn-main">Arrive at ${esc(to.name)}</div><div class="turn-sub">${miles(leg.lengthMeters)} mi</div></div></li>`,
  ];
  return `<ol class="turns">${rows.join("")}</ol>`;
}

export const live = {
  id: "parade",
  label: "Nagar Kirtan",
  title: "Nagar Kirtan",
  render(content) {
    const depart = content.schedule.find((e) => e.id === "depart-gurdwara");
    return `
      <div class="map-hero map-hero--tall">
        <div class="map-canvas" id="route-map" role="region" aria-label="Map of the Nagar Kirtan route"></div>
        <div class="map-title"><h1>Nagar Kirtan</h1></div>
        <button class="map-btn" type="button" id="route-fit" aria-label="Show the whole route">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
        </button>
      </div>

      <section class="card sheet status-card">
        <div class="status-dot" aria-hidden="true"></div>
        <div>
          <div class="status-title">Live tracking starts at departure</div>
          <div class="status-sub">${
            depart ? `The Nagar Kirtan leaves the Gurdwara at ${formatTime(depart.time)}. Its position will show on this map.` : ""
          }</div>
        </div>
      </section>

      <div id="route-lists"></div>
    `;
  },

  mount(view, content) {
    const el = view.querySelector("#route-map");
    const lists = view.querySelector("#route-lists");
    const v = content.venues;
    let handle = null;
    let gone = false;

    loadRoute()
      .then((route) => {
        if (gone) return;
        const [out, back] = route.legs;
        lists.innerHTML = `
          <h2 class="section-title">Route</h2>
          <section class="card">
            <div class="eyebrow">To ${esc(v.park.name)} · ${miles(out.lengthMeters)} mi</div>
            ${legList(out, v)}
          </section>
          <details class="card route-back">
            <summary>
              <span class="eyebrow">Back to the Gurdwara · ${miles(back.lengthMeters)} mi</span>
              <span class="route-back-sub">The same streets in reverse, leaving the park on ${esc(back.startStreet)}</span>
            </summary>
            ${legList(back, v)}
          </details>`;

        const all = route.legs.flatMap((l) => l.coordinates);
        const lngs = all.map((c) => c[0]);
        const lats = all.map((c) => c[1]);
        const fit = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ];

        const draw = (map) => {
          const data = {
            type: "FeatureCollection",
            features: route.legs.map((l) => ({
              type: "Feature",
              properties: { leg: l.id },
              geometry: { type: "LineString", coordinates: l.coordinates },
            })),
          };
          if (map.getSource("route")) return;
          map.addSource("route", { type: "geojson", data });
          map.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": token("--surface"), "line-width": 9 },
          });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": token("--primary"), "line-width": 5 },
          });
        };

        return createMap(el, {
          fit,
          padding: { top: 140, bottom: 50, left: 60, right: 60 },
          onStyle: draw,
        }).then((h) => {
          if (!h || gone) return h?.destroy();
          handle = h;
          const { lib, map } = h;
          const place = (venue, cls = "") =>
            pin(lib, {
              className: `map-pin--place ${cls}`,
              html: `<span class="pin-label">${esc(venue.namePa || venue.name)}</span>`,
              label: venue.name,
            })
              .setLngLat([venue.lng, venue.lat])
              .addTo(map);
          place(v.gurdwara);
          place(v.park, "map-pin--park");
          pin(lib, {
            className: "map-pin--parking map-pin--small",
            html: '<span class="pin-p">P</span>',
            label: "Parking lot",
            anchor: "center",
          })
            .setLngLat([content.parking.lng, content.parking.lat])
            .addTo(map);
          view.querySelector("#route-fit")?.addEventListener("click", () => h.frame());
        });
      })
      .catch(() => {
        el.classList.add("map-canvas--error");
        el.textContent = "The route map couldn't load. Check your connection and try again.";
      });

    return () => {
      gone = true;
      handle?.destroy();
    };
  },
};
