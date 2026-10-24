import { esc, formatTime } from "../data.js";
import { createMap, pin, token } from "../map.js";
import { prepareLeg, sliceTo, sliceFrom } from "../geo.js";
import { pollLive, ago, clock, distanceText } from "../live-data.js";

// Nagar Kirtan tab: the route on a real map with the Gurdwara, the park and
// the parking lot; once the lead phone is sharing, the live position, the
// covered route, the street or next turn, and "Updated X ago". Below that,
// the turn-by-turn route.

let routePromise = null;
const loadRoute = () =>
  (routePromise ??= fetch("/data/route.json", { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`route.json: HTTP ${r.status}`);
    return r.json();
  }));

const STALE_MS = 90 * 1000; // older than this, "Updated" turns saffron
const miles = (m) => (m / 1609.34).toFixed(m < 1609 ? 2 : 1);

const turnArrow = (dir, size = 20) =>
  dir === "left"
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21V11a3 3 0 0 0-3-3H5"/><path d="M9 4 5 8l4 4"/></svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21V11a3 3 0 0 1 3-3h9"/><path d="M15 4l4 4-4 4"/></svg>`;
const straightArrow = (size = 30) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V5"/><path d="M6 11l6-6 6 6"/></svg>`;
const parkIcon = (size = 30) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 6 12h4l-4 6h12l-4-6h4z"/><path d="M12 18v3"/></svg>`;
const homeIcon = (size = 30) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z"/></svg>`;
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
      (t) => `<li class="turn"><span class="turn-icon">${turnArrow(t.direction)}</span>
        <div><div class="turn-main">Turn ${t.direction} onto ${esc(t.onto)}</div>
        <div class="turn-sub">${miles(t.atMeters)} mi</div></div></li>`,
    ),
    `<li class="turn turn--end"><span class="turn-icon" aria-hidden="true">${pinIcon}</span>
       <div><div class="turn-main">Arrive at ${esc(to.name)}</div><div class="turn-sub">${miles(leg.lengthMeters)} mi</div></div></li>`,
  ];
  return `<ol class="turns">${rows.join("")}</ol>`;
}

const isLive = (s) => s && (s.status === "live" || s.status === "paused");

/** The card under the map: what the Nagar Kirtan is doing right now. */
function statusHtml(s, content) {
  const tz = content.event.timezone;
  const depart = content.schedule.find((e) => e.id === "depart-gurdwara");

  if (!s || s.status === "not-started") {
    return `
      <div class="status-row">
        <span class="status-icon status-icon--idle">${homeIcon(28)}</span>
        <div>
          <div class="status-title">Live tracking starts at departure</div>
          <div class="status-sub">${
            depart ? `The Nagar Kirtan leaves the Gurdwara at ${formatTime(depart.time)}. Its position will show on this map.` : ""
          }</div>
        </div>
      </div>`;
  }

  if (s.status === "ended") {
    const back = s.actual?.["arrive-gurdwara"];
    return `
      <div class="status-row">
        <span class="status-icon">${homeIcon(28)}</span>
        <div>
          <div class="status-label">Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh</div>
          <div class="status-title">Back at the Gurdwara</div>
          <div class="status-sub">${back ? `The Nagar Kirtan returned at ${clock(back, tz)}.` : "The Nagar Kirtan has returned."}</div>
        </div>
      </div>`;
  }

  const stale = Date.now() - Date.parse(s.updatedAt) > STALE_MS;
  const header = `
    <div class="status-head">
      <span class="badge-live${s.status === "paused" ? " badge-live--paused" : ""}">${s.status === "paused" ? "PAUSED" : "LIVE"}</span>
      <span class="status-updated${stale ? " status-updated--stale" : ""}" data-updated="${esc(s.updatedAt)}">Updated ${ago(s.updatedAt)}</span>
    </div>`;

  let icon;
  let label;
  let title;
  let sub;
  if (s.phase === "at-park") {
    icon = parkIcon(30);
    label = "At the park";
    title = esc(content.venues.park.name);
    sub = s.eta?.["depart-park"] ? `Expected to leave around ${clock(s.eta["depart-park"], tz)}` : "";
  } else if (s.offRoute) {
    icon = straightArrow(30);
    label = "Off the planned route";
    title = "Position shown on the map";
    sub = "The street will show again once it's back on the route.";
  } else if (s.turnSoon && s.nextTurn) {
    icon = turnArrow(s.nextTurn.direction, 30);
    label = `Turning ${s.nextTurn.direction} onto`;
    title = esc(s.nextTurn.onto);
    sub = s.street ? `Now on ${esc(s.street)}` : "";
  } else {
    icon = straightArrow(30);
    label = "Now on";
    title = esc(s.street || "the route");
    sub = s.nextTurn
      ? `Next: ${s.nextTurn.direction} onto ${esc(s.nextTurn.onto)} in ${distanceText(s.nextTurn.inMeters)}`
      : s.phase === "return"
        ? "Last stretch to the Gurdwara"
        : `Last stretch to ${esc(content.venues.park.name)}`;
  }
  return `
    ${header}
    <div class="status-row">
      <span class="status-icon status-icon--live${s.status === "paused" ? " status-icon--paused" : ""}">${icon}</span>
      <div>
        <div class="status-label">${label}</div>
        <div class="status-title status-title--big">${title}</div>
        ${sub ? `<div class="status-sub">${sub}</div>` : ""}
      </div>
    </div>`;
}

