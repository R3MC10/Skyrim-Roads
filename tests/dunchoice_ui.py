"""Dungeon room choices (dunchoice.js): at a fork every way is a card with the room's painting, its name, how risky it
is, what it pays and what comes after it. Solo on a phone (390x844) and on PC (1920x1080), then a two-phone party vote
where the same cards carry the voters' faces and a live vote count per way, with the leader's tie rule spelled out.
Usage: py dunchoice_ui.py PORT   (serve game/ first: node serve.js PORT game)
Screenshots go to OUT (default tests/out_dunchoice)."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_dunchoice")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
results = []
def check(name, cond, extra=""):
    results.append(bool(cond)); print(("ok  " if cond else "FAIL"), name, extra)

async def wait_for(pg, js, tries=24, gap=500):
    for _ in range(tries):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(gap)
    return False

# a known map: a fight, an elite fight and a treasure room at the first fork, each leading somewhere different
ROWS = [[{"type": "fight", "links": [0]}, {"type": "elite", "links": [0, 1]}, {"type": "treasure", "links": [1]}],
        [{"type": "rest", "links": [0]}, {"type": "trap", "links": [0]}], [{"type": "puzzle", "links": [0]}], [{"type": "boss", "links": []}]]
PLACE = "Bleak Falls Barrow"
SETUP = """(pl) => { const S = window.__dbg.save(); S.location = pl; [S.x, S.y] = WORLD.places[pl].slice(0, 2); S.trip = null; S.level = 14; S.cleared = {};
  if (!S.discovered.includes(pl)) S.discovered.push(pl); G.setHealth(S, G.maxHealth(S) * 0.4); S.dungeon = null; window.__dbg.publish(); }"""

async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall,#obtip,.intro').forEach(m => m.remove())")
async def tap(pg, act):
    await pg.evaluate(f"() => {{ const s = document.querySelector('#side') || document.body; const b = document.createElement('button'); b.dataset.act = '{act}'; s.appendChild(b); b.click(); b.remove(); }}")
async def pics(pg):
    try: await pg.wait_for_function("(() => [...document.querySelectorAll('#dun .dchoice .dcpic img')].every(i => i.complete && i.naturalWidth > 0))()", timeout=6000)
    except Exception: pass
    await pg.wait_for_timeout(400)

async def solo(b, errs):
    for tag, vp in (("phone", {"width": 390, "height": 844}), ("pc", {"width": 1920, "height": 1080})):
        ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == "phone" else 1)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?assets&notut&p=dc{tag}"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Solo"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await clean(pg); await pg.evaluate(SETUP, PLACE); await clean(pg)
        await tap(pg, "enter"); await pg.wait_for_timeout(500)
        await pg.evaluate("(rows) => { const d = window.__dbg.save().dungeon; d.rows = rows; }", ROWS)
        await clean(pg); await tap(pg, "dun"); await pics(pg)
        cards = await pg.evaluate("""() => [...document.querySelectorAll('#dun .dchoice[data-act=droom]')].map(c => ({ k: c.dataset.c, t: c.dataset.type,
            pic: !!c.querySelector('.dcpic img'), name: c.querySelector('.dcname')?.textContent || '', risk: c.querySelector('.dcrisk')?.textContent || '',
            gain: c.querySelector('.dcgain')?.textContent || '', then: c.querySelector('.dcthen')?.textContent || '' }))""")
        check(f"[{tag}] three way cards at the fork", len(cards) == 3, str([c["t"] for c in cards]))
        check(f"[{tag}] every card has a room picture", cards and all(c["pic"] for c in cards))
        check(f"[{tag}] every card names the room, its risk and its reward", cards and all(c["name"] and c["risk"] and c["gain"] for c in cards), str(cards[:1]))
        el = next((c for c in cards if c["t"] == "elite"), None)
        check(f"[{tag}] the tough fight warns it's high risk", el and "High" in el["risk"], el and el["risk"])
        check(f"[{tag}] each card says what comes after it", cards and all(c["then"] for c in cards) and "Rest" in cards[0]["then"], str([c["then"] for c in cards]))
        rest = await pg.evaluate("() => !!document.querySelector('#dun .dchoice')")
        check(f"[{tag}] no old plain buttons left", rest and not await pg.evaluate("() => [...document.querySelectorAll('#dun .dcol [data-act=droom]')].some(b => !b.classList.contains('dchoice') && !b.classList.contains('dschip'))"))
        over = await pg.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#dun .dchoice')].some(c => c.scrollWidth > c.clientWidth + 2)")
        check(f"[{tag}] nothing spills sideways", not over)
        await pg.screenshot(path=os.path.join(OUT, f"solo_{tag}.png"))
        if tag == "phone":
            box = await pg.query_selector("#dun .dcol .card:has(.dchoice)")
            if box: await box.screenshot(path=os.path.join(OUT, f"solo_{tag}_cards.png"))
        # tapping a card walks into that room
        await pg.click("#dun .dchoice[data-c='1']"); await pg.wait_for_timeout(500)
        t = await pg.evaluate("() => window.__dbg.save().dungeon?.room?.type")
        check(f"[{tag}] tapping the tough-fight card goes there", t == "elite", str(t))
        await ctx.close()

async def party(b, errs):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    async def phone(tag, name):
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append("party " + tag + " " + str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=dcv{tag}"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await clean(pg)
        return pg
    A = await phone("A", "Alfa"); B = await phone("B", "Beta")
    for pg in (A, B): await pg.evaluate(SETUP, PLACE)
    ida, idb = [await pg.evaluate("window.__dbg.save().id") for pg in (A, B)]
    check("[party] two phones see each other", await wait_for(A, "() => window.__dbg.others().some(o => o.name === 'Beta')"))
    run_id = await A.evaluate(f"""async (rows) => {{ const S = window.__dbg.save(); const r = COOP.newRun(S); if (r.err) return r.err; r.doc.rows = rows;
        r.doc.members.push({{ id: '{idb}', name: 'Beta', level: 14 }}); r.doc.status = 'in'; await Store.put('runs', r.id, r.doc); return r.id; }}""", ROWS)
    check("[party] co-op run opened", isinstance(run_id, str) and run_id.startswith("run-"), str(run_id))
    for pg in (A, B):
        await wait_for(pg, f"() => (window.__dbg.coopRuns() || []).some(r => r.id === '{run_id}')")
        await pg.evaluate(f"() => {{ const r = window.__dbg.coopRuns().find(r => r.id === '{run_id}'); return COOP.join(window.__dbg.save(), r); }}")
        await clean(pg); await tap(pg, "dun")
    got = [await wait_for(pg, "() => !!document.querySelector('#dun .pvote .dchoice[data-act=pvv]')") for pg in (A, B)]
    check("[party] both phones get the vote as way cards", all(got))
    info = await B.evaluate("() => [...document.querySelectorAll('#dun .pvote .dchoice')].map(c => !!c.querySelector('.dcpic img') + '|' + (c.querySelector('.dcrisk')?.textContent || ''))")
    check("[party] vote cards keep the picture and the risk", len(info) == 3 and all(x.startswith("true|") and len(x) > 5 for x in info), str(info))
    tie = await B.evaluate("() => document.querySelector('#dun .pvote .pvrule')?.textContent || ''")
    check("[party] the vote says how it's decided (majority, tie to the leader)", "leader" in tie.lower() and "most" in tie.lower(), tie)
    await B.bring_to_front(); await B.click("#dun .pvote .dchoice[data-k='2']")
    await A.bring_to_front()
    face = await wait_for(A, f"() => !!document.querySelector('#dun .pvote .dchoice[data-k=\"2\"] .pvchip[data-uid=\"{idb}\"]')")
    check("[party] Beta's face shows on the treasure card on the leader's phone", face)
    cnt = await wait_for(A, "() => (document.querySelector('#dun .pvote .dchoice[data-k=\"2\"] .pvn')?.textContent || '').includes('1')")
    lead = await A.evaluate("() => document.querySelector('#dun .pvote .dchoice[data-k=\"2\"]')?.classList.contains('pvlead')")
    check("[party] the treasure card counts 1 vote and leads", cnt and lead)
    zero = await A.evaluate("() => document.querySelector('#dun .pvote .dchoice[data-k=\"0\"] .pvn')?.textContent || ''")
    check("[party] a way nobody picked shows no votes yet", "0" in zero or zero == "", zero)
    await A.wait_for_timeout(400); await clean(A)
    await A.screenshot(path=os.path.join(OUT, "party_leader_phone.png"))
    box = await A.query_selector("#dun .pvote")
    if box: await box.screenshot(path=os.path.join(OUT, "party_leader_vote.png"))
    await B.bring_to_front(); await clean(B); await B.wait_for_timeout(300)
    await B.screenshot(path=os.path.join(OUT, "party_member_phone.png"))
    # the leader picks another way: 1-1, a tie: the leader's pick wins
    await A.bring_to_front(); await A.click("#dun .pvote .dchoice[data-k='1']")
    moved = await wait_for(A, "() => !!window.__dbg.save().dungeon?.room", tries=30)
    col = await A.evaluate("() => window.__dbg.save().dungeon?.col")
    check("[party] a 1-1 tie goes the leader's way", moved and col == 1, f"col {col}")
    same = await wait_for(B, "() => window.__dbg.save().dungeon?.room && window.__dbg.save().dungeon.col === 1", tries=30)
    check("[party] Beta walks into the same room", same)
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        errs = []
        await solo(b, errs)
        await party(b, errs)
        bad = [e for e in errs if "ResizeObserver" not in e]
        check("no page errors", not bad, "; ".join(bad[:4]))
        await b.close()
    print(f"{sum(results)}/{len(results)} passed; screenshots in {OUT}")
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
