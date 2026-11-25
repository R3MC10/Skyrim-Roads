"""Aiming spells with the Magic menu open, and a full company fitting on screen. Usage: python magicaim_ui.py PORT -> RESULT OK
Serve game/ first:  node serve.js PORT
Part 1, phones 360/390/412 wide (touch) and a PC: a fight with Lydia beside you, Magic open:
- a heal for others asks who gets it; the open menu steps aside so the portraits and the scene show, and nothing
  that can take the spell is hidden under it; tapping Lydia's name, her plate or her figure in the scene casts it on her
- a self heal still lets you pick yourself or Lydia; a fire spell cast from the open menu hits the foe
Part 2, a party of 8 (7 other players + 2 followers) against a gang, phones portrait and landscape, PC 1366 and 1920,
with the action bar and with Magic open: every fighter's box, every party plate and the foe's plate sit fully on
screen, clear of the turn strip and the bottom bar (count of the ones that don't must be 0).
Screenshots go to $SHOTS (or the temp folder), never into tests/."""
import asyncio, sys, os, json, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = (os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/magicaim/"
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
ONLY = os.environ.get("ONLY", "")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SOLO = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration','Athletics','Alteration','Conjuration']) S.skills[k].lvl=60;
  S.mpBonus=400; for (const id of ['flames','sparks','healing','heal_other']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  S.follower={id:'lydia',hp:9999,ts:0};
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
PARTY = """() => {
  document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=30; S._test=true; S.hpBonus=400; S.mpBonus=300; S.follower=null; S.dungeon=null; S.trip=null;
  for (const k of Object.keys(S.skills)) S.skills[k].lvl=40;
  for (const id of ['flames','healing','heal_other']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  const id=G.give(S,'steel_sword'); G.equip(S,id); G.setHealth(S,G.maxHealth(S));
  const al=[], nm=['Beta','Ceta','Dera','Echo','Foxa','Gala','Hilo'], rc=['nord','redguard','dunmer','imperial','orc','breton','khajiit'];
  for (let i=0;i<7;i++) al.push({ name:nm[i], dmg:6, hp:120, maxHp:120, red:0.2, role:'fighter', player:true, coop:true, party:true, uid:'x'+i,
     look:{ r:rc[i], id:'m'+i, eq:{weapon:'steel_sword',chest:'steel_armor'}, gl:{} } });
  for (const f of ['lydia','jenassa']) al.push({ name:f[0].toUpperCase()+f.slice(1), follower:true, fid:f, dmg:8, hp:150, maxHp:150, red:0.2 });
  G.setAllyProvider(()=>al.map(a=>({...a})));
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const base=D.ENCOUNTERS.find(x=>/^Bandit outlaw$/.test(x.name)) || D.ENCOUNTERS[0];
  const e={...base}; e.hp=(e.health||50)*6; e.health=e.hp; S.trip.status='encounter'; S.trip.encounter=G.scaleEnemy(e,30); __dbg.openEncounter(); }"""
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove()); document.querySelectorAll('.tbtip').forEach(t=>t.classList.remove('on'))"
# every fighter's box (fightpos layout on the scene canvas), every party plate and the foe's plate, against the screen,
# the turn strip and the bottom bar
FIT = """(()=>{ const c=document.querySelector('#tbf .fscene canvas'); const L=c&&c.__fp; if(!L) return null;
  const r=c.getBoundingClientRect(), k=r.width/L.W, vw=innerWidth, vh=innerHeight;
  const strip=document.querySelector('#tbf .tbtop'), sb=strip?strip.getBoundingClientRect().bottom:0;
  const dock=document.querySelector('#tbf .tbdock .fc, #tbf .tbdock'), db=dock?dock.getBoundingClientRect().top:vh;
  const bad=[]; const box=(n,x0,x1,y0,y1)=>{ const b=[Math.round(x0),Math.round(y0),Math.round(x1),Math.round(y1)];
    if (x0<-1||x1>vw+1||y0<-1||y1>vh+1) bad.push(n+' off screen '+b); else if (y1>db+2) bad.push(n+' under the bar '+b+' bar '+Math.round(db)); };
  const fig=(n,p)=>box(n, r.left+p.left*k, r.left+p.right*k, r.top+p.top*k, r.top+p.y*k);
  fig('you',L.hero); fig('foe',L.foe); L.allies.forEach((a,i)=>fig('ally '+(a.name||i),a)); (L.waiting||[]).forEach((w,i)=>fig('waiting '+i,w)); (L.flyers||[]).forEach((w,i)=>fig('flyer '+i,w));
  const cards=[...document.querySelectorAll('#tbf .c2ov .tbparty .tbu.ally, #tbf .c2ov .tbu.foe')];
  const orb=document.querySelector('#tbf .c2ov .tbu.me .c2orb, #tbf .c2ov .tbu.me'), o=orb?orb.getBoundingClientRect():null;
  for (const e of cards) { const q=e.getBoundingClientRect(); if(!q.width) { bad.push('plate hidden'); continue; }
    const n='plate '+(e.querySelector('.nm')?.textContent||'').trim().slice(0,12);
    if (o && e.classList.contains('ally') && q.left<o.right-2 && q.right>o.left+2 && q.top<o.bottom-2 && q.bottom>o.top+2) bad.push(n+' under your orb');
    const fp=document.querySelector('#tbf .c2ov .tbu.foe'), u=fp?fp.getBoundingClientRect():null;
    if (u && e!==fp && q.left<u.right-2 && q.right>u.left+2 && q.top<u.bottom-2 && q.bottom>u.top+2) bad.push(n+' under the foe plate');
    if (q.top<sb-2 && q.bottom>0) bad.push(n+' under the turn strip'); box(n,q.left,q.right,q.top,q.bottom); }
  return { bad, n: 2+L.allies.length+(L.waiting||[]).length, plates: cards.length, db: Math.round(db), sb: Math.round(sb) }; })()"""

async def boot(b, w, h, touch, tag):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    await ctx.add_init_script("try{localStorage.setItem('rotn_prefs',JSON.stringify({tips:false,obTips:false,obNext:false}))}catch(e){}")
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=maim{tag}&tb"); await pg.wait_for_timeout(1600)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Aimer"); await pg.click("#begin"); await pg.wait_for_timeout(1300)
    return ctx, pg, errs

