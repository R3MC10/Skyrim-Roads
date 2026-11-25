"""Readable fight numbers (fightnums.js). Usage: python fightnums_ui.py PORT -> RESULT OK
Serve game/ first:  node serve.js PORT
Phone 360x780 / 390x844 (touch) and PC 1440x900 / 1920x1080; a group of bandits, a giant and a dragon. After a burst
of hits (damage, a crit, fire, poison, a hit on you, a heal, magicka and stamina spent, a miss and a block):
- every foe (and the ones waiting behind it) is fully on screen, the right-most one too
- every number is inside the screen, off the foe's plate, the turn strip and the fight buttons, and never on another
- crits are bigger than plain hits; damage, heal and magicka / stamina have different colours; numbers are outlined
- reduced motion: the numbers only fade
- the turn order's numbers are at least 11px; no page errors
Screenshots in $SHOTS/out_fightnums/ (default: the system temp folder), never in tests/."""
import asyncio, sys, os, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "out_fightnums") + os.sep; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

CASES = [("group", "^Bandit outlaw$", 3), ("giant", "^Giant$", 0), ("dragon", "^Dragon$", 0)]
SIZES = [(360, 780, True), (390, 844, True), (1440, 900, False), (1920, 1080, False)]
SETUP = """([foeRe, grp]) => {
  document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=30; S._test=true; S.hpBonus=400; S.follower=null; S.dungeon=null; S.trip=null; S.gold=5000;
  for (const k of Object.keys(S.skills)) S.skills[k].lvl=40;
  const id=G.give(S,'steel_sword'); G.equip(S,id); G.setHealth(S,G.maxHealth(S));
  if (grp) { const op=FOEGROUPS.prep; FOEGROUPS.prep=(f,pl)=>{ const r=op(f,pl); return r.n<grp ? { n: grp, hpMul: Array(grp).fill(1.3/grp), kind: r.kind } : r; }; }
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
  S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const re=new RegExp(foeRe); const base=D.ENCOUNTERS.find(x=>re.test(x.name)) || D.ENCOUNTERS[0];
  const e={...base}; e.hp=(e.health||50)*6; e.health=e.hp; S.trip.status='encounter'; S.trip.encounter=G.scaleEnemy(e,30); __dbg.openEncounter(); }"""
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove()); document.querySelectorAll('.tbtip').forEach(t=>t.classList.remove('on'))"
POPS = """()=>{ const el=document.getElementById('tbf');
  const pops=[{at:'foe',n:-34,el:'phys'},{at:'foe',n:-121,el:'phys',crit:true},{at:'foe',n:-18,el:'fire'},{at:'foe',n:-9,el:'poison'},
   {at:'me',n:-27,el:'frost'},{at:'me',n:45,el:'heal'},{at:'me',n:-20,el:'mp',tag:'MP'},{at:'me',n:-15,el:'sp',tag:'SP'}];
  FIGHTNUMS.extra([{kind:'me',text:'Power attack misses'},{kind:'foe',text:"Bandit's arrow glances off your shield"}], pops);
  TBUI.after(el,{pops}); }"""
READ = """()=>{ const el=document.getElementById('tbf'), host=el.querySelector('.tbin'), hb=host.getBoundingClientRect();
  const R=(n)=>{ if(!n) return null; const b=n.getBoundingClientRect(); return b.width?{left:b.left,top:b.top,right:b.right,bottom:b.bottom}:null; };
  const cv=el.querySelector('.fscene canvas'), L=cv&&cv.__fp, rc=cv&&cv.getBoundingClientRect(), k=rc?rc.width/L.W:1;
  const fr=(p)=>({left:rc.left+p.left*k, right:rc.left+p.right*k, top:rc.top+p.top*k, bottom:rc.top+p.y*k});
  const pops=[...el.querySelectorAll('.tbpop.fn')].map(p=>{ const cs=getComputedStyle(p), l=hb.left+parseFloat(p.style.left), t=hb.top+parseFloat(p.style.top);
    return {t:p.textContent, cls:p.className, r:{left:l, top:t, right:l+p.offsetWidth, bottom:t+p.offsetHeight}, fs:parseFloat(cs.fontSize), col:cs.color, sh:cs.textShadow, anim:cs.animationName}; });
  const ini=el.querySelector('.tbini i');
  return { vw:innerWidth, vh:innerHeight, foes: L?[L.foe, ...L.waiting].map(fr):[], plate:R(el.querySelector('.c2ov .tbu.foe')), dock:R(el.querySelector('.tbdock')),
    top:R(el.querySelector('.tbtop')), pops, ini: ini?parseFloat(getComputedStyle(ini).fontSize):0,
    wide: Math.max(host.scrollWidth, document.documentElement.scrollWidth) - innerWidth }; }"""

