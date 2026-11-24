"""Accessibility screen sweep (access.js): the main screens at Huge text, Small text and in each colour-blind mode,
on a phone and on a PC. Fails on page errors, sideways scrolling and controls that stick out or clip their text.
Also checks the colour-blind shapes/patterns show up and that Easy timing reaches the mining game.
Run:  py -m http.server 9151 --directory game   then   py tests/a11y_screens_ui.py 9151 [outdir]"""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "a11y_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky,#minegame').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
OVERFLOW = """(()=>{ const W=innerWidth, bad=[];
  for (const e of document.querySelectorAll('button,.btn,.seg,.setrow,.tab,.item,.sheet,.panel,h2,h3,.top,.vitals,.mapbtns,.twbtn,.favbtn,.hb')) {
    const r=e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs=getComputedStyle(e); if (cs.visibility==='hidden' || cs.display==='none') continue;
    if (e.closest('.hide')) continue;
    let sc=false; for (let a=e.parentElement; a && a!==document.body; a=a.parentElement) { const o=getComputedStyle(a).overflowX; if (o==='auto'||o==='scroll') { sc=true; break; } }
    if (sc) continue;
    if (r.right > W + 1 || r.left < -1) bad.push((e.id||e.className||e.tagName)+' x '+Math.round(r.left)+'..'+Math.round(r.right));
    else if (e.matches('.seg button,.tab,.setrow > span') && e.scrollWidth > e.clientWidth + 2) bad.push('clipped '+(e.textContent||'').trim().slice(0,20));
  }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) bad.push('page scrolls sideways '+document.documentElement.scrollWidth);
  return bad; })()"""
CONFIGS = [  # name, a11yText, colour mode
    ("huge", "3", "none"), ("small", "-1", "none"), ("protan", "0", "protan"), ("deutan", "0", "deutan"), ("tritan", "0", "tritan"), ("huge_deutan", "3", "deutan"),
]
VIEWS = [("phone", 390, 844), ("pc", 1440, 900)]
TABS = ["map", "hero", "pack", "town", "log"]


async def main():
    fails, shots = [], 0
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for vname, vw, vh in VIEWS:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1, has_touch=vname == "phone")
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut"); await pg.wait_for_timeout(1200)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrolfdir"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(CLEAR)
            # a few items so the pack has rows with colours (rarity) and the journal has something
            await pg.evaluate("()=>{const S=window.__dbg.save(); const seen={}; for (const id of Object.keys(D.ITEMS)) { const t=CC.tier(id); if (!seen[t] && !S.inv.some(r=>r.item===id)) { seen[t]=1; G.give(S,id); } } }")

            async def shot(name):
                nonlocal shots
                await pg.wait_for_timeout(350)
                await pg.screenshot(path=os.path.join(OUT, f"{vname}_{name}.png")); shots += 1
                bad = await pg.evaluate(OVERFLOW)
                if bad: fails.append(f"{vname} {name}: {bad[:6]}")

            for cname, size, mode in CONFIGS:
                await pg.evaluate(f"ACCESS.pref('a11yText','{size}'); ACCESS.pref('a11yColour','{mode}')"); await pg.wait_for_timeout(250)
                for t in TABS:
                    await pg.evaluate(CLEAR)
                    await pg.evaluate(f"document.querySelector('[data-tab={t}]')?.click()"); await pg.wait_for_timeout(350)
                    await shot(f"{cname}_{t}")
                    await pg.evaluate(CLEAR)
                await pg.evaluate("document.querySelector('[data-tab=map]')?.click()"); await pg.wait_for_timeout(250)
                await pg.click("#sndBtn"); await pg.wait_for_timeout(300)
                await pg.evaluate("[...document.querySelectorAll('#modal h3')].find(h=>/Accessibility/.test(h.textContent))?.scrollIntoView({block:'start'})")
                await shot(f"{cname}_settings")
                if mode != "none":
                    sym = await pg.evaluate("(()=>{const n=document.querySelector('.hb.hp small.num'); return n ? getComputedStyle(n,'::before').content : null})()")
                    pat = await pg.evaluate("(()=>{const i=document.querySelector('.hb.mp .track i'); return i ? getComputedStyle(i).backgroundImage : ''})()")
                    if sym is not None and ("2665" not in sym.encode("unicode_escape").decode() and "♥" not in sym): fails.append(f"{vname} {cname}: no health symbol ({sym!r})")
                    if pat and "repeating-linear-gradient" not in pat: fails.append(f"{vname} {cname}: magicka bar has no pattern")
                    d = await pg.evaluate("(()=>{const s=document.createElement('span'); s.className='danger-high'; s.textContent='x'; document.body.appendChild(s); const c=getComputedStyle(s,'::before').content; s.remove(); return c})()")
                    if "⚠" not in d: fails.append(f"{vname} {cname}: danger has no shape ({d!r})")
                await pg.evaluate(CLEAR)
                print(vname, cname, "ok")
            await pg.evaluate("ACCESS.pref('a11yText','0'); ACCESS.pref('a11yColour','none')")
            # Easy timing: tap it in Settings, then the mining band is wider than without
            await pg.click("#sndBtn"); await pg.wait_for_timeout(300)
            await pg.click("#modal [data-k=a11yTiming][data-v=true]"); await pg.wait_for_timeout(200)
            if not await pg.evaluate("A11Y.timingEase()===1.5 && JSON.parse(localStorage.getItem('rotn_prefs')).a11yTiming===true"): fails.append(f"{vname}: Easy timing tap did not stick")
            await pg.evaluate(CLEAR)
            wide = await pg.evaluate("(()=>{ const r=()=>0.5; const a=MINEGAME.zone(30,r).good; ACCESS.pref('a11yTiming','false'); const b=MINEGAME.zone(30,r).good; ACCESS.pref('a11yTiming','true'); return [a,b]; })()")
            if not wide[0] > wide[1] * 1.3: fails.append(f"{vname}: mining band not wider {wide}")
            print(vname, "mining band easy/normal", wide)
            await pg.evaluate("ACCESS.pref('a11yTiming','false')")
            if errs: fails.append(f"{vname} page errors: {errs[:3]}")
            await ctx.close()
        await b.close()
    print(shots, "screens in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("a11y_screens_ui: all good")

asyncio.run(main())
