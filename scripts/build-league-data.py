"""Compile the Trash league's history into src/data/league.json for the website.

Reads the raw Sleeper dumps produced by ../mdv-video/scripts/fetch_sleeper.py.
Official season records, brackets, champions, drafts and trades are reliable.
Head-to-head comes from Sleeper's weekly matchups, which are NOT reliable for
these leagues, so the site labels it "per Sleeper".
"""
import json, os, sys, collections

RAW = sys.argv[1]
OUT = sys.argv[2]
P = json.load(open(os.path.join(RAW, "players_nba.json")))
pn = lambda i: (P.get(i) or {}).get("full_name") or i
SEASONS = [("s1", "trash_s1_2023", "2023–24", "Trash"), ("s2", "trash_s2_2024", "2024–25", "Trash Season 2"),
           ("s3", "trash_s3_2025", "2025–26", "Trash Season 3"), ("s4", "trash_s4_2026", "2026–27", "Trash Season 4")]
NICK = {"jgood432": "Goodie", "GreenBean69420": "Green Bean", "junkyarddoggg": "Junkyard Dog", "KawhiNot13": "KawhiNot",
        "ABsBrainsCells": "Brain Cells", "Dinahsty": "Dinahsty", "LeBugger": "Bug", "Oscar31": "Oscar", "llazaris7": "Lazaris",
        "Edizzle6": "Edizzle", "RI3O": "Rico", "MilesBridgessgf": "Will Lin", "charlesjames05": "Charles"}
COLOR = {"jgood432": "#f39a2b", "GreenBean69420": "#3fae5a", "junkyarddoggg": "#9a6a3a", "KawhiNot13": "#c8102e",
         "ABsBrainsCells": "#2ea7e0", "Dinahsty": "#6b3fa0", "LeBugger": "#1d5fbf", "Oscar31": "#2b3a67", "llazaris7": "#20b2aa",
         "Edizzle6": "#8a1c1c", "RI3O": "#a24bd8", "MilesBridgessgf": "#18b39b", "charlesjames05": "#6b7a2b"}

