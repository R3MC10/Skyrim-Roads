"""The opening quest line (first30.js) end to end, the way a brand-new player meets it: on a phone (390x844) and on a PC (1920x1080).
Run:  node tests/serve.js 9731 game   then   python tests/first30_ui.py 9731 [outdir]
Counts the seconds and taps from the title screen to the first fight, plays every step through the goal card's one button,
takes a screenshot per step (first30_after_<size>_NN_<step>.png in outdir) and fails on page errors, sideways scrolling,
a missing goal card / button / hint, or a step that doesn't advance. Travel is fast-forwarded; fights are played by the
first-turn hints and then finished by the screen-test autoplay."""
import asyncio, os, sys, tempfile, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9731"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "first30_shots")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
SIDEWAYS = "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
GOALJS = "(()=>{const g=document.querySelector('%s'); if(!g) return ''; return (g.closest('#pcquest')||g).innerText.replace(/\\n/g,' | ');})()"
STAGE = "(()=>{const q=__dbg.save().quests||{}; const o=q.opening; return o ? (o.done ? 99 : o.stage) : -1})()"
HINTS = "[...document.querySelectorAll('#fhints .fhint:not([hidden])')].map(e=>e.innerText).join(' | ')"


async def run(b, vw, vh, tag, fails, report):
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    n = [0]; taps = [0]
    GS = "#f30pc" if vw >= 1100 else "#f30goal"   # PC: the goal sits in the quest tracker; phone: the card in the side panel
    GOAL = GOALJS % GS

    def check(cond, msg):
        if not cond: fails.append(f"{tag}: {msg}")

    async def shot(name):
        n[0] += 1
        await pg.wait_for_timeout(350)
        await pg.screenshot(path=os.path.join(OUT, f"first30_after_{tag}_{n[0]:02d}_{name}.png"))
        if await pg.evaluate(SIDEWAYS): fails.append(f"{tag} {name}: page scrolls sideways")

    async def tap(sel):
        taps[0] += 1; await pg.click(sel); await pg.wait_for_timeout(400)

    async def clear():
        for _ in range(6):
            if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
            elif await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
            else: break
        await pg.evaluate("typeof TABMENU!=='undefined' && TABMENU.closeHub?.(); document.querySelector('#sky')?.remove()")

    async def card():
        await clear()
        await pg.evaluate("(()=>{const b=document.createElement('button'); b.dataset.act='uxtab'; b.dataset.id='map'; b.hidden=true; document.querySelector('#side').appendChild(b); b.click();})()")
        await pg.wait_for_timeout(1300); await clear()
        await pg.evaluate(f"document.querySelector('{GS}')?.scrollIntoView({{block:'center'}})")
        return await pg.evaluate(GOAL)

    async def fight(teach):
        """Play the first turn by the hints (Attack, then read the foe, End turn), then let autoplay finish. A loss is a free retry."""
        for _ in range(40):
            if await pg.query_selector("#tbf .tbact"): break
            await pg.wait_for_timeout(250)
        if teach:
            # one hint at a time, each when it matters: Attack, what the foe does next, and Guard when it winds up a huge blow
            seen = {}
            for _ in range(120):
                if len(seen) == 3 or await pg.query_selector("#tbf [data-tbx=done]"): break
                h = (await pg.evaluate(HINTS)).lower()
                mine = await pg.query_selector("#tbf [data-tba=end]")
                if not mine: await pg.wait_for_timeout(300); continue
                await pg.wait_for_timeout(500); h = (await pg.evaluate(HINTS)).lower()
                k = "attack" if "tap attack" in h else "intent" if "foe does next" in h else "guard" if "huge blow" in h else "end" if h else ""
                print(tag, "hint:", k, "|", h[:70])
                if k and k not in seen and k != "end": seen[k] = 1; await pg.mouse.move(1, 1); await shot(f"fight_hint_{k}")
                if k in ("attack", "") and await pg.query_selector("#tbf [data-tba=attack]:not([disabled])"):
                    att = "#tbf [data-tba=attack]:not([disabled])" if await pg.query_selector("#tbf [data-tba=attack]:not([disabled])") else "#tbf .tbact:not(.end):not([disabled])"
                    await tap(att); await pg.wait_for_timeout(700)
                else:
                    await tap("#tbf [data-tba=end]"); await pg.wait_for_timeout(900)
            print(tag, "hints seen:", list(seen))
            check(set(seen) == {"attack", "intent", "guard"}, f"the first fight didn't teach attack, intent and guard: {list(seen)}")
            report.setdefault(tag, {})["hints"] = list(seen)
        if await pg.query_selector("#tbf .tbgrid, #tbf"):
            await pg.evaluate("(()=>{const g=document.querySelector('#tbf .tbgrid')||document.querySelector('#tbf'); if(!g) return; const b=document.createElement('button');b.dataset.tbx='autoall';g.append(b);b.click()})()")
        for _ in range(120):
            if await pg.query_selector("#tbf [data-tbx=done]"): break
            await pg.wait_for_timeout(250)
        won = await pg.evaluate("!!document.querySelector('#tbf [data-tbx=done]')?.textContent.includes('Victory')")
        await shot("fight_end")
        if await pg.query_selector("#tbf [data-tbx=done]"): await tap("#tbf [data-tbx=done]"); await pg.wait_for_timeout(900)
        return won

    async def press_goal(step, expect):
        t = await card(); print(tag, f"step {step}:", t)
        check(f"step {step} of 7" in t.lower(), f"goal card doesn't show step {step}: {t}")
        check(expect.lower() in t.lower(), f"step {step} button isn't '{expect}': {t}")
        await shot(f"step{step}")
        await tap(f"{GS} .f30b .btn")

    async def fast_travel(place):
        await pg.evaluate(f"(()=>{{const S=__dbg.save(); S.trip=null; S.location='{place}'; [S.x,S.y]=WORLD.places['{place}']; if(!S.discovered.includes('{place}')) S.discovered.push('{place}'); G.setHealth(S,G.maxHealth(S));}})()")
        await pg.wait_for_timeout(1500)

    # 0. title screen -> new hero
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&tb"); await pg.wait_for_timeout(1500)
    t0 = time.time()
    await shot("title")
    await tap(".press"); await tap(".mi[data-t=new]")
    await pg.fill("#nm", "Hrolf"); taps[0] += 1
    await shot("create")
    await tap("#begin"); await pg.wait_for_timeout(1500)
    check(not await pg.query_selector("#obtip"), "a tip popup right after making the hero")
    # 1. Trouble at the Mill: one button straight into the first fight
    await press_goal(1, "Chase off the bandit")
    for _ in range(40):
        if await pg.query_selector("#tbf"): break
        await pg.wait_for_timeout(250)
    secs = round(time.time() - t0, 1)
    check(await pg.query_selector("#tbf") is not None, "the first goal didn't start a fight")
    report.setdefault(tag, {}).update({"taps_to_fight": taps[0], "secs_to_fight": secs})
    print(tag, f"first fight after {taps[0]} taps, {secs}s (incl. test waits)")
    check(taps[0] <= 6, f"too many taps to the first fight: {taps[0]}")
    won = await fight(True)
    tries = 1
    while not won and tries < 4:
        tries += 1
        t = await card(); check("step 1 of 7" in t.lower(), "a lost opening fight moved the quest on")
        await tap(f"{GS} .f30b .btn"); won = await fight(False)
    await clear()
    check(await pg.evaluate(STAGE) == 1, f"winning the first fight didn't move to step 2 (stage {await pg.evaluate(STAGE)})")
    # 2. A Better Fit: Put it on -> the paper doll, the chest slot's picker
    await press_goal(2, "Put it on"); await pg.wait_for_timeout(700)
    await shot("doll_picker")
    eq = await pg.query_selector("[data-act=dolleq]")
    check(eq is not None, "Put it on didn't open the chest picker on the paper doll")
    if eq:
        btns = await pg.query_selector_all("[data-act=dolleq]")
        pick = None
        for x in btns:
            if "leather" in (await x.inner_text()).lower(): pick = x; break
        taps[0] += 1; await (pick or btns[0]).click(); await pg.wait_for_timeout(600)
        await shot("doll_after")
    await clear(); await pg.wait_for_timeout(3500)
    check(await pg.evaluate(STAGE) == 2, f"wearing the armour didn't move to step 3 (stage {await pg.evaluate(STAGE)})")
    # 3. On to Whiterun
    await press_goal(3, "Go to Whiterun"); await clear()
    t = await card(); print(tag, "walking:", t); check("on the way" in t.lower(), "no 'on the way' line while walking")
    await shot("walking")
    await fast_travel("Whiterun"); await clear(); await pg.wait_for_timeout(3500)
    check(await pg.evaluate(STAGE) == 3, f"arriving in Whiterun didn't move to step 4 (stage {await pg.evaluate(STAGE)})")
    # 4. The Jarl's Ear: meet him, spar with Irileth, level up
    await press_goal(4, "Warn the Jarl"); await pg.wait_for_timeout(900)
    await shot("jarl")
    await clear(); await pg.wait_for_timeout(1500)
    check(await pg.evaluate("__dbg.save().level") >= 2 or await pg.evaluate("__dbg.save().pendingLevels") > 0, "meeting the Jarl didn't give a level")
    # 5. Growing Stronger: Level up -> pick -> Pick a perk -> take one
    await press_goal(5, "Level up"); await pg.wait_for_timeout(1500)
    await shot("levelup")
    if await pg.query_selector("[data-lvk=health]"): await tap("[data-lvk=health]"); await pg.wait_for_timeout(1500)
    else: fails.append(f"{tag}: Level up didn't open the level-up picker")
    await pg.wait_for_timeout(1000); await shot("perks")
    perk = await pg.query_selector("[data-act=perk]:not([disabled])")
    if perk: taps[0] += 1; await perk.click(); await pg.wait_for_timeout(600)
    else:
        t = await card()
        if "pick a perk" in t.lower(): await tap(f"{GS} .f30b .btn"); await pg.wait_for_timeout(900); await shot("perks2")
        perk = await pg.query_selector("[data-act=perk]:not([disabled])")
        if perk: taps[0] += 1; await perk.click(); await pg.wait_for_timeout(600)
        else:
            fails.append(f"{tag}: no perk to take on the Perks screen")
            await pg.evaluate("(()=>{const S=__dbg.save(); const id=Object.keys(PERKS.ALL||PERKS.byId||{}).find(i=>PERKS.canTake(S,i)); if(id) PERKS.take(S,id);})()")
    await shot("perk_taken"); await clear(); await pg.wait_for_timeout(3500)
    check(await pg.evaluate(STAGE) == 5, f"levelling up + a perk didn't move to step 6 (stage {await pg.evaluate(STAGE)})")
    # 6. The Bandit Chief at Chillfurrow Farm
    await press_goal(6, "Go to Chillfurrow Farm"); await clear()
    await fast_travel("Chillfurrow Farm"); await clear()
    await press_goal(6, "Face the bandit chief")
    won = await fight(False); tries = 1
    while not won and tries < 4:
        tries += 1; await clear(); await tap(f"{GS} .f30b .btn") if await pg.query_selector(f"{GS} .f30b .btn") else None; won = await fight(False)
    report[tag]["chief_tries"] = tries
    await clear(); await pg.wait_for_timeout(3500)
    check(await pg.evaluate(STAGE) == 6, f"beating the chief didn't move to step 7 (stage {await pg.evaluate(STAGE)})")
    # 7. Word Spreads: back to the Jarl, the reward and what comes next
    await press_goal(7, "Go to Whiterun"); await clear()
    await fast_travel("Whiterun"); await clear()
    await press_goal(7, "See the Jarl"); await pg.wait_for_timeout(900)
    await shot("reward")
    msg = await pg.evaluate("[...document.querySelectorAll('#modal, #toast, .msg, #log')].map(e=>e.innerText).join(' | ')")
    print(tag, "reward:", msg[:300])
    await clear(); await pg.wait_for_timeout(3500)
    check(await pg.evaluate(STAGE) == 99, "the opening quest line didn't finish")
    check(await pg.evaluate("__dbg.save().trackQ") == "main", "the main quest isn't tracked after the opening")
    check(not await pg.evaluate(GOAL), "the goal card stays after the opening")
    await card(); await shot("after")
    report[tag]["taps_total"] = taps[0]
    if errs: fails.append(f"{tag} page errors: {errs[:3]}")
    await ctx.close()

    # a second hero: Skip the tutorial works and leaves the main quest
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&tb"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Skipper"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    GS = "#f30pc" if vw >= 1100 else "#f30goal"; GOAL = GOALJS % GS
    await card(); await pg.click(f"{GS} [data-f30=skip]"); await pg.wait_for_timeout(600)
    t = await card(); n[0] = 90; await shot("skipped")
    check(not t and await pg.evaluate(STAGE) == 99 and await pg.evaluate("!!__dbg.save().quests.main"), "Skip the tutorial didn't hand over to the main quest")
    if errs: fails.append(f"{tag} skip page errors: {errs[:3]}")
    await ctx.close()


async def main():
    fails = []; report = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        await run(b, 390, 844, "phone", fails, report)
        await run(b, 1920, 1080, "pc", fails, report)
        await b.close()
    print("report:", report)
    print("screenshots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("OK")

asyncio.run(main())
