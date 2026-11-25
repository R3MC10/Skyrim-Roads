"""The fight camera (fightcam.js) on the real fight screen.
Sizes: a 390x844 phone, a small 360x640 phone and a 1920x1080 PC; settings Cinematic, Calm and Off; moments: a crit, a
boss intro and the victory, each caught mid-move. Checks:
- the camera moves as far as the setting allows (Cinematic up to 1.15x, Calm up to 1.05x, Off never) and comes back;
- the turn order, the foe card, your orb and every move button stay exactly where they were (only the battlefield moves);
- no edge of the picture shows (no bare background colour along the canvas borders), even mid-move;
- the phone's Reduce motion turns Cinematic into Calm;
- a crit in a played-out fight: the camera moves once, slow motion plays and the scene still ends on time.
Screenshots go to $SHOTS (or the temp folder) as fightcam_<tag>_<size>_<mode>_<moment>.png, plus a frame strip of one
crit (fightcam_<tag>_crit_strip.png).
Usage: python3 fightcam_ui.py PORT [tag]   (tag "before": the old camera; only screenshots and the strip, no checks)"""
import asyncio, sys, os, io, time, tempfile
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
TAG = sys.argv[2] if len(sys.argv) > 2 else "after"
BEFORE = TAG == "before"
RUN = str(int(time.time()) % 100000)
OUT = (os.environ.get("SHOTS") or tempfile.gettempdir()) + os.sep; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

