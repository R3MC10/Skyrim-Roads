"""Move preview (movepreview.js): on a PC, hovering Attack draws a striped "could lose" piece on the foe's health bar and
fades a move diamond; hovering End turn shows the guard. On a 390px phone, holding a finger on Fireball shows the
striped piece and the dimmed magicka, nothing is cast (magicka unchanged), and letting go clears it.
Screenshots go to SHOTS (default: the system temp folder), never into tests/.
Usage: python3 movepreview_ui.py PORT"""
import asyncio, sys, os, time, tempfile
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from playwright.async_api import async_playwright
from roadfight import open_fight, wait_my_turn
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
RUN = str(int(time.time()) % 100000)
OUT = os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "out_movepreview")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration']) S.skills[k].lvl=60;
  for (const id of ['fireball','flames','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
STATE = """() => { const el = document.getElementById('tbf'); if (!el) return null;
  const seg = el.querySelector('.tbu.foe .tbbar.hp .mpv.lose'), lbl = el.querySelector('.tbu.foe .tbbar.hp .mpv-n');
  return { seg: !!seg, label: lbl ? lbl.textContent : '', cost: el.querySelectorAll('.mpv.cost, .mpv-arc').length,
    use: el.querySelectorAll('.tbap i.ap.mpv-use').length, guard: (el.querySelector('.mpv-guard') || {}).textContent || '',
    mp: TB.session ? Math.round(TB.session.f.mp) : -1, ev: TB.session ? TB.session.ev.length : -1 }; }"""

async def new_fight(b, vp, touch, tag, errs):
    ctx = await b.new_context(viewport=vp, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=mp{RUN}{tag}&tb"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Peek"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
    await open_fight(pg, START)   # waits for the fight screen, not a fixed pause (roadfight.py)
    await wait_my_turn(pg)
    await pg.evaluate("()=>{ TB.session.f.mp = G.maxMagicka(TB.session.f.s); TB.redraw && TB.redraw(TB.session, {turn:'me'}); }"); await pg.wait_for_timeout(400)
    return ctx, pg

async def center(pg, sel):
    el = await pg.query_selector(sel)
    if not el: return None
    await el.scroll_into_view_if_needed(); bb = await el.bounding_box()
    return (bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2) if bb else None

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        # ---- PC: hover Attack, then End turn
        ctx, pg = await new_fight(b, {"width": 1366, "height": 768}, False, "pc", errs)
        ok(await pg.evaluate("TB.open"), "pc: the fight opens")
        await pg.screenshot(path=os.path.join(OUT, "pc_before.png"))
        c = await center(pg, "#tbf [data-tba=attack]")
        ok(c is not None, "pc: Attack is there")
        if c:
            await pg.mouse.move(5, 5); await pg.mouse.move(*c); await pg.wait_for_timeout(250)
            st = await pg.evaluate(STATE)
            info = await pg.evaluate("(() => { const p = MOVEPREVIEW.info('attack'); return [p.lo, p.hi]; })()")
            ok(st and st["seg"], "pc: hovering Attack draws the striped piece on the foe's bar")
            ok(st and str(info[1]) in st["label"], f"pc: its label says the range {info} ({st and st['label']!r})")
            ok(st and st["use"] >= 1, "pc: a move diamond fades")
            ok(st and st["cost"] >= 1, "pc: the stamina it costs is dimmed")
            await pg.screenshot(path=os.path.join(OUT, "pc_hover_attack.png"))
            await pg.mouse.move(5, 5); await pg.wait_for_timeout(150)
            st = await pg.evaluate(STATE)
            ok(st and not st["seg"] and st["use"] == 0, "pc: moving away clears it")
        c = await center(pg, "#tbf [data-tba=end]")
        if c:
            await pg.mouse.move(*c); await pg.wait_for_timeout(250)
            st = await pg.evaluate(STATE)
            ok(st and "Guard +" in st["guard"], f"pc: hovering End turn shows the guard ({st and st['guard']!r})")
            await pg.mouse.move(5, 5)
        await ctx.close()
        # ---- phone 390px: hold Fireball
        ctx, pg = await new_fight(b, {"width": 390, "height": 844}, True, "ph", errs)
        cdp = await ctx.new_cdp_session(pg)
        sel = "#tbf [data-tba='spell:fireball']"
        if not await pg.query_selector(sel):
            await pg.evaluate("()=>document.querySelector('#tbf [data-tbm=magic]')?.click()"); await pg.wait_for_timeout(500)
        c = await center(pg, sel)
        ok(c is not None, "phone: the Fireball button is there")
        if c:
            before = await pg.evaluate(STATE)
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": c[0], "y": c[1], "id": 1, "radiusX": 4, "radiusY": 4, "force": 1}]})
            await pg.wait_for_timeout(650)
            st = await pg.evaluate(STATE)
            await pg.screenshot(path=os.path.join(OUT, "phone_hold_fireball.png"))
            ok(st and st["seg"], "phone: holding Fireball draws the striped piece on the foe's bar")
            ok(st and st["cost"] >= 1, "phone: the magicka it costs is dimmed")
            ok(st and st["mp"] == before["mp"], f"phone: magicka unchanged while holding ({before['mp']} -> {st and st['mp']})")
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            await pg.wait_for_timeout(600)
            after = await pg.evaluate(STATE)
            ok(after and not after["seg"], "phone: letting go clears it")
            ok(after and after["mp"] == before["mp"] and after["ev"] == before["ev"], f"phone: nothing was cast ({before['mp']},{before['ev']} -> {after['mp']},{after['ev']})")
        await ctx.close()
        ok(not errs, "no page errors " + "; ".join(errs[:3]))
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "movepreview ui ok")
    sys.exit(1 if fails else 0)
asyncio.run(main())
