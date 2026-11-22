import sys, random, ast, statistics
sys.path.insert(0, "/home/claude/memequest")
for fn in ["game.py", "bot.py"]:
    ast.parse(open(f"/home/claude/memequest/{fn}").read(), feature_version=(3, 9))
import game, bot
print("commands:", sorted(c.name for c in bot.tree.get_commands()))

db = game.GameDB(":memory:")
db.create_player(1, "A", "keyboard_warrior"); db.create_player(2, "B", "couch_potato")
db.create_player(3, "C", "lucky_gremlin"); db.create_player(4, "D", "main_character")
assert len(db.equipped_items(1)) == 1
iid = db.give_item(1, "ban_hammer"); assert db.equip(1, iid)["id"] == "ban_hammer"
assert [i["id"] for i in db.equipped_items(1)] == ["ban_hammer"]
db.add_gold(2, 500); r = game.do_trade(db, 1, 2, iid, 100); assert "error" not in r
assert db.inv_row(2, iid) and db.player(1)["gold"] == 125
assert "error" in game.do_trade(db, 1, 2, iid, 1)
print(game.do_sell(db, 2, iid), game.do_lootbox(db, 2))
print({k: v for k, v in game.do_duel(db, 1, 2, 10).items() if k in ("winner_uid", "xp")})
for _ in range(30): game.do_fight(db, 1)
print("after 30 fights", dict(db.player(1)))
d = game.do_dungeon(db, [1, 2, 3, 4]); print("dungeon cleared", d["cleared"])

# Balance: fresh characters at given level, gear by tier
def fresh(cls, level, gear):
    db = game.GameDB(":memory:"); db.create_player(1, "x", cls)
    db.con.execute("UPDATE players SET level=?", (level,))
    for g in gear: db.equip(1, db.give_item(1, g))
    return db
GEAR = {"none": [], "common": ["baguette", "comfy_hoodie", "energy_drink"],
        "rare": ["no_esc_keyboard", "bubble_wrap", "fidget_spinner"],
        "epic": ["ban_hammer", "gamer_chair", "golden_toilet"]}
N = 400
for lvl, tier in [(1, "none"), (5, "common"), (10, "rare"), (20, "rare"), (30, "epic"), (45, "epic")]:
    row = []
    for cls in game.CLASSES:
        wins = 0
        for _ in range(N):
            d = fresh(cls, lvl, GEAR[tier]); wins += game.do_fight(d, 1)["won"]
        row.append(f"{cls[:8]}={wins/N:.0%}")
    print(f"fight L{lvl} {tier}:", " ".join(row))
for lvl, tier in [(3, "common"), (10, "rare"), (25, "epic")]:
    row = []
    for n in (1, 2, 3, 4):
        clr = 0
        for _ in range(150):
            d = game.GameDB(":memory:")
            for u in range(n):
                d.create_player(u, f"p{u}", list(game.CLASSES)[u % 4]); d.con.execute("UPDATE players SET level=?", (lvl,))
                for g in GEAR[tier]: d.equip(u, d.give_item(u, g))
            clr += game.do_dungeon(d, list(range(n)))["boss_beaten"]
        row.append(f"{n}p={clr/150:.0%}")
    print(f"dungeon L{lvl} {tier}:", " ".join(row))
# duel fairness same level same gear
for a, b in [("keyboard_warrior","couch_potato"),("lucky_gremlin","main_character"),("keyboard_warrior","lucky_gremlin"),("couch_potato","main_character")]:
    w=0
    for _ in range(N):
        d=game.GameDB(":memory:"); d.create_player(1,"a",a); d.create_player(2,"b",b)
        d.con.execute("UPDATE players SET level=10")
        w += game.do_duel(d,1,2,0)["winner_uid"]==1
    print(f"duel L10 {a} vs {b}: {w/N:.0%}")
