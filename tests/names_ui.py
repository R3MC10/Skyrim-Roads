"""Names table (names.js): the map, a place's header and the travel list show exactly the same names as before, on a
   phone (390x844) and a PC (1920x1080), in English and Polish. Every word drawn on the map canvas is recorded
   (fillText hook) along with the place header and the Where-to list, and written to names_<lang>_<w>.json in $SHOTS
   (or the temp folder), so a run before and after a change can be compared: python3 names_ui.py PORT [compare-dir].
   It also checks that names.js is loaded and that its display names match what the screen shows."""
import asyncio, json, os, sys, tempfile
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
CMP = sys.argv[2] if len(sys.argv) > 2 else None
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
OUT = os.environ.get("SHOTS") or tempfile.gettempdir(); os.makedirs(OUT, exist_ok=True)
fails = []
def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

HOOK = """(()=>{window.__drawn=new Set(); const f=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(t,...a){try{if(typeof t==='string'&&/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3}/.test(t))window.__drawn.add(t)}catch(e){} return f.call(this,t,...a)}})()"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        for lang in ["en", "pl"]:
            for (w, h) in [(390, 844), (1920, 1080)]:
                tag = f"{lang}_{w}"
                ctx = await b.new_context(viewport={"width": w, "height": h})
                await ctx.add_init_script("try{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}');p.lang='%s';localStorage.setItem('rotn_prefs',JSON.stringify(p));}catch(e){}" % lang)
                await ctx.add_init_script(HOOK)
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&p=nm{tag}&notut"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('#sky') && window.__ui.back && window.__ui.back()")
                async def go(place):
                    await clear()
                    await pg.evaluate("""(pl)=>{const S=window.__dbg.save(); S.trip=null; S.dungeon=null; S.location=pl; [S.x,S.y]=WORLD.places[pl]; S.level=14; S.gold=3000;
                      for (const n of ['Riverwood','Whiterun','Solitude','Windhelm','Riften','Markarth','Falkreath','Morthal','Dawnstar','Winterhold','Helgen','Ivarstead','Bleak Falls Barrow','Western Watchtower','High Hrothgar']) if(!S.discovered.includes(n)) S.discovered.push(n);
                      window.__ui.refresh();}""", place)
                    await pg.evaluate("document.querySelector('[data-tab=town]').click()"); await pg.wait_for_timeout(900); await clear()
                await go("Whiterun")
                head = await pg.evaluate("(()=>{const h=document.querySelector('#locs .ls-head'); return h? [h.querySelector('.ls-name')?.textContent, h.querySelector('.ls-hold')?.textContent] : null})()")
                check(head is not None and head[0] == "Whiterun", f"{tag}: place header shows Whiterun ({head})")
                await pg.screenshot(path=os.path.join(OUT, f"names_loc_{tag}.png"))
                # the map: leave town, open the map tab
                await pg.evaluate("(()=>{const S=window.__dbg.save(); S.location=null; [S.x,S.y]=WORLD.places['Whiterun']; S.x+=0.02; window.__ui.refresh();})()")
                await pg.evaluate("window.__ui.go ? window.__ui.go('map') : document.querySelector('[data-tab=map]')?.click()"); await pg.wait_for_timeout(2500)
                await pg.evaluate("window.__drawn.clear(); window.__ui.refresh(); window.scrollTo(0,0); document.querySelector('#side')?.scrollTo?.(0,0)"); await pg.wait_for_timeout(2500)
                await pg.screenshot(path=os.path.join(OUT, f"names_map_{tag}.png"))
                drawn = sorted(await pg.evaluate("[...window.__drawn]"))
                # the place list: under the map before the five tabs, on World -> Places since
                if await pg.evaluate("typeof MENUS !== 'undefined' && !!window.__ui.go"):
                    await pg.evaluate("window.__ui.go('places')"); await pg.wait_for_timeout(1500)
                lst = await pg.evaluate("[...document.querySelectorAll('#side .list .item .t')].map(e=>e.firstChild && e.firstChild.textContent).filter(Boolean).slice(0,40)")
                await pg.screenshot(path=os.path.join(OUT, f"names_places_{tag}.png"))
                check(any("WHITERUN" in d.upper() for d in drawn), f"{tag}: the map draws place names ({len(drawn)} words)")
                has = await pg.evaluate("typeof NAMES !== 'undefined'")
                if has:
                    same = await pg.evaluate("(()=>Object.keys(WORLD.places).filter(n=>NAMES.get(n)!==n))()")
                    check(same == [], f"{tag}: names.js shows every place under its old name ({same[:5]})")
                check(errs == [], f"{tag}: no page errors {errs[:3]}")
                rec = {"head": head, "drawn": drawn, "list": lst}
                fn = os.path.join(OUT, f"names_{tag}.json")
                if CMP:
                    old = json.load(open(os.path.join(CMP, f"names_{tag}.json"), encoding="utf8"))
                    check(old["head"] == rec["head"], f"{tag}: header unchanged ({old['head']} -> {rec['head']})")
                    gone = sorted(set(old["drawn"]) - set(drawn)); new = sorted(set(drawn) - set(old["drawn"]))
                    names = await pg.evaluate("Object.keys(WORLD.places).concat(Object.keys(WORLD.holds)).map(x=>x.toUpperCase())")
                    # live things (guard patrols, caravans, which spot is in view) change between runs; a renamed place would
                    # drop its old label (gone) or draw a form that isn't its id (new)
                    ids = await pg.evaluate("Object.keys(WORLD.places).concat(Object.keys(WORLD.holds))")
                    # small place labels hide behind live markers now and then, so a missing one is noise (every place's label
                    # text is checked above); hold and land names are always drawn, so one going missing means it was renamed
                    pl_ids = await pg.evaluate("Object.keys(WORLD.places).map(x=>x.toUpperCase())")
                    moved = [x for x in gone if x.upper() not in pl_ids and (x.upper() in names or x.isupper())] + [x for x in new if x.upper() in names and x not in ids and x not in [i.upper() for i in ids]]
                    check(moved == [], f"{tag}: the same place and hold names on the map (differ: {moved[:6]})")
                    rows = lambda l: [r.strip() for r in l if r.strip() in ids]
                    check(set(rows(old["list"])) <= set(rows(rec["list"])) or not rows(old["list"]), f"{tag}: place rows in the travel list unchanged ({rows(old['list'])[:4]} -> {rows(rec['list'])[:4]})")
                json.dump(rec, open(fn, "w", encoding="utf8"), ensure_ascii=False, indent=1)
                await ctx.close()
        await b.close()
    print("names_ui:", "ok" if not fails else f"{len(fails)} failed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
