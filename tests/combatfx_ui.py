"""Combat effects: blood, the different deaths (head off, ash, ice, lightning, launched), enchanted-weapon glows, the camera.
Frames of each kill go into one contact sheet per art style.  Usage: python3 combatfx_ui.py PORT"""
import asyncio, sys, os, io
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
JS = r"""
window.__cf = {
  synth(foe, a, me, opts={}){
    const base=D.ENCOUNTERS.find(e=>e.name===foe) || D.ENCOUNTERS[0], e={...G.scaleEnemy(base,10)};
    const wt = opts.wt || 'sword';
    const log=[{turn:1, rule:0, me: opts.first || 'Attack: 22', them:`${e.name} hits 9`, hp:191, ehp:60, a:'attack', wt},
               {turn:2, rule:0, me, them:'', hp:191, ehp:0, a, wt}];
    return { log, hp0:200, ehp0:120, won:true, e, wt, wt0:wt, weapon: opts.ench ? { enchant:{ effect: opts.ench } } : null, eq:{}, armor:{}, shield:null, allies:[], turn:2 };
  },
  mount(f, death){
    document.getElementById('cfbox')?.remove(); const b=document.createElement('div'); b.id='cfbox'; b.style.cssText='position:fixed;left:0;top:0;width:380px;z-index:9999;background:#111;padding:6px'; document.body.appendChild(b);
    window.__real = window.__real || COMBATFX.deathOf; COMBATFX.deathOf = death ? (()=>death) : window.__real;
    const d=document.createElement('div'); d.style.width='368px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); b.appendChild(d); return true;
  },
  toFall(){ let st, ms=0; do { st=FIGHTART.advance(50); ms+=50; } while (st.length && st[0].beat < st[0].beats && ms<20000); return ms; },
};
"""
CASES = [("decap", "Bandit outlaw", "attack", "Critical hit! Attack: 40", {}),
         ("ash", "Bandit outlaw", "spell:firebolt", "Firebolt: 40", {}),
         ("shatter", "Frost troll", "spell:ice_spike", "Ice Spike: 40", {}),
         ("fry", "Black bear", "spell:lightning_bolt", "Lightning Bolt: 40", {}),
         ("launch", "Bandit outlaw", "attack", "Power attack: 40", {"wt": "warhammer"}),
         ("topple", "Skeleton", "attack", "Attack: 40", {})]
AFTER = [250, 450, 1500]   # ms after the killing blow lands
def sheet(rows, path):
    w, h = rows[0][1][0].size; pad, lab = 4, 18
    im = Image.new("RGB", (len(rows[0][1]) * (w + pad) + pad, len(rows) * (h + lab + pad) + pad), (17, 17, 17)); d = ImageDraw.Draw(im)
    for i, (name, shots) in enumerate(rows):
        y = i * (h + lab + pad); d.text((6, y + 2), name, fill=(240, 220, 160))
        for j, sh in enumerate(shots): im.paste(sh.convert("RGB"), (pad + j * (w + pad), y + lab))
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS); im.save(path)
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        for style in ["ink", "pixel"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=cf{style}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fighter"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
            ok(await pg.evaluate("typeof COMBATFX === 'object' && COMBATFX.gore() === true"), f"{style}: combat effects loaded, blood on by default")
            rows = []
            for kind, foe, a, me, opts in CASES:
                await pg.evaluate(f"()=>__cf.mount(__cf.synth({foe!r}, {a!r}, {me!r}, {opts!r}), {kind!r})".replace("True", "true"))
                el = await pg.query_selector("#cfbox .fscene"); await pg.evaluate("__cf.toFall()")
                shots, prev = [], 0
                for t in AFTER:
                    st = await pg.evaluate(f"FIGHTART.advance({t - prev})"); prev = t
                    if t == AFTER[1]: ok(st[0]["cam"][0] > 1.08 and st[0]["cam"][1] > 0.55 and st[0]["cam"][2] == kind, f"{style} {kind}: the camera closes in on the dying foe {st[0]['cam']}")
                    shots.append(Image.open(io.BytesIO(await el.screenshot())))
                rows.append((f"{kind}: {foe}", shots))
            # an enchanted blade mid-fight: the glow and a coloured trail
            shots = []
            for ench in ["fire", "frost", "shock"]:
                await pg.evaluate(f"()=>__cf.mount(__cf.synth('Bandit outlaw', 'attack', 'Attack: 20', {{ench:{ench!r}}}), null)")
                el = await pg.query_selector("#cfbox .fscene"); await pg.evaluate("FIGHTART.advance(380)")
                shots.append(Image.open(io.BytesIO(await el.screenshot())))
            rows.append(("enchanted: fire · frost · shock", shots))
            ok(await pg.evaluate("FIGHTART.advance(100).length >= 0"), f"{style}: scenes step without errors")
            sheet(rows, f"{OUT}combatfx_{style}.png")
            # blood off: no beheading
            await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), gore:false}))")
            ok(await pg.evaluate("COMBATFX.gore() === false && __real({who:'me',move:'sword',wt:'sword',crit:true}, 'bandit', {melee:true, person:true}) !== 'decap'"), f"{style}: Blood off means no heads come off")
            await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("FAILED" if fails else "ALL OK", len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
