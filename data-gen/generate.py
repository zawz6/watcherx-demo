"""WatcherX Tier 1 generator.

Synthetic zones and incidents for the Second Industrial City (Riyadh), risk from the rule multipliers in
WatcherX_01_Demo_Work.md §6.3, a simple planner and simulator, and the scripted agent content.
Everything is rule-based and illustrative. Seed 42. Writes JSON to ../web/public/data/.
"""
import datetime as dt
import json
import math
from pathlib import Path

import h3
import numpy as np
from shapely.geometry import mapping, shape
from sklearn.cluster import KMeans

import reasons_ar as R

HERE = Path(__file__).parent
OUT = HERE.parent / "web" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

SEED = 42
CENTER_LAT, CENTER_LON = 24.5444, 46.8981
KM_LAT, KM_LON = 111.32, 101.5
TZ = dt.timezone(dt.timedelta(hours=3))
NOW = dt.datetime(2026, 11, 21, 21, 40, tzinfo=TZ)
assert NOW.weekday() == 5  # Saturday
LAST_DAY = dt.date(2026, 11, 20)
DAYS = 180
START_DAY = LAST_DAY - dt.timedelta(days=DAYS - 1)
TYPES = ["theft", "breakin", "scrap", "damage"]
SHIFTS = ["morning", "evening", "night"]
SHIFT_START_H = {"morning": 6, "evening": 14, "night": 22}
SHIFT_MULT = {"morning": 1.0, "evening": 1.5, "night": 3.0}
HOLIDAYS = {dt.date(2026, 5, 26) + dt.timedelta(days=i) for i in range(5)} | {dt.date(2026, 9, 23)}
CARS_PER_SHIFT = {"night": 6, "evening": 4, "morning": 3}
TARGETS = {"theft": 400, "breakin": 200, "damage": 120, "scrap": 80}
SPEED_KMH, ROAD_FACTOR, DISPATCH_MIN, TARGET_MIN = 30.0, 1.3, 1.0, 10.0

rng = np.random.default_rng(SEED)


def _np(o):
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(type(o))


def dump(name, obj):
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"), default=_np), encoding="utf-8")


def r3(x):
    return round(float(x), 4)


# ───────────────────────── zones ─────────────────────────
boundary_feature = json.load(open(HERE / "boundary.geojson"))
boundary = shape(boundary_feature["geometry"])
cells = h3.geo_to_cells(mapping(boundary), 9)
cells = sorted(cells, key=lambda c: (-round(h3.cell_to_latlng(c)[0], 3), h3.cell_to_latlng(c)[1]))
N = len(cells)
IDX = {c: i for i, c in enumerate(cells)}
LAT = np.array([h3.cell_to_latlng(c)[0] for c in cells])
LON = np.array([h3.cell_to_latlng(c)[1] for c in cells])
XY = np.stack([(LON - CENTER_LON) * KM_LON, (LAT - CENTER_LAT) * KM_LAT], axis=1)
ZID = [f"Z{i + 1:02d}" for i in range(N)]
NBR = [[IDX[c] for c in h3.grid_disk(cells[i], 1) if c != cells[i] and c in IDX] for i in range(N)]
ADJ = np.zeros((N, N))
for i, ns in enumerate(NBR):
    ADJ[i, ns] = 1


def smooth_rank(iters=3):
    v = rng.random(N)
    for _ in range(iters):
        v = np.array([(v[i] + sum(v[j] for j in NBR[i])) / (1 + len(NBR[i])) for i in range(N)])
    return np.argsort(np.argsort(v)) / N


def pick(r, table):
    out, acc = np.empty(N, dtype=object), 0.0
    out[:] = table[-1][0]
    for name, p in table:
        mask = (r >= acc) & (r < acc + p)
        out[mask] = name
        acc += p
    return out


# main axis (PCA) and the "main road" side
_c = XY - XY.mean(axis=0)
_u, _s, _vt = np.linalg.svd(_c, full_matrices=False)
AXIS, MINOR = _vt[0], _vt[1]
if AXIS[1] < 0:
    AXIS = -AXIS
along, across = XY @ AXIS, XY @ MINOR
near_main_road = across <= np.quantile(across, 0.15)

site_status = pick(smooth_rank(), [("producing", 0.70), ("under_construction", 0.12), ("empty", 0.10), ("closed", 0.08)])
site_type = pick(smooth_rank(), [("metal", 0.18), ("electrical", 0.10), ("warehouse", 0.25), ("construction_materials", 0.15),
                                 ("food", 0.12), ("chemical", 0.08), ("other", 0.12)])
north = LAT >= np.quantile(LAT, 0.66)

# lighting: 3 broken clusters (one in the north), plus a few random zones
lighting_ok = np.ones(N, dtype=bool)
north_idx = np.where(north)[0]
seeds = [int(rng.choice(north_idx))] + [int(s) for s in rng.choice(np.where(~north)[0], 2, replace=False)]
for s in seeds:
    for j in [s] + NBR[s]:
        lighting_ok[j] = False
lighting_ok[rng.choice(N, 4, replace=False)] = False
broken_poles = np.where(lighting_ok, 0, rng.integers(3, 7, N))
# the northern lighting cluster failed recently (story for the manager chat)
LIGHT_FAULT_SINCE = {j: dt.date(2026, 10, 27) for j in [seeds[0]] + NBR[seeds[0]]}


def lighting_at(date):
    out = lighting_ok.copy()
    for j, d in LIGHT_FAULT_SINCE.items():
        if date < d:
            out[j] = True
    return out

fence_ok = smooth_rank(2) > 0.12

# three synthetic scrap/storage yards near the city edges (north, south, east)
_ring = np.array(boundary.exterior.coords)
_ringxy = np.stack([(_ring[:, 0] - CENTER_LON) * KM_LON, (_ring[:, 1] - CENTER_LAT) * KM_LAT], axis=1)
_cx = _ringxy.mean(axis=0)
YARDS = [_cx + 0.88 * (_ringxy[k] - _cx) for k in (np.argmax(_ringxy[:, 1]), np.argmin(_ringxy[:, 1]), np.argmax(_ringxy[:, 0]))]
dist_scrap = np.min([np.linalg.norm(XY - y, axis=1) for y in YARDS], axis=0) * 1000

# two northern sites that closed in the last 30 days (story for the manager chat)
_cand = [i for i in north_idx if site_status[i] == "producing" and lighting_ok[i]]
CLOSED_SINCE = {}
for i, d in zip(rng.choice(_cand, 2, replace=False), (dt.date(2026, 10, 24), dt.date(2026, 10, 29))):
    site_status[i] = "closed"
    CLOSED_SINCE[int(i)] = d


def status_at(date):
    s = site_status.copy()
    for i, d in CLOSED_SINCE.items():
        if date < d:
            s[i] = "producing"
    return s


def zones_json():
    out = []
    for i in range(N):
        z = {"id": ZID[i], "num": i + 1, "h3": cells[i], "center": [r3(LON[i]), r3(LAT[i])],
             "site_status": str(site_status[i]), "site_type": str(site_type[i]),
             "site_summary_ar": R.site_summary(site_type[i], site_status[i]),
             "lighting_ok": bool(lighting_ok[i]), "broken_poles": int(broken_poles[i]),
             "fence_ok": bool(fence_ok[i]), "dist_scrap_m": int(dist_scrap[i]),
             "near_main_road": bool(near_main_road[i]), "north": bool(north[i])}
        if i in CLOSED_SINCE:
            z["closed_since"] = CLOSED_SINCE[i].isoformat()
        if i in LIGHT_FAULT_SINCE:
            z["light_fault_since"] = LIGHT_FAULT_SINCE[i].isoformat()
        out.append(z)
    return out


