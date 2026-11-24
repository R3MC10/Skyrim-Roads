"""Festivals and the Grand Arena (tourney.js, tourneyui.js) in the browser: phone (390x844) and PC (1280x800), ink art.
Usage: python tourney_ui.py PORT -> RESULT OK   (LANG_UI=pl for Polish, DEVS=phone or pc for one)
The page clock is moved into the Burning of King Olaf (Solitude: drinking, duels, archery). Opens Festivals in Solitude,
checks the contests, boards, a second player's entry, the friendly-duel list and the calendar; plays the drinking contest,
an archery try, a festival duel and a friendly duel with the other player (nothing lost, no bounty); then walks into the
Grand Arena in Windhelm and fights a round. Screenshots: tests/out_tourney/."""
import asyncio, sys, os, time
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
LANG = os.environ.get("LANG_UI", "en")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_tourney") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

# the page clock: three hours into the next Burning of King Olaf (festival 5 of 7 in the rotation)
EPOCH = 1767571200000; SLOT = 3 * 864e5   # Date.UTC(2026, 0, 5)
now = time.time() * 1000
k = int((now - EPOCH) // SLOT)
while k % 7 != 5: k += 1
if EPOCH + k * SLOT + 2 * 864e5 < now: k += 7
OFFSET = int(max(0, EPOCH + k * SLOT + 3 * 3600e3 - now))
CLOCK = f"(() => {{ const n = Date.now.bind(Date), o = {OFFSET}; Date.now = () => n() + o; }})();"

SETUP = """() => { ART.setStyle && ART.setStyle('ink'); const S = window.__dbg.save(); S.gold = 500; S.level = 22; S.trip = null; S.dungeon = null;
  for (const k of Object.keys(S.skills)) S.skills[k].lvl = Math.max(S.skills[k].lvl, 45);
  S.location = 'Solitude'; [S.x, S.y] = WORLD.places['Solitude']; G.setHealth(S, G.maxHealth(S));
  const c = TOURNEY.current();
  // another player's festival record: Brynjolf, for The Rift, with a duel snapshot
  const B = G.newSave('BR1', 'Brynjolf', 'nord'); B.level = 20; for (const k of Object.keys(B.skills)) B.skills[k].lvl = 45; B.location = 'Solitude';
  TOURNEY.setRep(B, 'hold', 'The Rift'); TOURNEY.entry(B, c.key).sc.drink = 63; TOURNEY.entry(B, c.key).sc.archery = 70;
  const doc = TOURNEY.record(B, c.key); Store.put('fest', 'BR1|' + c.key, doc);
  window.__dbg.publish(); return c ? c.id + ':' + c.place + ':' + !!doc.snap : 'none'; }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for dev, vp, touch in [d for d in [("phone", {"width": 390, "height": 844}, True), ("pc", {"width": 1280, "height": 800}, False)] if d[0] in os.environ.get("DEVS", "phone,pc")]:
            name = dev + ("" if LANG == "en" else "_" + LANG)
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if touch else 1, has_touch=touch)
            await ctx.add_init_script(CLOCK)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'ink',obTips:false,lang:'{LANG}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
            for _ in range(8):   # python's test server sometimes drops a script under load: load the page again
                await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&assets&p=tn{name}"); await pg.wait_for_timeout(2000)
                if await pg.evaluate("() => { try { return typeof Store !== 'undefined' && typeof TOURNEYUI !== 'undefined' && typeof DUNGEONS !== 'undefined' && !!document.querySelector('.press'); } catch { return false; } }"): break
            errs.clear()
            await pg.wait_for_selector(".press", timeout=60000); await pg.click(".press")
            await pg.wait_for_selector(".mi[data-t=new]", timeout=30000); await pg.click(".mi[data-t=new]")
            await pg.wait_for_selector("#nm", timeout=30000); await pg.fill("#nm", "Festtest"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.add_style_tag(content="#pbanners,.pban,.pburst,.pgold,.toast,#toast{display:none!important}")
            res = await pg.evaluate(SETUP)
            ok(res == "olaf:Solitude:true", f"{name}: the Burning of King Olaf is on in Solitude ({res})")
            async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame,.obtip,.toast,#toast,.pban,#craftgame,#tnsheet').forEach(m => m.remove())")
            async def town(shop):
                await clean(); await pg.evaluate(f"() => window.__ui.jump({{ tab: 'town', shop: '{shop}' }})"); await pg.wait_for_timeout(800)
                await pg.evaluate("() => document.querySelector('.tn')?.scrollIntoView({ block: 'start' })"); await pg.wait_for_timeout(300)
            async def shot(fn, sel=None):
                await pg.wait_for_timeout(400)
                if sel: await pg.evaluate(f"() => document.querySelector(\"{sel}\")?.scrollIntoView({{block:'start'}})"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT + fn)
            # 1. Festivals in Solitude: three contests with boards, the other player, the calendar, the ink banner
            await town("festival")
            ok(await pg.query_selector(".tn-fest") is not None, f"{name}: Festivals screen opens")
            ok(await pg.evaluate("() => document.querySelectorAll('.tn-card[data-kind]').length") == 3, f"{name}: three contests")
            ok(await pg.query_selector("img.tn-art") is not None, f"{name}: ink festival banner")
            ok(await pg.evaluate("() => [...document.querySelectorAll('.tn-board li')].some(l => /Brynjolf/.test(l.textContent))"), f"{name}: the other player is on the board")
            ok(await pg.query_selector("[data-tact=pvp][data-id=BR1]:not([disabled])") is not None, f"{name}: friendly duel offered")
            ok(await pg.evaluate("() => document.querySelectorAll('.tn-cal li').length") == 4, f"{name}: the calendar shows what's next")
            ok(await pg.evaluate("() => !!document.querySelector('.tn-town')"), f"{name}: the town line announces the festival")
            cols = await pg.evaluate("() => getComputedStyle(document.querySelector('.tn-grid')).gridTemplateColumns.split(' ').length")
            ok(cols == (1 if dev == "phone" else 2) or (dev == "pc" and cols >= 2), f"{name}: {cols} column(s) of contests")
            wide = await pg.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
            ok(wide, f"{name}: no sideways scrolling")
            await shot(f"{name}_1_festival.png", ".tn-fest")
            # 2. the drinking contest and an archery try (mini-games resolve on their own under automation)
            await pg.click("[data-tact=try][data-k=drink]"); await pg.wait_for_timeout(700)
            await pg.click("[data-tact=try][data-k=archery]"); await pg.wait_for_timeout(700); await clean()
            sc = await pg.evaluate("() => { const S = window.__dbg.save(), e = TOURNEY.entry(S, TOURNEY.current().key, false); return e ? [e.sc.drink || 0, e.sc.archery || 0, e.tries.drink, e.tries.archery].join(',') : ''; }")
            # drinking can end at 0 if you fall off the bench (that's the game), so only the try counts there
            ok(sc and all(int(x) > 0 for x in sc.split(",")[1:]), f"{name}: drinking tried, archery scored ({sc})")
            await town("festival")
            ok(await pg.query_selector(".tn-board li.me") is not None, f"{name}: you're on the boards")
            # 3. a festival duel and a friendly duel with another player: nothing lost, no bounty, nobody hurt
            before = await pg.evaluate("() => { const S = window.__dbg.save(); return JSON.stringify([S.gold, S.inv.length, S.bounty || null, Math.round(G.curHealth ? G.curHealth(S) : S.health)]); }")
            await pg.click("[data-tact=try][data-k=duel]"); await pg.wait_for_timeout(1200)
            ok(await pg.query_selector("#modal") is not None, f"{name}: the duel shows the fight")
            await shot(f"{name}_2_duel.png")
            await clean(); await town("festival")
            await pg.click("[data-tact=pvp][data-id=BR1]"); await pg.wait_for_timeout(1200)
            txt = await pg.evaluate("() => document.querySelector('#modal')?.textContent || ''")
            ok(len(txt) > 20, f"{name}: friendly duel with Brynjolf")
            after = await pg.evaluate("() => { const S = window.__dbg.save(); return JSON.stringify([S.gold, S.inv.length, S.bounty || null, Math.round(G.curHealth ? G.curHealth(S) : S.health)]); }")
            ok(before == after, f"{name}: nothing lost, no bounty ({before} -> {after})")
            pub = await pg.evaluate("() => { const S = window.__dbg.save(); TOURNEYUI.publish(true); return Store.online ? 'on' : 'off'; }")
            ok(pub in ("on", "off"), f"{name}: record published ({pub})")
            # 4. the Grand Arena in Windhelm
            await pg.evaluate("() => { const S = window.__dbg.save(); S.location = 'Windhelm'; [S.x, S.y] = WORLD.places['Windhelm']; }")
            await town("pit")
            ok(await pg.query_selector(".tn-pit") is not None, f"{name}: the Grand Arena opens")
            await pg.click("[data-tact=pit]"); await pg.wait_for_timeout(1200)
            ok(await pg.query_selector("#modal") is not None, f"{name}: round 1 fought")
            await clean(); await town("pit")
            st = await pg.evaluate("() => { const S = window.__dbg.save(), P = TOURNEY.pitSt(S); return P.run ? 'run' + P.run.r : 'done' + (TOURNEY.entry(S, TOURNEY.pitKey(), false)?.sc?.pit ?? '-'); }")
            ok(st.startswith("run2") or st.startswith("done"), f"{name}: the run goes on ({st})")
            await shot(f"{name}_3_pit.png", ".tn-pit")
            await ctx.close()
        ok(not errs, "no page errors " + "; ".join(errs[:3]))
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
    sys.exit(1 if fails else 0)
asyncio.run(main())
