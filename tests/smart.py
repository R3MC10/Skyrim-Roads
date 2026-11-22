import sys, random, collections
sys.path.insert(0, "/home/claude/skyrim")
import game, data
from world_geo import LOCATIONS
clock=[1e6]; game.now=lambda: clock[0]
res=collections.Counter()
for i in range(400):
    random.seed(i); db=game.DB(":memory:"); p=game.Player.create(db,1,"T",random.choice(list(data.RACES)))
    t=game.Trip.start(db,p,"Windhelm",LOCATIONS["Windhelm"][:2],0); out=None
    for _ in range(400):
        clock[0]+=30; p=game.Player.load(db,1); t=game.Trip.load(db,1)
        if t is None: out="died"; break
        if t.status=="encounter":
            e=t.encounter
            if p.current_health()<60 and p.potions: a="potion"
            elif e["danger"]=="high": a=random.choice(["flee","sneak"])
            else: a="fight"
            if game.encounter_action(db,p,t,a)[1]: out="died"; break
            continue
        r=game.travel_step(db,p,t)
        if r["died"]: out="died"; break
        if r["arrived"]: out="arrived"; break
    res[out]+=1
print("smart player, first trip Riverwood->Windhelm:", dict(res))
