import sys, json
sys.path.insert(0, "/home/claude/memequest")
import game
knobs = json.loads(sys.argv[1]); classes = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
for k, v in knobs.items(): setattr(game, k, v)
for cid, ov in classes.items():
    for k, v in ov.items():
        if k == "growth": game.CLASSES[cid]["growth"].update(v)
        else: game.CLASSES[cid][k] = v
GEAR = {"none": [], "common": ["baguette", "comfy_hoodie", "energy_drink"],
        "rare": ["no_esc_keyboard", "bubble_wrap", "fidget_spinner"],
        "epic": ["ban_hammer", "gamer_chair", "golden_toilet"]}
def mk(n, lvl, tier, classes=None):
    d = game.GameDB(":memory:")
    for u in range(n):
        d.create_player(u, f"p{u}", (classes or list(game.CLASSES))[u % 4])
        for g in GEAR[tier]: d.equip(u, d.give_item(u, g))
    d.con.execute("UPDATE players SET level=?", (lvl,)); return d
N = 250
for lvl, tier in [(1, "none"), (5, "common"), (15, "rare"), (35, "epic")]:
    print(f"fight L{lvl}:", " ".join(f"{c[:6]}={sum(game.do_fight(mk(1,lvl,tier,[c]),0)['won'] for _ in range(N))/N:.0%}" for c in game.CLASSES))
for lvl, tier in [(3, "common"), (15, "rare"), (35, "epic")]:
    print(f"dung L{lvl}:", " ".join(f"{n}p={sum(game.do_dungeon(mk(n,lvl,tier),list(range(n)))['boss_beaten'] for _ in range(120))/120:.0%}" for n in (1,2,3,4)))
cl = list(game.CLASSES)
for lvl in (5, 20):
    out=[]
    for i in range(4):
        for j in range(i+1,4):
            w=sum(game.do_duel(mk(1,lvl,"rare",[cl[i]]) if False else _d(cl[i],cl[j],lvl),0,1,0)["winner_uid"]==0 for _ in range(N)) if False else None
    def duel(a,b):
        w=0
        for _ in range(N):
            d=game.GameDB(":memory:"); d.create_player(0,"a",a); d.create_player(1,"b",b); d.con.execute("UPDATE players SET level=?",(lvl,))
            w+=game.do_duel(d,0,1,0)["winner_uid"]==0
        return w/N
    print(f"duel L{lvl}:", " ".join(f"{cl[i][:4]}>{cl[j][:4]}={duel(cl[i],cl[j]):.0%}" for i in range(4) for j in range(i+1,4)))
