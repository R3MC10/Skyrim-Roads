"""First-person travel band (fptravel.js): while travelling, the trip is a band at the top of the map with the compass
along its top edge. Checks riding / on foot, with and without a follower, male and female hero, at phone 360/390 and
PC 1440/1920: the band is on screen, inside the map, nothing in its bar is cut off, the compass sits over it, the old
floating card is gone, folding works. Also saves a gallery of regions, day/night, riding/walking straight from the canvas.
Usage: python3 fptravel_ui.py PORT [OUTDIR]   (pictures go to OUTDIR, default: a temp folder, never tests/)"""
import asyncio, base64, os, sys, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "out_fptravel")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)

SIZES = [(360, 760), (390, 844), (1440, 900), (1920, 1080)]
CASES = [  # name, riding, follower, sex, sky
    ("ride_fol_m_day", True, True, "m", "{tod:'day',season:'summer',weather:'clear'}"),
    ("foot_f_snow", False, False, "f", "{tod:'day',season:'winter',weather:'snow',cold:true}"),
    ("ride_f_night", True, False, "f", "{tod:'night',season:'autumn',weather:'clear',north:true,moon:4}"),
    ("foot_fol_m_dusk", False, True, "m", "{tod:'dusk',season:'summer',weather:'rain'}"),
]

CHECK = """() => {
  const b = document.querySelector('#fpt'), mw = document.querySelector('#mapwrap'), comp = document.querySelector('#compass');
  if (!b) return { err: 'no band' };
  const r = b.getBoundingClientRect(), m = mw.getBoundingClientRect(), out = [];
  if (r.width < 200 || r.height < 40) out.push('band too small ' + r.width + 'x' + r.height);
  if (r.left < m.left - 1 || r.right > m.right + 1 || r.left < 0 || r.right > innerWidth + 0.5 || r.top < 0) out.push('band outside the map/screen');
  for (const el of b.querySelectorAll('.fpt-b, .fpt-t, .fpt-route, .fpt-prog')) { const q = el.getBoundingClientRect(); if (q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5) out.push('cut off: ' + el.className); }
  const rt = b.querySelector('.fpt-route'); if (rt && rt.scrollWidth > rt.clientWidth + 1 && !rt.querySelector('span')) out.push('route overflows');
  if (comp) { const c = comp.getBoundingClientRect(); if (c.top < r.top - 1 || c.bottom > r.top + 60 || c.left < r.left - 1 || c.right > r.right + 1) out.push('compass not on the band top edge'); }
  const card = document.querySelector('#trip .trip'); if (card) out.push('old trip card still shown');
  if (!b.querySelector('[data-act=stop]')) out.push('no Stop button');
  const d = FPT.debug();
  return { out, band: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], debug: d && { kind: d.kind, riding: d.riding, objects: d.objects, tod: d.tod } };
}"""