# ───────────────────────── rule model ─────────────────────────
def static_factors(status, light_ok, fence, stype, dscrap):
    one = np.ones(N)
    emp = np.isin(status, ["empty", "under_construction"])
    clo = status == "closed"
    st = np.where(emp, 3.0, np.where(clo, 2.0, 1.0))
    near = np.where(dscrap < 1000, 1.8, 1.0)
    return {
        "status": {"theft": st, "breakin": st, "scrap": one, "damage": one},
        "metal": {"theft": np.where(np.isin(stype, ["metal", "electrical"]), 2.5, 1.0), "breakin": one, "scrap": one, "damage": one},
        "lighting": {k: np.where(light_ok, 1.0, 3.0 if k == "damage" else 2.0) for k in TYPES},
        "fence": {"theft": one, "breakin": np.where(fence, 1.0, 1.8), "scrap": one, "damage": one},
        "scrapdist": {"theft": near, "breakin": one, "scrap": near, "damage": one},
    }


def combine(factors, k):
    m = np.ones(N)
    for f in factors.values():
        m = m * f[k]
    return m


# ───────────────────────── baseline plan (needed by the simulation) ─────────────────────────
def hhmm(m):
    t = (22 * 60 + int(round(m))) % 1440
    return f"{t // 60:02d}:{t % 60:02d}"


corridor = np.where(near_main_road)[0]
corridor = corridor[np.argsort(along[corridor])]
BASE_GROUPS = [list(g) for g in np.array_split(corridor, 6)]


def baseline_plan(n_cars=6):
    cars = []
    for c, g in enumerate(BASE_GROUPS[:n_cars]):
        segs = [(int(g[k % len(g)]), k * 60, (k + 1) * 60) for k in range(8)]
        cars.append({"id": f"P{c + 1}", "segs": segs})
    return cars


# ───────────────────────── incidents (180 days) ─────────────────────────
def simulate_incidents(base, seed):
    r = np.random.default_rng(seed)
    daily = np.zeros((DAYS, N))
    inc = []
    circuits = [set(g) for g in BASE_GROUPS]
    for d in range(DAYS):
        date = START_DAY + dt.timedelta(days=d)
        fac = static_factors(status_at(date), lighting_at(date), fence_ok, site_type, dist_scrap)
        recent = daily[max(0, d - 7):d].sum(axis=0)
        repeat = np.where((recent + ADJ @ recent) > 0, 1.5, 1.0)
        wk = 1.3 if date.weekday() in (4, 5) else 1.0
        hol = 2.0 if date in HOLIDAYS else 1.0
        for s in SHIFTS:
            visited = np.zeros(N, dtype=bool)
            for g in circuits[:CARS_PER_SHIFT[s]]:
                visited[list(g)] = True
            visited &= r.random(N) < 0.9
            patrol = np.where(visited, 0.7, 1.0)
            for k in TYPES:
                rate = base[k] * combine(fac, k) * SHIFT_MULT[s] * wk * hol * patrol * repeat
                cnt = r.poisson(rate)
                for z in np.nonzero(cnt)[0]:
                    for _ in range(cnt[z]):
                        inc.append((date, s, k, int(z), r))
                daily[d] += cnt
    return inc, daily


def north_theft(inc):
    cut1, cut2 = LAST_DAY - dt.timedelta(days=30), LAST_DAY - dt.timedelta(days=60)
    now = sum(1 for x in inc if x[2] == "theft" and north[x[3]] and x[0] > cut1)
    prev = sum(1 for x in inc if x[2] == "theft" and north[x[3]] and cut2 < x[0] <= cut1)
    return now, prev


def run_incidents():
    base = {k: TARGETS[k] / (N * DAYS * 3 * 2.0) for k in TYPES}
    for it in range(5):
        inc, _ = simulate_incidents(base, SEED + 1)
        got = {k: max(1, sum(1 for x in inc if x[2] == k)) for k in TYPES}
        base = {k: base[k] * TARGETS[k] / got[k] for k in TYPES}
    # first seed where the northern thefts clearly rise this month, so the manager story matches the data
    for off in range(1, 80):
        inc, daily = simulate_incidents(base, SEED + off)
        now, prev = north_theft(inc)
        if 760 <= len(inc) <= 840 and prev >= 8 and now / prev >= 1.3:
            return base, inc, daily
    inc, daily = simulate_incidents(base, SEED + 1)
    return base, inc, daily


BASE, _raw_inc, DAILY = run_incidents()
_rs = np.random.default_rng(SEED + 7)
_notes_damage = ["إتلاف أعمدة إنارة", "إتلاف جزء من السياج", "إتلاف غرفة كهرباء"]
INCIDENTS = []
for date, s, k, z, _ in sorted(_raw_inc, key=lambda x: (x[0], SHIFT_START_H[x[1]])):
    h0 = SHIFT_START_H[s]
    ts = dt.datetime.combine(date, dt.time(0), TZ) + dt.timedelta(hours=h0, minutes=float(_rs.uniform(0, 480)))
    ts = ts.replace(second=0, microsecond=0)
    st = R.STATUS_AR[status_at(date)[z]]
    note = {"theft": f"سرقة كيابل ومعادن من موقع {st}", "breakin": f"اقتحام موقع {st}",
            "scrap": "حوش سكراب مخالف قرب الموقع", "damage": str(_rs.choice(_notes_damage))}[k]
    INCIDENTS.append({"type": k, "zone": ZID[z], "zi": z, "ts": ts.isoformat(), "date": date.isoformat(), "shift": s,
                      "source": str(_rs.choice(["factory", "patrol", "camera"], p=[0.55, 0.30, 0.15])), "note_ar": note})
INCIDENTS.sort(key=lambda x: x["ts"])
for n_, x in enumerate(INCIDENTS):
    x["id"] = f"I{n_ + 1:04d}"

INC_DAY = np.zeros((DAYS, N))
INC_DAY_T = {k: np.zeros((DAYS, N)) for k in TYPES}
for x in INCIDENTS:
    d = (dt.date.fromisoformat(x["date"]) - START_DAY).days
    INC_DAY[d, x["zi"]] += 1
    INC_DAY_T[x["type"]][d, x["zi"]] += 1


def window_sum(arr, date, days):
    """Sum of history in [date-days, date-1]."""
    d = (date - START_DAY).days
    return arr[max(0, d - days):max(0, min(d, DAYS))].sum(axis=0)


# ───────────────────────── forecast ─────────────────────────
def rates_for(date, shift, *, status=None, light_ok=None, fence=None, dscrap=None, drift=None, neutral=False, boost=None):
    status = status_at(date) if status is None else status
    fac = static_factors(status, lighting_at(date) if light_ok is None else light_ok, fence_ok if fence is None else fence,
                         site_type, dist_scrap if dscrap is None else dscrap)
    recent = window_sum(INC_DAY, date, 7)
    repeat = np.where((recent + ADJ @ recent) > 0, 1.5, 1.0)
    fac["recent"] = {k: repeat for k in TYPES}
    dyn = np.ones(N)
    ctx = {"night": shift == "night", "weekend": False, "holiday": False}
    if not neutral:
        if date.weekday() in (4, 5):
            dyn *= 1.3
            ctx["weekend"] = True
        if date in HOLIDAYS:
            dyn *= 2.0
            ctx["holiday"] = True
    dyn = dyn * SHIFT_MULT[shift]
    if drift is not None:
        dyn = dyn * drift
    if boost is not None:
        dyn = dyn * boost
    rates = {k: BASE[k] * combine(fac, k) * dyn for k in TYPES}
    return rates, fac, ctx


