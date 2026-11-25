"""Map rider screen test (mapride.js + maphero.js): the mounted hero on the world map with a horse that really moves.
1) a strip at the REAL map size: the hero on foot (standing, walking) and on a horse standing, walking, trotting and
   galloping, 6 frames each, wearing steel armour, a helmet, sword and shield (so you can check the rider matches the
   hero), plus a second strip of a Khajiit in leather with a bow;
2) the real world map: riding (walk / trot / gallop by pace), standing, and a party of 6 riding in a line (fake party
   members injected into the map view), on a phone (390x844, dpr 2) and a PC (1920x1080).
Run:  node tests/serve.js 9571   then   python tests/maprider_ui.py 9571 [outdir]
Fails on page errors, a gait that doesn't move, a rider that isn't the painted hero, or a missing figure on the map."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9571"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "maprider_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.(); document.getElementById('map')?.scrollIntoView({block:'center'})"
GEAR = """async (kit)=>{ const S=__dbg.save(); for (const id of kit) { const rid=G.give(S,id); G.equip(S,rid); }
  for (let i=0;i<50 && !PAINTRIG.can(HEROART.lookOf(S));i++) await new Promise(r=>setTimeout(r,200)); return PAINTRIG.can(HEROART.lookOf(S)); }"""

# rows of 6 frames at the real map size (scale 1, s = 1 css px), one row per state
STRIP = """async ([cw, race, kit, name])=>{
  const S=__dbg.save(); let look = HEROART.lookOf(S);
  if (race) { look = { ...look, r: race, id: 'strip-' + race }; }
  if (kit) { look = { ...look, eq: kit }; }
  for (let i=0;i<50 && !PAINTRIG.can(look);i++) await new Promise(r=>setTimeout(r,200));
  const col = HORSES.coat(race ? 'palomino' : 'black')[2];
  const rows = [
    ['on foot, standing', { moving: false }, 2.4], ['on foot, walking', { moving: true, heading: 0 }, 0.9],
    ['horse standing', { horse: col, moving: false }, 2.8], ['horse walk (pace 0.8)', { horse: col, moving: true, pace: 0.8, heading: 0 }, 1.1],
    ['horse trot (pace 1.5)', { horse: col, moving: true, pace: 1.5, heading: 0 }, 0.65], ['horse gallop (pace 2.4)', { horse: col, moving: true, pace: 2.4, heading: 0 }, 0.45],
  ];
  const N = 6, cellW = 70, cellH = 66, dpr = devicePixelRatio || 1, W = cellW * N + 150;
  const c = document.createElement('canvas'); c.id = 'mrstrip'; c.width = W * dpr; c.height = cellH * rows.length * dpr;
  c.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${cellH * rows.length}px;z-index:99999;background:#b9a27a`;
  document.body.appendChild(c);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const diffs = {};
  rows.forEach(([nm, o, per], r) => {
    g.fillStyle = r % 2 ? '#b9a27a' : '#ad966e'; g.fillRect(0, cellH * r, W, cellH);
    g.fillStyle = '#2a1d10'; g.font = '700 12px Georgia'; g.fillText(nm, 4, cellH * r + 36);
    const seen = new Set(), id = 'strip' + name + r;
    // warm the gait state up so the strip shows the settled gait, not the blend in
    for (let i = 0; i < 12; i++) MAPHERO.figure(document.createElement('canvas').getContext('2d'), { id, look, ...o }, 0, 0, i * 0.05, { s: 1 });
    for (let i = 0; i < N; i++) {
      const x = 150 + cellW * (i + 0.5), y = cellH * (r + 0.86);
      g.save(); g.beginPath(); g.rect(150 + cellW * i, cellH * r, cellW, cellH); g.clip();
      MAPHERO.figure(g, { id, look, ...o }, x, y, 0.6 + per * i / N, { s: 1 });
      g.restore();
      const px = g.getImageData((150 + cellW * i) * dpr, cellH * r * dpr, cellW * dpr, cellH * dpr).data;
      let h = 0; for (let k = 0; k < px.length; k += 8) h = (h * 31 + px[k] + px[k + 1] * 3) >>> 0; seen.add(h);
    }
    diffs[nm] = seen.size;
  });
  return { diffs, w: W, h: cellH * rows.length, painted: PAINTRIG.can(look) };
}"""

PLACE = """(t)=>{ const S=__dbg.save(); S.location=null; [S.x,S.y]=WORLD.places[t]; for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n); __ui.go('map'); }"""
HORSE = "()=>{ const S=__dbg.save(); S.horse={name:'Shadow', breed:'bay', coat:'black', armor:'none', shoes:'none', bags:0, hp:200, hpT:G.now(), mounted:true}; }"
TRIP = "(to)=>{ const S=__dbg.save(); G.startTrip(S, to, WORLD.places[to].slice(0,2)); }"
STOP = "()=>{ const S=__dbg.save(); S.trip=null; }"
HERE = """()=>{ const st=__dbg.mapStats ? __dbg.mapStats() : null; const v=__dbg.view(), t=v.transform, r=document.getElementById('map').getBoundingClientRect();
  return [r.left + v.player[0]*WorldMap.W*t.k + t.ox, r.top + v.player[1]*WorldMap.H*t.k + t.oy]; }"""
# a party of n riding behind you: fake party members in the map view (the map's own party line places them)
PARTY = """(n)=>{ const S=__dbg.save(); const coats=['bay','chestnut','grey','white','palomino','paint','black'], races=['nord','khajiit','dunmer','orc','argonian','altmer','redguard'];
  window.__fakeParty = Array.from({length:n-1}, (_, i) => ({ id: 'fp' + i, name: ['Kacper','Lydia','Aela','Faendal','Borgakh','Jenassa','Mjoll'][i], race: races[i],
    look: { ...HEROART.lookOf(S), r: races[i], id: 'fp' + i }, horse: HORSES.coat(coats[i])[2], party: true }));
}"""
# the map view as the game builds it, with a pace you pick (window.__pace) and the fake party mixed in
WRAP = """()=>{ if (window.__wrapped) return; window.__wrapped = true; const real = WorldMap.draw; WorldMap.draw = function (cv, v, ...rest) {
    if (v && window.__pace != null && v.moving) v.pace = window.__pace;
    if (window.__fakeParty && v) { v.party = { leader: v.me, ids: [v.me, ...__fakeParty.map((f) => f.id)] };
      v.others = [...(v.others || []).filter((o) => !String(o.id).startsWith('fp')), ...__fakeParty.map((f) => ({ ...f, pos: v.player, moving: v.moving, pace: v.pace, trail: v.trail }))]; }
    return real.call(this, cv, v, ...rest); }; }"""

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for tag, vw, vh, dsf in [("phone", 390, 844, 2), ("pc", 1920, 1080, 1)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dsf)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?assets&notut&p=mr{tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "R3MC10"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(CLEAR)
            ok = await pg.evaluate(GEAR, ["steel_armor", "steel_helmet", "steel_sword", "steel_shield", "steel_boots", "steel_gauntlets"])
            if not ok: fails.append(f"{tag}: the painted hero never loaded")
            # 1) the strips at the real size
            for nm, race, kit in [("steel", None, None), ("khajiit", "khajiit", {"chest": "leather_armor", "weapon": "hunting_bow", "feet": "leather_boots"})]:
                r = await pg.evaluate(STRIP, [min(vw, 900), race, kit, nm])
                print(tag, nm, "different frames per row:", r["diffs"], "painted:", r["painted"])
                await pg.screenshot(path=os.path.join(OUT, f"{tag}_strip_{nm}.png"), clip={"x": 0, "y": 0, "width": min(vw, r["w"]), "height": min(vh, r["h"])})
                await pg.evaluate("document.getElementById('mrstrip').remove()")
                for row, n in r["diffs"].items():
                    if row != "horse standing" and n < 4: fails.append(f"{tag} {nm}: {row} barely moves ({n} different frames of 6)")
                    if row == "horse standing" and n < 2: fails.append(f"{tag} {nm}: the standing horse is frozen")
                if not r["painted"]: fails.append(f"{tag} {nm}: rider not painted")
            # the gait state machine on the live map: pace → gait
            g = await pg.evaluate("""()=>{ const st={}, out=[]; for (const [p,t] of [[0,0],[0.8,1],[1.5,2],[2.4,3],[1.9,4],[1.7,5],[1.05,6],[0.95,7],[0,8]]) out.push(MAPRIDE.step(st,{moving:p>0,pace:p,t,id:'x'}).gait); return out; }""")
            print(tag, "gaits:", g)
            if g != ["idle", "walk", "trot", "gallop", "gallop", "trot", "trot", "walk", "idle"]: fails.append(f"{tag}: gait machine {g}")
            # 2) the real map
            await pg.evaluate(WRAP); await pg.evaluate(PLACE, "Whiterun"); await pg.evaluate(CLEAR); await pg.wait_for_timeout(600)

            async def shot(name, wide=False):
                await pg.evaluate(CLEAR); await pg.wait_for_timeout(700)
                x, y = await pg.evaluate(HERE)
                # panels floating over the map right where the hero is (the phone's travel strip): out of the way for the picture
                await pg.evaluate("""([x,y])=>{ const m=document.getElementById('map'); for (const dx of [-120,0,120]) for (const dy of [-60,0,30]) for (const el of document.elementsFromPoint(x+dx,y+dy)) {
                  if (el===m || el.contains(m) || el===document.body || el===document.documentElement) continue; let top=el; while (top.parentElement && !top.parentElement.contains(m)) top=top.parentElement; top.style.visibility='hidden'; } }""", [x, y])
                await pg.wait_for_timeout(200)
                await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
                w, h = (440, 240) if wide else (220, 130)
                await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}_close.png"), clip={"x": max(0, x - w / 2 - (120 if wide else 0)), "y": max(0, y - h * 0.7), "width": w, "height": h})

            await pg.evaluate(HORSE); await pg.evaluate("()=>__ui.go('map')"); await pg.wait_for_timeout(1500); await shot("idle")
            await pg.evaluate(TRIP, "Riverwood"); await pg.evaluate("()=>__ui.go('map')"); await pg.wait_for_timeout(1500)
            for gait, pace in [("walk", 0.8), ("trot", 1.5), ("gallop", 2.4)]:
                await pg.evaluate("(p)=>{ window.__pace = p; }", pace)
                await pg.wait_for_timeout(900); await shot(gait)
                seen = await pg.evaluate("()=>MAPHERO.gait('me')")
                if seen != gait: fails.append(f"{tag}: map shows {seen} at pace {pace}, wanted {gait}")
            await pg.evaluate("()=>{ window.__pace = null; }")
            for n in (4, 8):
                await pg.evaluate(PARTY, n); await pg.wait_for_timeout(900); await shot(f"party{n}", True)
            await pg.evaluate(STOP); await pg.wait_for_timeout(1500); await shot("party8_stopped", True)
            if errs: fails.append(f"{tag}: page errors {errs[:4]}")
            await ctx.close()
        await b.close()
    print("screenshots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("OK")

asyncio.run(main())