export const live = {
  id: "parade",
  label: "Nagar Kirtan",
  title: "Nagar Kirtan",
  render(content) {
    return `
      <div class="map-hero map-hero--tall">
        <div class="map-canvas" id="route-map" role="region" aria-label="Map of the Nagar Kirtan route"></div>
        <div class="map-title"><h1>Nagar Kirtan</h1></div>
        <button class="map-btn" type="button" id="route-fit" aria-label="Show the whole route">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
        </button>
        <button class="map-btn map-btn--second" type="button" id="route-follow" aria-label="Center on the Nagar Kirtan" hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        </button>
      </div>

      <section class="card sheet status-card" id="live-status" aria-live="polite">${statusHtml(null, content)}</section>

      <div id="route-lists"></div>
    `;
  },

  mount(view, content) {
    const el = view.querySelector("#route-map");
    const lists = view.querySelector("#route-lists");
    const statusEl = view.querySelector("#live-status");
    const followBtn = view.querySelector("#route-follow");
    const v = content.venues;
    let handle = null;
    let gone = false;
    let state = null;
    let legs = null; // prepared route legs by id
    let leadPin = null;
    let centeredOnce = false;
    const empty = { type: "FeatureCollection", features: [] };
    let lines = { covered: empty, ahead: empty };
    const line = (coords) =>
      coords?.length > 1
        ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] }
        : empty;

    function leadPoint(s) {
      if (!s) return null;
      if (s.snapped) return s.snapped;
      return s.lead ? [s.lead.lng, s.lead.lat] : null;
    }

    function updateLines() {
      const map = handle?.map;
      if (!legs) return;
      if (isLive(state) && state.leg && legs[state.leg]) {
        const leg = legs[state.leg];
        lines = { covered: line(sliceTo(leg, state.progressMeters)), ahead: line(sliceFrom(leg, state.progressMeters)) };
      } else {
        lines = { covered: empty, ahead: empty };
      }
      map?.getSource("covered")?.setData(lines.covered);
      map?.getSource("ahead")?.setData(lines.ahead);
      // While live, the full route fades back so the current leg stands out.
      if (map?.getLayer("route-line")) {
        map.setPaintProperty("route-line", "line-opacity", isLive(state) ? 0.25 : 1);
        map.setPaintProperty("route-casing", "line-opacity", isLive(state) ? 0.4 : 1);
      }
    }

    function updatePin() {
      if (!handle) return;
      const p = isLive(state) ? leadPoint(state) : null;
      followBtn.hidden = !p;
      if (!p) {
        leadPin?.remove();
        leadPin = null;
        return;
      }
      if (!leadPin) {
        leadPin = pin(handle.lib, {
          className: "map-pin--lead",
          html: '<span class="lead-dot"></span>',
          label: "The Nagar Kirtan is here",
          anchor: "center",
        })
          .setLngLat(p)
          .addTo(handle.map);
      } else {
        leadPin.setLngLat(p);
      }
      leadPin.getElement().classList.toggle("map-pin--lead-paused", state.status === "paused");
      if (!centeredOnce) {
        centeredOnce = true;
        handle.map.easeTo({ center: p, zoom: 15, duration: 0 });
      }
    }

    function onState(s) {
      state = s;
      statusEl.innerHTML = statusHtml(s, content);
      updateLines();
      updatePin();
    }

    // Keep "Updated X ago" current between polls.
    const ticker = setInterval(() => {
      const u = statusEl.querySelector("[data-updated]");
      if (!u) return;
      const at = u.dataset.updated;
      u.textContent = `Updated ${ago(at)}`;
      u.classList.toggle("status-updated--stale", Date.now() - Date.parse(at) > STALE_MS);
    }, 1000);

    const stopPoll = pollLive(onState);

    loadRoute()
      .then((route) => {
        if (gone) return;
        legs = Object.fromEntries(route.legs.map((l) => [l.id, prepareLeg(l)]));
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
        const allLegs = {
          type: "FeatureCollection",
          features: route.legs.map((l) => ({
            type: "Feature",
            properties: { leg: l.id },
            geometry: { type: "LineString", coordinates: l.coordinates },
          })),
        };

        // Re-run on every style load (first load and light/dark switches).
        const draw = (map) => {
          if (map.getSource("route")) return;
          const primary = token("--primary");
          map.addSource("route", { type: "geojson", data: allLegs });
          map.addSource("ahead", { type: "geojson", data: lines.ahead });
          map.addSource("covered", { type: "geojson", data: lines.covered });
          const round = { "line-join": "round", "line-cap": "round" };
          map.addLayer({ id: "route-casing", type: "line", source: "route", layout: round, paint: { "line-color": token("--surface"), "line-width": 9 } });
          map.addLayer({ id: "route-line", type: "line", source: "route", layout: round, paint: { "line-color": primary, "line-width": 5 } });
          map.addLayer({
            id: "ahead-line",
            type: "line",
            source: "ahead",
            layout: { "line-join": "round" },
            paint: { "line-color": primary, "line-width": 4, "line-dasharray": [1.2, 1.6] },
          });
          map.addLayer({ id: "covered-casing", type: "line", source: "covered", layout: round, paint: { "line-color": token("--surface"), "line-width": 10 } });
          map.addLayer({ id: "covered-line", type: "line", source: "covered", layout: round, paint: { "line-color": primary, "line-width": 6 } });
          updateLines();
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
          followBtn.addEventListener("click", () => {
            const p = leadPoint(state);
            if (p) map.easeTo({ center: p, zoom: 15 });
          });
          updatePin();
        });
      })
      .catch(() => {
        el.classList.add("map-canvas--error");
        el.textContent = "The route map couldn't load. Check your connection and try again.";
      });

    return () => {
      gone = true;
      stopPoll();
      clearInterval(ticker);
      handle?.destroy();
    };
  },
};
