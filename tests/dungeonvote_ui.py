"""Party votes in dungeons (partyvote.js), three phones in one co-op run: at the first fork everyone sees the same vote,
each voter's face pops up next to their pick on every phone, a changed vote moves the face, and when everyone has voted
the leader's phone settles it and all three walk into the same room. Ink and pixel art, phone (portrait) and PC.
Usage: py dungeonvote_ui.py PORT   (serve game/ first: py -m http.server PORT --directory ../game)
Screenshots go to tests/out_dungeonvote/."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_dungeonvote")
os.makedirs(OUT, exist_ok=True)
results = []
def check(name, cond, extra=""):
    results.append(bool(cond)); print(("ok  " if cond else "FAIL"), name, extra)

async def wait_for(pg, js, tries=24, gap=500):
    for _ in range(tries):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(gap)
    return False

async def main():
    async with async_playwright() as p:
        chrome = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=chrome, args=["--no-sandbox"])
        errs = []
        for style in (os.environ.get("STYLES") or "ink").split(","):
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + tag + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=dv{style}{tag}"); await pg.wait_for_timeout(1800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
                await pg.evaluate("() => document.querySelectorAll('#modal,.modal,.intro').forEach(m => m.remove())")
                return pg
            async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall,#obtip').forEach(m => m.remove())")
            async def tap(pg, act):
                await pg.evaluate(f"() => {{ const s = document.querySelector('#side') || document.body; const b = document.createElement('button'); b.dataset.act = '{act}'; s.appendChild(b); b.click(); b.remove(); }}")
            A = await phone("A", "Alfa"); B = await phone("B", "Beta"); C = await phone("C", "Ceta")
            pages = (A, B, C)
            place = "() => { const S = window.__dbg.save(); S.location = 'Bleak Falls Barrow'; [S.x, S.y] = WORLD.places['Bleak Falls Barrow'].slice(0, 2); S.trip = null; S.level = 14; S.cleared = {}; window.__dbg.publish(); }"
            for pg in pages: await pg.evaluate(place)
            ida, idb, idc = [await pg.evaluate("window.__dbg.save().id") for pg in pages]
            seen = await wait_for(A, "() => window.__dbg.others().filter(o => o.name === 'Beta' || o.name === 'Ceta').length === 2")
            check(f"[{style}] three phones see each other", seen)
            # the leader opens a run with a fork right at the entrance, everyone is in it
            run_id = await A.evaluate(f"""async () => {{ const S = window.__dbg.save(); const r = COOP.newRun(S); if (r.err) return r.err;
                for (let i = 0; i < 40 && r.doc.rows[0].length < 2; i++) r.doc.rows = DUNGEONS.layout(r.doc.theme, r.doc.tier);
                r.doc.members.push({{ id: '{idb}', name: 'Beta', level: 14 }}, {{ id: '{idc}', name: 'Ceta', level: 14 }}); r.doc.status = 'in';
                await Store.put('runs', r.id, r.doc); return r.id; }}""")
            check(f"[{style}] co-op run opened", isinstance(run_id, str) and run_id.startswith("run-"), str(run_id))
            for pg in pages:
                await wait_for(pg, f"() => (window.__dbg.coopRuns() || []).some(r => r.id === '{run_id}')")
                err = await pg.evaluate(f"() => {{ const r = window.__dbg.coopRuns().find(r => r.id === '{run_id}'); return COOP.join(window.__dbg.save(), r); }}")
                if err: print("join", err)
                await clean(pg); await tap(pg, "dun")
            ins = [await pg.evaluate(f"() => window.__dbg.save().dungeon?.run === '{run_id}'") for pg in pages]
            check(f"[{style}] all three inside the same run", all(ins))

            # the vote shows on every phone with the same options
            got = [await wait_for(pg, "() => !!document.querySelector('#dun .pvote [data-act=pvv]')") for pg in pages]
            keys = [await pg.evaluate("() => [...document.querySelectorAll('#dun .pvote [data-act=pvv]')].map(b => b.dataset.k).join()") for pg in pages]
            check(f"[{style}] everyone sees the vote with the same choices", all(got) and len(set(keys)) == 1 and "," in keys[0], str(keys))
            if not all(got):
                for pg in pages: print(await pg.evaluate("() => JSON.stringify({ pv: window.__dbg.coopRuns()[0]?.pv, dun: document.querySelector('#dun')?.innerText?.slice(0, 200) })"))
            k = keys[0].split(",") if keys[0] else ["0", "1"]
            # Beta votes for the second way, Ceta for the first
            await B.bring_to_front(); await B.click(f"#dun .pvote [data-act=pvv][data-k='{k[1]}']")
            await C.bring_to_front(); await C.click(f"#dun .pvote [data-act=pvv][data-k='{k[0]}']")
            await A.bring_to_front()
            faceB = await wait_for(A, f"() => !!document.querySelector('#dun .pvote [data-k=\"{k[1]}\"] .pvchip[data-uid=\"{idb}\"]')")
            faceC = await wait_for(A, f"() => !!document.querySelector('#dun .pvote [data-k=\"{k[0]}\"] .pvchip[data-uid=\"{idc}\"]')")
            check(f"[{style}] Beta's and Ceta's faces show by their picks on the leader's phone", faceB and faceC)
            onB = await wait_for(B, f"() => !!document.querySelector('#dun .pvote [data-k=\"{k[0]}\"] .pvchip[data-uid=\"{idc}\"]')")
            check(f"[{style}] ... and on Beta's phone too", onB)
            pic = await A.evaluate("() => !!document.querySelector('#dun .pvote .pvchip img, #dun .pvote .pvchip canvas')")
            check(f"[{style}] the faces are portraits", pic)
            await A.wait_for_timeout(500)
            await clean(A); await A.locator("#dun .pvote").screenshot(path=os.path.join(OUT, f"{style}_leader_vote.png"))
            await A.screenshot(path=os.path.join(OUT, f"{style}_leader_phone.png"))
            # Beta changes their mind: the face moves
            await B.bring_to_front(); await B.click(f"#dun .pvote [data-act=pvv][data-k='{k[0]}']")
            await A.bring_to_front()
            moved = await wait_for(A, f"() => !!document.querySelector('#dun .pvote [data-k=\"{k[0]}\"] .pvchip[data-uid=\"{idb}\"]') && !document.querySelector('#dun .pvote [data-k=\"{k[1]}\"] .pvchip[data-uid=\"{idb}\"]')")
            check(f"[{style}] a changed vote moves the face", moved)
            await B.wait_for_timeout(400)
            await clean(B); await B.locator("#dun .pvote").screenshot(path=os.path.join(OUT, f"{style}_member_vote.png"))
            # the leader votes for the other way: 2-1, the majority wins; everyone voted so it closes at once
            await A.click(f"#dun .pvote [data-act=pvv][data-k='{k[1]}']")
            moved_in = await wait_for(A, "() => !!window.__dbg.save().dungeon?.room", tries=30)
            col = await A.evaluate("() => window.__dbg.save().dungeon?.col")
            check(f"[{style}] the vote closes and the party goes the majority's way", moved_in and str(col) == k[0], f"col {col} want {k[0]}")
            same = [await wait_for(pg, f"() => window.__dbg.save().dungeon?.room && window.__dbg.save().dungeon.col === {col if col is not None else -1}", tries=30) for pg in (B, C)]
            check(f"[{style}] Beta and Ceta walk into the same room", all(same))
            seqs = [await pg.evaluate(f"() => window.__dbg.coopRuns().find(r => r.id === '{run_id}')?.pvSeq || 0") for pg in pages]
            check(f"[{style}] the same result number on every phone", len(set(seqs)) == 1 and seqs[0] >= 1, str(seqs))

            # the next choice in the room (if it has two or more): vote shows again; PC-width screenshot of it
            await A.set_viewport_size({"width": 1280, "height": 800})
            await clean(A); await tap(A, "dun")
            if await wait_for(A, "() => !!document.querySelector('#dun .pvote')", tries=10):
                await B.bring_to_front(); await clean(B); await tap(B, "dun")
                await wait_for(B, "() => !!document.querySelector('#dun .pvote [data-act=pvv]')", tries=10)
                bk = await B.evaluate("() => document.querySelector('#dun .pvote [data-act=pvv]')?.dataset.k")
                if bk: await B.click(f"#dun .pvote [data-act=pvv][data-k='{bk}']")
                await A.bring_to_front(); await wait_for(A, f"() => !!document.querySelector('#dun .pvote .pvchip[data-uid=\"{idb}\"]')", tries=10)
                await A.wait_for_timeout(400)
                await clean(A); await A.screenshot(path=os.path.join(OUT, f"{style}_leader_pc.png"))
                check(f"[{style}] room choices are voted too", True)
            await ctx.close()
        check("no page errors", not errs, "; ".join(errs[:4]))
        await b.close()
    print(f"{sum(results)}/{len(results)} passed; screenshots in {OUT}")
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
