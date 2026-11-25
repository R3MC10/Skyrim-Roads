"""Fight tooltips on top (tooltip.js): in a fight, open the Magic picker and hover cards in its top, middle and bottom rows
on 1440x900, 1083x571 and 1920x1080 screens. The tooltip must be fully on screen, below the fight's top bar, not over the
card it's for, and the topmost thing at its centre (nothing drawn over it). Then a 390px phone: holding a finger on a card
shows the tooltip on top too, fully on screen. Screenshots go to $SHOTS/out_fighttipstop/ (or the temp folder).
Usage: python3 fighttipstop_ui.py PORT"""
import asyncio, sys, os, time, tempfile
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
RUN = str(int(time.time()) % 100000)
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "out_fighttipstop") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration','Alteration','Illusion','Conjuration']) S.skills[k].lvl=60;
  for (const id of Object.keys(D.SPELLS).filter(x=>D.SPELLS[x].kind!=='utility').slice(0,16)) if (!S.spells.includes(id)) S.spells.push(id);
  if (D.SPELLS.fast_healing && !S.spells.includes('fast_healing')) S.spells.push('fast_healing');
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; S.follower=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip,#fhints').forEach(e=>e.remove())"
# the box, whether it's the topmost thing at its centre (the tip ignores the mouse, so let it be hit just for the check),
# whether it overlaps the hovered card, and where the fight's top bar ends
INFO = """(sel) => { const t=document.getElementById('tip'); if(!t||!t.classList.contains('on')||+getComputedStyle(t).opacity<0.99) return null;
  const r=t.getBoundingClientRect(); const pe=t.style.pointerEvents; t.style.pointerEvents='auto';
  const pts=[[.5,.5],[.15,.2],[.85,.2],[.15,.85],[.85,.85]].map(([a,b])=>document.elementFromPoint(r.left+r.width*a, r.top+r.height*b));
  t.style.pointerEvents=pe; const card=document.querySelector(sel)?.getBoundingClientRect(); const top=document.querySelector('#tbf .tbtop')?.getBoundingClientRect();
  const over=card && r.left<card.right-1 && card.left<r.right-1 && r.top<card.bottom-1 && card.top<r.bottom-1;
  return {l:r.left,t:r.top,r:r.right,b:r.bottom,vw:innerWidth,vh:innerHeight, topmost: pts.every(e=>e&&t.contains(e)), over, barB: top?top.bottom:0,
    text:t.innerText, cls:t.className, clipped: getComputedStyle(t).overflowY!=='auto' && [...t.children].some(c=>c.getBoundingClientRect().bottom>r.bottom+1)}; }"""

async def into_fight(pg, tag):
    for _ in range(5):   # a busy local server sometimes drops a script: load again rather than test half a game
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=ftt{RUN}{tag}&tb"); await pg.wait_for_timeout(2000)
        if await pg.evaluate("typeof ENC!=='undefined' && typeof TIP!=='undefined' && typeof FIGHTTIPS!=='undefined' && typeof COMBAT2!=='undefined'"):
            try: await pg.wait_for_selector(".press", timeout=15000); break
            except Exception: pass
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Tipsy"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    for _ in range(3):
        await pg.evaluate(START); await pg.wait_for_timeout(500)
        for _ in range(6):
            if await pg.evaluate("!!document.querySelector('#tbf')"): break
            await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()"); await pg.wait_for_timeout(400)
        if await pg.evaluate("!!document.querySelector('#tbf')"): break
    for _ in range(80):
        await pg.evaluate(CLEAN)
        if await pg.evaluate(MYTURN): break
        if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
            try: await pg.click("#tbf [data-tbx=skip]", timeout=3000)
            except Exception: pass
        await pg.wait_for_timeout(250)
    ok(await pg.evaluate(MYTURN), f"{tag}: the fight starts on your turn")
    await pg.evaluate("()=>{ TB.session.f.mp = 400; TB.redraw && TB.redraw(); }")
    await pg.evaluate("()=>document.querySelector('#tbf [data-tbm=magic]').click()"); await pg.wait_for_timeout(700)
    ok(await pg.evaluate("!!document.querySelector('#tbf .fc-pick .tbsp')"), f"{tag}: the Magic picker is open")

async def rows(pg):
    """the picker's cards grouped into rows (by their top): [[index, ...], ...]"""
    return await pg.evaluate("""() => { const cs=[...document.querySelectorAll('#tbf .fc-pick .tbsp')]; const by={};
      cs.forEach((c,i)=>{ const k=Math.round(c.offsetTop); (by[k]=by[k]||[]).push(i); }); return Object.keys(by).map(Number).sort((a,b)=>a-b).map(k=>by[k]); }""")

