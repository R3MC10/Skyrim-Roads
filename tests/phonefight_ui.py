"""Phone fight layout (phonefight.js): a road fight and a dungeon fight with 5 foes, on a 390x844 phone and a
1920x1080 PC. Checks: nothing wider than the screen, the foe's card at the top with its health readable, every move
button fully on screen and at least 44px on the phone, the fight log can be folded away (and opened again), and no
fight tip covers a button. Screenshots go to $SHOTS/out_phonefight/ (or the temp folder).
Usage: python3 phonefight_ui.py PORT [tag]   (tag: a prefix for the screenshot names, e.g. "before")"""
import asyncio, sys, os, time, tempfile
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
PRE = (sys.argv[2] + "_") if len(sys.argv) > 2 else ""
RUN = str(int(time.time()) % 100000)
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "out_phonefight") + os.sep; os.makedirs(OUT, exist_ok=True)
fails = []
CLASSIC = ""
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

HERO = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration','Athletics']) S.skills[k].lvl=45;
  S.mpBonus=120; for (const id of ['flames','sparks','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  S.follower={id:'lydia',hp:9999,ts:0}; G.give(S,'potion_health',3); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; return true; }"""
ROAD = """()=>{ const S=window.__dbg.save();
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
# five bandits, one after another, in Embershard Mine
DUNGEON = """()=>{ const S=window.__dbg.save(); S.trip=null; [S.x,S.y]=WORLD.places['Embershard Mine'].slice(0,2);
  S.dungeon={ place:'Embershard Mine', theme:'mine', tier:1, rows:[[{type:'fight',links:[]}]], row:0, col:0, room:null, found:[], gold:0, t:G.now() };
  const pp=FOEGROUPS.prep; FOEGROUPS.prep=(f,pl)=>{ FOEGROUPS.prep=pp; const r=pp(f,pl); const g=f.e.group||(f.e.group=[f.e.arch||'brute']);
    while (g.length<5) g.push(Object.keys(FOEGROUPS.ARCH).find(k=>FOEGROUPS.KINDS.bandit.includes(k))||g[0]); return {...r, n:5, hpMul:g.map(()=>0.5)}; };
  const e=G.scaleEnemy({name:'Bandit',health:400,damage:6,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
  TB.call(S, ()=>{ const f=new G.Fight(S,e); return f.run({trySneak:false}); }, ()=>{}); }"""
# stacks on everyone: the foe burns (3), is poisoned (2) and vulnerable (4); you are winded (2); Lydia has Stoneskin (2 turns)
STACK = """()=>{ const f=TB.session.f; f.foeSt=f.foeSt||{}; f.foeSt.burn={turns:3,dmg:4}; f.foeSt.poison={turns:2,dmg:3};
  f.stk=f.stk||{}; f.stk.foe=f.stk.foe||{}; f.stk.me=f.stk.me||{}; f.stk.foe.vuln=4; f.stk.me.winded=2;
  const a=(f.allies||[])[0]; if (a) { a.armorT=2; a.armorRed=0.2; } TB.redraw(TB.session,{turn:'me'}); }"""
# every status icon: its badge text, whether it shows, its font size and whether the badge is the topmost thing at its centre
BADGES = """()=>[...document.querySelectorAll('#tbf .c2fx .c2e, #tbf .tbst .st.stk')].filter(i=>i.getClientRects().length).map(i=>{ const sm=i.querySelector('small');
  const where=i.closest('.tbu.foe')?'foe':i.closest('.tbu.me')?'me':i.closest('.tbu.ally')?'ally':'other';
  if(!sm) return {k:i.className, where, txt:null};
  const r=sm.getBoundingClientRect(), cs=getComputedStyle(sm); let top=false;
  if (r.width>0) { const h=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); top=!!h&&(h===sm||sm.contains(h)||i.contains(h)); }
  return {k:i.className, where, txt:sm.textContent, shown: cs.display!=='none'&&r.width>0&&r.height>0, fs:parseFloat(cs.fontSize), top}; })"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove())"

LOOK = """()=>{ const el=document.getElementById('tbf'); const vw=innerWidth, vh=innerHeight;
  const vis=(e)=>{ if(!e) return false; const s=getComputedStyle(e); if(s.display==='none'||s.visibility==='hidden'||+s.opacity<0.05) return false; const r=e.getBoundingClientRect(); return r.width>1&&r.height>1; };
  const box=(e)=>{ const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}; };
  const btns=[...el.querySelectorAll('.tbdock [data-tba], .tbdock [data-tbm], .tbdock [data-hbs]')].filter(vis).map(b=>({k:b.dataset.tba||b.dataset.tbm||('hb'+b.dataset.hbs),...box(b),
    top: (()=>{ const r=b.getBoundingClientRect(); const x=Math.min(vw-1,Math.max(0,r.left+r.width/2)), y=Math.min(vh-1,Math.max(0,r.top+r.height/2)); const h=document.elementFromPoint(x,y); return !!h && (b===h||b.contains(h)); })() }));
  const foe=[...el.querySelectorAll('.c2ov .tbu.foe')].filter(vis)[0];
  const hp=[...el.querySelectorAll('.c2ov .tbu.foe .tbbar.big .num')].filter(vis)[0];
  const log=[...el.querySelectorAll('.tblog')].filter(vis)[0];
  const tips=[...document.querySelectorAll('#fhints .fhint, #obtip')].filter(vis).map(box);
  const ov=(a,b)=>a.l<b.r-1&&b.l<a.r-1&&a.t<b.b-1&&b.t<a.b-1;
  return { vw, vh, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btns,
    foe: foe?{...box(foe), cls:foe.className}:null, hpFont: hp?parseFloat(getComputedStyle(hp).fontSize):0, hp: hp?box(hp):null,
    log: log?box(log):null, logToggle: !!el.querySelector('[data-pff=log]'), tips,
    tipsOverBtns: tips.some(t=>btns.some(b=>ov(t,b))), logOverBtns: !!log && btns.some(b=>ov(box(log),b)), foeOverBtns: !!foe && btns.some(b=>ov(box(foe),b)) }; }"""

async def into(pg, kind, tag):
    for _ in range(5):
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=pff{RUN}{tag}{kind}&tb{CLASSIC}"); await pg.wait_for_timeout(1800)
        if await pg.evaluate("typeof ENC!=='undefined' && typeof TB!=='undefined' && typeof FOEGROUPS!=='undefined'"):
            try: await pg.wait_for_selector(".press", timeout=15000); break
            except Exception: pass
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Thumbs"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(HERO)
    await pg.evaluate(ROAD if kind == "road" else DUNGEON); await pg.wait_for_timeout(600)
    for _ in range(12):
        if await pg.evaluate("!!document.querySelector('#tbf')"): break
        # a popup that isn't the fight (a new quest, a courier...) goes away and the encounter opens again
        await pg.evaluate("(()=>{ const b=document.querySelector('#modal [data-act=ev][data-c=fight]'); if (b) return b.click(); document.querySelectorAll('#modal').forEach(m=>m.remove()); if (__dbg.save().trip && __dbg.save().trip.event) __dbg.openEvent(); })()"); await pg.wait_for_timeout(500)
    for _ in range(80):
        await pg.evaluate(CLEAN)
        if await pg.evaluate(MYTURN): break
        if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
            try: await pg.click("#tbf [data-tbx=skip]", timeout=3000)
            except Exception: pass
        await pg.wait_for_timeout(250)
    ok(await pg.evaluate(MYTURN), f"{tag} {kind}: the fight starts on your turn")
    await pg.mouse.move(1, 1)   # the mouse rested where Begin was: no hover tip over the bar
    await pg.wait_for_timeout(700)

def check(tag, kind, L, phone):
    ok(L["sw"] <= L["vw"] + 1, f"{tag} {kind}: nothing wider than the screen ({L['sw']} of {L['vw']})")
    ok(len(L["btns"]) >= 4, f"{tag} {kind}: the move buttons are there ({len(L['btns'])})")
    off = [b["k"] for b in L["btns"] if b["l"] < -0.5 or b["t"] < -0.5 or b["r"] > L["vw"] + 0.5 or b["b"] > L["vh"] + 0.5]
    ok(not off, f"{tag} {kind}: every move button is fully on screen {off}")
    hidden = [b["k"] for b in L["btns"] if not b["top"]]
    ok(not hidden, f"{tag} {kind}: nothing covers a move button {hidden}")
    if phone:
        small = [f"{b['k']} {b['w']:.0f}x{b['h']:.0f}" for b in L["btns"] if b["w"] < 43.5 or b["h"] < 43.5]
        ok(not small, f"{tag} {kind}: every move button is at least 44px {small}")
        lowest = max((b["b"] for b in L["btns"]), default=0)
        ok(lowest >= L["vh"] * 0.75, f"{tag} {kind}: the buttons sit at the bottom (lowest ends at {lowest:.0f} of {L['vh']})")
    ok(L["foe"] is not None, f"{tag} {kind}: the foe's card shows")
    if L["foe"]:
        ok(L["foe"]["t"] < L["vh"] * 0.35, f"{tag} {kind}: the foe's card is at the top ({L['foe']['t']:.0f})")
        ok(not L["foeOverBtns"], f"{tag} {kind}: the foe's card doesn't cover the buttons")
    if phone: ok(L["hpFont"] >= 11, f"{tag} {kind}: the foe's health shows in readable numbers ({L['hpFont']}px)")
    ok(not L["tipsOverBtns"], f"{tag} {kind}: no fight tip over the buttons")
    ok(not L["logOverBtns"], f"{tag} {kind}: the log doesn't cover the buttons")

async def case(b, w, h, phone, kind, errs):
    tag = f"{w}x{h}"
    kw = {"viewport": {"width": w, "height": h}, "device_scale_factor": 1}
    if phone: kw.update(has_touch=True, is_mobile=True)
    ctx = await b.new_context(**kw); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {kind} {e}"))
    await into(pg, kind, tag)
    await pg.screenshot(path=f"{OUT}{PRE}{tag}_{kind}.png")
    L = await pg.evaluate(LOOK); check(tag, kind, L, phone)
    if kind == "dungeon":
        ok(await pg.evaluate("(TB.session?.waves||1)>=4"), f"{tag} dungeon: 4+ foes in the fight ({await pg.evaluate('TB.session?.waves')})")
    # statuses show their stack numbers
    await pg.evaluate(STACK); await pg.wait_for_timeout(700)
    B = await pg.evaluate(BADGES)
    for want, where in (("fx-burning", "foe"), ("fx-poisoned", "foe"), ("fx-vuln", "foe"), ("fx-winded", "me"), ("fx-stoneskin", "ally")):
        hit = [b for b in B if want in b["k"] and b["where"] == where]
        ok(bool(hit) and hit[0]["txt"] and hit[0]["shown"] and hit[0]["fs"] >= 9 and hit[0]["top"], f"{tag} {kind}: {want[3:]} on the {where} shows its number {hit[:1]}")
    nonum = [b["k"] for b in B if ("stk" in b["k"] or any(x in b["k"] for x in ("fx-burning", "fx-poisoned", "fx-bleeding", "fx-vuln", "fx-sunder", "fx-weakened", "fx-winded", "fx-drained", "fx-might", "fx-haste", "fx-chilled", "fx-jolted", "fx-healing"))) and not (b.get("txt") and b.get("shown"))]
    ok(not nonum, f"{tag} {kind}: no stacking status without its number {nonum}")
    await pg.screenshot(path=f"{OUT}{PRE}{tag}_{kind}_stacks.png")
    if phone:
        ok(len(L["tips"]) >= 1, f"{tag} {kind}: the first-fight tips are up ({len(L['tips'])}) and clear of the buttons")
        # one move: Attack (a tap), then the log has lines
        ev0 = await pg.evaluate("(TB.session.ev||[]).length")
        for _ in range(2):
            await pg.tap("#tbf .tbdock [data-tba=attack]")
            for _ in range(40):
                await pg.wait_for_timeout(250)
                if await pg.evaluate(MYTURN): break
        ok(await pg.evaluate(f"(TB.session.ev||[]).length > {ev0}"), f"{tag} {kind}: tapping Attack works")
        await pg.wait_for_timeout(600)
        L = await pg.evaluate(LOOK); check(tag + " after a move", kind, L, phone)
        await pg.screenshot(path=f"{OUT}{PRE}{tag}_{kind}_move.png")
        # the log folds and opens again
        ok(L["logToggle"], f"{tag} {kind}: the log has a fold arrow")
        if L["logToggle"]:
            box = await pg.evaluate("(()=>{const r=document.querySelector('#tbf [data-pff=log]').getBoundingClientRect(); return [r.width,r.height]})()")
            ok(box[0] >= 43.5 and box[1] >= 43.5, f"{tag} {kind}: the fold arrow is a 44px tap target {box}")
            h0 = await pg.evaluate("document.querySelector('#tbf .c2ov .tblog').offsetHeight")
            was = await pg.evaluate("!!document.querySelector('#tbf.pff-log')")
            ok(not was, f"{tag} {kind}: the log starts folded")
            await pg.tap("#tbf [data-pff=log]"); await pg.wait_for_timeout(400)
            now = await pg.evaluate("!!document.querySelector('#tbf.pff-log')")
            h1 = await pg.evaluate("document.querySelector('#tbf .c2ov .tblog').offsetHeight")
            ok(was != now and h1 > h0, f"{tag} {kind}: tapping the arrow opens the log ({h0}px -> {h1}px)")
            ok(not await pg.evaluate("!!document.querySelector('#tbf .tbsheet')"), f"{tag} {kind}: the arrow doesn't open the full log")
            await pg.screenshot(path=f"{OUT}{PRE}{tag}_{kind}_logopen.png")
            L2 = await pg.evaluate(LOOK); check(tag + " log open", kind, L2, phone)
            await pg.tap("#tbf [data-pff=log]"); await pg.wait_for_timeout(400)
            ok(not await pg.evaluate("!!document.querySelector('#tbf.pff-log')"), f"{tag} {kind}: tapping it again folds the log")
    else:
        ok(not L["logToggle"], f"{tag} {kind}: no fold arrow on a PC (the log stays as it was)")
    await ctx.close()

async def classic(b, errs):
    """the classic (non-immersive) fight screen: its status chips carry the stack numbers too"""
    tag = "390x844 classic"
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True); pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    global CLASSIC
    CLASSIC = "&classic"
    await into(pg, "road", "classic")
    CLASSIC = ""
    await pg.evaluate(STACK); await pg.wait_for_timeout(700)
    t = await pg.evaluate("[...document.querySelectorAll('#tbf .tbst .st')].map(e=>e.className+'='+e.textContent.trim())")
    ok(any("fx-poisoned" in x and x.endswith("2") for x in t), f"{tag}: the foe's poison shows its 2 stacks {t}")
    ok(any("fx-vuln" in x and x.endswith("4") for x in t), f"{tag}: vulnerable shows its 4 stacks")
    ok(any("fx-winded" in x and x.endswith("2") for x in t), f"{tag}: your winded shows its 2 stacks")
    await pg.screenshot(path=f"{OUT}{PRE}390x844_classic_stacks.png")
    await ctx.close()

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for kind in ("road", "dungeon"):
            await case(b, 390, 844, True, kind, errs)
            await case(b, 1920, 1080, False, kind, errs)
        await classic(b, errs)
        await b.close()
    ok(not errs, f"no page errors {errs[:3]}")
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")
    sys.exit(1 if fails else 0)

asyncio.run(main())
