"""Foes take their turns in party fights (sharedfight.js + tbfight.js), on three phones: Alfa leads, Beta and Ceta are in
his party. Alfa starts a road fight; everyone plays their own turns. Every round, every one of the foe's moves in the turn
order is played on the leader's phone, and the same foe moves (same round, same text) show on Beta's and Ceta's screens,
with the foe's chip lit in their turn strip while its move plays. The fight ends the same for all three.
Usage: python partyfoeturns_ui.py PORT  (serve game/ first: node serve.js PORT game)
Screenshots go to $SHOTS (or tests/out_partyfoeturns/)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("SHOTS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_partyfoeturns")
OUT = OUT.rstrip("/\\") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

HERE = """(o) => { const S = window.__dbg.save(); S.level = 20; S.hpBonus = 160; S.mpBonus = 80;
  for (const k of ['One-Handed','Destruction','Restoration','Athletics','Acrobatics']) S.skills[k].lvl = 45;
  S.dungeon = null; S.trip = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun.slice(0, 2);
  G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); }"""
FIGHT = """() => { document.querySelectorAll('#modal').forEach(m => m.remove()); const S = window.__dbg.save();
  S.location = null; G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2));
  const d = ENC.byId.banditToll; S.trip.status = 'event'; S.trip.event = { id: d.id, title: d.title, enc: true, ...d.make(S, ENC.ctx(S)) }; window.__dbg.openEvent(); }"""
STATE = """() => { const s = TB.session || (typeof SHAREDFIGHT !== 'undefined' ? SHAREDFIGHT.active : null); if (!s) return null;
  const f = s.f; return { ehp: Math.round(f.ehp), round: s.round, done: !!s.done, won: !!f.won, mirror: !!s.mirror,
    myTurn: s.mirror ? !!s.myTurn : !!document.querySelector('#tbf [data-tba=end]'),
    foes: s.ev.filter(e => e.kind === 'foe' && !/steps in/.test(e.text)).map(e => e.round + '|' + e.text.replace(/\\byou\\b/g, '').replace(/\\s+/g, ' ').slice(0, 40)),
    slots: s.mirror ? null : s.ev.filter(e => e.kind === 'round').map(e => [e.round, e.order.filter(o => /^foe/.test(o.id)).length]) }; }"""
# watch a teammate's screen: was the foe's chip ever lit while its move played?
LIT = """() => { if (window.__litT) return; window.__lit = 0; window.__litT = setInterval(() => { if (document.querySelector('#tbf .tbini.foe.now') && document.querySelector('#tbf.tbplay')) window.__lit++; }, 60); }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
        await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({artStyle:'ink'}))")
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&p=pfoe{tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
            return pg
        A = await phone("a", "Alfa"); B = await phone("b", "Beta"); C = await phone("c", "Ceta")
        pages = (A, B, C)
        for pg in pages: await pg.evaluate(HERE, {})
        ids = [await pg.evaluate("window.__dbg.save().id") for pg in pages]
        mem = ", ".join(f"{{ id: '{i}', name: '{n}' }}" for i, n in zip(ids, ("Alfa", "Beta", "Ceta")))
        await A.evaluate(f"() => Store.put('parties', 'pfoe', {{ leader: '{ids[0]}', leaderName: 'Alfa', members: [{mem}], invites: [], t: G.now() }})")
        seen = False
        for i in range(50):
            await pages[i % 3].bring_to_front(); await A.wait_for_timeout(500)
            for pg in pages: await pg.evaluate("() => window.__dbg.publish()")
            seen = all([await pg.evaluate("() => !!window.__dbg.party() && window.__dbg.others().length >= 2") for pg in pages])
            if seen: break
        ok(seen, "three phones in one party")

        await A.bring_to_front()
        await A.evaluate(FIGHT); await A.wait_for_timeout(500)
        await A.click("#modal [data-act=ev][data-c=fight]"); await A.wait_for_timeout(900)
        ok(await A.evaluate("TB.open && TB.session.f.allies.filter(a => a.pid).length === 2"), "Alfa's fight has Beta and Ceta in it as real players")
        for pg in (B, C):
            opened = False
            for _ in range(20):
                await pg.wait_for_timeout(400)
                opened = await pg.evaluate("!!document.querySelector('#tbf') && TB.open && !!SHAREDFIGHT.active")
                if opened: break
            ok(opened, "a teammate's phone opens the same fight")
            await pg.evaluate(LIT)

        shot = False; g = 0
        while g < 260:
            g += 1
            st = [await pg.evaluate(STATE) for pg in pages]
            if all(s is None or s["done"] for s in st): break
            if st[0] and st[0]["round"] >= 4 and not shot:
                await B.screenshot(path=OUT + "partyfoeturns_member.png"); await A.screenshot(path=OUT + "partyfoeturns_leader.png"); shot = True
            acted = False
            for pg, s in zip(pages, st):
                if not s or s["done"] or not s["myTurn"]: continue
                if not await pg.evaluate("!!document.querySelector('#tbf [data-tba=end]')"): continue
                await pg.bring_to_front()
                if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])')"):
                    await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(250)
                if await pg.evaluate("!!document.querySelector('#tbf [data-tba=end]')"): await pg.click("#tbf [data-tba=end]")
                await pg.wait_for_timeout(300); acted = True
            if not acted: await A.wait_for_timeout(350)
        for _ in range(30):
            if all([await pg.evaluate("!!document.querySelector('#tbf .tbdone')") for pg in pages]): break
            await A.wait_for_timeout(500)
        for pg in (B, C): await pg.wait_for_timeout(1500)
        st = [await pg.evaluate(STATE) for pg in pages]
        la = st[0]
        ok(la and la["done"], "the fight finished on the leader's phone")
        if la:
            per = {}
            for x in la["foes"]: r = int(x.split("|")[0]); per[r] = per.get(r, 0) + 1
            full = [r for r, n in la["slots"] if r < la["round"] or la["done"]]
            missing = [(r, n, per.get(r, 0)) for r, n in la["slots"] if r < la["round"] and per.get(r, 0) < n]
            ok(len(full) >= 3, f"the party fight lasted {la['round']} rounds (not over in a flash)")
            ok(not missing, f"every round, every foe move in the turn order was played on the leader's phone (missing: {missing[:5]})")
            for name, s in (("Beta", st[1]), ("Ceta", st[2])):
                ok(s and s["done"] and s["won"] == la["won"], f"{name}'s fight ends the same (won {s and s['won']} / {la['won']})")
                if not s: continue
                lead = [x.split("|")[0] for x in la["foes"]]; mine = [x.split("|")[0] for x in s["foes"]]
                ok(len(mine) == len(lead), f"{name}'s screen shows all {len(lead)} foe moves (it shows {len(mine)})")
                ok(mine == lead, f"{name} sees the foe's moves in the same rounds as the leader")
        for name, pg in (("Beta", B), ("Ceta", C)):
            lit = await pg.evaluate("window.__lit || 0")
            ok(lit > 0, f"{name}'s turn strip lights the foe while its move plays ({lit} frames)")
        ok(not errs, "no page errors " + "; ".join(errs[:3]))
        await b.close()
    print("screenshots:", OUT)
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
    sys.exit(1 if fails else 0)

asyncio.run(main())