seasons, managers = [], {}
h2h = collections.defaultdict(lambda: [0, 0])
for code, key, years, name in SEASONS:
    d = json.load(open(os.path.join(RAW, key, "all.json")))
    lg = d["league"]
    users = {u["user_id"]: u for u in d["users"]}
    r2n = {r["roster_id"]: users[r["owner_id"]]["display_name"] for r in d["rosters"]}
    rows = []
    for r in d["rosters"]:
        s = r["settings"]; n = r2n[r["roster_id"]]
        team = (users[r["owner_id"]].get("metadata") or {}).get("team_name") or n
        rows.append({"manager": n, "team": team, "w": s.get("wins", 0), "l": s.get("losses", 0), "t": s.get("ties", 0),
                     "pf": round(s.get("fpts", 0) + s.get("fpts_decimal", 0) / 100, 1),
                     "pa": round(s.get("fpts_against", 0) + s.get("fpts_against_decimal", 0) / 100, 1),
                     "moves": s.get("total_moves", 0)})
    rows.sort(key=lambda x: (-(x["w"] + x["t"] / 2), -x["pf"]))
    for i, r in enumerate(rows): r["seed"] = i + 1
    complete = lg["status"] == "complete"
    champ = runner = None
    bracket = []
    for m in d["winners_bracket"]:
        fr = m.get("t1_from") or {}
        if m["r"] == 1 or "w" in fr:
            if m["r"] == 3 and m.get("p") != 1: continue
            bracket.append({"round": m["r"], "a": r2n.get(m["t1"]), "b": r2n.get(m["t2"]), "winner": r2n.get(m.get("w"))})
            if m["r"] == 3 and m.get("w"): champ, runner = r2n[m["w"]], r2n[m["l"]]
    playoff = {r2n[x] for m in d["winners_bracket"] if m["r"] == 1 for x in (m["t1"], m["t2"])} if complete else set()
    finish = {}
    if complete:
        for m in bracket:
            for x in (m["a"], m["b"]): finish[x] = {1: "Quarterfinal", 2: "Semifinal", 3: "Final"}[m["round"]]
        finish[champ] = "Champion"; finish[runner] = "Runner-up"
    picks = []
    for ps in d["draft_picks"].values():
        for p in sorted(ps, key=lambda p: p["pick_no"])[:12]:
            picks.append({"no": p["pick_no"], "pid": p["player_id"], "player": pn(p["player_id"]), "by": r2n[p["roster_id"]]})
    trades = []
    for wk, ts in sorted(d["transactions"].items(), key=lambda x: int(x[0])):
        for t in ts:
            if t["type"] != "trade" or t["status"] != "complete": continue
            sides = collections.defaultdict(list)
            for pid, rid in (t.get("adds") or {}).items(): sides[r2n[rid]].append({"pid": pid, "name": pn(pid)})
            for pk in t.get("draft_picks") or []: sides[r2n[pk["owner_id"]]].append({"pid": None, "name": f"{pk['season']} round {pk['round']} pick"})
            trades.append({"season": code, "week": int(wk), "sides": dict(sides)})
    last = 21 if complete else 3
    for wk in range(1, last + 1):
        by = collections.defaultdict(list)
        for m in d["matchups"].get(str(wk), []): by[m["matchup_id"]].append(m)
        for pair in by.values():
            if len(pair) != 2 or pair[0]["points"] == pair[1]["points"]: continue
            w, l = sorted(pair, key=lambda m: -m["points"])
            h2h[(r2n[w["roster_id"]], r2n[l["roster_id"]])][0] += 1
    adds = collections.Counter()
    for ts in d["transactions"].values():
        for t in ts:
            if t["type"] in ("waiver", "free_agent") and t["status"] == "complete":
                for rid in (t.get("adds") or {}).values(): adds[r2n[rid]] += 1
    for r in rows: r["adds"] = adds[r["manager"]]
    seasons.append({"code": code, "years": years, "name": name, "status": lg["status"], "leagueId": lg["league_id"],
                    "standings": rows, "champion": champ, "runnerUp": runner, "bracket": bracket, "draft": picks, "trades": trades})
    for r in rows:
        m = managers.setdefault(r["manager"], {"id": r["manager"], "nick": NICK[r["manager"]], "color": COLOR[r["manager"]],
                                               "w": 0, "l": 0, "t": 0, "pf": 0.0, "pa": 0.0, "titles": [], "playoffs": 0, "trades": 0,
                                               "adds": 0, "pw": 0, "pl": 0, "finals": 0, "seasons": []})
        m["pa"] = round(m["pa"] + r["pa"], 1); m["adds"] += r["adds"]
        m["w"] += r["w"]; m["l"] += r["l"]; m["t"] += r["t"]; m["pf"] = round(m["pf"] + r["pf"], 1)
        m["team"] = r["team"]
        if r["manager"] in playoff: m["playoffs"] += 1
        if champ == r["manager"]: m["titles"].append(code)
        m["seasons"].append({"code": code, "seed": r["seed"], "w": r["w"], "l": r["l"], "t": r["t"], "pf": r["pf"], "team": r["team"],
                             "finish": finish.get(r["manager"], "Missed playoffs" if complete else "In progress")})
    for t in trades:
        for n in t["sides"]: managers[n]["trades"] += 1
    for b in bracket:
        if not b["winner"]: continue
        loser = b["b"] if b["winner"] == b["a"] else b["a"]
        managers[b["winner"]]["pw"] += 1; managers[loser]["pl"] += 1
        if b["round"] == 3: managers[b["winner"]]["finals"] += 1; managers[loser]["finals"] += 1

partners = collections.Counter()
for sn in seasons:
    for t in sn["trades"]:
        k = sorted(t["sides"])
        if len(k) == 2: partners[tuple(k)] += 1
names = sorted(managers)
matrix = {a: {b: h2h[(a, b)][0] for b in names if b != a} for a in names}
for m in managers.values():
    gp = m["w"] + m["l"] + m["t"]; m["pct"] = round((m["w"] + m["t"] / 2) / gp, 3) if gp else 0
json.dump({"seasons": seasons, "managers": sorted(managers.values(), key=lambda m: -m["pct"]), "h2h": matrix,
           "partners": [{"a": a, "b": b, "n": n} for (a, b), n in partners.most_common()],
           "totals": {"seasons": 4, "managers": len(managers), "trades": sum(len(s["trades"]) for s in seasons)}},
          open(OUT, "w"), ensure_ascii=False)
print("ok", len(managers), "managers", sum(len(s["trades"]) for s in seasons), "trades")
