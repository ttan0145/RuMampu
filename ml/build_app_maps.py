"""Build the app's district outline maps from DOSM's district boundaries.

    python build_app_maps.py   (needs shapely; reads data/dosm_district.geojson)
    -> ../frontend/src/rumampu/pxmap.ts   (screen-space outlines, one box per state)
    -> ../frontend/src/rumampu/pxgeo.ts   (the same districts in latitude/longitude, for the street map)

Get the boundaries from DOSM's open data (administrative_2_district.geojson,
github.com/dosm-malaysia/data-open, datasets/geodata) and save them as
data/dosm_district.geojson. The district names are NAPIC's (the names the API
returns); RENAME in geocode.py maps them to DOSM's, including Sarawak's
divisions, which are drawn as the union of their DOSM districts. DOSM districts
with no NAPIC sales are kept under their own name, so each state is whole.

Each state is its own map, except Selangor, Kuala Lumpur and Putrajaya, which
share one (the Klang Valley). Shapes are projected, simplified for a phone
screen and written as SVG paths with a label point and its room in pixels.
"""
import json
import math
import pathlib

from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import polylabel, unary_union

HERE = pathlib.Path(__file__).parent
SRC = HERE / 'data' / 'dosm_district.geojson'
OUT = HERE.parent / 'frontend' / 'src' / 'rumampu' / 'pxmap.ts'
GEO_OUT = HERE.parent / 'frontend' / 'src' / 'rumampu' / 'pxgeo.ts'
GEO_SIMPLIFY_DEG = 0.005    # ~500 m: invisible at the zoom levels a phone map uses for a district
GEO_MIN_PART_DEG2 = 0.001   # islands smaller than ~3 km x 3 km are dropped (the main shape is always kept)

SCODE = {'Johor': 'JHR', 'Kedah': 'KDH', 'Kelantan': 'KTN', 'Melaka': 'MLK', 'Negeri Sembilan': 'NSN', 'Pahang': 'PHG',
         'Perak': 'PRK', 'Perlis': 'PLS', 'Pulau Pinang': 'PNG', 'Sabah': 'SBH', 'Sarawak': 'SWK', 'Selangor': 'SGR',
         'Terengganu': 'TRG', 'W.P. Kuala Lumpur': 'KUL', 'W.P. Labuan': 'LBN', 'W.P. Putrajaya': 'PJY'}
GROUPS = {'KV': ['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya']}
BOX_W, BOX_H, PAD = 300.0, 340.0, 6.0
SIMPLIFY_PX = 0.55          # how far a simplified edge may stray, in screen pixels
MIN_PART_PX2 = 2.0          # islands smaller than this are dropped (the main shape is always kept)


def rename_map():
    src = (HERE / 'geocode.py').read_text(encoding='utf-8')
    ns = {}
    exec(src[src.index('SARAWAK = {'):src.index('ABBR = {')], ns)
    return ns['RENAME']


def napic_names():
    """(state, NAPIC district) pairs the app can show: the model's cells plus the published sales."""
    import csv
    pairs = {(r['state'], r['district']) for r in csv.DictReader(open(HERE / 'app_export' / 'price_range_cell.csv', encoding='utf-8'))}
    extra = HERE / 'data' / 'napic_districts.csv'           # optional: state,district from Neon's district table
    if extra.exists():
        pairs |= {(r['state'], r['district']) for r in csv.DictReader(open(extra, encoding='utf-8'))}
    return pairs


def parts(geom):
    return list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]


