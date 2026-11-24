import asyncio, sys, base64, io
from playwright.async_api import async_playwright
from PIL import Image
PORT = sys.argv[1] if len(sys.argv) > 1 else "8776"
RACES = ["nord","imperial","breton","redguard","altmer","bosmer","dunmer","orc","khajiit","argonian"]
SETS = {
 "iron": ["iron_armor","iron_helmet","iron_gauntlets","iron_boots","iron_shield","iron_war_axe"],
 "steel": ["steel_armor","steel_helmet","steel_gauntlets","steel_boots","steel_shield","ench|steel_sword|fire|20|800"],
 "dwarven": ["dwarven_armor","dwarven_helmet","iron_gauntlets","steel_boots","dwarven_war_axe"],
 "mage": ["archmage_robes","staff_flames"],
 "archer": ["leather_armor","leather_helmet","leather_bracers","leather_boots","elven_bow"],
 "rogue": ["guild_armor","hide_bracers","hide_boots","iron_dagger"],
 "forsworn": ["forsworn_armor","hide_helmet","hide_boots","forsworn_sword","hide_shield"],
 "nordic": ["ancient_nord_armor","ancient_nord_helmet","ancient_nord_gauntlets","ancient_nord_boots","ancient_nord_greatsword"],
 "chain": ["chainmail","chainmail_coif","chainmail_gloves","chainmail_boots","crossbow_dwarven"],
 "robes": ["mage_robes","steel_mace"],
}
def img_of(src): return Image.open(io.BytesIO(base64.b64decode(src.split(",")[1]))).convert("RGB")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hero"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.wait_for_timeout(300)
        sheets = {}
        for st in ["ink"]:
            row = []
            for r in RACES:
                await pg.click(f"[data-race={r}]"); await pg.wait_for_timeout(80)
                row.append(img_of(await pg.get_attribute(".heroprev img", "src")))
            sheets["races_" + st] = row
        await pg.fill("#nm", "Hero"); await pg.click("[data-race=nord]"); await pg.fill("#nm", "Hero"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        for st in ["ink"]:
            row = []
            for i, (name, items) in enumerate(SETS.items()):
                race = RACES[i % len(RACES)]
                await pg.evaluate("([items, race])=>{const S=window.__dbg.save(); S.race=race; const lo=G.loadout(S); lo.equipment={}; for(const id of items){ const r=G.give(S,id); G.equip(S,r);} }", [items, race])
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(150)
                row.append(img_of(await pg.get_attribute(".herobox img", "src")))
            sheets["gear_" + st] = row
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.vampire={since:1,fedAt:1};}"); await pg.click("[data-tab=map]"); await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(150)
        sheets["vamp"] = [img_of(await pg.get_attribute(".herobox img", "src"))]
        el = await pg.query_selector(".herobox"); await el.screenshot(path="hero_tab.png")
        for k, row in sheets.items():
            wsum = sum(i.width for i in row); hmax = max(i.height for i in row)
            out = Image.new("RGB", (wsum, hmax), (30, 30, 30)); x = 0
            for im in row: out.paste(im, (x, 0)); x += im.width
            out.save(f"hero_{k}.png")
        print("sheets:", list(sheets))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