async def my_turn(pg, tries=60):
    for _ in range(tries):
        if await pg.evaluate("!!document.querySelector('#tbf .fc [data-tba=attack], #tbf .fc.fc-pick')"): return True
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): return False
        await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(250)
    return False

async def open_magic(pg):
    if not await pg.evaluate("!!document.querySelector('#tbf .fc.fc-pick')"):
        await pg.evaluate("document.querySelector('#tbf [data-tbm=magic]')?.click()"); await pg.wait_for_timeout(450)
    return await pg.evaluate("!!document.querySelector('#tbf .fc.fc-pick [data-tba]')")

LOG = "[...document.querySelectorAll('#tbf .tbl')].map(e=>e.textContent).join(' | ')"
HOLD = "(()=>{ const s=TB.session; return s ? s.myActs : -1 })()"

async def aim_run(b, w, h, touch):
    tag = f"{w}x{h}"
    ctx, pg, errs = await boot(b, w, h, touch, f"a{w}")
    for _ in range(3):   # the event window can redraw under a click: press Fight from the page itself (set it up again if it never shows)
        await pg.evaluate(SOLO); await pg.wait_for_timeout(500)
        for _ in range(20):
            if await pg.evaluate("!!document.querySelector('#tbf')"): break
            await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()"); await pg.wait_for_timeout(400)
        if await pg.evaluate("!!document.querySelector('#tbf')"): break
    await pg.wait_for_timeout(600)
    await pg.evaluate(CLEAN)
    if not await my_turn(pg):
        ok(False, f"{tag}: my turn comes"); await pg.screenshot(path=OUT + f"aim_{tag}_noturn.png"); await ctx.close(); return
    # 1) Heal Other from the open Magic menu, onto Lydia by her name button
    ok(await open_magic(pg), f"{tag}: Magic opens")
    await pg.screenshot(path=OUT + f"aim_{tag}_magic.png")
    await pg.evaluate("TB.session.f.allies.forEach(a=>a.hp=Math.max(1,Math.round((a.maxHp||150)*0.3)))")
    await pg.click("#tbf .fc [data-tba='spell:heal_other']"); await pg.wait_for_timeout(350)
    ok(await pg.evaluate("!!document.querySelector('#tbf .fc-aimbar .fc-who')"), f"{tag}: Heal Other asks who gets it, with a name button")
    hid = await pg.evaluate("""(()=>{ const out=[]; for (const e of document.querySelectorAll('#tbf .tbu.fc-tgt')) { const r=e.getBoundingClientRect();
        const t=document.elementFromPoint(r.left+r.width/2, r.top+Math.min(r.height/2,14)); if(!r.width||!t||!e.contains(t)) out.push((e.querySelector('.nm')?.textContent||'?').trim()+' covered by '+(t?.className||'nothing')); } return out; })()""")
    ok(not hid, f"{tag}: no valid target is covered while aiming {hid}")
    await pg.screenshot(path=OUT + f"aim_{tag}_aiming.png")
    a0 = await pg.evaluate(HOLD)
    await pg.click("#tbf .fc-aimbar .fc-who:not(.me)"); await pg.wait_for_timeout(700)
    ok(await pg.evaluate(r"/Heal Other (on|→) Lydia: \+\d/.test(" + LOG + ")"), f"{tag}: Heal Other lands on Lydia (name button)")
    ok(not await pg.evaluate("!!document.querySelector('#tbf .fc-aimbar')"), f"{tag}: the aim bar goes away after casting")
    # 2) Healing (self kind) with Magic open: tap Lydia's plate this time
    if await my_turn(pg, 6) and await open_magic(pg):
        await pg.evaluate("TB.session.myActs=0; TB.session.f.allies.forEach(a=>a.hp=Math.max(1,Math.round((a.maxHp||150)*0.3)))")
        await pg.click("#tbf .fc [data-tba='spell:healing']"); await pg.wait_for_timeout(350)
        ok(await pg.evaluate("document.querySelectorAll('#tbf .fc-aimbar .fc-who').length >= 2"), f"{tag}: Healing offers you and Lydia")
        await pg.click("#tbf .c2ov .tbparty .tbu.ally.fc-tgt"); await pg.wait_for_timeout(700)
        ok(await pg.evaluate(r"/Healing on Lydia: \+\d/.test(" + LOG + ")"), f"{tag}: tapping Lydia's plate casts it on her")
    else: ok(False, f"{tag}: second turn with Magic")
    # 3) Heal Other again: tap Lydia's figure in the scene
    if await my_turn(pg, 6) and await open_magic(pg):
        await pg.evaluate("TB.session.myActs=0; TB.session.f.mp=TB.session.f.mpMax||999; TB.session.f.allies.forEach(a=>a.hp=Math.max(1,Math.round((a.maxHp||150)*0.3)))")
        n0 = await pg.evaluate("(" + LOG + ").split(/Heal Other (?:on|→) Lydia/).length")
        await pg.click("#tbf .fc [data-tba='spell:heal_other']"); await pg.wait_for_timeout(350)
        pt = await pg.evaluate("(()=>{ const c=document.querySelector('#tbf .fscene canvas'); const p=FIGHTPOS.screenOf(c,'Lydia'); return p ? [p.x, (p.top+p.y)/2] : null })()")
        ok(pt is not None, f"{tag}: Lydia stands in the scene")
        if pt:
            await pg.mouse.click(pt[0], pt[1]) if not touch else await pg.touchscreen.tap(pt[0], pt[1])
            await pg.wait_for_timeout(700)
            n1 = await pg.evaluate("(" + LOG + ").split(/Heal Other (?:on|→) Lydia/).length")
            ok(n1 > n0, f"{tag}: tapping Lydia in the scene casts it on her")
    else: ok(False, f"{tag}: third turn with Magic")
    # 4) a fire spell from the open Magic menu hits the foe
    if await my_turn(pg, 6) and await open_magic(pg):
        await pg.evaluate("TB.session.myActs=0")
        e0 = await pg.evaluate("TB.session.f.ehp")
        await pg.click("#tbf .fc [data-tba='spell:flames']"); await pg.wait_for_timeout(900)
        for _ in range(10):   # a minigame may be up: let it time out into a normal hit
            if not await pg.evaluate("!!document.querySelector('.tbtime:not(.hit), .mg')"): break
            await pg.wait_for_timeout(600)
        e1 = await pg.evaluate("TB.session ? TB.session.f.ehp : -1")
        ok(e1 < e0 or await pg.evaluate("/Flames/.test(" + LOG + ")"), f"{tag}: Flames cast from the open Magic menu hits the foe ({e0}->{e1})")
        ok(not await pg.evaluate("!!document.querySelector('#tbf .fc-aimbar')"), f"{tag}: a foe spell doesn't ask for a target")
    else: ok(False, f"{tag}: fourth turn with Magic")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()

