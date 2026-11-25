"""Painted dungeon rooms + parchment dungeon map (dunrooms.js, dunart.js).
Phone 390x844 and PC 1440x900, pictures on (?assets). Walks a known layout in a barrow, then checks a Dwemer ruin and a
bandit mine (its trap room borrows the cave painting). Checks: the room shows a painting for its type and theme, the map is
an ink drawing with tap targets on the next rooms, the trail overlay is there, and on PC nothing scrolls (the room column
and the map both fit the window). Phones get the route strip and two-to-a-row actions on screen (dungeonphone).
Screenshots go to OUT (default tests/out_dunrooms).
Run: node tests/serve.js 8790  →  py tests/dunrooms_ui.py 8790"""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8790"
OUT = os.environ.get("OUT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_dunrooms")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
fails = []
def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

SETUP = """(n)=>{ const S=window.__dbg.save(); S.location=n; [S.x,S.y]=WORLD.places[n]; if(!S.discovered.includes(n)) S.discovered.push(n); S.cleared={}; S.level=30; S.hpBonus=3000;
  G.setHealth(S,G.maxHealth(S)); for(const k of Object.keys(S.skills)) S.skills[k].lvl=80; G.give(S,'potion_health',5); S.dungeon=null; window.__ui.refresh(); }"""
ROWS = [[{"type": "fight", "links": [0, 1]}, {"type": "trap", "links": [1]}], [{"type": "treasure", "links": [0]}, {"type": "elite", "links": [0, 1]}],
        [{"type": "trap", "links": [0]}, {"type": "puzzle", "links": [0]}], [{"type": "rest", "links": [0]}], [{"type": "boss", "links": []}]]

async def clear(pg):
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")

async def enter(pg, place, rows=None):
    await pg.evaluate(SETUP, place); await pg.wait_for_timeout(200)
    await clear(pg); await pg.evaluate("document.querySelector('.tab[data-tab=map], button[data-tab=map]')?.click()"); await pg.wait_for_timeout(300); await clear(pg)   # #side also carries data-tab (hidden on PC)
    await pg.evaluate("document.querySelector('#dun') || document.querySelector('#side [data-act=enter], [data-act=enter]')?.click()")
    await pg.wait_for_timeout(600)
    check(await pg.evaluate("window.__dbg.save().dungeon?.place") == place, f"inside {place}")
    if rows:   # a known layout (the map redraws on the first room pick)
        await pg.evaluate("(rows)=>{ const d=window.__dbg.save().dungeon; d.rows=rows; }", rows)
    await clear(pg)

async def go_room(pg, idx=0):
    await clear(pg)
    nodes = await pg.query_selector_all("#dun .dnode")
    if not nodes: return None
    try: await nodes[min(idx, len(nodes) - 1)].evaluate("e=>e.click()")   # story popups (letters) may cover the map
    except Exception:
        await pg.screenshot(path=os.path.join(OUT, "click_fail.png")); raise
    await pg.wait_for_timeout(300)
    return await pg.evaluate("window.__dbg.save().dungeon?.room?.type")

async def painted(pg, timeout=6000):
    try:
        await pg.wait_for_selector("#dun .droomart.painted img", timeout=timeout)
        await pg.wait_for_function("(()=>{const i=document.querySelector('#dun .droomart.painted img');return i&&i.complete&&i.naturalWidth>0})()", timeout=timeout)
        await pg.wait_for_timeout(700)   # fade-in
        return await pg.evaluate("document.querySelector('#dun .droomart.painted img')?.dataset.key")
    except Exception:
        return await pg.evaluate("document.querySelector('#dun .droomart')?.className || 'none'")

async def finish_room(pg):
    for _ in range(5):
        await clear(pg)
        btn = await pg.query_selector("#dun [data-act=dact]")
        if not btn: break
        await btn.evaluate("e=>e.click()"); await pg.wait_for_timeout(600)
        if not await pg.evaluate("!!window.__dbg.save().dungeon?.room"): break
    await clear(pg)

async def no_scroll(pg, tag):
    m = await pg.evaluate("""()=>{ const d=document.querySelector('#dun'), c=d.querySelector('.dcol'), map=d.querySelector('.dmap'), r=map.getBoundingClientRect();
      return { dun: d.scrollHeight - d.clientHeight, page: document.scrollingElement.scrollHeight - innerHeight, mapBottom: r.bottom, mapRight: r.right, h: innerHeight, w: innerWidth,
               mapW: r.width, mapH: r.height, col: c.scrollHeight - c.clientHeight } }""")
    check(m["dun"] <= 1, f"{tag}: the dungeon screen doesn't scroll ({m['dun']}px)")
    check(m["col"] <= 1, f"{tag}: the room column fits too ({m['col']}px over)")
    check(m["mapBottom"] <= m["h"] + 1 and m["mapRight"] <= m["w"] + 1, f"{tag}: whole map on screen ({m['mapW']:.0f}x{m['mapH']:.0f}, bottom {m['mapBottom']:.0f}/{m['h']})")
    return m

