"""Build src/data/extras.json: lineup efficiency, draft re-do and week-by-week rosters.

Usage: python3 scripts/build-extras.py <cache-dir> src/data/extras.json

Pulls everything from Sleeper's public API (cached in <cache-dir>), plus the
season list from src/data/league.json.

How Trash scores (verified against Sleeper, 54 of 54 slots in a sample week):
each of the 9 starting slots counts ONE game per week, the latest game its
starter played while in the lineup. Managers "lock in" a big game by benching
the player afterwards. So:

  optimal week = best legal lineup where each slot gets one player's best game
                 that week, counting only games played while that player was
                 on the roster (transactions are replayed by timestamp).
  efficiency   = actual points / optimal points.

Draft value uses the same idea: a player's "lock-in value" is the sum of his
best game in each regular-season week, which is what he can actually score
for a Trash team.
"""
import json, os, sys, time, collections, urllib.request, concurrent.futures as cf
from datetime import datetime, timezone

CACHE, OUT = sys.argv[1], sys.argv[2]
os.makedirs(CACHE, exist_ok=True)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEAGUE = json.load(open(os.path.join(ROOT, "src/data/league.json")))
REG_WEEKS = 21


def get(path, fresh=False):
    f = os.path.join(CACHE, path.strip("/").replace("/", "_").replace("?", "_") + ".json")
    if os.path.exists(f) and not fresh:
        return json.load(open(f))
    for i in range(4):
        try:
            d = json.load(urllib.request.urlopen("https://api.sleeper.app" + path, timeout=60))
            json.dump(d, open(f, "w"))
            return d
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError(path)


state = get("/v1/state/nba", fresh=True)
SLOT_OK = {"PG": {"PG"}, "SG": {"SG"}, "G": {"PG", "SG"}, "SF": {"SF"}, "PF": {"PF"},
           "F": {"SF", "PF"}, "C": {"C"}, "UTIL": {"PG", "SG", "SF", "PF", "C"}}

MISFIT = []
players = {}  # pid -> [name, positions, team]


def remember(pid, p, team=None):
    if not p or pid in players and players[pid][0]:
        return
    name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
    players[pid] = [name, p.get("fantasy_positions") or [], team or p.get("team") or ""]


SAMPLES = 8


def consensus(lid, w, live):
    """Sleeper's matchups endpoint returns a different score for the same finished week on
    different requests (one week-3 score came back as 462, 466, 511, 515 or 542.5). Ask several
    times and keep each team's highest reported score, with that sample's lineup. Checked against
    Sleeper's official season totals, the highest variant is by far the closest."""
    path = f"/v1/league/{lid}/matchups/{w}"
    f = os.path.join(CACHE, path.strip("/").replace("/", "_") + ".consensus.json")
    if os.path.exists(f) and not live:
        return json.load(open(f))
    best = {}
    for i in range(SAMPLES):
        for i_try in range(4):
            try:
                rows = json.load(urllib.request.urlopen(f"https://api.sleeper.app{path}?sample={i}-{time.time()}", timeout=60))
                break
            except Exception:
                time.sleep(2 ** i_try)
        else:
            continue
        for m in rows:
            cur = best.get(m["roster_id"])
            if cur is None or (m.get("points") or 0) > (cur.get("points") or 0):
                best[m["roster_id"]] = m
    out = list(best.values())
    json.dump(out, open(f, "w"))
    return out


def best_lineup(slots, cands):
    """cands: [(points, positions)]. Max total with one player per slot (bitmask DP over slots)."""
    n = len(slots)
    dp = {0: 0.0}
    for pts, pos in cands:
        if pts <= 0:
            continue
        ok = [i for i, s in enumerate(slots) if SLOT_OK[s] & set(pos)]
        nxt = dict(dp)
        for mask, v in dp.items():
            for i in ok:
                if not mask >> i & 1:
                    m2 = mask | 1 << i
                    if nxt.get(m2, -1) < v + pts:
                        nxt[m2] = v + pts
        dp = nxt
    return max(dp.values())


