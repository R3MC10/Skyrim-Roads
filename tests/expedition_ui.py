"""The Expedition Table on screen (expedition.js): Social -> Company -> Expeditions with a planning table built, one
expedition under way (the tracker), the history tab, the road event sheet and a party vote sheet.
Phone (390x844), desktop (1920x1080) and phone in Polish. Run from the repo root:
PYTHONIOENCODING=utf-8 python tests/expedition_ui.py [port] [outdir]   (default tests/out_exp/)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "tests", "out_exp"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9600, 9700):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9600-9699")

QA = "&assets" if os.environ.get("ASSETS") else ""   # ASSETS=1: load the painted art too
PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "0" else free_port()
SETUP = """async () => {
  const S = window.__dbg.save(), L = LONGHOUSE; S.level = Math.max(S.level, 14); S.trip = null; S.dungeon = null; S.location = "Whiterun"; [S.x, S.y] = WORLD.places.Whiterun;
  S.gold = 60000; S.perks = { ...(S.perks || {}), exp_leader: 1, exp_scout: 1 };
  let e = await L.found(S, "The Iron Wolves"); if (e) return "found: " + e;
  await L.deposit(S, 30000);
  const c = L.costOf("plan", 1, 1, S);
  for (const [k, q] of Object.entries(c.m)) { G.give(S, k, q); await L.giveMat(S, k, q); }
  e = await L.build(S, "plan"); if (e) return "build plan: " + e;
  const d = L.mine(S), t = Math.floor(Date.now() / 1000);
  await Store.change("longhouse", d.id, (q) => ({ ...q, members: { ...q.members, f1: { name: "Kacper", role: "officer", t: t - 50 }, f2: { name: "Sigrid", role: "member", t: t - 40 } } }));
  // two finished expeditions in the book (one from last night)
  const old = EXPEDITION.offers(d.id, EXPEDITION.dayOf() - 1);
  await Store.change("longhouse", d.id, (q) => EXPEDITION.ledgerEntry(EXPEDITION.ledgerEntry(q, old[2], S, ["Kacper", "Sigrid", S.name], t - 50000), old[0], S, [S.name], t - 9000));
  return null; }"""

async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    errs, bad, shots = [], [], []
    def check(ok, what):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok: bad.append(what)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            for vw, vh, tag, pl in [(390, 844, "phone", False), (1920, 1080, "pc", False), (390, 844, "phonePL", True)]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 800 else 1)
                if pl: await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({ lang: 'pl' }))")
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                async def shot(name, sel="#lng-root"):
                    path = os.path.join(OUT, f"expedition_{tag}_{name}.png")
                    await clear()
                    for _ in range(4):
                        try:
                            el = await pg.query_selector(sel) if sel else None
                            if el: await el.screenshot(path=path, timeout=4000)
                            else: await pg.screenshot(path=path)
                            break
                        except Exception as e: print(tag, name, "retry shot", str(e)[:60]); await pg.wait_for_timeout(300)
                    shots.append(path)
                async def tap(sel):
                    await clear(); await pg.evaluate("(s) => document.querySelector(s)?.click()", sel)
                async def table():
                    await clear(); await pg.evaluate("() => window.__ui.go('social')"); await pg.wait_for_timeout(400)
                    await tap("[data-act=soctab][data-id=company]"); await pg.wait_for_timeout(500)
                    await tap("[data-lng=tab][data-id=exp]"); await pg.wait_for_timeout(500)
                for _ in range(3):
                    await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=exp{tag}{QA}")
                    try: await pg.wait_for_selector(".press", timeout=10000); break
                    except Exception: print(tag, "title screen didn't come up, reloading")
                await pg.wait_for_timeout(800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                r = await pg.evaluate(SETUP)
                check(r is None, f"{tag}: set up ({r})")
                await pg.wait_for_timeout(6000)   # let the start-of-game toasts pass
                await table()
                n = await pg.evaluate("document.querySelectorAll('#lng-root .exp-card').length")
                check(n == 3, f"{tag}: three offer cards ({n})")
                shut = await pg.evaluate("document.querySelectorAll('#lng-root .exp-card.shut').length")
                check(shut == 0, f"{tag}: the planning table opens all three")
                over = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                check(not over, f"{tag}: the table fits the width")
                txt = await pg.evaluate("document.querySelector('#lng-root')?.textContent || ''")
                if pl: check("Stół wypraw" in txt and "Set out" not in txt and "Tonight" not in txt, f"{tag}: Polish screen")
                else: check("The Expedition Table" in txt and "fresh offers" in txt, f"{tag}: the table and the reroll button")
                await shot("offers")
                # set out on the first one (the short one), from the card
                await tap("[data-exp=go]"); await pg.wait_for_timeout(700)
                check(await pg.evaluate("!!EXPEDITION.live(window.__dbg.save())"), f"{tag}: set out from the card")
                await pg.evaluate("() => { const S = window.__dbg.save(); S.exp.ev = null; S.location = S.exp.o.steps[0].place; [S.x, S.y] = WORLD.places[S.location]; }")
                await table()
                check(await pg.evaluate("!!document.querySelector('#lng-root .exp-track [data-exp=look]')"), f"{tag}: the tracker offers Look around")
                await shot("tracker")
                await tap("[data-exp=look]"); await pg.wait_for_timeout(700)
                ev = await pg.evaluate("document.querySelectorAll('#exp-layer .exp-evo .btn').length")
                check(ev == 3, f"{tag}: the road event shows three choices ({ev})")
                check(await pg.evaluate("document.querySelectorAll('#exp-layer .exp-scout').length") == 3, f"{tag}: Seasoned Scout shows how each goes")
                await shot("event", None)
                await tap("#exp-layer [data-exp=evo]"); await pg.wait_for_timeout(600)
                check(await pg.evaluate("!!document.querySelector('#exp-layer .exp-done')"), f"{tag}: the choice is carried out")
                check(await pg.evaluate("window.__dbg.save().exp.done[0] === 1"), f"{tag}: the road step is done")
                await shot("result", None)
                await tap("#exp-layer [data-exp=ok]"); await pg.wait_for_timeout(400)
                # the history tab
                await table(); await tap("[data-exp=tab][data-k=hist]"); await pg.wait_for_timeout(400)
                check(await pg.evaluate("document.querySelectorAll('#lng-root .exp-he').length") >= 2, f"{tag}: the history lists the company's expeditions")
                await shot("history")
                await tap("[data-exp=tab][data-k=offers]"); await pg.wait_for_timeout(300)
                # a party vote: a stand-in party (the screen only; nothing is stored)
                await pg.evaluate("""() => { const S = window.__dbg.save(), X = EXPEDITION, d = LONGHOUSE.mine(S), offs = X.offers(d.id, X.dayOf());
                  let FP = { id: "fake", leader: "f1", members: [{ id: "f1", name: "Kacper" }, { id: S.id, name: S.name }, { id: "f2", name: "Sigrid" }] };
                  const opts = [...offs.map((o) => [o.key, X.titleOf(o) + " (" + I18N.t(o.slot[0].toUpperCase() + o.slot.slice(1)) + ")", ""]), ["skip", I18N.t("Not tonight"), ""]];
                  FP = X.openVote(FP, { did: "pick|shot", kind: "pick", title: I18N.t("Tonight's expedition"), opts }, { offers: offs });
                  FP = X.castVote(FP, "f1", offs[2].key); FP = X.castVote(FP, "f2", offs[1].key);
                  S.exp = null; window.__fakeParty = FP;
                  X.mount({ S: () => window.__dbg.save(), persist: () => {}, toast: () => {}, render: () => {}, party: () => window.__fakeParty, online: () => true });
                  X._flash(null); }""")
                await pg.wait_for_timeout(700)
                nv = await pg.evaluate("document.querySelectorAll('#exp-layer .pvopt').length")
                check(nv == 4, f"{tag}: the party vote shows three offers and Not tonight ({nv})")
                await shot("vote", None)
                # the offers under the vote: who voted for what, as small portraits on the cards
                await pg.evaluate("() => { const l = document.getElementById('exp-layer'); if (l) l.style.display = 'none'; }")
                await table(); await pg.wait_for_timeout(400)
                nf = await pg.evaluate("document.querySelectorAll('#lng-root .exp-votes .pvchip').length")
                check(nf == 2, f"{tag}: vote portraits on the cards ({nf})")
                if QA: check(await pg.evaluate("!!document.querySelector('#lng-root .exp-bg img') && document.querySelectorAll('#lng-root .exp-risk').length === 3"), f"{tag}: the table backdrop and risk labels")
                await pg.evaluate("() => { const c = document.querySelectorAll('#lng-root .exp-card')[1]; c && c.scrollIntoView({ block: 'center' }); }")
                await shot("offers_vote")
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    for e in errs: print("page error:", e)
    print(f"{len(shots)} shots in {OUT}")
    if bad or errs: print("FAILED:", bad); sys.exit(1)
    print("expedition ui ok")

asyncio.run(main())
