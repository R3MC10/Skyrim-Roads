"""Where the time goes, per scene, without guessing. Usage: python perf_probe.py PORT [OUT_JSON]
Same phone setup as perf_ui.py (360x800 @2x, CPU x4 unless PERF_RATE, PERF_DPR=3 for 412x915@3x). For each scene it records:
  - a CPU profile (100 us sampling): top functions by own time and by total time (game files only)
  - counters from wrapped browser APIs: drawImage calls and pixels drawn, toDataURL calls (+ who called), getImageData,
    measureText, gradients, shadowBlur/filter use, innerHTML writes per element, style/layout reads (getBoundingClientRect,
    offsetWidth...), timers started, store events
Scenes: title, hub, map_idle, map_pan, map_zoom, travel, menus (open Items/Magic/Journal/Hero + scroll), fight_idle,
fight_attack (your attack plays), fight_foe (foe turn), fight_party (follower + summon)."""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from perf_ui import top_self, top_total, INIT as PINIT, CLEAR

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else None
RATE = float(os.environ.get("PERF_RATE", "4")); DPR = float(os.environ.get("PERF_DPR", "2"))
VW, VH = (412, 915) if DPR >= 3 else (360, 800)
SECS = float(os.environ.get("PERF_SECS", "4"))
URL = f"http://localhost:{PORT}/index.html?net=bc&notut&p=perfprobe"
PROBE = PINIT + r"""
(() => {
  const C = window.__pc = { reset() { for (const k of Object.keys(this)) if (typeof this[k] !== 'function') delete this[k]; this.html = {}; this.durl = {}; this.di = 0; this.dipx = 0; this.dibig = {}; },
    html: {}, durl: {}, di: 0, dipx: 0, dibig: {} };
  const inc = (k, n = 1) => { C[k] = (C[k] || 0) + n; };
  const who = () => { const s = (new Error().stack || '').split('\n').slice(3, 6).map((l) => (l.match(/\/([^\/]+\.js):(\d+)/) || [])[0] || '').filter(Boolean).join(' < '); return s || '?'; };
  const P2 = CanvasRenderingContext2D.prototype;
  const di = P2.drawImage; P2.drawImage = function (im, ...a) { C.di++;
    let w = 0, h = 0; if (a.length >= 4) { w = a[a.length === 8 ? 6 : 2]; h = a[a.length === 8 ? 7 : 3]; } else { w = im.width || im.naturalWidth || 0; h = im.height || im.naturalHeight || 0; }
    const t = this.getTransform ? this.getTransform() : null, sx = t ? Math.hypot(t.a, t.b) : 1, sy = t ? Math.hypot(t.c, t.d) : 1;
    const px = Math.abs(w * h * sx * sy); C.dipx += px;
    if (px > 200000) { const k = who(); C.dibig[k] = (C.dibig[k] || 0) + px; }
    return di.call(this, im, ...a); };
  for (const [n, k] of [['getImageData', 'getImageData'], ['measureText', 'measureText'], ['createLinearGradient', 'gradient'], ['createRadialGradient', 'gradient'], ['putImageData', 'putImageData'], ['fillText', 'fillText'], ['strokeText', 'strokeText']]) {
    const o = P2[n]; P2[n] = function (...a) { inc(k); if (k === 'getImageData') { const kk = 'gid:' + who(); inc(kk); } return o.apply(this, a); }; }
  const sb = Object.getOwnPropertyDescriptor(P2, 'shadowBlur'); Object.defineProperty(P2, 'shadowBlur', { set(v) { if (v) inc('shadowBlur'); sb.set.call(this, v); }, get() { return sb.get.call(this); } });
  const fl = Object.getOwnPropertyDescriptor(P2, 'filter'); if (fl) Object.defineProperty(P2, 'filter', { set(v) { if (v && v !== 'none') { inc('filter'); inc('filter:' + who()); } fl.set.call(this, v); }, get() { return fl.get.call(this); } });
  const tdu = HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL = function (...a) { const k = who(); C.durl[k] = (C.durl[k] || 0) + 1; inc('toDataURLpx', this.width * this.height); return tdu.apply(this, a); };
  const ih = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'); Object.defineProperty(Element.prototype, 'innerHTML', { set(v) { const id = (this.id || this.className || this.tagName).toString().slice(0, 30) + ' @' + who().split(' < ')[0]; C.html[id] = (C.html[id] || 0) + 1; inc('htmlChars', (v || '').length); ih.set.call(this, v); }, get() { return ih.get.call(this); } });
  for (const n of ['getBoundingClientRect', 'getClientRects']) { const o = Element.prototype[n]; Element.prototype[n] = function (...a) { inc('rectReads'); return o.apply(this, a); }; }
  for (const n of ['offsetWidth', 'offsetHeight', 'offsetLeft', 'offsetTop', 'clientWidth', 'clientHeight']) { const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, n) || Object.getOwnPropertyDescriptor(Element.prototype, n); if (d && d.get) Object.defineProperty(d === Object.getOwnPropertyDescriptor(Element.prototype, n) ? Element.prototype : HTMLElement.prototype, n, { get() { inc('layoutReads'); return d.get.call(this); }, configurable: true }); }
  const gcs = window.getComputedStyle; window.getComputedStyle = function (...a) { inc('computedStyle'); return gcs.apply(this, a); };
  const st = window.setTimeout; window.setTimeout = function (f, ms, ...a) { inc('timeouts'); return st.call(this, f, ms, ...a); };
  const raf = window.requestAnimationFrame; window.requestAnimationFrame = function (f) { inc('rafs'); return raf.call(this, f); };
  C.reset();
})();
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"] + os.environ.get("PERF_ARGS", "").split())
        ctx = await b.new_context(viewport={"width": VW, "height": VH}, device_scale_factor=DPR, has_touch=True)
        if os.environ.get("PERF_ENGINE"):   # Graphics engine: auto / gpu / classic
            await ctx.add_init_script(f"""try {{ const p = JSON.parse(localStorage.getItem('rotn_prefs') || '{{}}'); p.gfxEngine = '{os.environ["PERF_ENGINE"]}'; localStorage.setItem('rotn_prefs', JSON.stringify(p)); }} catch (e) {{}}""")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.add_init_script(PINIT)
        await pg.goto(URL); await pg.wait_for_selector(".press")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Probe"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate(CLEAR)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.level=12; S.gold=900; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
          for (const n of Object.keys(WORLD.places).slice(0, 120)) if (!S.discovered.includes(n)) S.discovered.push(n);
          G.give(S,'iron_sword'); G.give(S,'potion_health',3); Store.save(S); }""")
        await pg.wait_for_timeout(800); await pg.close()
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.add_init_script(PROBE)
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", {"interval": 100})
        await cdp.send("Emulation.setCPUThrottlingRate", {"rate": RATE})
        await pg.goto(URL, wait_until="commit"); await pg.wait_for_selector(".press", timeout=90000)
        res = {}
        async def scene(name, during=None, secs=SECS):
            await pg.evaluate("__pc.reset()")
            await cdp.send("Profiler.start")
            task = asyncio.ensure_future(during()) if during else None
            await pg.wait_for_timeout(int(secs * 1000))
            if task: await task
            prof = (await cdp.send("Profiler.stop"))["profile"]
            c = await pg.evaluate("JSON.parse(JSON.stringify(__pc))")
            top = lambda d, n=6: sorted(d.items(), key=lambda kv: -kv[1])[:n]
            c["html"] = top(c.get("html", {}), 8); c["durl"] = top(c.get("durl", {})); c["dibig"] = [(k, round(v / 1e6, 1)) for k, v in top(c.get("dibig", {}), 8)]
            c["dipx_M_per_s"] = round(c.pop("dipx", 0) / 1e6 / secs, 1); c["di_per_s"] = round(c.pop("di", 0) / secs)
            res[name] = {"self": top_self(prof, 14), "total": top_total(prof, 16), "counters": c}
            print(f"=== {name}", flush=True)
        await pg.wait_for_timeout(1500); await scene("title")
        await pg.click(".press"); await pg.wait_for_selector(".mi[data-t=continue]"); await pg.click(".mi[data-t=continue]")
        await pg.wait_for_timeout(4000); await pg.evaluate(CLEAR); await pg.wait_for_timeout(800); await pg.evaluate(CLEAR)
        await scene("hub")
        await pg.evaluate("()=>{ if (typeof TABMENU!=='undefined' && TABMENU.closeHub) TABMENU.closeHub(); const t=document.querySelector('[data-tab=world]'); t && t.click(); scrollTo(0,0); }")
        await pg.wait_for_timeout(1500); await pg.evaluate(CLEAR)
        await scene("map_idle")
        box = await pg.evaluate("(()=>{const r=document.querySelector('#map').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, r.width, r.height]})()")
        async def pan():
            cx, cy, w, h = box; end = asyncio.get_event_loop().time() + SECS
            while asyncio.get_event_loop().time() < end:
                await pg.mouse.move(cx - w * .25, cy); await pg.mouse.down()
                for i in range(1, 11): await pg.mouse.move(cx - w * .25 + w * .05 * i, cy + (i % 3) * 3)
                await pg.mouse.up()
                await pg.mouse.move(cx + w * .25, cy + 10); await pg.mouse.down()
                for i in range(1, 11): await pg.mouse.move(cx + w * .25 - w * .05 * i, cy + 10)
                await pg.mouse.up()
        await scene("map_pan", pan)
        async def zoom():
            cx, cy, w, h = box; end = asyncio.get_event_loop().time() + SECS
            await pg.mouse.move(cx, cy)
            while asyncio.get_event_loop().time() < end:
                for _ in range(4): await pg.mouse.wheel(0, -120); await pg.wait_for_timeout(60)
                for _ in range(4): await pg.mouse.wheel(0, 120); await pg.wait_for_timeout(60)
        await scene("map_zoom", zoom)
        await pg.evaluate("()=>{ const S=window.__dbg.save(); S.location=null; G.startTrip(S,'Windhelm',WORLD.places.Windhelm.slice(0,2)); }")
        await pg.wait_for_timeout(1500); await pg.evaluate(CLEAR)
        await scene("travel")
        await pg.evaluate("()=>{ const S=window.__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; }")
        await pg.wait_for_timeout(800); await pg.evaluate(CLEAR)
        async def menus():
            for tab in ["hero", "journal", "social", "world"]:
                await pg.evaluate(f"()=>{{ const t=document.querySelector('[data-tab={tab}]'); t && t.click(); }}"); await pg.wait_for_timeout(500)
                for _ in range(3): await pg.mouse.wheel(0, 400); await pg.wait_for_timeout(120)
            await pg.evaluate("()=>{ try { window.__ui && window.__ui.openMenu && window.__ui.openMenu('items'); } catch(e){} }"); await pg.wait_for_timeout(600)
            for _ in range(3): await pg.mouse.wheel(0, 400); await pg.wait_for_timeout(120)
            await pg.evaluate("()=>{ try { window.__ui && window.__ui.openMenu && window.__ui.openMenu('magic'); } catch(e){} }"); await pg.wait_for_timeout(600)
            await pg.evaluate("()=>{ try { window.__ui && window.__ui.closeMenu && window.__ui.closeMenu(); } catch(e){} }")
        await scene("menus", menus, secs=max(SECS, 6))
        await pg.evaluate("""()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
          S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
          const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }""")
        await pg.wait_for_timeout(600); await pg.click("#modal [data-act=ev][data-c=fight]")
        await pg.wait_for_selector("#tbf", timeout=30000); await pg.wait_for_timeout(2500)
        await scene("fight_idle")
        async def attack():
            for _ in range(3):
                btn = await pg.query_selector("#tbf [data-act=tbact][data-id=attack], #tbf [data-a=attack], #tbf .tbact.attack, #tbf button[data-act=tba]")
                if btn:
                    try: await btn.click(timeout=2000)
                    except Exception: pass
                else:
                    await pg.evaluate("()=>{ try { const b=[...document.querySelectorAll('#tbf button')].find(x=>/attack|strike|swing/i.test(x.textContent)); b && b.click(); } catch(e){} }")
                await pg.wait_for_timeout(900)
        await scene("fight_attack", attack)
        await pg.evaluate("()=>{ try { const b=[...document.querySelectorAll('#tbf button')].find(x=>/end turn|end/i.test(x.textContent)); b && b.click(); } catch(e){} }")
        await scene("fight_foe")
        out = {"rate": RATE, "dpr": DPR, "scenes": res, "errors": errs[:5]}
        for n, r in res.items():
            print(f"\n######## {n}")
            print("  self:"); [print(f"    {ms:6} {pc:5}%  {k}") for ms, pc, k in r["self"][:10]]
            print("  total:"); [print(f"    {ms:6}  {k}") for ms, k in r["total"][:12]]
            c = r["counters"]; print("  counters:", json.dumps({k: v for k, v in c.items() if k not in ("html", "durl", "dibig")}))
            print("  innerHTML:", c["html"]); print("  toDataURL:", c["durl"]); print("  big drawImage (Mpx):", c["dibig"])
        print("errors", errs[:5])
        if OUT:
            try: json.dump(out, open(OUT, "w"), indent=1)
            except Exception as e: print("could not write", OUT, e)
        await b.close()
asyncio.run(main())
