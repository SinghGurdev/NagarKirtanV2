"""Builds app/public/data/route.json from the hand-drawn route GeoJSON.

Usage: python3 data-src/build_route.py data-src/route-2026.geojson
Street names per segment are listed below (checked against OpenStreetMap);
update them when the route changes. Turns and distances are computed.
"""
import json, math, sys

STREETS = {
    "outbound": ["E Lincoln Ave"] + ["S Minnewawa Ave"] * 6 + ["E Adams Ave"] * 2
    + ["S Clovis Ave", "E Sumner Ave", "S Sunnyside Ave", "E South Ave", "Stanford Ave"]
    + ["W Fresno St"] * 2,
    "return": ["Citrus Ave"] * 2 + ["E South Ave", "S Sunnyside Ave", "E Sumner Ave", "S Clovis Ave", "E Adams Ave"]
    + ["S Minnewawa Ave"] * 2 + ["E Lincoln Ave"] * 2,
}
LEGS = [
    {"id": "outbound", "from": "gurdwara", "to": "park"},
    {"id": "return", "from": "park", "to": "gurdwara"},
]

def hav(a, b):
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

def bearing(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dl = math.radians(b[0] - a[0])
    x = math.sin(dl) * math.cos(la2)
    y = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

src = json.load(open(sys.argv[1]))
lines = [f["geometry"]["coordinates"] for f in src["features"] if f["geometry"]["type"] == "LineString"]
assert len(lines) == 2, "expected an outbound and a return line"

out = {"legs": []}
for leg, coords in zip(LEGS, lines):
    names = STREETS[leg["id"]]
    assert len(names) == len(coords) - 1, f"{leg['id']}: {len(coords) - 1} segments, {len(names)} names"
    seg = [hav(coords[i], coords[i + 1]) for i in range(len(coords) - 1)]
    cum = [0]
    for s in seg:
        cum.append(cum[-1] + s)
    turns = []
    for i in range(1, len(names)):
        if names[i] != names[i - 1]:
            d = (bearing(coords[i], coords[i + 1]) - bearing(coords[i - 1], coords[i]) + 540) % 360 - 180
            turns.append({"atVertex": i, "atMeters": round(cum[i]), "direction": "right" if d > 0 else "left", "onto": names[i]})
    out["legs"].append({
        **leg,
        "startStreet": names[0],
        "lengthMeters": round(cum[-1]),
        "coordinates": [[round(x, 6), round(y, 6)] for x, y in coords],
        "segmentStreets": names,
        "turns": turns,
    })

json.dump(out, open("app/public/data/route.json", "w"), indent=2)
for leg in out["legs"]:
    print(f"{leg['id']}: {leg['lengthMeters'] / 1609.34:.2f} mi, starts on {leg['startStreet']}")
    for t in leg["turns"]:
        print(f"   at {t['atMeters'] / 1609.34:4.2f} mi turn {t['direction']:5s} onto {t['onto']}")
