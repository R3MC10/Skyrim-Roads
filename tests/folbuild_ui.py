"""Followers who learn like you (folbuild.js): Follower tab -> Skills at phone size (360x780, ink and pixel) and PC
(1280x800). Their build badge, level bar, every skill with a bar, perks by tree; giving a bow makes them an archer.
Usage: python3 folbuild_ui.py PORT   (screenshots go to $OUT or tests/out_folbuild/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_folbuild")) + os.sep
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
SETUP = """()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=500; S.level=14; S.thaneWhiterun=true;
 for(const i of ['hunting_bow','iron_arrow']) if(D.ITEMS[i]) G.give(S,i,i==='iron_arrow'?40:1); const m=TOWNS.hire(S,'lydia'); window.__ui.refresh(); return m}"""
CLEAR = "setInterval(()=>document.querySelectorAll('#modal,.toast,.pbanner,#banner,.pban').forEach(m=>m.remove()),150)"
OVER = """()=>{const W=innerWidth,o=[];for(const e of document.querySelectorAll('#side *')){const r=e.getBoundingClientRect();
  if(!r.width||getComputedStyle(e).position==='fixed')continue; let p=e.parentElement,clip=false; while(p&&p!==document.body){const s=getComputedStyle(p); if(/auto|scroll|hidden/.test(s.overflowX)){clip=true;break} p=p.parentElement}
  if(!clip&&r.right>W+1)o.push((e.className||e.tagName)+'@'+Math.round(r.right));} return o.slice(0,5)}"""
async def run(b, style, vw, vh, tag):
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
    await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=fb{tag}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate(SETUP); await pg.evaluate(CLEAR)
    async def tap(sel):
        try: await pg.click(sel, timeout=4000); await pg.wait_for_timeout(250); return True
        except Exception: return False
    async def snap(sel, fn):
        for _ in range(3):
            try:
                await pg.evaluate("document.querySelectorAll('.pban,.toast').forEach(m=>m.remove())")
                el = await pg.query_selector(sel)
                if el: await el.screenshot(path=OUT + fn, timeout=6000); return True
            except Exception: await pg.wait_for_timeout(300)
        return False
    await pg.evaluate("window.__ui.go('follower')"); await pg.wait_for_timeout(400)
    ok(await tap(".fol2 [data-op=view][data-id=perks]"), f"{tag}: Skills tab opens")
    info = await pg.evaluate("""()=>({badge:document.querySelector('.fol2 .fb-badge')?.innerText||'', sk:document.querySelectorAll('.fol2 .fb-sk').length,
      main:document.querySelectorAll('.fol2 .fb-sk.main').length, bars:document.querySelectorAll('.fol2 .fb-sk .bar').length, cxp:!!document.querySelector('.fol2 .fb-cxp'),
      lvl:/Level|Poziom/i.test(document.querySelector('.fol2 .fb-build')?.innerText||'')})""")
    ok(info["sk"] >= 18 and info["bars"] == info["sk"] and info["main"] >= 2, f"{tag}: every skill with a bar, build skills bold {info}")
    ok(info["cxp"] and info["lvl"], f"{tag}: level and level bar shown {info}")
    ok(info["badge"].strip().lower() in ("warrior", "wojownik"), f"{tag}: Lydia starts as a warrior ({info['badge']!r})")
    ok(await pg.evaluate(OVER) == [], f"{tag}: Skills view fits {await pg.evaluate(OVER)}")
    await snap("#side .fol2", f"skills_{tag}.png")
    # give her the bow through the gear list -> she becomes an archer, perks respecced
    await tap(".fol2 [data-op=view][data-id=inv]")
    await tap(".fol2 [data-op=ftside][data-id=yours]")
    await tap(".fol2 .ft-list .sky-row:has-text('Hunting Bow')")
    await tap(".fol2 .ft-detail [data-op=ftgiveeq]")
    arch = await pg.evaluate("FOL2.st(window.__dbg.save()).arch")
    ok(arch == "archer", f"{tag}: a bow makes her an archer ({arch})")
    await tap(".fol2 [data-op=view][data-id=perks]")
    badge = await pg.evaluate("document.querySelector('.fol2 .fb-badge')?.innerText||''")
    ok(badge.strip().lower() in ("archer", "łucznik"), f"{tag}: badge says archer ({badge!r})")
    pk = await pg.evaluate("Object.keys(FOL2.st(window.__dbg.save()).perks||{})")
    ok(len(pk) >= 1, f"{tag}: perks picked in the new trees {pk}")
    await snap("#side .fol2", f"skills_archer_{tag}.png")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        await run(b, "ink", 360, 780, "phone_ink")
        await run(b, "pixel", 360, 780, "phone_pixel")
        await run(b, "ink", 1280, 800, "pc_ink")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
    sys.exit(1 if fails else 0)
asyncio.run(main())
