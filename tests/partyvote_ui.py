"""Party votes on the road, two phones: the leader meets something, the member gets the same window and votes,
the voter's face pops up by their pick on both phones, a changed vote moves the face, and only the leader's tap acts
(the member's window closes and they hear the pick). Road events and encounters.
Usage: python3 partyvote_ui.py PORT   (serve game/ first: python3 -m http.server PORT --directory ../game)"""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_partyvote")
os.makedirs(OUT, exist_ok=True)
results = []
def check(name, cond, extra=""):
    results.append(bool(cond)); print(("ok  " if cond else "FAIL"), name, extra)

async def wait_for(pg, js, tries=20, gap=500):
    for _ in range(tries):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(gap)
    return False

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None), args=["--no-sandbox"])
        errs = []
        for style in (os.environ.get("STYLES") or "ink").split(","):
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + tag + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=pv{style}{tag}"); await pg.wait_for_timeout(1800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
                await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
                return pg
            async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame').forEach(m => m.remove())")
            async def tap(pg, act, extra=""):
                await pg.evaluate(f"() => {{ const s = document.querySelector('#side'); const b = document.createElement('button'); b.dataset.act = '{act}'; {extra} s.appendChild(b); b.click(); b.remove(); }}")
            A = await phone("A", "Alfa"); B = await phone("B", "Beta")
            here = "(pl) => { const S = window.__dbg.save(); S.location = pl; [S.x, S.y] = WORLD.places[pl].slice(0, 2); S.trip = null; S.level = 14; S.hpBonus = 80; G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); }"
            for pg in (A, B): await pg.evaluate(here, "Whiterun")
            ida, idb = [await pg.evaluate("window.__dbg.save().id") for pg in (A, B)]
            await A.evaluate(f"() => Store.put('parties', 'pv{style}', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}], invites: [], t: G.now() }})")
            ok = await wait_for(A, "() => !!window.__dbg.party() && window.__dbg.others().some(o => o.name === 'Beta')") and await wait_for(B, "() => !!window.__dbg.party() && window.__dbg.others().some(o => o.name === 'Alfa')")
            check(f"[{style}] two phones in one party", ok)

            # set off together: ready check, Beta says yes, both on the road
            await tap(A, "go", "b.dataset.place = 'Riverwood';"); await A.wait_for_timeout(1200)
            await B.bring_to_front(); await clean(B); await tap(B, "ppready", "b.dataset.id = '1';")
            dep = await wait_for(A, "() => window.__dbg.save().trip?.destName === 'Riverwood'")
            fol = await wait_for(B, f"() => window.__dbg.save().trip?.follow === '{ida}'")
            check(f"[{style}] the party sets off together", dep and fol)
            posA = await A.evaluate("() => { const S = window.__dbg.save(); return [S.x, S.y]; }")
            await B.evaluate(f"() => {{ const S = window.__dbg.save(); S.x = {posA[0]}; S.y = {posA[1]}; window.__dbg.publish(); }}")
            await A.wait_for_timeout(1200)

            # 1. a road event: Beta gets the same window and votes
            await clean(A)
            started = await A.evaluate("""() => { const S = window.__dbg.save(); let ok = false;
                for (let i = 0; i < 40 && !ok; i++) { S.trip.status = 'travel'; S.trip.event = null; ok = G.startEvent(S) && G.eventChoices(S).some(c => c[0] === 'leave'); }   // a quiet one: it can be left alone
                if (!ok) return false;
                window.__dbg.openEvent(); window.__dbg.pp().leaderHalt('event', 'something by the road', S.trip.event.text || ''); return true; }""")
            check(f"[{style}] the leader meets something by the road", started)
            await B.bring_to_front()
            gotev = await wait_for(B, "() => !!document.querySelector('#modal .ppvote [data-act=ppvote]')")
            same = await B.evaluate("() => [...document.querySelectorAll('#modal [data-act=ppvote]')].map(b => b.dataset.k).join()")
            lead = await A.evaluate("() => [...document.querySelectorAll('#modal [data-act=ev]')].map(b => b.dataset.c).join()")
            check(f"[{style}] Beta sees the same event window with the same choices", gotev and same == lead, f"{same} / {lead}")
            if not gotev: print(await B.evaluate("() => JSON.stringify({ halt: window.__dbg.party()?.halt, modal: document.querySelector('#modal')?.innerText?.slice(0, 160), me: window.__dbg.save().id, trip: window.__dbg.save().trip?.status })"))
            first = "leave" if "leave" in same.split(",") else ""   # the quiet choice: move on, no fight
            if first:
                await B.click(f"#modal [data-act=ppvote][data-k='{first}']")
                await A.bring_to_front()
                chipA = await wait_for(A, f"() => !!document.querySelector('#modal [data-act=ev][data-c=\"{first}\"] .pvchip[data-uid=\"{idb}\"]')")
                check(f"[{style}] Beta's face pops up by their pick on the leader's phone", chipA)
                await A.wait_for_timeout(500)
                await A.locator("#modal .sheet").screenshot(path=os.path.join(OUT, f"{style}_leader_event.png"))
                await A.evaluate(f"() => document.querySelector('#modal [data-act=ev][data-c=\"{first}\"]')?.click()")
                await A.wait_for_timeout(600)
                await B.bring_to_front()
                closed = await wait_for(B, "() => !document.querySelector('#modal .ppvote') || document.querySelector('#modal .ppvote').dataset.round !== '1'")
                check(f"[{style}] the leader picks: Beta's window closes or moves to the next step", closed)
            # finish the event on the leader's phone
            for _ in range(6):
                if not await A.evaluate("() => window.__dbg.save().trip?.status === 'event'"): break
                await A.evaluate("() => { const b = document.querySelector('#modal [data-act=ev][data-c=leave]') || document.querySelector('#modal [data-act=ev]'); b?.click(); }"); await A.wait_for_timeout(800)
            await A.wait_for_timeout(800); await clean(A)
            await wait_for(B, "() => !document.querySelector('#modal .ppvote')", 10)
            await clean(B)

            # 2. an encounter: vote, change the vote, the leader decides
            await A.bring_to_front()
            await A.evaluate("""() => { const S = window.__dbg.save(); S.trip.status = 'travel'; const base = D.ENCOUNTERS.find(e => e.name === 'Bandit outlaw') || D.ENCOUNTERS[0];
                S.trip.status = 'encounter'; S.trip.encounter = { ...G.scaleEnemy(base, S.level), hold: 'Whiterun', danger: base.danger }; window.__dbg.publish();
                window.__dbg.openEncounter(); window.__dbg.pp().leaderHalt('encounter', S.trip.encounter.name, S.trip.encounter.text); }""")
            await B.bring_to_front()
            gotenc = await wait_for(B, "() => !!document.querySelector('#modal .ppvote [data-act=ppvote][data-k=fight]')")
            txt = await B.evaluate("() => document.querySelector('#modal h2')?.textContent || ''")
            check(f"[{style}] Beta gets the encounter window", gotenc and txt, txt)
            await B.click("#modal [data-act=ppvote][data-k=fight]")
            chipB = await wait_for(B, f"() => !!document.querySelector('#modal [data-k=fight] .pvchip[data-uid=\"{idb}\"]')")
            check(f"[{style}] Beta's own window shows their face by Fight", chipB)
            await A.bring_to_front()
            chipA = await wait_for(A, f"() => !!document.querySelector('#modal [data-act=enc][data-a=fight] .pvchip[data-uid=\"{idb}\"]')")
            check(f"[{style}] the leader sees Beta's face by Fight", chipA)
            # change of mind: the face moves
            await B.bring_to_front(); await B.click("#modal [data-act=ppvote][data-k=flee]")
            moved = await wait_for(A, f"() => !!document.querySelector('#modal [data-a=flee] .pvchip[data-uid=\"{idb}\"]') && !document.querySelector('#modal [data-a=fight] .pvchip')")
            check(f"[{style}] Beta changes their vote: the face moves to Flee", moved)
            await B.click("#modal [data-act=ppvote][data-k=fight]")
            await wait_for(A, f"() => !!document.querySelector('#modal [data-a=fight] .pvchip[data-uid=\"{idb}\"]')")
            await B.wait_for_timeout(700)
            await B.locator("#modal .sheet").screenshot(path=os.path.join(OUT, f"{style}_member_vote.png"))
            await A.bring_to_front(); await A.wait_for_timeout(500)
            await A.locator("#modal .sheet").screenshot(path=os.path.join(OUT, f"{style}_leader_vote.png"))
            # Beta's tap never acts
            check(f"[{style}] Beta's votes didn't change the leader's fight", await A.evaluate("() => window.__dbg.save().trip?.status === 'encounter'"))
            # the leader decides (Beta keeps a note of every message that shows up)
            await B.evaluate("() => { window.__toasts = []; const t = document.querySelector('#toast') || (() => { window.__dbg.toast(' '); return document.querySelector('#toast'); })(); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); }")
            await A.evaluate("() => document.querySelector('#modal [data-act=enc][data-a=fight]')?.click()")
            await B.bring_to_front()
            gone = await wait_for(B, "() => !document.querySelector('#modal .ppvote')")
            await B.wait_for_timeout(400)
            heard = await B.evaluate("() => (window.__toasts || []).join(' | ')")
            check(f"[{style}] the leader picks Fight: Beta's window closes and they hear it", gone and "chose" in heard, heard)
            await ctx.close()
        await b.close()
        bad = [e for e in errs if "ResizeObserver" not in e]
        check("no page errors", not bad, "; ".join(bad[:3]))
        print(f"{sum(results)}/{len(results)} ok · shots in {OUT}")
        sys.exit(0 if all(results) else 1)

asyncio.run(main())
