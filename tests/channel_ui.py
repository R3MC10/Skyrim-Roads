"""Teammates see a move being prepared (channel.js), on two phones: Alfa leads, Beta is in his party. Alfa starts a road
fight. When Alfa casts Flames, his minigame opens on his phone; on Beta's phone Alfa's hero takes the casting pose and a
small bar over his head fills. Covered: the live bar (filling, never full before the result, clear of the foe's card,
the log, the plates and the turn strip), a crit (Perfect), a fail (the rune fizzles), a cancel (fades), Alfa's own bar
behind his minigame, and the other way round (Beta casts on his own phone, the leader's phone sees it). Phone 390x844
and PC 1920x1080.
Usage: python channel_ui.py PORT  (serve game/ first: node serve.js PORT game)
Screenshots go to $SHOTS (or tests/out_channel/). PREFIX (default channel_) names them."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("SHOTS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_channel")
OUT = OUT.rstrip("/\\") + os.sep; os.makedirs(OUT, exist_ok=True)
PRE = os.environ.get("PREFIX", "channel_")
BEFORE = os.environ.get("BEFORE") == "1"   # an old build (no channel.js): only take the screenshots
CHROME = (os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c and not BEFORE: fails.append(m)

HERE = """(o) => { const S = window.__dbg.save(); S.level = 20; S.hpBonus = 400; S.mpBonus = 400;
  for (const k of ['One-Handed','Destruction','Restoration','Athletics','Acrobatics']) S.skills[k].lvl = 45;
  S.spells = [...new Set([...(S.spells || []), 'flames', 'healing'])];
  S.dungeon = null; S.trip = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun.slice(0, 2);
  G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); }"""
FIGHT = """() => { document.querySelectorAll('#modal').forEach(m => m.remove()); const S = window.__dbg.save();
  S.location = null; G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2));
  const d = ENC.byId.banditToll; S.trip.status = 'event'; S.trip.event = { id: d.id, title: d.title, enc: true, ...d.make(S, ENC.ctx(S)) }; window.__dbg.openEvent(); }"""
MYTURN = """() => { const s = TB.session; if (!s || s.done) return false; if (!document.querySelector('#tbf [data-tba=end]')) return false;
  return s.mirror ? !!s.myTurn : s.cur?.id === 'me'; }"""
CAST = """(a) => { const s = TB.session; if (s) { s.f.mp = Math.max(s.f.mp, 300); s.used = {}; }
  document.querySelectorAll('#tbf .tbtime').forEach(e => e.remove());
  const b = document.createElement('button'); b.dataset.tba = a; b.style.display = 'none'; document.getElementById('tbf').appendChild(b); b.click(); b.remove(); }"""
BAR = """(n) => { const e = document.querySelector(`#tbf .chb[data-name="${n}"]`); if (!e || e.hidden) return null; const r = e.getBoundingClientRect();
  return { st: e.dataset.st, res: e.dataset.res || null, why: e.dataset.why || null, frac: +e.dataset.frac, op: +getComputedStyle(e).opacity, look: [...e.classList].find(c => c.startsWith('lk-')), mine: e.classList.contains('mine'), r: [r.left, r.top, r.right, r.bottom] }; }"""
CLASH = """(n) => { const e = document.querySelector(`#tbf .chb[data-name="${n}"]`); if (!e) return ['no bar'];
  const a = e.getBoundingClientRect(), out = [];
  for (const q of ['#tbf .c2ov .tbu.foe', '#tbf .c2ov .tblog', '#tbf .c2ov .tbu.me', '#tbf .c2ov .tbparty > *', '#tbf .tbtop', '#tbf .tbdock, #tbf .tbacts']) for (const o of document.querySelectorAll(q)) {
    if (!o.getClientRects().length || getComputedStyle(o).visibility === 'hidden') continue; const b = o.getBoundingClientRect(); if (!b.width || !b.height) continue;
    if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) out.push(q + ' ' + (o.className || '').toString().slice(0, 30)); }
  if (a.left < 0 || a.right > innerWidth || a.top < 0) out.push('off screen'); return out; }"""
POSE = """(n) => { const a = typeof CHANNEL !== "undefined" && CHANNEL.allyAnim ? CHANNEL.allyAnim(n) : null; return a ? a.clip : null; }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
        await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({artStyle:'ink', tbGames:true}))")
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&games&p=chan{tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
            return pg
        A = await phone("a", "Alfa"); B = await phone("b", "Beta")
        for pg in (A, B): await pg.evaluate(HERE, {})
        ids = [await pg.evaluate("window.__dbg.save().id") for pg in (A, B)]
        await A.evaluate(f"() => Store.put('parties', 'pchan', {{ leader: '{ids[0]}', leaderName: 'Alfa', members: [{{ id: '{ids[0]}', name: 'Alfa' }}, {{ id: '{ids[1]}', name: 'Beta' }}], invites: [], t: G.now() }})")
        seen = False
        for i in range(40):
            await (A, B)[i % 2].bring_to_front(); await A.wait_for_timeout(500)
            for pg in (A, B): await pg.evaluate("() => window.__dbg.publish()")
            seen = all([await pg.evaluate("() => !!window.__dbg.party() && window.__dbg.others().length >= 1") for pg in (A, B)])
            if seen: break
        ok(seen, "two phones in one party")
        await A.bring_to_front(); await A.evaluate(FIGHT); await A.wait_for_timeout(500)
        await A.click("#modal [data-act=ev][data-c=fight]"); await A.wait_for_timeout(900)
        opened = False
        for _ in range(25):
            await B.wait_for_timeout(400)
            opened = await B.evaluate("!!document.querySelector('#tbf') && TB.open && !!SHAREDFIGHT.active")
            if opened: break
        ok(opened, "Beta's phone opens the same fight")
        for pg in (A, B): await pg.evaluate("() => { const s = TB.session; if (s && s.f && s.f.e) { s.f.e.hp = s.f.ehp = s.ehpMax = s.f.ehp0 = 5000; } }")

        async def turn_of(pg, other, tries=80):
            for _ in range(tries):
                if await pg.evaluate(MYTURN): return True
                if await other.evaluate(MYTURN): await other.evaluate("() => document.querySelector('#tbf [data-tba=end]')?.click()")
                await pg.wait_for_timeout(400)
            return False

        async def cast_and_watch(caster, watcher, cname, size, outcome):
            await caster.bring_to_front()
            ok(await turn_of(caster, watcher), f"[{size}] {cname}'s turn comes")
            await caster.evaluate(CAST, "spell:flames"); await caster.wait_for_timeout(350)
            ok(await caster.evaluate("!!document.querySelector('#tbf .tbtime.mg-rune')"), f"[{size}] {cname}'s minigame (the rune) opens on their own phone")
            mine = await caster.evaluate(BAR, cname)
            ok(BEFORE or (mine and mine["mine"] and mine["st"] == "live"), f"[{size}] {cname}'s own hero shows the bar behind the minigame: {mine}")
            if outcome == "crit":   # a Perfect needs the rune done fast (a busy test machine is slow): all three points now
                for _ in range(3): await caster.keyboard.press("Space"); await caster.wait_for_timeout(30)
            bar = None
            for _ in range(15):
                bar = await watcher.evaluate(BAR, cname)
                if bar: break
                await watcher.wait_for_timeout(150)
            await watcher.bring_to_front()
            if outcome == "fail": await watcher.screenshot(path=OUT + f"{PRE}{size}_{'leader' if watcher is A else 'member'}_sees_live.png")
            ok(BEFORE or (bar and bar["look"] == "lk-fire" and (bar["st"] == "live" or outcome == "crit")), f"[{size}] the other phone sees {cname} channelling a fire spell: {bar}")
            if bar and not BEFORE and outcome != "crit":
                await watcher.wait_for_timeout(600); bar2 = await watcher.evaluate(BAR, cname)
                ok(bar2 and bar2["frac"] > bar["frac"] and bar2["frac"] < 1, f"[{size}] the bar fills ({bar['frac']} -> {bar2 and bar2['frac']}) and is not full before the result")
                clash = await watcher.evaluate(CLASH, cname)
                ok(not clash, f"[{size}] the bar sits over {cname}'s head, clear of the cards, plates, log and turn strip: {clash}")
                pose = await watcher.evaluate(POSE, cname)
                ok(pose == "cast", f"[{size}] {cname}'s hero takes the casting pose on the other phone ({pose})")
            await caster.bring_to_front()
            if outcome == "cancel":
                await caster.wait_for_timeout(500); await caster.evaluate("() => typeof CHANNEL !== 'undefined' && CHANNEL.cancelMine(TB.session, 'test')")
            # fail: let the rune fizzle out
            res = None
            for _ in range(40):
                r = await watcher.evaluate(BAR, cname)
                if r and r["st"] == "end": res = r; break
                await watcher.wait_for_timeout(150)
            want = {"crit": "crit", "fail": "fail", "cancel": "cancel"}[outcome]
            await watcher.bring_to_front()
            await watcher.screenshot(path=OUT + f"{PRE}{size}_{'leader' if watcher is A else 'member'}_sees_{outcome}.png")
            ok(BEFORE or (res and res["res"] == want), f"[{size}] the other phone gets the result from the leader's record: {want} ({res})")
            if outcome == "crit" and res and not BEFORE: ok(res["frac"] == 1, f"[{size}] a crit fills the bar")
            if outcome != "crit" and res and not BEFORE: ok(res["frac"] < 1, f"[{size}] a {outcome} doesn't fill the bar")
            for _ in range(30):
                if not await caster.evaluate("!!document.querySelector('#tbf .tbtime')"): break
                await caster.wait_for_timeout(200)
            await caster.wait_for_timeout(1700)
            gone = await watcher.evaluate(BAR, cname)
            ok(BEFORE or gone is None or gone["op"] < 0.2, f"[{size}] the bar fades away afterwards ({gone})")

        for size, vp in (("phone", {"width": 390, "height": 844}), ("pc", {"width": 1920, "height": 1080})):
            for pg in (A, B): await pg.set_viewport_size(vp)
            await A.wait_for_timeout(900)
            await cast_and_watch(A, B, "Alfa", size, "crit")
            await cast_and_watch(A, B, "Alfa", size, "fail")
            await cast_and_watch(A, B, "Alfa", size, "cancel")
            await A.evaluate("() => document.querySelector('#tbf [data-tba=end]')?.click()")
            await cast_and_watch(B, A, "Beta", size, "fail")
            await B.evaluate("() => document.querySelector('#tbf [data-tba=end]')?.click()")
        ok(not errs, "no page errors " + "; ".join(errs[:3]))
        await b.close()
    print("screenshots:", OUT)
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
    sys.exit(1 if fails else 0)

asyncio.run(main())
