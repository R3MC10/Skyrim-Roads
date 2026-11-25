"""Player-run holds (holdrule.js, holdui.js) in the browser: phone (390x844) and PC (1280x800), ink art (LANG_UI=pl for Polish).
Usage: python holds_ui.py PORT -> RESULT OK
Founds a clan, gives it war points in Whiterun, opens Social -> Realm -> Holds and checks the challenge button,
plays the claim (the seat appears), then as acting Jarl sets the tax and spends the treasury, votes, picks a hold another
clan rules (raid button with its reason), and checks the town line in Whiterun. On a PC the screen fits one screen.
Screenshots: tests/out_holds/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
LANG = os.environ.get("LANG_UI", "en")
W = {"en": {"chal": "Challenge the champion", "jarl": "You are the Jarl", "raid": "Raid the hold", "ruled": "is ruled by"},
     "pl": {"chal": "Wyzwij czempiona", "jarl": "Jesteś jarlem", "raid": "Najedź twierdzę", "ruled": "rządzi"}}[LANG]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_holds") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """() => { ART.setStyle && ART.setStyle('ink'); const S = window.__dbg.save(); S.gold = 5000; S.level = 24; S.trip = null; S.dungeon = null;
  S.location = 'Whiterun'; [S.x, S.y] = WORLD.places['Whiterun']; G.setHealth(S, G.maxHealth(S));
  const C = CLANS.COLORS, mine = { ...CLANS.found(S, 'Sons of the North', 'SONS', [C[0], C[6]]).clan, id: S.id, invites: ['M2'] };
  const rav = { ...CLANS.found({ id: 'RV1', name: 'Xeno' }, 'Ravens', 'RAVN', [C[1], C[7]]).clan, id: 'RV1', invites: [] };
  S.clan = S.id;
  Store.put('clans', S.id, mine); Store.put('clans', 'RV1', rav);
  Store.put('clanmem', S.id, { id: S.id, clan: S.id, name: S.name }); Store.put('clanmem', 'RV1', { id: 'RV1', clan: 'RV1', name: 'Xeno' });
  Store.put('clanmem', 'M2', { id: 'M2', clan: S.id, name: 'Beta' });
  CLANS.set([mine, rav], [{ id: S.id, clan: S.id, name: S.name }, { id: 'RV1', clan: 'RV1', name: 'Xeno' }, { id: 'M2', clan: S.id, name: 'Beta' }]);
  S.war = { week: WARS.week(), h: { Whiterun: 14 } }; WARS.setDocs(null, S);
  const t = HOLDRULE.now() - 3600e3;
  const xeno = { uid: 'RV1', name: 'Xeno', acts: [{ k: 'claim', h: 'The Rift', c: 'RV1', t: t - 86400e3, win: true }], votes: {}, paid: {}, jarl: {}, spends: [], purse: 0, t };
  Store.put('holds', 'RV1', xeno); HOLDRULE.setDocs([xeno], S);
  window.__dbg.publish(); return Store.online + ':' + !!CLANS.of(S.id, S); }"""
CLAIM = """() => { const S = window.__dbg.save(), h = HOLDRULE.st(S);
  CLANS.set(null, [{ id: S.id, clan: S.id, name: S.name }, { id: 'RV1', clan: 'RV1', name: 'Xeno' }, { id: 'M2', clan: S.id, name: 'Beta' }]);   // a second member to vote for   // the claim as if the fight was won (the fight itself is covered by test_holds.js)
  h.acts.push({ k: 'claim', h: 'Whiterun', c: S.id, t: HOLDRULE.now() - 60e3, win: true }); HOLDRULE.setDocs(null, S);
  const seat = HOLDRULE.seatOf('Whiterun', HOLDRULE.now(), S), key = HOLDRULE.seatKey(seat);
  const z = { uid: 'Z9', name: 'Zed', acts: [], votes: {}, paid: { [key]: 1400 }, jarl: {}, spends: [], purse: 0, t: HOLDRULE.now() };   // an outsider who shopped here
  Store.put('holds', 'Z9', z); HOLDRULE.setDocs([...HOLDRULE.docs.filter((d) => d.uid !== S.id), z], S);
  window.__dbg.publish(); return seat ? seat.clan.tag + ':' + HOLDRULE.treasury(seat, HOLDRULE.now(), S).balance : 'none'; }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for dev, vp, touch in [d for d in [("phone", {"width": 390, "height": 844}, True), ("pc", {"width": 1280, "height": 800}, False)] if d[0] in os.environ.get("DEVS", "phone,pc")]:
            name = dev + ("" if LANG == "en" else "_" + LANG)
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if touch else 1, has_touch=touch)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'ink',obTips:false,lang:'{LANG}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
            for _ in range(8):   # python's test server sometimes drops a script under load: load the page again
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hr{name}"); await pg.wait_for_timeout(2000)
                if await pg.evaluate("() => { try { return typeof Store !== 'undefined' && typeof HOLDUI !== 'undefined' && typeof DUNGEONS !== 'undefined' && !!document.querySelector('.press'); } catch { return false; } }"): break
            errs.clear()
            await pg.wait_for_selector(".press", timeout=60000); await pg.click(".press")
            await pg.wait_for_selector(".mi[data-t=new]", timeout=30000); await pg.click(".mi[data-t=new]")
            await pg.wait_for_selector("#nm", timeout=30000); await pg.fill("#nm", "Holdtest"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.add_style_tag(content="#pbanners,.pban,.pburst,.pgold,.toast,#toast{display:none!important}")
            res = await pg.evaluate(SETUP)
            ok(res == "true:true", f"{name}: online with a clan ({res})")
            async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame,.obtip,.toast,#toast,.pban').forEach(m => m.remove())")
            async def realm():
                await clean(); await pg.evaluate("() => window.__ui.jump({ tab: 'social', soc: 'realm' })"); await pg.wait_for_timeout(700)
                await pg.evaluate("() => document.querySelector('.hr-panel')?.scrollIntoView({ block: 'start' })"); await pg.wait_for_timeout(300)
            async def shot(fn, sel=None):
                await pg.wait_for_timeout(400); await clean()
                if sel: await pg.evaluate(f"() => document.querySelector(\"{sel}\")?.scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT + fn)
            # 1. the Holds screen: nobody rules Whiterun yet, the challenge is open
            await realm()
            ok(await pg.query_selector(".hr-panel") is not None, f"{name}: Holds panel in Social -> Realm")
            ok(await pg.evaluate("() => document.querySelectorAll('.hr-row').length") == 9, f"{name}: nine holds listed")
            btn = await pg.query_selector("[data-hact=fight]")
            txt = (await btn.text_content()) if btn else ""
            ok(btn is not None and W["chal"] in txt and not await btn.is_disabled(), f"{name}: challenge button on ({txt})")
            ok(await pg.query_selector(".hr-detail img.hr-keep") is not None, f"{name}: ink keep picture")
            await shot(f"{name}_1_claim.png")
            if dev == "pc":
                box = await pg.evaluate("() => { const r = document.querySelector('.hr-grid').getBoundingClientRect(); const d = document.querySelector('.hr-detail').getBoundingClientRect(); return [Math.round(r.height), Math.round(d.left - r.left)]; }")
                ok(box[0] <= 800 and box[1] > 200, f"{name}: two columns that fit one screen (height {box[0]}, detail at x+{box[1]})")
            # 2. the claim: the seat appears, we're acting Jarl
            res = await pg.evaluate(CLAIM)
            ok(res.startswith("SONS:"), f"{name}: Whiterun ruled by SONS, treasury {res}")
            await realm()
            body = await pg.evaluate("document.body.textContent")
            ok(W["jarl"] in body, f"{name}: Jarl tools shown")
            # set the tax to 4% and hire guards
            await clean(); await pg.evaluate("() => document.querySelector(\"[data-hact=tax][data-id='0.04']\")?.click()"); await pg.wait_for_timeout(500)
            tax = await pg.evaluate("() => { const S = window.__dbg.save(); return HOLDRULE.taxOf(HOLDRULE.seatOf('Whiterun', HOLDRULE.now(), S), HOLDRULE.now(), S); }")
            ok(abs(tax - 0.04) < 1e-9, f"{name}: tax set to 4% ({tax})")
            await clean(); await pg.evaluate("() => document.querySelector('[data-hact=spend][data-id=guards]')?.click()"); await pg.wait_for_timeout(500)
            g = await pg.evaluate("() => { const S = window.__dbg.save(), t = HOLDRULE.now(); return HOLDRULE.effects(HOLDRULE.seatOf('Whiterun', t, S), t, S).guards; }")
            ok(g == 1, f"{name}: guards hired ({g})")
            await realm(); await shot(f"{name}_2_jarl.png", ".hr-box.jarl")
            # vote for the other member
            await clean(); await pg.evaluate("() => document.querySelector(\"[data-hact=vote][data-id=M2]\")?.click()"); await pg.wait_for_timeout(500)
            v = await pg.evaluate("() => window.__dbg.save().holdrule.votes.Whiterun?.c || [...document.querySelectorAll('[data-hact=vote]')].map((b) => b.dataset.id + (b.disabled ? '-off' : '')).join(',')")
            ok(v == "M2", f"{name}: vote cast ({v})")
            await realm(); await shot(f"{name}_3_vote.png", ".hr-box")
            # 3. a hold another clan rules: the raid button and its reason
            await clean(); await pg.evaluate("() => document.querySelector(\"[data-hact=pick][data-h='The Rift']\")?.click()"); await pg.wait_for_timeout(600)
            raid = await pg.query_selector("[data-hact=fight]")
            rt = (await raid.text_content()) if raid else ""
            why = await pg.evaluate("() => document.querySelector('.hr-act .sub')?.innerText || ''")
            ok(raid is not None and W["raid"] in rt and await raid.is_disabled(), f"{name}: The Rift shows a raid button, off: {why}")
            await pg.evaluate("() => document.querySelector('.hr-panel')?.scrollIntoView({ block: 'start' })")
            await shot(f"{name}_4_raid.png", None if dev == "pc" else ".hr-detail")
            # 4. the town line in Whiterun
            await clean(); await pg.evaluate("() => window.__ui.jump({ tab: 'town' })"); await pg.wait_for_timeout(700)
            line = await pg.evaluate("() => document.querySelector('.hr-town')?.innerText || ''")
            ok(W["ruled"] in line, f"{name}: town line: {line}")
            await shot(f"{name}_5_town.png", ".hr-town")
            over = await pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            ok(over <= 1, f"{name}: no sideways scroll ({over})")
            await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))

asyncio.run(main())
