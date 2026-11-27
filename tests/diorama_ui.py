"""The diorama road view (diorama.js) on real routes: Whiterun tundra, Riften autumn forest, the Falkreath pine forest,
on foot and riding, day / dusk / night / snow, phone-band and PC-band sizes. It drives DIORAMA.frame into a test box the
size of the travel band for a few seconds of walking.
Checks: no page errors, the diorama drew (three.js loaded lazily, WebGL ok), trees and plants were placed, you moved along
the road, the road never climbs steeper than DIOROUTE.GRADE, the canvas isn't blank; a region without a kit (marsh) and
Road view: Classic both hand back to the classic view.
Usage: python3 diorama_ui.py PORT [OUTDIR]"""
import asyncio, base64, os, sys, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "out_diorama")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME")

RUN = """async ([o, d, region, riding, w, h, tod, weather, secs, f0, extra]) => {
  const S = window.__dbg.save(), look = HEROART.lookOf(S), A = WORLD.places[o], B = WORLD.places[d];
  const path = Terrain.route([A[0], A[1]], [B[0], B[1]]);
  let box = document.getElementById('diobox'); if (box) box.remove();
  box = document.createElement('div'); box.id = 'diobox'; box.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;z-index:99999;background:#000`;
  document.body.appendChild(box);
  const sky = SKY.make({ tod, weather, season: 'autumn', north: true });
  let i = Math.floor(path.length * (f0 ?? 0.3)), pos = path[i], t = 0, drew = 0, s0 = null;
  const info = () => ({ ...(extra || {}), pos, path, idx: i, look, sky, dest: d, origin: o, known: () => true, riding, horse: { name: 'Plotka', coat: '#9b9b97' }, id: 'me', reduce: false });
  for (let f = 0; f < secs * 30; f++) {
    // the trip moves on like the game does (≈ 0.5 map px a second on foot, more riding)
    const mv = Terrain.moveAlong(path, i, pos, 1 / 30, riding ? 1.2 : 0.5); pos = mv.pos; i = mv.idx;
    t += 1 / 30;
    if (DIORAMA.frame(box, info(), 1 / 30, t, region)) { drew++; const dbg = DIORAMA.debug(); if (s0 == null) s0 = dbg.s; }
    await new Promise((r) => setTimeout(r, 33));
  }
  const cv = box.querySelector('canvas');
  const dbg = DIORAMA.debug();
  // grade check on the route profile
  const P = DIOROUTE.profile(path, (p) => FPREAL.heightAt(p)); let worst = 0;
  for (let k = 1; k < P.pts.length; k++) { const a = P.pts[k - 1], b = P.pts[k], run = b.s - a.s; if (run > 0.01) worst = Math.max(worst, Math.abs(b.y - a.y) / run); }
  let blank = true, url = null;
  if (cv) { const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 32; const g = c2.getContext('2d'); g.drawImage(cv, 0, 0, 64, 32);
    const px = g.getImageData(0, 0, 64, 32).data; let mn = 255, mx = 0; for (let q = 0; q < px.length; q += 4) { const l = px[q] + px[q + 1] + px[q + 2]; mn = Math.min(mn, l); mx = Math.max(mx, l); } blank = mx - mn < 40; url = cv.toDataURL('image/png'); }
  const lbls = [...box.querySelectorAll('.dio-lbl')].map((e) => e.textContent);
  return { drew, dbg, moved: dbg && s0 != null ? dbg.s - s0 : 0, worst, blank, url, lbls };
}"""

