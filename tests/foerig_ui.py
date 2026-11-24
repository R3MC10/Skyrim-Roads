"""Foe rigs: frame strips of foes breathing, flinching when hit, winding up and striking, and falling, in both art styles,
drawn (no pictures) and painted (?assets).  Sheets go to tests/out_foerigs/.  Usage: python3 foerig_ui.py PORT"""
import asyncio, sys, os, io
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_foerigs") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
JS = r"""
window.__fr = {
  synth(foe){
    const base=D.ENCOUNTERS.find(e=>e.name===foe) || D.ENCOUNTERS[0], e={...G.scaleEnemy(base,10), name:foe};
    const log=[{turn:1, rule:0, me:'Attack: 22', them:`${foe} hits 9`, hp:191, ehp:98, a:'attack', wt:'sword'},
               {turn:2, rule:0, me:'Attack: 22', them:`${foe} hits 9`, hp:182, ehp:76, a:'attack', wt:'sword'},
               {turn:3, rule:0, me:'Attack: 80', them:'', hp:182, ehp:0, a:'attack', wt:'sword'}];
    return { log, hp0:200, ehp0:120, won:true, e, wt:'sword', wt0:'sword', weapon:null, eq:{}, armor:{}, shield:null, allies:[], turn:3 };
  },
  mount(f){
    document.getElementById('frbox')?.remove(); const b=document.createElement('div'); b.id='frbox'; b.style.cssText='position:fixed;left:0;top:0;width:380px;z-index:9999;background:#111;padding:6px'; document.body.appendChild(b);
    const d=document.createElement('div'); d.style.width='368px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); b.appendChild(d); return true;
  },
  rig(){ const c=document.querySelector('#frbox .fscene canvas'); return c ? c.dataset.rig || '' : ''; },
  step(ms){ const s=FIGHTART.advance(ms); return { beat: s[0]?.beat ?? 99, beats: s[0]?.beats ?? 0, rig: __fr.rig() }; },
};
"""
FOES = ["Bandit outlaw", "Draugr", "Skeleton", "Lone wolf", "Black bear", "Frostbite spider", "Mudcrab", "Giant", "Frost troll",
        "Dragon", "Flame Atronach", "Ice Wraith", "Dwarven Centurion", "Hagraven", "Mammoth"]
NOT_ATTACK = {"", "idle", "hit", "stagger", "block", "death", "taunt", "cower", "fly", "para"}
def sheet(rows, path, heads):
    w, h = rows[0][1][0].size; pad, lab = 4, 18
    im = Image.new("RGB", (len(heads) * (w + pad) + pad, len(rows) * (h + lab + pad) + pad + lab), (17, 17, 17)); d = ImageDraw.Draw(im)
    for j, hd in enumerate(heads): d.text((pad + j * (w + pad) + 4, 3), hd, fill=(200, 200, 200))
    for i, (name, shots) in enumerate(rows):
        y = lab + i * (h + lab + pad); d.text((6, y + 2), name, fill=(240, 220, 160))
        for j, sh in enumerate(shots): im.paste(sh.convert("RGB"), (pad + j * (w + pad), y + lab))
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS); im.save(path)
async def strip(pg, foe):
    await pg.evaluate(f"()=>__fr.mount(__fr.synth({foe!r}))")
    el = await pg.query_selector("#frbox .fscene")
    shot = lambda: el.screenshot()
    shots, seen, st = [Image.open(io.BytesIO(await shot()))], {}, {"beat": 0, "beats": 1, "rig": ""}
    want = ["hit", "wind", "strike"]
    for _ in range(400):
        st = await pg.evaluate("__fr.step(30)")
        r = st["rig"]
        if r == "hit" and "hit" not in seen: seen["hit"] = 0
        if r not in NOT_ATTACK and "wind" not in seen: seen["wind"] = 0; seen["attack"] = r
        for k in list(seen):
            if k == "attack": continue
            seen[k] += 30
            if k == "hit" and seen[k] == 120: shots.append(Image.open(io.BytesIO(await shot())))
            if k == "wind" and seen[k] == 240: shots.append(Image.open(io.BytesIO(await shot())))
            if k == "wind" and seen[k] == 480: shots.append(Image.open(io.BytesIO(await shot())))
        if len(shots) >= 4 or st["beat"] >= st["beats"]: break
    while len(shots) < 4: shots.append(Image.open(io.BytesIO(await shot())))
    ms = 0
    while st["beat"] < st["beats"] and ms < 20000: st = await pg.evaluate("__fr.step(50)"); ms += 50
    await pg.evaluate("FIGHTART.advance(700)"); shots.append(Image.open(io.BytesIO(await shot())))
    death = await pg.evaluate("__fr.rig()")
    return shots[:5], seen.get("attack", ""), death, "hit" in seen
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        for style in ["ink", "pixel"]:
            for assets in [False, True]:
                ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
                await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
                q = "&assets" if assets else ""
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim{q}&p=fr{style}{int(assets)}"); await pg.wait_for_timeout(1800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fighter"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
                ok(await pg.evaluate("typeof FOERIG === 'object'"), f"{style}: foe rigs loaded")
                if assets:   # let the painted foes load
                    await pg.evaluate("Promise.all(" + repr(FOES) + ".map(n=>{ const k=ASSETS.foeKey(n, FIGHTART.foeOf({name:n})); const im=ASSETS.img(k); return new Promise(r=>setTimeout(r, 50)); }))")
                    await pg.wait_for_timeout(2500)
                rows = []
                for foe in FOES:
                    shots, atk, death, hit = await strip(pg, foe)
                    ok(hit, f"{style}{' pictures' if assets else ''} {foe}: flinches when hit")
                    ok(atk != "", f"{style}{' pictures' if assets else ''} {foe}: attacks with a clip ({atk})")
                    ok(death == "death" or foe in ("Flame Atronach",) or death != "", f"{style} {foe}: falls ({death})")
                    rows.append((f"{foe} · {atk}", shots))
                name = f"foerigs_{style}{'_painted' if assets else ''}.png"
                sheet(rows, OUT + name, ["idle", "hit (+120ms)", "wind-up", "strike", "falls"])
                print("sheet", os.path.abspath(OUT + name))
                await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    if fails: print("FAILED", len(fails)); sys.exit(1)
    print("foerig_ui ok")
asyncio.run(main())
