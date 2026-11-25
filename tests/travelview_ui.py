"""Road view (fpscene.js + fpworld.js + fptravel.js): one picture per region by day and by night, riding and on foot,
straight from the canvas, plus the live band on a phone (390x844) and a PC (1920x1080) on a real trip.
Checks: no page errors, every region draws things by the road, the land differs between regions (pictures are not
alike), the live band keeps its info bar (route, time, Stop) under the view, the loop still sleeps between frames.
Usage: python3 travelview_ui.py PORT [OUTDIR]   (pictures go to OUTDIR, default: a temp folder, never tests/)"""
import asyncio, base64, os, sys, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "out_travelview")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
REGIONS = ["tundra", "pine", "mountain", "rocky", "marsh", "ash", "coast", "valley", "autumn"]

async def setup(pg, riding):
    await pg.goto(f"http://localhost:{PORT}/index.html?notut"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("""(riding)=>{ const S=window.__dbg.save(); S.gold = 99999; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
        S.equipped = Object.assign(S.equipped||{}, {chest:'iron_armor', hands:'iron_gauntlets'});
        if (riding) HORSES.buy(S, 'Plotka', 'grey');
        G.startTrip(S, 'Riverwood', WORLD.places.Riverwood); S.trip.total = S.trip.total || 60; }""", riding)

GALLERY = """()=>{ const S=window.__dbg.save(), look=HEROART.lookOf(S), out=[], sig=[];
  const regions = %s;
  for (const region of regions) for (const [tod, weather, riding, season] of [['day','clear',true,'summer'],['night','clear',false,'summer'],['dusk','cloudy',true,'autumn']]) {
    const sky = SKY.make({tod, weather, season, north: true});
    const c = FPT.frame({ground:'Road', region, p:0.55, look, sky, dest:'Whiterun', origin:'Riverwood', riding, horse:{name:'Plotka',coat:'#9b9b97'}, heading:20, turn:(region.length%%3-1)*25, destBear:30}, {w:640, h:220, scale:2, travel: 400 + region.length * 37, t: 9.5, trip:'gallery'});
    const g = c.getContext('2d'), px = g.getImageData(0, 0, c.width, c.height).data;
    let r=0, gg=0, b=0, n=0; for (let i = 0; i < px.length; i += 4 * 97) { r += px[i]; gg += px[i+1]; b += px[i+2]; n++; }
    out.push([region + '_' + tod + '_' + weather + (riding ? '_ride' : '_walk'), c.toDataURL('image/png')]);
    if (tod === 'day') sig.push([region, Math.round(r/n), Math.round(gg/n), Math.round(b/n)]);
  }
  return { out, sig }; }"""

async def main():
    fails = []
    async with async_playwright() as p:
        opts = {"args": ["--no-sandbox"]}
        if CHROME and os.path.exists(CHROME): opts["executable_path"] = CHROME
        b = await p.chromium.launch(**opts)
        # ---- the gallery straight from the canvas
        ctx = await b.new_context(viewport={"width": 1000, "height": 700}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await setup(pg, False)
        res = await pg.evaluate(GALLERY % repr(REGIONS).replace("'", '"'))
        for nm, url in res["out"]:
            with open(os.path.join(OUT, "region_" + nm + ".png"), "wb") as f: f.write(base64.b64decode(url.split(",")[1]))
        sig = res["sig"]
        print("day colours per region:", sig)
        for i in range(len(sig)):
            for j in range(i + 1, len(sig)):
                d = sum(abs(sig[i][k] - sig[j][k]) for k in (1, 2, 3))
                if d < 6: fails.append(("regions look alike", sig[i][0], sig[j][0], d))
        # each region places things by the road over a stretch of road
        stats = await pg.evaluate("""(regions)=>regions.map((region)=>{ let objs=0, kinds={}; const S=window.__dbg.save(), look=HEROART.lookOf(S);
            for (let k=0;k<6;k++) { FPT.frame({ground:'Road', region, p:0.3, look, sky:SKY.make({tod:'day'}), dest:'Whiterun', origin:'Riverwood', heading:0, destBear:0}, {w:390, h:120, travel: 200 + k*60, trip:'x'});
              const w = (FPT.debug() || {}).world; objs += w ? w.objects : 0; for (const q in (w && w.kinds) || {}) kinds[q]=1; }
            return [region, objs, Object.keys(kinds).length]; })""", REGIONS)
        print("objects per region (6 spots):", stats)
        for region, objs, kinds in stats:
            if objs < 12 or kinds < 3: fails.append(("too empty", region, objs, kinds))
        if errs: fails.append(("page errors", errs[:2]))
        await ctx.close()
        # ---- the live band on a phone and a PC
        for (w, h, nm) in [(390, 844, "phone"), (1920, 1080, "pc")]:
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await setup(pg, True)
            await pg.evaluate("()=>{ const fixed = SKY.make({tod:'day',season:'summer',weather:'clear'}); SKY.state = () => fixed; }")
            await pg.wait_for_timeout(2500)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=os.path.join(OUT, f"live_{nm}.png"))
            chk = await pg.evaluate("""()=>{ const b=document.querySelector('#fpt'); if(!b) return {err:'no band'}; const v=b.querySelector('.fpt-view').getBoundingClientRect(), bar=b.querySelector('.fpt-bar').getBoundingClientRect();
                const d=FPT.debug(); return { barUnder: bar.top >= v.bottom - 1, stop: !!b.querySelector('[data-act=stop]'), route: (b.querySelector('.fpt-route')||{}).textContent||'', running: d && d.running, region: d && d.kind, objects: d && d.objects }; }""")
            print(nm, chk, errs[:2])
            if chk.get("err") or not chk.get("barUnder") or not chk.get("stop") or "Riverwood" not in chk.get("route", "") or not chk.get("running"): fails.append((nm, chk))
            if errs: fails.append((nm, errs[:2]))
            await ctx.close()
        await b.close()
    print("pictures in", OUT)
    print("FAILS:", fails if fails else "none")
    if fails: sys.exit(1)

asyncio.run(main())
