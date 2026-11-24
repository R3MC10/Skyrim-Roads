"""Party traps on three phones (BroadcastChannel test net): in a party dungeon run the leader taps "Look for the trigger"
and EVERY hero gets the trap game. Alfa (leader) finds the plate, Beta runs out of time, Ceta closes the app (counts as
caught after the time limit). Everyone sees the results card; Beta takes the hit. Then the leader picks a chest lock
and Beta watches it live with Alfa's named cursor on screen. Both art styles.
Screenshots go to tests/out_partytraps/. Usage: py partytraps_ui.py PORT   (serve: py -m http.server PORT --directory game)"""
import asyncio, sys, os, time
RUN = str(int(time.time()) % 100000)
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8874"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_partytraps") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

ROWS = "[[{type:'trap',links:[0]}],[{type:'treasure',links:[0]}],[{type:'rest',links:[0]}],[{type:'boss',links:[]}]]"

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        errs = []
        for style in ["ink", "pixel"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{style} {tag} {e}"))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&dgame&p=pt{RUN}{style}{tag}"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
                await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
                await pg.evaluate("(st) => { if (typeof ART !== 'undefined' && ART.setStyle) ART.setStyle(st); }", style)
                return pg
            A = await phone("a", "Alfa"); B = await phone("b", "Beta"); C = await phone("c", "Ceta")
            here = "() => { const S = window.__dbg.save(), n = 'Embershard Mine'; S.location = n; [S.x, S.y] = WORLD.places[n].slice(0, 2); S.trip = null; S.cleared = {}; S.level = 12; S.hpBonus = 3000; G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); PTRAPS.cfg.grace = 2; }"
            for pg in (A, B, C): await pg.evaluate(here)
            ida, idb, idc = [await pg.evaluate("window.__dbg.save().id") for pg in (A, B, C)]
            mem = f"[{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}, {{ id: '{idc}', name: 'Ceta' }}]"
            await A.evaluate(f"() => Store.put('parties', 'pt{style}', {{ leader: '{ida}', leaderName: 'Alfa', members: {mem}, invites: [], t: G.now() }})")
            # the co-op run: Alfa leads, all three are in
            rid = await A.evaluate(f"""() => {{ const S = window.__dbg.save(), r = COOP.newRun(S); const doc = {{ ...r.doc, rows: {ROWS}, status: 'in',
                members: {mem}.map(m => ({{ ...m, level: 12 }})) }}; Store.put('runs', r.id, doc); return r.id; }}""")
            seen = False
            for _ in range(20):
                await A.wait_for_timeout(500)
                seen = all([await pg.evaluate(f"() => window.__dbg.coopRuns().some(r => r.id === '{rid}') && window.__dbg.party()?.leader === '{ida}'") for pg in (A, B, C)])
                if seen: break
            ok(seen, f"[{style}] three phones in one party run")
            for pg in (A, B, C):
                err = await pg.evaluate(f"() => {{ const S = window.__dbg.save(), run = window.__dbg.coopRuns().find(r => r.id === '{rid}'); return COOP.join(S, run); }}")
                if err: print("join:", err)
            # Alfa steps into the trap room
            await A.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'droom'; b.dataset.c = '0'; (document.querySelector('#dun') || document.querySelector('#side')).appendChild(b); b.click(); b.remove(); }")
            await A.wait_for_timeout(600)
            await A.evaluate("() => document.querySelectorAll('#modal').forEach(m => m.remove())")
            rt = await A.evaluate("() => window.__dbg.save().dungeon?.room?.type")
            ok(rt == "trap", f"[{style}] leader is in the trap room ({rt})")
            trap = await A.evaluate("() => window.__dbg.save().dungeon?.room?.trap")
            hb0 = await B.evaluate("() => G.curHealth(window.__dbg.save())")
            await A.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'dact'; b.dataset.c = 'trigger'; (document.querySelector('#dun') || document.querySelector('#side')).appendChild(b); b.click(); b.remove(); }")
            # everyone gets the game
            opened = {}
            for _ in range(16):
                await A.wait_for_timeout(300)
                opened = {t: await pg.evaluate("() => !!document.querySelector('#dgame canvas') && !!document.querySelector('#dgame .dgparty')") for t, pg in (("a", A), ("b", B), ("c", C))}
                if all(opened.values()): break
            ok(all(opened.values()), f"[{style}] all three play the trap {opened}")
            seeds = [await pg.evaluate("() => DGAMES.live?.st.seed ?? null") for pg in (A, B, C)]
            ok(seeds[0] is not None and seeds[0] == seeds[1] == seeds[2], f"[{style}] same trap (seed) for everyone {seeds}")
            await B.screenshot(path=f"{OUT}{style}_member_plays_trap.png")
            # Ceta puts the phone away for good
            await C.close()
            # Alfa finds the plate; Beta runs out of time
            await A.evaluate("() => { const st = DGAMES.live.st, cv = document.querySelector('#dgc'), r = cv.getBoundingClientRect(); const i = st.plate, x = 20 + (i % 5) * 54 + 26, y = 22 + Math.floor(i / 5) * 42 + 20; cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + x * r.width / 300, clientY: r.top + y * r.height / 200, bubbles: true, pointerId: 1 })); }")
            await B.evaluate("() => { const st = DGAMES.live?.st; if (st) st.tick = DGAMES.LIMIT[st.kind] * DGAMES.HZ - 2; }")
            await A.wait_for_timeout(1500)
            wt = await A.query_selector("#ptwait")
            ok(wt is not None, f"[{style}] Alfa waits for the rest (Ceta still out)")
            if wt: await A.screenshot(path=f"{OUT}{style}_leader_waiting.png")
            # the time limit runs out → results everywhere
            got = {}
            for _ in range(40):
                await A.wait_for_timeout(500)
                got = {t: await pg.evaluate("() => document.querySelector('#ptres')?.innerText || ''") for t, pg in (("a", A), ("b", B))}
                if got["a"] and got["b"]: break
            ok(got.get("a") and got.get("b"), f"[{style}] results card on both phones")
            ra = got.get("a", "")
            ok("Got through" in ra and "Caught" in ra and "ran out of time" in ra, f"[{style}] card: {ra[:160]!r}")
            await A.screenshot(path=f"{OUT}{style}_trap_results_leader.png")
            await B.screenshot(path=f"{OUT}{style}_trap_results_member.png")
            ok("It caught you" in got.get("b", ""), f"[{style}] Beta is told it caught them")
            # each one's own outcome: Alfa untouched, Beta hurt
            hb1 = None; ta = tb = ""
            for _ in range(16):
                await B.wait_for_timeout(400)
                hb1 = await B.evaluate("() => G.curHealth(window.__dbg.save())")
                tb = await B.evaluate("() => document.querySelector('#dun .res p')?.textContent || ''")
                if hb1 < hb0 - 0.5: break
            ta = await A.evaluate("() => document.querySelector('#dun .res p')?.textContent || ''")
            ok(hb1 is not None and hb1 < hb0, f"[{style}] Beta took the hit ({round(hb0)} → {round(hb1 or 0)}): {tb[:110]}")
            kk = await A.evaluate(f"() => PTRAPS.kindOf({trap!r}).k")
            words = {"poison": "poisoned", "bleed": "bleeding", "burn": "burns", "gold": "Coins", "dent": "dent"}
            ok(words.get(kk, "?") in tb or (kk == "dent" and "gear" in tb) or (kk == "gold" and "gold" not in tb), f"[{style}] Beta's sting matches the trap on the card ({kk})")
            ok("spot the trigger" in ta, f"[{style}] Alfa got through: {ta[:80]}")
            for pg in (A, B): await pg.evaluate("() => document.querySelector('#ptok')?.click()")

            # the chest: only the leader picks, Beta watches with Alfa's cursor on screen
            await A.evaluate("() => { const S = window.__dbg.save(); S.dungeon.room = { type: 'treasure', tier: 1, tries: 3, text: 'A chest.' }; }")
            await A.evaluate("() => { IMM.wantsGame = () => true; }")
            await A.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'dact'; b.dataset.c = 'pick'; document.querySelector('#side').appendChild(b); b.click(); b.remove(); }")
            await A.wait_for_timeout(500)
            lp = await A.query_selector("#lpc") or await A.query_selector(".lockpick canvas")
            ok(lp is not None, f"[{style}] Alfa's lock opens")
            lk = None
            for _ in range(12):
                await B.wait_for_timeout(300)
                lk = await B.evaluate("() => DGAMES.watching?.doc.kind || null")
                if lk: break
            ok(lk == "lock", f"[{style}] Beta watches the lockpicking ({lk})")
            pos = []
            if lp:
                bb = await lp.bounding_box()
                for j in range(30):
                    await A.mouse.move(bb["x"] + bb["width"] * (0.2 + 0.02 * j), bb["y"] + bb["height"] * (0.3 + 0.01 * j))
                    await A.wait_for_timeout(60)
                    if j % 10 == 9: pos.append(await B.evaluate("() => { const n = document.querySelector('.lcur'); return n ? [n.style.transform, n.querySelector('.lcname')?.textContent || '', getComputedStyle(n).display] : null; }"))
            ok(all(x and x[1] == "Alfa" and x[2] != "none" for x in pos), f"[{style}] Beta sees Alfa's named cursor {pos[-1] if pos else None}")
            ok(len(set(x[0] for x in pos if x)) >= 2, f"[{style}] the cursor moves with Alfa's mouse")
            await B.screenshot(path=f"{OUT}{style}_watch_lock_cursor.png")
            ok(not await A.query_selector(".lcur"), f"[{style}] the player doesn't see their own cursor arrow")
            await A.evaluate("() => document.querySelector('#lpleave')?.click()")
            await ctx.close()
        ok(not errs, "no page errors " + " | ".join(errs[:4]))
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "partytraps_ui ok")
    sys.exit(1 if fails else 0)
asyncio.run(main())
