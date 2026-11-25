"""Charge bars on screen (chargebar.js): the Items menu (icons, "no charge", the detail card), a mouse tooltip on PC,
the shop's sell list and the wizard's staffs, the paper doll's weapon picker, and the charge meter in a turn-by-turn fight.
Hand-drawn style, a 390x844 phone and a 1920x1080 PC, painted assets on (?assets).
Run:  node tests/serve.js 8765   then   python tests/chargebar_ui.py 8765 [outdir]   — prints "chargebar_ui: all good".
Screenshots in tests/out_chargebar/ (gitignored) unless an outdir is given."""
import asyncio, os, sys
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_chargebar")
os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

NOON = """(()=>{ const base=Date.now.bind(Date); let off=0; while (Math.floor(G.clock(base()/1000+off).hour)!==12) off+=60; Date.now=()=>base()+off*1000; return G.shopsOpen(); })()"""
SETUP = """(()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=3000; S.trip=null; S.level=20;
  const sw='ench|steel_sword|fire|10|300', ax='ench|iron_war_axe|absorb|8|300';
  const a=G.give(S,sw); G.invRow(S,a).charge=150; G.equip(S,a);
  const b=G.give(S,ax); G.invRow(S,b).charge=0;
  const c=G.give(S,'staff_flames'); G.invRow(S,c).charge=D.ITEMS.staff_flames.staff.capacity*0.3;
  G.give(S,'soulgem_common' in D.ITEMS ? 'soulgem_common' : Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==='soulgem'));
  G.give(S,'iron_sword'); G.give(S,'potion_health',2);
  return {sw:a, ax:b, st:c}; })()"""
