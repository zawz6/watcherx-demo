"""Build boundary.geojson for the Second Industrial City, Riyadh, from osm_raw.json (OpenStreetMap, ODbL)."""
import json
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

KEEP = {36947298, 333011151, 333011152, 333011153, 333011154, 333027526, 333027527,
        333027528, 333027530, 333027531, 333027556, 858525074, 333011148}
KM_LAT, KM_LON = 111.32, 101.5  # km per degree near 24.5N

raw = json.load(open("osm_raw.json"))
polys = [Polygon([(p["lon"], p["lat"]) for p in e["geometry"]])
         for e in raw["elements"] if e["id"] in KEEP and e.get("geometry")]
merged = unary_union([p.buffer(0.0012) for p in polys]).buffer(-0.0012)
if merged.geom_type == "MultiPolygon":
    merged = unary_union([p.buffer(0.004) for p in merged.geoms]).buffer(-0.004)
merged = merged.simplify(0.0002)
if merged.geom_type == "MultiPolygon":
    merged = max(merged.geoms, key=lambda g: g.area)
area = merged.area * KM_LAT * KM_LON
print(f"boundary area: {area:.1f} km2, vertices: {len(merged.exterior.coords)}, centroid: {merged.centroid.coords[0]}")
json.dump({"type": "Feature", "properties": {"name": "Second Industrial City, Riyadh", "source": "OpenStreetMap (ODbL)"},
           "geometry": mapping(merged)}, open("boundary.geojson", "w"))
