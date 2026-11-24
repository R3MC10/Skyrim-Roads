"""Deep expeditions and difficulty tiers (deepdelve.js), pictures on (?assets), ink and pixel art.
A) One phone, level 36, at a deadly dungeon: the place card shows the difficulty picker (Normal / Veteran / Legendary /
   Mythic) and this week's modifiers; picking Legendary shows two; going in shows the tier in the banner; the camp at the
   stairs offers Extract / Descend; descending shows level I in the banner; the camp on level I adds Rest.
   Phone (412x915) and PC (1280x800) screenshots.
B) Two phones in one co-op run, both at the camp: the Extract / Rest / Descend choice is a party vote with faces;
   when both vote Descend, both go down to the same level I map.
Usage: py deepdelve_ui.py PORT   (serve game/ first: py -m http.server PORT --directory ../game)
Screenshots go to tests/out_deepdelve/."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_deepdelve")
os.makedirs(OUT, exist_ok=True)
results = []
def check(name, cond, extra=""):
    results.append(bool(cond)); print(("ok  " if cond else "FAIL"), name, extra)

async def wait_for(pg, js, tries=24, gap=500):
    for _ in range(tries):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(gap)
    return False

PLACE_JS = "() => Object.keys(WORLD.places).find((p) => DEEPDELVE.deepable(p) && DUNGEONS.info(p).theme === 'barrow') || Object.keys(WORLD.places).find((p) => DEEPDELVE.deepable(p))"
SETUP = """(n) => { const S = window.__dbg.save(); S.location = n; [S.x, S.y] = WORLD.places[n].slice(0, 2); S.trip = null; if (!S.discovered.includes(n)) S.discovered.push(n);
  S.cleared = {}; S.level = 36; S.hpBonus = 400; G.setHealth(S, G.maxHealth(S)); G.give(S, 'potion_health', 3); S.dungeon = null; S.ddPick = null; window.__dbg.publish(); window.__ui.refresh(); }"""

async def main():
    async with async_playwright() as p:
        chrome = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=chrome, args=["--no-sandbox"])
        errs = []
        for style in (os.environ.get("STYLES") or "ink,pixel").split(","):
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + tag + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=dd{style}{tag}"); await pg.wait_for_timeout(1800)
                await pg.wait_for_selector(".press", state="attached", timeout=90000); await pg.evaluate("document.querySelector('.press').click()"); await pg.wait_for_timeout(500)
                await pg.wait_for_selector(".mi[data-t=new]", state="attached", timeout=30000); await pg.evaluate("document.querySelector('.mi[data-t=new]').click()"); await pg.wait_for_timeout(800)
                await pg.evaluate("() => document.querySelector('.cgtab[data-tab=start]')?.click()"); await pg.wait_for_timeout(300)   # the new character screen keeps the name on its Start tab
                await pg.wait_for_selector("#nm", timeout=60000); await pg.fill("#nm", name); await pg.evaluate("document.querySelector('#begin').click()"); await pg.wait_for_timeout(1500)
                await clean(pg)
                return pg
            async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro,#wwall,#obtip').forEach(m => m.remove())")
            async def tap(pg, act):
                await pg.evaluate(f"() => {{ const s = document.querySelector('#side') || document.body; const b = document.createElement('button'); b.dataset.act = '{act}'; s.appendChild(b); b.click(); b.remove(); }}")

            # ---------------- A) the picker, the banner, the camp
            A = await phone("A", "Alfa")
            place = await A.evaluate(PLACE_JS)
            check(f"[{style}] a deep dungeon exists", bool(place), str(place))
            await A.evaluate(SETUP, place); await clean(A)
            await A.click("[data-tab=map]"); await A.wait_for_timeout(400); await clean(A)
            card = await wait_for(A, "() => !!document.querySelector('.dd-card')", tries=10)
            chips = await A.evaluate("() => [...document.querySelectorAll('.dd-card [data-act=ddtier]')].map(b => b.dataset.t + (b.disabled ? '-off' : '')).join()")
            check(f"[{style}] the place card has the difficulty picker", card and chips == "normal,veteran,legendary,mythic", chips)
            check(f"[{style}] the place card mentions the deep expedition", await A.evaluate("() => !!document.querySelector('.dd-card .dd-deepnote')"))
            await A.evaluate("() => document.querySelector('.dd-card [data-t=legendary]').scrollIntoView({block: 'center'})")
            await A.click(".dd-card [data-t=legendary]"); await A.wait_for_timeout(400); await clean(A)
            on = await A.evaluate("() => document.querySelector('.dd-card .dd-tier.on')?.dataset.t")
            nm = await A.evaluate("() => document.querySelectorAll('.dd-card .dd-mod').length")
            check(f"[{style}] Legendary picked, two modifiers shown", on == "legendary" and nm == 2, f"{on} {nm}")
            await A.evaluate("() => document.querySelector('.dd-card').scrollIntoView({block: 'center'})"); await A.wait_for_timeout(300)
            await A.locator(".dd-card").screenshot(path=os.path.join(OUT, f"{style}_picker_phone.png"))
            await A.set_viewport_size({"width": 1280, "height": 800}); await A.wait_for_timeout(500); await clean(A)
            await A.evaluate("() => document.querySelector('.dd-card')?.scrollIntoView({block: 'center'})"); await A.wait_for_timeout(300)
            await A.screenshot(path=os.path.join(OUT, f"{style}_picker_pc.png"))
            await A.set_viewport_size({"width": 412, "height": 915}); await A.wait_for_timeout(300); await clean(A)
            # in we go: the tier shows in the banner
            await A.evaluate("() => document.querySelector('#dun') || document.querySelector('#side [data-act=enter], [data-act=enter]')?.click()")
            await A.wait_for_timeout(600); await clean(A)
            tier = await A.evaluate("() => window.__dbg.save().dungeon?.dtier")
            check(f"[{style}] going in uses Legendary", tier == "legendary", str(tier))
            await tap(A, "dun"); await A.wait_for_timeout(300)
            check(f"[{style}] the banner shows the tier and modifiers", await wait_for(A, "() => /Legendary/.test(document.querySelector('#dun .dd-banner')?.textContent || '') && document.querySelectorAll('#dun .dd-banner .dd-ic').length === 2", tries=8))
            # the master is down: the camp at the stairs
            await A.evaluate("() => { const S = window.__dbg.save(), d = S.dungeon; d.row = d.rows.length - 1; d.room = DEEPDELVE.campRoom(S); d.done = false; }")
            await tap(A, "dun"); await A.wait_for_timeout(400); await clean(A)
            cs = await A.evaluate("() => [...document.querySelectorAll('#dun .dd-camp [data-act=dact]')].map(b => b.dataset.c).join()")
            check(f"[{style}] the stairs: Extract or Descend", cs.startswith("extract") and "descend" in cs and "camprest" not in cs, cs)
            await A.click("#dun .dd-camp [data-act=dact][data-c=descend]"); await A.wait_for_timeout(600); await clean(A)
            lvl = await A.evaluate("() => window.__dbg.save().dungeon?.deep?.level")
            check(f"[{style}] descending takes you to level I", lvl == 1, str(lvl))
            await tap(A, "dun"); await A.wait_for_timeout(300)
            check(f"[{style}] the banner shows level I", await wait_for(A, "() => /Level I\\b/.test(document.querySelector('#dun .dd-banner')?.textContent || '')", tries=8))
            # level I's major fight is won: camp with Rest
            await A.evaluate("() => { const S = window.__dbg.save(), d = S.dungeon; S.gold += 420; d.row = d.rows.length - 1; d.room = DEEPDELVE.campRoom(S); d.deep.inj = 1; G.setHealth(S, G.maxHealth(S) * 0.55); }")
            await tap(A, "dun"); await A.wait_for_timeout(500); await clean(A)
            cs = await A.evaluate("() => [...document.querySelectorAll('#dun .dd-camp [data-act=dact]')].map(b => b.dataset.c).join()")
            check(f"[{style}] camp on level I: Extract / Rest / Descend", all(k in cs for k in ("extract", "camprest", "descend")), cs)
            uns = await A.evaluate("() => document.querySelector('#dun .dd-camp .dd-stats')?.textContent || ''")
            check(f"[{style}] the camp shows the unsecured loot", "420" in uns, uns[:80])
            await A.evaluate("() => document.querySelector('#dun .dd-camp')?.scrollIntoView({block: 'start'})"); await A.wait_for_timeout(300)
            await A.screenshot(path=os.path.join(OUT, f"{style}_camp_phone.png"))
            await A.set_viewport_size({"width": 1280, "height": 800}); await tap(A, "dun"); await A.wait_for_timeout(500); await clean(A)
            await A.screenshot(path=os.path.join(OUT, f"{style}_camp_pc.png"))
            # rest uses a ration and heals
            h0 = await A.evaluate("() => G.curHealth(window.__dbg.save())")
            await A.click("#dun .dd-camp [data-act=dact][data-c=camprest]"); await A.wait_for_timeout(500)
            h1 = await A.evaluate("() => G.curHealth(window.__dbg.save())")
            check(f"[{style}] resting at camp heals", h1 > h0 or await A.evaluate("() => !window.__dbg.save().dungeon"), f"{h0:.0f} -> {h1:.0f}")
            await A.close()

            # ---------------- B) the camp choice is a party vote
            L = await phone("L", "Lead"); M = await phone("M", "Mate")
            pages = (L, M)
            for pg in pages: await pg.evaluate(SETUP, place)
            idl, idm = [await pg.evaluate("window.__dbg.save().id") for pg in pages]
            seen = await wait_for(L, "() => window.__dbg.others().some(o => o.name === 'Mate')")
            check(f"[{style}] two phones see each other", seen)
            run_id = await L.evaluate(f"""async () => {{ const S = window.__dbg.save(); const r = COOP.newRun(S); if (r.err) return r.err;
                r.doc.members.push({{ id: '{idm}', name: 'Mate', level: 36 }}); r.doc.status = 'in';
                await Store.put('runs', r.id, r.doc); return r.id; }}""")
            check(f"[{style}] co-op run opened", isinstance(run_id, str) and run_id.startswith("run-"), str(run_id))
            for pg in pages:
                await wait_for(pg, f"() => (window.__dbg.coopRuns() || []).some(r => r.id === '{run_id}')")
                err = await pg.evaluate(f"() => {{ const r = window.__dbg.coopRuns().find(r => r.id === '{run_id}'); return COOP.join(window.__dbg.save(), r); }}")
                if err: print("join", err)
                # the master just fell on both phones: the camp at the stairs
                await pg.evaluate("() => { const S = window.__dbg.save(), d = S.dungeon; d.row = d.rows.length - 1; d.room = DEEPDELVE.campRoom(S); d.done = false; }")
                await clean(pg); await tap(pg, "dun")
            got = [await wait_for(pg, "() => !!document.querySelector('#dun .pvote [data-act=pvv]')") for pg in pages]
            keys = [await pg.evaluate("() => [...document.querySelectorAll('#dun .pvote [data-act=pvv]')].map(b => b.dataset.k).join()") for pg in pages]
            check(f"[{style}] both phones get the camp vote", all(got) and len(set(keys)) == 1 and "descend" in keys[0] and "extract" in keys[0], str(keys))
            if all(got):
                await M.bring_to_front(); await clean(M); await M.click("#dun .pvote [data-act=pvv][data-k='descend']")
                await L.bring_to_front()
                face = await wait_for(L, f"() => !!document.querySelector('#dun .pvote [data-k=\"descend\"] .pvchip[data-uid=\"{idm}\"]')")
                check(f"[{style}] Mate's face shows by Descend on the leader's phone", face)
                await L.wait_for_timeout(400); await clean(L)
                await L.screenshot(path=os.path.join(OUT, f"{style}_vote_phone.png"))
                await L.locator("#dun .pvote").screenshot(path=os.path.join(OUT, f"{style}_vote_card.png"))
                await clean(L); await L.click("#dun .pvote [data-act=pvv][data-k='descend']")
                down = [await wait_for(pg, "() => window.__dbg.save().dungeon?.deep?.level === 1", tries=30) for pg in pages]
                check(f"[{style}] the party goes down together", all(down), str(down))
                maps = [await pg.evaluate("() => JSON.stringify(window.__dbg.save().dungeon?.rows?.map(r => r.map(n => n.type)))") for pg in pages]
                check(f"[{style}] the same level I map on both phones", maps[0] == maps[1] and maps[0] not in (None, "null"), str(maps)[:120])
                await M.bring_to_front(); await M.set_viewport_size({"width": 1280, "height": 800}); await tap(M, "dun"); await M.wait_for_timeout(500); await clean(M)
                await M.screenshot(path=os.path.join(OUT, f"{style}_level1_pc.png"))
            await ctx.close()
        check("no page errors", not errs, "; ".join(errs[:4]))
        await b.close()
    print(f"{sum(results)}/{len(results)} passed; screenshots in {OUT}")
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