OVER = "Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1"
FIGHT = """(()=>{ document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); const S=window.__dbg.save();
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null;
  G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); })()"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        for style in ["ink"]:
            for vw, vh, pc in [(390, 844, False), (1920, 1080, True)]:
                tag = f"{style}_{'pc' if pc else 'phone'}"
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
                await ctx.add_init_script(f"try{{localStorage.setItem('artStyle','{style}')}}catch(e){{}}")
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&assets&tb&p=cb{style}{vw}"); await pg.wait_for_timeout(1500)
                try:
                    await pg.wait_for_selector(".press", timeout=60000); await pg.click(".press")
                    await pg.wait_for_selector(".mi[data-t=new]", timeout=30000); await pg.click(".mi[data-t=new]")
                    await pg.wait_for_selector("#nm", timeout=30000); await pg.fill("#nm", "Brelyna"); await pg.click("#begin")
                    await pg.wait_for_function("window.__dbg && window.__dbg.save() && typeof G !== 'undefined'", timeout=60000); await pg.wait_for_timeout(1000)
                except Exception as e:
                    await pg.screenshot(path=os.path.join(OUT, f"{tag}_start_failed.png")); ok(False, f"{tag}: game starts ({str(e)[:80]})"); await ctx.close(); continue
                await pg.evaluate("try{ART.setStyle('%s')}catch(e){}" % style)
                await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
                await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
                await pg.evaluate(NOON)
                ids = await pg.evaluate(SETUP)
                await pg.evaluate("setInterval(()=>document.querySelectorAll('#obtip').forEach(m=>m.remove()),150)")

                async def shot(name):
                    await pg.wait_for_timeout(300)
                    await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
                    if not await pg.evaluate(OVER): fails.append(f"{tag} {name}: page scrolls sideways")

                # 1. Items menu: icons carry bars, the empty axe says "no charge"
                await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(400)
                await pg.evaluate("document.querySelector('#sky [data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(300)
                n = await pg.evaluate("document.querySelectorAll('#sky .sky-row .cb-ico .cbar').length")
                ok(n >= 3, f"{tag}: Items list icons have charge bars ({n})")
                ok(await pg.evaluate("document.querySelectorAll('#sky .sky-row .cb-ico .cbar.cb-empty').length") >= 1, f"{tag}: the empty axe's bar is red")
                ok(await pg.evaluate(f"/no charge|brak ładunku/i.test(document.querySelector(\"#sky .sky-row[data-id='{ids['ax']}']\")?.textContent||'')"), f"{tag}: the empty axe row says no charge")
                ok(await pg.evaluate("!document.querySelector(\"#sky .sky-row[data-id='" + str(ids['sw']) + "'] .cb-none\")"), f"{tag}: the charged sword row doesn't")
                ok(await pg.evaluate("!document.querySelector('#sky .sky-row .cb-ico') || [...document.querySelectorAll('#sky .sky-row .cb-ico')].every(e=>{const i=e.querySelector('img,canvas'); const r=e.getBoundingClientRect(), q=e.querySelector('.cbar').getBoundingClientRect(); return q.left>=r.left-1 && q.right<=r.right+1 && q.bottom<=r.bottom+1;})"), f"{tag}: bars sit inside their icons")
                await pg.evaluate(f"document.querySelector(\"#sky [data-act=skysel][data-id='{ids['ax']}']\").click()"); await pg.wait_for_timeout(350)
                ok(await pg.evaluate("!!document.querySelector('#sky .cb-detail.cb-empty .cbar.cb-wide')"), f"{tag}: detail card shows the empty charge bar")
                ok(await pg.evaluate("!!document.querySelector('#sky [data-act=recharge]')"), f"{tag}: detail card offers Recharge")
                await shot("items_empty")
                await pg.evaluate(f"document.querySelector(\"#sky [data-act=skysel][data-id='{ids['sw']}']\").click()"); await pg.wait_for_timeout(350)
                w = await pg.evaluate("document.querySelector('#sky .cb-detail .cbar i')?.style.width")
                ok(w and abs(float(w.rstrip("%")) - 50) < 0.01, f"{tag}: half-charged sword shows 50% ({w})")
                await shot("items_half")
                # recharge the axe from the detail card
                await pg.evaluate(f"document.querySelector(\"#sky [data-act=skysel][data-id='{ids['ax']}']\").click()"); await pg.wait_for_timeout(300)
                await pg.evaluate("document.querySelector('#sky [data-act=recharge]').click()"); await pg.wait_for_timeout(400)
                ch = await pg.evaluate(f"window.__dbg.save().inv.find(r=>r.id==={ids['ax']}).charge")
                ok(ch and ch > 0, f"{tag}: Recharge fills the axe ({ch})")
                await pg.evaluate("document.querySelector('#sky [data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(300)
                ok(await pg.evaluate(f"!/no charge|brak ładunku/i.test(document.querySelector(\"#sky .sky-row[data-id='{ids['ax']}']\")?.textContent||'')"), f"{tag}: after recharging, no 'no charge'")
                G0 = f"(()=>{{const r=window.__dbg.save().inv.find(r=>r.id==={ids['ax']}); r.charge=0; }})()"
                await pg.evaluate(G0)
                # 2. tooltip (PC mouse)
                if pc:
                    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); __ui.closeMenu(); __ui.openMenu('items')"); await pg.wait_for_timeout(400)
                    await pg.evaluate("document.querySelector('#sky [data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(300)
                    el = await pg.query_selector(f"#sky .sky-row[data-id='{ids['sw']}']")
                    bb = await el.bounding_box(); await pg.mouse.move(5, 5); await pg.wait_for_timeout(150)
                    await pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); await pg.wait_for_timeout(1200)
                    ok(await pg.evaluate("!!document.querySelector('#tip.on .cb-detail .cbar')"), f"{tag}: tooltip shows the charge bar")
                    await shot("tooltip")
                    await pg.mouse.move(5, 5)
                # 3. paper doll weapon picker
                await pg.evaluate("__ui.closeMenu(); __ui.openMenu('items')"); await pg.wait_for_timeout(300)
                await pg.evaluate("document.querySelector('#sky [data-act=skycat][data-id=gear]')?.click()"); await pg.wait_for_timeout(300)
                ok(await pg.evaluate("!!document.querySelector('#sky .dslot .cb-ico .cbar')"), f"{tag}: paper doll weapon slot has a bar")
                await pg.evaluate("document.querySelector('#sky [data-act=dollslot][data-slot=weapon]')?.click()"); await pg.wait_for_timeout(400)
                ok(await pg.evaluate("document.querySelectorAll('.dpick .cb-inl .cbar').length >= 2"), f"{tag}: weapon picker rows have charge bars")
                ok(await pg.evaluate("[...document.querySelectorAll('.dpick .cb-none')].length >= 1"), f"{tag}: weapon picker says no charge for the axe")
                await shot("doll_picker")
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); __ui.closeMenu()"); await pg.wait_for_timeout(200)
                # 4. shop: sell list (and the wizard's staffs on the buy side)
                await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); document.querySelector('[data-tab=map]')?.click(); document.querySelector('[data-tab=town]')?.click()"); await pg.wait_for_timeout(400)
                await pg.evaluate("document.querySelector('[data-act=shop][data-id=general]')?.click()"); await pg.wait_for_timeout(300)
                await pg.evaluate("document.querySelector('[data-act=smode][data-id=sell]')?.click()"); await pg.wait_for_timeout(300)
                ok(await pg.evaluate("document.querySelectorAll('#side .item .cb-ico .cbar').length >= 2"), f"{tag}: shop sell list icons have bars")
                ok(await pg.evaluate("document.querySelectorAll('#side .item .cb-inl').length >= 2 && [...document.querySelectorAll('#side .item .cb-none')].length >= 1"), f"{tag}: shop sell rows show charge and no charge")
                await pg.evaluate("document.querySelector('#side .cb-none')?.scrollIntoView({block:'center'})"); await shot("shop_sell")
                # 5. fight: a charge meter under your health
                await pg.evaluate(FIGHT); await pg.wait_for_timeout(500)
                await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()"); await pg.wait_for_timeout(1200)
                await pg.evaluate("document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove())")
                has = await pg.evaluate("!!document.querySelector('#tbf .tbu.me .tbbar.ch')")
                ok(has, f"{tag}: fight screen shows the charge meter")
                if has:
                    t = await pg.evaluate("document.querySelector('#tbf .tbu.me .tbbar.ch').textContent")
                    ok("%" in t or "charge" in t.lower() or "ładunk" in t.lower(), f"{tag}: meter reads {t!r}")
                    r = await pg.evaluate("(()=>{const a=document.querySelector('#tbf .tbu.me .tbbar.ch').getBoundingClientRect(), b=document.querySelector('#tbf .tbu.me').getBoundingClientRect(); return a.width>20 && a.left>=b.left-1 && a.right<=b.right+1;})()")
                    ok(r, f"{tag}: meter fits in your panel")
                await shot("fight")
                ok(not errs, f"{tag}: no page errors {errs[:3]}")
                await ctx.close()
        await b.close()
    print("chargebar_ui: " + ("all good" if not fails else f"{len(fails)} problems"))
    for f in fails: print("  -", f)
    sys.exit(1 if fails else 0)

asyncio.run(main())
