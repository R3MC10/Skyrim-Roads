import sys, random, asyncio, sqlite3, json, os, tempfile
sys.path.insert(0, "/home/claude/skyrim")
import game, items as it, data
from world_geo import LOCATIONS
clock = [game.GAME_EPOCH + 1800]   # day 1, 14:00
game.now = lambda: clock[0]
print("clock:", game.clock_text(), "night?", game.is_night(), "shops open?", game.shops_open())

db = game.DB(":memory:")
p = game.Player.create(db, 1, "Remi", "nord")
print("kit:", [game.item_label(r["item_id"], r["qty"]) for r in game.inventory(db, 1)])
print("equipped:", {s: r["item_id"] for s, r in p.equipment.items()}, "weight", p.carried, "/", p.carry_capacity)
print("rules:", [game.describe_rule(r) for r in p.rules])

# shop + equip two-hander removes shield
p.gold = 2000; p.save()
print(game.buy(db, p, "steel_battleaxe"))
inv = {r["item_id"]: r["id"] for r in game.inventory(db, 1)}
print(p.equip(inv["steel_battleaxe"]))
print(p.equip(inv["hide_shield"]))
print(p.equip(inv["iron_sword"]), p.equip(inv["hide_shield"]))
print(game.buy(db, p, "tome_sun_fire"), game.read_tome(db, p, game.inventory(db,1)[-1]["id"]))
print(game.buy(db, p, "horse"))
p = game.Player.load(db, 1); print("horse:", p.horse, "speed", round(game.speed_px_per_min(p),1))

# night shop closed
clock[0] = game.GAME_EPOCH + 3600*1.2
print(game.clock_text(), "->", game.buy(db, p, "potion_health"))
clock[0] = game.GAME_EPOCH + 1800

# fights with tactics, per preset, vs several enemies
def winrate(preset, enemy_name, lvl=1, n=200, race="nord", extra=None):
    w = 0
    for _ in range(n):
        d = game.DB(":memory:"); q = game.Player.create(d, 1, "T", race); q.level = lvl
        for s in q.skills.values(): s["lvl"] += (lvl-1)*2
        q.spells += ["sun_fire", "oakflesh", "conjure_familiar", "firebolt"]; q.save()
        if extra: extra(d, q)
        q.set_rules([dict(r) for r in it.PRESETS[preset]["rules"]])
        e = game.scale_enemy(next(e for e in data.ENCOUNTERS if e["name"] == enemy_name), lvl)
        f = game.Fight(d, q, e); w += f.run()
    return w / n
for preset in it.PRESETS:
    print(f"{preset:10}", "  ".join(f"{e}={winrate(preset, e):.0%}" for e in ["Bandit outlaw","Black bear","Draugr","Frost troll","Vampire"]))

# one full fight log with battlemage vs draugr
d = game.DB(":memory:"); q = game.Player.create(d, 1, "Remi", "breton"); q.spells.append("sun_fire"); q.save()
q.set_rules([dict(r) for r in it.PRESETS["battlemage"]["rules"]])
e = game.scale_enemy(next(e for e in data.ENCOUNTERS if e["name"] == "Draugr"), 1)
f = game.Fight(d, q, e); f.run(); print("\n".join(f.log[:6])); print("...", f.log[-1])
print("used:", dict(f.used), "xp:", {k: round(v,1) for k,v in f.xp.items()})

# enchanted weapon charge (Skyrim formula)
ench = it.ITEMS["iron_sword_flames"]["enchant"]
for s in (15, 50, 100):
    c = game.enchant_cost(ench, s); print(f"Enchanting {s}: {c:.2f} charge/hit -> {1000/c:.0f} hits")
d = game.DB(":memory:"); q = game.Player.create(d, 1, "T", "nord")
w = game.give_item(d, 1, "iron_sword_flames"); q.equip(w)
f = game.Fight(d, q, game.scale_enemy(next(e for e in data.ENCOUNTERS if e["name"]=="Black bear"),1)); f.run(); f.apply()
print("charge after fight:", round(game.inv_row(d,1,w)["charge"],1))
g = game.give_item(d, 1, "soul_gem_common"); print(game.recharge(d, q, w, g))

# loadouts
print(p.save_loadout_as("Dragon"), p.switch_loadout("Main"), p.loadout_names(), p.delete_loadout("Dragon"))

# death: equipped stays, rest in bag
p = game.Player.load(db, 1); p.x, p.y = 0.6, 0.5; p.save()
before = len(game.inventory(db,1))
t = game.Trip.start(db, p, "Windhelm", LOCATIONS["Windhelm"][:2], 0)
print(game.die(db, p, t, "Giant").split("\n")[0])
print("items kept:", [r["item_id"] for r in game.inventory(db,1)], "of", before, "| bag:", json.loads(game.own_bag(db,1)["items"]))
p = game.Player.load(db, 1); p.x, p.y = 0.6, 0.5
print(game.pick_up_bags(db, p), "gold", p.gold)

# migration from a milestone-1 save
tmp = tempfile.mktemp(suffix=".db"); con = sqlite3.connect(tmp)
con.executescript("""CREATE TABLE players (user_id INTEGER PRIMARY KEY, name TEXT, race TEXT, level INTEGER DEFAULT 1, char_xp REAL DEFAULT 0,
 health REAL, health_ts REAL, gold INTEGER, potions INTEGER, x REAL, y REAL, location TEXT, discovered TEXT, explored TEXT, skills TEXT);
 CREATE TABLE bags (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER, owner_name TEXT, x REAL, y REAL, gold INTEGER, potions INTEGER, expires REAL);""")
sk = {s: {"lvl": 15, "xp": 0} for s in data.ALL_SKILLS}
con.execute("INSERT INTO players VALUES (5,'Old','orc',2,0,100,0,77,2,0.45,0.48,'Whiterun',?,?,?)", (json.dumps(["Whiterun"]), json.dumps([[0.45,0.48]]), json.dumps(sk)))
con.commit(); con.close()
mdb = game.DB(tmp); old = game.Player.load(mdb, 5)
print("migrated:", old.name, old.gold, [game.item_label(r["item_id"], r["qty"]) for r in game.inventory(mdb,5)], old.loadout)