HERO = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration','Athletics']) S.skills[k].lvl=45;
  S.follower={id:'lydia',hp:9999,ts:0}; G.give(S,'potion_health',3); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; return true; }"""
ROAD = """()=>{ const S=window.__dbg.save();
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
SOLO = """()=>{ const pp=FOEGROUPS.prep; FOEGROUPS.prep=(f,pl)=>{ FOEGROUPS.prep=pp; pp(f,pl); return {n:1,hpMul:[1]}; }; }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelectorAll('#obtip, #fhints').forEach(e=>e.remove())"
# the parts of the screen that must never move, in page px
UI = """()=>{ const vis=(e)=>{ const r=e.getBoundingClientRect(); return r.width>1&&r.height>1&&getComputedStyle(e).visibility!=='hidden'; };
  const out={}; for (const [k,q] of [['order','#tbf .tbtop'],['foe card','#tbf .c2ov .tbu.foe'],['you','#tbf .c2ov .tbu.me'],['buttons','#tbf .tbdock [data-tba]']])
    [...document.querySelectorAll(q)].filter(vis).forEach((e,i)=>{ const r=e.getBoundingClientRect(); out[k+i]=[r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10); });
  return out; }"""
# bare background along the canvas borders (the colour fightart clears to before drawing a moved camera)
EDGE = """()=>{ const cv=document.querySelector('#tbf .fscene canvas'); if(!cv) return null; const g=cv.getContext('2d'); const w=cv.width,h=cv.height;
  let bare=0, n=0; const look=(x,y,ww,hh)=>{ const d=g.getImageData(x,y,ww,hh).data; for (let i=0;i<d.length;i+=4) { n++; if (Math.abs(d[i]-28)<3&&Math.abs(d[i+1]-33)<3&&Math.abs(d[i+2]-40)<3) bare++; } };
  look(0,0,w,2); look(0,h-2,w,2); look(0,0,2,h); look(w-2,0,2,h); return { bare, n }; }"""

async def start(pg, size, mode, rm=False):
    for _ in range(5):
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=fc{RUN}{size}{mode}{int(rm)}&tb"); await pg.wait_for_timeout(1800)
        if await pg.evaluate("typeof ENC!=='undefined' && typeof TB!=='undefined' && typeof FOEGROUPS!=='undefined'"):
            try: await pg.wait_for_selector(".press", timeout=15000); break
            except Exception: pass
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Lens"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(f"(()=>{{ const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{{}}'); p.fsCamMode={mode!r}; localStorage.setItem('rotn_prefs', JSON.stringify(p)); }})()")
    await pg.evaluate(HERO); await pg.evaluate(SOLO); await pg.evaluate(ROAD); await pg.wait_for_timeout(600)
    for _ in range(12):
        if await pg.evaluate("!!document.querySelector('#tbf')"): break
        await pg.evaluate("(()=>{ const b=document.querySelector('#modal [data-act=ev][data-c=fight]'); if (b) return b.click(); document.querySelectorAll('#modal').forEach(m=>m.remove()); if (__dbg.save().trip && __dbg.save().trip.event) __dbg.openEvent(); })()"); await pg.wait_for_timeout(500)
    for _ in range(80):
        await pg.evaluate(CLEAN)
        if await pg.evaluate(MYTURN): return True
        await pg.wait_for_timeout(250)
    return False

# a moment on the fight screen's camera, stepped by hand; returns the view mid-move
MOMENT = """(a)=>{ const [kind, ms] = a; const C = FIGHTCAM.main; C.reset(); C.tick(5000);
  const r = kind === 'intro' ? FIGHTCAM.punch('intro', { focus: ['foe'] }) : kind === 'victory' ? FIGHTCAM.punch('victory', { focus: ['hero','foe'] }) : FIGHTCAM.punch('crit', { focus: ['hero','foe'], dir: 1 });
  FIGHTART.advance(ms); const v = C.view(); return { ok: !!(r && r.ok), z: v.z, rot: v.rot, kind: C.kind }; }"""
MOMENTS = [("crit", 300), ("intro", 120), ("victory", 1000)]
MAXZ = {"cin": 1.15, "calm": 1.05, "off": 1.0}

async def case(b, w, h, mode, errs, rm=False):
    phone = w < 900; size = f"{w}x{h}"; tag = f"{size} {mode}{' reduce-motion' if rm else ''}"
    kw = {"viewport": {"width": w, "height": h}, "device_scale_factor": 1}
    if phone: kw.update(has_touch=True, is_mobile=True)
    if rm: kw["reduced_motion"] = "reduce"
    ctx = await b.new_context(**kw); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    ok(await start(pg, size, mode, rm), f"{tag}: the fight reaches your turn")
    await pg.mouse.move(1, 1); await pg.evaluate("FIGHTART.manual(true)"); await pg.wait_for_timeout(300)
    if BEFORE:
        await pg.screenshot(path=f"{OUT}fightcam_{TAG}_{size}_turn.png"); await ctx.close(); return
    if rm: ok(await pg.evaluate("FIGHTCAM.mode()") == "calm", f"{tag}: Reduce motion turns Cinematic into Calm")
    ok(await pg.evaluate(f"document.getElementById('tbf').classList.contains('fcam-calm') === {str(mode == 'calm' or rm).lower()} && document.getElementById('tbf').classList.contains('fcam-off') === {str(mode == 'off').lower()}"), f"{tag}: the screen knows the setting (no DOM shake in Calm/Off)")
    ui0 = await pg.evaluate(UI)
    ok(len(ui0) >= 5, f"{tag}: the fixed parts are on screen ({len(ui0)})")
    top = MAXZ["calm" if rm and mode == "cin" else mode]
    for kind, ms in MOMENTS:
        v = await pg.evaluate(MOMENT, [kind, ms])
        await pg.wait_for_timeout(60)
        await pg.screenshot(path=f"{OUT}fightcam_{TAG}_{size}_{mode}{'_rm' if rm else ''}_{kind}.png")
        if mode == "off": ok(not v["ok"] and v["z"] == 1, f"{tag} {kind}: Off keeps the picture fixed ({v})")
        else: ok(v["ok"] and 1.0 < v["z"] <= top + 1e-6, f"{tag} {kind}: mid-move at {v['z']:.3f} (1 < z <= {top})")
        if mode != "cin" or rm: ok(v["rot"] == 0, f"{tag} {kind}: no tilt")
        ui1 = await pg.evaluate(UI)
        moved = [k for k in ui0 if k in ui1 and any(abs(a - c) > 1 for a, c in zip(ui0[k], ui1[k]))]
        ok(not moved and len(ui1) == len(ui0), f"{tag} {kind}: the turn order, cards and buttons stay put {moved[:4]}")
        e = await pg.evaluate(EDGE)
        ok(e and e["bare"] <= e["n"] * 0.002, f"{tag} {kind}: no picture edge shows ({e and e['bare']} bare of {e and e['n']} border pixels)")
    # back to neutral, and nothing waits for the camera
    await pg.evaluate("FIGHTCAM.main.reset(); FIGHTCAM.main.tick(5000); FIGHTCAM.punch('crit',{focus:['foe']}); FIGHTART.advance(1200)")
    ok(await pg.evaluate("FIGHTCAM.main.view().z === 1 && !FIGHTCAM.main.active()"), f"{tag}: the camera comes back to neutral")
    ok(await pg.evaluate("!document.querySelector('#tbf [data-tba=end]').disabled"), f"{tag}: your buttons stay ready the whole time")
    await ctx.close()

# one crit in a played-out fight (a scene outside the fight screen, its own camera): a strip of frames
SYNTH = r"""()=>{ const base=D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw') || D.ENCOUNTERS[0], e={...G.scaleEnemy(base,10)};
  const log=[{turn:1, rule:0, me:'Attack: 18', them:'', hp:200, ehp:100, a:'attack', wt:'sword'},
             {turn:2, rule:0, me:'Attack: 36 (critical)', them:`${e.name} hits 6`, hp:194, ehp:64, a:'attack', wt:'sword'},
             {turn:3, rule:0, me:'Attack: 20', them:'', hp:194, ehp:44, a:'attack', wt:'sword'}];
  const f={ log, hp0:200, ehp0:118, won:true, tbMid:true, e, wt:'sword', wt0:'sword', weapon:null, eq:{}, armor:{}, shield:null, allies:[], turn:3 };
  document.getElementById('fcbox')?.remove(); const b=document.createElement('div'); b.id='fcbox'; b.style.cssText='position:fixed;left:0;top:0;width:380px;z-index:9999;background:#111;padding:6px'; document.body.appendChild(b);
  const d=document.createElement('div'); d.style.width='368px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); b.appendChild(d); return true; }"""

async def strip(b, errs):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"strip {e}"))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=fcs{RUN}"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Lens"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.evaluate("FIGHTART.manual(true)")
    await pg.evaluate(SYNTH); await pg.wait_for_timeout(200)
    el = await pg.query_selector("#fcbox .fscene")
    # play to the crit beat, then 16 frames 60 ms apart around the blow
    ms = 0
    while ms < 20000:
        st = await pg.evaluate("FIGHTART.advance(20)"); ms += 20
        if not st or st[0]["beat"] >= 1: break
    frames, zs, kinds, t0 = [], [], [], ms
    for i in range(22):
        st = await pg.evaluate("FIGHTART.advance(60)"); ms += 60
        if st: zs.append(st[0]["cam"][0]); kinds.append(st[0]["cam"][3] if len(st[0]["cam"]) > 3 else None)
        if i % 2 == 0 or i < 14: frames.append(Image.open(io.BytesIO(await el.screenshot())).convert("RGB"))
    while ms < 30000:
        st = await pg.evaluate("FIGHTART.advance(100)"); ms += 100
        if not st or st[0]["done"]: break
    ok(True, f"strip: the scene played ({ms} ms)")
    if not BEFORE:
        ok("crit" in kinds, f"strip: the crit is one camera move {sorted(set(k for k in kinds if k))}")
        ok(max(zs) <= 1.15 + 1e-6 and max(zs) > 1.05, f"strip: closes in to {max(zs):.3f}")
        ok(zs[-1] < max(zs), "strip: and eases back")
    w, h = frames[0].size; cols = 6; rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (w // 2) + 4, rows * (h // 2 + 14) + 4), (12, 12, 14)); d = ImageDraw.Draw(sheet)
    for i, fr in enumerate(frames):
        x, y = 2 + (i % cols) * (w // 2), 2 + (i // cols) * (h // 2 + 14)
        sheet.paste(fr.resize((w // 2, h // 2)), (x, y + 14)); d.text((x + 4, y + 1), f"{i}", fill=(230, 210, 150))
    sheet.save(f"{OUT}fightcam_{TAG}_crit_strip.png")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        try: await strip(b, errs)
        except Exception as e: ok(False, f"strip: ran ({e})")
        for (w, h) in ((390, 844), (360, 640), (1920, 1080)):
            for mode in (("cin",) if BEFORE else ("cin", "calm", "off")):
                try: await case(b, w, h, mode, errs)
                except Exception as e: ok(False, f"{w}x{h} {mode}: ran ({e})")
        if not BEFORE:
            try: await case(b, 390, 844, "cin", errs, rm=True)
            except Exception as e: ok(False, f"reduce motion: ran ({e})")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "ALL OK")
    sys.exit(1 if fails else 0)

asyncio.run(main())
