"""The slim foe plate and the scrollable fight log (foepanel.js). Usage: python foepanel_ui.py PORT -> RESULT OK
Serve game/ first:  node serve.js PORT
Phone 390x844 (touch) and PC 1920x1080 / 1366x768, a bandit chief boss and a group of bandits:
- the foe's plate has no dark box, sits above the foe's head (a boss's sits under the boss bar) and never on a fighter
- numbers show only on hover / tap
- the boss's warning is one line
- the fight log sits clear of every fighter and the foe's plate; it scrolls through the whole fight, stays where you
  scrolled to when the screen redraws, a "newest" chip brings it back down
- nothing wider than the screen, no page errors
Screenshots in SHOTS/out_foepanel/ (default: the system temp folder), never in tests/."""
import asyncio, sys, os, tempfile
from playwright.async_api import async_playwright
from roadfight import open_fight
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "out_foepanel") + os.sep; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

START = """([kind])=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  try { const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.tbFast=true; p.tips=false; localStorage.setItem('rotn_prefs', JSON.stringify(p)); localStorage.setItem('rotn_pfflog','1'); } catch(e){}   // phones: the log unfolded (phonefight.js), so it scrolls
  const S=window.__dbg.save(); S.level=25; S.hpBonus=220; for (const k of ['One-Handed','Blocking','Heavy Armor','Restoration']) S.skills[k].lvl=50;
  S.follower={id:'jenassa',hp:9999,ts:0}; G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  FOEGROUPS.prep = (f) => {
    if (kind === 'chief') { f.e.name = 'Bandit chief'; f.e.tags = ['humanoid','elite']; f.tags.add('elite'); f.e.boss = true; f.e.level = 25; return { n: 1, hpMul: [1] }; }
    return { n: 3, hpMul: [0.45,0.45,0.45] }; };
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""

GEO = """()=>{ const el=document.getElementById('tbf'), tin=el.querySelector('.tbin');
  const R=(n)=>{ if(!n) return null; const b=n.getBoundingClientRect(); return b.width?{left:b.left,top:b.top,right:b.right,bottom:b.bottom}:null; };
  const F=FOEPANEL.figs(el, {left:0, top:0, z:1}); const p=el.querySelector('.c2ov .tbu.foe'), lg=el.querySelector('.tblog');
  const cs=p?getComputedStyle(p):null, num=p?p.querySelector('.tbbar .num'):null, tele=el.querySelector('.bftele');
  return { plate:R(p), at:p?p.dataset.fplAt:'', bg:cs?cs.backgroundImage+'|'+cs.backgroundColor:'', numShown: num?getComputedStyle(num).display!=='none':false,
    log:R(lg), lgs: lg?{sh:lg.scrollHeight, ch:lg.clientHeight, st:lg.scrollTop, n:lg.querySelectorAll('.tbl').length, held:lg.classList.contains('fpl-held')}:null,
    tele:R(tele), figs:F?[...F.shape, F.hero, ...F.others]:[], foe:F?F.foe:null, bf:R(el.querySelector('.bfwrap')),
    wide: Math.max(tin.scrollWidth, document.documentElement.scrollWidth) - innerWidth }; }"""

def hit(a, b, pad=0):
    return a and b and a["left"] < b["right"] - pad and a["right"] > b["left"] + pad and a["top"] < b["bottom"] - pad and a["bottom"] > b["top"] + pad

async def to_turn(pg):
    for _ in range(120):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]') || (TB.session&&TB.session.done)"): return
        await pg.evaluate("document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click()); document.querySelectorAll('.bfov,#obtip').forEach(x=>x.remove()); document.querySelector('#tbf .tbskip')?.click()")
        await pg.wait_for_timeout(200)

async def run(p, kind, w, h, touch):
    tag = f"{kind}_{w}x{h}"
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fpl{kind}{w}&tb"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Plate"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    ok(await open_fight(pg, START, [kind]), f"{tag}: the fight opens")   # waits for the fight screen, not a fixed pause (roadfight.py)
    await to_turn(pg)
    # a long fight: fill the log with many lines
    await pg.evaluate("""()=>{ const sess=TB.session; for (let i=0;i<30;i++) sess.ev.push({kind:'me', text:'Test line '+i+': you hit for '+(10+i)}); }""")
    await pg.evaluate("""()=>{ const sess=TB.session, f=sess.f; f.hp=G.maxHealth(f.s); f.foeSt=f.foeSt||{}; f.foeSt.burn={turns:2,dmg:9};
      if (f.bf && typeof BOSSFIGHT!=='undefined') { const b=f.bf; b.tele={key:BOSSFIGHT.teleKey(b), round:sess.round, idx:sess.idx, meAfter:true}; }
      TB.redraw(sess,{turn:'me'}); }""")
    for _ in range(20):   # the new lines play one by one: skip to the end
        if not await pg.evaluate("!!document.querySelector('#tbf .tbskip')"): break
        await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(150)
    await pg.wait_for_timeout(900)
    await pg.evaluate("document.querySelectorAll('.bfov,#obtip').forEach(x=>x.remove()); document.querySelectorAll('.tbtip').forEach(t=>t.classList.remove('on'))")
    await pg.mouse.move(2, 2); await pg.wait_for_timeout(350)
    g = await pg.evaluate(GEO)
    await pg.screenshot(path=OUT + tag + ".png")
    ok(g["plate"] is not None, f"{tag}: the foe's plate shows")
    ok("none" in g["bg"] and ("rgba(0, 0, 0, 0)" in g["bg"] or "transparent" in g["bg"]), f"{tag}: no dark box behind the plate ({g['bg']})")
    if w >= 900: ok(not g["numShown"], f"{tag}: the numbers wait for a hover")
    elif kind != "chief": ok(g["numShown"], f"{tag}: on a phone the health numbers always show (phonefight.js)")
    if kind == "chief":
        ok(g["at"] == "boss" and g["bf"] and g["plate"]["top"] >= g["bf"]["bottom"] - 1, f"{tag}: a boss's icons sit under the boss bar ({g['at']})")
        ok(g["tele"] and g["tele"]["bottom"] - g["tele"]["top"] <= 34, f"{tag}: the boss's warning is one slim line ({g['tele'] and round(g['tele']['bottom'] - g['tele']['top'])}px)")
    else:
        ok(g["at"] == "over" and g["plate"]["bottom"] <= g["foe"]["top"] + 1, f"{tag}: the plate floats over the foe's head ({g['at']}, {g['plate']['bottom']:.0f} <= {g['foe']['top']:.0f})")
    ok(not any(hit(g["plate"], f, 2) for f in g["figs"]) or kind == "chief", f"{tag}: the plate never sits on a fighter")
    ok(g["log"] and not any(hit(g["log"], f, 2) for f in g["figs"]), f"{tag}: the log sits clear of every fighter {g['log']} figs={g['figs']}")
    ok(g["log"] and not hit(g["log"], g["plate"]), f"{tag}: the log and the plate don't overlap")
    s = g["lgs"]
    ok(s and s["n"] >= 30 and s["sh"] > s["ch"] + 20, f"{tag}: the log holds the whole fight ({s and s['n']} lines)")
    ok(s and s["sh"] - s["st"] - s["ch"] <= 2, f"{tag}: it starts at the newest line")
    # scroll up (wheel on PC, a finger drag is a scroll too: same event)
    lb = g["log"]
    await pg.mouse.move((lb["left"] + lb["right"]) / 2, (lb["top"] + lb["bottom"]) / 2)
    await pg.mouse.wheel(0, -400); await pg.wait_for_timeout(400)
    s2 = await pg.evaluate("(()=>{const lg=document.querySelector('#tbf .tblog');return {st:lg.scrollTop, held:lg.classList.contains('fpl-held'), chip:getComputedStyle(lg.querySelector('.fpl-new')).display, page:scrollY}})()")
    ok(s2["st"] < s["st"] - 20 and s2["held"] and s2["chip"] != "none", f"{tag}: scrolled up, the 'newest' chip shows {s2}")
    ok(s2["page"] == 0, f"{tag}: the page itself does not scroll")
    await pg.evaluate("TB.redraw(TB.session,{turn:'me'})"); await pg.wait_for_timeout(500)
    s3 = await pg.evaluate("(()=>{const lg=document.querySelector('#tbf .tblog');return {st:lg.scrollTop, held:lg.classList.contains('fpl-held')}})()")
    ok(abs(s3["st"] - s2["st"]) < 4 and s3["held"], f"{tag}: a redraw keeps the spot you read ({s2['st']} -> {s3['st']})")
    await pg.screenshot(path=OUT + tag + "_scrolled.png")
    await pg.evaluate("document.querySelector('#tbf .tblog .fpl-new').click()"); await pg.wait_for_timeout(700)
    s4 = await pg.evaluate("(()=>{const lg=document.querySelector('#tbf .tblog');return {d:lg.scrollHeight-lg.scrollTop-lg.clientHeight, held:lg.classList.contains('fpl-held'), sheet:!!document.querySelector('#tbf .tbsheet')}})()")
    ok(s4["d"] <= 2 and not s4["held"] and not s4["sheet"], f"{tag}: the chip goes back to the newest line (without opening the big log) {s4}")
    # tap the plate: the numbers
    await pg.evaluate("document.querySelector('#tbf .c2ov .tbu.foe').click()"); await pg.wait_for_timeout(300)
    if kind != "chief":
        ok(await pg.evaluate("getComputedStyle(document.querySelector('#tbf .c2ov .tbu.foe .tbbar .num')).display!=='none'"), f"{tag}: a tap on the plate shows its numbers")
    ok(g["wide"] <= 1, f"{tag}: nothing wider than the screen")
    ok(not errs, f"{tag}: no page errors {errs[:2]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        for kind in ["chief", "group"]:
            for (w, h, t) in [(390, 844, True), (1920, 1080, False), (1366, 768, False)]:
                try: await run(p, kind, w, h, t)
                except Exception as e: ok(False, f"{kind} {w}: {str(e)[:160]}")
    print("FAILED " + str(len(fails)) if fails else "RESULT OK")
    sys.exit(1 if fails else 0)

asyncio.run(main())
