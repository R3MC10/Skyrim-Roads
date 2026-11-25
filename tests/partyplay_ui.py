"""Party play on three phones: ready check before setting off, members follow the leader, members can't pick the way,
the leader stops for an encounter and decides, gold found on the road is split, a party dungeon is longer with more foes
per room, and a big party (7 beside you) fits in the fight scene. Usage: python3 partyplay_ui.py PORT"""
import asyncio, sys
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8850"
SHOT = _SHOTS + "pp_"
results = []
async def safe_shot(el, path):
    try: await el.screenshot(path=path)
    except Exception as e: print("shot skipped", path, str(e)[:60])
def check(name, cond, extra=""):
    results.append(bool(cond)); print(("ok  " if cond else "FAIL"), name, extra)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None), args=["--no-sandbox"])
        errs = []
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + tag + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=pp{style}{tag}"); await pg.wait_for_timeout(1800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
                await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
                return pg
            async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame').forEach(m => m.remove())")
            async def tap(pg, act, extra=""):   # press a game button the way a player would
                await pg.evaluate(f"() => {{ const s = document.querySelector('#side'); const b = document.createElement('button'); b.dataset.act = '{act}'; {extra} s.appendChild(b); b.click(); b.remove(); }}")
            A = await phone("a", "Alfa"); B = await phone("b", "Beta"); C = await phone("c", "Ceta")
            here = "(pl) => { const S = window.__dbg.save(); S.location = pl; [S.x, S.y] = WORLD.places[pl].slice(0, 2); S.trip = null; S.level = 14; S.hpBonus = 80; G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); }"
            for pg in (A, B, C): await pg.evaluate(here, "Whiterun")
            ida, idb, idc = [await pg.evaluate("window.__dbg.save().id") for pg in (A, B, C)]
            await A.evaluate(f"() => Store.put('parties', 'pp{style}', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}, {{ id: '{idc}', name: 'Ceta' }}], invites: [], t: G.now() }})")
            for _ in range(15):
                await A.wait_for_timeout(600)
                seen = await A.evaluate("() => !!window.__dbg.party() && window.__dbg.others().filter(o => ['Beta','Ceta'].includes(o.name)).length === 2")
                seenb = await B.evaluate("() => !!window.__dbg.party() && window.__dbg.others().some(o => o.name === 'Alfa')")
                seenc = await C.evaluate("() => !!window.__dbg.party() && window.__dbg.others().some(o => o.name === 'Alfa')")
                if seen and seenb and seenc: break
            check(f"[{style}] three phones in one party", seen and seenb and seenc)

            # 1. the leader picks Riverwood: a ready check, nobody leaves yet
            await tap(A, "go", "b.dataset.place = 'Riverwood';"); await A.wait_for_timeout(1500)
            st = await A.evaluate("() => ({ trip: !!window.__dbg.save().trip, rc: !!window.__dbg.party()?.ready })")
            check(f"[{style}] leader's Travel starts a ready check, not the trip", st["rc"] and not st["trip"], str(st))
            await clean(A); await A.evaluate("() => document.querySelector('.tabs [data-tab=map], [data-tab=map]')?.click()"); await A.wait_for_timeout(600)
            card = await A.query_selector(".ppcard")
            if card: await safe_shot(card, f"{SHOT}{style}_leader_check.png")
            check(f"[{style}] leader sees the ready card", card is not None)
            # members get the Ready prompt
            gotb = False
            await B.bring_to_front()   # background tabs only tick now and then on some machines
            for _ in range(10):
                await B.evaluate("() => document.querySelectorAll('#modal').forEach(m => { if (!m.querySelector('[data-act=ppready]')) m.remove(); })")   # a quest popup first: the prompt waits for it
                await B.wait_for_timeout(1100)
                gotb = await B.evaluate("() => !!document.querySelector('#modal [data-act=ppready]')")
                if gotb: break
            check(f"[{style}] Beta gets a Ready prompt", gotb)
            if not gotb: print(await B.evaluate("() => JSON.stringify({ rc: window.__dbg.party()?.ready, modal: document.querySelector('#modal')?.innerText?.slice(0, 120), pp: !!window.__dbg.pp(), me: window.__dbg.save().id })"))
            if gotb: await safe_shot(B, f"{SHOT}{style}_ready_prompt.png")
            # Beta can't pick the way meanwhile
            await clean(B); await tap(B, "go", "b.dataset.place = 'Falkreath';"); await B.wait_for_timeout(500)
            bt = await B.evaluate("() => !!window.__dbg.save().trip")
            check(f"[{style}] a member can't pick where the party goes", not bt)
            # both say yes (one from the modal, one from the card)
            await B.evaluate("() => { const S=document.querySelector('#side'); }"); await tap(B, "ppready", "b.dataset.id = '1';")
            await clean(C); await tap(C, "ppready", "b.dataset.id = '1';")
            dep = False
            for _ in range(16):
                await A.wait_for_timeout(600)
                dep = await A.evaluate("() => window.__dbg.save().trip?.destName === 'Riverwood'")
                if dep: break
            check(f"[{style}] everyone ready: the leader sets off", dep)
            fol = {}
            for _ in range(16):
                await B.wait_for_timeout(600)
                fol = {"b": await B.evaluate(f"() => window.__dbg.save().trip?.follow === '{ida}'"), "c": await C.evaluate(f"() => window.__dbg.save().trip?.follow === '{ida}'")}
                if fol["b"] and fol["c"]: break
            check(f"[{style}] Beta and Ceta follow the leader", fol.get("b") and fol.get("c"), str(fol))
            await clean(B); await B.click("[data-tab=map]"); await B.wait_for_timeout(800)
            c2 = await B.query_selector(".ppcard")
            if c2: await safe_shot(c2, f"{SHOT}{style}_following.png")
            # a follower trying to change course is refused
            await tap(B, "go", "b.dataset.place = 'Falkreath';"); await B.wait_for_timeout(400)
            check(f"[{style}] a follower keeps following", await B.evaluate("() => window.__dbg.save().trip?.destName === 'Riverwood'"))

            # 2. the leader meets something: everyone stops, the leader decides
            await A.evaluate("""() => { const S = window.__dbg.save(); const base = D.ENCOUNTERS.find(e => e.name === 'Bandit outlaw') || D.ENCOUNTERS[0];
                S.trip.status = 'encounter'; S.trip.encounter = { ...G.scaleEnemy(base, S.level), hold: 'Whiterun', danger: base.danger }; window.__dbg.publish();
                window.__dbg.pp().leaderHalt('encounter', S.trip.encounter.name, S.trip.encounter.text); }""")
            held = False
            for _ in range(12):
                await B.wait_for_timeout(500)
                held = await B.evaluate("() => window.__dbg.save().trip?.status === 'hold'")
                if held: break
            check(f"[{style}] the members stop while the leader decides", held)
            await clean(B); trip = await B.query_selector("#trip")
            if trip: await safe_shot(trip, f"{SHOT}{style}_held.png")
            # members are standing with the leader: put them right there for the fight
            posA = await A.evaluate("() => { const S = window.__dbg.save(); return [S.x, S.y]; }")
            for pg in (B, C): await pg.evaluate(f"() => {{ const S = window.__dbg.save(); S.x = {posA[0]}; S.y = {posA[1]}; window.__dbg.publish(); }}")
            await A.wait_for_timeout(1500)
            g0 = await B.evaluate("window.__dbg.save().gold")
            await clean(A); await A.evaluate("() => document.querySelector('.tabs [data-tab=map], [data-tab=map]')?.click()"); await A.wait_for_timeout(300)
            await A.evaluate("() => document.querySelectorAll('#modal').forEach(m => m.remove())"); await A.evaluate("() => document.querySelector('[data-act=openenc]')?.click()")
            await A.wait_for_timeout(300)
            await A.evaluate("() => document.querySelector('[data-act=enc][data-a=fight]')?.click()"); await A.wait_for_timeout(1500)
            log = await A.evaluate("[...document.querySelectorAll('#modal .flog div')].map(d=>d.textContent).join(' | ')")
            check(f"[{style}] the members fight beside the leader", "Beta" in log or "Ceta" in log, log[:160])
            won = await A.evaluate("() => /Victory/.test(document.querySelector('#modal h2')?.textContent || '')")
            moved = False
            for _ in range(14):
                await B.wait_for_timeout(500)
                moved = await B.evaluate("() => window.__dbg.save().trip?.status === 'travel'")
                if moved: break
            check(f"[{style}] the leader decided: the members carry on", moved)
            if won:
                gotsh = False
                for _ in range(14):
                    await B.wait_for_timeout(500)
                    gotsh = await B.evaluate("() => Object.keys(window.__dbg.save().pshares || {}).length > 0")
                    if gotsh: break
                check(f"[{style}] Beta gets their share of the fight", gotsh)

            # 3. gold found on the road is split three ways
            gb0, gc0, ga0 = [await pg.evaluate("window.__dbg.save().gold") for pg in (B, C, A)]
            msg = await A.evaluate("() => { const S = window.__dbg.save(); S.gold += 90; return window.__dbg.pp().splitGold(90, 'an old chest'); }")
            ok3 = False
            for _ in range(14):
                await B.wait_for_timeout(500)
                gb, gc = await B.evaluate("window.__dbg.save().gold"), await C.evaluate("window.__dbg.save().gold")
                if gb >= gb0 + 30 and gc >= gc0 + 30: ok3 = True; break
            ga = await A.evaluate("window.__dbg.save().gold")
            check(f"[{style}] road gold split evenly", ok3 and ga - ga0 == 30, f"{msg} | A {ga0}->{ga}")

            # 4. a party dungeon: ready check at the door, everyone in, longer, more foes
            for pg in (A, B, C): await pg.evaluate(here, "Bleak Falls Barrow")
            await A.evaluate("() => { const S = window.__dbg.save(); S.cleared = {}; }"); await B.evaluate("() => { window.__dbg.save().cleared = {}; }"); await C.evaluate("() => { window.__dbg.save().cleared = {}; }")
            await A.wait_for_timeout(1800)
            await clean(A); await tap(A, "enter"); await A.wait_for_timeout(1200)
            check(f"[{style}] Go inside asks the party first", await A.evaluate("() => window.__dbg.party()?.ready?.kind === 'dungeon' && !window.__dbg.save().dungeon"))
            for pg in (B, C):
                for _ in range(10):
                    await pg.wait_for_timeout(400)
                    if await pg.evaluate("() => !!window.__dbg.party()?.ready"): break
                await clean(pg); await tap(pg, "ppready", "b.dataset.id = '1';")
            ins = {}
            for _ in range(20):
                await A.wait_for_timeout(600)
                ins = {k: await pg.evaluate("() => window.__dbg.save().dungeon?.run || null") for k, pg in (("a", A), ("b", B), ("c", C))}
                if ins["a"] and ins["b"] == ins["a"] and ins["c"] == ins["a"]: break
            check(f"[{style}] all three go in together", ins.get("a") and ins.get("b") == ins.get("a") and ins.get("c") == ins.get("a"), str(ins))
            rows = await A.evaluate("() => window.__dbg.save().dungeon?.rows?.length || 0")
            check(f"[{style}] three heroes: the way is 4 rooms longer", rows >= 10, f"{rows} rows")
            # step into a fight room: three foes wait there
            wv = await A.evaluate("""() => { const S = window.__dbg.save(), d = S.dungeon; const opts = d.rows[0].map((n, i) => [n.type, i]); const f = opts.find(o => o[0] === 'fight' || o[0] === 'elite');
                if (!f) { d.rows[0][0].type = 'fight'; } const col = f ? f[1] : 0;
                const b = document.createElement('button'); b.dataset.act = 'droom'; b.dataset.c = col; document.querySelector('#dun')?.appendChild(b); b.click(); b.remove();
                return 0; }""")
            for _ in range(10):
                await A.wait_for_timeout(500)
                wv = await A.evaluate("() => { const r = window.__dbg.save().dungeon?.room; return r ? r.waves || 1 : -1; }")
                if wv > 1: break
            check(f"[{style}] a fight room holds a foe per hero", wv == 3, f"waves {wv}")
            dun = await A.query_selector("#dun")
            if dun: await safe_shot(A, f"{SHOT}{style}_dungeon.png")

            # 4b. only the leader acts; the others follow; loot goes to a pile and a vote at the end
            await B.wait_for_timeout(1500)
            broom0 = await B.evaluate("() => JSON.stringify(window.__dbg.save().dungeon?.room?.enemy?.hp ?? null)")
            await B.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'dact'; b.dataset.c = 'fight'; (document.querySelector('#dun') || document.body).appendChild(b); b.click(); b.remove(); }")
            await B.wait_for_timeout(400)
            broom1 = await B.evaluate("() => JSON.stringify(window.__dbg.save().dungeon?.room?.enemy?.hp ?? null)")
            waitTxt = await B.evaluate("() => document.querySelector('#dun .lv-wait')?.innerText || ''")
            check(f"[{style}] a member can't act in the leader's room", broom0 == broom1 and "choosing" in waitTxt.lower(), f"{broom0} {broom1} | {waitTxt[:60]}")
            if "choosing" in waitTxt.lower(): await safe_shot(B, f"{SHOT}{style}_member_wait.png")
            for pg in (A, B, C): await pg.evaluate("() => { const S = window.__dbg.save(); S.hpBonus = 4000; G.setHealth(S, G.maxHealth(S)); }")
            await A.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'dact'; b.dataset.c = 'fight'; document.querySelector('#dun').appendChild(b); b.click(); b.remove(); }")
            mir = False
            for _ in range(16):
                await B.wait_for_timeout(500)
                mir = await B.evaluate("() => { const d = window.__dbg.save().dungeon; return !!d && Object.values(d.lvDone || {}).some(n => n > 0); }")
                if mir: break
            check(f"[{style}] Beta's hero follows the leader's action", mir)
            rid = await A.evaluate("window.__dbg.save().dungeon?.run")
            await A.evaluate(f"() => Store.change('runs', '{rid}', (x) => LOOTVOTE.poolAdd(x, [{{ item: 'steel_sword', qty: 1 }}, {{ item: 'elven_bow', qty: 1 }}], 30))")
            await A.wait_for_timeout(800)
            pile = await A.evaluate(f"() => window.__dbg.coopRuns().find(r => r.id === '{rid}')?.pool?.items?.length || 0")
            check(f"[{style}] loot goes to the shared pile", pile >= 2, f"{pile}")
            async def dismiss_road(pg):   # an earlier road vote can pop up first: pass on it
                for _ in range(3):
                    if await pg.evaluate("() => !!document.querySelector('#modal [data-act=lvsend][data-k^=\"lv:\"]')"):
                        await pg.evaluate("() => document.querySelector('#modal [data-act=lvsend][data-k^=\"lv:\"]').click()"); await pg.wait_for_timeout(400)
                    await pg.evaluate("() => document.querySelectorAll('#modal').forEach(m => { if (!m.querySelector('.lv-list')) m.remove(); })")
            for pg in (A, B, C): await dismiss_road(pg)
            await clean(A); await A.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'dleave'; document.querySelector('#dun').appendChild(b); b.click(); b.remove(); }")
            got = {}
            for k, pg in (("a", A), ("b", B), ("c", C)):
                ok5 = False
                for _ in range(20):
                    await pg.wait_for_timeout(600)
                    ok5 = await pg.evaluate("() => !!document.querySelector('#modal [data-act=lvsend][data-k^=\"run:\"]')")
                    if ok5: break
                    await dismiss_road(pg)
                got[k] = ok5
            check(f"[{style}] the loot vote opens for all three", all(got.values()), str(got))
            if got.get("b"): await safe_shot(B, f"{SHOT}{style}_vote.png")
            async def vote(pg, names):   # Want on the named items, then send
                for n in names:
                    await pg.evaluate("""(n) => { for (const row of document.querySelectorAll('#modal .lv-row')) if (row.innerText.includes(n)) row.querySelector('[data-act=lvpick]')?.click(); }""", n)
                    await pg.wait_for_timeout(250)
                await pg.evaluate("() => document.querySelector('#modal [data-act=lvsend][data-k^=\"run:\"]')?.click()")
            inv0 = {k: await pg.evaluate("() => { const S = window.__dbg.save(); return { sw: S.inv.filter(r => r.item === 'steel_sword').length, bow: S.inv.filter(r => r.item === 'elven_bow').length, g: S.gold }; }") for k, pg in (("a", A), ("b", B), ("c", C))}
            await vote(A, ["Steel Sword"]); await vote(B, ["Steel Sword"]); await vote(C, ["Elven Bow"])
            res = False
            for _ in range(20):
                await A.wait_for_timeout(600)
                res = await A.evaluate("() => /loot shared out/i.test(document.querySelector('#modal')?.innerText || '')")
                if res: break
            check(f"[{style}] votes in: results with dice shown", res)
            if res: await safe_shot(A, f"{SHOT}{style}_vote_result.png")
            for pg in (B, C):
                for _ in range(12):
                    if await pg.evaluate("() => /loot shared out/i.test(document.querySelector('#modal')?.innerText || '')"): break
                    await pg.wait_for_timeout(500)
            inv1 = {k: await pg.evaluate("() => { const S = window.__dbg.save(); return { sw: S.inv.filter(r => r.item === 'steel_sword').length, bow: S.inv.filter(r => r.item === 'elven_bow').length, g: S.gold }; }") for k, pg in (("a", A), ("b", B), ("c", C))}
            sw = sum(inv1[k]["sw"] - inv0[k]["sw"] for k in inv0); bow = sum(inv1[k]["bow"] - inv0[k]["bow"] for k in inv0)
            check(f"[{style}] each item delivered exactly once (sword to A or B, bow to C)", sw == 1 and bow == 1 and inv1["c"]["bow"] - inv0["c"]["bow"] == 1 and inv1["c"]["sw"] == inv0["c"]["sw"], f"{inv0} {inv1}")
            dg = {k: inv1[k]["g"] - inv0[k]["g"] for k in inv0}
            check(f"[{style}] gold split evenly (leftover to the leader)", dg["b"] == dg["c"] and dg["a"] >= dg["b"] and dg["b"] > 0, str(dg))
            for pg in (A, B, C):   # close the results like a player would
                for _ in range(3):
                    if not await pg.evaluate("() => !!document.querySelector('#modal [data-act=close]')"): break
                    await pg.evaluate("() => document.querySelector('#modal [data-act=close]').click()"); await pg.wait_for_timeout(300)
            await clean(A); await clean(B); await clean(C)

            # 5. a big party in the fight scene: 7 beside you
            await A.evaluate("""() => { const S = window.__dbg.save(); S.dungeon = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun.slice(0, 2);
                const looks = [['steel_sword','steel_armor','steel_helmet','steel_shield'],['hunting_bow','leather_armor'],['iron_war_axe','hide_armor'],['staff_flames','mage_robes'],['iron_greatsword','steel_armor'],['steel_sword','chainmail'],['iron_mace','iron_armor','iron_helmet']];
                G.setAllyProvider(() => looks.map((eq, i) => ({ name: ['Beta','Ceta','Dera','Echo','Foxa','Gala','Hilo'][i], dmg: 6, hp: 120, maxHp: 120, red: 0.2, role: 'fighter', player: true, coop: true, party: true, uid: 'x' + i,
                  look: { r: ['nord','redguard','dunmer','imperial','orc','breton','khajiit'][i], id: 'm' + i, eq: { weapon: eq[0], chest: eq[1], head: eq[2], shield: eq[3] }, gl: {} } })));
                document.querySelector('#dun')?.remove(); G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2)); const base = D.ENCOUNTERS.find(e => e.name === 'Bandit outlaw') || D.ENCOUNTERS[0];
                S.trip.status = 'encounter'; S.trip.encounter = { ...G.scaleEnemy(base, S.level), hold: 'Whiterun', danger: base.danger }; }""")
            await clean(A); await A.evaluate("() => document.querySelector('#dun')?.remove()"); await A.evaluate("() => document.querySelector('.tabs [data-tab=map], [data-tab=map]')?.click()"); await A.wait_for_timeout(300)
            await A.bring_to_front()   # background tabs only tick now and then on some machines
            for _ in range(20):   # the road bar redraws on the next tick
                if await A.evaluate("() => !!document.querySelector('[data-act=openenc]')"): break
                await A.wait_for_timeout(250)
            await A.evaluate("() => document.querySelectorAll('#modal').forEach(m => m.remove())"); await A.evaluate("() => document.querySelector('[data-act=openenc]')?.click()")
            await A.wait_for_timeout(300); await A.evaluate("() => document.querySelector('[data-act=enc][data-a=fight]')?.click()"); await A.wait_for_timeout(1200)
            sc = await A.query_selector("#modal .fscene")
            if sc:
                await safe_shot(sc, f"{SHOT}{style}_fight8.png"); await A.wait_for_timeout(1600)
                sc2 = await A.query_selector("#modal .fscene")
                if sc2: await safe_shot(sc2, f"{SHOT}{style}_fight8b.png")
                fps = await A.evaluate("""() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else r(n / 1.5); }; requestAnimationFrame(f); })""")
                print(style, "fight scene frames/s with 7 allies (busy test machine):", round(fps))
            check(f"[{style}] big-party fight scene draws", sc is not None)
            if sc is None: print("DEBUG trip:", await A.evaluate("() => JSON.stringify({ st: window.__dbg.save().trip?.status, enc: !!window.__dbg.save().trip?.encounter, btn: !!document.querySelector('[data-act=openenc]'), dun: !!document.querySelector('#dun'), fightBtn: !!document.querySelector('[data-act=enc][data-a=fight]') })"))
            if sc is None: print("DEBUG modal:", (await A.evaluate("() => [...document.querySelectorAll('#modal')].map(m => m.innerText.slice(0, 160)).join(' || ')")))
            # the travel picture with a big company
            await A.evaluate("""() => { const S = window.__dbg.save(); S.trip = null; G.setAllyProvider(() => []); }""")
            vig = await A.evaluate("""() => { if (typeof FXART === 'undefined' || !FXART.vignetteFrame) return null;
                const co = ['Beta','Ceta','Dera','Echo','Foxa','Gala','Hilo'].map((n, i) => ({ name: n, look: { r: 'nord', id: 'm' + i, eq: { weapon: 'steel_sword', chest: i % 2 ? 'steel_armor' : 'leather_armor' }, gl: {} }, player: true, riding: i === 2, horse: i === 2 ? '#8a6a44' : null }));
                co.push({ name: 'Lydia', look: PARTY.followerLook('lydia'), follower: true });
                const c = FXART.vignetteFrame({ ground: 5, progress: 0.7, look: window.__dbg.save() ? HEROART.lookOf(window.__dbg.save()) : null, company: co }, 40); return c.toDataURL(); }""")
            if vig:
                import base64
                open(f"{SHOT}{style}_company.png", "wb").write(base64.b64decode(vig.split(",")[1]))
            check(f"[{style}] travel picture with 8 walkers", vig is not None)
            await ctx.close()
        check("no page errors", not errs, str(errs[:3]))
        await b.close()
        print("RESULT", "OK" if all(results) else "FAIL")
asyncio.run(main())