def overall(rates):
    surv = np.ones(N)
    for k in TYPES:
        surv *= np.exp(-rates[k])
    return 1 - surv


def probs(rates):
    return {k: 1 - np.exp(-rates[k]) for k in TYPES}


# tonight's forecast sets the level thresholds (60/20/10/6/4% of zones)
TONIGHT = dt.date(2026, 11, 21)
_r_tonight, _, _ = rates_for(TONIGHT, "night")
_risk_tonight = overall(_r_tonight)
CUTS = np.quantile(_risk_tonight, [0.60, 0.80, 0.90, 0.96])


def level_of(risk):
    return 1 + (np.asarray(risk)[..., None] >= CUTS).sum(axis=-1)


def n30_by_type(date):
    return {k: window_sum(INC_DAY_T[k], date, 30) for k in TYPES}


def reasons_for(i, rates, fac, ctx, date, shift, k_ctx=None):
    tot = sum(rates[k][i] for k in TYPES)
    w = {name: sum(rates[k][i] * math.log(f[k][i]) for k in TYPES) / tot for name, f in fac.items()}
    n30 = n30_by_type(date)
    texts = []
    for name, wt in sorted(w.items(), key=lambda kv: -kv[1]):
        if wt < 0.04:
            continue
        if name == "status":
            texts.append({"empty": "موقع خالٍ", "under_construction": "موقع قيد الإنشاء", "closed": "موقع مغلق"}[status_at(date)[i]])
        elif name == "metal":
            texts.append(f"موقع {R.SITE_AR[site_type[i]]}")
        elif name == "lighting":
            texts.append("إنارة معطلة")
        elif name == "fence":
            texts.append("سياج متضرر")
        elif name == "scrapdist":
            texts.append(f"على بعد {int(round(dist_scrap[i] / 50) * 50)} م من حوش سكراب")
        elif name == "recent":
            dom = max(TYPES, key=lambda k: n30[k][i])
            if n30[dom][i] >= 1:
                texts.append(f"{R.bal(int(n30[dom][i]))} {R.TYPE_WORD[dom]} خلال 30 يوماً")
            else:
                texts.append("بلاغ في منطقة مجاورة خلال 7 أيام")
    extra = []
    if ctx["holiday"]:
        extra.append("إجازة رسمية — المواقع شبه خالية")
    if ctx["night"]:
        extra.append("فترة ليلية")
    if ctx["weekend"]:
        extra.append("عطلة نهاية الأسبوع")
    protective = []
    if status_at(date)[i] == "producing":
        protective.append("موقع منتج ومشغّل")
    if lighting_ok[i] and fence_ok[i]:
        protective.append("إنارة وسياج سليمان")
    if sum(n30[k][i] for k in TYPES) == 0:
        protective.append("لا بلاغات خلال 30 يوماً")
    return (texts + extra + protective)[:3]


def zone_entries(date, shift, **kw):
    rates, fac, ctx = rates_for(date, shift, **kw)
    risk, p = overall(rates), probs(rates)
    lv = level_of(risk)
    mx = float(risk.max())
    out = []
    for i in range(N):
        out.append({"id": ZID[i], "risk": r3(risk[i]), "score": int(round(100 * risk[i] / mx)), "level": int(lv[i]),
                    "by_type": {k: r3(p[k][i]) for k in TYPES},
                    "reasons_ar": reasons_for(i, rates, fac, ctx, date, shift)})
    return out, risk, lv


# ───────────────────────── planner + simulator ─────────────────────────
def dist_km(a, b):
    return float(np.linalg.norm(XY[a] - XY[b]))


def travel_min(a, b):
    return dist_km(a, b) * ROAD_FACTOR / SPEED_KMH * 60


def build_plan(risk, n_cars, per_car=4):
    """Pick the n_cars*per_car riskiest zones, split them along the city axis into one territory per car, order stops."""
    sel = np.argsort(-risk)[:n_cars * per_car]
    sel = sel[np.argsort(along[sel])]
    cars = []
    for c, members in enumerate(np.array_split(sel, n_cars)):
        top = [int(z) for z in members[np.argsort(-risk[members])]]
        seq, rest = [top[0]], top[1:]
        while rest:
            nxt = min(rest, key=lambda z: dist_km(z, seq[-1]))
            seq.append(nxt)
            rest.remove(nxt)
        cars.append({"id": f"P{c + 1}", "segs": retime(seq, risk)})
    return cars


def retime(seq, risk):
    w = np.array([max(risk[z], 1e-9) for z in seq])
    dur = np.maximum(480 * w / w.sum(), 60.0)
    dur = dur * 480 / dur.sum()
    b = np.round(np.cumsum(dur) / 5) * 5
    b[-1] = 480
    starts = np.concatenate([[0], b[:-1]])
    return [(int(z), float(s), float(e)) for z, s, e in zip(seq, starts, b)]


def car_pos(segs, t):
    for i, (z, s, e) in enumerate(segs):
        if s <= t < e or (i == len(segs) - 1 and t >= s):
            if i > 0:
                pz = segs[i - 1][0]
                tr = min(travel_min(pz, z), 0.5 * (e - s))
                if tr > 0 and t < s + tr:
                    f = (t - s) / tr
                    return XY[pz] * (1 - f) + XY[z] * f
            return XY[z]
    return XY[segs[0][0]]


def response(cars, t, z):
    return min(float(np.linalg.norm(car_pos(c["segs"], t) - XY[z])) * ROAD_FACTOR / SPEED_KMH * 60 + DISPATCH_MIN for c in cars)


def evaluate(cars, risk, lv, n=1000, seed=11):
    r = np.random.default_rng(seed)
    zs = r.choice(N, size=n, p=risk / risk.sum())
    ts = r.uniform(0, 480, n)
    rt = np.array([response(cars, t, z) for t, z in zip(ts, zs)])
    high = np.where(lv >= 4)[0]
    grid = np.arange(0, 480, 30)
    visited = {z for c in cars for z, _, _ in c["segs"]}
    zone_rt = {int(z): float(np.mean([response(cars, t, z) for t in grid])) for z in high}
    # coverage = share of level 4-5 zones that get a scheduled patrol visit this shift
    return {"coverage_high_risk_pct": round(100 * sum(1 for z in high if z in visited) / max(1, len(high)), 1),
            "avg_response_min": round(float(rt.mean()), 1), "p90_response_min": round(float(np.percentile(rt, 90)), 1)}, zone_rt


def plan_json(cars, risk, lv, kpis, **extra):
    out = []
    for c in cars:
        out.append({"id": c["id"],
                    "segments": [{"zone": ZID[z], "start": hhmm(s), "end": hhmm(e), "level": int(lv[z])} for z, s, e in c["segs"]],
                    "path": [[r3(LON[z]), r3(LAT[z])] for z, _, _ in c["segs"]]})
    return {"shift": "night", "cars": out, "kpis": kpis, **extra}


# ───────────────────────── plan variants, pattern check, edits ─────────────────────────
def kpi_of(cars, risk, lv):
    k, rt = evaluate(cars, risk, lv)
    return k, rt


def rebuild_car(car, seq, risk):
    return {"id": car["id"], "segs": retime(seq, risk)}


def seq_of(car):
    return [z for z, _, _ in car["segs"]]


def start_of(car, z):
    return next(s for zz, s, _ in car["segs"] if zz == z)


