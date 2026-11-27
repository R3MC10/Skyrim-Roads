"""GPU (WebGL) fight backdrop: same picture as the 2D canvas, falls back cleanly. Usage: python glfight_ui.py PORT
1. a real fight on a phone-sized screen: the stage reports the GPU backdrop (canvas data-gl=1), no page errors
2. pixel compare, per painted scene x camera (still, zoomed, panned, tilted, shaking) x time: the backdrop drawn by
   battlescene.js through fightcam.js rows on a 2D canvas vs the same code through GLR's GPU context
   (max / mean channel difference and the share of pixels off by more than 8 of 255)
3. ?nogl=1 and Settings Classic: the old 2D path (data-gl not 1), no errors
4. a lost WebGL context: GLR gives up for the session and the fight keeps drawing the old way
Writes side-by-side PNGs to tests/out_glfight/ (2D | GPU | difference x8)."""
import asyncio, sys, os, json, base64
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
BASE = f"http://localhost:{PORT}/index.html?net=bc&notut&p=glfight"
FORCE = "&gl=force"   # skip the GPU-or-2D timing race (headless 2D canvases are software, where 2D wins) so the GPU path is what gets tested
OUT = os.path.join(os.path.dirname(__file__), "out_glfight"); os.makedirs(OUT, exist_ok=True)
INIT = "try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); } catch (e) {}"
CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
FIGHT = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""

COMPARE = r"""async (o) => {
  const ids = BSCENE.list().slice(0, o.n);
  for (const id of ids) BSCENE.prefetch(id);
  const t0 = performance.now(); while (performance.now() - t0 < 15000 && ids.some((id) => !BSCENE.ready(id) && !BSCENE.failed(id))) await new Promise((r) => setTimeout(r, 200));
  const W = 360, Hh = 238, k = 2, out = [], shots = [];
  if (o.bias) GLR._t.setBias(+o.bias);
  if (o.mip) GLR._t.setMip(o.mip === 'none' ? '' : o.mip);
  const L = GLR.layer(); if (!L.ok) return { err: 'no gpu layer', stats: GLR.stats() };
  const views = [
    ['still', (V) => V, 0, 0],
    ['zoom', (V) => ({ ...V, z: 1.18, cx: V.cx + 20, cy: V.cy - 6 }), 0, 0],
    ['pan', (V) => ({ ...V, z: 1.08, cx: V.cx - 40 }), 0, 0],
    ['tilt', (V) => ({ ...V, z: 1.12, rot: 0.025 }), 0, 0],
    ['shake', (V) => ({ ...V, z: 1.05 }), 3.2, -2.1],
  ];
  for (const id of ids) {
    const sc = BSCENE.ready(id); if (!sc) { out.push({ id, skipped: true }); continue; }
    for (const [vn, fv, sx, sy] of views) for (const t of [0, 1.37]) {
      const V = fv(FIGHTCAM.NEUTRAL(W, Hh));
      // 2D
      const c2 = document.createElement('canvas'); c2.width = W * k; c2.height = Hh * k; const g = c2.getContext('2d'); g.imageSmoothingEnabled = true;
      const Ly2 = FIGHTCAM.layers(g, k, V, sx, sy);
      if (!Ly2.flat) { g.fillStyle = '#1c2128'; g.fillRect(0, 0, c2.width, c2.height); }
      BSCENE.back(g, sc, { W, Hh, t, sky: null, lay: Ly2 });
      // GPU
      L.begin(c2.width, c2.height, Ly2.flat ? null : '#1c2128');
      BSCENE.back(L.ctx, sc, { W, Hh, t, sky: null, lay: FIGHTCAM.layers(L.ctx, k, V, sx, sy) });
      const ok = L.end();
      const c3 = document.createElement('canvas'); c3.width = c2.width; c3.height = c2.height; const g3 = c3.getContext('2d'); g3.drawImage(L.canvas, 0, 0);
      const a = g.getImageData(0, 0, c2.width, c2.height).data, b = g3.getImageData(0, 0, c2.width, c2.height).data;
      let max = 0, sum = 0, big = 0; const n = a.length;
      const dc = document.createElement('canvas'); dc.width = c2.width; dc.height = c2.height; const dg = dc.getContext('2d'); const dd = dg.createImageData(c2.width, c2.height);
      for (let i = 0; i < n; i += 4) { let m = 0; for (let j = 0; j < 3; j++) { const d = Math.abs(a[i + j] - b[i + j]); sum += d; if (d > m) m = d; } if (m > max) max = m; if (m > 8) big++; dd.data[i] = dd.data[i + 1] = dd.data[i + 2] = Math.min(255, m * 8); dd.data[i + 3] = 255; }
      dg.putImageData(dd, 0, 0);
      const r = { id, view: vn, t, ok, max, mean: +(sum / (n / 4 * 3)).toFixed(3), off8: +(100 * big / (n / 4)).toFixed(3) };
      out.push(r);
      if (t === 0 && (vn === 'still' || vn === 'tilt') && shots.length < 8) {
        const sb = document.createElement('canvas'); sb.width = c2.width * 3; sb.height = c2.height; const sg = sb.getContext('2d'); sg.drawImage(c2, 0, 0); sg.drawImage(c3, c2.width, 0); sg.drawImage(dc, c2.width * 2, 0);
        shots.push([`${id}_${vn}`, sb.toDataURL('image/png')]);
      }
    }
  }
  L.dispose();
  return { out, shots, stats: GLR.stats() };
}"""

