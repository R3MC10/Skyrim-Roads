"""Hero card figure (heroart.js [herocard]): the standing figure on the Pack tab's paper doll and the Hero page is the
painted fight figure (same sex, race and worn gear as in fights), drawn again when the gear changes; player cards too.
Checks a male and a female hero on a phone (390) and a PC (1366).
Usage: python3 herocard_ui.py PORT   (screenshots go to $OUT or the temp folder's rotn_shots/herocard/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
_SHOTS = (os.environ.get("SHOTS") or os.path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT", _SHOTS + "herocard/")
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
GEAR = """()=>{const S=window.__dbg.save(); window.__hc={}; for(const i of ['iron_armor','iron_helmet','iron_boots','iron_gauntlets','iron_shield','iron_war_axe','steel_armor','steel_battleaxe']) if(D.ITEMS[i]) window.__hc[i]=G.give(S,i,1);
 for(const i of ['iron_armor','iron_helmet','iron_boots','iron_gauntlets','iron_war_axe','iron_shield']) if(window.__hc[i]!=null) G.equip(S,window.__hc[i]); return JSON.stringify(HEROART.lookOf(S));}"""
CLEAR = "setInterval(()=>document.querySelectorAll('#modal,.toast,.pbanner,#banner').forEach(m=>m.remove()),150)"
FIG = "(sel)=>{const i=document.querySelector(sel); return i?{p:i.classList.contains('hfig-p'),src:i.src.length+':'+i.src.slice(-40),wait:i.hasAttribute('data-hfk')}:null}"
async def painted(pg, sel, ms=12000):
    t = 0
    while t < ms:
        f = await pg.evaluate(FIG, sel)
        if f and f["p"]: return f
        await pg.wait_for_timeout(250); t += 250
    return await pg.evaluate(FIG, sel)
async def run(b, w, h, sex, tag):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&tb&p=hc{tag}"); await pg.wait_for_timeout(1500)
    await pg.wait_for_selector(".press", state="attached", timeout=20000); await pg.evaluate("document.querySelector('.press').click()"); await pg.wait_for_timeout(500)
    await pg.wait_for_selector(".mi[data-t=new]", state="attached", timeout=10000); await pg.evaluate("document.querySelector('.mi[data-t=new]').click()"); await pg.wait_for_timeout(800)
    if sex == "f": await pg.evaluate("document.querySelector('.cgsexb[data-v=f]').click()"); await pg.wait_for_timeout(300)
    await pg.fill("#nm", "Brynja" if sex == "f" else "Ulfric"); await pg.evaluate("document.querySelector('#begin').click()"); await pg.wait_for_timeout(1500)
    await pg.evaluate(CLEAR)
    look = await pg.evaluate(GEAR)
    ok(("\"sx\":\"f\"" in look) == (sex == "f") and "iron_war_axe" in look, f"{tag}: look carries the sex ({sex}) and the gear")
    await pg.evaluate("window.__ui.openMenu('items')"); await pg.wait_for_timeout(500)
    f1 = await painted(pg, "#sky .dfig img.herofig")
    ok(f1 and f1["p"], f"{tag}: paper doll figure is painted {f1}")
    await pg.screenshot(path=OUT + f"{tag}_doll.png")
    await pg.evaluate("()=>{const S=window.__dbg.save(); G.equip(S,window.__hc.steel_armor); G.equip(S,window.__hc.steel_battleaxe); window.__ui.closeMenu(); window.__ui.openMenu('items');}"); await pg.wait_for_timeout(500)
    f2 = await painted(pg, "#sky .dfig img.herofig")
    ok(f2 and f2["p"] and f2["src"] != f1["src"], f"{tag}: new gear draws a new figure {f2}")
    await pg.screenshot(path=OUT + f"{tag}_doll_steel.png")
    ok(await pg.evaluate("()=>{const L=HEROART.lookOf(window.__dbg.save()); return L.eq.weapon==='steel_battleaxe' && !L.eq.shield}"), f"{tag}: two-handed axe on, shield off")
    crest = await pg.evaluate("()=>{const S=window.__dbg.save(); return [!!document.querySelector('#sky .dfig .bust-badge'), BUSTART.SEX[S.race]===(S.sex==='f'?'f':'m')]}")
    ok(crest[0] == crest[1], f"{tag}: race bust badge only when it is the hero's sex {crest}")
    other = await pg.evaluate("()=>{const L=HEROART.lookOf(window.__dbg.save()); return HEROART.figure({look:{...L,id:'friend-1'}},30,42,{bare:true})}")
    ok("hfig-p" in other, f"{tag}: another player's card figure (from their look) is painted too")
    await pg.evaluate("window.__ui.closeMenu(); window.__ui.go('hero')"); await pg.wait_for_timeout(500)
    await pg.screenshot(path=OUT + f"{tag}_hero.png")
    ok(not errs, f"{tag}: no page errors {errs[:2]}")
    await ctx.close()
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        for (w, h, dev) in [(390, 844, "ph"), (1366, 900, "pc")]:
            for sex in ["m", "f"]:
                await run(b, w, h, sex, f"{dev}_{sex}")
        await b.close()
    print("FAILS:", len(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
