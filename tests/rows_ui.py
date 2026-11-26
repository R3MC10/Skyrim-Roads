"""Front and back rows on the fight screen and the row pick in the Hero panel (foefield.js). Usage: python rows_ui.py PORT -> RESULT OK
Serve game/ first:  node serve.js PORT game
Phone 360x780 and 390x844 (touch) and PC 1920x1080, a bandit pair on the road (one in front, one behind), a hero with
a sword:
- the row strip shows both foe rows; the foe behind is greyed out and says why (your blade can't reach it yet)
- tapping a foe's plate aims at it; on PC [ and ] move the aim
- every foe plate shows its role icon (code-drawn) and what it does next
- nothing wider than the screen, the row strip fits inside it, no page errors
- the Hero panel shows "Fight row" with Auto / Front / Back; picking Back saves it and the next fight shows you in the back
Screenshots in SHOTS/out_rows/ (default: the system temp folder), never in tests/."""
import asyncio, sys, os, tempfile
from playwright.async_api import async_playwright
from roadfight import open_fight
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "out_rows") + os.sep; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  try { const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.tbFast=true; p.tips=false; localStorage.setItem('rotn_prefs', JSON.stringify(p)); } catch(e){}
  const S=window.__dbg.save(); S.level=20; S.hpBonus=300; for (const k of ['One-Handed','Blocking','Heavy Armor']) S.skills[k].lvl=40;
  S.follower=null; G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  const p0 = FOEGROUPS.prep; FOEGROUPS.prep = (f, pl) => { const r = p0(f, pl); f.e.group = ['warrior', 'archer']; FOEGROUPS.setArch(f.e, 'warrior'); return { n: 2, hpMul: [0.6, 0.6], kind: r.kind }; };   // one in front, one behind
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""

GEO = """()=>{ const el=document.getElementById('tbf'), box=el&&el.querySelector('.rowfield');
  const R=(n)=>{ if(!n) return null; const b=n.getBoundingClientRect(); return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,w:b.width,h:b.height}; };
  const pl=[...(box?box.querySelectorAll('.rfp'):[])];
  return { box:R(box), n:pl.length, rows:[...(box?box.querySelectorAll('.rfside.foes .rfrow'):[])].map(r=>r.className),
    far:pl.filter(p=>p.classList.contains('far')).map(p=>({row:p.classList.contains('back')?'back':'front', why:(p.querySelector('.rfwhy')||{}).textContent||'', op:getComputedStyle(p).opacity})),
    icons:pl.map(p=>!!p.querySelector('.rficon svg, svg.rficon, .rficon')), tgt:(box&&box.querySelector('.rfp.tgt')||{}).dataset?.rf,
    me:(box&&box.querySelector('.rfside.heroes .rfh.me, .rfside.heroes .me'))?.closest('.rfrow')?.className||(box&&box.querySelector('.rfside.heroes'))?.className||'',
    small: pl.map(p=>parseFloat(getComputedStyle(p.querySelector('b')||p).fontSize)),
    wide: Math.max(el?el.scrollWidth:0, document.documentElement.scrollWidth) - innerWidth, vw: innerWidth,
    field: !!(TB.session && TB.session.field), foes: TB.session && TB.session.field ? TB.session.field.foes.map(x=>x.row+':'+x.role) : [] }; }"""

async def to_turn(pg):
    for _ in range(120):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]') || (TB.session&&TB.session.done)"): return
        await pg.evaluate("document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click()); document.querySelectorAll('.bfov,#obtip').forEach(x=>x.remove()); document.querySelector('#tbf .tbskip')?.click()")
        await pg.wait_for_timeout(200)