async def start_fight(pg):
    await pg.evaluate(FIGHT); await pg.wait_for_timeout(600)
    await pg.click("#modal [data-act=ev][data-c=fight]")
    await pg.wait_for_selector("#tbf", timeout=30000); await pg.wait_for_timeout(3000)

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 360, "height": 800}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT)
        await pg.goto(BASE + FORCE); await pg.wait_for_selector(".press", timeout=90000)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Glena"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate(CLEAR)
        await pg.evaluate("()=>{ const S=window.__dbg.save(); S.level=10; G.give(S,'iron_sword'); Store.save(S); }")
        # 1. real fight on the GPU
        await start_fight(pg)
        st = await pg.evaluate("(()=>{ const c=document.querySelector('#tbf canvas[data-fs], #tbf .fstage canvas, #tbf canvas'); const all=[...document.querySelectorAll('#tbf canvas')].map(x=>x.dataset.gl||''); return { on: GLR.on(), gl: all, bs: [...document.querySelectorAll('#tbf canvas')].map(x=>x.dataset.bs||''), stats: GLR.stats() }; })()")
        print("fight:", json.dumps(st))
        if not st["on"]: fails.append("GLR not on in a normal browser")
        if "1" not in st["gl"] and any(st["bs"]): fails.append("painted fight stage didn't use the GPU backdrop")
        if not any(st["bs"]): print("note: no painted scene in this fight (drawn background) - GPU path not used here")
        await pg.screenshot(path=os.path.join(OUT, "fight_gpu.png"))
        # 2. pixel compare
        res = await pg.evaluate(COMPARE, {"n": int(os.environ.get("GLF_SCENES", "8")), "mip": os.environ.get("GLF_MIP", ""), "bias": os.environ.get("GLF_BIAS", "")})
        if res.get("err"): fails.append(res["err"])
        rows = [r for r in res.get("out", []) if not r.get("skipped")]
        for nm, url in res.get("shots", []):
            open(os.path.join(OUT, nm + ".png"), "wb").write(base64.b64decode(url.split(",", 1)[1]))
        worst = max(rows, key=lambda r: r["off8"]) if rows else None
        print(f"compared {len(rows)} frames; mean diff {sum(r['mean'] for r in rows)/max(1,len(rows)):.3f}/255; worst: {json.dumps(worst)}")
        # the grain of shrunk pictures differs a hair (mean ~1/255); shapes, colours and glows match
        for r in rows:
            if not r["ok"]: fails.append(f"GPU frame not ok {r['id']} {r['view']}")
            if r["off8"] > 3.5 or r["mean"] > 1.6: fails.append(f"looks different {r['id']} {r['view']} t={r['t']}: mean {r['mean']} off8 {r['off8']}% max {r['max']}")
        print("stats:", json.dumps(res.get("stats")))
        # 3. ?nogl=1 → old path
        pg2 = await ctx.new_page(); e2 = []; pg2.on("pageerror", lambda e: e2.append(str(e)))
        await pg2.add_init_script(INIT)
        await pg2.goto(BASE + "&nogl=1"); await pg2.wait_for_selector(".press", timeout=90000)
        await pg2.click(".press"); await pg2.click(".mi[data-t=continue]"); await pg2.wait_for_timeout(2500); await pg2.evaluate(CLEAR)
        await start_fight(pg2)
        g2 = await pg2.evaluate("(()=>({ on: GLR.on(), gl: [...document.querySelectorAll('#tbf canvas')].map(x=>x.dataset.gl||'') }))()")
        print("nogl:", json.dumps(g2))
        if g2["on"] or "1" in g2["gl"]: fails.append("?nogl=1 still used the GPU")
        if e2: fails.append("errors with nogl: " + "; ".join(e2[:3]))
        await pg2.close()
        # 3b. without forcing: the first frames are timed both ways, the quicker is kept, the fight keeps drawing
        pg3 = await ctx.new_page(); e3 = []; pg3.on("pageerror", lambda e: e3.append(str(e)))
        await pg3.add_init_script(INIT)
        await pg3.goto(BASE); await pg3.wait_for_selector(".press", timeout=90000)
        await pg3.click(".press"); await pg3.click(".mi[data-t=continue]"); await pg3.wait_for_timeout(2500); await pg3.evaluate(CLEAR)
        await start_fight(pg3)
        for _ in range(40):
            if await pg3.evaluate("!!(GLR.stats().race.fight||{}).pick"): break
            await pg3.wait_for_timeout(500)
        await pg3.wait_for_timeout(500)
        rc = await pg3.evaluate("(()=>({ race: GLR.stats().race, gl: [...document.querySelectorAll('#tbf canvas')].map(x=>x.dataset.gl||''), live: GLR.stats().live }))()")
        print("race:", json.dumps(rc))
        fr = (rc.get("race") or {}).get("fight") or {}
        if not fr.get("pick"): fails.append("the GPU-or-2D race never finished: " + json.dumps(fr))
        elif (fr["pick"] == "gpu") != ("1" in rc["gl"]): fails.append("stage doesn't follow the race's pick")
        if fr.get("pick") == "cpu" and rc["live"]: fails.append("GPU picture kept alive after 2D won")
        if e3: fails.append("errors in the race: " + "; ".join(e3[:3]))
        await pg3.close()
        # 4. context loss in a running fight → back to 2D, keeps drawing
        lost = await pg.evaluate("""async ()=>{ const L = GLR.layer(); if (!L.ok) return { skip: true, why: GLR.stats().why, on: GLR.on() };
            const x = L.canvas.getContext('webgl2').getExtension('WEBGL_lose_context'); x.loseContext(); await new Promise(r=>setTimeout(r,300));
            return { on: GLR.on(), stats: GLR.stats() }; }""")
        print("context loss:", json.dumps(lost))
        if lost.get("skip"): fails.append("context-loss test could not make a GPU layer: " + str(lost.get("why")))
        if not lost.get("skip") and lost.get("on"): fails.append("GLR still on after a lost context")
        await pg.wait_for_timeout(1500)
        after = await pg.evaluate("(()=>[...document.querySelectorAll('#tbf canvas')].map(x=>x.dataset.gl||''))()")
        print("after loss, fight canvases:", after)
        if "1" in after: fails.append("fight still on the GPU after the context was lost")
        if errs: fails.append("page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("FAILS:", fails[:12])
    print("RESULT", "OK" if not fails else "FAIL")
if __name__ == "__main__":
    asyncio.run(main())