async def fit_run(b, w, h, touch):
    tag = f"{w}x{h} party"
    ctx, pg, errs = await boot(b, w, h, touch, f"f{w}x{h}")
    await pg.evaluate(PARTY); await pg.wait_for_timeout(500)
    for _ in range(12):
        if await pg.evaluate("!!document.querySelector('#modal [data-act=enc][data-a=fight]')"): break
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('[data-act=openenc]')?.click() || __dbg.openEncounter()"); await pg.wait_for_timeout(400)
    await pg.evaluate("document.querySelector('#modal [data-act=enc][data-a=fight]')?.click()"); await pg.wait_for_timeout(1500)
    ok(await my_turn(pg), f"{tag}: my turn comes")
    await pg.wait_for_timeout(1000); await pg.evaluate(CLEAN); await pg.mouse.move(1, 1)
    d = await pg.evaluate(FIT)
    await pg.screenshot(path=OUT + f"fit_{w}x{h}_bar.png")
    ok(d is not None and d["plates"] >= 10, f"{tag}: the scene lays out everyone ({d and d['n']} fighters, {d and d['plates']} plates)")
    if d: ok(len(d["bad"]) == 0, f"{tag} (action bar): fighters/plates off screen or covered = {len(d['bad'])} {d['bad'][:4]}")
    if await open_magic(pg):
        await pg.wait_for_timeout(500)
        d = await pg.evaluate(FIT)
        await pg.screenshot(path=OUT + f"fit_{w}x{h}_magic.png")
        if d: ok(len(d["bad"]) == 0, f"{tag} (Magic open): fighters/plates off screen or covered = {len(d['bad'])} {d['bad'][:4]}")
    else: ok(False, f"{tag}: Magic opens")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        if ONLY != "fit":
            for w, h, t in [(360, 800, True), (390, 844, True), (412, 915, True), (1366, 768, False)]: await aim_run(b, w, h, t)
        if ONLY != "aim":
            for w, h, t in [(360, 800, True), (390, 844, True), (412, 915, True), (800, 360, True), (915, 412, True), (1366, 768, False), (1920, 1080, False)]: await fit_run(b, w, h, t)
        await b.close()
    print("screenshots:", OUT)
    print("RESULT", "OK" if not fails else f"FAIL ({len(fails)})")
    if fails: sys.exit(1)
asyncio.run(main())
