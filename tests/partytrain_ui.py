"""Party train screen test (partytrain.js + map.js): a party of 4 travelling together is drawn as a line on the
world map (leader in front, the rest one behind another on the road), and standing in a town they line up in a row
beside the town's icon. A stranger on the same spot keeps the old place. Phone and PC, zoomed in and out.
The party members are put into the map's view by wrapping WorldMap.draw (no second phone needed).
Run:  node tests/serve.js 9571 game   then   python tests/partytrain_ui.py 9571 [outdir]
Fails on page errors, if the line isn't drawn, or if two party figures stand closer than ~30 screen px."""
import asyncio, os, sys, tempfile, math
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9571"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "partytrain_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky,.toast,.ach,.achpop,[class*=achiev]').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
PLACE = """(t)=>{ const S=__dbg.save(); S.location=t; S.trip=null; [S.x,S.y]=WORLD.places[t]; for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n); __ui.go('map'); }"""
# three party members (and one stranger) standing where you stand: the map has to spread them out
FAKE = """(lead)=>{ window.__pt = { lead }; if (window.__ptOn) return; window.__ptOn = 1; const real = WorldMap.draw;
  WorldMap.draw = function (cv, v) {
    const S = __dbg.save(), mates = [["p1","Kacper","imperial"],["p2","Lydia","nord"],["p3","Brynjolf","breton"]];
    const leadId = __pt.lead === 'me' ? S.id : 'p1';
    v.party = { leader: leadId, ids: [leadId, ...[S.id, 'p1', 'p2', 'p3'].filter((x) => x !== leadId)] };
    v.me = S.id;
    v.others = [...mates.map(([id, name, r]) => ({ id, name: name + ' ⚑', party: true, pos: [...v.player], atPlace: v.atPlace, moving: v.moving, look: { r, id: name, eq: {}, gl: {} }, race: r, trail: id === leadId ? (S.trip?.trail || []).concat([v.player]) : null })),
      { id: 'x1', name: 'Stranger', stranger: true, pos: [v.player[0] + 0.004, v.player[1] + 0.004], atPlace: false, moving: false }];
    return real.call(this, cv, v);
  }; }"""
SPOTS = """()=>{ const v=__dbg.view(), t=v.transform, r=document.getElementById('map').getBoundingClientRect(), H=WorldMap.H, W=WorldMap.W;
  const st = WorldMap.stats ? WorldMap.stats() : {};
  const m = st.meAt || v.player;
  return { train: st.train, me: [r.left + m[0]*W*t.k + t.ox, r.top + m[1]*H*t.k + t.oy],
    others: v.others.map((o)=>({ id:o.id, party:!!o.party, x: r.left + (o.drawX ?? o.pos[0])*W*t.k + t.ox, y: r.top + (o.drawY ?? o.pos[1])*H*t.k + t.oy })) }; }"""

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for tag, vw, vh, dsf in [("phone", 390, 844, 2), ("pc", 1920, 1080, 1)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dsf)
            errs = []
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=local&notut&p=pt{tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "R3MC10"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(CLEAR); await pg.evaluate(PLACE, "Whiterun"); await pg.evaluate(CLEAR)

            async def shot(name, check_line):
                await pg.evaluate(CLEAR); await pg.wait_for_timeout(900)
                sp = await pg.evaluate(SPOTS)
                party = [o for o in sp["others"] if o["party"]]
                pts = [sp["me"]] + [[o["x"], o["y"]] for o in party]
                if check_line:
                    if (sp.get("train") or 0) < 4: fails.append(f"{tag} {name}: train has {sp.get('train')} (want 4)")
                    dmin = min(math.dist(a, c) for i, a in enumerate(pts) for c in pts[i + 1:])
                    print(tag, name, "train", sp.get("train"), "closest party figures", round(dmin), "px")
                    if dmin < 29: fails.append(f"{tag} {name}: party figures only {dmin:.0f} px apart")
                el = await pg.query_selector("#mapwrap") or await pg.query_selector("#map")
                await el.screenshot(path=os.path.join(OUT, f"partytrain_{tag}_{name}.png"))
                xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
                cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
                wv = max(260, max(xs) - min(xs) + 200); hv = max(200, max(ys) - min(ys) + 180)
                await pg.screenshot(path=os.path.join(OUT, f"partytrain_{tag}_{name}_close.png"),
                                    clip={"x": max(0, cx - wv / 2), "y": max(0, cy - hv / 2 - 20), "width": min(wv, vw), "height": min(hv, vh)})

            await shot("before_alone", False)
            await pg.evaluate(FAKE, "me")
            await shot("town", True)
            await pg.evaluate("()=>{ const S=__dbg.save(); S.location=null; G.startTrip(S, 'Riverwood', WORLD.places['Riverwood'].slice(0,2)); }")
            await pg.evaluate("()=>{ const S=__dbg.save(); S.trip.lastTick -= 90; }")   # 90 s down the road, so there's road behind
            await pg.wait_for_timeout(4000)
            await pg.evaluate("()=>{ const S=__dbg.save(), z = Math.max(__dbg.view().zoom, 3); __dbg.setView(z, __dbg.view().player); }")
            await shot("road_lead", True)
            await pg.evaluate("()=>{ window.__pt.lead='p1'; }")
            await shot("road_member", True)
            await pg.click("#zoomBtn"); await pg.wait_for_timeout(600)
            await shot("road_zoomed_out", True)
            if errs: fails.append(f"{tag} page errors: {errs[:3]}")
            await ctx.close()
        await b.close()
    print("shots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("partytrain_ui ok")

asyncio.run(main())
