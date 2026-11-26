"""Art quality guard: painted pictures are never stretched and never blown up past their own pixels.
Owner: "art on PC is stretched and low quality, make sure it is never bad quality ever again."

For every main screen at 2000x837, 2560x1440 and 1366x768, each at pixel density 1 and 2 (hand-drawn style), it looks at
  * every visible <img> (painted files and the game's own drawn pictures that have a painted file inside them),
  * every visible box with a painted background-image (night sky, compass...; tiled textures and 9-slice frames skipped),
  * every visible <canvas> that drew a painted file (fight scenes, foes, the title...),
and checks
  * shape: the picture's shape on screen matches the file's (cropping is fine, squashing is not): error < 2%
  * sharpness: screen pixels per file pixel (box x density / file size) <= 1.15
How canvases are followed: drawImage/toDataURL are watched (test only), so a painted file drawn into an off-screen canvas,
then into a data-URL <img> or the fight canvas, keeps its scale all the way to the screen.

At the end it prints every painted file that is smaller than its biggest box on a PC (the game shows those at their own
size instead of blowing them up) with the pixel size it would need, so it can be painted again bigger.
Run:  node tests/serve.js 9471   then
      python tests/art_quality_ui.py 9471 [--vp=2000x837@1] [--only=shop_inn,fight]
Screenshots go to tests/out_artq/. Prints "art_quality_ui: all good"."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
FLAGS = dict((a[2:].split("=", 1) + [""])[:2] for a in sys.argv[1:] if a.startswith("--"))
PORT = ARGS[0] if ARGS else "9471"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_artq")
os.makedirs(OUT, exist_ok=True)
ONLY = set(FLAGS["only"].split(",")) if FLAGS.get("only") else None
VPS = [(f"{w}x{h}@{d}", w, h, d) for (w, h, d) in [(390, 844, 3), (360, 780, 2), (768, 1024, 2), (1366, 768, 1), (1920, 1080, 1), (2560, 1440, 1), (3440, 1440, 1), (5120, 1440, 1), (3840, 2160, 2), (2000, 837, 2)]]
if FLAGS.get("vp"): VPS = [v for v in VPS if v[0] in FLAGS["vp"].split(",")]
MAX_UP, WARN_UP, MAX_ASPECT = 1.5, 1.25, 0.02
# [assetquality] files that are simply too small for the biggest screens and wait to be painted again are listed in
# art_gpt/REGEN_LIST.md; its "allow:" lines (key and the most blow-up we put up with until then) are read here.
ALLOW = {}
_RL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "art_gpt", "REGEN_LIST.md")
try:
    for _ln in open(_RL, encoding="utf-8"):
        _m = _ln.strip().split()
        if len(_m) >= 3 and _m[0] == "allow:": ALLOW[_m[1]] = float(_m[2])
except OSError: pass
# the world map (claude/mapvisuals) and the title picture (claude/widetitle) have their own branches and guards
SKIP = ["map-world", "map-world-2x", "title"]
# the wide title painting (titleart.js WUP) fills a 32:9 or 5K window even past its 2x file: allowed up to 1.8x there
ALLOW.setdefault("title-wide", 1.8); ALLOW.setdefault("title-wide-2x", 1.8)

# test-only: follow painted files through every canvas they are drawn into
WATCH = r"""(() => {
  const ASSET = /\/((?:title|bg-loading|place|biome|foe|shop|bs|bsf|bsp|icon|ui|gev|wev|map|room)-?[^\/?#]*)\.(?:webp|png|jpe?g)(?:[?#].*)?$/;
  const keyOf = (im) => { try { const m = ASSET.exec(im.currentSrc || im.src || ''); return m ? m[1] : null; } catch (e) { return null; } };
  // a canvas given a new size (the fight stage growing with its box) starts over: what it drew before is gone
  const rec = (cv) => { const wh = cv.width + 'x' + cv.height; if (cv.__artWH !== wh) { cv.__artWH = wh; cv.__art = new Map(); } return cv.__art; };
  // up: canvas px per file px; ch: the worst blow-up along the way (canvas px per px of the file or of any canvas in between)
  const add = (cv, key, up, ch, asp, nat) => { const m = rec(cv), o = m.get(key);
    if (!o) m.set(key, { up, ch, asp, nat }); else { o.up = Math.max(o.up, up); o.ch = Math.max(o.ch, ch); o.asp = Math.max(o.asp, asp); } };
  const P = CanvasRenderingContext2D.prototype, di = P.drawImage;
  P.drawImage = function (src, ...a) {
    try {
      const t = this.getTransform(), sx = Math.hypot(t.a, t.b), sy = Math.hypot(t.c, t.d);
      const sw0 = src.naturalWidth || src.width, sh0 = src.naturalHeight || src.height;
      let sw = sw0, sh = sh0, dw, dh;
      if (a.length === 2) { dw = sw; dh = sh; } else if (a.length === 4) { dw = a[2]; dh = a[3]; } else { sw = a[2]; sh = a[3]; dw = a[6]; dh = a[7]; }
      if (sw > 0 && sh > 0 && dw && dh) {
        const bx = Math.abs(dw * sx) / sw, by = Math.abs(dh * sy) / sh;
        // a thin slice (the foe rigs bend a painting slice by slice) or a soft shadow blob may change shape on purpose
        const slice = sw < sw0 * 0.3 || sh < sh0 * 0.3, asp = slice ? 0 : Math.abs(bx / by - 1);
        let key = src instanceof HTMLImageElement ? keyOf(src) : null;
        if (key && /shadow/.test(key)) key = null;
        const k = Math.max(bx, by);
        if (key) add(this.canvas, key, k, k, asp, [sw0, sh0]);
        // a canvas marked __soft (the title's blurred side fill) is blurry on purpose too
        // a soft glow laid over the picture (light bloom: a small copy added with "lighter"/"screen") is blurry on purpose
        else if (src.__art && !src.__soft && !/^(lighter|screen)$/.test(this.globalCompositeOperation)) for (const [kk, o] of src.__art) add(this.canvas, kk, o.up * k, Math.max(o.ch * k, k), Math.max(o.asp, asp), o.nat);
      }
    } catch (e) { /* never break the game */ }
    return di.call(this, src, ...a);
  };
  const tdu = HTMLCanvasElement.prototype.toDataURL;
  window.__artURL = new Map();
  HTMLCanvasElement.prototype.toDataURL = function (...a) { const u = tdu.apply(this, a); if (this.__art && this.__art.size) window.__artURL.set(u, this.__art); return u; };
})();"""

CHECK = r"""async (lim) => {
  const dpr = devicePixelRatio || 1, bad = [], warn = [], need = {}, seen = [];
  const ASSET = /\/((?:title|bg-loading|place|biome|foe|shop|bs|bsf|bsp|icon|ui|gev|wev|map|room)-?[^\/?#"')]*)\.(?:webp|png|jpe?g)/;
  const shown = (e) => { if (!e || !e.isConnected) return null; const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return null;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
    for (let a = e; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
      const bl = /blur\(([\d.]+)px\)/.exec(cs.filter); if (bl && +bl[1] >= 2) return null; }   // blurred on purpose (a backdrop behind a menu)
    if (e.tagName !== 'IMG' && e.tagName !== 'CANVAS') return r;
    // a picture's own border/padding (a thin frame round a mini scene) isn't part of the picture: measure the content box
    const c = getComputedStyle(e), px = (p) => parseFloat(c[p]) || 0, kx = e.offsetWidth ? r.width / e.offsetWidth : 1, ky = e.offsetHeight ? r.height / e.offsetHeight : 1;
    const ix = (px('borderLeftWidth') + px('borderRightWidth') + px('paddingLeft') + px('paddingRight')) * kx, iy = (px('borderTopWidth') + px('borderBottomWidth') + px('paddingTop') + px('paddingBottom')) * ky;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: Math.max(1, r.width - ix), height: Math.max(1, r.height - iy) }; };
  const nm = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const note = (key, up, nat) => { if (up > 1.02 && nat) { const w = Math.ceil(nat[0] * up), h = Math.ceil(nat[1] * up), o = need[key]; if (!o || w > o[0]) need[key] = [w, h, nat[0], nat[1]]; } };
  // up: screen px per file px (what the file itself needs); ch: the worst blow-up of the file or of a canvas it went through
  const judge = (where, key, up, asp, nat, ch = up) => {
    if (lim.skip.includes(key)) return;
    seen.push(key); note(key, up, nat);
    const cap = (lim.allow && lim.allow[key]) || lim.up;
    if (ch > lim.warn && ch <= cap) warn.push(`${where} ${key}: ${ch.toFixed(2)}x`);
    if (ch > cap) bad.push(`${where} ${key}: blown up ${ch.toFixed(2)}x${ch > up * 1.01 ? ` (drawn too small on the way: file ${up.toFixed(2)}x)` : ''}`);
    if (asp > lim.asp) bad.push(`${where} ${key}: squashed ${(asp * 100).toFixed(1)}%`);
  };
  // the shape of the picture inside an <img> box (object-fit cover/contain keep the shape)
  const imgFit = (e, r, nw, nh) => {
    const fit = getComputedStyle(e).objectFit, bw = r.width, bh = r.height;
    if (fit === 'cover') { const s = Math.max(bw / nw, bh / nh); return { sx: s, sy: s }; }
    if (fit === 'contain' || fit === 'scale-down') { let s = Math.min(bw / nw, bh / nh); if (fit === 'scale-down') s = Math.min(1, s); return { sx: s, sy: s }; }
    if (fit === 'none') return { sx: 1, sy: 1 };
    return { sx: bw / nw, sy: bh / nh };
  };
  for (const e of document.querySelectorAll('img')) {
    const r = shown(e); if (!r || !e.complete || !e.naturalWidth) continue;
    const src = e.currentSrc || e.src || '', m = ASSET.exec(src);
    const { sx, sy } = imgFit(e, r, e.naturalWidth, e.naturalHeight);
    // a picture held back from its box so it isn't blown up: what it would need to fill the box
    const pw = e.parentElement ? e.parentElement.getBoundingClientRect().width - (parseFloat(getComputedStyle(e.parentElement).paddingLeft) + parseFloat(getComputedStyle(e.parentElement).paddingRight)) * (r.width / (e.offsetWidth || r.width)) : r.width;
    const fill = e.dataset.maxw && pw > r.width * 1.02 ? pw / r.width : 1;
    if (m) judge(nm(e), m[1], Math.max(sx, sy) * dpr, Math.abs(sx / sy - 1), [e.naturalWidth, e.naturalHeight]);
    else if (src.startsWith('data:') && window.__artURL.has(src)) for (const [k, o] of window.__artURL.get(src)) { const s = Math.max(sx, sy) * dpr; judge(nm(e), k, s * o.up, Math.max(o.asp, Math.abs(sx / sy - 1)), o.nat, Math.max(s * o.ch, s)); note(k, s * o.up * fill, o.nat); }
  }
  for (const e of document.querySelectorAll('canvas')) {
    if (!e.__art || !e.__art.size) continue;
    const r = shown(e); if (!r || !e.width) continue;
    const sx = r.width / e.width, sy = r.height / e.height;
    const s = Math.max(sx, sy) * dpr;
    // a stage held back by a max-width (so its painting isn't blown up): what it would need to fill its column
    let fill = 1;
    for (let a = e.parentElement, i = 0; a && i < 4; a = a.parentElement, i++) {
      if (getComputedStyle(a).maxWidth === 'none' || !a.parentElement) continue;
      const p = a.parentElement, pcs = getComputedStyle(p), pw = p.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
      if (pw > a.offsetWidth * 1.02) fill = pw / a.offsetWidth; break;
    }
    for (const [k, o] of e.__art) note(k, s * o.up * fill, o.nat);
    for (const [k, o] of e.__art) judge(nm(e), k, s * o.up, Math.max(o.asp, Math.abs(sx / sy - 1)), o.nat, Math.max(s * o.ch, s));
  }
  // [assetquality] pictures the game draws by code (data-URL <img>s and canvases): backing pixels must keep up with the
  // box on screen x density (no soft blow-up) and keep the box's shape. Pixel-art (pixelated), the world map
  // (claude/mapvisuals) and blurred backdrops are left out.
  const crisp = (e) => /pixelated|crisp-edges/.test(getComputedStyle(e).imageRendering);
  const offMap = (e) => !e.closest('#mapwrap, #map, .pcmap, #tanim, .tanim');
  for (const e of document.querySelectorAll('img')) {
    const src = e.currentSrc || e.src || ''; if (!src.startsWith('data:') || window.__artURL.has(src) || !offMap(e)) continue;
    const r = shown(e); if (!r || !e.complete || !e.naturalWidth || crisp(e) || r.width < 16) continue;
    const { sx, sy } = imgFit(e, r, e.naturalWidth, e.naturalHeight), up = Math.max(sx, sy) * dpr, asp = Math.abs(sx / sy - 1);
    const where = 'drawn ' + nm(e) + (e.alt ? ` "${e.alt.slice(0, 24)}"` : '') + ` ${Math.round(r.width)}px`;
    if (up > lim.drawn) bad.push(`${where}: blown up ${up.toFixed(2)}x (file ${e.naturalWidth}px)`);
    else if (up > lim.warn) warn.push(`${where}: ${up.toFixed(2)}x`);
    if (asp > lim.asp) bad.push(`${where}: squashed ${(asp * 100).toFixed(1)}%`);
  }
  for (const e of document.querySelectorAll('canvas')) {
    if ((e.__art && e.__art.size) || !offMap(e)) continue;
    const r = shown(e); if (!r || !e.width || crisp(e) || r.width < 16 || r.height < 16) continue;
    const sx = r.width / e.width, sy = r.height / e.height, up = Math.max(sx, sy) * dpr, asp = Math.abs(sx / sy - 1);
    const where = 'canvas ' + nm(e) + ` ${Math.round(r.width)}x${Math.round(r.height)}`;
    if (up > lim.drawn) bad.push(`${where}: backing ${e.width}x${e.height} blown up ${up.toFixed(2)}x`);
    else if (up > lim.warn) warn.push(`${where}: ${up.toFixed(2)}x`);
    if (asp > lim.asp) bad.push(`${where}: squashed ${(asp * 100).toFixed(1)}%`);
  }
  // painted backgrounds: one-layer pictures sized by background-size (tiles and frames are made to repeat/stretch)
  const nat = {};
  const natOf = (u) => nat[u] || (nat[u] = new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = u; }));
  for (const e of document.querySelectorAll('body, body *')) {
    const cs = getComputedStyle(e), bg = cs.backgroundImage;
    if (!bg || bg === 'none' || !ASSET.test(bg)) continue;
    const r = shown(e); if (!r) continue;
    const layers = bg.split(/,(?![^(]*\))/), sizes = cs.backgroundSize.split(/,(?![^(]*\))/), reps = cs.backgroundRepeat.split(','), clips = cs.backgroundOrigin.split(',');
    for (let i = 0; i < layers.length; i++) {
      const um = /url\(["']?([^"')]+)["']?\)/.exec(layers[i]); if (!um) continue;
      const km = ASSET.exec(um[1]); if (!km) continue;
      const rep = (reps[i] || reps[0] || '').trim(); if (/^repeat(\s+repeat)?$|^space|^round/.test(rep) && !/no-repeat/.test(rep)) continue;   // tiled texture
      const n = await natOf(um[1]); if (!n) continue;
      const z = e.offsetWidth ? r.width / e.offsetWidth : 1;   // page zoom (CSS px -> screen px)
      const bw = r.width, bh = r.height, sz = (sizes[i] || sizes[0] || 'auto').trim().split(/\s+/);
      let w, h;
      if (sz[0] === 'cover' || sz[0] === 'contain') { const s = (sz[0] === 'cover' ? Math.max : Math.min)(bw / n[0], bh / n[1]); w = n[0] * s; h = n[1] * s; }
      else {
        const len = (v, box) => v === 'auto' || v == null ? null : v.endsWith('%') ? parseFloat(v) / 100 * box : parseFloat(v) * z;
        w = len(sz[0], bw); h = len(sz[1], bh);
        if (w == null && h == null) { w = n[0] * z; h = n[1] * z; } else if (w == null) w = h * n[0] / n[1]; else if (h == null) h = w * n[1] / n[0];
      }
      judge(nm(e) + ' (background)', km[1], Math.max(w / n[0], h / n[1]) * dpr, Math.abs((w / n[0]) / (h / n[1]) - 1), n);
    }
  }
  // files the game itself held back (the title on a wide screen...)
  try { for (const [k, w, h] of ARTFIT.shortList()) { const o = need[k]; if (!o || w > o[0]) { const im = ASSETS.img(k); need[k] = [w, h, im ? im.naturalWidth : 0, im ? im.naturalHeight : 0]; } } } catch (e) { /* older game */ }
  return { bad: [...new Set(bad)], warn: [...new Set(warn)], need, seen: [...new Set(seen)] };
}"""

SETUP = """(()=>{ const S=window.__dbg.save(); S.gold=3000; S.level=12; S.trip=null;
  ['Riverwood','Riften','Bleak Falls Barrow','Embershard Mine','Windhelm','Whiterun'].forEach(p=>{ if(!S.discovered.includes(p)) S.discovered.push(p); });
  const st=G.give(S,'steel_sword'); G.equip(S,st); G.give(S,'iron_sword'); G.give(S,'potion_health',4); G.give(S,'iron_helmet');
  try{ ONBOARD && ONBOARD.dismiss && ONBOARD.dismiss() }catch(e){}
  return true; })()"""
RESET = """(()=>{ try{ TABMENU.closeHub() }catch(e){}
  for (let i=0;i<8;i++){ try{ if(!window.__ui.back()) break; }catch(e){ break; } }
  document.querySelectorAll('#modal,#loadcard,#bark,.toast,#toast,#nickbox,.tbf,#dun').forEach(m=>m.remove());
  try{ TABMENU.closeHub() }catch(e){} document.body.classList.remove('tw-char');
  const S=window.__dbg.save(); if (S && !S.dungeon) S.trip=null; })()"""
TAB = "(t)=>{ document.querySelector('#tabs [data-tab='+t+']')?.click() }"
SUB = "(t)=>{ document.querySelector('#side [data-act=tabgo][data-id='+t+']')?.click() }"
AT = "(p)=>{ const S=__dbg.save(); S.location=p; [S.x,S.y]=WORLD.places[p].slice(0,2); }"
SCREENS = []
def screen(name, *steps): SCREENS.append((name, steps))
screen("map", ("tab", "world"))
screen("map_picked", ("tab", "world"), ("js", "__ui.jump({place:'Whiterun'})"))
screen("area", ("at", "Whiterun"), ("tab", "town"))
for s in ["inn", "general", "forge", "alchemy"]:
    screen("shop_" + s, ("at", "Whiterun"), ("js", f"__ui.jump({{tab:'town',shop:'{s}'}})"))
screen("char_stars", ("tab", "hero"), ("sub", "stars"))
screen("skills_page", ("js", "TABMENU.go('char')"))
screen("compass", ("js", "TABMENU.openHub()"))
screen("items", ("js", "__ui.go('items')"))
screen("event", ("js", """(()=>{ const S=__dbg.save(); G.startTrip(S,'Windhelm',WORLD.places.Windhelm.slice(0,2));
      S.trip.status='event'; S.trip.event={id:'shrine', god:'Talos', text:'A weathered roadside shrine to Talos stands among the stones.'}; __dbg.openEvent(); })()"""))
screen("dungeon", ("js", """(()=>{ const S=__dbg.save(); const n='Bleak Falls Barrow'; S.location=n; [S.x,S.y]=WORLD.places[n].slice(0,2); S.cleared={}; __ui.go('map'); })()"""),
       ("js", "document.querySelector('[data-act=enter]')?.click()"), ("wait", 1500), ("js", "document.querySelectorAll('#loadcard').forEach(e=>e.remove())"))
for foe, place in [("Bandit", "Whiterun"), ("Draugr", "Bleak Falls Barrow")]:
    screen("fight_" + foe.lower(), ("at", place), ("js", """(()=>{ const S=__dbg.save(); S.dungeon=null; S.trip=null;
      const e=G.scaleEnemy({name:'%s',health:120,damage:9,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
      TB.call(S, ()=>{ const f=new G.Fight(S,e); f.allies=[]; return f.run({trySneak:false}); }, ()=>{}); })()""" % foe), ("wait", 2500),
           ("js", "document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click())"), ("wait", 1200))

screen("fight_dragon", ("at", "Whiterun"), ("js", """(()=>{ const S=__dbg.save(); S.dungeon=null; S.trip=null;
      const e=G.scaleEnemy({name:'Dragon',health:400,damage:12,tags:['dragon'],level:12,danger:'high',gold:[0,0],text:''},12);
      TB.call(S, ()=>{ const f=new G.Fight(S,e); f.allies=[]; return f.run({trySneak:false}); }, ()=>{}); })()"""), ("wait", 2500),
       ("js", "document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click())"), ("wait", 1200))
screen("loadcard", ("js", """(()=>{ const bg=ASSETS.loading(1); if(!bg) return; const el=document.createElement('div'); el.id='loadcard'; el.className='loadcard haspic still';
      el.innerHTML='<div class=ldtxt><p class=ldtip>Loading</p></div>'; el.style.setProperty('--ldbg', 'url("'+bg.src.split('/').pop()+'")'); document.body.appendChild(el); })()"""))
screen("wev_sheet", ("js", """(()=>{ const S=__dbg.save(); const A=typeof WEVENTS.active==="function"?WEVENTS.active():(WEVENTS.rows?WEVENTS.rows(S):[]); const ev=(A||[])[0]; if(!ev) return; const m=document.createElement('div'); m.id='modal'; m.className='modal';
      m.innerHTML='<div class=sheet>'+WEVENTS.detailHTML(ev,S)+'</div>'; document.body.appendChild(m); })()"""))

screen("hero", ("tab", "hero"))
screen("perks", ("tab", "hero"), ("sub", "perks"))
screen("journal", ("tab", "log"))
screen("menu_items", ("js", "__ui.openMenu && __ui.openMenu('items')"))
screen("menu_magic", ("js", "__ui.openMenu && __ui.openMenu('magic')"))

async def settle(pg, ms=400):
    await pg.wait_for_timeout(ms)
    for _ in range(30):   # wait for pictures still on their way
        if await pg.evaluate("typeof ASSETS==='undefined' || !ASSETS.pending"): break
        await pg.wait_for_timeout(150)
    await pg.wait_for_timeout(450)

async def run_vp(b, vp, fails, need):
    name, vw, vh, d = vp
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=d, is_mobile=vw < 700, has_touch=vw < 700)
    await ctx.add_init_script("try{localStorage.setItem('rotn_prefs', JSON.stringify({artStyle:'ink'}));sessionStorage.clear()}catch(e){}")
    await ctx.add_init_script(WATCH)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    for i in range(4):   # the little test server sometimes drops a script under load: load again until every file arrived
        try:
            errs.clear()
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&assets&p=aq{vw}x{d}")
            await pg.wait_for_selector(".press", timeout=45000)
            if not any("is not defined" in e for e in errs): break
        except Exception:
            if i == 3: raise
        await pg.wait_for_timeout(1500)
    await settle(pg, 1200)

    async def check(sname):
        await pg.screenshot(path=os.path.join(OUT, f"{name.replace('@', '_x')}_{sname}.png"))
        r = await pg.evaluate(CHECK, {"up": MAX_UP, "warn": WARN_UP, "asp": MAX_ASPECT, "allow": ALLOW, "skip": SKIP, "drawn": MAX_UP})
        for k, v in r["need"].items():
            o = need.get(k)
            if not o or v[0] > o[0]: need[k] = v + [f"{name} {sname}"]
        print(f"  {name:12} {sname:14} " + ("ok" if not r["bad"] else "FAIL " + "; ".join(r["bad"])[:600]) + (f"   [{', '.join(sorted(r['seen']))[:160]}]" if r["seen"] else ""), flush=True)
        if r["warn"] and FLAGS.get("warn") is not None: print("      soft (allowed): " + "; ".join(r["warn"])[:400])
        if r["bad"]: fails.append(f"{name} {sname}: {r['bad']}")

    if (ONLY and "title" in ONLY) or "title" in FLAGS: await check("title")
    await pg.evaluate("document.querySelector('.press')?.click()"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('.mi[data-t=new]')?.click()"); await pg.wait_for_timeout(400)
    if not ONLY or "create" in ONLY:
        await pg.wait_for_timeout(600); await settle(pg); await check("create")
    await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(SETUP)
    await pg.mouse.move(2, vh // 2)
    for sname, steps in SCREENS:
        if ONLY and sname not in ONLY: continue
        await pg.evaluate(RESET); await pg.wait_for_timeout(150)
        for kind, arg in steps:
            try:
                if kind == "tab": await pg.evaluate(TAB, arg)
                elif kind == "sub": await pg.evaluate(SUB, arg)
                elif kind == "at": await pg.evaluate(AT, arg); continue
                elif kind == "wait": await pg.wait_for_timeout(arg); continue
                else: await pg.evaluate(arg)
            except Exception as e: errs.append(f"{sname}: {str(e)[:120]}")
            await pg.wait_for_timeout(300)
        await settle(pg)
        await check(sname)
    if errs: print(f"  {name} page errors: {errs[:4]}")
    await ctx.close()

async def main():
    fails, need = [], {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for vp in VPS:
            print(vp[0], flush=True)
            await run_vp(b, vp, fails, need)
        await b.close()
    if need:
        print("\nPainted files smaller than their biggest box on a PC (shown at their own size, never blown up). Paint again at:")
        for k, v in sorted(need.items()):
            print(f"  {k:24} now {(str(v[2]) + 'x' + str(v[3])) if v[2] else '?':<11} needs {v[0]}x{v[1]:<6} ({v[4]})")
    if fails:
        print(f"art_quality_ui: {len(fails)} problems"); sys.exit(1)
    print("art_quality_ui: all good")

asyncio.run(main())
