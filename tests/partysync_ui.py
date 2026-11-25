"""Shared party fights (sharedfight.js) on two phones: Alfa leads, Beta is in her party. Alfa starts a road fight;
Beta's phone opens the same fight on the full fight screen (not the small "Fighting beside" box). On Beta's turn she casts
a real spell with her own magicka from her own Magic menu; both screens then show the same foe health and Beta's line
in the log; the leader's moves show on Beta's screen under his name. The fight ends the same for both.
Usage: python partysync_ui.py PORT  (serve game/ first: node serve.js PORT)
Screenshots in tests/out_partysync/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_partysync") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))   # falls back to Playwright's own Chromium when missing
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

HERE = """(o) => { const S = window.__dbg.save(); S.level = 20; S.hpBonus = 120; S.mpBonus = 80;
  for (const k of ['One-Handed','Destruction','Restoration','Athletics','Acrobatics']) S.skills[k].lvl = 45;
  for (const id of ['flames','sparks','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  G.give(S, 'potion_health', 2); S.dungeon = null; S.trip = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun.slice(0, 2);
  G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); }"""
FIGHT = """() => { document.querySelectorAll('#modal').forEach(m => m.remove()); const S = window.__dbg.save();
  S.location = null; G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2));
  const d = ENC.byId.banditToll; S.trip.status = 'event'; S.trip.event = { id: d.id, title: d.title, enc: true, ...d.make(S, ENC.ctx(S)) }; window.__dbg.openEvent(); }"""
STATE = """() => { const s = TB.session || (typeof SHAREDFIGHT !== 'undefined' ? SHAREDFIGHT.active : null); if (!s) return null;
  const f = s.f; return { ehp: Math.round(f.ehp), max: s.ehpMax, round: s.round, done: !!s.done, won: !!f.won, mirror: !!s.mirror,
    foeNum: document.querySelector('#tbf .tbu.foe .num')?.textContent || '', log: s.ev.filter(e => e.kind !== 'round').map(e => e.text) }; }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({artStyle:'ink', tbFast:true}))")
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&p=psync{tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
            return pg
        A = await phone("a", "Alfa"); B = await phone("b", "Beta")
        for pg in (A, B): await pg.evaluate(HERE, {})
        ida, idb = [await pg.evaluate("window.__dbg.save().id") for pg in (A, B)]
        await A.evaluate(f"() => Store.put('parties', 'psync', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}], invites: [], t: G.now() }})")
        seen = False
        for i in range(40):
            await (A if i % 2 else B).bring_to_front(); await A.wait_for_timeout(600)
            for pg in (A, B): await pg.evaluate("() => window.__dbg.publish()")
            seen = await A.evaluate("() => !!window.__dbg.party() && window.__dbg.others().some(o => o.name === 'Beta')") and await B.evaluate("() => !!window.__dbg.party() && window.__dbg.others().some(o => o.name === 'Alfa')")
            if seen: break
        ok(seen, "two phones in one party")
        ok(await B.evaluate("typeof SHAREDFIGHT !== 'undefined'"), "sharedfight.js loaded")

        # Alfa starts a road fight with Beta beside him
        await A.bring_to_front()
        await A.evaluate(FIGHT); await A.wait_for_timeout(500)
        await A.click("#modal [data-act=ev][data-c=fight]"); await A.wait_for_timeout(900)
        ok(await A.evaluate("TB.open && TB.session.f.allies.some(a => a.pid && a.name === 'Beta')"), "Alfa's fight has Beta in it as a real player")
        opened = False
        for _ in range(20):
            await B.wait_for_timeout(500)
            opened = await B.evaluate("!!document.querySelector('#tbf') && TB.open && !!SHAREDFIGHT.active")
            if opened: break
        ok(opened, "Beta's phone opens the same fight on the full fight screen")
        ok(not await B.evaluate("!!document.querySelector('#tbwatch')"), "no small 'Fighting beside' box for Beta")
        a0, b0 = await A.evaluate(STATE), await B.evaluate(STATE)
        ok(b0 and a0 and b0["max"] == a0["max"], f"same foe on both screens (max {a0 and a0['max']} / {b0 and b0['max']})")

        cast = False; compared = False; shot = False; g = 0
        while g < 160:
            g += 1
            sa = await A.evaluate(STATE); sb = await B.evaluate(STATE)
            if (sa is None or sa["done"]) and (sb is None or sb["done"]): break
            if await A.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])')"):   # Alfa's turn
                if cast and not compared:   # Beta's turn went back to Alfa's phone: both screens agree
                    await A.wait_for_timeout(1500); await B.wait_for_timeout(300)
                    sa = await A.evaluate(STATE); sb = await B.evaluate(STATE)
                    ok(sa["ehp"] == sb["ehp"], f"after Beta's spell both phones show the same foe health ({sa['ehp']} / {sb['ehp']})")
                    ok(sa["foeNum"] == sb["foeNum"], f"and the same numbers on the foe's bar ({sa['foeNum']} / {sb['foeNum']})")
                    ok(any(t.startswith("Beta ") or "Beta" in t for t in sa["log"][-8:]), "Beta's spell is in the leader's log under her name")
                    await B.screenshot(path=OUT + "member_after_sync.png"); await A.screenshot(path=OUT + "leader_after_sync.png")
                    compared = True
                await A.bring_to_front()
                await A.click("#tbf [data-tba=attack]"); await A.wait_for_timeout(250)
                if await A.evaluate("!!document.querySelector('#tbf [data-tba=end]')"): await A.click("#tbf [data-tba=end]")
                await A.wait_for_timeout(300); continue
            if await B.evaluate("!!document.querySelector('#tbf [data-tba=end]') && SHAREDFIGHT.active && SHAREDFIGHT.active.myTurn"):   # Beta's turn, on her phone
                await B.bring_to_front()
                if not cast:
                    mp0 = await B.evaluate("Math.round(SHAREDFIGHT.active.f.mp)"); e0 = await B.evaluate("SHAREDFIGHT.active.f.ehp")
                    await B.click("#tbf [data-tbm=magic]"); await B.wait_for_timeout(300)
                    ok(await B.evaluate("document.querySelectorAll('#tbf .tbsp').length") >= 1, "Beta's own spells are in her Magic menu")
                    btn = await B.query_selector("#tbf .tbsp [data-tba^='spell:']:not([disabled])")
                    ok(btn is not None, "she can cast one")
                    if btn: await btn.click()
                    await B.wait_for_timeout(1200)
                    mp1 = await B.evaluate("SHAREDFIGHT.active ? Math.round(SHAREDFIGHT.active.f.mp) : -1"); e1 = await B.evaluate("SHAREDFIGHT.active ? SHAREDFIGHT.active.f.ehp : -1")
                    ok(mp1 < mp0, f"the spell used Beta's own magicka ({mp0} → {mp1})")
                    ok(e1 < e0, f"and hurt the foe on her screen ({round(e0)} → {round(e1)})")
                    if not shot:
                        await B.screenshot(path=OUT + "member_turn.png"); shot = True
                        ok(await B.evaluate("[...document.querySelectorAll('#tbf .tbu.ally .nm')].some(n => /Alfa/.test(n.textContent))"), "the leader shows among Beta's teammates")
                    cast = True
                else:
                    await B.click("#tbf [data-tba=attack]"); await B.wait_for_timeout(300)
                if await B.evaluate("!!document.querySelector('#tbf [data-tba=end]') && SHAREDFIGHT.active && SHAREDFIGHT.active.myTurn"): await B.click("#tbf [data-tba=end]")
                await B.wait_for_timeout(400); continue
            await A.wait_for_timeout(400)
        ok(cast, "Beta got a real turn and cast a spell")
        ok(compared, "the screens were compared after her turn")
        # the end
        for _ in range(30):
            if await B.evaluate("!!document.querySelector('#tbf .tbdone')") and await A.evaluate("!!document.querySelector('#tbf .tbdone')"): break
            await B.wait_for_timeout(500)
        ea, eb = await A.evaluate(STATE), await B.evaluate(STATE)
        ok(ea and eb and ea["done"] and eb["done"] and ea["won"] == eb["won"], f"the fight ends the same on both phones (won {ea and ea['won']} / {eb and eb['won']})")
        ok(any("Alfa" in t for t in (eb["log"] if eb else [])), "Beta's log shows the leader's moves under his name")
        await B.screenshot(path=OUT + "member_end.png")
        hp0 = await B.evaluate("G.curHealth ? G.curHealth(window.__dbg.save()) : 0")
        await B.click("#tbf .tbdone"); await B.wait_for_timeout(600)
        ok(not await B.evaluate("!!document.querySelector('#tbf')") and await B.evaluate("!SHAREDFIGHT.active"), "Continue closes Beta's fight screen")
        hp1 = await B.evaluate("G.curHealth ? G.curHealth(window.__dbg.save()) : 1")
        ok(hp1 > 0, f"Beta's result is applied on her phone (health {hp1})")
        await A.click("#tbf .tbdone"); await A.wait_for_timeout(600)
        ok(not errs, "no page errors " + "; ".join(errs[:3]))
        await b.close()
    print("member screenshot:", OUT + "member_turn.png")
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
    sys.exit(1 if fails else 0)

asyncio.run(main())
