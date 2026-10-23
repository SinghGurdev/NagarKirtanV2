// Route geometry shared by the app and the live-tracking Lambda
// (infra copies this file next to the Lambda at deploy time).
// Distances use a flat projection around the route, which is accurate to
// well under 1% over a few miles.

const R = 6371000;
const RAD = Math.PI / 180;

function toXY(lng, lat, lat0) {
  return [lng * RAD * R * Math.cos(lat0 * RAD), lat * RAD * R];
}

/** Adds the projected points and running distance to a route leg. */
export function prepareLeg(leg) {
  const c = leg.coordinates;
  const lat0 = c[0][1];
  const xy = c.map(([lng, lat]) => toXY(lng, lat, lat0));
  const cum = [0];
  for (let i = 1; i < xy.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
  }
  return { ...leg, lat0, xy, cum, length: cum[cum.length - 1] };
}

/**
 * Nearest point on the leg to [lng, lat].
 * Returns { distance (m off the route), progress (m along), segIndex, point [lng, lat] }.
 */
export function snap(leg, lng, lat) {
  const [px, py] = toXY(lng, lat, leg.lat0);
  let best = null;
  for (let i = 0; i < leg.xy.length - 1; i++) {
    const [ax, ay] = leg.xy[i];
    const [bx, by] = leg.xy[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (!best || d < best.distance) {
      const a = leg.coordinates[i];
      const b = leg.coordinates[i + 1];
      best = {
        distance: d,
        progress: leg.cum[i] + t * (leg.cum[i + 1] - leg.cum[i]),
        segIndex: i,
        point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
      };
    }
  }
  return best;
}

/** Point and segment at a distance along the leg. */
export function pointAt(leg, progress) {
  const p = Math.max(0, Math.min(leg.length, progress));
  let i = 0;
  while (i < leg.cum.length - 2 && leg.cum[i + 1] < p) i++;
  const seg = leg.cum[i + 1] - leg.cum[i] || 1;
  const t = (p - leg.cum[i]) / seg;
  const a = leg.coordinates[i];
  const b = leg.coordinates[i + 1];
  return { point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], segIndex: i };
}

/** Coordinates from the start of the leg up to `progress` metres. */
export function sliceTo(leg, progress) {
  const { point, segIndex } = pointAt(leg, progress);
  return [...leg.coordinates.slice(0, segIndex + 1), point];
}

/** Coordinates from `progress` metres to the end of the leg. */
export function sliceFrom(leg, progress) {
  const { point, segIndex } = pointAt(leg, progress);
  return [point, ...leg.coordinates.slice(segIndex + 1)];
}

/** Straight-line distance in metres between two [lng, lat] points. */
export function distance(a, b) {
  const lat0 = (a[1] + b[1]) / 2;
  const [ax, ay] = toXY(a[0], a[1], lat0);
  const [bx, by] = toXY(b[0], b[1], lat0);
  return Math.hypot(bx - ax, by - ay);
}
