# Character art upgrade (figart.js): the rigged hero in every clip, both art styles, and on the screens that use it
# (hero tab, travel strip walking / riding / wagon, a fight, portraits). Usage: python heroart2_ui.py 8765 [chrome path]
import asyncio, sys, os, io, base64, re
from playwright.async_api import async_playwright
from PIL import Image
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
CHROME = sys.argv[2] if len(sys.argv) > 2 else ("C:/Program Files/Google/Chrome/Application/chrome.exe" if os.name == "nt" else "/usr/bin/google-chrome")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_heroart2") + os.sep
os.makedirs(OUT, exist_ok=True)
FIGHT_JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fight2_ui.py"), encoding="utf8").read().split('JS = r"""')[1].split('"""')[0]

LOOKS = r"""
window.__looks = [
  {r:"nord", id:"a1", eq:{chest:"steel_armor", head:"steel_helmet", hands:"steel_gauntlets", feet:"steel_boots", shield:"steel_shield", weapon:"steel_sword"}, gl:{w:"fire"}},
  {r:"khajiit", id:"a2", sx:"f", eq:{chest:"leather_armor", hands:"leather_bracers", feet:"leather_boots", weapon:"elven_bow"}, gl:{}},
  {r:"altmer", id:"a3", eq:{chest:"archmage_robes", weapon:"staff_flames", amulet:"amulet_gold", ring:"ring_silver"}, gl:{}},
  {r:"orc", id:"a4", eq:{chest:"ancient_nord_armor", head:"ancient_nord_helmet", hands:"ancient_nord_gauntlets", feet:"ancient_nord_boots", weapon:"ancient_nord_greatsword"}, gl:{}},
  {r:"argonian", id:"a5", eq:{chest:"guild_armor", hands:"hide_bracers", feet:"hide_boots", weapon:"iron_dagger"}, gl:{}},
  {r:"redguard", id:"a6", sx:"f", eq:{chest:"dwarven_armor", head:"dwarven_helmet", weapon:"dwarven_war_axe", shield:"iron_shield"}, gl:{}},
  {r:"dunmer", id:"a7", eq:{chest:"forsworn_armor", head:"hide_helmet", feet:"hide_boots", weapon:"forsworn_sword", shield:"hide_shield"}, gl:{}},
  {r:"breton", id:"a8", eq:{}, gl:{}},
];
window.__sheet = (style, rows, poses) => {
  const H = 96, cellW = 120, c = document.createElement("canvas"); c.width = cellW * poses.length; c.height = (H + 40) * rows.length;
  const g = c.getContext("2d"); g.fillStyle = "#efe3c8"; g.fillRect(0, 0, c.width, c.height);
  rows.forEach((L, j) => poses.forEach(([pose, frame], i) => {
    HEROART.drawFigure(g, {look: L}, i * cellW + cellW / 2 - (pose === "ride" ? 4 : 0), (j + 1) * (H + 40) - 10, {pose, frame, h: pose === "ride" ? 70 : H, style, horse: "#6b4a2e"});
  }));
  return c.toDataURL();
};
"""
def img_of(src): return Image.open(io.BytesIO(base64.b64decode(src.split(",")[1]))).convert("RGB")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&fightanim&assets&p=h2"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Torvald"); await pg.click(".rpick[data-race=nord]"); await pg.fill("#nm", "Torvald"); await pg.click("#begin"); await pg.wait_for_function("!!(window.__dbg && window.__dbg.save())", timeout=15000)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("()=>{" + LOOKS + "}"); await pg.evaluate("()=>{" + FIGHT_JS + "}")
        files = []
        for st in ["ink"]:
            # every clip for every look
            poses = [["idle", 0], ["walk", 1], ["walk", 5], ["attack", 0], ["attack", 2], ["cast", 1], ["block", 0], ["hit", 0], ["down", 0], ["ride", 1], ["sit", 0]]
            img_of(await pg.evaluate("([s,p])=>__sheet(s,__looks,p)", [st, poses])).save(OUT + f"poses_{st}.png"); files.append(f"poses_{st}.png")
            # the walk cycle and the attack, frame by frame
            cyc = [["walk", i] for i in range(8)] + [["attack", i] for i in range(4)]
            img_of(await pg.evaluate("([s,p])=>__sheet(s,__looks.slice(0,3),p)", [st, cyc])).save(OUT + f"cycle_{st}.png"); files.append(f"cycle_{st}.png")
            # hero tab with real gear on the save
            await pg.evaluate("()=>{const S=window.__dbg.save(); const lo=G.loadout(S); lo.equipment={}; for(const id of ['steel_armor','steel_helmet','steel_gauntlets','steel_boots','steel_shield','ench|steel_sword|fire|20|800']){ const r=G.give(S,id); G.equip(S,r);} }")
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.click("[data-tab=world]"); await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(250)
            el = await pg.query_selector(".herobox")
            if not el:   # the hero panel content, if the tab is behind a menu on this screen size
                await pg.evaluate("()=>{ const d=document.createElement('div'); d.className='herobox'; d.id='hb2'; d.style.cssText='position:fixed;left:0;top:0;z-index:99999;width:160px;background:#222'; d.innerHTML=HEROART.figure(window.__dbg.save(),160,220); document.body.appendChild(d); }")
                await pg.wait_for_timeout(200); el = await pg.query_selector("#hb2")
            if el: await el.screenshot(path=OUT + f"herotab_{st}.png"); files.append(f"herotab_{st}.png")
            # portraits
            img_of(await pg.evaluate("""()=>{ const c=document.createElement('canvas'); c.width=8*60; c.height=60; const g=c.getContext('2d'); g.fillStyle='#333'; g.fillRect(0,0,c.width,60);
              const jobs=__looks.map((L,i)=>new Promise(res=>{ const m=HEROART.portrait({look:L},56).match(/src="([^"]+)"/); const im=new Image(); im.onload=()=>{ g.drawImage(im,i*60+2,2,56,56); res(); }; im.src=m[1]; }));
              return Promise.all(jobs).then(()=>c.toDataURL()); }""")).save(OUT + f"portraits_{st}.png"); files.append(f"portraits_{st}.png")
            # the travel strip: walking with company, riding, the wagon
            for name, extra in [("walk", "{company:[{look:__looks[1]},{look:__looks[3]}]}"), ("ride", "{riding:true, horse:'#5a3a22'}"), ("wagon", "{carriage:true}")]:
                src = await pg.evaluate(f"()=>{{ const info={{ground:'tundra', progress:0.4, look:HEROART.lookOf(window.__dbg.save()), company:[], ...{extra}}}; return FXART.vignetteFrame(info, 40).toDataURL(); }}")
                im = img_of(src); im = im.resize((im.width * 2, im.height * 2), Image.NEAREST); im.save(OUT + f"travel_{name}_{st}.png"); files.append(f"travel_{name}_{st}.png")
            # a fight, mid swing
            await pg.evaluate("FIGHTART.manual(true)")
            await pg.evaluate("()=>{ const r=__f2.weaponFight('sword'); __f2.mount(r.f); }"); await pg.wait_for_timeout(200)
            for ms in [300, 440]:
                await pg.evaluate(f"FIGHTART.advance({ms if ms == 300 else 140})")
                el = await pg.query_selector("#f2box .fscene")
                if el: await el.screenshot(path=OUT + f"fight_{ms}_{st}.png"); files.append(f"fight_{ms}_{st}.png")
            await pg.evaluate("FIGHTART.manual(false); document.getElementById('f2box')?.remove(); document.getElementById('hb2')?.remove()")
        print("files:", [OUT + f for f in files])
        print("errors:", errs)
        await b.close()
asyncio.run(main())
