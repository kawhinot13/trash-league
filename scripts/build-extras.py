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
        mus = dict(zip(allweeks, ex.map(lambda w: get(f"/v1/league/{lid}/matchups/{w}", fresh=live), allweeks)))
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
    for w in allweeks:
        po = w > REG_WEEKS
        for m in mus[w]:
            who = r2n[m["roster_id"]]
            if po and m.get("matchup_id") is None:
                continue
            for pid in m.get("players") or []:
                guys[who][pid][0] += 1
            for pid, pts in zip(m.get("starters") or [], m.get("starters_points") or []):
                if pid and pid != "0":
                    guys[who][pid][1] += 1
                    guys[who][pid][2] += pts or 0
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
    out["seasons"].append({"code": s["code"], "season": season, "weeks": done, "status": s["status"],
                           "draft": draft, "rosters": {str(k): v for k, v in rost.items()},
                           "trades": [{k: v for k, v in t.items() if k != "ts"} for t in sorted(trades, key=lambda t: t["ts"])],
                           "adds": dict(adds), "lineups": dict(lineups), "playoffs": playoffs,
                           "guys": {who: {pid: [v[0], v[1], round(v[2], 1)] for pid, v in ps.items()} for who, ps in guys.items()}})

# Names for anyone still missing (dropped before ever logging a stat, etc).
need = {pid for s in out["seasons"] for r in s["rosters"].values() for ps in r.values() for pid in ps}
need |= {d["pid"] for s in out["seasons"] for d in s["draft"]}
need |= {pid for s in out["seasons"] for ps in s["guys"].values() for pid in ps}
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
# Height in inches (for The Lineup game), from Sleeper's player bios.
BIO = get("/v1/players/nba")
for pid, v in out["players"].items():
    h = (BIO.get(pid) or {}).get("height") or ""
    v.append(int(h) if str(h).isdigit() else 0)
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("replay could not explain", len(MISFIT), "team-weeks", MISFIT[:8], file=sys.stderr)
print("ok", {s["code"]: (s["weeks"], len(s["trades"]), len(s["draft"])) for s in out["seasons"]},
      len(out["players"]), "players", os.path.getsize(OUT) // 1024, "KB")
