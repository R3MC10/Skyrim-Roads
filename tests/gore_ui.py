"""Blood and gore (gore.js): a slash, an arrow, fire, a skeleton, a Dwemer machine and a kill, plus the setting,
on a phone and on a PC, in both art styles. Shots go to tests/gore/.  Usage: python3 gore_ui.py PORT"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gore") + os.sep
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
    return { log, hp0:200, ehp0:120, won: opts.kill ? true : undefined, tbMid: !opts.kill, e, wt, wt0:wt, weapon:null, eq:{}, armor:{}, shield:null, allies:[], turn:2 };
  },
  mount(f, w){
    document.getElementById('grbox')?.remove(); const b=document.createElement('div'); b.id='grbox'; b.style.cssText=`position:fixed;left:0;top:0;width:${w+12}px;z-index:9999;background:#111;padding:6px`; document.body.appendChild(b);
    const d=document.createElement('div'); d.style.width=w+'px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); b.appendChild(d); return true;
  },
  run(ms){ let st=[], t=0; while (t < ms) { st = FIGHTART.advance(40); t += 40; } return st; },
  toFall(){ let st, ms=0; do { st=FIGHTART.advance(50); ms+=50; } while (st.length && st[0].beat < st[0].beats && ms<20000); return ms; },
};
"""
CASES = [("slash", "Bandit outlaw", "attack", "Attack: 34", {}),
         ("arrow", "Bandit outlaw", "attack", "Attack: 30", {"wt": "bow"}),
         ("fire", "Bandit outlaw", "spell:firebolt", "Firebolt: 32", {}),
         ("skeleton", "Skeleton", "attack", "Power attack: 36", {"wt": "warhammer"}),
         ("dwemer", "Bandit outlaw", "attack", "Power attack: 36", {"wt": "battleaxe", "name": "Dwarven Sphere", "tags": ["construct"]}),
         ("kill", "Bandit outlaw", "attack", "Critical hit! Attack: 60", {"kill": True})]
DEVICES = [("phone", {"width": 390, "height": 844}, 2, 368), ("pc", {"width": 1280, "height": 860}, 1, 520)]
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        for dev, vp, dpr, w in DEVICES:
            for style in ["ink", "pixel"]:
                ctx = await b.new_context(viewport=vp, device_scale_factor=dpr)
                await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&fightanim&p=gr{dev}{style}"); await pg.wait_for_timeout(1800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fighter"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
                ok(await pg.evaluate("typeof GORE === 'object' && GORE.level() === 'full'"), f"{dev} {style}: gore loaded, Full by default")
                for kind, foe, a, me, opts in CASES:
                    await pg.evaluate(f"()=>__gr.mount(__gr.synth({foe!r}, {a!r}, {me!r}, {opts!r}), {w})".replace("True", "true"))
                    el = await pg.query_selector("#grbox .fscene"); await pg.wait_for_timeout(250)
                    if kind == "kill":
                        await pg.evaluate("__gr.toFall()"); await pg.evaluate("FIGHTART.advance(1300)")
                    else:
                        await pg.evaluate("__gr.run(%d)" % {"slash": 620, "arrow": 900, "fire": 800}.get(kind, 860))
                        await el.screenshot(path=f"{OUT}{dev}-{style}-{kind}-impact.png")
                        await pg.evaluate("__gr.run(3200)")
                    await el.screenshot(path=f"{OUT}{dev}-{style}-{kind}.png")
                # the setting
                if style == "ink":
                    await pg.evaluate("document.getElementById('grbox')?.remove()")
                    await pg.click("#sndBtn"); await pg.wait_for_timeout(600)
                    row = await pg.query_selector("button[data-k=gore][data-v=low]")
                    ok(row is not None, f"{dev}: Settings shows Blood and gore Off / Low / Full")
                    if row:
                        await row.click(); await pg.wait_for_timeout(300)
                        ok(await pg.evaluate("GORE.level()") == "low", f"{dev}: tapping Low sets Low")
                        r2 = await pg.query_selector("button[data-k=gore][data-v=low]")
                        await r2.scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
                        await pg.screenshot(path=f"{OUT}{dev}-setting.png")
                        await (await pg.query_selector("button[data-k=gore][data-v=full]")).click()
                await ctx.close()
        ok(not errs, "no page errors " + str(errs[:3]))
        await b.close()
    print("FAILED: " + ", ".join(fails) if fails else "gore_ui ok")
    sys.exit(1 if fails else 0)
asyncio.run(main())
