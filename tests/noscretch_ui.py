"""No stretching, anywhere (fitcanvas.js + the sizing CSS): opens every main screen at phone, landscape, tablet and
desktop sizes in both art styles with the painted pictures on (?assets), saves a screenshot of each and checks:
  * stretch   — a picture or canvas drawn at a different shape than it really is (squashed or stretched)
  * blurry    — a canvas whose backing pixels are far below its size on screen × the screen's pixel density
  * bgstretch — a background picture with `background-size:100% 100%` on a box of a different shape
  * overflow  — the page scrolls sideways, or a button/heading/dialog pokes out of the screen
  * overlap   — two runs of text drawn on top of each other (reported, not failed: some are badges on purpose)
Fails (exit 1) on stretch, blurry, bgstretch and overflow.

Run:  python -m http.server 9460 --directory game   then
      python tests/noscretch_ui.py 9460 [outdir] [--quick] [--vp=360x740,1920x1080] [--style=ink] [--only=map,items]
Screenshots go to tests/out_noscretch/ (or outdir); a summary is written to report.json there. Prints "noscretch_ui: all good"."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
FLAGS = dict((a[2:].split("=", 1) + [""])[:2] for a in sys.argv[1:] if a.startswith("--"))
PORT = ARGS[0] if ARGS else "9460"
OUT = ARGS[1] if len(ARGS) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_noscretch")
os.makedirs(OUT, exist_ok=True)

# name, width, height, device pixel ratio, phone/tablet (touch)
VIEWPORTS = [
    ("360x740", 360, 740, 3, True), ("390x844", 390, 844, 3, True), ("412x915", 412, 915, 2.625, True),
    ("844x390", 844, 390, 3, True), ("915x412", 915, 412, 2.625, True),
    ("768x1024", 768, 1024, 2, True), ("1024x768", 1024, 768, 2, True), ("1280x800", 1280, 800, 1.5, True),
    ("1366x768", 1366, 768, 1, False), ("1920x1080", 1920, 1080, 1, False), ("2560x1440", 2560, 1440, 1, False),
]
if "quick" in FLAGS:
    VIEWPORTS = [v for v in VIEWPORTS if v[0] in ("360x740", "844x390", "1024x768", "2560x1440")]
if FLAGS.get("vp"):
    VIEWPORTS = [v for v in VIEWPORTS if v[0] in FLAGS["vp"].split(",")]
STYLES = FLAGS["style"].split(",") if FLAGS.get("style") else ["ink"]
ONLY = set(FLAGS["only"].split(",")) if FLAGS.get("only") else None

# ---------------------------------------------------------------- the checks, run inside the page
DETECT = r"""async () => {
  const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1, out = { stretch: [], blurry: [], bgstretch: [], overflow: [], overlap: [] };
  const name = (e) => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.'); if (c) s += '.' + c;
    const p = e.parentElement; if (p) { let q = p.tagName.toLowerCase(); if (p.id) q += '#' + p.id; const pc = (typeof p.className === 'string' ? p.className : '').trim().split(/\s+/).filter(Boolean)[0]; if (pc) q += '.' + pc; s = q + '>' + s; } return s; };
  const shown = (e) => { if (!e.isConnected) return false; const r = e.getBoundingClientRect(); if (r.width < 6 || r.height < 6) return false;
    for (let a = e; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  // the content box on screen (rect minus borders and padding, which zoom along with the element)
  const box = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e), ow = e.offsetWidth || r.width, k = ow ? r.width / ow : 1;
    const px = (v) => parseFloat(v) || 0;
    return { w: r.width - k * (px(cs.borderLeftWidth) + px(cs.borderRightWidth) + px(cs.paddingLeft) + px(cs.paddingRight)),
             h: r.height - k * (px(cs.borderTopWidth) + px(cs.borderBottomWidth) + px(cs.paddingTop) + px(cs.paddingBottom)), r, cs }; };
  const bad = (a, b, tol) => Math.abs(a / b - 1) > tol;
  // 1) pictures and canvases drawn at the wrong shape, and canvases short of pixels
  for (const e of document.querySelectorAll('img, canvas')) {
    if (!shown(e)) continue;
    const { w, h, cs } = box(e); if (w < 6 || h < 6) continue;
    const nw = e.tagName === 'IMG' ? e.naturalWidth : e.width, nh = e.tagName === 'IMG' ? e.naturalHeight : e.height;
    if (!nw || !nh) continue;
    if (e.tagName === 'IMG' && /\.svg|image\/svg/.test(e.currentSrc || e.src || '')) continue;
    const fit = cs.objectFit;
    // tiny things (icons, 1px lines) can't be judged by shape
    const tol = Math.max(0.04, 2.5 / Math.min(w, h));
    if ((fit === 'fill' || !fit) && bad(w / h, nw / nh, tol)) out.stretch.push(`${name(e)} drawn ${Math.round(w)}x${Math.round(h)} but is ${nw}x${nh} (${(w / h).toFixed(2)} vs ${(nw / nh).toFixed(2)})`);
    if (e.tagName === 'CANVAS') {
      // ink pictures: at least ~70% of the screen's pixels (capped at 2.5x, the game's limit)
      const want = Math.min(dpr, 2.5) * 0.7, have = nw / w;
      if (w * h > 2500 && have < want) out.blurry.push(`${name(e)} ${nw}x${nh} backing for ${Math.round(w)}x${Math.round(h)} on screen (${have.toFixed(2)} px per css px, screen ${dpr})`);
    }
  }
  // 2) background pictures squashed by background-size:100% 100%
  const bgs = [];
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e); if (cs.backgroundImage === 'none' || !/url\(/.test(cs.backgroundImage)) continue;
    const sz = cs.backgroundSize.split(',')[0].trim(); if (!/^100% 100%$/.test(sz) && !/^\d+(\.\d+)?px \d+(\.\d+)?px$/.test(sz)) continue;
    if (!shown(e)) continue;
    const m = /url\("?([^")]+)"?\)/.exec(cs.backgroundImage); if (!m) continue;
    bgs.push([e, m[1], sz]);
  }
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = u; setTimeout(() => res(null), 1500); });
  for (const [e, u, sz] of bgs.slice(0, 60)) {
    const n = await load(u); if (!n || !n[0] || !n[1]) continue;
    if (/\.svg|image\/svg/.test(u)) continue;
    const r = e.getBoundingClientRect(); let w = r.width, h = r.height;
    if (sz !== '100% 100%') { const p = sz.split(' ').map(parseFloat); w = p[0]; h = p[1]; }
    if (w > 8 && h > 8 && bad(w / h, n[0] / n[1], 0.06)) out.bgstretch.push(`${name(e)} background ${n[0]}x${n[1]} drawn ${Math.round(w)}x${Math.round(h)}`);
  }
  // 3) things poking out of the screen
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) {   // name the culprit: the outermost in-flow element reaching past the right edge
    let who = '';
    for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.width && r.right > de.clientWidth + 1 && !e.closest('[style*="position: fixed"]')) { let fx = false; for (let a = e; a; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') { fx = true; break; } if (!fx) { who = name(e) + ' ' + Math.round(r.left) + '..' + Math.round(r.right); break; } } }
    out.overflow.push(`page scrolls sideways (${de.scrollWidth} > ${de.clientWidth}) ${who}`);
  }
  const scrollsX = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  for (const e of document.querySelectorAll('button, .btn, input, select, h1, h2, h3, .sheet, #modal > *, .sky-in, .tw-bar, .tbstage, .lpcard, .cgcard')) {
    if (!shown(e)) continue; const r = e.getBoundingClientRect();
    if ((r.right > W + 1.5 || r.left < -1.5) && !scrollsX(e)) out.overflow.push(`${name(e)} '${(e.textContent || '').trim().slice(0, 16)}' x ${Math.round(r.left)}..${Math.round(r.right)} of ${W}`);
  }
  // 4) text drawn over other text (visible screen only)
  const runs = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n && runs.length < 900; n = tw.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement || !shown(n.parentElement)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const pe = n.parentElement;
    // only text you can actually see: not hidden under a menu or dialog drawn on top of it
    const onTop = (r) => [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5]].some(([fx, fy]) => { const h = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); return h && (pe.contains(h) || h.contains(pe)); });
    for (const r of rg.getClientRects()) if (r.width > 3 && r.height > 3 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W && onTop(r)) runs.push([pe, r]);
  }
  for (let i = 0; i < runs.length && out.overlap.length < 12; i++) for (let j = i + 1; j < runs.length; j++) {
    const [a, ra] = runs[i], [b, rb] = runs[j]; if (a === b || a.contains(b) || b.contains(a)) continue;
    const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ix <= 2 || iy <= 2) continue;
    if (ix * iy > 0.35 * Math.min(ra.width * ra.height, rb.width * rb.height)) { out.overlap.push(`'${a.textContent.trim().slice(0, 14)}' / '${b.textContent.trim().slice(0, 14)}'`); break; }
  }
  for (const k in out) out[k] = [...new Set(out[k])].slice(0, 12);
  return out;
}"""

NOON = """(()=>{ const base=Date.now.bind(Date); let off=0; while (Math.floor(G.clock(base()/1000+off).hour)!==12 && off<86400*2) off+=60; Date.now=()=>base()+off*1000; G.shopsOpen=()=>true; })()"""
SETUP = """(()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun.slice(0,2); S.gold=3000; S.trip=null; S.level=12;
  ['Riverwood','Riften','Bleak Falls Barrow','Embershard Mine','Windhelm'].forEach(p=>{ if(!S.discovered.includes(p)) S.discovered.push(p); });
  const st=G.give(S,'steel_sword'); G.equip(S,st); G.give(S,'iron_sword'); G.give(S,'potion_health',4); G.give(S,'iron_helmet'); G.give(S,'fishing_rod'); G.give(S,'gem_emerald');
  return true; })()"""
# close whatever is open, the gentle way first
RESET = """(()=>{ try{ CG.close() }catch(e){} try{ IMM.close() }catch(e){} try{ PICKGAME.close() }catch(e){} try{ MINEGAME.close() }catch(e){}
  try{ TABMENU.closeHub() }catch(e){}
  for (let i=0;i<8;i++){ try{ if(!window.__ui.back()) break; }catch(e){ break; } }
  document.querySelectorAll('#modal,#loadcard,#bark,.toast,#toast,#nickbox,#pbanners,#lockpick,#pickgame,#minegame,#craftgame').forEach(m=>m.remove());
  try{ TABMENU.closeHub() }catch(e){}   // back() ends on the compass (it's home): close it so the screen asked for is on top
  const S=window.__dbg.save(); if (S && !S.dungeon) { S.trip=null; } })()"""

SCREENS = []   # (name, js-or-callable)
def screen(name):
    def deco(f): SCREENS.append((name, f)); return f
    return deco

async def ev(pg, js, *a):
    try: return await pg.evaluate(js, *a)
    except Exception as e: return f"ERR {e}"

@screen("home_compass")
async def _(pg): await ev(pg, "TABMENU.openHub()")
@screen("map")
async def _(pg): await ev(pg, "window.__ui.go('map')")
@screen("items")
async def _(pg): await ev(pg, "window.__ui.openMenu('items')")
@screen("magic")
async def _(pg): await ev(pg, "window.__ui.openMenu('magic')")
@screen("skills")
async def _(pg): await ev(pg, "TABMENU.go('char')")
@screen("hero")
async def _(pg): await ev(pg, "window.__ui.go('hero')")
@screen("shop")
async def _(pg): await ev(pg, "window.__ui.jump({tab:'town',shop:'general'})")
@screen("town")
async def _(pg): await ev(pg, "window.__ui.jump({tab:'town'})")
@screen("travel")
async def _(pg):
    await ev(pg, "(()=>{ const S=window.__dbg.save(); G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); window.__ui.go('map'); })()")
@screen("encounter")
async def _(pg):
    await ev(pg, """(()=>{ const S=window.__dbg.save(); G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
      const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); })()""")
@screen("event")
async def _(pg):
    await ev(pg, """(()=>{ const S=window.__dbg.save(); G.startTrip(S,'Windhelm',WORLD.places.Windhelm.slice(0,2));
      S.trip.status='event'; S.trip.event={id:'shrine', god:'Talos', text:'A weathered roadside shrine to Talos stands among the stones.'}; window.__dbg.openEvent(); })()""")
@screen("lockpick")
async def _(pg): await ev(pg, "IMM.open({tier:1,picks:5,chance:0.5,skill:20,title:'A locked chest'},()=>{})")
@screen("pickpocket")
async def _(pg): await ev(pg, "PICKGAME.open({title:\"Hulda's purse\",sub:'Pickpocket 20 · about 50% chance',chance:0.5},()=>{})")
@screen("mining")
async def _(pg): await ev(pg, "MINEGAME.play(window.__dbg.save(),'Embershard Mine',()=>{})")
@screen("craft_hammer")
async def _(pg): await ev(pg, "CG.run('hammer',{skill:20,skillName:'Smithing',what:'Iron Sword'},()=>{})")
@screen("craft_mix")
async def _(pg): await ev(pg, "CG.run('mix',{skill:20,skillName:'Alchemy',what:'Blue Mountain Flower + Wheat'},()=>{})")
@screen("craft_rune")
async def _(pg): await ev(pg, "CG.run('rune',{skill:20,skillName:'Enchanting',what:'Fortify Health on Iron Helmet'},()=>{})")
@screen("timing_ring")
async def _(pg): await ev(pg, "CG.run('precise',{skill:20,skillName:'Smithing',what:'Gold Ruby Ring'},()=>{})")
@screen("fishing")
async def _(pg):
    await ev(pg, "(()=>{ const S=window.__dbg.save(); S.location='Riften'; [S.x,S.y]=WORLD.places.Riften.slice(0,2); window.__ui.jump({tab:'town',shop:'fish'}); })()")
    await pg.wait_for_timeout(250)
    await ev(pg, "document.querySelector('[data-act=fishgo]')?.click()")
@screen("journal")
async def _(pg): await ev(pg, "window.__ui.go('log')")
@screen("settings")
async def _(pg): await ev(pg, "document.querySelector('.top .snd')?.click()")
@screen("social")
async def _(pg): await ev(pg, "window.__ui.jump({tab:'social',soc:'friends'})")
@screen("party")
async def _(pg): await ev(pg, "window.__ui.jump({tab:'social',soc:'party'})")
@screen("rotated")   # phones turn sideways: the map and the open menu have to follow (no stretched map)
async def _(pg):
    vp = pg.viewport_size
    if not vp or vp["width"] >= 1366: return "skip"
    await ev(pg, "window.__ui.go('map')"); await pg.wait_for_timeout(400)
    await pg.set_viewport_size({"width": vp["height"], "height": vp["width"]}); await pg.wait_for_timeout(500)
    pg._turned_back = vp
@screen("dungeon")
async def _(pg):
    await ev(pg, """(()=>{ const S=window.__dbg.save(); const n='Bleak Falls Barrow'; S.location=n; [S.x,S.y]=WORLD.places[n].slice(0,2); S.cleared={}; S.level=20; window.__ui.go('map'); })()""")
    await pg.wait_for_timeout(300)
    await ev(pg, "document.querySelector('[data-act=enter]')?.click()")
    await pg.wait_for_timeout(1200)
    await ev(pg, "document.querySelectorAll('#loadcard').forEach(e=>e.remove())")
@screen("dungeon_room")
async def _(pg):
    await ev(pg, "document.querySelector('#dun [data-act=droom]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))")
    await pg.wait_for_timeout(600)
@screen("tbfight")
async def _(pg):
    await ev(pg, """(()=>{ const S=__dbg.save(); S.dungeon=null; S.trip=null; document.querySelectorAll('#dun').forEach(e=>e.remove());
      const e=G.scaleEnemy({name:'Bandit',health:120,damage:9,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
      TB.call(S, ()=>{ const f=new G.Fight(S,e); f.allies=[]; return f.run({trySneak:false}); }, ()=>{}); })()""")
    await pg.wait_for_timeout(1500)
    await ev(pg, "document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click())")
    await pg.wait_for_timeout(600)

NO_RESET = {"dungeon_room"}   # carries on from the screen before


async def run_one(b, vp, style, report):
    name, vw, vh, dpr, touch = vp
    tag = f"{style}_{name}"
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dpr, is_mobile=touch and vw < 1000, has_touch=touch)
    await ctx.add_init_script(f"try{{localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))}}catch(e){{}}")
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    url = f"http://localhost:{PORT}/index.html?assets&net=bc&notut&tb&craftgame&lockgame&minegame&pickgame&p=ns{style}{name.replace('x', '')}"

    async def snap(sname):
        await pg.wait_for_timeout(700)
        path = os.path.join(OUT, f"{tag}_{sname}.png")
        try: await pg.screenshot(path=path, scale="css")
        except Exception as e: errs.append(f"shot {sname}: {e}")
        res = await ev(pg, DETECT)
        if not isinstance(res, dict): res = {"error": [str(res)[:200]]}
        report[f"{tag}_{sname}"] = res
        hard = {k: v for k, v in res.items() if v and k in ("stretch", "blurry", "bgstretch", "overflow", "error")}
        print(f"  {tag:22} {sname:14} " + ("ok" if not hard else json.dumps(hard)[:400]), flush=True)

    for i in range(4):   # a busy local server can refuse now and then
        try: await pg.goto(url); break
        except Exception as e:
            if i == 3: raise
            await pg.wait_for_timeout(1500)
    try: await pg.wait_for_selector(".press", timeout=45000)   # a busy machine can take a while to unroll the map
    except Exception: pass
    await pg.wait_for_timeout(2000)
    if not ONLY or "title" in ONLY: await snap("title")
    await ev(pg, "document.querySelector('.press')?.click()"); await pg.wait_for_timeout(500)
    if not ONLY or "title_menu" in ONLY: await snap("title_menu")
    await ev(pg, "document.querySelector('.mi[data-t=new]')?.click()"); await pg.wait_for_timeout(500)
    if not ONLY or "create" in ONLY: await snap("create")
    for i in range(5):   # the new-character card can come up late
        if (await ev(pg, "!!document.querySelector('#nm')")) is True: break
        await ev(pg, "document.querySelector('.press')?.click(); document.querySelector('.mi[data-t=new]')?.click()"); await pg.wait_for_timeout(1500)
    await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1800)
    await ev(pg, NOON); await ev(pg, SETUP); await ev(pg, RESET)
    for sname, fn in SCREENS:
        if ONLY and sname not in ONLY and not (sname == "dungeon" and "dungeon_room" in ONLY): continue
        if sname not in NO_RESET: await ev(pg, RESET); await pg.wait_for_timeout(150)
        if await fn(pg) == "skip": continue
        if not ONLY or sname in ONLY: await snap(sname)
        if getattr(pg, "_turned_back", None): await pg.set_viewport_size(pg._turned_back); pg._turned_back = None; await pg.wait_for_timeout(300)
    if errs: report[f"{tag}_errors"] = {"error": errs[:8]}
    await ctx.close()


async def main():
    report = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for style in STYLES:
            for vp in VIEWPORTS:
                print(f"{style} {vp[0]}", flush=True)
                await run_one(b, vp, style, report)
        await b.close()
    json.dump(report, open(os.path.join(OUT, "report.json"), "w"), indent=1)
    fails = {k: {c: v[c] for c in ("stretch", "blurry", "bgstretch", "overflow") if v.get(c)} for k, v in report.items()}
    fails = {k: v for k, v in fails.items() if v}
    tally = {}
    for k, v in report.items():
        for c, items in v.items():
            if items: tally[c] = tally.get(c, 0) + 1
    print("screens with problems by kind:", tally)
    if fails:
        print(f"noscretch_ui: {len(fails)} screens with problems (see {os.path.join(OUT, 'report.json')})")
        sys.exit(1)
    print("noscretch_ui: all good")

asyncio.run(main())
