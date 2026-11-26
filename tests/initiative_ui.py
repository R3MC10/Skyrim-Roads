"""The turn roster (initroster.js + initiative.js) on the fight screen. [initiative]
At 360x640, 390x844 and 1920x1080: a boss fight with followers shows 44px portraits in initiative order, the boss's two
slots marked, the round marker with the next round dimmed after it, and a +N button that opens the whole order (and
closes again). No sideways page scroll. A stagger slides the foe's portrait back with the stagger icon flashing on it;
a freeze crosses its next turn out. A party fight (two teammates side by side with you): one bracket round the shared
turn, no countdown, "Beta, Ceta are choosing...", and after 30 s of nothing a Skip button that makes them guard.
Usage: python initiative_ui.py PORT  (serve game/ first: node serve.js PORT game)
Screenshots go to $SHOTS (or tests/out_initiative/), named initiative_*.png."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("SHOTS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_initiative")
OUT = OUT.rstrip("/\\") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

HERO = """() => { document.querySelectorAll('#modal').forEach(m => m.remove()); const S = window.__dbg.save(); S.level = 25;
  for (const k of ['One-Handed','Destruction','Restoration','Athletics']) S.skills[k].lvl = 45;
  S.follower = { id: 'lydia', hp: 9999, ts: 0 }; G.give(S, 'potion_health', 3); G.setHealth(S, G.maxHealth(S)); S.dungeon = null; S.trip = null; return true; }"""
# a boss fight with a follower, two of the party's dogs and a summoned helper, built straight on the fight screen
FIGHT = """(party) => { const S = window.__dbg.save();
  const foe = G.scaleEnemy({ name: 'Bandit chief', health: 420, damage: 20, tags: ['humanoid', 'elite'], level: 25, gold: [0, 0], text: '' }, 25); foe.boss = true;
  const f = new G.Fight(S, foe); f.allies = [{ name: 'Lydia', hp: 300, maxHp: 300, dmg: 14, follower: true, fid: 'lydia' }, { name: 'Meeko', kind: 'dog', hp: 140, maxHp: 140, dmg: 6, follower: true, fid: 'meeko', pet: true }];
  const remote = { ask() {}, end() {}, sync() {}, live: () => true, online: () => true };
  if (party) { for (const [pid, nm] of [['p2', 'Beta'], ['p3', 'Ceta']]) { const al = COOP.allyFromCard({ id: pid, name: nm, cur: 300, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: 'fighter', speed: 5 } } }); al.pid = pid; f.allies.push(al); } TB.init({ toast() {}, remote }); }
  else TB.init({ toast() {} });
  const ss = new TB.Session(f, { trySneak: false });
  ss.ini = { roll: { me: 4, 'p:p2': 4, 'p:p3': 4, 'f:lydia': 1, 'f:meeko': 2, 'foe:1': 3 }, me: INIT.heroSpeed(S, f).speed, imm: 0, pushed: {}, flash: {}, said: {}, seq: 0 };
  TB.play(ss, {}, () => {}); return ss.order.map(o => o.id + ':' + o.init).join(' '); }"""
ROSTER = """() => { const st = document.querySelector('#tbf .tbord'); if (!st) return null; const r = st.getBoundingClientRect();
  const chips = [...st.querySelectorAll('.tbini.ini2:not(.nx)')], nx = st.querySelectorAll('.tbini.nx').length;
  const inside = chips.filter(c => { const b = c.getBoundingClientRect(); return b.width > 0 && b.left >= r.left - 1 && b.right <= r.right + 1; }).length;
  const w = chips.map(c => Math.round(c.getBoundingClientRect().width));
  return { n: chips.length, nx, inside, w, slots: [...st.querySelectorAll('.inislot')].map(e => e.textContent), sep: !!st.querySelector('.inisep'),
    more: !!st.querySelector('.inimore'), grp: st.querySelectorAll('.inigrp').length, grpNow: !!st.querySelector('.inigrp.now'),
    tip: (chips[0] && chips[0].dataset.tip) || '', overflow: document.documentElement.scrollWidth - innerWidth, top: Math.round(document.querySelector('#tbf .tbtop').getBoundingClientRect().height) }; }"""

async def fight(b, w, h, tag, party=False):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1 if w > 1000 else 2, has_touch=w < 1000, locale="en-US")
    await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({artStyle:'ink', fightIntro: false}))")
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?notut&tb"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
    await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
    await pg.evaluate(HERO)
    order = await pg.evaluate(FIGHT, party)
    print(tag, "order:", order)
    await pg.wait_for_timeout(3500)
    await pg.evaluate("document.querySelectorAll('#obtip,.fpres,.tbban').forEach(e=>e.remove())")
    return ctx, pg, errs

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        try: b = await p.chromium.launch(**(kw or {"channel": "chrome"}))   # installed Chrome when there is one: the bundled headless shell sometimes crashes on the fight scene on busy machines
        except Exception: b = await p.chromium.launch(**kw)
        for (w, h, nm) in ((360, 640, "360"), (390, 844, "phone"), (1920, 1080, "pc")):
            ctx, pg, errs = await fight(b, w, h, nm)
            r = await pg.evaluate(ROSTER)
            ok(r is not None, f"{nm}: the turn roster is on screen")
            if r:
                print("  ", r)
                ok(r["n"] >= 4 and all(40 <= x <= 56 for x in r["w"] if x), f"{nm}: a 44px portrait per slot, a bit bigger with the PC zoom ({r['n']}, widths {sorted(set(r['w']))})")
                ok("①" in r["slots"] and "②" in r["slots"], f"{nm}: the boss's two slots are marked 1 and 2 ({r['slots']})")
                ok(r["sep"] and r["nx"] >= 3, f"{nm}: the round marker and the next round, dimmed ({r['nx']})")
                ok(r["more"], f"{nm}: the +N button")
                ok(r["overflow"] <= 1, f"{nm}: no sideways page scroll ({r['overflow']})")
                ok("initiative" in r["tip"] and "roll" in r["tip"], f"{nm}: tapping a portrait tells its initiative: {r['tip'][:90]}")
                if w < 400: ok(r["inside"] >= 4, f"{nm}: {r['inside']} portraits fit on the phone strip")
            await pg.screenshot(path=f"{OUT}initiative_roster_{nm}.png")
            # +N: the whole order
            await pg.click("#tbf .inimore"); await pg.wait_for_timeout(400)
            sh = await pg.evaluate("() => { const s = document.querySelector('.inisheet'); return s ? { rows: s.querySelectorAll('.inirow').length, shared: s.querySelectorAll('.inishared').length, h: s.querySelector('.inisheetin').getBoundingClientRect().height } : null; }")
            ok(sh and sh["rows"] >= (r["n"] if r else 1), f"{nm}: +N opens the whole order ({sh})")
            await pg.screenshot(path=f"{OUT}initiative_sheet_{nm}.png")
            await pg.click(".inisheet .inix"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("() => !document.querySelector('.inisheet')"), f"{nm}: and closes")
            if nm in ("phone", "pc"):
                # a stagger: the foe's slot slides back with the stagger icon flashing
                await pg.evaluate("() => { const s = TB.session; s.f.stagger = 1; s.tidy(); TB.redraw(s, { turn: 'me' }); }")
                await pg.wait_for_timeout(90)
                await pg.screenshot(path=f"{OUT}initiative_reorder_mid_{nm}.png")
                fl = await pg.evaluate("() => ({ flash: !!document.querySelector('#tbf .tbini.iniflash'), moving: [...document.querySelectorAll('#tbf .tbini.ini2')].some(c => c.style.transform && c.style.transform !== 'none'), why: [...document.querySelectorAll('#tbf .tbini[data-why]')].map(c => c.dataset.why) })")
                ok(fl["why"] and "staggered" in fl["why"], f"{nm}: the staggered slot says why it moved ({fl})")
                ok(fl["flash"] or await pg.evaluate("() => ACCESS && ACCESS.reduceMotion && ACCESS.reduceMotion()"), f"{nm}: the stagger icon flashes on it")
                await pg.wait_for_timeout(500)
                await pg.screenshot(path=f"{OUT}initiative_reorder_after_{nm}.png")
                # a freeze: the next turn is crossed out
                await pg.evaluate("() => { const s = TB.session; s.f.eParalyzed = 1; s.tidy(); TB.redraw(s, { turn: 'me' }); }")
                await pg.wait_for_timeout(200)
                ok(await pg.evaluate("() => !!document.querySelector('#tbf .tbini.ini2.skip .inicross')"), f"{nm}: a frozen foe's next turn is crossed out")
                await pg.screenshot(path=f"{OUT}initiative_skip_{nm}.png")
            ok(not errs, f"{nm}: no page errors {errs[:2]}")
            await ctx.close()
        # a party fight: you, Beta and Ceta share a turn; no timer; Skip after 30 s of nothing
        for (w, h, nm) in ((390, 844, "phone"), (1920, 1080, "pc")):
            ctx, pg, errs = await fight(b, w, h, "party_" + nm, party=True)
            r = await pg.evaluate(ROSTER)
            print("  ", r)
            ok(r and r["grp"] >= 1, f"party {nm}: a bracket round the shared turn ({r and r['grp']})")
            await pg.screenshot(path=f"{OUT}initiative_party_{nm}.png")
            # end your part: the others are still choosing, no countdown
            if await pg.evaluate("() => !!document.querySelector('#tbf [data-tba=end]')"):
                await pg.evaluate("() => document.querySelector('#tbf [data-tba=end]').click()"); await pg.wait_for_timeout(2500)
            wt = await pg.evaluate("() => { const w = document.querySelector('#tbf .tbwait'); return w ? w.textContent : ''; }")
            ok("choosing" in wt and "then they guard" not in wt, f"party {nm}: waits for them, no time-out: {wt.strip()[:80]}")
            await pg.evaluate("() => { const s = TB.session; for (const w of s.gr.waits) { w.t0 -= 31000; w.seen = w.t0; w.ack = true; } }")
            await pg.wait_for_timeout(1300)
            sk = await pg.evaluate("() => [...document.querySelectorAll('#tbf .tbskipp')].map(b => b.textContent)")
            ok(any("Skip Beta" in x for x in sk), f"party {nm}: after 30 s the leader can skip a quiet player ({sk})")
            top = await pg.evaluate("() => [...document.querySelectorAll('#tbf .tbskipp')].every(b => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && b.contains(e); })")
            ok(top, f"party {nm}: nothing covers the Skip buttons")
            await pg.screenshot(path=f"{OUT}initiative_party_skip_{nm}.png")
            if sk:
                await pg.click("#tbf .tbskipp"); await pg.wait_for_timeout(1500)
                ok(await pg.evaluate("() => TB.session.ev.some(e => /is skipped and keeps their guard up/.test(e.text))"), f"party {nm}: the skipped player guards")
            ok(not errs, f"party {nm}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print("FAILED " + str(len(fails)) if fails else "ALL OK")
    sys.exit(1 if fails else 0)
asyncio.run(main())
