"""Accessibility screen test (access.js): every text size and colour mode on two phone sizes.
Run:  python -m http.server 9150 --directory game   then   python tests/access_ui.py 9150 [outdir]
Screenshots land in outdir (default: access_shots in the temp folder); look at them for cut-off text. The script also fails on
page errors, sideways scrolling, and controls that stick out of the screen."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "access_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
# visible things that poke out past the right edge of the screen (or past their own box when they clip text)
OVERFLOW = """(()=>{ const W=innerWidth, bad=[];
  for (const e of document.querySelectorAll('button,.btn,.seg,.setrow,.tab,.item,.sheet,.panel,h2,h3,.top,.vitals,.mapbtns,.twbtn,.favbtn')) {
    const r=e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs=getComputedStyle(e); if (cs.visibility==='hidden' || cs.display==='none') continue;
    if (e.closest('.hide')) continue;
    let sc=false; for (let a=e.parentElement; a && a!==document.body; a=a.parentElement) { const o=getComputedStyle(a).overflowX; if (o==='auto'||o==='scroll') { sc=true; break; } }
    if (sc) continue;   // rows that scroll sideways on purpose
    if (r.right > W + 1 || r.left < -1) bad.push((e.id||e.className||e.tagName)+' x '+Math.round(r.left)+'..'+Math.round(r.right));
    else if (e.matches('.seg button,.tab,.setrow > span') && e.scrollWidth > e.clientWidth + 2) bad.push('clipped '+(e.textContent||'').trim().slice(0,20));
  }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) bad.push('page scrolls sideways '+document.documentElement.scrollWidth);
  return bad; })()"""

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for vw, vh in [(360, 780), (412, 915)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut"); await pg.wait_for_timeout(1200)
            # title-screen settings show the section too
            await pg.click(".press"); await pg.wait_for_timeout(200)
            await pg.click(".mi[data-t=settings]"); await pg.wait_for_timeout(300)
            if not await pg.evaluate("[...document.querySelectorAll('h3')].some(h=>/Accessibility/.test(h.textContent))"): fails.append("no Accessibility on title settings")
            await pg.evaluate("document.querySelector('[data-t=menu],.back,[data-t=back]')?.click()"); await pg.wait_for_timeout(200)
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut"); await pg.wait_for_timeout(1200)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrolfdir"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(CLEAR)
            tag = f"{vw}"

            async def shot(name, check=True):
                await pg.wait_for_timeout(350)
                await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
                if check:
                    bad = await pg.evaluate(OVERFLOW)
                    if bad: fails.append(f"{tag} {name}: {bad[:6]}")

            async def settings():
                await pg.evaluate(CLEAR); await pg.click("#sndBtn"); await pg.wait_for_timeout(300)
                await pg.evaluate("document.querySelector('#modal .sheet h3:nth-of-type(1)')")
                await pg.evaluate("[...document.querySelectorAll('#modal h3')].find(h=>/Accessibility/.test(h.textContent))?.scrollIntoView({block:'start'})")

            # text sizes: the map screen, the settings sheet, the hero page
            for i in [-1, 0, 2, 3]:
                await pg.evaluate(f"ACCESS.pref('a11yText','{i}')")
                z = await pg.evaluate("getComputedStyle(document.documentElement).zoom")
                await pg.evaluate(CLEAR); await pg.evaluate("scrollTo(0,0)"); await shot(f"text{i}_map")
                await settings(); await shot(f"text{i}_settings")
                await pg.evaluate(CLEAR); await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(300); await shot(f"text{i}_hero")
                await pg.evaluate(CLEAR)
                print(tag, "text", i, "zoom", z)
            # the settings buttons themselves change the size (taps, not code)
            await settings()
            await pg.click("#modal [data-k=a11yText][data-v='2']"); await pg.wait_for_timeout(300)
            if await pg.evaluate("ACCESS.settings().a11yText") != 2: fails.append("tapping Large did not stick")
            if not await pg.evaluate("JSON.parse(localStorage.getItem('rotn_prefs')).a11yText===2"): fails.append("text size not saved")
            # map taps still land where you tap when zoomed: tap the player's town marker
            await pg.evaluate(CLEAR)
            hit = await pg.evaluate("""(()=>{ const c=document.querySelector('#mapwrap canvas'); const r=c.getBoundingClientRect(); return [r.width, c.clientWidth, Math.round(r.width/c.clientWidth*100)/100]; })()""")
            print(tag, "map canvas rect vs client width at Bigger:", hit)
            if abs(hit[2] - 1) > 0.02: fails.append(f"map canvas zoomed {hit}")
            await pg.evaluate("ACCESS.pref('a11yText','0')")

            # colour modes: map + HUD bars, the pack (rarity colours), both art styles
            for mode in ["none", "protan", "deutan", "tritan"]:
                await pg.evaluate(f"ACCESS.pref('a11yColour','{mode}')")
                hp = await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--hp').trim()")
                await pg.evaluate(CLEAR); await pg.evaluate("scrollTo(0,0)"); await shot(f"cb_{mode}_map")
                await pg.evaluate("()=>{const S=window.__dbg.save(); const seen={}; for (const id of Object.keys(D.ITEMS)) { const t=CC.tier(id); if (!seen[t] && !S.inv.some(r=>r.item===id)) { seen[t]=1; G.give(S,id); } } }")
                await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(400)
                await pg.evaluate("document.querySelectorAll('.sky-cat')[1]?.click()"); await pg.wait_for_timeout(300); await shot(f"cb_{mode}_pack")
                await pg.evaluate(CLEAR)
                cv = await pg.evaluate("(()=>{const g=document.createElement('canvas').getContext('2d'); g.fillStyle='#d65a4a'; const a=g.fillStyle; g.strokeStyle='#c0392b'; return [a,g.strokeStyle]})()")
                if (mode == "none") != (cv == ["#d65a4a", "#c0392b"]): fails.append(f"canvas colour map {mode}: {cv}")
                print(tag, "colour", mode, "--hp", hp, "canvas", cv)
            await pg.evaluate("ACCESS.pref('a11yColour','deutan')")
            await pg.evaluate("location.reload()"); await pg.wait_for_timeout(1800)
            await pg.evaluate("document.querySelector('.press')?.click()"); await pg.wait_for_timeout(200)
            await pg.evaluate("document.querySelector('.mi[data-t=continue]')?.click()"); await pg.wait_for_timeout(1500)
            await pg.evaluate(CLEAR); await shot("cb_deutan_reload_map")
            if await pg.evaluate("document.documentElement.dataset.cb") != "deutan": fails.append("colour mode not restored after reload")
            await pg.evaluate("()=>{ ACCESS.pref('a11yColour','none'); }")

            # high contrast, reduce motion, one hand (right and left), and everything at once at the biggest size
            await pg.evaluate("ACCESS.pref('a11yContrast','true')"); await pg.evaluate(CLEAR); await shot("contrast_map")
            await settings(); await shot("contrast_settings")
            await pg.evaluate("ACCESS.pref('a11yContrast','false')")
            await pg.evaluate("ACCESS.pref('a11yMotion','on')")
            rm = await pg.evaluate("[matchMedia('(prefers-reduced-motion: reduce)').matches, document.documentElement.classList.contains('a11y-still'), getComputedStyle(document.body).transitionDuration]")
            if not rm[0] or not rm[1]: fails.append(f"reduce motion not applied {rm}")
            await pg.evaluate("ACCESS.pref('a11yMotion','auto')")
            if await pg.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"): fails.append("auto motion should follow the phone (not reduced here)")
            for hand in ["right", "left"]:
                await pg.evaluate(f"ACCESS.pref('a11yHand','{hand}')"); await pg.evaluate(CLEAR); await pg.evaluate("scrollTo(0,0)"); await shot(f"hand_{hand}")
                pos = await pg.evaluate("['#sndBtn','#socBtn','#zoomBtn','#favBtn','#twBtn'].map(s=>{const r=document.querySelector(s)?.getBoundingClientRect(); return r && r.width ? [s, Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)] : [s]})")
                for s, *xy in pos:
                    if not xy: continue
                    x, y = xy
                    if y < vh * 0.45: fails.append(f"{hand}: {s} not in thumb reach (y={y})")
                    if (hand == "right") != (x > vw / 2): fails.append(f"{hand}: {s} on the wrong side (x={x})")
                print(tag, "hand", hand, pos)
            # menu button still opens the menu in one-hand mode
            await pg.click("#sndBtn"); await pg.wait_for_timeout(300)
            if not await pg.evaluate("!!document.querySelector('#modal')"): fails.append("one-hand Menu button does not open settings")
            await pg.evaluate(CLEAR)
            await pg.evaluate("ACCESS.pref('a11yText','3'); ACCESS.pref('a11yContrast','true'); ACCESS.pref('a11yColour','protan'); ACCESS.pref('a11yHand','right')")
            await pg.evaluate("scrollTo(0,0)"); await shot("all_biggest_map")
            await settings(); await shot("all_biggest_settings")
            await pg.evaluate("for (const [k,v] of [['a11yText','0'],['a11yContrast','false'],['a11yColour','none'],['a11yHand','off']]) ACCESS.pref(k,v)")
            if errs: fails.append(f"{tag} page errors: {errs[:3]}")
            await ctx.close()
        await b.close()
    print("screens in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("access_ui: all good")

asyncio.run(main())