def hit(a, b, pad=1):
    return a and b and a["left"] < b["right"] - pad and a["right"] > b["left"] + pad and a["top"] < b["bottom"] - pad and a["bottom"] > b["top"] + pad

async def fight(b, name, foeRe, grp, w, h, touch, motion="no-preference"):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=touch, is_mobile=touch, reduced_motion=motion)
    await ctx.add_init_script("try{localStorage.setItem('rotn_prefs',JSON.stringify({tips:false,obTips:false,obNext:false,tbFast:true}))}catch(e){}")
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=fnum{w}{name}{motion[:2]}&tb"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Torvald"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate(SETUP, [foeRe, grp]); await pg.wait_for_timeout(500)
    for _ in range(12):
        if await pg.evaluate("!!document.querySelector('#modal [data-act=enc][data-a=fight]')"): break
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('[data-act=openenc]')?.click() || __dbg.openEncounter()"); await pg.wait_for_timeout(400)
    await pg.evaluate("document.querySelector('#modal [data-act=enc][data-a=fight]')?.click()"); await pg.wait_for_timeout(1500)
    for _ in range(30):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]') || (TB.session&&TB.session.done)"): break
        await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(200)
    await pg.wait_for_timeout(1000); await pg.evaluate(CLEAN); await pg.mouse.move(2, 2)
    return ctx, pg, errs

async def run(b, name, foeRe, grp, w, h, touch):
    tag = f"{name}_{w}x{h}"
    ctx, pg, errs = await fight(b, name, foeRe, grp, w, h, touch)
    await pg.evaluate(POPS); await pg.wait_for_timeout(900)
    d = await pg.evaluate(READ)
    await pg.screenshot(path=OUT + tag + ".png")
    vw = d["vw"]
    ok(d["foes"] and all(f["right"] <= vw + 1 and f["left"] >= -1 for f in d["foes"]), f"{tag}: every foe fully on screen {[(round(f['left']), round(f['right'])) for f in d['foes']]}")
    P = d["pops"]
    ok(len(P) == 10, f"{tag}: all ten numbers show ({len(P)})")
    for p in P:
        r = p["r"]
        ok(r["left"] >= 0 and r["right"] <= vw and r["top"] >= 0 and r["bottom"] <= d["vh"], f"{tag}: '{p['t']}' inside the screen")
        ok(not hit(r, d["plate"]) and not hit(r, d["dock"]) and not hit(r, d["top"]), f"{tag}: '{p['t']}' off the foe plate, the turn strip and the buttons")
        ok(p["sh"].count("rgb") >= 6 or "fn-res" in p["cls"], f"{tag}: '{p['t']}' has a dark outline")
    for i, a in enumerate(P):
        for c in P[i + 1:]:
            ok(not hit(a["r"], c["r"], 2), f"{tag}: '{a['t']}' and '{c['t']}' don't stack")
    by = {p["t"]: p for p in P}
    crit, plain = by.get("-121!"), by.get("-34")
    ok(crit and plain and crit["fs"] >= plain["fs"] * 1.3, f"{tag}: a crit is bigger ({crit and crit['fs']} vs {plain and plain['fs']})")
    heal, mp, sp = by.get("+45"), by.get("-20 MP"), by.get("-15 SP")
    ok(heal and mp and sp and len({plain["col"], heal["col"], mp["col"], sp["col"]}) == 4, f"{tag}: damage, heal, magicka and stamina have their own colours")
    ok(any(p["t"] == "Miss" for p in P) and any(p["t"] == "Blocked" for p in P), f"{tag}: a miss and a block show as words")
    ok(plain and plain["fs"] >= 20, f"{tag}: a plain hit is at least 20px ({plain and plain['fs']})")
    ok(d["ini"] >= 11, f"{tag}: the turn order's numbers are readable ({d['ini']}px)")
    ok(d["wide"] <= 1, f"{tag}: nothing wider than the screen")
    ok(not errs, f"{tag}: no page errors {errs[:2]}")
    await ctx.close()

async def calm(b):
    ctx, pg, errs = await fight(b, "calm", "^Bandit outlaw$", 0, 390, 844, True, "reduce")
    await pg.evaluate(POPS); await pg.wait_for_timeout(300)
    d = await pg.evaluate(READ)
    ok(d["pops"] and all(p["anim"] == "fnfade" for p in d["pops"]), f"reduced motion: numbers only fade {set(p['anim'] for p in d['pops'])}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, foeRe, grp in CASES:
            for (w, h, t) in SIZES:
                try: await run(b, name, foeRe, grp, w, h, t)
                except Exception as e: ok(False, f"{name} {w}: {str(e)[:160]}")
        try: await calm(b)
        except Exception as e: ok(False, f"reduced motion: {str(e)[:160]}")
        await b.close()
    print("FAILED " + str(len(fails)) if fails else "RESULT OK")
    sys.exit(1 if fails else 0)

asyncio.run(main())
