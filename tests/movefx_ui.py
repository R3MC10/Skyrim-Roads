"""Move effects on screen: spells, weapon blows and shouts play their own painted effect, bows and crossbows shoot a real arrow or bolt
(you, an archer foe, the Dwarven ballista, a follower). Checks there are no page errors on phone and PC sizes.
Usage: python3 movefx_ui.py PORT   (set SHOTS=/some/dir to save a picture of each case; nothing is saved by default)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
SHOTS = os.environ.get("SHOTS")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
JS = r"""
window.__mf = {
  synth(o){
    const base=D.ENCOUNTERS.find(e=>e.name===(o.foe||'Bandit outlaw')) || D.ENCOUNTERS[0], e={...G.scaleEnemy(base,10)};
    if (o.name) e.name = o.name;
    const wt = o.wt || 'sword';
    const log=[{turn:1, rule:0, me: o.me || '', them: o.them || '', hp: o.hp ?? 191, ehp: o.ehp ?? 60, a: o.a || 'attack', wt}];
    if (o.ally) log[0].me = (o.me || 'Attack: 10') + ' · Aela shoots 12';
    const f = { log, hp0:200, ehp0:120, won:true, e, wt, wt0:wt, weapon:null, eq:{}, armor:{}, shield:null, allies: o.ally ? [{name:'Aela'}] : [], turn:1 };
    return f;
  },
  mount(f, w){
    document.getElementById('mfbox')?.remove(); const b=document.createElement('div'); b.id='mfbox'; b.style.cssText=`position:fixed;left:0;top:0;width:${w+12}px;z-index:9999;background:#111;padding:6px`; document.body.appendChild(b);
    const d=document.createElement('div'); d.style.width=w+'px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); b.appendChild(d); return true;
  },
};
"""
SPELLS = [("firebolt", "Firebolt: 40", 560), ("ice_spike", "Ice Spike: 40", 560), ("lightning_bolt", "Lightning Bolt: 40", 600),
          ("fireball", "Fireball: 40", 560), ("flames", "Flames: 20", 560), ("frostbite", "Frostbite: 20", 560), ("chain_lightning", "Chain Lightning: 40", 640),
          ("healing", "Healing: +30 health", 470), ("lesser_ward", "Lesser Ward", 520), ("oakflesh", "Oakflesh", 520), ("conjure_familiar", "Conjure Familiar", 520),
          ("fear", "Fear: it flees", 680), ("paralyze", "Paralyze: it is paralyzed", 680), ("sun_fire", "Sun Fire: 30", 680), ("soul_trap", "Soul Trap", 680)]
SHOTS_CASES = [  # name, synth opts, ms to advance before the picture
    ("bow", {"wt": "bow", "me": "Attack: 20", "a": "attack"}, 640),
    ("bow_power_fire", {"wt": "bow", "me": "Power attack: 30 +fire", "a": "power_attack"}, 700),
    ("crossbow", {"wt": "crossbow", "me": "Attack: 20", "a": "attack"}, 300),
    ("bow_miss", {"wt": "bow", "me": "Attack misses", "a": "attack", "ehp": 120}, 900),
    ("foe_archer", {"name": "Bandit archer", "them": "Bandit archer hits 9"}, 640),
    ("ballista", {"name": "Dwarven ballista", "them": "Dwarven ballista hits 19"}, 300),
]
MOVE_CASES = [  # name, synth opts, the effect key it should play, ms to advance before the picture
    ("sword", {"wt": "sword", "me": "Attack: 20", "a": "attack"}, "atk:sword", 440),
    ("dagger", {"wt": "dagger", "me": "Attack: 14", "a": "attack"}, "atk:dagger", 330),
    ("power_greatsword", {"wt": "greatsword", "me": "Power attack: 40", "a": "power_attack"}, "pow:greatsword", 640),
    ("power_warhammer", {"wt": "warhammer", "me": "Power attack: 44 (critical)", "a": "power_attack"}, "pow:warhammer", 700),
    ("bash", {"wt": "sword", "me": "Shield bash: 8, staggers", "a": "bash"}, "bash", 400),
    ("shout_force", {"wt": "sword", "me": "Unrelenting Force: 12", "a": "shout:unrelenting_force"}, "shout:unrelenting_force", 560),
    ("shout_fire", {"wt": "sword", "me": "Fire Breath: 30", "a": "shout:fire_breath"}, "shout:fire_breath", 560),
]
async def main():
    if SHOTS: os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        for vw, vh, w in [(390, 844, 368), (1920, 1080, 900)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 500 else 1)
            pg = await ctx.new_page(); pg.set_default_timeout(90000); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=mf{vw}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Archer"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
            ok(await pg.evaluate("typeof MOVEFX === 'object' && typeof ARROWFX === 'object'"), f"{vw}: movefx.js and arrowfx.js load")
            for sid, me, t in SPELLS:
                await pg.evaluate(f"()=>__mf.mount(__mf.synth({{me:{me!r}, a:'spell:{sid}'}}), {w})")
                el = await pg.query_selector("#mfbox .fscene")
                await pg.evaluate(f"FIGHTART.advance({t})")
                ok(await pg.evaluate("document.querySelector('#mfbox .fscene canvas')?.dataset.mfx || ''") == f"spell:{sid}", f"{vw}: {sid} plays its own effect")
                if SHOTS and vw < 500: await el.screenshot(path=os.path.join(SHOTS, f"spell_{sid}.png"))
            for name, o, t in SHOTS_CASES:
                js = "{" + ",".join(f"{k}:{v!r}" for k, v in o.items()) + "}"
                await pg.evaluate(f"()=>__mf.mount(__mf.synth({js}), {w})")
                el = await pg.query_selector("#mfbox .fscene")
                await pg.evaluate(f"FIGHTART.advance({t})")
                n = await pg.evaluate("+(document.querySelector('#mfbox .fscene canvas')?.dataset.shots || 0)")
                ok(n >= 1, f"{vw}: {name} fires a projectile ({n})")
                if SHOTS and vw < 500: await el.screenshot(path=os.path.join(SHOTS, f"{name}.png"))
            for name, o, key, t in MOVE_CASES:
                js = "{" + ",".join(f"{k}:{v!r}" for k, v in o.items()) + "}"
                await pg.evaluate(f"()=>__mf.mount(__mf.synth({js}), {w})")
                el = await pg.query_selector("#mfbox .fscene")
                await pg.evaluate(f"FIGHTART.advance({t})")
                ok(await pg.evaluate("document.querySelector('#mfbox .fscene canvas')?.dataset.mfx || ''") == key, f"{vw}: {name} plays {key}")
                if SHOTS and vw < 500: await el.screenshot(path=os.path.join(SHOTS, f"move_{name}.png"))
            ok(await pg.evaluate("FIGHTART.advance(3000).length >= 0"), f"{vw}: scenes step on without errors")
            await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "movefx_ui ok")
    if fails: sys.exit(1)
asyncio.run(main())
