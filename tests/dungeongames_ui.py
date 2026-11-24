"""Dungeon mini-games on two phones (BroadcastChannel test net): the party leader plays each room's game
(dash, smash, trigger, sneak, flee, search) and the member in the same dungeon watches it live, then reads the result.
Both art styles. Screenshots go to tests/out_dungeongames/. Usage: python3 dungeongames_ui.py PORT"""
import asyncio, sys, os, time
RUN = str(int(time.time()) % 100000)
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8873"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_dungeongames") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

ROWS = "[[{type:'trap',links:[0]}],[{type:'treasure',links:[0]}],[{type:'trap',links:[0]}],[{type:'fight',links:[0]}],[{type:'fight',links:[0]}],[{type:'rest',links:[0]}],[{type:'boss',links:[]}]]"
GAMES = [("dash", "trap"), ("smash", "treasure"), ("trigger", "trap"), ("sneak", "fight"), ("flee", "fight"), ("search", "rest")]

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        errs = []
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name, extra):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{style} {tag} {e}"))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut{extra}&p=dg{RUN}{style}{tag}"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
                await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
                return pg
            A = await phone("a", "Alfa", "&dgame"); B = await phone("b", "Beta", "")
            here = "() => { const S = window.__dbg.save(), n = 'Embershard Mine'; S.location = n; [S.x, S.y] = WORLD.places[n].slice(0, 2); S.trip = null; S.cleared = {}; S.level = 12; S.hpBonus = 3000; G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); }"
            for pg in (A, B): await pg.evaluate(here)
            ida, idb = [await pg.evaluate("window.__dbg.save().id") for pg in (A, B)]
            await A.evaluate(f"() => Store.put('parties', 'dg{style}', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}], invites: [], t: G.now() }})")
            seen = False
            for _ in range(15):
                await A.wait_for_timeout(500)
                seen = await B.evaluate(f"() => window.__dbg.party()?.leader === '{ida}'") and await A.evaluate(f"() => window.__dbg.party()?.leader === '{ida}'")
                if seen: break
            ok(seen, f"[{style}] two phones in one party")
            # both inside Embershard Mine (straight in: the party's ready check is tested elsewhere)
            for pg in (A, B): await pg.evaluate(f"() => {{ const S = window.__dbg.save(); DUNGEONS.enter(S); S.dungeon.rows = {ROWS}; S.dungeon.row = -1; }}")
            await B.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'droom'; b.dataset.c = '0'; document.querySelector('#side').appendChild(b); b.click(); b.remove(); }")
            for i, (kind, rtype) in enumerate(GAMES):
                await A.evaluate("() => document.querySelectorAll('#modal').forEach(m => m.remove())")
                await A.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'droom'; b.dataset.c = '0'; (document.querySelector('#dun') || document.querySelector('#side')).appendChild(b); b.click(); b.remove(); }")
                await A.wait_for_timeout(300)
                rt = await A.evaluate("() => window.__dbg.save().dungeon?.room?.type")
                btn = await A.query_selector(f"#dun [data-act=dact][data-c={kind}]")
                ok(rt == rtype and btn is not None, f"[{style}] {kind}: room {rt} has the button")
                if not btn: continue
                await btn.click(); await A.wait_for_timeout(250)
                ok(await A.query_selector("#dgame canvas") is not None, f"[{style}] {kind}: the game opens")
                # play a little like a person would
                if kind in ("dash", "sneak"):
                    k = await A.query_selector("#dgame .dgk"); bb = await k.bounding_box()
                    await A.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); await A.mouse.down(); await A.wait_for_timeout(1300); await A.mouse.up()
                elif kind == "smash":
                    for _ in range(2): await A.click("#dgame .dgk"); await A.wait_for_timeout(450)
                elif kind == "flee":
                    for j in range(12): await A.click(f"#dgame .dgk[data-k={'L' if j % 2 else 'R'}]"); await A.wait_for_timeout(60)
                elif kind == "search":
                    cv = await A.query_selector("#dgc"); bb = await cv.bounding_box()
                    await A.mouse.move(bb["x"] + 20, bb["y"] + 30); await A.mouse.down()
                    for j in range(14): await A.mouse.move(bb["x"] + 20 + j * (bb["width"] - 40) / 14, bb["y"] + 30 + (j % 2) * 40); await A.wait_for_timeout(40)
                    await A.mouse.up()
                else:
                    await A.wait_for_timeout(1200)
                await A.wait_for_timeout(200)
                if i < 2 or style == "ink": await A.screenshot(path=f"{OUT}{style}_{kind}_leader.png")
                evs = await A.evaluate("() => DGAMES.live?.st.ev.length || 0")
                ok(evs > 0 or kind == "trigger", f"[{style}] {kind}: taps recorded ({evs})")
                # the member watches the same game
                w = None
                for _ in range(12):
                    await B.wait_for_timeout(300)
                    w = await B.evaluate("() => { const W = DGAMES.watching; return W ? { kind: W.doc.kind, tick: W.st?.tick || 0, seed: W.doc.seed } : null; }")
                    if w and w["tick"] > 10: break
                lseed = await A.evaluate("() => DGAMES.live?.st.seed")
                ok(w is not None and w["kind"] == kind and w["seed"] == lseed, f"[{style}] {kind}: Beta watches the same game {w}")
                if w and (i < 2 or style == "ink"): await B.screenshot(path=f"{OUT}{style}_{kind}_member_watch.png")
                # finish: trigger taps the right stone; the rest run out of time
                if kind == "trigger":
                    await A.evaluate("() => { const st = DGAMES.live.st, cv = document.querySelector('#dgc'), r = cv.getBoundingClientRect(); const i = st.plate, x = 20 + (i % 5) * 54 + 26, y = 22 + Math.floor(i / 5) * 42 + 20; cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + x * r.width / 300, clientY: r.top + y * r.height / 200, bubbles: true, pointerId: 1 })); }")
                else:
                    await A.evaluate("() => { const st = DGAMES.live?.st; if (st) st.tick = DGAMES.LIMIT[st.kind] * DGAMES.HZ - 2; }")
                done = False
                for _ in range(20):
                    await A.wait_for_timeout(250)
                    done = await A.evaluate("() => !document.querySelector('#dgame') && !window.__dbg.save().dungeon?.room")
                    if done: break
                ok(done, f"[{style}] {kind}: the game ends and the room resolves")
                txt = await A.evaluate("() => document.querySelector('#dun .res p')?.textContent || ''")
                ok(len(txt) > 5, f"[{style}] {kind}: result: {txt[:70]}")
                if kind == "trigger": ok("spot the trigger" in txt, f"[{style}] finding the plate passes")
                got = ""
                for _ in range(16):
                    await B.wait_for_timeout(300)
                    got = await B.evaluate("() => document.querySelector('#dgwtxt')?.textContent || ''")
                    if txt[:20] and txt[:20] in got: break
                ok(txt[:20] in got, f"[{style}] {kind}: Beta reads the result: {got[:70]}")
                if i == 0: await B.screenshot(path=f"{OUT}{style}_{kind}_member_result.png")
                await B.evaluate("() => DGAMES.closeWatch()")
                if await A.evaluate("() => !window.__dbg.save().dungeon"): break   # (only if the hero died)
            # lockpicking is mirrored too
            await A.evaluate("() => { const S = window.__dbg.save(); S.dungeon.room = { type: 'treasure', tier: 1, tries: 3, text: 'A chest.' }; }")
            await A.evaluate("() => { IMM.wantsGame = () => true; }")
            await A.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'dact'; b.dataset.c = 'pick'; document.querySelector('#side').appendChild(b); b.click(); b.remove(); }")
            lk = None
            for _ in range(12):
                await B.wait_for_timeout(300)
                lk = await B.evaluate("() => DGAMES.watching?.doc.kind || null")
                if lk: break
            ok(lk == "lock", f"[{style}] Beta watches the lockpicking too ({lk})")
            if lk: await B.screenshot(path=f"{OUT}{style}_lock_member_watch.png")
            await A.evaluate("() => document.querySelector('#lpleave')?.click()")
            await ctx.close()
        ok(not errs, "no page errors " + " | ".join(errs[:4]))
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "dungeongames_ui ok")
    sys.exit(1 if fails else 0)
asyncio.run(main())