async def main():
    fails = []
    async with async_playwright() as p:
        opts = {"args": ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]}
        if CHROME and os.path.exists(CHROME): opts["executable_path"] = CHROME
        b = await p.chromium.launch(**opts)
        ctx = await b.new_context(viewport={"width": 1000, "height": 700}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?notut&assets&diorama"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("localStorage.removeItem('rotn_roadview')")
        CASES = [("Whiterun", "Riverwood", "tundra", False, 390, 150, "day", "clear"),
                 ("Riften", "Ivarstead", "autumn", True, 390, 150, "dusk", "clear"),
                 ("Falkreath", "Riverwood", "pine", False, 960, 310, "day", "clear"),
                 ("Falkreath", "Riverwood", "pine", True, 960, 310, "night", "clear"),
                 ("Winterhold", "Dawnstar", "mountain", False, 960, 310, "day", "snow")]
        CASES += [("Whiterun", "Riverwood", "tundra", False, 960, 310, "day", "clear", 0.93),   # nearly there: Riverwood comes into view
                  ("Riverwood", "Whiterun", "valley", True, 960, 310, "day", "clear", 0.1), ("Solitude", "Morthal", "valley", False, 960, 310, "day", "clear", 0.4)]   # the White River and its bridge
        for c in CASES:
            (o, d, region, riding, w, h, tod, weather), f0 = c[:8], (c[8] if len(c) > 8 else 0.3)
            r = await pg.evaluate(RUN, [o, d, region, riding, w, h, tod, weather, 4, f0, None])
            tag = f"{region}_{'ride' if riding else 'walk'}_{tod}_{weather}_{w}_{int(f0*100)}"
            if r["url"]:
                with open(os.path.join(OUT, tag + ".png"), "wb") as f: f.write(base64.b64decode(r["url"].split(",")[1]))
            dbg = r["dbg"] or {}
            print(tag, "drew", r["drew"], "moved %.1f m" % r["moved"], "props", dbg.get("props"), "worst grade %.3f" % r["worst"], "ms", round(dbg.get("ms") or 0, 1), "places", (dbg.get("places") or [])[:6], "labels", r["lbls"], "rivers", dbg.get("rivers"), "bridges", dbg.get("bridges"), "lake", dbg.get("lake"))
            if not dbg.get("places"): fails.append((tag, "no places round you"))
            if f0 > 0.9 and d not in r["lbls"] and (d + " \u203a") not in r["lbls"]: fails.append((tag, "the destination should be labelled", r["lbls"]))
            if r["drew"] < 30: fails.append((tag, "diorama hardly drew", r["drew"]))
            if r["blank"]: fails.append((tag, "blank picture"))
            if sum((dbg.get("props") or {}).values()) < 20: fails.append((tag, "nothing grows", dbg.get("props")))
            if r["moved"] <= 0.3 and f0 < 0.9: fails.append((tag, "you didn't move along the road", r["moved"]))
            if r["worst"] > 0.1001: fails.append((tag, "road too steep", r["worst"]))
            if dbg.get("riding") != riding: fails.append((tag, "riding flag", dbg.get("riding")))
        # nothing moves when the land is rebuilt: draw at one spot, then 40 m further on, and compare every cut-out and
        # place in the overlap; and no place ever stands in water
        STAB = """async ([o, d, region, fa, fb]) => {
          const S = window.__dbg.save(), look = HEROART.lookOf(S), A = WORLD.places[o], B = WORLD.places[d];
          const path = Terrain.route([A[0], A[1]], [B[0], B[1]]);
          let box = document.getElementById('diobox'); if (box) box.remove();
          box = document.createElement('div'); box.id = 'diobox'; box.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:310px;z-index:99999'; document.body.appendChild(box);
          const snapAt = async (f) => { const i = Math.floor(path.length * f), info = { pos: path[i], path, idx: i, look, sky: null, dest: d, origin: o, known: () => true, id: 'me' };
            DIORAMA.detach(); for (let k = 0; k < 200 && !DIORAMA.frame(box, info, 0, 0, region); k++) await new Promise((r) => setTimeout(r, 30));
            for (let k = 0; k < 5; k++) { DIORAMA.frame(box, info, 0, 0, region); await new Promise((r) => setTimeout(r, 30)); }
            return DIORAMA._snap(); };
          const a = await snapAt(fa), b = await snapAt(fb);
          const mx = (a.patch[0] + b.patch[0]) / 2, mz = (a.patch[1] + b.patch[1]) / 2, gap = Math.hypot(a.patch[0] - b.patch[0], a.patch[1] - b.patch[1]);
          const inBox = (p) => Math.abs(p[1] - mx) < 45 && Math.abs(p[3] - mz) < 45;
          const key = (p) => p[0] + ':' + p[1].toFixed(2) + ',' + p[2].toFixed(2) + ',' + p[3].toFixed(2);
          const A1 = new Set(a.props.filter(inBox).map(key)), B1 = new Set(b.props.filter(inBox).map(key));
          const onlyA = [...A1].filter((k) => !B1.has(k)), onlyB = [...B1].filter((k) => !A1.has(k));
          const pb = Object.fromEntries(b.places.map((p) => [p.name, p]));
          const moved = a.places.filter((p) => pb[p.name] && Math.hypot(p.x - pb[p.name].x, p.y - pb[p.name].y, p.z - pb[p.name].z) > 0.01).map((p) => p.name);
          const wet = [...a.places, ...b.places].filter((p) => p.wet).map((p) => p.name);
          const overlap = []; for (const L of [a.places, b.places]) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z) < (L[i].rad + L[j].rad) * 0.8) overlap.push(L[i].name + ' / ' + L[j].name);
          for (const L of [a.places, b.places]) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (Math.abs(L[i].s - L[j].s) < (L[i].rad + L[j].rad) * 0.9 && Math.abs(L[i].d - L[j].d) < 160) overlap.push('behind: ' + L[i].name + ' / ' + L[j].name);
          return { gap, n: A1.size, onlyA: onlyA.length, onlyB: onlyB.length, moved, wet, overlap, lakes: [a.lake, b.lake] };
        }"""
        # the towns at either end of a trip are always shown
        r = await pg.evaluate("""async () => { const A = WORLD.places.Riverwood, B = WORLD.places.Whiterun, path = Terrain.route([A[0], A[1]], [B[0], B[1]]);
          const box = document.getElementById('diobox') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'diobox' }); box.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:310px;z-index:99999';
          DIORAMA.detach(); const info = { pos: path[2], path, idx: 2, look: HEROART.lookOf(window.__dbg.save()), dest: 'Whiterun', origin: 'Riverwood', id: 'me' };
          for (let k = 0; k < 200 && !DIORAMA.frame(box, info, 0, 0, 'valley'); k++) await new Promise((r) => setTimeout(r, 30));
          const pl = DIORAMA._snap().places, rw = pl.find((p) => p.name === 'Riverwood'), [mx, mz] = DIOROUTE.toWorld(A);
          const P = DIOROUTE.profile(path, (q) => FPREAL.heightAt(q)), camSide = pl.filter((p) => { const n = DIOROUTE.near(P, p.x, p.z); return n.side > 0 && n.d < p.rad + 44; }).map((p) => p.name);
          return { names: pl.map((p) => p.name), off: rw ? Math.hypot(rw.x - mx, rw.z - mz) : null, camSide }; }""")
        if r["camSide"]: fails.append(("ends", "places close by on the camera's side of the road", r["camSide"]))
        if "Riverwood" not in r["names"]: fails.append(("ends", "Riverwood should be shown at the start of the trip", r["names"][:8]))
        elif r["off"] > 60: fails.append(("ends", "Riverwood moved too far from where it is on the map", round(r["off"])))
        print("Riverwood stands", r["off"] and round(r["off"]), "m from its map spot")
        for (o, d, region, fa, fb) in [("Riverwood", "Whiterun", "valley", 0.05, 0.16), ("Whiterun", "Riverwood", "tundra", 0.7, 0.82), ("Riften", "Ivarstead", "autumn", 0.3, 0.38), ("Solitude", "Morthal", "valley", 0.35, 0.42)]:
            r = await pg.evaluate(STAB, [o, d, region, fa, fb])
            print("stable", o, d, r)
            if r["n"] < 20: fails.append(("stable " + o, "too few cut-outs to compare", r["n"]))
            if r["onlyA"] or r["onlyB"]: fails.append(("stable " + o, "cut-outs moved or popped when the land was rebuilt", r["onlyA"], r["onlyB"]))
            if r["moved"]: fails.append(("stable " + o, "places moved", r["moved"]))
            if r["wet"]: fails.append(("stable " + o, "places standing in water", r["wet"]))
            if r["overlap"]: fails.append(("stable " + o, "places overlapping", r["overlap"][:5]))
        # travelling together: a party (one riding), a follower and a dog behind you; then something stops you on the road
        PARTY = {"company": [{"name": "Beta", "player": True, "riding": True, "horse": "#ebe6da", "look": {"r": "redguard", "eq": {"chest": "steel_armor", "weapon": "steel_sword"}}},
                             {"name": "Gamma", "player": True, "riding": False, "look": {"r": "dunmer", "eq": {"chest": "leather_armor", "weapon": "hunting_bow"}}},
                             {"name": "Lydia", "follower": True, "look": {"r": "nord", "eq": {"chest": "steel_armor", "weapon": "steel_sword"}}}],
                 "pets": [{"name": "Meeko", "pet": True, "kind": "dog"}]}
        for (tag, extra, need) in [("party", PARTY, None), ("toll", {**PARTY, "stop": {"id": "toll"}}, "foe-bandit"), ("wolves", {"stop": {"foe": "Wolf", "kind": "wolf", "n": 2}}, "foe-wolf"),
                                   ("pilgrims", {"stop": {"id": "pilgrims"}}, "nord")]:
            r = await pg.evaluate(RUN, ["Falkreath", "Riverwood", "pine", False, 960, 310, "day", "clear", 3, 0.4, extra])
            dbg = r["dbg"] or {}
            if r["url"]:
                with open(os.path.join(OUT, "company_" + tag + ".png"), "wb") as f: f.write(base64.b64decode(r["url"].split(",")[1]))
            print("company", tag, dbg.get("company"), dbg.get("pets"), dbg.get("cast"))
            if extra.get("company") and dbg.get("company") != ["+Beta", "Gamma", "Lydia"]: fails.append((tag, "company not drawn", dbg.get("company")))
            if extra.get("pets") and dbg.get("pets") != ["Meeko"]: fails.append((tag, "pet not drawn", dbg.get("pets")))
            if need and need not in (dbg.get("cast") or []): fails.append((tag, "the road event's cast is missing", dbg.get("cast")))
        # no kit for the marsh, and Road view: Classic → the classic view draws
        r = await pg.evaluate(RUN, ["Morthal", "Solitude", "marsh", False, 390, 150, "day", "clear", 1, 0.3, None])
        if r["drew"]: fails.append(("marsh", "should keep the classic view"))
        await pg.evaluate("DIORAMA.setMode('classic')")
        r = await pg.evaluate(RUN, ["Falkreath", "Riverwood", "pine", False, 390, 150, "day", "clear", 1, 0.3, None])
        if r["drew"]: fails.append(("classic", "Road view: Classic should keep the classic view"))
        await pg.evaluate("DIORAMA.setMode('diorama')")
        # the setting is in Settings → Look
        html = await pg.evaluate("DIORAMA.settingsHTML((k, opts, cur) => opts.map(o => o[1]).join('|'))")
        if "Diorama" not in html or "Classic" not in html: fails.append(("settings", html))
        await b.close()
    if errs: fails.append(("page errors", errs[:5]))
    print("pictures in", OUT)
    print("RESULT", "OK" if not fails else "FAIL")
    for f in fails: print("FAIL", f)

asyncio.run(main())