async def setup(pg, riding, fol, sex):
    await pg.goto(f"http://localhost:{PORT}/index.html?notut"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("""([riding, fol, sex])=>{ const S=window.__dbg.save(); S.sex = sex === 'f' ? 'f' : ''; S.gold = 99999; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
        S.equipped = Object.assign(S.equipped||{}, {chest:'iron_armor', hands:'iron_gauntlets'});
        if (riding) { HORSES.buy(S, 'Plotka', 'grey'); }
        if (fol) { S.location = TOWNS.FOLLOWERS.jenassa[1]; TOWNS.hire(S, 'jenassa'); S.location='Whiterun'; }
        G.startTrip(S, 'Riverwood', WORLD.places.Riverwood); S.trip.total = S.trip.total || 60; }""", [riding, fol, sex])

async def main():
    fails = []
    async with async_playwright() as p:
        opts = {"args": ["--no-sandbox"]}
        if CHROME and os.path.exists(CHROME): opts["executable_path"] = CHROME
        b = await p.chromium.launch(**opts)
        for (w, h) in SIZES:
            for name, riding, fol, sex, sky in CASES:
                if w in (360, 1440) and name not in ("ride_fol_m_day", "foot_f_snow"): continue   # the in-between sizes: two cases are enough
                ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
                pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
                await setup(pg, riding, fol, sex)
                await pg.evaluate("(sky)=>{ const fixed = SKY.make(eval('('+sky+')')); SKY.state = () => fixed; }", sky)
                await pg.wait_for_timeout(2200)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.wait_for_timeout(400)
                res = await pg.evaluate(CHECK)
                shot = os.path.join(OUT, f"{w}_{name}.png"); await pg.screenshot(path=shot)
                bad = res.get("out", [res.get("err")]) if res else ["no result"]
                if riding and res.get("debug") and not res["debug"]["riding"]: bad.append("not drawn riding")
                print(w, name, res.get("band"), res.get("debug"), "OK" if not bad else bad, errs[:2])
                if bad or errs: fails.append((w, name, bad, errs[:2]))
                if w == 390 and name == "ride_fol_m_day":   # fold, check the bar alone, unfold
                    await pg.click("#fpt [data-act=fpttoggle]"); await pg.wait_for_timeout(300)
                    shut = await pg.evaluate("()=>({shut: document.querySelector('#fpt').classList.contains('shut'), h: document.querySelector('#fpt').getBoundingClientRect().height, run: FPT.debug().running})")
                    await pg.screenshot(path=os.path.join(OUT, f"{w}_{name}_folded.png"))
                    print("folded", shut)
                    if not shut["shut"] or shut["h"] > 140 or shut["run"]: fails.append((w, "fold", shut))
                    await pg.click("#fpt [data-act=fpttoggle]"); await pg.wait_for_timeout(300)
                await ctx.close()
        # a gallery of regions, times and gaits straight from the canvas
        ctx = await b.new_context(viewport={"width": 1000, "height": 700}); pg = await ctx.new_page()
        await setup(pg, False, False, "m")
        shots = await pg.evaluate("""()=>{ const S=window.__dbg.save(), look=HEROART.lookOf(S), out=[];
            const cases=[['Pine forest','day','summer','clear','Falkreath',false,20],['Tundra','dusk','summer','clear','Whiterun',true,-30],['Autumn forest','day','autumn','clear','Riften',true,0],
              ['Marsh','dawn','spring','fog','Morthal',false,35],['Snow','night','winter','blizzard','Winterhold',true,-15],['Volcanic tundra','day','summer','ashstorm','Fort Greymoor',false,10],
              ['Road','night','summer','clear','Whiterun',false,0],['Rocky hills','day','spring','storm','Markarth',true,40],['River (ford)','day','summer','clear','Riverwood',false,-20],['Bridge','dusk','autumn','cloudy','Solitude',true,0]];
            for (const [ground,tod,season,weather,dest,riding,turn] of cases) { const sky=SKY.make({tod,season,weather,north:true});
              const c=FPT.frame({ground,p:0.7,look,sky,dest,riding,horse:{name:'Plotka',coat:'#9b9b97'},heading:0,turn,destBear:8}, {w:640,h:200,scale:2}); out.push([ground+'_'+tod+'_'+weather+(riding?'_ride':'_walk'), c.toDataURL('image/png')]); }
            const sea=FPT.frame({ground:'Sea',boat:true,p:0.4,look,sky:SKY.make({tod:'day',weather:'cloudy'}),heading:0}, {w:640,h:200,scale:2}); out.push(['ship', sea.toDataURL('image/png')]);
            return out; }""")
        for nm, url in shots:
            path = os.path.join(OUT, "gallery_" + "".join(ch for ch in nm if ch.isalnum() or ch in "_-") + ".png")
            with open(path, "wb") as f: f.write(base64.b64decode(url.split(",")[1]))
        print("gallery:", len(shots), "frames in", OUT)
        await b.close()
    print("FAILS:", fails if fails else "none")
    if fails: sys.exit(1)

asyncio.run(main())
