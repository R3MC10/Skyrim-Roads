import sys, random
sys.path.insert(0, "/home/claude/skyrim")
import game, data
def winrate(e, race="nord", level=1, n=300):
    w=0
    for _ in range(n):
        db=game.DB(":memory:"); p=game.Player.create(db,1,"T",race); p.level=level
        for s in p.skills.values(): s["lvl"] += (level-1)*2
        p.set_health(p.max_health); ee=dict(e)
        sc=1+0.05*(level-1); ee["health"]=int(e["health"]*sc); ee["damage"]=e["damage"]*sc; ee["hp"]=ee["health"]
        w+=game.fight(p,ee)[0]
    return w/n
for lvl in (1,5,12):
    print(f"level {lvl}:", "  ".join(f"{e['name']}={winrate(e,level=lvl):.0%}" for e in data.ENCOUNTERS if e.get("kind")!="event"))
