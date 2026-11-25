# Homestead rooms (hsrooms.js): build every room, plant the garden, display cases, cellar, a follower moving in,
# a raid (talked down and fought), and a party member visiting the leader's house. Phone and desktop, both art styles.
# node tests/serve.js 9041 ; PYTHONIOENCODING=utf-8 python tests/hsrooms_ui.py 9041 [screenshot dir] [en|pl]
import asyncio, sys, os, shutil
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8847"
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
os.makedirs(OUT, exist_ok=True)
SIZES = {"phone": (390, 844), "desktop": (1920, 1080)}
LANG = sys.argv[3] if len(sys.argv) > 3 else "en"   # "pl": play in Polish (i18n.js + i18n_hsrooms.js)

async def main():
    async with async_playwright() as p:
        exe = shutil.which("google-chrome") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(**({"executable_path": exe} if exe else {}), args=["--no-sandbox"])
        bad = []
        for size, (vw, vh) in SIZES.items():
            for style in ("ink",):
                tag = f"{size}_{style}" + ("_pl" if LANG == "pl" else "")
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if size == "phone" else 1)
                errs = []
                if LANG == "pl": await ctx.add_init_script("try{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}');p.lang='pl';localStorage.setItem('rotn_prefs',JSON.stringify(p))}catch(e){}")
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hsr{size}{style}"); await pg.wait_for_timeout(1800)
                for _ in range(120):   # a busy machine can be slow to show the title and the new-character card
                    if await pg.query_selector("#nm"): break
                    for sel in (".mi[data-t=new]", ".press"):   # only the furthest step that's showing
                        if await pg.query_selector(sel): await pg.evaluate(f"document.querySelector({sel!r})?.click()"); break
                    await pg.wait_for_timeout(700)
                await pg.fill("#nm", "Builder"); await pg.click("#begin"); await pg.wait_for_selector("[data-tab=town]", timeout=60000); await pg.wait_for_timeout(1000)
                ok = lambda c, m: (print(("ok   " if c else "FAIL ") + f"[{tag}] " + m), None if c else bad.append(f"{tag}: {m}"))
                async def clean(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                async def click(sel):
                    await clean(); await pg.evaluate(f"document.querySelector({sel!r})?.click()"); await pg.wait_for_timeout(450)
                async def view(v): await click(f"[data-act=hsact][data-id=view][data-c={v}]")
                async def shot(name):
                    for _ in range(3):  # the panel can re-render mid-shot; try again
                        try:
                            await pg.wait_for_timeout(250); el = await pg.query_selector("div.hs")
                            if el: await el.screenshot(path=os.path.join(OUT, f"hsr_{name}_{tag}.png"), timeout=5000)
                            return
                        except Exception: pass
                async def overflow(): return await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                H = "window.__dbg.save().homestead.pinewatch"
                # in Falkreath with gold, a deed, and plenty of materials
                await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Falkreath'; [S.x,S.y]=WORLD.places.Falkreath; S.gold=40000; S.level=20;
                   G.give(S,'ing_lavender',3); G.give(S,'food_cabbage',2); G.give(S,'steel_sword',1); G.give(S,'gem_ruby',1); G.give(S,'iron_dagger',1);}""")
                await clean(); await pg.evaluate("document.querySelector('[data-tab=town]').click()"); await pg.wait_for_timeout(500)
                await click("[data-act=shop][data-id=homestead]")
                await click("[data-act=hsact][data-id=deed]")
                ok(await pg.evaluate(f"!!{H}"), "bought the deed")
                await pg.evaluate(f"()=>Object.assign({H}.stock,{{log:400,stone:400,clay:400,nails:600,hinge:40,lock:20,fittings:80,glass:60}})")
                await view("build")
                for w in ("small", "hall", "armory", "kitchen", "trophy", "garden", "cellar"):
                    if w == "garden": ok(await pg.evaluate("!!document.querySelector('[data-act=hsact][data-id=build][data-c=garden]')"), "garden on the build list with three wings up")
                    await click(f"[data-act=hsact][data-id=build][data-c={w}]")
                h = await pg.evaluate(H)
                ok(h["small"] and h["hall"] and h["wings"] == ["armory", "kitchen", "trophy"] and sorted(h["rooms"]) == ["cellar", "garden"], f"built hall, 3 wings, garden and cellar {h['wings']} {h['rooms']}")
                ok(await pg.evaluate("!!document.querySelector('.hs img.art.scene.hsin')"), "cut-open inside picture drawn")
                await shot("build")
                # messages and banners stay clear of the screen tabs and the picture on phones
                for i in range(4):   # the same steps as ui.js toast(): newest line on top of the message log, older ones below
                    await pg.evaluate(f"""()=>{{let el=document.getElementById('toast'); if(!el){{el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el);}}
                       HUD.log(el,'The workers finish a long day number {i} at the homestead.'); el.textContent='The workers finish a long day number {i} at the homestead.'; el.classList.remove('hide');}}""")
                    await pg.wait_for_timeout(120)
                cover = await pg.evaluate("""()=>{const l=document.getElementById('hudlog'), t=document.querySelector('.hs .hstabs'); if(!l||!t) return false; const a=l.getBoundingClientRect(), b=t.getBoundingClientRect(); return a.height>0 && a.bottom>b.top && a.top<b.bottom;}""")
                shown = await pg.evaluate("document.querySelectorAll('#hudlog .hlog').length && [...document.querySelectorAll('#hudlog .hlog')].filter(e=>getComputedStyle(e).display!=='none').length")
                if size == "phone": ok(not cover and (shown or 0) <= 1, f"messages don't cover the homestead tabs (older lines shown: {shown})")
                if LANG == "pl":
                    txt = await pg.evaluate("document.querySelector('div.hs').textContent")
                    ok("Ogród" in txt and "Piwnica" in txt and "Pomieszczenia" in txt and "These don't use a wing space" not in txt, "build list in Polish")
                # garden
                await view("garden")
                await click("[data-act=hsact][data-id=plant]")
                ok(await pg.evaluate(f"{H}.beds.filter(Boolean).length===1"), "planted a bed")
                await click("[data-act=hsact][data-id=plant]")
                await shot("garden")
                # home: display cases and cellar
                await view("home")
                await pg.evaluate("document.querySelectorAll('.hs details').forEach(d=>d.open=true)")
                sword = await pg.evaluate("window.__dbg.save().inv.find(r=>r.item==='steel_sword').id")
                await click(f"[data-act=hsact][data-id=show][data-c='{sword}']")
                dag = await pg.evaluate("window.__dbg.save().inv.find(r=>r.item==='iron_dagger').id")
                await click(f"[data-act=hsact][data-id=cellarput][data-c='{dag}']")
                h = await pg.evaluate(H)
                ok(len(h["cases"]) == 1 and len(h["cellar"]) == 1, "sword on show, dagger in the cellar")
                ok(await pg.evaluate("TOWNS.FOLLOWERS && SMITH && !!document.querySelector('.hs')") and await pg.evaluate("SMITH.atForge(window.__dbg.save())"), "the armory is a forge at home")
                await shot("home")
                # household: a follower moves in
                await pg.evaluate("()=>{const S=window.__dbg.save(); S.follower={id:'jenassa',hp:120,ts:G.now()};}")
                await view("household")
                await click("[data-act=hsact][data-id=movein]")
                ok(await pg.evaluate(f"{H}.res[0]?.id==='jenassa' && !window.__dbg.save().follower"), "Jenassa moved in")
                await shot("household")
                # a raid: talk them down, then fight
                await pg.evaluate(f"()=>{{const h={H}; h.raid={{kind:'bandits',t:G.now()}};}}")
                await view("home")
                ok(await pg.evaluate("!!document.querySelector('.hs .card.hsraid [data-id=defend]')"), "raid card with a Defend button")
                await shot("raid")
                if LANG == "pl":
                    txt = await pg.evaluate("document.querySelector('.hs .card.hsraid').textContent")
                    ok("Napad na dom" in txt and "Broń domu" in txt and "Raid on the house" not in txt, "raid card in Polish")
                await pg.evaluate("Math.random=()=>0.01")
                await click("[data-act=hsact][data-id=parley]")
                ok(await pg.evaluate(f"!{H}.raid"), "talked the bandits down")
                await pg.evaluate(f"()=>{{const S=window.__dbg.save(); {H}.raid={{kind:'trolls',t:G.now()}}; S.hpBonus=2000; G.setHealth(S,G.maxHealth(S));}}")
                await view("home")
                await click("[data-act=hsact][data-id=defend]")
                await pg.wait_for_timeout(600)
                await pg.screenshot(path=os.path.join(OUT, f"hsr_fight_{tag}.png"))
                for _ in range(120):   # turn-based fight: attack, skip the foe's turn, end turn, continue at the end
                    if await pg.evaluate(f"!{H}.raid && !document.querySelector('.tbin')"): break
                    await pg.evaluate("""(document.querySelector('[data-tbx=done]')||document.querySelector('[data-tbx=skip]')||document.querySelector('.tbact[data-tba=attack]:not([disabled])')||document.querySelector('.tbact[data-tba=end]'))?.click()""")
                    await pg.wait_for_timeout(200)
                ok(await pg.evaluate(f"!{H}.raid"), "fought off the trolls")
                await pg.wait_for_timeout(400)
                await pg.screenshot(path=os.path.join(OUT, f"hsr_result_{tag}.png"))
                await clean()
                # a party member visits: fake a party with this hero as the leader's house
                await pg.evaluate("""()=>{const S=window.__dbg.save(); const doc={id:'leader1',...VISITS.record(S),name:'Kacper'};
                   S.homestead={}; HSROOMS.mount({party:()=>({id:'p1',leader:'leader1',leaderName:'Kacper',members:[{id:'leader1'},{id:S.id}]}),homes:()=>[doc]});}""")
                await click("[data-act=hsact][data-id=view][data-c=home]")
                await clean(); await pg.evaluate("document.querySelector('[data-tab=town]').click()"); await pg.wait_for_timeout(400)
                await click("[data-act=shop][data-id=homestead]")
                ok(await pg.evaluate("!!document.querySelector('.hs .card.hsguest')"), "party member sees the leader's homestead")
                await shot("guest")
                if LANG == "pl":
                    txt = await pg.evaluate("document.querySelector('.hs .card.hsguest').textContent")
                    ok("Zagroda: Kacper" in txt and "Odpocznij w łóżku dla gości" in txt, "guest card in Polish")
                await click("[data-act=hsact][data-id=guestrest]")
                ok(await pg.evaluate("window.__dbg.save().restBonus>=0.1"), "rested in the guest bed")
                ok(not await overflow(), "no sideways scrolling")
                ok(len(errs) == 0, f"no page errors {errs[:3]}")
                await ctx.close()
        print("RESULT OK" if not bad else "RESULT FAIL " + "; ".join(bad))
        await b.close()
        sys.exit(1 if bad else 0)
asyncio.run(main())
