"""The world remembers you (livingworld.js) on a phone (390x844) and a PC (1920x1080):
the inn in the evening (who's in, ask a shopkeeper to open up, whispers of things to come, the notice board),
the streets (who's about, doors that open as your name grows), a whisper that came true (map mark, card, the fight),
News of the realm in World news, and a scorned hold (shutters closed, make amends).
python livingworld_ui.py <port> [out_dir] [pl]   (serve game/ first: python -m http.server <port> --directory game)
With "pl" the game runs in Polish: the same checks, and nothing this module shows may be left in English."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PL = "pl" in sys.argv[1:]
if PL: sys.argv = [a for a in sys.argv if a != "pl"]
PORT = sys.argv[1] if len(sys.argv) > 1 else "9231"
OUT = (sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_livingworld" + ("_pl" if PL else ""))).rstrip("/\\") + "/"
os.makedirs(OUT, exist_ok=True)

async def close_modals(pg):
    for _ in range(6):
        b = await pg.query_selector("#modal [data-act=close]")
        if not b: break
        try: await b.click(timeout=1500)
        except Exception: break
        await pg.wait_for_timeout(150)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")

async def tap(pg, sel):
    await close_modals(pg)
    await pg.evaluate("(s)=>document.querySelector(s)?.scrollIntoView({block:'center'})", sel)
    await pg.click(sel)

SET_HOUR = """(h)=>{ const real=Date.__real||(Date.__real=Date.now.bind(Date)); let t=real()/1000; for(let i=0;i<3000&&Math.abs(G.clock(t).hour-h)>0.2;i++) t+=30; const off=t*1000-real(); Date.now=()=>real()+off; }"""
VIEWS = [("phone", {"width": 390, "height": 844}, True), ("pc", {"width": 1920, "height": 1080}, False)]

async def shot(pg, name, sel=None):
    await close_modals(pg)
    await pg.add_style_tag(content="#toast,#hudlog,#pbanners,.pburst,.pgold{display:none!important}")   # the game's own toasts and banners
    if sel: await pg.evaluate("(s)=>document.querySelector(s)?.scrollIntoView({block:'start'})", sel); await pg.wait_for_timeout(200)
    await pg.screenshot(path=f"{OUT}{name}.png")

# Polish: any line from this module still in English (I18N has nothing for it)
LEFT = """()=>{ const out=[]; for (const el of document.querySelectorAll('.lw-panel, .lw-inn, .lw-folk, .lw-doorrow, .lw-ask, .lw-card, .lw-noticeboard, .lw-where, #modal')) {
  const w=document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())){ const t=n.nodeValue.trim(); if(/\\b(the|you|your|and|is|are|with|for|they|was|were|has|have|of|at)\\b/.test(t)) out.push(t); } }
  return [...new Set(out)]; }"""
async def polish(pg, tag, res, what):
    if not PL: return
    left = await pg.evaluate(LEFT)
    for t in left[:8]: print(f"   {tag} {what} still English: {t}")
    res.append((f"{tag} {what} in Polish", not left))

async def main():
    res, errs = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for vname, vp, mobile in VIEWS:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
            await ctx.add_init_script("try{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}');p.lang='%s';localStorage.setItem('rotn_prefs',JSON.stringify(p))}catch(e){}" % ("pl" if PL else "en"))
            for style in ["ink"]:
                tag = f"{vname}_{style}"
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=lw{tag}"); await pg.wait_for_timeout(1800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodi"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
                await close_modals(pg)
                await pg.evaluate("""(st)=>{ const S=window.__dbg.save(); S.location="Whiterun"; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=3000; S.level=30; S.hpBonus=4000; G.setHealth(S,G.maxHealth(S), G.now());
                    S.skills["One-Handed"].lvl=70; RUMOURS.st(S).fame.Whiterun=55;
                    LIVING.tick(S); LIVING.deed(S,"guard","Whiterun",4,`Ri'saad's caravan rolled safely into Whiterun, guarded by ${S.name}.`);
                    LIVING.deed(S,"dragon","Whiterun",5,`${S.name} slew a dragon in Whiterun. The skalds are already arguing over the song.`); window.__ui.save&&window.__ui.save(); }""", style)
                await pg.wait_for_timeout(4000); await close_modals(pg)   # let the new character's quest popups pass
                await pg.evaluate(SET_HOUR, 21)
                # ---- the inn in the evening
                await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300); await close_modals(pg)
                await tap(pg, "[data-act=shop][data-id=inn]"); await pg.wait_for_timeout(400)
                folk = await pg.evaluate("[...document.querySelectorAll('.lw-inn .lw-who b')].map(e=>e.innerText)")
                res.append((f"{tag} inn: who's in ({len(folk)})", len(folk) >= 3))
                res.append((f"{tag} notice board", bool(await pg.query_selector(".lw-noticeboard svg"))))
                await shot(pg, f"{tag}_inn", ".lw-inn")
                await shot(pg, f"{tag}_inn_board", ".lw-noticeboard")
                await polish(pg, tag, res, "inn")
                n0 = await pg.evaluate("LIVING.st(window.__dbg.save()).wh.length")
                await tap(pg, "[data-lw=whisper]"); await pg.wait_for_timeout(400)
                res.append((f"{tag} heard a whisper", await pg.evaluate("LIVING.st(window.__dbg.save()).wh.length") > n0))
                await pg.screenshot(path=f"{OUT}{tag}_whisper.png")
                await polish(pg, tag, res, "whisper")
                await close_modals(pg)
                # ask the trader found in the inn to open up
                await tap(pg, "[data-lw=askopen][data-sec=general]"); await pg.wait_for_timeout(400)
                res.append((f"{tag} trader opens up, no night charge", await pg.evaluate("(()=>{const S=window.__dbg.save(); return RUMOURS.knocked(S) && !!S.rw.knock.free})()")))
                # ---- the streets: who's about, doors
                await close_modals(pg)
                await tap(pg, "[data-act=shop][data-id=streets]"); await pg.wait_for_timeout(400)
                res.append((f"{tag} who's about", len(await pg.query_selector_all(".lw-who")) >= 5))
                await shot(pg, f"{tag}_streets", ".lw-folk")
                await shot(pg, f"{tag}_doors", ".lw-doorrow")
                await polish(pg, tag, res, "streets")
                await tap(pg, "[data-lw=door][data-id=guest]"); await pg.wait_for_timeout(400)
                res.append((f"{tag} Jarl's guest room", await pg.evaluate("G.rested(window.__dbg.save())")))
                await close_modals(pg)
                # ---- a whisper comes true: map mark, card, the fight
                place = await pg.evaluate("""()=>{ const S=window.__dbg.save(); const x=LIVING.st(S).wh[0]; x.real=true; x.due=G.now()-1; LIVING.advance(S); return x.place; }""")
                await pg.click("[data-tab=map]"); await pg.wait_for_timeout(900); await close_modals(pg)
                res.append((f"{tag} whisper on the map", await pg.evaluate("RUMOURS.marks(window.__dbg.save()).some(m=>m.label.includes(%r))" % place)))
                await pg.screenshot(path=f"{OUT}{tag}_map.png")
                await pg.evaluate("""(pl)=>{ const S=window.__dbg.save(); S.location=pl; [S.x,S.y]=WORLD.places[pl]; S.trip=null; }""", place)
                await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(700); await close_modals(pg)
                card = await pg.query_selector(".lw-card")
                res.append((f"{tag} card at {place}", bool(card)))
                if card:
                    await card.scroll_into_view_if_needed(); await card.screenshot(path=f"{OUT}{tag}_card.png")
                    await polish(pg, tag, res, "card")
                    await tap(pg, "[data-lw=act]"); await pg.wait_for_timeout(900)
                    res.append((f"{tag} dealt with it", await pg.evaluate("LIVING.st(window.__dbg.save()).wh[0].st!=='live' || !!document.querySelector('#modal, #tb, .tb')")))
                    await pg.screenshot(path=f"{OUT}{tag}_result.png")
                    await close_modals(pg)
                # ---- World news: News of the realm
                await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location="Whiterun"; [S.x,S.y]=WORLD.places.Whiterun; }""")
                await pg.evaluate("()=>window.__ui.go('world')"); await pg.wait_for_timeout(500); await close_modals(pg)
                t = await pg.evaluate("document.querySelector('.lw-panel')?.innerText||''")
                res.append((f"{tag} News of the realm", ("wieści z królestwa" in t.lower() and "karawan" in t.lower()) if PL else ("news of the realm" in t.lower() and "caravan" in t.lower())))
                await shot(pg, f"{tag}_news", ".lw-panel")
                await polish(pg, tag, res, "news")
                # ---- a scorned hold: shutters closed, make amends
                await pg.evaluate("""()=>{ const S=window.__dbg.save(); RUMOURS.st(S).fame.Whiterun=0; LIVING.deed(S,"rob","Whiterun",-40,"A caravan was robbed."); S.rw.knock=null; }""")
                await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300); await close_modals(pg)
                await tap(pg, "[data-act=shop][data-id=streets]"); await pg.wait_for_timeout(400)
                res.append((f"{tag} shutters closed", bool(await pg.query_selector(".lw-doorrow.bad [data-lw=amends]"))))
                await shot(pg, f"{tag}_scorned", ".lw-doorrow.bad")
                await polish(pg, tag, res, "scorned")
                await tap(pg, "[data-lw=amends]"); await pg.wait_for_timeout(400)
                res.append((f"{tag} made amends", await pg.evaluate("!LIVING.shut(window.__dbg.save(),'Whiterun')")))
                await pg.close()
            await ctx.close()
        await b.close()
    for k, v in res: print(("ok   " if v else "FAIL ") + k)
    print("errors:", errs)
    print("screenshots:", OUT)
    good = all(v for _, v in res) and not errs
    print("RESULT", "OK" if good else "FAIL")
    sys.exit(0 if good else 1)
asyncio.run(main())