async def phone_checks(pg, vw, vh, tag):
    """[dungeonphone] route strip on phones only, actions two to a row and on screen, indoor air instead of weather"""
    m = await pg.evaluate("""()=>{ const d=document.querySelector('#dun'), st=d.querySelector('.dstrip'), ev=d.querySelector('.dcol .card.foe .evc'),
        bs=[...(ev?ev.querySelectorAll('.btn'):[])].map(b=>b.getBoundingClientRect());
      return { strip: !!st && getComputedStyle(st).display!=='none', stripBottom: st ? st.getBoundingClientRect().bottom : 0, n: bs.length,
        cols: new Set(bs.map(r=>Math.round(r.left))).size, lastBottom: bs.length ? Math.max(...bs.map(r=>r.bottom)) : 0,
        fx: !!d.querySelector('.droomart.painted canvas.dunfx'), foe: !!d.querySelector('.droomart .droomfoe img'), chips: d.querySelectorAll('.dstrip .dschip').length } }""")
    if vw < 900:
        check(m["strip"] and m["stripBottom"] < vh * 0.5, f"{tag}: route strip above the room ({m['stripBottom']:.0f})")
        check(m["chips"] >= 1, f"{tag}: strip shows the rooms ahead ({m['chips']})")
        check(m["lastBottom"] <= vh, f"{tag}: all room actions on screen without scrolling ({m['lastBottom']:.0f}/{vh})")
    else:
        check(not m["strip"], f"{tag}: no strip on PC (the chart is beside the room)")
    check(m["n"] < 2 or m["cols"] == 2, f"{tag}: actions two to a row ({m['n']} buttons, {m['cols']} columns)")
    check(m["fx"], f"{tag}: indoor air layer over the painted room")
    check(m["foe"], f"{tag}: the foe stands in the painting")

async def run(b, vw, vh, tag):
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 600 else 1)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=dunr{tag}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Delver"); await pg.click("#begin"); await pg.wait_for_timeout(900)
    await pg.evaluate("ART.setStyle && ART.setStyle('ink')")   # the pixel style is gone (24 Nov)
    # ---- a barrow, known layout
    await enter(pg, "Bleak Falls Barrow", ROWS)
    rt = await go_room(pg, 0)
    check(rt == "fight", f"{tag}: first room is a fight ({rt})")
    key = await painted(pg)
    check(key == "room-fight-barrow", f"{tag}: barrow fight room is painted ({key})")
    check(await pg.evaluate("!!document.querySelector('#dun .dmap img') && !!document.querySelector('#dun .dflick') && !!document.querySelector('#dun .dlegend img')"), f"{tag}: map drawing, glow layer and ink legend")
    await pg.screenshot(path=os.path.join(OUT, f"{tag}_barrow_fight.png"))
    if vw >= 900: await no_scroll(pg, f"{tag} fight room")
    await phone_checks(pg, vw, vh, tag)
    await finish_room(pg)
    check(await pg.evaluate("document.querySelectorAll('#dun .dnode').length") >= 1, f"{tag}: next rooms are tappable on the map")
    seg = await pg.evaluate("document.querySelector('#dun .dmap')?.dataset.seg || ''")
    await pg.screenshot(path=os.path.join(OUT, f"{tag}_barrow_choose.png"))
    rt = await go_room(pg, 1)   # the elite room
    key = await painted(pg)
    check(rt == "elite" and key == "room-elite-barrow", f"{tag}: elite room painted ({rt}, {key})")
    seg = await pg.evaluate("document.querySelector('#dun .dmap')?.dataset.seg || ''")
    check(len(seg.split(",")) == 6, f"{tag}: newest step is inked in by the overlay ({seg[:30]})")
    await pg.wait_for_timeout(900)
    mp = await pg.query_selector("#dun .dmapcard"); await mp.screenshot(path=os.path.join(OUT, f"{tag}_barrow_map.png"))
    await finish_room(pg)
    rt = await go_room(pg, 1)   # puzzle
    key = await painted(pg)
    check(key == f"room-{rt}-barrow", f"{tag}: {rt} room painted ({key})")
    await pg.screenshot(path=os.path.join(OUT, f"{tag}_barrow_{rt}.png"))
    if vw >= 900: await no_scroll(pg, f"{tag} {rt} room")
    # ---- a Dwemer ruin and a bandit mine (trap → borrows the cave painting)
    for place, rows, want in [("Mzulft", [[{"type": "treasure", "links": [0]}, {"type": "trap", "links": [0]}], [{"type": "boss", "links": []}]], "room-treasure-dwemer"),
                              ("Embershard Mine", [[{"type": "trap", "links": [0]}, {"type": "trap", "links": [0]}], [{"type": "boss", "links": []}]], "room-trap-cave")]:
        await pg.evaluate("()=>{ const S=window.__dbg.save(); S.dungeon=null; }"); await pg.evaluate("window.__ui.refresh()"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('#dun')?.remove()")
        await enter(pg, place, rows)
        await go_room(pg, 0)
        key = await painted(pg)
        check(key == want, f"{tag}: {place} room shows {want} ({key})")
        await pg.screenshot(path=os.path.join(OUT, f"{tag}_{place.split()[0].lower()}.png"))
    check(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME else await p.chromium.launch(args=["--no-sandbox"])
        await run(b, 390, 844, "phone")
        await run(b, 1440, 900, "pc")
        await run(b, 1280, 720, "pcsmall")
        await b.close()
    print("screenshots in", OUT)
    print("FAILED" if fails else "ALL OK", len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