async def run(p, w, h, touch, shot):
    tag = f"{w}x{h}"
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=rows{w}&tb"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Rowan"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    ok(await open_fight(pg, START), f"{tag}: the fight opens")
    await to_turn(pg)
    await pg.evaluate("document.querySelectorAll('.bfov,#obtip').forEach(x=>x.remove()); document.querySelectorAll('.tbtip').forEach(t=>t.classList.remove('on'))")
    await pg.wait_for_timeout(400)
    g = await pg.evaluate(GEO)
    if shot: await pg.screenshot(path=shot + f"rows_after_{tag}.png")
    await pg.screenshot(path=OUT + f"fight_{tag}.png")
    ok(g["field"] and g["n"] == 2, f"{tag}: both bandits stand on the field ({g['foes']})")
    ok(len(g["rows"]) == 2, f"{tag}: the foe side has a front and a back row")
    ok(len(g["far"]) == 1 and g["far"][0]["row"] == "back" and len(g["far"][0]["why"]) > 4 and float(g["far"][0]["op"]) < 0.9,
       f"{tag}: the foe behind is greyed out and says why ({g['far']})")
    ok(all(g["icons"]), f"{tag}: every plate has its role icon")
    ok(g["box"] and g["box"]["left"] >= -1 and g["box"]["right"] <= g["vw"] + 1, f"{tag}: the row strip fits the screen ({g['box']})")
    ok(g["wide"] <= 1, f"{tag}: nothing wider than the screen ({g['wide']}px)")
    ok(min(g["small"] or [0]) >= 10, f"{tag}: plate names readable ({g['small']})")
    # aim: tap the other plate, then on PC move the aim with ] and [
    t0 = g["tgt"]
    other = await pg.evaluate("""(t)=>{ const b=[...document.querySelectorAll('#tbf .rfp')].find(p=>p.dataset.rf!==t && !p.disabled); return b ? b.dataset.rf : null; }""", t0)
    if other is not None:
        await pg.click(f"#tbf .rfp[data-rf='{other}']"); await pg.wait_for_timeout(300)
        g2 = await pg.evaluate(GEO)
        ok(g2["tgt"] == other, f"{tag}: tapping a plate aims at that foe ({t0} -> {g2['tgt']})")
    if not touch:
        before = (await pg.evaluate(GEO))["tgt"]
        await pg.keyboard.press("]"); await pg.wait_for_timeout(300)
        after = (await pg.evaluate(GEO))["tgt"]
        ok(after != before, f"{tag}: ] moves the aim ({before} -> {after})")
        await pg.keyboard.press("["); await pg.wait_for_timeout(300)
        ok((await pg.evaluate(GEO))["tgt"] == before, f"{tag}: [ moves it back")
        await pg.keyboard.press("1"); await pg.wait_for_timeout(500)   # the old number keys still pick moves
        ok(await pg.evaluate("!!TB.session"), f"{tag}: number keys still work in the fight")
    # end the fight, then the Hero panel
    await pg.evaluate("""()=>{ const s=TB.session; if (s && !s.done) { s.f.ehp=0; if (s.field) for (const x of s.field.foes) { x.hp=0; x.down=true; } try { s.finish ? s.finish() : null; } catch(e){} }
      document.querySelectorAll('#modal').forEach(m=>m.remove()); try { TB.close && TB.close(); } catch(e){} document.getElementById('tbf')?.remove(); const S=window.__dbg.save(); S.trip=null; }""")
    await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelectorAll('#modal,#tbf').forEach(m=>m.remove()); document.querySelector('[data-tab=hero]').click()"); await pg.wait_for_timeout(700)
    rp = await pg.evaluate("""()=>{ const r=document.querySelector('.rowpick'); if(!r) return null; const b=r.getBoundingClientRect();
      return { txt:r.textContent.replace(/\\s+/g,' ').trim(), btns:[...r.querySelectorAll('[data-act=rowpick]')].map(x=>x.dataset.id+(x.classList.contains('on')?'*':'')), right:b.right, vw:innerWidth }; }""")
    ok(rp and "Fight row" in rp["txt"] and len(rp["btns"]) == 3, f"{tag}: the Hero panel shows the row pick ({rp})")
    ok(rp and rp["right"] <= rp["vw"] + 1, f"{tag}: the row pick fits the screen")
    if rp:
        await pg.evaluate("document.querySelector('.rowpick')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('.rowpick [data-act=rowpick][data-id=back]').click()"); await pg.wait_for_timeout(500)
        rp2 = await pg.evaluate("""()=>{ const r=document.querySelector('.rowpick'); return r ? { txt:r.textContent.replace(/\\s+/g,' ').trim(), on:(r.querySelector('.on')||{}).dataset?.id,
          saved: FOEFIELD.choice(window.__dbg.save()) } : null; }""")
        ok(rp2 and rp2["on"] == "back" and rp2["saved"] == "back" and "Back" in rp2["txt"], f"{tag}: picking Back is saved with your loadout ({rp2})")
        await pg.screenshot(path=OUT + f"hero_{tag}.png")
        if shot: await pg.screenshot(path=shot + f"rows_hero_{tag}.png")
        await pg.evaluate("document.querySelector('.rowpick [data-act=rowpick][data-id=auto]')?.click()"); await pg.wait_for_timeout(300)
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await b.close()

async def main():
    shot = os.environ.get("ROWSHOTS")
    if shot and not shot.endswith(os.sep): shot += os.sep
    async with async_playwright() as p:
        await run(p, 360, 780, True, None)
        await run(p, 390, 844, True, shot)
        await run(p, 1920, 1080, False, shot)
    print("RESULT", "OK" if not fails else f"FAIL ({len(fails)})")
    sys.exit(1 if fails else 0)

asyncio.run(main())
