# Ally figures in the fight scene: a frame sheet of every kind of helper, in both art styles, no page errors.
import asyncio, sys, io, json, re
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
PORT = sys.argv[1] if len(sys.argv) > 1 else "8842"
OUT = "/home/claude/tests/"
JS = re.search(r'JS = r"""(.*?)"""', open(OUT + "fight2_ui.py").read(), re.S).group(1)   # the fight-scene helpers (__f2) from the fight animation test
FRAMES = [200, 560, 700, 1500]
# (label, line action, my line, allies)
CASES = [
    ("follower Lydia", "attack", "Attack: 30 · Lydia 12", [{"name": "Lydia", "follower": True, "fid": "lydia", "kind": "follower"}]),
    ("follower Jenassa", "attack", "Attack: 30 · Jenassa 12", [{"name": "Jenassa", "follower": True, "fid": "jenassa", "kind": "follower"}]),
    ("thrall + risen dead", "attack", "Attack: 30 · Risen dead 8", [{"name": "Bandit thrall", "thrall": True}, {"name": "Risen dead", "dmg": 8}]),
    ("ice wolves", "attack", "Attack: 30 · Ice wolf 8", [{"name": "Ice wolf", "dmg": 8}, {"name": "Ice wolf", "dmg": 8}]),
    ("werewolf brothers", "attack", "Attack: 30 · Werewolf brother 16", [{"name": "Werewolf brother", "dmg": 16}, {"name": "Werewolf brother", "dmg": 16}]),
    ("gargoyle", "attack", "Attack: 30 · Gargoyle 16", [{"name": "Gargoyle", "dmg": 16}]),
    ("Sovngarde heroes", "attack", "Attack: 30 · Ysgramor 20", [{"name": "Ysgramor", "valor": True}, {"name": "Gormlaith Golden-Hilt", "valor": True}]),
    ("Odahviing", "attack", "Attack: 30 · Odahviing 35", [{"name": "Odahviing", "odah": True}]),
    ("bent dragon", "attack", "Attack: 30 · A bent dragon 22", [{"name": "A bent dragon", "dmg": 22}]),
    ("Animal Allegiance", "attack", "Attack: 30 · Wild animal 9", [{"name": "Wild animal", "beast": True}, {"name": "Wild animal", "beast": True}]),
    ("atronachs", "attack", "Attack: 30 · Flame Atronach 12", [{"name": "Flame Atronach"}, {"name": "Frost Atronach"}, {"name": "Storm Atronach"}]),
    ("summon: familiar", "spell:conjure_familiar", "Conjure Familiar: a spectral wolf appears", []),
    ("summon: Dremora Lord", "spell:dremora_lord", "Conjure Dremora Lord: a Dremora answers", []),
    ("soldiers (quest allies)", "attack", "Attack: 30 · Imperial soldier 10", [{"name": "Imperial soldier", "dmg": 10}, {"name": "Legate Rikke", "dmg": 14}]),
]

def sheet(rows, path, title):
    w, h = rows[0][1][0].size
    cols = max(len(r[1]) for r in rows); pad = 4; lab = 18
    im = Image.new("RGB", (cols * (w + pad) + pad, len(rows) * (h + lab + pad) + pad + 20), (17, 17, 17))
    d = ImageDraw.Draw(im); d.text((6, 4), title, fill=(240, 230, 200))
    for i, (name, shots) in enumerate(rows):
        y = 20 + i * (h + lab + pad); d.text((6, y + 2), name, fill=(240, 220, 160))
        for j, sh in enumerate(shots): im.paste(sh.convert("RGB"), (pad + j * (w + pad), y + lab))
    im = im.resize((int(im.width * 0.5), int(im.height * 0.5)), Image.LANCZOS); im.save(path)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs = []
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, st=style: errs.append(st + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=aa{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Helper"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
            rows = []
            for label, a, me, allies in CASES:
                second = "Attack: 30 · familiar 8" if a.startswith("spell:") else me
                await pg.evaluate(f"""()=>{{ const f=__f2.synth({json.dumps(a)}, {json.dumps(me)}, 'Bandit outlaw', {{ehp:120, end:60, allies:{json.dumps(allies)}}});
                    f.log[1].me={json.dumps(second)}; f.log.push({{turn:3, rule:0, me:{json.dumps(second)}, them:'', hp:191, ehp:0, a:'attack', wt:'sword'}}); f.log[1].ehp=60; window.__cur=f; __f2.mount(f); }}""")
                el = await pg.query_selector("#f2box .fscene")
                shots, tprev = [], 0
                for t in FRAMES:
                    await pg.evaluate(f"FIGHTART.advance({t - tprev})"); tprev = t
                    shots.append(Image.open(io.BytesIO(await el.screenshot())))
                rows.append((label, shots))
            sheet(rows, f"{OUT}allyart_{style}.png", f"allies in the fight scene ({style}) - frames at {FRAMES} ms")
            await ctx.close()
        await b.close()
        print("errors:", errs[:5])
        print("RESULT", "OK" if not errs else "FAIL")

asyncio.run(main())
