"""Reward tooltips on screen (rewardtips.js + tooltip.js + itemcmp.js).
A quest reward window (text + the icons of what you were just given) and a fight's loot list:
  - 1920 wide (mouse): resting on a reward icon shows the item card with itemcmp's "Against what you wear" block,
    the box covers no button of the window, moving away closes it.
  - 390 wide (finger): a tap on a reward icon slides the card up as the bottom sheet (tt-sheet, at the bottom edge),
    the window stays open, a tap elsewhere closes it; the same icon tapped again closes it too.
Usage: python tests/rewardtips_ui.py [port]   (0 or nothing: serves game/ itself; shots go to $SHOTS or the temp folder)"""
import asyncio, os, socket, subprocess, sys, tempfile, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots"), "rewardtips"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9700, 9800):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9700-9799")

ARG = sys.argv[1] if len(sys.argv) > 1 else "0"
PORT = int(ARG) if ARG != "0" else free_port()
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

async def start(b, w, h, phone):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if phone else 1, has_touch=phone, is_mobile=phone)
    await ctx.add_init_script("try{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}');p.lang='en';localStorage.setItem('rotn_prefs',JSON.stringify(p));}catch(e){}")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    for _ in range(3):
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=rt{w}{int(time.time()) % 10000}")
        try: await pg.wait_for_selector(".press", timeout=10000); break
        except Exception: print("title screen didn't come up, reloading")
    await pg.wait_for_timeout(500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin")
    await pg.wait_for_function("window.__dbg && window.__dbg.save()", timeout=20000); await pg.wait_for_timeout(1200)
    await pg.evaluate("()=>{document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.toast,.pbanner,#banner').forEach(m=>m.remove());}")
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.level=14;
      const id=G.give(S,'iron_dagger'); G.equip(S,id); RTIP.forget();}""")
    await pg.wait_for_timeout(4000)   # the opening quest's step completes in Whiterun: let its message come and go
    await pg.evaluate("()=>{document.querySelectorAll('#modal').forEach(m=>m.remove()); RTIP.forget();}")
    return ctx, pg, errs

OPEN_QUEST = """()=>{const S=window.__dbg.save(); RTIP.forget(); G.give(S,'steel_sword'); G.give(S,'potion_health_minor',3);
  window.__dbg.message('Quest', 'The jarl thanks you and hands you a sword and some potions.'); }"""
# [itemcards2] sword + shield in hand, then a two-handed find
TWOHAND = """()=>{const S=window.__dbg.save(); const lo=G.loadout(S).equipment; delete lo.offhand;
  const sw=G.give(S,'iron_sword'), sh=G.give(S,'hide_shield'); G.equip(S,sw); G.equip(S,sh); RTIP.forget(); G.give(S,'iron_greatsword');
  window.__dbg.message('Quest', 'The smith hands you a greatsword.'); }"""
TIP = """()=>{const t=document.querySelector('#tip'); if(!t||!t.classList.contains('on')) return null; const r=t.getBoundingClientRect();
  const btns=[...document.querySelectorAll('#modal button, #modal .btn')].map(b=>b.getBoundingClientRect()).filter(q=>q.width);
  const cover=btns.some(q=>r.left<q.right&&r.right>q.left&&r.top<q.bottom&&r.bottom>q.top);
  return {sheet:t.classList.contains('tt-sheet'), text:t.innerText, top:r.top, bottom:r.bottom, h:r.height, vh:innerHeight, cmp:!!t.querySelector('.ic-cmp,.ic-wearing'), cover}}"""

async def pc(b):
    ctx, pg, errs = await start(b, 1920, 1080, False)
    await pg.evaluate(OPEN_QUEST); await pg.wait_for_timeout(700)
    n = await pg.evaluate("document.querySelectorAll('#modal .rt-strip [data-rtip]').length")
    ok(n == 2, f"1920 quest reward window shows 2 reward icons ({n})")
    await pg.hover("#modal .rt-strip [data-tip-k^='rw:steel_sword']"); await pg.wait_for_timeout(700)
    t = await pg.evaluate(TIP)
    ok(bool(t) and not t["sheet"], f"1920 hover: a floating card, not a sheet ({t and t['sheet']})")
    ok(bool(t) and "Steel Sword" in t["text"] and "Hits for" in t["text"] and "Weight" in t["text"], "1920 card: name, damage, weight")
    ok(bool(t) and t["cmp"] and "Against what you wear" in t["text"] and "Iron Dagger" in t["text"], "1920 card: itemcmp's compare block against the worn dagger")
    ok(bool(t) and not t["cover"], "1920 card covers no button of the window")
    await pg.screenshot(path=os.path.join(OUT, "pc_1920_quest.png"))
    await pg.mouse.move(5, 5); await pg.wait_for_timeout(300)
    await pg.hover("#modal .rt-strip [data-tip-k^='rw:potion_health_minor']", timeout=5000); await pg.wait_for_timeout(500)
    t = await pg.evaluate(TIP)
    ok(bool(t) and "Stack of 3" in t["text"] and "Already have" in t["text"], f"1920 potion stack card ({t and t['text'][:120]!r})")
    await pg.mouse.move(5, 5); await pg.wait_for_timeout(500)
    ok(await pg.evaluate(TIP) is None, "1920 moving away closes the card")
    # a fight's loot list
    await pg.evaluate("document.querySelector('#modal [data-act=close]').click()"); await pg.wait_for_timeout(400)
    await pg.evaluate("""()=>window.__dbg.fightResult({title:'Victory', text:'The bandit falls.', fight:{log:[], turn:3, e:{name:'Bandit'}}, gold:26, loot:['Steel Sword','Potion of Minor Healing ×2']})""")
    await pg.wait_for_timeout(700)
    rows = await pg.evaluate("[...document.querySelectorAll('#modal .loot-row[data-rtip]')].map(e=>e.dataset.tipK)")
    ok(len(rows) == 3 and rows[0].startswith("rwgold:26"), f"1920 loot list: gold and items carry reward cards ({rows})")
    if rows:
        await pg.hover("#modal .loot-row[data-tip-k='rwgold:26']"); await pg.wait_for_timeout(700)
        t = await pg.evaluate(TIP); ok(bool(t) and "26 gold" in t["text"], "1920 gold card")
    # [itemcards2] the Items menu shows the same lines (PC side panel on hover)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate(TWOHAND); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('#sky [data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(400)
    gid = await pg.evaluate("window.__dbg.save().inv.filter(r => r.item === 'iron_greatsword').pop().id")
    el = await pg.query_selector(f"#sky .sky-row[data-id='{gid}']")
    if el:
        await el.scroll_into_view_if_needed(); bb = await el.bounding_box()
        await pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); await pg.wait_for_timeout(700)
    d = await pg.evaluate("() => document.querySelector('#sky .sky-detail')?.innerText || ''")
    ok("Takes both hands: your Hide Shield comes off" in d and "instead of One-Handed" in d, f"1920 Items: the greatsword says the shield comes off + the skill switch ({d[-260:]!r})")
    hn = await pg.evaluate("ITEMCMP.hits(window.__dbg.save(), 'iron_greatsword')")
    ok(f"{hn} (15 base)" in d and f"→ {hn}" in d, f"1920 Items: header and compare show the same with-skill number {hn}")
    await pg.screenshot(path=os.path.join(OUT, "pc_1920_items_twohander.png"))
    ok(not errs, f"1920 no page errors {errs[:3]}")
    await ctx.close()

async def phone(b):
    ctx, pg, errs = await start(b, 390, 844, True)
    await pg.evaluate(OPEN_QUEST); await pg.wait_for_timeout(700)
    await pg.screenshot(path=os.path.join(OUT, "phone_390_before.png"))
    sel = "#modal .rt-strip [data-tip-k^='rw:steel_sword']"
    await pg.tap(sel, timeout=5000); await pg.wait_for_timeout(500)
    t = await pg.evaluate(TIP)
    ok(bool(t) and t["sheet"], f"390 tap: the card is the bottom sheet ({t and t['sheet']})")
    ok(bool(t) and abs(t["bottom"] - t["vh"]) <= 2 and 0.3 * t["vh"] <= t["h"] <= 0.56 * t["vh"], f"390 sheet sits at the bottom, 35-55% high ({t and round(t['h'])} of {t and t['vh']})")
    ok(bool(t) and t["cmp"] and "Against what you wear" in t["text"], "390 sheet: itemcmp's compare block")
    ok(await pg.evaluate("!!document.querySelector('#modal')"), "390 the window stays open under the sheet")
    await pg.screenshot(path=os.path.join(OUT, "phone_390_sheet.png"))
    await pg.tap("#modal h2"); await pg.wait_for_timeout(500)
    ok(await pg.evaluate(TIP) is None, "390 a tap elsewhere closes the sheet")
    ok(await pg.evaluate("!!document.querySelector('#modal')"), "390 ...and doesn't close the window")
    await pg.wait_for_timeout(1100)
    await pg.tap("#modal .rt-strip [data-tip-k^='rw:potion_health_minor']"); await pg.wait_for_timeout(1500)
    t = await pg.evaluate(TIP)
    ok(bool(t) and t["sheet"] and "Stack of 3" in t["text"], "390 another icon: its sheet, and it stays open (no made-up mouse hover closes it)")
    await pg.tap("#modal h2"); await pg.wait_for_timeout(400)
    # [itemcards2] a two-handed reward while holding sword + shield: the sheet says what comes off
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(1100)
    await pg.evaluate(TWOHAND); await pg.wait_for_timeout(700)
    await pg.tap("#modal .rt-strip [data-tip-k^='rw:iron_greatsword']", timeout=5000); await pg.wait_for_timeout(600)
    t = await pg.evaluate(TIP)
    ok(bool(t) and t["sheet"] and "Takes both hands: your Hide Shield comes off" in t["text"] and "instead of One-Handed" in t["text"], f"390 two-hander sheet: shield comes off + skill switch ({t and t['text'][-200:]!r})")
    await pg.evaluate("()=>{const t=document.querySelector('#tip'); if(t) t.scrollTop=t.scrollHeight;}"); await pg.wait_for_timeout(200)
    await pg.screenshot(path=os.path.join(OUT, "phone_390_twohander.png"))
    ok(not errs, f"390 no page errors {errs[:3]}")
    await ctx.close()

async def main():
    srv = None
    if ARG == "0":
        srv = subprocess.Popen(["node", os.path.join(ROOT, "tests", "serve.js"), str(PORT), os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.2)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            await pc(b); await phone(b)
            await b.close()
    finally:
        if srv: srv.terminate()
    print(f"shots in {OUT}")
    print("rewardtips_ui: " + ("all ok" if not fails else f"{len(fails)} failed"))
    sys.exit(1 if fails else 0)

asyncio.run(main())