out = {"asOf": datetime.now(timezone.utc).isoformat(), "seasons": []}
for s in LEAGUE["seasons"]:
    lid = s["leagueId"]
    lg = get(f"/v1/league/{lid}", fresh=s["status"] != "complete")
    season = lg["season"]
    sc = lg["scoring_settings"]
    slots = [p for p in lg["roster_positions"] if p != "BN"]
    fp = lambda st: sum(st.get(k, 0) * w for k, w in sc.items())
    users = {u["user_id"]: u["display_name"] for u in get(f"/v1/league/{lid}/users")}
    rosters = get(f"/v1/league/{lid}/rosters", fresh=s["status"] != "complete")
    r2n = {r["roster_id"]: users[r["owner_id"]] for r in rosters}
    done = REG_WEEKS if s["status"] == "complete" else max(0, state["week"] - 1)
    weeks = list(range(1, done + 1))
    live = s["status"] != "complete"
    # Playoff weeks (22-24) count for My Guys and the title-run breakdowns, never for the regular-season numbers.
    allweeks = weeks + ([22, 23, 24] if not live else [])
    with cf.ThreadPoolExecutor(8) as ex:
        mus = dict(zip(allweeks, ex.map(lambda w: consensus(lid, w, live), allweeks)))
        txs = dict(zip(allweeks, ex.map(lambda w: get(f"/v1/league/{lid}/transactions/{w}", fresh=live), allweeks)))
        sts = dict(zip(allweeks, ex.map(lambda w: get(f"/stats/nba/{season}/{w}?season_type=regular", fresh=live), allweeks)))

    # Per-game fantasy points, by week.
    games = {w: collections.defaultdict(list) for w in allweeks}
    for w in allweeks:
        for r in sts[w]:
            remember(r["player_id"], r.get("player"), r.get("team"))
            if not r.get("date") or r["player_id"].startswith("TEAM"):
                continue
            # Stats dates are ET game dates; treat tip-off as 7pm ET (23:00 UTC).
            t = datetime.fromisoformat(r["date"] + "T23:00:00+00:00").timestamp() * 1000
            games[w][r["player_id"]].append((t, round(fp(r["stats"]), 1)))

    # Draft (the league's official draft).
    picks = get(f"/v1/draft/{lg['draft_id']}/picks")
    for p in picks:
        m = p.get("metadata") or {}
        if p["player_id"] not in players:
            players[p["player_id"]] = [f"{m.get('first_name', '')} {m.get('last_name', '')}".strip(),
                                       [x for x in (m.get("fantasy_positions") or m.get("position", "")).split(",") if x] if isinstance(m.get("position"), str) else [], m.get("team", "")]
    value = collections.Counter()
    gp = collections.Counter()
    for w in weeks:
        for pid, gl in games[w].items():
            best = max(x[1] for x in gl)
            if best > 0:
                value[pid] += best
            gp[pid] += sum(1 for x in gl if x[1] != 0)
    draft = [{"no": p["pick_no"], "round": p["round"], "pid": p["player_id"], "by": r2n[p["roster_id"]],
              "value": round(value[p["player_id"]], 1), "gp": gp[p["player_id"]]}
             for p in sorted(picks, key=lambda p: p["pick_no"])]

    # Week-by-week rosters, trades, waiver adds.
    rost = {0: {m: [] for m in r2n.values()}}
    for d in draft:
        rost[0][d["by"]].append(d["pid"])
    trades, adds = [], collections.Counter()
    lineups = collections.defaultdict(list)
    playoffs = []
    guys = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0.0]))  # who -> pid -> [weeks, starts, pts]
    wstarts = collections.defaultdict(dict)   # who -> week -> {pid: pts}
    wplayers = collections.defaultdict(dict)  # who -> week -> set(pids)
    games_wk = {}                             # week -> [[a, b, pa, pb]]
    wadds = collections.defaultdict(list)     # week -> [[who, pid]] waiver/free-agent adds
    for w in allweeks:
        po = w > REG_WEEKS
        for m in mus[w]:
            who = r2n[m["roster_id"]]
            if po and m.get("matchup_id") is None:
                continue
            for pid in m.get("players") or []:
                guys[who][pid][0] += 1
            wplayers[who][w] = set(m.get("players") or [])
            ws = {}
            for pid, pts in zip(m.get("starters") or [], m.get("starters_points") or []):
                if pid and pid != "0":
                    guys[who][pid][1] += 1
                    guys[who][pid][2] += pts or 0
                    ws[pid] = round(pts or 0, 1)
            wstarts[who][w] = ws
        if not po:
            pairs = collections.defaultdict(list)
            for m in mus[w]:
                if m.get("matchup_id") is not None:
                    pairs[m["matchup_id"]].append(m)
            games_wk[w] = [[r2n[a["roster_id"]], r2n[b["roster_id"]], round(a["points"] or 0, 1), round(b["points"] or 0, 1)]
                           for a, b in (sorted(v, key=lambda x: x["roster_id"]) for v in pairs.values() if len(v) == 2)]
        if not po:
            rost[w] = {r2n[m["roster_id"]]: m.get("players") or [] for m in mus[w]}
        ev = collections.defaultdict(list)  # manager -> [(ts, pid, +1 add / -1 drop)]
        for t in txs[w]:
            if t["status"] != "complete":
                continue
            ts = t.get("status_updated") or t["created"]
            for pid, rid in (t.get("adds") or {}).items():
                ev[r2n[rid]].append((ts, pid, 1))
                if t["type"] != "trade":
                    adds[r2n[rid]] += 1
                    wadds[w].append([r2n[rid], pid])
            for pid, rid in (t.get("drops") or {}).items():
                ev[r2n[rid]].append((ts, pid, -1))
            if t["type"] == "trade":
                sides = collections.defaultdict(list)
                for pid, rid in (t.get("adds") or {}).items():
                    sides[r2n[rid]].append(pid)
                for pk in t.get("draft_picks") or []:
                    sides[r2n[pk["owner_id"]]].append(f"pick:{pk['season']} R{pk['round']}")
                trades.append({"week": w, "ts": ts, "sides": dict(sides)})
        for m in mus[w]:
            who = r2n[m["roster_id"]]
            evs = sorted(ev[who])
            end = set(m.get("players") or [])
            cand = end | {pid for _, pid, k in evs if k < 0}

            def on_roster(pid, t):
                later = [k for ts, p, k in evs if p == pid and ts > t]
                return (later[0] < 0) if later else pid in end

            pool = []
            for pid in cand:
                gl = [pts for t, pts in games[w].get(pid, []) if on_roster(pid, t)]
                if gl:
                    pool.append((max(gl), players.get(pid, ["", [], ""])[1]))
            opt = best_lineup(slots, pool)
            act = m["points"] or 0
            # Sleeper's own score is the truth; if our replay can't explain it, keep it honest.
            if act > opt + 0.05:
                MISFIT.append((s['code'], w, who, act, round(opt, 1)))
            opt = max(opt, act)
            if po:
                if m.get("matchup_id") is not None:
                    playoffs.append({"week": w, "who": who, "mid": m["matchup_id"], "act": round(act, 1), "opt": round(opt, 1),
                                     "starters": [[p, round(x or 0, 1)] for p, x in zip(m.get("starters") or [], m.get("starters_points") or [])]})
            else:
                lineups[who].append([w, round(act, 1), round(opt, 1)])
    for t in trades:
        for pids in t["sides"].values():
            for pid in pids:
                if not pid.startswith("pick:") and pid not in players:
                    players[pid] = [pid, [], ""]
    # Trade grades: what each side's incoming players actually scored in that manager's starting
    # lineup after the trade (rest of the season, playoffs included), and how long they stayed.
    for t in trades:
        gain = {}
        for who, pids in t["sides"].items():
            got = [p for p in pids if not p.startswith("pick:")]
            later = [w for w in allweeks if w > t["week"]]
            pts = sum(wstarts[who].get(w, {}).get(p, 0) for w in later for p in got)
            held = sum(1 for w in later for p in got if p in wplayers[who].get(w, set()))
            gain[who] = [round(pts, 1), held]
        t["gain"] = gain
    # Weekly recap inputs (regular season).
    weekly = {}
    for w in weeks:
        top = sorted(((pts, who, pid) for who in wstarts for pid, pts in wstarts[who].get(w, {}).items()), reverse=True)[:5]
        adds_w = [[who, pid, wstarts[who].get(w, {}).get(pid, 0)] for who, pid in wadds[w]]
        weekly[str(w)] = {"games": games_wk.get(w, []), "top": [[who, pid, pts] for pts, who, pid in top],
                          "adds": sorted(adds_w, key=lambda x: -x[2])[:5]}
    out["seasons"].append({"code": s["code"], "season": season, "weeks": done, "status": s["status"],
                           "draft": draft, "rosters": {str(k): v for k, v in rost.items()},
                           "trades": [{k: v for k, v in t.items() if k != "ts"} for t in sorted(trades, key=lambda t: t["ts"])],
                           "adds": dict(adds), "lineups": dict(lineups), "playoffs": playoffs,
                           "guys": {who: {pid: [v[0], v[1], round(v[2], 1)] for pid, v in ps.items()} for who, ps in guys.items()},
                           "weekly": weekly})

