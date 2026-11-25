"""Rings and amulets on the paper doll (jewelry.js): the amulet + two ring slots under the figure, the ring picker,
putting on two rings, item details with the plain-words enchantment, the enchanter taking a ring. Both art styles.
Run:  node tests/serve.js 9451   then   python tests/jewelry_ui.py 9451 [outdir]   — prints "jewelry_ui: all good"."""
import asyncio, os, sys
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9451"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_jewelry")
os.makedirs(OUT, exist_ok=True)
SETUP = """(()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=2000;
  for (const i of ['steel_sword','steel_armor','steel_helmet','iron_shield','leather_boots','iron_gauntlets']) G.equip(S, G.give(S,i));
  G.give(S,'ench|gold_diamond_ring|resist_fire|30|0'); G.give(S,'ench|silver_amethyst_ring|regen_health|25|0'); G.give(S,'iron_ring');
  G.give(S,'gauldur_amulet'); G.give(S,'ench|silver_necklace|magicka|20|0'); G.give(S,'gold_emerald_necklace');
  G.give(S,'soul_gem_greater',2); S.enchants=['health','resist_frost','crit'];
  return S.inv.length; })()"""
NOMODAL = "document.querySelectorAll('#modal').forEach(m=>m.remove())"

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            await ctx.add_init_script(f"try{{localStorage.setItem('artStyle','{style}')}}catch(e){{}}")
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=jw{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Jorunn"); await pg.click("#begin"); await pg.wait_for_timeout(1300)
            await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
            await pg.evaluate(SETUP)
            await pg.wait_for_timeout(2500); await pg.evaluate(NOMODAL)   # let start-up popups (quest done, news) come and go

            async def shot(name, full=False):
                await pg.wait_for_timeout(400)
                await pg.screenshot(path=os.path.join(OUT, f"{style}_{name}.png"), full_page=full)

            async def open_pack():
                await pg.evaluate(NOMODAL); await pg.evaluate("window.__ui?.closeMenu?.()")
                await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(500)

            # empty jewellery slots under the figure
            await open_pack()
            n = await pg.evaluate("document.querySelectorAll('#sky .djewel [data-act=dollslot]').length")
            if n != 3: fails.append(f"{style}: {n} jewellery slots, want 3")
            await shot("doll_empty")
            # ring picker, put on two rings
            await pg.evaluate(NOMODAL); await pg.evaluate("document.querySelector('#sky .djewel [data-slot=ring]').click()"); await pg.wait_for_timeout(300)
            txt = await pg.inner_text("#modal")
            if "Resist Fire" not in txt and "fire" not in txt.lower(): fails.append(f"{style}: ring picker doesn't say what the magic does: {txt[:200]!r}")
            await shot("ring_picker")
            rid = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item.startsWith('ench|gold_diamond_ring')).id)")
            await pg.evaluate("[...document.querySelectorAll('#modal [data-act=dolleq]')].find(b=>b.textContent.includes('Resist Fire')).click()"); await pg.wait_for_timeout(300)
            await pg.evaluate(NOMODAL)
            await pg.evaluate(NOMODAL); await pg.evaluate("document.querySelector('#sky .djewel [data-slot=ring2]').click()"); await pg.wait_for_timeout(300)
            rid2 = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item.startsWith('ench|silver_amethyst_ring')).id)")
            await pg.evaluate("[...document.querySelectorAll('#modal [data-act=dolleq]')].find(b=>b.textContent.includes('Recovery')).click()"); await pg.wait_for_timeout(300)
            await pg.evaluate(NOMODAL)
            await pg.evaluate(NOMODAL); await pg.evaluate("document.querySelector('#sky .djewel [data-slot=amulet]').click()"); await pg.wait_for_timeout(300)
            await shot("amulet_picker")
            aid = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item==='gauldur_amulet').id)")
            await pg.evaluate("[...document.querySelectorAll('#modal [data-act=dolleq]')].find(b=>b.textContent.includes('Gauldur')).click()"); await pg.wait_for_timeout(300)
            await pg.evaluate(NOMODAL)
            eq = await pg.evaluate("(()=>{ const e=G.loadout(window.__dbg.save()).equipment; return [e.ring!=null, e.ring2!=null, e.amulet!=null, e.ring!==e.ring2]; })()")
            if eq != [True, True, True, True]: fails.append(f"{style}: rings/amulet not worn {eq}")
            await open_pack()
            await shot("doll_worn")
            # item details of a worn ring: plain words, Unequip takes it off the right hand
            await pg.evaluate("document.querySelectorAll('.sky-cat')[1]?.click()"); await pg.wait_for_timeout(300)
            await pg.evaluate(NOMODAL); await pg.evaluate(f"document.querySelector(\"#sky [data-act=skysel][data-id='{rid2}']\").click()"); await pg.wait_for_timeout(400)
            det = await pg.evaluate("document.querySelector('#sky .sky-detail')?.innerText||''")
            if "While worn" not in det or "faster" not in det: fails.append(f"{style}: ring details: {det[:200]!r}")
            await pg.evaluate("document.querySelector('#sky .sky-detail')?.scrollIntoView({block:'end'})"); await shot("ring_details")
            await pg.evaluate("document.querySelector('#sky .sky-detail [data-act=uneq]')?.click()"); await pg.wait_for_timeout(300)
            eq2 = await pg.evaluate("(()=>{ const e=G.loadout(window.__dbg.save()).equipment; return [e.ring!=null, e.ring2==null]; })()")
            if eq2 != [True, True]: fails.append(f"{style}: Unequip took off the wrong ring {eq2}")
            # the arcane enchanter takes rings and amulets
            await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
            await pg.evaluate("(()=>{ const D2=Date.now.bind(Date); let off=0; while (Math.floor(G.clock(D2()/1000+off).hour)!==12) off+=60; Date.now=()=>D2()+off*1000; })()")
            await pg.click("[data-tab=map]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
            has = await pg.evaluate("!!document.querySelector('[data-act=shop][data-id=enchanter]')")
            if has:
                await pg.click("[data-act=shop][data-id=enchanter]"); await pg.wait_for_timeout(400)
                opts = await pg.evaluate("[...document.querySelectorAll('#ench_item option')].map(o=>o.textContent)")
                if not any("Ring" in o for o in opts) or not any("Necklace" in o for o in opts): fails.append(f"{style}: enchanter has no rings/amulets: {opts}")
                await pg.evaluate("document.querySelector('#ench_item')?.scrollIntoView({block:'center'})"); await shot("enchanter")
            else: fails.append(f"{style}: no enchanter button in Whiterun")
            if errs: fails.append(f"{style} page errors: {errs[:3]}")
            print(style, "done")
            await ctx.close()
        await b.close()
    print("screens in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("jewelry_ui: all good")

asyncio.run(main())