def check(tag, name, i):
    ok(i is not None, f"{tag} {name}: a tooltip shows")
    if not i: return
    ok(i["l"] >= 0 and i["t"] >= 0 and i["r"] <= i["vw"] + 0.5 and i["b"] <= i["vh"] + 0.5, f"{tag} {name}: fully on screen ({i['l']:.0f},{i['t']:.0f})-({i['r']:.0f},{i['b']:.0f}) of {i['vw']}x{i['vh']}")
    ok(i["topmost"], f"{tag} {name}: nothing is drawn over it")
    ok(i["t"] >= i["barB"] - 0.5, f"{tag} {name}: not under the top bar (top {i['t']:.0f}, bar ends {i['barB']:.0f})")
    ok(not i["over"], f"{tag} {name}: doesn't cover the card it's for")
    ok(not i["clipped"], f"{tag} {name}: nothing cut off (a long one scrolls)")

async def pc(b, w, h, errs):
    tag = f"{w}x{h}"
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    await into_fight(pg, tag)
    R = await rows(pg)
    ok(len(R) >= 3, f"{tag}: the picker has 3+ rows of cards ({len(R)})")
    picks = [("top", R[0][0]), ("mid", R[len(R) // 2][-1]), ("bottom", R[-1][len(R[-1]) // 2])] if R else []
    for name, idx in picks:
        sel = f"#tbf .fc-pick .tbsp:nth-of-type({idx + 1})"
        await pg.evaluate(f"document.querySelectorAll('#tbf .fc-pick .tbsp')[{idx}].scrollIntoView({{block:'nearest'}})"); await pg.wait_for_timeout(200)
        sel = f"__ftt{idx}"
        await pg.evaluate(f"document.querySelectorAll('#tbf .fc-pick .tbsp')[{idx}].id='{sel}'")
        for part, q in (("name", ".fc-nm"), ("cast", ".fc-cast")):
            el = await pg.query_selector(f"#{sel} {q}")
            if not el: continue
            bb = await el.bounding_box()
            await pg.mouse.move(3, 3); await pg.wait_for_timeout(150)
            await pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
            i = None
            for _ in range(15):
                await pg.wait_for_timeout(100); i = await pg.evaluate(INFO, f"#{sel}")
                if i: break
            check(tag, f"{name} row {part}", i)
            await pg.screenshot(path=f"{OUT}{tag}_{name}_{part}.png")
    # the hotbar's own line above the skill bar still works once the picker is closed
    await pg.mouse.move(3, 3); await pg.evaluate("document.querySelector('#tbf [data-tbm=\"\"]')?.click()"); await pg.wait_for_timeout(400)
    el = await pg.query_selector("#tbf .tbdock [data-tba=attack]")
    if el:
        bb = await el.bounding_box(); await pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        i = None
        for _ in range(15):
            await pg.wait_for_timeout(100); i = await pg.evaluate(INFO, "#none")
            if i: break
        ok(i is not None and "tt-dock" in i["cls"] and i["topmost"] and i["t"] >= i["barB"] - 0.5, f"{tag}: a skill bar move still shows its line above the bar, on top")
        await pg.screenshot(path=f"{OUT}{tag}_bar_attack.png")
    await ctx.close()

async def phone(b, errs):
    tag = "390x844"
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    await into_fight(pg, tag)
    cdp = await ctx.new_cdp_session(pg)
    R = await rows(pg)
    for name, idx in (("top", R[0][0]), ("bottom", R[-1][0])) if R else []:
        await pg.evaluate(f"document.querySelectorAll('#tbf .fc-pick .tbsp')[{idx}].scrollIntoView({{block:'nearest'}})"); await pg.wait_for_timeout(250)
        await pg.evaluate(f"document.querySelectorAll('#tbf .fc-pick .tbsp')[{idx}].id='__ftp{idx}'")
        el = await pg.query_selector(f"#__ftp{idx} .fc-nm"); bb = await el.bounding_box()
        x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        before = await pg.evaluate("[TB.session.f.mp, TB.session.ev.length]")
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1, "radiusX": 4, "radiusY": 4, "force": 1}]})
        i = None
        for _ in range(15):
            await pg.wait_for_timeout(100); i = await pg.evaluate(INFO, f"#__ftp{idx}")
            if i: break
        check(tag, f"hold {name} card", i)
        await pg.screenshot(path=f"{OUT}{tag}_hold_{name}.png")
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(700)
        after = await pg.evaluate("[TB.session.f.mp, TB.session.ev.length]")
        ok(before == after, f"{tag} hold {name}: nothing was cast ({before} -> {after})")
    await ctx.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        for (w, h) in ((1083, 571), (1440, 900), (1920, 1080)): await pc(b, w, h, errs)
        await phone(b, errs)
        ok(not errs, "no page errors " + "; ".join(errs[:3]))
        await b.close()
    print(f"screenshots: {OUT}")
    print("FAILED: " + str(len(fails)) if fails else "fight tooltips on top ok")
    sys.exit(1 if fails else 0)
asyncio.run(main())