# Names for anyone still missing (dropped before ever logging a stat, etc).
need = {pid for s in out["seasons"] for r in s["rosters"].values() for ps in r.values() for pid in ps}
need |= {d["pid"] for s in out["seasons"] for d in s["draft"]}
need |= {pid for s in out["seasons"] for ps in s["guys"].values() for pid in ps}
need |= {x[1] for s in out["seasons"] for wk in s["weekly"].values() for x in wk["top"] + wk["adds"]}
miss = [p for p in need if p not in players or not players[p][0]]
if miss:
    allp = get("/v1/players/nba")
    for pid in miss:
        p = allp.get(pid) or {}
        players[pid] = [p.get("full_name") or f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or pid,
                        p.get("fantasy_positions") or [], p.get("team") or ""]
out["players"] = {p: v for p, v in players.items() if p in need or any(
    p in ps for s in out["seasons"] for t in s["trades"] for ps in t["sides"].values())}
HS = os.path.join(ROOT, "public/players")
for pid, v in out["players"].items():
    v.append(1 if os.path.exists(os.path.join(HS, pid + ".jpg")) else 0)
# Current team, positions and height from Sleeper's live player bios (fetched fresh every
# build). Box-score rows carry the team a player was on at the time, which goes stale after trades.
BIO = get("/v1/players/nba", fresh=True)
for pid, v in out["players"].items():
    b = BIO.get(pid)
    if b:
        v[2] = b.get("team") or ""
        v[1] = b.get("fantasy_positions") or v[1]
    h = (b or {}).get("height") or ""
    v.append(int(h) if str(h).isdigit() else 0)
    v.append((b or {}).get("birth_date") or "")
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("replay could not explain", len(MISFIT), "team-weeks", MISFIT[:8], file=sys.stderr)
print("ok", {s["code"]: (s["weeks"], len(s["trades"]), len(s["draft"])) for s in out["seasons"]},
      len(out["players"]), "players", os.path.getsize(OUT) // 1024, "KB")

# Keep league.json's in-progress season current: official records and points from Sleeper's
# rosters, re-seeded, and every manager's career totals recomputed from their seasons.
LPATH = os.path.join(ROOT, "src/data/league.json")
LG = json.load(open(LPATH))
for sn in LG["seasons"]:
    if sn["status"] == "complete":
        continue
    lid = sn["leagueId"]
    users = {u["user_id"]: u for u in get(f"/v1/league/{lid}/users", fresh=True)}
    live = {}
    for r in get(f"/v1/league/{lid}/rosters", fresh=True):
        st = r["settings"]
        live[users[r["owner_id"]]["display_name"]] = {
            "w": st.get("wins", 0), "l": st.get("losses", 0), "t": st.get("ties", 0),
            "pf": round(st.get("fpts", 0) + st.get("fpts_decimal", 0) / 100, 1),
            "pa": round(st.get("fpts_against", 0) + st.get("fpts_against_decimal", 0) / 100, 1),
            "moves": st.get("total_moves", 0)}
    for row in sn["standings"]:
        row.update(live.get(row["manager"], {}))
    sn["standings"].sort(key=lambda x: (-(x["w"] + x["t"] / 2), -x["pf"]))
    for i, row in enumerate(sn["standings"]):
        row["seed"] = i + 1
    for m in LG["managers"]:
        row = next((x for x in sn["standings"] if x["manager"] == m["id"]), None)
        if not row:
            continue
        for ms in m["seasons"]:
            if ms["code"] == sn["code"]:
                ms.update({k: row[k] for k in ("w", "l", "t", "pf", "seed")})
for m in LG["managers"]:
    rows = [next(x for x in s["standings"] if x["manager"] == m["id"]) for s in LG["seasons"] if any(x["manager"] == m["id"] for x in s["standings"])]
    m["w"], m["l"], m["t"] = sum(r["w"] for r in rows), sum(r["l"] for r in rows), sum(r["t"] for r in rows)
    m["pf"] = round(sum(r["pf"] for r in rows), 1)
    m["pa"] = round(sum(r.get("pa", 0) for r in rows), 1)
    gp = m["w"] + m["l"] + m["t"]
    m["pct"] = round((m["w"] + m["t"] / 2) / gp, 3) if gp else 0
LG["managers"].sort(key=lambda m: -m["pct"])
json.dump(LG, open(LPATH, "w"), ensure_ascii=False)
print("league.json in-progress season refreshed")
