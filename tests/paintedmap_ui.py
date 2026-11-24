"""Painted world map (paintedmap.js): hands the game a placeholder painting made from the reference render (the map's
own terrain, tinted, with magenta dots at every city and town at pixel (x*w, y*h)) and checks that each dot lands under
its place on the real map screen, zoomed out and zoomed in (where the 2x picture takes over). Screenshots of the
procedural map, the placeholder, zoomed in, with roads off, in tests/out_paintedmap/.
   python3 -m http.server 8765 --directory ../game &
   python3 paintedmap_ui.py 8765
"""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_paintedmap") + os.sep
os.makedirs(OUT, exist_ok=True)
CHROME = "/usr/bin/google-chrome"

PLACEHOLDER = """([key, scale, tint]) => new Promise((done) => {
  const base = WorldMap.paintBase({ scale, labels: false, compass: false, frame: false, roads: false });
  const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
  const g = c.getContext('2d'); g.filter = tint; g.drawImage(base, 0, 0); g.filter = 'none';
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = `bold ${40 * scale}px serif`; g.fillText('PLACEHOLDER ' + key, 60 * scale, 660 * scale);
  for (const [n, p] of Object.entries(WORLD.places)) if ((p[2] === 'city' || p[2] === 'town') && p[1] <= 1) {
    g.fillStyle = '#ff00ff'; g.beginPath(); g.arc(p[0] * c.width, p[1] * c.height, 2.6 * scale, 0, 7); g.fill();
  }
  ASSETS.provide(key, c.toDataURL('image/jpeg', 0.85));
  const wait = () => (ASSETS.stateOf(key) === 'ok' ? done(c.width + 'x' + c.height) : setTimeout(wait, 50)); wait();
})"""

