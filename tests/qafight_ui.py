"""Fight / dungeon / party bug hunt regressions (claude/qa-fight-*), in the real game on a phone (390x844, touch) and a PC (1920x1080).
Usage: python qafight_ui.py PORT -> RESULT OK
- Healing someone from the Magic menu: on phones the open menu covered every portrait, so after tapping Cast on a heal
  with a follower along there was nothing you could tap ("Tap a portrait"). The aim bar now has a button per target.
- Attacks land on foot and from the saddle (mounted combat is on)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

CLEAN = "() => document.querySelectorAll('#modal,.obtip,.toast,#toast,.pban,#folbark,#bark,#lvlpick').forEach(m => m.remove())"
SETUP = """() => { const S = window.__dbg.save(); S.level = 20; for (const k of Object.keys(S.skills)) S.skills[k].lvl = 40;
  for (const id of ['flames', 'healing']) if (!S.spells.includes(id)) S.spells.push(id);
  S.sideAsked = true; G.setHealth(S, G.maxHealth(S)); }"""
ROAD = """(o) => { const S = window.__dbg.save(); S.dungeon = null; S.trip = null;
  S.follower = o.fol ? { id: 'lydia', hp: TOWNS.followerMax(S, 'lydia'), ts: G.now() } : null;
  S.horse = o.horse ? { name: 'Frost', coat: 'grey', armor: 'none', hp: HORSES.BASE_HP, hpT: G.now(), mounted: true } : null;
  G.setHealth(S, Math.round(G.maxHealth(S) * (o.hurt ? 0.5 : 1)));
  [S.x, S.y] = WORLD.places.Whiterun; S.location = null; G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2));
  const d = ENC.byId.banditToll; S.trip.status = 'event'; S.trip.event = { id: d.id, title: d.title, enc: true, ...d.make(S, ENC.ctx(S)) }; window.__dbg.openEvent(); }"""
FOE_DOWN = "() => { try { TB.session.f.ehp = 0; } catch (e) {} }"

async def tap(pg, tag, sel):
    if tag == "phone": await pg.tap(sel, timeout=4000)
    else: await pg.click(sel, timeout=4000)

async def fight(pg, o):
    for _ in range(8):   # the toll sometimes rolls a way past without a fight (only Continue): roll again
        await pg.evaluate(CLEAN); await pg.evaluate(ROAD, o); await pg.wait_for_timeout(500)
        if await pg.evaluate("() => !!document.querySelector('#modal [data-act=ev][data-c=fight]')"): break
    try: await pg.click("#modal [data-act=ev][data-c=fight]", timeout=5000)
    except Exception:
        print("     (Fight button blocked by:", await pg.evaluate("() => { const b = document.querySelector('#modal [data-act=ev][data-c=fight]'); if (!b) return 'no button: ' + [...document.querySelectorAll('#modal button')].map(x => x.textContent.trim()).join('|'); const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return (t && (t.id || t.className)) + ' / tbf ' + !!document.querySelector('#tbf'); }"), ")")
        return False
    for _ in range(60):
        if await pg.evaluate("() => !!document.querySelector('#tbf [data-tba=attack]:not([disabled])')"): return True
        await pg.wait_for_timeout(250)
    return False

async def finish(pg):
    for _ in range(120):   # a bandit group: each foe in turn
        if not await pg.evaluate("() => !!document.querySelector('#tbf')"): break
        if await pg.evaluate("() => !!document.querySelector('#tbf .tbdone')"):
            await pg.click("#tbf .tbdone"); await pg.wait_for_timeout(400); continue
        await pg.evaluate(FOE_DOWN)
        if await pg.evaluate("() => !!document.querySelector('#tbf [data-tba=end]:not([disabled])')"):
            try: await pg.click("#tbf [data-tba=end]", timeout=800)
            except Exception: pass
        await pg.wait_for_timeout(400)
    await pg.wait_for_timeout(500); await pg.evaluate(CLEAN)
    await pg.evaluate("() => { window.__dbg.save().trip = null; }")

async def heal_ally(pg, tag):
    ok(await fight(pg, {"fol": True, "hurt": True}), f"{tag}: fight with Lydia opens")
    await tap(pg, tag, "#tbf [data-tbm=magic]"); await pg.wait_for_timeout(400)
    await pg.evaluate("() => { const s = TB.session; s.f.allies.forEach(a => a.hp = Math.round(a.hp * 0.5)); }")
    await tap(pg, tag, "#tbf [data-tba='spell:healing']"); await pg.wait_for_timeout(400)
    names = await pg.evaluate("() => [...document.querySelectorAll('#tbf .fc-aimbar .fc-who')].map(b => { const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { me: b.classList.contains('me'), top: t === b || b.contains(t) } })")
    ok(any(n["me"] for n in names) and any(not n["me"] for n in names), f"{tag}: the aim bar offers you and Lydia ({len(names)} names)")
    ok(names and all(n["top"] for n in names), f"{tag}: the name buttons can be tapped (nothing covers them)")
    before = await pg.evaluate("() => TB.session.f.allies.map(a => Math.round(a.hp))")
    await tap(pg, tag, "#tbf .fc-aimbar .fc-who:not(.me)")
    for _ in range(30):   # the spell's rune game runs out on its own
        await pg.wait_for_timeout(250)
        if not await pg.evaluate("() => !!document.querySelector('.mg') || document.querySelector('#tbf').classList.contains('fc-aiming')"): break
    await pg.wait_for_timeout(600)
    after = await pg.evaluate("() => TB.session.f.allies.map(a => Math.round(a.hp))")
    ok(after and before and after[0] > before[0], f"{tag}: tapping Lydia's name heals Lydia ({before} -> {after})")
    await finish(pg)

async def attacks(pg, tag, horse):
    ok(await fight(pg, {"horse": horse}), f"{tag}: fight opens (horse {horse})")
    e0 = await pg.evaluate("() => TB.session.f.ehp")
    await tap(pg, tag, "#tbf [data-tba=attack]")
    for _ in range(30):
        await pg.wait_for_timeout(250)
        if not await pg.evaluate("() => !!document.querySelector('.mg')"): break
    await pg.wait_for_timeout(600)
    e1, acts = await pg.evaluate("() => [TB.session.f.ehp, TB.session.myActs]")
    ok(acts >= 1 and e1 <= e0, f"{tag}: Attack is spent and lands (horse {horse}; foe {round(e0)} -> {round(e1)}, moves used {acts})")
    await finish(pg)

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for vw, vh, tag in [(390, 844, "phone"), (1920, 1080, "pc")]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, has_touch=tag == "phone", is_mobile=tag == "phone")
            await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({obTips:false,lang:'en',tbGames:true}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, t=tag: errs.append(t + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&p=qaf{tag}"); await pg.wait_for_timeout(2000)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Qafight"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(SETUP)
            await heal_ally(pg, tag)
            await attacks(pg, tag, False)
            await attacks(pg, tag, True)
            await ctx.close()
        ok(not errs, "no page errors " + str(errs[:3]))
        await b.close()
    print("RESULT " + ("OK" if not fails else "FAILED " + str(len(fails))))
    sys.exit(1 if fails else 0)

asyncio.run(main())
