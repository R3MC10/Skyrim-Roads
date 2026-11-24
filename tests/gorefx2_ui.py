"""Realistic splatter (gorefx2.js): a critical slash, a slow-motion finisher, a draugr, a Dwemer machine, frost, fire
and shock, with the rendered effect sprites loaded (?assets), on a phone and on a 1920x1080 PC.
Usage: python3 gorefx2_ui.py PORT [OUTDIR]   (shots go to tests/gorefx2/ by default)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = (sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "gorefx2")).rstrip("/\\") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
JS = r"""
window.__gr = {
  synth(foe, a, me, opts={}){
    const base=D.ENCOUNTERS.find(e=>e.name===foe) || D.ENCOUNTERS[0], e={...G.scaleEnemy(base,10)};
    if (opts.name) { e.name = opts.name; e.tags = opts.tags || e.tags; }
    const wt = opts.wt || 'sword';
    const log = opts.kill
      ? [{turn:1, rule:0, me:'Attack: 22', them:`${e.name} hits 30`, hp:170, ehp:60, a:'attack', wt}, {turn:2, rule:0, me, them:'', hp:170, ehp:0, a, wt}]
      : [{turn:1, rule:0, me, them:`${e.name} hits 34`, hp:166, ehp:50, a, wt}, {turn:2, rule:0, me, them:`${e.name} hits 30`, hp:136, ehp:20, a, wt}];
    return { log, hp0:200, ehp0:120, won: opts.kill ? true : undefined, tbMid: !opts.kill, e, wt, wt0:wt, weapon:null, eq:{}, armor:{}, shield:null, allies:[], turn:2, bf: !!opts.bf };
  },
  mount(f, w){
    document.getElementById('grbox')?.remove(); const b=document.createElement('div'); b.id='grbox'; b.style.cssText=`position:fixed;left:0;top:0;width:${w+12}px;z-index:9999;background:#111;padding:6px`; document.body.appendChild(b);
    const d=document.createElement('div'); d.style.width=w+'px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); b.appendChild(d); return true;
  },
  run(ms){ let st=[], t=0; while (t < ms) { st = FIGHTART.advance(40); t += 40; } return st; },
  toFall(){ let st, ms=0; do { st=FIGHTART.advance(50); ms+=50; } while (st.length && st[0].beat < st[0].beats && ms<20000); return ms; },
};
"""
CASES = [("crit", "Bandit outlaw", "attack", "Critical hit! Attack: 44", {}),
         ("finisher", "Bandit outlaw", "attack", "Critical hit! Attack: 60", {"kill": True, "bf": True}),
         ("draugr", "Draugr", "attack", "Critical hit! Power attack: 40", {"wt": "warhammer"}),
         ("dwemer", "Bandit outlaw", "attack", "Critical hit! Power attack: 36", {"wt": "battleaxe", "name": "Dwarven Sphere", "tags": ["construct"]}),
         ("frost", "Bandit outlaw", "spell:ice_spike", "Ice Spike: 30", {}),
         ("fire", "Bandit outlaw", "spell:firebolt", "Firebolt: 32", {}),
         ("shock", "Bandit outlaw", "spell:lightning_bolt", "Lightning Bolt: 30", {})]
DEVICES = [("phone", {"width": 390, "height": 844}, 3, 368), ("pc", {"width": 1920, "height": 1080}, 1, 1600)]
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        for dev, vp, dpr, w in DEVICES:
            ctx = await b.new_context(viewport=vp, device_scale_factor=dpr)
            await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({artStyle:'ink'}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + str(getattr(e, "stack", ""))[:300]))
            await pg.goto(f"http://127.0.0.1:{PORT}/index.html?assets&net=bc&notut&fightanim&p=gfx{dev}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fighter"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
            ok(await pg.evaluate("typeof GOREFX2 === 'object' && GORE.scene.fx2 === true"), f"{dev}: gorefx2 loaded and hooked")
            await pg.evaluate("GOREFX2.KEYS.forEach(k=>ASSETS.img(k))")
            for _ in range(40):
                if await pg.evaluate("GOREFX2.KEYS.every(k=>ASSETS.stateOf(k)==='ok')"): break
                await pg.wait_for_timeout(150)
            ok(await pg.evaluate("GOREFX2.KEYS.every(k=>ASSETS.stateOf(k)==='ok')"), f"{dev}: every effect sprite loads")
            for kind, foe, a, me, opts in CASES:
                await pg.evaluate(f"()=>__gr.mount(__gr.synth({foe!r}, {a!r}, {me!r}, {opts!r}), {w})".replace("True", "true"))
                el = await pg.query_selector("#grbox .fscene"); await pg.wait_for_timeout(250)
                if kind == "finisher":
                    await pg.evaluate("__gr.toFall()")
                    for i, ms in enumerate([120, 160, 220]):
                        await pg.evaluate(f"FIGHTART.advance({ms})"); await el.screenshot(path=f"{OUT}{dev}-{kind}-{i + 1}.png")
                    await pg.evaluate("FIGHTART.advance(1600)")
                    await el.screenshot(path=f"{OUT}{dev}-{kind}-after.png")
                else:
                    await pg.evaluate("__gr.run(%d)" % {"crit": 560, "frost": 760, "fire": 760, "shock": 700}.get(kind, 640))
                    await el.screenshot(path=f"{OUT}{dev}-{kind}-impact.png")
                    await pg.evaluate("__gr.run(160)")
                    await el.screenshot(path=f"{OUT}{dev}-{kind}-impact2.png")
                    await pg.evaluate("__gr.run(3000)")
                    await el.screenshot(path=f"{OUT}{dev}-{kind}-after.png")
            # Off draws no sprites
            await pg.evaluate("GORE._setLevel('off')")
            ok(await pg.evaluate("!GORE.scene({W:400,H:180}).fx2count"), f"{dev}: Off has no sprite layer")
            await pg.evaluate("GORE._setLevel(null)")
            await ctx.close()
        ok(not errs, "no page errors " + str(errs[:3]))
        await b.close()
    print("FAILED: " + ", ".join(fails) if fails else "gorefx2_ui ok")
    sys.exit(1 if fails else 0)
asyncio.run(main())
