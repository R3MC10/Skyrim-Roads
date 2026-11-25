"""Weapon effects on screen (weaponfx.js): every weapon's trail plays during the swing, its hit lands on the contact frame,
once per hit, at the weapon (on the target's body), a miss only whiffs, and nothing is left playing once the move is over.
Hero, foes and a follower, on a phone and a PC. Captures a frame mid-swing and one at impact for each weapon.
Usage: python3 weaponfx_ui.py PORT   (set SHOTS=/some/dir to save the frames; nothing is saved by default;
WFX_LOOSE=1 only takes pictures, for a before/after comparison on an older build)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
SHOTS = os.environ.get("SHOTS")
LOOSE = bool(os.environ.get("WFX_LOOSE"))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c and not LOOSE: fails.append(m)
JS = r"""
window.__wf = {
  synth(o){
    const base=D.ENCOUNTERS.find(e=>e.name===(o.foe||'Bandit outlaw')) || D.ENCOUNTERS[0], e={...G.scaleEnemy(base,10)};
    if (o.name) e.name = o.name;
    const wt = o.wt || 'sword';
    const log=[{turn:1, rule:0, me: o.me || '', them: o.them || '', hp: o.hp ?? 191, ehp: o.ehp ?? 60, a: o.a || 'attack', wt}];
    const f = { log, hp0:200, ehp0:120, won:true, e, wt, wt0:wt, weapon: o.staff ? {staff:{spell:o.staff}} : null, eq:{}, armor:{}, shield:null, allies: o.ally ? [{name:o.ally, follower:true}] : [], turn:1 };
    this.f = f; return f;
  },
  info(){ const bs = FIGHTART.beatsOf(this.f, FIGHTART.heroOf(null, this.f)), b = bs[0]; if (!b) return null; const m = FIGHTART.MOVES[b.move] || {hits:[]}; return {move:b.move, who:b.who, dur:b.dur, hits:m.hits, ally:!!b.allyOnly}; },
  mount(f, w){
    document.getElementById('wfbox')?.remove(); const b=document.createElement('div'); b.id='wfbox'; b.style.cssText=`position:fixed;left:0;top:0;width:${w+12}px;z-index:9999;background:#111;padding:6px`; document.body.appendChild(b);
    const d=document.createElement('div'); d.style.width=w+'px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); b.appendChild(d); return true;
  },
  cv(){ return document.querySelector('#wfbox .fscene canvas'); },
  log(){ const c=this.cv(); return c && c.__wfx ? c.__wfx.log.slice() : null; },
  live(){ const c=this.cv(); return c && c.__wfx ? c.__wfx.live() : null; },
};
"""
# name, synth opts, the move the beat plays, who swings ("me" / "them" / "ally"), the weapon kind
CASES = [
    ("sword", {"wt": "sword", "me": "Attack: 20"}, "sword", "me", "blade"),
    ("greatsword", {"wt": "greatsword", "me": "Attack: 30"}, "greatsword", "me", "blade"),
    ("axe", {"wt": "axe", "me": "Attack: 20"}, "axe", "me", "chop"),
    ("battleaxe", {"wt": "battleaxe", "me": "Attack: 30"}, "battleaxe", "me", "chop"),
    ("mace", {"wt": "mace", "me": "Attack: 20"}, "mace", "me", "blunt"),
    ("warhammer", {"wt": "warhammer", "me": "Power attack: 40", "a": "power_attack"}, "warhammer", "me", "blunt"),
    ("dagger", {"wt": "dagger", "me": "Attack: 14"}, "dagger", "me", "stab"),
    ("sword_fire", {"wt": "sword", "me": "Attack: 20 +fire"}, "sword", "me", "blade"),
    ("sword_miss", {"wt": "sword", "me": "Attack misses", "ehp": 120}, "sword", "me", "blade"),
    ("bow", {"wt": "bow", "me": "Attack: 20"}, "bow", "me", "shot"),
    ("crossbow", {"wt": "crossbow", "me": "Attack: 20"}, "crossbow", "me", "bolt"),
    ("staff", {"wt": "staff", "me": "Firebolt: 20", "staff": "firebolt"}, "staff", "me", "staff"),
    ("foe_bandit", {"them": "Bandit outlaw hits 9", "hp": 191}, None, "them", None),
    ("foe_draugr", {"foe": "Draugr", "name": "Draugr", "them": "Draugr hits 11", "hp": 189}, None, "them", None),
    ("follower", {"ally": "Lydia", "me": " · Lydia hits 12", "ehp": 48}, None, "ally", None),
]
async def main():
    if SHOTS: os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        for vw, vh, w in [(390, 844, 368), (1920, 1080, 900)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 500 else 1)
            pg = await ctx.new_page(); pg.set_default_timeout(90000); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&fightanim&p=wf{vw}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Swordhand"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
            ok(await pg.evaluate("typeof WEAPONFX === 'object'"), f"{vw}: weaponfx.js loads")
            for name, o, move, who, kind in CASES:
                js = "{" + ",".join(f"{k}:{v!r}" for k, v in o.items()) + "}"
                await pg.evaluate(f"()=>__wf.mount(__wf.synth({js}), {w})")
                await pg.wait_for_timeout(250)
                el = await pg.query_selector("#wfbox .fscene")
                info = await pg.evaluate("__wf.info()")
                if not info: ok(False, f"{vw}: {name} has a beat"); continue
                if move: ok(info["move"] == move, f"{vw}: {name} plays the {move} move ({info['move']})")
                hits = info["hits"] or [0.45]
                dur = info["dur"]
                h0 = hits[0] if not info["ally"] else 0.4
                mid = max(0.0, (h0 - 0.08) * dur)
                await pg.evaluate(f"FIGHTART.advance({int(mid)})")
                if SHOTS and vw < 500: await el.screenshot(path=os.path.join(SHOTS, f"{name}_1swing.png"))
                await pg.evaluate(f"FIGHTART.advance({int(h0 * dur - int(mid)) + 34})")
                if SHOTS and vw < 500: await el.screenshot(path=os.path.join(SHOTS, f"{name}_2impact.png"))
                if SHOTS and vw >= 500: await el.screenshot(path=os.path.join(SHOTS, f"pc_{name}_2impact.png"))
                await pg.evaluate(f"FIGHTART.advance({int(dur) + 1200})")   # the killing blow plays in slow motion: give it time to finish
                lg = await pg.evaluate("__wf.log()") or []
                imp = [e for e in lg if e["k"] == "impact" and e["b"] == 0]
                wh = [e for e in lg if e["k"] == "whiff" and e["b"] == 0]
                tr = [e for e in lg if e["k"] == "trail" and e["b"] == 0]
                miss = "misses" in o.get("me", "")
                if who == "ally":
                    ok(len(imp) == 1 and imp[0]["who"] == "ally", f"{vw}: {name}: the follower's blow lands once on the foe ({len(imp)})")
                    if imp: ok(imp[0]["onFoe"], f"{vw}: {name}: the follower's hit is on the foe")
                elif kind in ("shot", "bolt"):
                    ok(not tr and not imp, f"{vw}: {name}: no swing trail or melee impact for a shot")
                elif kind == "staff":
                    bolt = [e for e in lg if e["k"] == "bolt"]
                    ok(len(bolt) == 1, f"{vw}: {name}: one bolt leaves the staff ({len(bolt)})")
                    if bolt: ok(bolt[0]["tip"], f"{vw}: {name}: the bolt starts at the staff tip, not the hand ({bolt[0]})")
                elif miss:
                    ok(not imp and len(wh) == len(hits), f"{vw}: {name}: a miss only whiffs ({len(imp)} impacts, {len(wh)} whiffs)")
                else:
                    ok(len(imp) == len(hits), f"{vw}: {name}: one impact per hit ({len(imp)}/{len(hits)})")
                    for i, e in enumerate(imp[:len(hits)]):
                        ok(abs(e["u"] - hits[i]) <= 0.04, f"{vw}: {name}: hit {i + 1} lands on the contact frame (u {e['u']:.3f} vs {hits[i]})")
                        ok(e["onFoe"] if who == "me" else e["onHero"], f"{vw}: {name}: hit {i + 1} lands on the {'foe' if who == 'me' else 'hero'}")
                        ok(e["kind"] == (kind or e["kind"]), f"{vw}: {name}: the impact fits the weapon ({e['kind']})")
                    if who == "me":
                        ok(len(tr) >= 1 and tr[0]["u"] < hits[0] and tr[0]["u"] > hits[0] - 0.25, f"{vw}: {name}: the trail plays during the swing ({[round(t['u'], 2) for t in tr]})")
                live = await pg.evaluate("__wf.live()") or {}
                ok(not live.get("trail") and not live.get("shapes"), f"{vw}: {name}: nothing keeps playing after the move ({live})")
            ok(await pg.evaluate("FIGHTART.advance(3000).length >= 0"), f"{vw}: scenes step on without errors")
            await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "weaponfx_ui ok")
    if fails: sys.exit(1)
asyncio.run(main())