def pattern_history(risk_now, cars_now):
    """Replay the last 7 nights of WatcherX plans; flag zones visited in the same 30-min window on >= 5 nights."""
    buckets = []
    for j in range(1, 8):
        date = TONIGHT - dt.timedelta(days=j)
        rj = overall(rates_for(date, "night")[0])
        cj = build_plan(rj, 6)
        buckets.append({z: int(s // 30) for c in cj for z, s, _ in c["segs"]})
    flagged = []
    for ci, c in enumerate(cars_now):
        for z, s, _ in c["segs"]:
            n = sum(1 for b in buckets if b.get(z) == int(s // 30))
            if n >= 5:
                flagged.append((risk_now[z], ci, z, n))
    flagged.sort(reverse=True)
    return flagged


def alternatives(cars, ci, z, risk, lv, rl):
    car = cars[ci]
    seq = seq_of(car)
    old = start_of(car, z)
    cands = [seq[::-1]] + [seq[k:] + seq[:k] for k in range(1, len(seq))]
    out = []
    for cand in cands:
        nc = rebuild_car(car, cand, risk)
        new = start_of(nc, z)
        if abs(new - old) >= 60 and all(abs(new - o["start"]) >= 30 for o in out):
            plan = [nc if i == ci else c for i, c in enumerate(cars)]
            out.append({"start": new, "cars": plan})
        if len(out) == 2:
            break
    return out


def main():
    print(f"zones={N} incidents={len(INCIDENTS)} boundary_km2={boundary.area * KM_LAT * KM_LON:.1f}")
    zones = zones_json()
    dump("zones.json", zones)
    dump("boundary.json", boundary_feature)
    dump("incidents.json", [{k: v for k, v in x.items() if k not in ("zi", "date")} for x in INCIDENTS])
    dump("yards.json", [{"center": [r3(CENTER_LON + y[0] / KM_LON), r3(CENTER_LAT + y[1] / KM_LAT)]} for y in YARDS])

    # forecast: next shifts
    shifts_out = {}
    for s, date in (("night", TONIGHT), ("morning", TONIGHT + dt.timedelta(days=1)), ("evening", TONIGHT + dt.timedelta(days=1))):
        entries, _, _ = zone_entries(date, s)
        shifts_out[s] = {"date": date.isoformat(), "label_ar": R.SHIFT_FULL_AR[s], "zones": entries}
    dump("forecast_next_shift.json", {"generated_at": NOW.isoformat(), "default_shift": "night",
                                      "cuts": [r3(c) for c in CUTS], "shifts": shifts_out})
    entries_t = {e["id"]: e for e in shifts_out["night"]["zones"]}
    risk_t, lv_t = _risk_tonight, level_of(_risk_tonight)
    print("levels tonight:", np.bincount(lv_t, minlength=6)[1:])

    # forecast: 7 days
    g = np.clip(np.sqrt((INC_DAY[-14:].sum(0) + 1) / (INC_DAY[-28:-14].sum(0) + 1)), 0.75, 1.5)
    dates7 = [TONIGHT + dt.timedelta(days=j) for j in range(1, 8)]
    steps, risks, daily_expected = [], [], []
    for j, date in enumerate(dates7):
        exp = 0.0
        for s in SHIFTS:
            rates, _, _ = rates_for(date, s, drift=g ** (j / 6))
            risks.append(overall(rates))
            steps.append({"date": date.isoformat(), "shift": s})
            exp += sum(float(rates[k].sum()) for k in TYPES)
        daily_expected.append({"date": date.isoformat(), "label_ar": R.date_ar(date), "expected_incidents": round(exp, 1)})
    risks = np.array(risks)  # (21, N)
    avg = risks.mean(axis=0)
    cuts_avg = np.quantile(avg, [0.60, 0.80, 0.90, 0.96])
    r_first = overall(rates_for(dates7[0], "night", neutral=True)[0])
    r_last = overall(rates_for(dates7[-1], "night", neutral=True, drift=g)[0])
    change = (r_last / r_first - 1) * 100
    z7 = []
    for i in range(N):
        rates, fac, ctx = rates_for(dates7[0], "night", drift=1.0)
        z7.append({"id": ZID[i], "avg_risk": r3(avg[i]), "level": int(1 + (avg[i] >= cuts_avg).sum()),
                   "risk": [r3(x) for x in risks[:, i]], "levels": [int(x) for x in level_of(risks[:, i])],
                   "change_pct": int(round(change[i])),
                   "trend": "rising" if change[i] >= 10 else "falling" if change[i] <= -10 else "flat",
                   "reasons_ar": reasons_for(i, rates, fac, ctx, dates7[0], "night")})
    rising = sorted(z7, key=lambda z: -z["change_pct"])[:5]
    dump("forecast_7d.json", {"generated_at": NOW.isoformat(), "steps": steps, "zones": z7, "city_daily": daily_expected,
                              "rising_top5": [{"id": z["id"], "change_pct": z["change_pct"]} for z in rising]})

    # plans
    proposed = build_plan(risk_t, 6)
    baseline = baseline_plan()
    k_prop, rt_prop = evaluate(proposed, risk_t, lv_t)
    k_base, rt_base = evaluate(baseline, risk_t, lv_t)
    print("proposed", k_prop, "baseline", k_base)

    flagged = pattern_history(risk_t, proposed)
    print("pattern flagged:", [(ZID[z], n) for _, _, z, n in flagged])
    warnings, alt_plans = [], []
    scripted = False
    if not flagged:  # make sure the repeat-pattern story exists even if the replay finds none
        scripted = True
        ci = 0
        z = max(proposed[ci]["segs"], key=lambda sg: risk_t[sg[0]])[0]
        flagged = [(risk_t[z], ci, z, 5)]
    for _, ci, z, n in flagged[:2]:
        alts = alternatives(proposed, ci, z, risk_t, lv_t, None)
        warn = {"zone": ZID[z], "car": proposed[ci]["id"], "time": hhmm(int(start_of(proposed[ci], z) // 30) * 30),
                "nights": n, "scripted": scripted, "alternatives": []}
        for a in alts:
            kp, _ = evaluate(a["cars"], risk_t, lv_t)
            vid = f"alt_{len(alt_plans)}"
            alt_plans.append({"id": vid, "zone": ZID[z], "plan": plan_json(a["cars"], risk_t, lv_t, kp, pattern_warnings=[])})
            warn["alternatives"].append({"time": hhmm(int(a["start"] // 30) * 30), "variant": vid})
        warn["text_ar"] = (f"{R.zone_label(ZID[z])} تمت تغطيتها الساعة {warn['time']} ل{R.NIGHTS.get(n, str(n) + ' ليالٍ')} "
                           f"متتالية — نمط يمكن توقعه.")
        warnings.append(warn)
    proposed_json = plan_json(proposed, risk_t, lv_t, k_prop, pattern_warnings=warnings,
                              baseline_kpis=k_base,
                              settings={"cars": 6, "speed_kmh": SPEED_KMH, "road_factor": ROAD_FACTOR, "dispatch_min": DISPATCH_MIN,
                                        "target_min": 10, "shift_label_ar": R.SHIFT_FULL_AR["night"]})
    dump("plan_proposed.json", proposed_json)
    dump("plan_baseline.json", plan_json(baseline, risk_t, lv_t, k_base))

    # variants: 4 cars, edit options
    four = build_plan(risk_t, 4)
    k4, rt4 = evaluate(four, risk_t, lv_t)
    high = [int(z) for z in np.where(lv_t >= 4)[0]]
    vis6 = {z for c in proposed for z, _, _ in c["segs"]}
    vis4 = {z for c in four for z, _, _ in c["segs"]}
    worse = sorted(high, key=lambda z: -(rt4[z] - rt_prop[z]))[:3]
    four_json = plan_json(four, risk_t, lv_t, k4, pattern_warnings=[],
                          compare_with=k_prop,
                          lost_visits=[{"zone": ZID[z], "level": int(lv_t[z])} for z in high if z in vis6 and z not in vis4],
                          slower_zones=[{"zone": ZID[z], "from_min": round(rt_prop[z], 1), "to_min": round(rt4[z], 1)} for z in worse])
    edit_options = []
    for ci in (0, 2, 4):
        car = proposed[ci]
        z = min(seq_of(car), key=lambda zz: risk_t[zz])
        others = [k for k in range(6) if k != ci]
        tj = min(others, key=lambda k: min(dist_km(z, zz) for zz in seq_of(proposed[k])))
        new = [dict(c) for c in proposed]
        new[ci] = rebuild_car(car, [zz for zz in seq_of(car) if zz != z], risk_t)
        new[tj] = rebuild_car(proposed[tj], seq_of(proposed[tj]) + [z], risk_t)
        ke, _ = evaluate(new, risk_t, lv_t)
        edit_options.append({"id": f"edit_{ci}", "zone": ZID[z], "from_car": car["id"], "to_car": proposed[tj]["id"],
                             "label_ar": f"نقل {R.zone_label(ZID[z])} من الدورية {ci + 1} إلى الدورية {tj + 1}",
                             "plan": plan_json(new, risk_t, lv_t, ke, pattern_warnings=[])})
    dump("plan_variants.json", {"four_cars": four_json, "alternatives": alt_plans, "edit_options": edit_options})

    return locals()




# ───────────────────────── agent content ─────────────────────────
def trace(*steps):
    return [{"label": s, "ms": int(_rs.integers(280, 620))} for s in steps]


def insert_visit(segs, z, s, e):
    out = []
    for zz, ss, ee in segs:
        if ee <= s or ss >= e:
            out.append((zz, ss, ee))
        else:
            if ss < s:
                out.append((zz, ss, s))
            if ee > e:
                out.append((zz, e, ee))
    out.append((z, s, e))
    return sorted(out, key=lambda x: x[1])


def content(c):
    proposed, baseline = c["proposed"], c["baseline"]
    risk_t, lv_t, entries_t = c["risk_t"], c["lv_t"], c["entries_t"]
    k_prop, k_base = c["k_prop"], c["k_base"]
    four_json = json.load(open(OUT / "plan_variants.json"))["four_cars"]
    zl = lambda i: R.zone_label(ZID[i])  # noqa: E731
    stop_zones = {z for car in proposed for z, _, _ in car["segs"]}

    # ── S3 alerts: three scripted new reports ──
    stops = [(ci, z) for ci, car in enumerate(proposed) for z, _, _ in car["segs"]]
    terr = np.array([min(stops, key=lambda cz: dist_km(i, cz[1]))[0] for i in range(N)])
    specs = [("A1", 74, "theft", 1, "سرقة كيابل"), ("A2", 162, "breakin", 3, "اقتحام موقع"), ("A3", 310, "scrap", 4, "حوش سكراب مشتبه به")]
    used, alerts = set(), []
    for aid, minute, typ, car_idx, title in specs:
        n7 = window_sum(INC_DAY_T[typ], TONIGHT, 7)

        def ok(i):
            if i in stop_zones or i in used:
                return False
            if typ == "theft":
                return site_type[i] in ("metal", "electrical") or site_status[i] in ("empty", "under_construction", "closed")
            if typ == "breakin":
                return site_status[i] in ("empty", "under_construction", "closed")
            return dist_scrap[i] < 1000
        pool = [i for i in range(N) if ok(i) and terr[i] == car_idx] or [i for i in range(N) if ok(i)]
        z = max(pool, key=lambda i: (n7[i] >= 1, risk_t[i]))
        used.add(z)
        boost = np.ones(N)
        boost[z] = 2.0
        boost[NBR[z]] = 1.5
        risk_b = overall(rates_for(TONIGHT, "night", boost=boost)[0])
        lv_b = level_of(risk_b)
        near = [z] + NBR[z]
        # nearest car at the time of the report
        etas = [(float(np.linalg.norm(car_pos(car["segs"], minute) - XY[z])) * ROAD_FACTOR / SPEED_KMH * 60 + DISPATCH_MIN, ci)
                for ci, car in enumerate(proposed)]
        eta, ci = min(etas)
        eta = int(math.ceil(eta))
        s0 = minute + int(math.ceil(eta / 5) * 5)
        e0 = min(480, s0 + 120)
        new = [dict(cc) for cc in proposed]
        new[ci] = {"id": proposed[ci]["id"], "segs": insert_visit(proposed[ci]["segs"], z, s0, e0)}
        k_before, _ = evaluate(proposed, risk_b, lv_b)
        k_after, _ = evaluate(new, risk_b, lv_b)
        parts = []
        if k_after["coverage_high_risk_pct"] - k_before["coverage_high_risk_pct"] >= 1:
            parts.append(f"+{k_after['coverage_high_risk_pct'] - k_before['coverage_high_risk_pct']:.0f}% تغطية")
        if k_before["avg_response_min"] - k_after["avg_response_min"] >= 0.2:
            parts.append(f"−{k_before['avg_response_min'] - k_after['avg_response_min']:.1f} دقيقة استجابة")
        parts.append(f"زمن الوصول المتوقع {eta} دقائق")
        k = int(n7[z]) + 1
        site = entries_t[ZID[z]]
        word = R.TYPE_WORD[typ]
        alerts.append({
            "id": aid, "time": hhmm(minute), "zone": ZID[z], "type": typ, "title_ar": title,
            "toast_ar": f"بلاغ جديد: {title} — {zl(z)} — {hhmm(minute)}",
            "note_ar": {"theft": "سرقة كيابل نحاسية من موقع " + R.STATUS_AR[site_status[z]], "breakin": "اقتحام موقع " + R.STATUS_AR[site_status[z]],
                        "scrap": "حوش سكراب مخالف قرب الموقع"}[typ],
            "risk_updates": [{"zone": ZID[j], "before": r3(risk_t[j]), "after": r3(risk_b[j]), "level_before": int(lv_t[j]),
                              "level_after": int(lv_b[j])} for j in near],
            "suggestion": {
                "car": proposed[ci]["id"], "car_num": ci + 1, "eta_min": eta, "from": hhmm(s0), "to": hhmm(e0),
                "title_ar": f"انقل الدورية {ci + 1} إلى {zl(z)} والمناطق المجاورة",
                "reasons_ar": [f"{R.bal(k)} {word} في المنطقة خلال 7 أيام", R.site_summary(site_type[z], site_status[z]),
                               f"أقرب دورية على بعد {eta} دقائق"],
                "impact_ar": " · ".join(parts)},
            "kpis_before": k_before, "kpis_after": k_after,
            "plan_after": plan_json(new, risk_b, lv_b, k_after, pattern_warnings=[]),
        })
    dump("alerts.json", {"events": alerts})
    print("alerts:", [(a["id"], a["zone"], a["suggestion"]["car"], a["suggestion"]["impact_ar"]) for a in alerts])

    # ── M3 hotspots ──
    weekly = np.array([INC_DAY[DAYS - 7 * (w + 1):DAYS - 7 * w].sum(0) for w in range(12)])  # newest first
    flagged = (weekly[:4] >= 1).sum(axis=0)
    total4 = weekly[:4].sum(axis=0)
    order = sorted(range(N), key=lambda i: (-flagged[i], -total4[i]))
    cand = [i for i in order if flagged[i] >= 3] or [i for i in order if flagged[i] >= 2]

    def opts(i):
        o = []
        if not lighting_ok[i]:
            o.append("lighting")
        if site_status[i] in ("empty", "under_construction") and not fence_ok[i]:
            o.append("fence")
        if dist_scrap[i] < 1500:
            o.append("scrap")
        if site_status[i] == "closed":
            o.append("investor")
        return o
    chosen, yards_used = [], set()
    yard_of = lambda i: int(np.argmin([np.linalg.norm(XY[i] - y) for y in YARDS]))  # noqa: E731
    for kind in ("lighting", "fence", "scrap", "investor"):
        pick_i = next((i for i in cand + order if kind in opts(i) and i not in [x for x, _ in chosen] and flagged[i] >= 2), None)
        if pick_i is not None:
            chosen.append((pick_i, kind))
            if kind == "scrap":
                yards_used.add(yard_of(pick_i))
    for i in cand:
        if len(chosen) >= 6:
            break
        o = [k for k in opts(i) if not (k == "scrap" and yard_of(i) in yards_used)]
        if i not in [x for x, _ in chosen] and o:
            chosen.append((i, o[0]))
            if o[0] == "scrap":
                yards_used.add(yard_of(i))
    hotspots = []
    for n_, (i, kind) in enumerate(chosen):
        kw = {}
        if kind == "lighting":
            li = lighting_ok.copy()
            li[i] = True
            kw["light_ok"] = li
            text = f"إصلاح {int(broken_poles[i])} أعمدة إنارة معطلة في {zl(i)}"
            done = "أُرسلت كمهمة إلى الصيانة"
        elif kind == "fence":
            fe = fence_ok.copy()
            fe[i] = True
            kw["fence"] = fe
            text = f"تركيب سياج مؤقت حول {'الموقع قيد الإنشاء' if site_status[i] == 'under_construction' else 'الموقع الخالي'} في {zl(i)}"
            done = "أُرسلت كمهمة إلى الصيانة"
        elif kind == "scrap":
            yi = int(np.argmin([np.linalg.norm(XY[i] - y) for y in YARDS]))
            n_theft = sum(1 for x in INCIDENTS if x["type"] == "theft" and dt.date.fromisoformat(x["date"]) > LAST_DAY - dt.timedelta(days=90)
                          and np.linalg.norm(XY[x["zi"]] - YARDS[yi]) <= 1.0)
            ds = dist_scrap.copy()
            ds[i] = 5000
            kw["dscrap"] = ds
            text = f"إبلاغ الشرطة عن حوش سكراب مشتبه به قرب {zl(i)} — {R.bal(n_theft)} سرقة كيابل خلال كيلومتر واحد منه"
            done = "أُرسل البلاغ إلى الشرطة"
        else:
            fe = fence_ok.copy()
            fe[i] = True
            st = status_at(TONIGHT).copy()
            st[i] = "producing"
            kw["fence"], kw["status"] = fe, st
            text = f"التواصل مع مستثمر الموقع المغلق في {zl(i)} لتأمين المدخل"
            done = "أُرسلت كمهمة إلى علاقات المستثمرين"
        after = overall(rates_for(TONIGHT, "night", **kw)[0])[i]
        la, lb = int(level_of(after)), int(lv_t[i])
        drop = round(100 * (1 - after / risk_t[i]))
        effect = (f"يُتوقع خفض مستوى الخطورة الليلية من {R.LEVEL_AR[lb]} إلى {R.LEVEL_AR[la]}" if la < lb
                  else f"يُتوقع خفض الخطورة الليلية بنحو {drop}%")
        types = {k: float(INC_DAY_T[k][-28:, i].sum()) for k in TYPES}
        hotspots.append({"id": f"H{n_ + 1}", "zone": ZID[i], "weeks_flagged": int(flagged[i]), "incidents_4w": int(total4[i]),
                         "weekly": [int(x) for x in weekly[::-1, i]], "main_type": max(types, key=types.get),
                         "cause_ar": " · ".join(entries_t[ZID[i]]["reasons_ar"]), "site_summary_ar": R.site_summary(site_type[i], site_status[i]),
                         "level_now": lb, "level_after": la, "center": [r3(LON[i]), r3(LAT[i])],
                         "fix": {"kind": kind, "text_ar": text, "effect_ar": effect, "approved_ar": done}})
    dump("hotspots.json", hotspots)
    print("hotspots:", [(h["zone"], h["fix"]["kind"], h["weeks_flagged"]) for h in hotspots])

    # ── M2 KPIs: replay the last 12 weeks, current plan vs the WatcherX plan ──
    by_night = {}
    for x in INCIDENTS:
        if x["shift"] == "night":
            by_night.setdefault(x["date"], []).append(x)
    weeks = []
    for w in range(12):
        end = LAST_DAY - dt.timedelta(days=7 * (11 - w))
        start = end - dt.timedelta(days=6)
        rc, rw, cc, cw = [], [], [], []
        for k in range(7):
            date = start + dt.timedelta(days=k)
            rj = overall(rates_for(date, "night")[0])
            lvj = level_of(rj)
            plan = build_plan(rj, 6)
            for x in by_night.get(date.isoformat(), []):
                t = (dt.datetime.fromisoformat(x["ts"]) - dt.datetime.combine(date, dt.time(22), TZ)).total_seconds() / 60
                rc.append(response(baseline, t, x["zi"]))
                rw.append(response(plan, t, x["zi"]))
            hi = np.where(lvj >= 4)[0]
            cw.append(100 * sum(1 for z in hi if z in {zz for cc_ in plan for zz, _, _ in cc_["segs"]}) / max(1, len(hi)))
            cc.append(100 * sum(1 for z in hi if z in {zz for cc_ in baseline for zz, _, _ in cc_["segs"]}) / max(1, len(hi)))
        d0 = DAYS - 7 * (12 - w)
        wk_inc = [x for x in INCIDENTS if start.isoformat() <= x["date"] <= end.isoformat()]
        weeks.append({"label_ar": R.range_ar(start, end), "start": start.isoformat(), "end": end.isoformat(),
                      "incidents": {"total": len(wk_inc), **{k: sum(1 for x in wk_inc if x["type"] == k) for k in TYPES}},
                      "resp_current": round(float(np.mean(rc)), 1), "resp_watcherx": round(float(np.mean(rw)), 1),
                      "p90_current": round(float(np.percentile(rc, 90)), 1), "p90_watcherx": round(float(np.percentile(rw, 90)), 1),
                      "coverage_current": round(float(np.mean(cc)), 1), "coverage_watcherx": round(float(np.mean(cw)), 1),
                      "night_incidents": len(rc)})
    rr = np.random.default_rng(SEED + 3)
    appr = np.clip(58 + 2.5 * np.arange(12) + rr.normal(0, 2, 12), 50, 92)
    for w, a in zip(weeks, appr):
        w["approval_rate"] = round(float(a))
    last4, prev4 = weeks[-4:], weeks[-8:-4]
    mean = lambda ws, k: float(np.mean([w[k] for w in ws]))  # noqa: E731
    inc30, inc_prev30 = int(INC_DAY[-30:].sum()), int(INC_DAY[-60:-30].sum())
    pctd = lambda a, b: round(100 * (a - b) / b) if b else 0  # noqa: E731
    kpis = {
        "weeks": weeks,
        "tiles": {
            "avg_response_min": {"value": round(mean(last4, "resp_watcherx"), 1), "current_plan": round(mean(last4, "resp_current"), 1),
                                 "change_pct": pctd(mean(last4, "resp_watcherx"), mean(last4, "resp_current"))},
            "coverage_high_risk_pct": {"value": round(mean(last4, "coverage_watcherx")), "current_plan": round(mean(last4, "coverage_current")),
                                       "change_pts": round(mean(last4, "coverage_watcherx") - mean(last4, "coverage_current"))},
            "incidents_30d": {"value": inc30, "previous": inc_prev30, "change_pct": pctd(inc30, inc_prev30)},
            "approval_rate": {"value": round(mean(last4, "approval_rate")), "previous": round(mean(prev4, "approval_rate")),
                              "change_pts": round(mean(last4, "approval_rate") - mean(prev4, "approval_rate"))},
        },
    }
    dump("kpis.json", kpis)

    # ── metrics.json ──
    test_start = LAST_DAY - dt.timedelta(days=29)
    n_top = int(math.ceil(0.10 * N))
    score = sum(overall(rates_for(test_start, s)[0]) for s in SHIFTS)
    top_model = set(np.argsort(-score)[:n_top])
    prev_cnt = window_sum(INC_DAY, test_start, 30)
    top_base = set(np.argsort(-prev_cnt, kind="stable")[:n_top])
    test_inc = [x for x in INCIDENTS if x["date"] >= test_start.isoformat()]
    hit = lambda top: round(100 * sum(1 for x in test_inc if x["zi"] in top) / len(test_inc), 1)  # noqa: E731
    metrics = {"method": "rule-based illustrative on synthetic data (Tier 1, no trained model)",
               "test_window": f"{test_start.isoformat()}..{LAST_DAY.isoformat()}", "zones": N, "test_incidents": len(test_inc),
               "hit_rate_top10_model": hit(top_model), "hit_rate_top10_baseline": hit(top_base),
               "coverage_high_risk_pct": {"proposed": k_prop["coverage_high_risk_pct"], "current": k_base["coverage_high_risk_pct"]},
               "avg_response_min": {"proposed": k_prop["avg_response_min"], "current": k_base["avg_response_min"]},
               "p90_response_min": {"proposed": k_prop["p90_response_min"], "current": k_base["p90_response_min"]},
               "cars": 6, "label_ar": "أرقام توضيحية على بيانات افتراضية"}
    dump("metrics.json", metrics)
    print("metrics:", metrics)

    # ── M4 weekly brief ──
    wk, pw = weeks[-1], weeks[-2]
    top_type = max(TYPES, key=lambda k: wk["incidents"][k])
    north_light = len(LIGHT_FAULT_SINCE)
    north_now = int(sum(INC_DAY_T["theft"][-30:, north].sum(1)))
    north_prev = int(sum(INC_DAY_T["theft"][-60:-30, north].sum(1)))
    rising = json.load(open(OUT / "forecast_7d.json"))["rising_top5"][:2]
    t_tile = kpis["tiles"]
    d_inc = pctd(wk["incidents"]["total"], pw["incidents"]["total"])
    sign = lambda v: f"+{v}%" if v > 0 else f"−{abs(v)}%"  # noqa: E731
    brief = {
        "title_ar": "الملخص الأسبوعي — المدينة الصناعية الثانية بالرياض",
        "range_ar": R.range_ar(dt.date.fromisoformat(wk["start"]), dt.date.fromisoformat(wk["end"])),
        "author_ar": "أعدّه وكيل WatcherX · الأحد 22 نوفمبر 07:00",
        "headline": [
            {"label_ar": "البلاغات هذا الأسبوع", "value": wk["incidents"]["total"], "unit_ar": "بلاغ", "delta_ar": f"{sign(d_inc)} عن الأسبوع السابق",
             "good": d_inc <= 0},
            {"label_ar": "متوسط زمن الاستجابة (خطة WatcherX)", "value": wk["resp_watcherx"], "unit_ar": "دقيقة",
             "delta_ar": f"{sign(pctd(wk['resp_watcherx'], wk['resp_current']))} عن الخطة الحالية", "good": wk["resp_watcherx"] <= wk["resp_current"]},
            {"label_ar": "تغطية المناطق عالية الخطورة", "value": round(wk["coverage_watcherx"]), "unit_ar": "%",
             "delta_ar": f"{wk['coverage_watcherx'] - wk['coverage_current']:+.0f} نقطة عن الخطة الحالية".replace("-", "−"), "good": True}],
        "intro_ar": f"هذا ملخص أسبوع {R.range_ar(dt.date.fromisoformat(wk['start']), dt.date.fromisoformat(wk['end']))}. "
                    f"الأرقام محسوبة على بيانات افتراضية لأغراض العرض.",
        "changed_ar": [
            f"سجّلنا {wk['incidents']['total']} بلاغاً هذا الأسبوع مقابل {pw['incidents']['total']} في الأسبوع السابق. "
            f"أكثر الأنواع تكراراً: {R.TYPE_FULL[top_type]} ({wk['incidents'][top_type]} بلاغاً).",
            f"{'ارتفعت' if north_now > north_prev else 'انخفضت'} السرقات في المنطقة الشمالية من {north_prev} إلى {north_now} بلاغاً خلال 30 يوماً، "
            f"بعد إغلاق موقعين وتعطل الإنارة في {north_light} مناطق.",
            "أكثر المناطق ارتفاعاً في توقعات الأسبوع القادم: " + "، ".join(f"{R.zone_label(r['id'])} (+{r['change_pct']}%)" for r in rising) + ".",
        ],
        "worked_ar": [
            f"لو طُبّقت خطة WatcherX خلال الأسبوع لانخفض متوسط زمن الاستجابة من {wk['resp_current']} إلى {wk['resp_watcherx']} دقيقة "
            f"(محاكاة على بلاغات الأسبوع الفعلية).",
            f"الخطة المقترحة تزور {round(wk['coverage_watcherx'])}% من المناطق عالية الخطورة، مقابل {round(wk['coverage_current'])}% للخطة الحالية.",
        ],
        "decisions": [{"id": f"D{n_ + 1}", "hotspot": h["id"], "text_ar": h["fix"]["text_ar"], "effect_ar": h["fix"]["effect_ar"]}
                      for n_, h in enumerate(hotspots[:3])],
    }
    dump("weekly_brief.json", brief)

    # ── chats ──
    top_z = int(np.argmax(risk_t))
    e_top = entries_t[ZID[top_z]]
    last_inc = [x for x in INCIDENTS if x["zi"] == top_z][-3:]
    rt_rows = [(t, e_top["by_type"][t]) for t in TYPES]
    rng_p = np.random.default_rng(SEED + 5)
    seen = set()
    for _ in range(3):
        down = rng_p.random(6) < 0.1
        for gi, g_ in enumerate(BASE_GROUPS):
            if not down[gi]:
                seen |= set(g_)
    unseen = [i for i in np.argsort(-risk_t) if lv_t[i] >= 3 and i not in seen][:5]
    in_plan = [i for i in unseen if i in stop_zones]
    k4, k6 = four_json["kpis"], k_prop
    chat_sup = [
        {"q": "دوريتان معطلتان الليلة، ما أفضل خطة؟", "keywords": ["معطل", "دوريتان", "دورية", "عطل", "4"],
         "trace": trace("جلب التوقعات", "تخطيط الدوريات (4 دوريات)", "محاكاة الخطة"),
         "answer_md": (f"أعدت التخطيط بأربع دوريات. الخطة الجديدة تزور **{k4['coverage_high_risk_pct']:.0f}%** من المناطق عالية الخطورة "
                       f"(مقابل {k6['coverage_high_risk_pct']:.0f}% بست دوريات)، ومتوسط زمن الاستجابة **{k4['avg_response_min']} دقيقة** "
                       f"(مقابل {k6['avg_response_min']}).\n\n"
                       + ("المناطق التي تفقد زيارة: " + "، ".join(R.zone_label(x['zone']) for x in four_json["lost_visits"]) + ".\n\n"
                          if four_json["lost_visits"] else "")
                       + "أكثر المناطق تباطؤاً في الاستجابة: " + "، ".join(
                           f"{R.zone_label(x['zone'])} ({x['from_min']}←{x['to_min']} دقيقة)" for x in four_json["slower_zones"]) + ".\n\n"
                       "هذا اقتراح فقط، والقرار لك."),
         "attachment": {"type": "plan_compare", "variant": "four_cars"}},
        {"q": f"لماذا {R.zone_label(ZID[top_z])} حرجة الليلة؟", "keywords": ["لماذا", "حرجة", "الخطورة", str(top_z + 1)],
         "trace": trace("جلب التوقعات", "تفسير الخطورة"),
         "answer_md": (f"{R.zone_label(ZID[top_z])} في المستوى **{R.LEVEL_AR[int(lv_t[top_z])]}** الليلة. الأسباب:\n"
                       + "\n".join(f"- {r}" for r in e_top["reasons_ar"]) + "\n\nآخر البلاغات في هذه المنطقة:\n"
                       + ("\n".join(f"- {x['note_ar']} ({x['date']})" for x in last_inc) if last_inc else "- لا بلاغات سابقة.")),
         "attachment": {"type": "zone_reasons", "zone": ZID[top_z], "by_type": e_top["by_type"], "level": int(lv_t[top_z])}},
        {"q": "ما المناطق التي لم تُغطَّ منذ 3 ليالٍ؟", "keywords": ["لم", "تغطى", "تُغطَّ", "3", "ثلاث", "ليالٍ", "منذ"],
         "trace": trace("جلب بيانات الدوريات", "فحص الأنماط"),
         "answer_md": ((f"وجدت **{len(unseen)} مناطق** بخطورة متوسطة أو أعلى لم تزرها أي دورية منذ 3 ليالٍ: "
                        + "، ".join(R.zone_label(ZID[i]) for i in unseen) + ".\n\n"
                        + f"الخطة المقترحة الليلة تزور {len(in_plan)} منها. أقترح إضافة الباقي إلى مسار أقرب دورية.")
                       if unseen else "كل المناطق متوسطة الخطورة أو أعلى زارتها دورية خلال 3 ليالٍ."),
         "attachment": {"type": "zone_list", "zones": [{"zone": ZID[i], "level": int(lv_t[i]), "in_plan": bool(i in stop_zones)} for i in unseen]}},
    ]
    dump("chat_supervisor.json", chat_sup)

    light_zones = [i for i in range(N) if not lighting_ok[i]]
    lz = max(light_zones, key=lambda i: risk_t[i])
    li = lighting_ok.copy()
    li[lz] = True
    after = overall(rates_for(TONIGHT, "night", light_ok=li)[0])[lz]
    seg = next(((s, e) for car in proposed for z, s, e in car["segs"] if z == lz), None)
    freed = round((seg[1] - seg[0]) * (1 - after / risk_t[lz])) if seg else 0
    th_n_prev = north_prev
    closed_n = [i for i in CLOSED_SINCE]
    north_light = int(((~lighting_ok) & north).sum())
    near_yard_n = int(((dist_scrap < 1000) & north).sum())
    cmp_rows = [
        {"label_ar": "متوسط زمن الاستجابة (دقيقة)", "now": t_tile["avg_response_min"]["value"], "prev": round(mean(prev4, "resp_watcherx"), 1)},
        {"label_ar": "تغطية المناطق عالية الخطورة (%)", "now": t_tile["coverage_high_risk_pct"]["value"], "prev": round(mean(prev4, "coverage_watcherx"))},
        {"label_ar": "عدد البلاغات", "now": inc30, "prev": inc_prev30},
        {"label_ar": "نسبة اعتماد توصيات الوكيل (%)", "now": t_tile["approval_rate"]["value"], "prev": t_tile["approval_rate"]["previous"]},
    ]
    chat_mgr = [
        {"q": "لماذا زادت السرقات في المنطقة الشمالية هذا الشهر؟", "keywords": ["لماذا", "زادت", "السرقات", "الشمالية", "شمال"],
         "trace": trace("جلب البلاغات", "تفسير الخطورة"),
         "answer_md": (f"{'ارتفعت' if north_now > north_prev else 'انخفضت'} السرقات في المنطقة الشمالية من **{north_prev}** إلى **{north_now}** بلاغاً خلال 30 يوماً "
                       f"({sign(pctd(north_now, north_prev))}). الأسباب الرئيسية:\n"
                       f"- موقعان تحولا إلى «مغلق» خلال الشهر ("
                       + "، ".join(f"{R.zone_label(ZID[i])} منذ {R.date_ar(CLOSED_SINCE[i])}" for i in closed_n) + ").\n"
                       f"- تعطل الإنارة منذ {R.date_ar(dt.date(2026, 10, 27))} في {len(LIGHT_FAULT_SINCE)} مناطق شمالية.\n"
                       f"- {near_yard_n} {'مناطق' if near_yard_n <= 10 else 'منطقة'} شمالية على بعد أقل من 1 كم من حوش سكراب."),
         "attachment": {"type": "none"}},
        {"q": f"ماذا لو أصلحنا الإنارة في {R.zone_label(ZID[lz])}؟", "keywords": ["ماذا", "لو", "أصلحنا", "الإنارة", "إنارة", str(lz + 1)],
         "trace": trace("جلب التوقعات", "محاكاة سيناريو"),
         "answer_md": (f"بعد إصلاح الإنارة في {R.zone_label(ZID[lz])} تنخفض الخطورة الليلية من **{risk_t[lz] * 100:.1f}%** إلى "
                       f"**{after * 100:.1f}%** (من {R.LEVEL_AR[int(lv_t[lz])]} إلى {R.LEVEL_AR[int(level_of(after))]})."
                       + (f"\n\nويتحرر نحو {freed} دقيقة من وقت الدوريات الليلة." if freed > 0 else "")),
         "attachment": {"type": "scenario", "zone": ZID[lz], "before": r3(risk_t[lz]), "after": r3(after)}},
        {"q": "قارن أداء هذا الشهر بالشهر الماضي", "keywords": ["قارن", "مقارنة", "الشهر", "أداء", "الماضي"],
         "trace": trace("جلب مؤشرات الأداء"),
         "answer_md": "هذه مقارنة مؤشرات الأداء الأربعة بين آخر 4 أسابيع والأسابيع الأربعة السابقة لها.",
         "attachment": {"type": "table", "rows": cmp_rows}},
    ]
    dump("chat_manager.json", chat_mgr)

    dump("meta.json", {
        "city": {"name_ar": "المدينة الصناعية الثانية بالرياض", "center": [CENTER_LON, CENTER_LAT], "zoom": 12.6},
        "cities_soon_ar": ["المدينة الصناعية الثالثة بالرياض", "المدينة الصناعية الثانية بالدمام", "المدينة الصناعية الأولى بجدة"],
        "now": NOW.isoformat(), "last_update_ar": "21:40", "shift_chip_ar": "الوردية الليلية · 22:00–06:00",
        "live_alert_count": len(alerts), "label_ar": "بيانات افتراضية",
        "settings": {"cars": CARS_PER_SHIFT, "target_min": 10, "speed_kmh": SPEED_KMH, "road_factor": ROAD_FACTOR, "dispatch_min": DISPATCH_MIN},
    })


if __name__ == "__main__":
    content(main())