# the map screen's current view, drawn by the real WorldMap.draw into a same-size canvas with the overlays left out
# (no icons, markers, caravans or fog over the towns): is there magenta right under every city and town on screen?
PROBE = """() => {
  const live = window.__dbg.view(), m = document.querySelector('#map');
  const c = document.createElement('canvas'); c.style.cssText = `position:fixed;left:0;top:0;width:${m.clientWidth}px;height:${m.clientHeight}px;visibility:hidden`;
  document.body.appendChild(c);
  const towns = Object.entries(WORLD.places).filter(([n, p]) => (p[2] === 'city' || p[2] === 'town') && p[1] <= 1);
  const v = { ...live, discovered: [], explored: towns.map(([n, p]) => p.slice(0, 2)), others: [], bags: [], caravans: null, guards: null, banners: [], cones: [],
    fx: null, raid: null, quest: null, mask: null, rumours: [], pins: [], tmaps: [], herbs: [], hall: null, cart: null, routes: [], route: null, trail: null, spot: null,
    rulers: [], weather: 'clear', selected: null, player: [0.02, 0.98], sight: 0, sneakRing: 0, horse: null, cleared: null };
  const roadsWere = PAINTEDMAP.roads(); PAINTEDMAP.setRoads(false);   // the game's roads run right through the towns
  WorldMap.draw(c, v); PAINTEDMAP.setRoads(roadsWere);
  const g = c.getContext('2d'), dpr = c.width / c.clientWidth, t = v.transform, res = [];
  for (const [n, p] of towns) {
    const sx = (p[0] * WorldMap.W * t.k + t.ox) * dpr, sy = (p[1] * WorldMap.H * t.k + t.oy) * dpr;
    if (sx < 4 || sy < 4 || sx > c.width - 4 || sy > c.height - 4) continue;
    const d = g.getImageData(Math.round(sx) - 1, Math.round(sy) - 1, 3, 3).data; let hit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 90 && d[i + 2] > 80 && d[i + 1] < Math.min(d[i], d[i + 2]) * 0.45) hit++;   // magenta, even under a little fog
    res.push([n, hit, [d[16], d[17], d[18]]]);
  }
  const same = JSON.stringify(t) === JSON.stringify(live.transform);
  c.remove();
  return { zoom: v.zoom, same, painted: PAINTEDMAP.image(v.zoom) ? PAINTEDMAP.image(v.zoom).naturalWidth : 0, res };
}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if os.path.exists(CHROME) else {}), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=paintedmap"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Pictor"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location=null; [S.x,S.y]=WORLD.places['Fort Greymoor'];
          window.__disc=Object.keys(WORLD.places); S.discovered=[...window.__disc];
          window.__wx=WEVENTS.weather; WEVENTS.weather=(p,t)=>({...window.__wx(p,t), id:'clear'}); if (typeof LIGHTFX!=='undefined') LIGHTFX.setLevel('off');
          const st=document.createElement('style'); st.textContent='.pban,#toast{display:none!important}'; document.head.appendChild(st); }""")
        async def clear():
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def shot(name):
            await clear(); await pg.wait_for_timeout(500)
            el = await pg.query_selector("#mapwrap") or await pg.query_selector("#map")
            await el.screenshot(path=OUT + name + ".png")
        async def probe(tag):
            r = await pg.evaluate(PROBE)
            miss = [(n, rgb) for n, h, rgb in r["res"] if h == 0]
            assert r["same"], f"{tag}: the probe's transform differs from the map screen's"
            print(f"{tag}: zoom {r['zoom']}, painting {r['painted']} px wide, {len(r['res']) - len(miss)}/{len(r['res'])} towns on their dot" + (f", missed {miss}" if miss else ""))
            assert r["res"] and not miss, f"{tag}: dots off their towns: {miss}"
            return r
        async def zoom_to(z):   # the map starts zoomed in (2.4); the + / - button switches between 1 and 2.4
            if abs(await pg.evaluate("()=>window.__dbg.view().zoom") - z) > 0.01:
                await pg.click("#zoomBtn"); await pg.wait_for_timeout(500)
        await zoom_to(1)
        await shot("1_procedural")
        ok = await pg.evaluate("()=>PAINTEDMAP.image(1)===null && PAINTEDMAP.settingsHTML(()=>'')===''")
        assert ok, "no painting: procedural map, no roads switch"
        size = await pg.evaluate(PLACEHOLDER, ["map-world", 2, "sepia(.7) saturate(1.6) hue-rotate(-15deg)"])
        print("placeholder map-world", size)
        await pg.wait_for_timeout(400)
        r = await probe("zoomed out")
        assert r["painted"] == 2000, "the 1x painting is drawn"
        assert not await pg.evaluate("()=>ASSETS.status().some(([k])=>k==='map-world-2x')"), "zoomed out: map-world-2x not asked for"
        await shot("2_painted")
        await pg.evaluate("()=>PAINTEDMAP.setRoads(false)"); await shot("3_painted_noroads"); await pg.evaluate("()=>PAINTEDMAP.setRoads(true)")
        await zoom_to(2.4)
        r = await probe("zoomed in, no 2x file")
        assert r["painted"] == 2000, "no 2x file: the 1x painting stays"
        await shot("4_painted_zoom_1x")
        size2 = await pg.evaluate(PLACEHOLDER, ["map-world-2x", 3, "sepia(.4) hue-rotate(160deg)"])
        print("placeholder map-world-2x", size2)
        await pg.wait_for_timeout(400)
        r = await probe("zoomed in, 2x")
        assert r["painted"] == 3000, "the 2x painting takes over when zoomed in"
        await shot("5_painted_zoom_2x")
        await zoom_to(1)
        r = await probe("zoomed out, 2x kept")
        assert r["painted"] == 3000, "one big picture at a time: the 2x stays"
        # a wider screen sees all of Skyrim at once
        await pg.set_viewport_size({"width": 1280, "height": 900}); await pg.wait_for_timeout(600)
        await probe("wide screen")
        await shot("6_painted_wide")
        # settings row (Graphics → Roads on the map)
        ok = await pg.evaluate("()=>{ const d=document.createElement('div'); d.innerHTML=PAINTEDMAP.settingsHTML((k,o,c)=>o.map(([v,l])=>`<button data-k=\"${k}\" data-v=\"${v}\">${l}</button>`).join('')); return d.querySelectorAll('[data-k=mapRoads]').length===2; }")
        assert ok, "settings row"
        assert not errs, errs
        await b.close()
        print("all ok")

asyncio.run(main())
