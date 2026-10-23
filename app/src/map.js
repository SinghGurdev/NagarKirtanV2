// Shared map for the Parking, Grounds and live Nagar Kirtan tabs.
// MapLibre is loaded only when a map tab opens, so Home stays fast.
// Tiles: OpenFreeMap (free, no key). Muted styles so the poster colors
// on our pins stand out; light or dark follows the phone.

const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;

let libPromise = null;
function loadLib() {
  libPromise ??= Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]).then(([lib, worker]) => {
    lib.setWorkerUrl(worker.default);
    return lib;
  });
  return libPromise;
}

/**
 * Creates a map inside `el`. Returns { map, lib, destroy }.
 * `fit` is a list of [lng, lat] points to frame on load.
 */
export async function createMap(el, { fit = [], center, zoom = 14, padding = 48, maxZoom = 17, onStyle } = {}) {
  const lib = await loadLib();
  if (!el.isConnected) return null;

  const map = new lib.Map({
    container: el,
    style: prefersDark() ? STYLES.dark : STYLES.light,
    center: center ?? fit[0] ?? [-119.7118, 36.6506],
    zoom,
    attributionControl: false,
    cooperativeGestures: true, // one finger scrolls the page, two fingers move the map
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new lib.AttributionControl({ compact: true }), "bottom-right");

  // Lines and areas we draw live in the map style, so they are re-added
  // every time a style loads (first load and light/dark switches).
  if (onStyle) map.on("style.load", () => onStyle(map));

  const frame = () => {
    if (fit.length < 2) return;
    const bounds = fit.reduce((b, p) => b.extend(p), new lib.LngLatBounds(fit[0], fit[0]));
    map.fitBounds(bounds, { padding, maxZoom, animate: false });
  };
  frame();

  // Follow the phone switching between light and dark.
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onScheme = (e) => map.setStyle(e.matches ? STYLES.dark : STYLES.light);
  mq?.addEventListener?.("change", onScheme);

  return {
    map,
    lib,
    frame,
    destroy() {
      mq?.removeEventListener?.("change", onScheme);
      map.remove();
    },
  };
}

/** Reads a color token from the stylesheet (follows light/dark). */
export const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** A map pin built from HTML so it can use the app's colors and fonts. */
export function pin(lib, { html, className = "", label, anchor = "bottom" }) {
  const el = document.createElement("div");
  el.className = `map-pin ${className}`;
  el.innerHTML = html;
  if (label) {
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", label);
  }
  return new lib.Marker({ element: el, anchor });
}