def main():
    feats = json.load(open(SRC, encoding='utf-8'))['features']
    geo = {(f['properties']['state'], f['properties']['district']): shape(f['geometry']).buffer(0) for f in feats}
    rename = rename_map()

    # NAPIC district -> its DOSM shape; leftover DOSM districts keep their own name
    shapes, used = {}, set()
    for state, d in sorted(napic_names()):
        names = rename.get(d, [d])
        shapes[(state, d)] = unary_union([geo[(state, n)] for n in names])
        used |= {(state, n) for n in names}
    for (state, n), g in geo.items():
        if (state, n) not in used:
            shapes[(state, n)] = g

    groups = {k: v for k, v in GROUPS.items()}
    grouped = {s for v in GROUPS.values() for s in v}
    for state in SCODE:
        if state not in grouped:
            groups[SCODE[state]] = [state]

    out = {}
    for key, states in groups.items():
        members = {k: g for k, g in shapes.items() if k[0] in states}
        allg = unary_union(list(members.values()))
        minx, miny, maxx, maxy = allg.bounds
        k = math.cos(math.radians((miny + maxy) / 2))          # equirectangular, true to scale at mid-latitude
        w0, h0 = (maxx - minx) * k, (maxy - miny)
        sc = min((BOX_W - 2 * PAD) / w0, (BOX_H - 2 * PAD) / h0)
        W, H = round(w0 * sc + 2 * PAD, 1), round(h0 * sc + 2 * PAD, 1)

        def px(lon, lat):
            return (PAD + (lon - minx) * k * sc, PAD + (maxy - lat) * sc)

        dists = {}
        for (state, name), g in sorted(members.items(), key=lambda kv: kv[0][1]):
            polys = []
            for p in parts(g):
                pp = Polygon([px(*c) for c in p.exterior.coords])
                if pp.area >= MIN_PART_PX2 or len(parts(g)) == 1:
                    polys.append(pp.simplify(SIMPLIFY_PX, preserve_topology=True))
            if not polys:
                polys = [max((Polygon([px(*c) for c in p.exterior.coords]) for p in parts(g)), key=lambda q: q.area)]
            main_part = max(polys, key=lambda q: q.area)
            lab = polylabel(main_part, tolerance=0.3)
            room = main_part.exterior.distance(lab)
            d = ''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in list(p.exterior.coords)[:-1]) + 'Z' for p in polys)
            dists[name] = {'d': d, 'x': round(lab.x, 1), 'y': round(lab.y, 1), 'r': round(room, 1), 's': SCODE[state]}
        out[key] = {'w': W, 'h': H, 'states': [SCODE[s] for s in states], 'd': dists}

    lines = [
        '/* District outline maps for every state, built by ml/build_app_maps.py from DOSM\'s',
        '   district boundaries (administrative_2_district.geojson). Do not edit by hand: re-run',
        '   the script. Keys are the NAPIC district names the API returns; Selangor, Kuala',
        '   Lumpur and Putrajaya share one map. Each district: SVG path `d`, label point `x`,`y`,',
        '   the room around that point in pixels `r`, and its state code `s`. */',
        'export type PxShape = { d: string; x: number; y: number; r: number; s: string };',
        'export type PxGroup = { w: number; h: number; states: string[]; d: Record<string, PxShape> };',
        '',
        'export const PX_GROUPS: Record<string, PxGroup> = {',
    ]
    for key, gdata in out.items():
        lines.append(f'  {key}: {{ w: {gdata["w"]}, h: {gdata["h"]}, states: {json.dumps(gdata["states"])}, d: {{')
        for name, s in gdata['d'].items():
            lines.append(f'    {json.dumps(name)}: {{ d: {json.dumps(s["d"])}, x: {s["x"]}, y: {s["y"]}, r: {s["r"]}, s: {json.dumps(s["s"])} }},')
        lines.append('  } },')
    lines += [
        '};',
        '',
        '/* the map a state is drawn on (API state code, upper case) */',
        'export const PX_GROUP_OF: Record<string, string> = Object.fromEntries(',
        '  Object.entries(PX_GROUPS).flatMap(([k, g]) => g.states.map(s => [s, k])),',
        ');',
        '',
    ]
    OUT.write_text('\n'.join(lines), encoding='utf-8')
    write_geo(groups, shapes)
    print(f'{OUT}: {OUT.stat().st_size // 1024} KB, {len(out)} maps, {sum(len(g["d"]) for g in out.values())} districts')
    for key, gdata in out.items():
        small = sorted((s['r'], n) for n, s in gdata['d'].items())[:3]
        print(f'  {key}: {gdata["w"]}x{gdata["h"]}, {len(gdata["d"])} districts, tightest labels {small}')


def write_geo(groups, shapes):
    """Districts as simplified lon/lat rings (flat [lon, lat, ...], 3 decimals), with a label point
    inside each and bounds per district and per map, for drawing over street map tiles."""
    lines = [
        '/* District outlines in latitude/longitude for the street map (House costs), built by',
        '   ml/build_app_maps.py from DOSM\'s district boundaries. Do not edit by hand. Keys are the',
        '   NAPIC district names the API returns. Each district: rings as flat [lon, lat, ...], a label',
        '   point `c` [lat, lon] inside it, bounds `b` [[south, west], [north, east]], and its state code. */',
        'export type GeoDistrict = { r: number[][]; c: [number, number]; b: [[number, number], [number, number]]; s: string };',
        'export type GeoGroup = { b: [[number, number], [number, number]]; d: Record<string, GeoDistrict> };',
        '',
        'export const PX_GEO: Record<string, GeoGroup> = {',
    ]
    for key, states in groups.items():
        members = {k: g for k, g in shapes.items() if k[0] in states}
        allg = unary_union(list(members.values()))
        w, s_, e, n = allg.bounds
        lines.append(f'  {key}: {{ b: [[{s_:.3f}, {w:.3f}], [{n:.3f}, {e:.3f}]], d: {{')
        for (state, name), g in sorted(members.items(), key=lambda kv: kv[0][1]):
            ps = parts(g)
            keep = [p for p in ps if p.area >= GEO_MIN_PART_DEG2] or [max(ps, key=lambda q: q.area)]
            rings = []
            for p in keep:
                q = p.simplify(GEO_SIMPLIFY_DEG, preserve_topology=True)
                rings.append([round(v, 3) for xy in list(q.exterior.coords)[:-1] for v in xy])
            main_part = max(keep, key=lambda q: q.area)
            k = math.cos(math.radians(main_part.centroid.y))
            scaled = Polygon([(x * k, y) for x, y in main_part.exterior.coords])
            lab = polylabel(scaled, tolerance=0.002)
            bw, bs, be, bn = g.bounds
            lines.append(f'    {json.dumps(name)}: {{ s: {json.dumps(SCODE[state])}, c: [{lab.y:.3f}, {lab.x / k:.3f}], '
                         f'b: [[{bs:.3f}, {bw:.3f}], [{bn:.3f}, {be:.3f}]], r: {json.dumps(rings, separators=(",", ":"))} }},')
        lines.append('  } },')
    lines += ['};', '']
    GEO_OUT.write_text('\n'.join(lines), encoding='utf-8')
    print(f'{GEO_OUT}: {GEO_OUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
