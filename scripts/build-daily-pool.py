#!/usr/bin/env python3
"""Build src/data/daily-pool.json: the players every league's Rosterdle and The Lineup draw from,
one shared order per sport, so every league gets the same player on the same day.

APPEND-ONLY: the daily pick is pool[day number], so reordering or removing entries would change
past and current answers. Running this again keeps the existing order and only adds new players
at the end. Usage: python3 scripts/build-daily-pool.py [--top 150] [--refresh-only]
--refresh-only updates teams, positions and heights of players already in the pool and adds nobody
(the daily data build runs it this way, so trades show up in The Lineup's team clue).
"""
import json, os, random, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src/data/daily-pool.json")
TOP = int(sys.argv[sys.argv.index("--top") + 1]) if "--top" in sys.argv else 150
SUFFIX = re.compile(r"\b(jr|sr|ii|iii|iv|v)\b\.?", re.I)


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "rafterlore-pool"}), timeout=120) as r:
        return json.load(r)


def height(h):
    h = str(h or "")
    if h.isdigit():
        return int(h)
    m = re.match(r"(\d+)'\s*(\d+)", h)
    return int(m.group(1)) * 12 + int(m.group(2)) if m else 0


def pick(sport):
    allp = get(f"https://api.sleeper.app/v1/players/{sport}")
    ok = []
    for pid, p in allp.items():
        if not (p.get("active") and p.get("team") and p.get("search_rank") and p.get("birth_date") and height(p.get("height"))):
            continue
        if sport == "nfl" and not set(p.get("fantasy_positions") or []) & {"QB", "RB", "WR", "TE"}:
            continue
        name = p.get("full_name") or f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
        ok.append((p["search_rank"], pid, name, p.get("fantasy_positions") or [], p["team"], height(p.get("height")), p["birth_date"]))
    ok.sort()
    return [list(x[1:]) for x in ok[:TOP]]


old = json.load(open(OUT)) if os.path.exists(OUT) else {"nba": [], "nfl": []}
out = {"note": "Append-only. See scripts/build-daily-pool.py.", "nba": [], "nfl": [], "lineup": {}}
for sport in ("nba", "nfl"):
    fresh = pick(sport)
    have = {e[0] for e in old.get(sport, [])}
    new = [] if "--refresh-only" in sys.argv else [e for e in fresh if e[0] not in have]
    random.Random(f"{sport}-{len(have)}").shuffle(new)
    # Keep the old order; refresh team/positions/height for existing players from today's data.
    # Refresh from every active player, not just today's top ones, so nobody's team goes stale.
    now = {e[0]: e for e in fresh}
    if "--refresh-only" in sys.argv:
        TOPX = TOP
        globals()["TOP"] = 100000
        now = {e[0]: e for e in pick(sport)}
        globals()["TOP"] = TOPX
    out[sport] = [now.get(e[0], e) for e in old.get(sport, [])] + new
    # The Lineup walks its own order (also append-only), so it never echoes Rosterdle's player.
    lo = list(old.get("lineup", {}).get(sport, []))
    add = [e[0] for e in out[sport] if e[0] not in set(lo)]
    random.Random(f"lineup-{sport}-{len(lo)}").shuffle(add)
    out["lineup"][sport] = lo + add
    print(sport, len(out[sport]), "players,", len(new), "new")
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
