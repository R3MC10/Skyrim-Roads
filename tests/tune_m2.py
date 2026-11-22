import sys, json
sys.path.insert(0, "/home/claude/skyrim")
import game, items as it, data
hm, dm = float(sys.argv[1]), float(sys.argv[2])
data.ENEMY_HEALTH_MULT, data.ENEMY_DAMAGE_MULT = hm, dm
def winrate(preset, enemy, lvl=1, n=150, race="nord", gear=None):
    w = 0
    for _ in range(n):
        d = game.DB(":memory:"); q = game.Player.create(d, 1, "T", race); q.level = lvl
        for s in q.skills.values(): s["lvl"] = min(100, s["lvl"] + (lvl-1)*2)
        q.pending_levels = lvl - 1
        for i in range(lvl - 1):
            q.level_up_choice({"warrior": "health", "thief": "health" if i % 2 else "stamina"}.get(preset, "magicka" if i % 3 else "health"))
        if preset in ("mage", "battlemage"): q.spells += ["sun_fire"]
        q.save()
        for g in (gear or []): q.equip(game.give_item(d, 1, g))
        q.set_rules([dict(r) for r in it.PRESETS[preset]["rules"]])
        e = game.scale_enemy(next(x for x in data.ENCOUNTERS if x["name"] == enemy), lvl)
        w += game.Fight(d, q, e).run()
    return w / n
EN = ["Bandit outlaw","Black bear","Draugr","Frost troll","Vampire","Giant"]
for lvl, gear in [(1, None), (10, ["steel_sword","steel_armor","steel_helmet","steel_shield"])]:
    for preset, race in [("warrior","nord"),("mage","altmer"),("thief","khajiit")]:
        print(f"L{lvl} {preset:9}", "  ".join(f"{e.split()[0]}={winrate(preset,e,lvl,race=race,gear=gear):.0%}" for e in EN))
