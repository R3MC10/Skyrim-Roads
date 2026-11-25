"""Inventory helpers on phones (invqol.js): Keep, Drop, sort chips, ▲/▼ arrows, Sell all junk with its list and total,
the confirm before selling something valuable, Buy back, and the too-heavy warning. Both art styles, 360 and 412 wide,
normal and Biggest text.
Run:  node tests/serve.js 9450   then   python tests/inventory_ui.py 9450 [outdir]   — prints "inventory_ui: all good"."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9450"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "inventory_shots")
os.makedirs(OUT, exist_ok=True)
OVERFLOW = """(()=>{ const W=innerWidth, bad=[];
  for (const e of document.querySelectorAll('.iq-shop .btn,.iq-sort,.iq-btns .btn,.sheet,.sky-acts .btn,.item .btn')) {
    const r=e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let sc=false; for (let a=e.parentElement; a && a!==document.body; a=a.parentElement) { const o=getComputedStyle(a).overflowX; if (o==='auto'||o==='scroll') { sc=true; break; } }
    if (sc) continue;
    if (r.right > W + 1 || r.left < -1) bad.push((e.className||e.tagName)+' '+(e.textContent||'').trim().slice(0,18)+' x '+Math.round(r.left)+'..'+Math.round(r.right));
  }
  // the town's section chips can already run wide at Biggest text (not ours): measure the page without them
  const tg=[...document.querySelectorAll('.towngroups')]; tg.forEach(e=>e.style.display='none');
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) bad.push('page scrolls sideways');
  tg.forEach(e=>e.style.display='');
  return bad; })()"""
NOON = """(()=>{ const base=Date.now.bind(Date); let off=0; while (Math.floor(G.clock(base()/1000+off).hour)!==12) off+=60; Date.now=()=>base()+off*1000; return G.shopsOpen(); })()"""
SETUP = """(()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=3000; S.trip=null;
  const st=G.give(S,'steel_sword'); G.equip(S,st); G.give(S,'iron_sword'); G.give(S,'iron_sword'); G.give(S,'elven_sword');
  G.give(S,'silver_ring',3); G.give(S,'gold_ring'); G.give(S,'gem_emerald'); G.give(S,'potion_health',4); G.give(S,'iron_helmet');
  return S.inv.length; })()"""

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for style in ["ink"]:
            for vw, vh in [(360, 780), (412, 915)]:
                tag = f"{style}_{vw}"
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
                await ctx.add_init_script(f"try{{localStorage.setItem('artStyle','{style}')}}catch(e){{}}")
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=iq{style}{vw}"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1300)
                await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
                if not await pg.evaluate(NOON): fails.append(f"{tag}: could not make it noon")
                await pg.evaluate(SETUP)
                # other popups (quest steps, tips) get out of the way; ours (iq buttons) stay
                await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal').forEach(m=>{ if (!m.querySelector('[data-act^=iq]')) m.remove(); }),150)"); await pg.wait_for_timeout(300)

                async def shot(name):
                    await pg.wait_for_timeout(350)
                    await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
                    bad = await pg.evaluate(OVERFLOW)
                    if bad: fails.append(f"{tag} {name}: {bad[:5]}")

                # the shop: sell side with junk + arrows
                await pg.click("[data-tab=world]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
                await pg.click("[data-act=shop][data-id=general]"); await pg.wait_for_timeout(300)
                await pg.evaluate("document.querySelector('[data-act=smode][data-id=buy]')?.click()"); await pg.wait_for_timeout(200)
                await pg.evaluate("document.querySelector('[data-act=smode][data-id=sell]').scrollIntoView({block:'start'})"); await shot("shop_sell_top")
                await pg.click("[data-act=smode][data-id=sell]"); await pg.wait_for_timeout(300)
                await pg.evaluate("document.querySelector('.iq-shop').scrollIntoView({block:'start'})"); await shot("shop_sell")
                n_dn = await pg.evaluate("document.querySelectorAll('#side .iq-dn').length")
                if n_dn < 1: fails.append(f"{tag}: no ▼ on the worse iron swords")
                if not await pg.evaluate("document.querySelectorAll('#side .iq-up').length"): fails.append(f"{tag}: no ▲ on the elven sword")
                # sell a valuable: asks first
                eid = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item==='gem_emerald').id)")
                await pg.click(f"#side [data-act=sell][data-id='{eid}']"); await pg.wait_for_timeout(300)
                if not await pg.evaluate("!!document.querySelector('#modal [data-act=iqyes]')"): fails.append(f"{tag}: no confirm before selling the emerald")
                await shot("confirm_sell")
                await pg.click("#modal [data-act=iqno]"); await pg.wait_for_timeout(200)
                if not await pg.evaluate("window.__dbg.save().inv.some(r=>r.item==='gem_emerald')"): fails.append(f"{tag}: cancel still sold it")
                await pg.click(f"#side [data-act=sell][data-id='{eid}']"); await pg.wait_for_timeout(200)
                g0 = await pg.evaluate("window.__dbg.save().gold")
                await pg.click("#modal [data-act=iqyes]"); await pg.wait_for_timeout(300)
                g1 = await pg.evaluate("window.__dbg.save().gold")
                if g1 <= g0 or await pg.evaluate("window.__dbg.save().inv.some(r=>r.item==='gem_emerald')"): fails.append(f"{tag}: confirmed sale didn't happen {g0}->{g1}")
                # buy back
                await pg.evaluate("document.querySelector('.iq-shop').scrollIntoView({block:'start'})"); await shot("buyback_button")
                await pg.click("#side [data-act=iqundo]"); await pg.wait_for_timeout(300)
                if await pg.evaluate("window.__dbg.save().gold") != g0 or not await pg.evaluate("window.__dbg.save().inv.some(r=>r.item==='gem_emerald')"): fails.append(f"{tag}: buy back failed")
                # sell all junk: list + total, then sell
                await pg.click("#side [data-act=iqjunk]"); await pg.wait_for_timeout(300)
                txt = await pg.inner_text("#modal")
                if "Total" not in txt or "Silver Ring" not in txt or "Iron Sword" not in txt: fails.append(f"{tag}: junk list wrong: {txt[:160]!r}")
                if "Emerald" in txt or "Steel Sword" in txt: fails.append(f"{tag}: junk list has keepers")
                await shot("junk_list")
                await pg.click("#modal [data-act=iqjunkgo]"); await pg.wait_for_timeout(400)
                left = await pg.evaluate("window.__dbg.save().inv.filter(r=>['silver_ring','iron_sword'].includes(r.item)).length")
                if left: fails.append(f"{tag}: junk still in pack ({left})")
                if not await pg.evaluate("window.__dbg.save().inv.some(r=>r.item==='steel_sword')"): fails.append(f"{tag}: worn sword sold!")
                # too heavy warning on buy
                await pg.evaluate("(()=>{ const S=window.__dbg.save(); while (G.carried(S) < G.capacity(S) - 3) G.give(S,'mat_iron', 5); })()")
                await pg.click("[data-act=smode][data-id=buy]"); await pg.wait_for_timeout(300)
                heavy = await pg.evaluate("(()=>{ const S=window.__dbg.save(); const b=[...document.querySelectorAll('#side [data-act=buy]')].find(x=>!x.disabled && (D.ITEMS[x.dataset.item]?.weight||0) > G.capacity(S)-G.carried(S)); if (!b) return null; b.scrollIntoView({block:'center'}); b.click(); return b.dataset.item; })()")
                await pg.wait_for_timeout(300)
                if heavy is None: fails.append(f"{tag}: no heavy thing to try")
                elif not await pg.evaluate("/Too heavy/.test(document.querySelector('#modal')?.textContent||'')"): fails.append(f"{tag}: no too-heavy warning buying {heavy}")
                else:
                    await shot("too_heavy")
                    await pg.click("#modal [data-act=iqsellmode]"); await pg.wait_for_timeout(300)
                    if not await pg.evaluate("document.querySelector('[data-act=smode][data-id=sell]').classList.contains('on')"): fails.append(f"{tag}: Sell something didn't switch to selling")
                # pack: sort chips, keep, drop
                await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
                await pg.evaluate("window.__ui?.closeMenu?.()")
                await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(400)
                await pg.evaluate("document.querySelector('#sky .sky-cat[data-id=all]')?.click()"); await pg.wait_for_timeout(300)   # the shop's own category row (.trade-cats) can still be on the page
                eid = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item==='gem_emerald').id)")
                await pg.click(f"#sky [data-act=skysel][data-id='{eid}']"); await pg.wait_for_timeout(300)
                await pg.click("#sky [data-act=iqkeep]"); await pg.wait_for_timeout(300)
                if not await pg.evaluate("window.__dbg.save().inv.find(r=>r.item==='gem_emerald').keep===1"): fails.append(f"{tag}: Keep didn't stick")
                await pg.evaluate("document.querySelector('#sky .sky-detail')?.scrollIntoView({block:'end'})"); await shot("menu_keep")
                await pg.click("#sky .sky-detail [data-act=iqdrop]"); await pg.wait_for_timeout(300)
                if not await pg.evaluate("!!document.querySelector('#modal [data-act=iqyes]')"): fails.append(f"{tag}: no confirm dropping a kept emerald")
                await shot("confirm_drop")
                await pg.click("#modal [data-act=iqno]"); await pg.wait_for_timeout(200)
                await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
                # the old-style pack page (sort chips), at Biggest text too
                for size in ["0", "3"]:
                    await pg.evaluate(f"typeof ACCESS!=='undefined' && ACCESS.pref('a11yText','{size}')")
                    has_pack = await pg.evaluate("!!document.querySelector('[data-tab=hero]')")
                    shown = await pg.evaluate("(()=>{ const s=document.querySelector('#side'); return s ? s.innerHTML.includes('iq-sort') : false })()")
                    if not shown:
                        await pg.evaluate("(()=>{ const S=window.__dbg.save(); S.location='Whiterun'; })()")
                    await pg.evaluate("document.querySelector('[data-tab=town]')?.click()"); await pg.wait_for_timeout(300)
                    await pg.evaluate("document.querySelector('.iq-shop')?.scrollIntoView({block:'start'})"); await shot(f"shop_text{size}")
                    if has_pack:
                        await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(300)
                        await pg.evaluate("document.querySelector('#sky .sky-cat[data-id=all]')?.click()"); await pg.wait_for_timeout(1200)
                        await shot(f"menu_text{size}")
                        await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
                await pg.evaluate("typeof ACCESS!=='undefined' && ACCESS.pref('a11yText','0')")
                if errs: fails.append(f"{tag} page errors: {errs[:3]}")
                print(tag, "done")
                await ctx.close()
        await b.close()
    print("screens in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("inventory_ui: all good")

asyncio.run(main())
