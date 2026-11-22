import sys, random, collections
sys.path.insert(0, "/home/claude/skyrim")
import game, data
from world_geo import LOCATIONS
clock = [1_000_000.0]
game.now = lambda: clock[0]

# 1) a full trip Riverwood -> Windhelm with fights auto-picked
def run_trip(race, dest="Windhelm", choose="fight", seed=None):
    random.seed(seed)
    db = game.DB(":memory:")
    p = game.Player.create(db, 1, "Tester", race)
    t = game.Trip.start(db, p, dest, LOCATIONS[dest][:2], 0)
    ticks = encounters = 0
    while True:
        clock[0] += 30; ticks += 1
        p = game.Player.load(db, 1); t = game.Trip.load(db, 1)
        if t is None: return "died-low", ticks, encounters, p
        if t.status == "encounter":
            encounters += 1
            msg, death = game.encounter_action(db, p, t, choose)
            if death: return "died", ticks, encounters, game.Player.load(db, 1)
            continue
        r = game.travel_step(db, p, t)
        if r["died"]: return "died-low", ticks, encounters, game.Player.load(db, 1)
        if r["arrived"]: return "arrived", ticks, encounters, game.Player.load(db, 1)
        if ticks > 400: return "stuck", ticks, encounters, p

res = collections.Counter(); mins = []
for i in range(300):
    out, ticks, enc, p = run_trip(random.choice(list(data.RACES)), seed=i)
    res[out] += 1
    if out == "arrived": mins.append(ticks / 2)
print("Riverwood->Windhelm, always fight:", dict(res), "avg minutes", round(sum(mins)/len(mins),1))
out, ticks, enc, p = run_trip("nord", seed=3)
print("sample:", out, ticks/2, "min", enc, "encounters; discovered:", p.discovered, "lvl", p.level, "gold", p.gold)

# 2) win rate per danger at level 1 with full health
db = game.DB(":memory:"); p = game.Player.create(db, 1, "T", "nord")
for danger in ("low", "medium", "high"):
    for e in [e for e in data.ENCOUNTERS if e["danger"] == danger and e.get("kind") != "event"]:
        wins = 0
        for _ in range(300):
            p.set_health(p.max_health); ee = dict(e); ee["hp"] = ee["health"]
            wins += game.fight(p, ee)[0]
        print(f"  {danger:6} {e['name']:18} win {wins/300:.0%}")

# 3) death -> bag -> recovery
db = game.DB(":memory:"); p = game.Player.create(db, 1, "T", "nord"); p.gold = 120
p.x, p.y = 0.6, 0.5; p.save()
t = game.Trip.start(db, p, "Windhelm", LOCATIONS["Windhelm"][:2], 0)
print(game.die(db, p, t, "Giant")[:60], "...")
p = game.Player.load(db, 1); print("after death:", p.location, p.gold, game.own_bag(db,1)["gold"])
t = game.Trip.start(db, p, "your lost bag", (0.6, 0.5), 0)
for _ in range(100):
    clock[0] += 30; p = game.Player.load(db,1); t = game.Trip.load(db,1)
    if t.status == "encounter": t.status="travel"; t.encounter=None; t.save(); continue
    if game.travel_step(db, p, t)["arrived"]: break
p = game.Player.load(db,1); print("after recovery gold:", p.gold, "log:", t.log[-2:])
