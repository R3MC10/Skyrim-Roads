"""The fight screen in three zones (fightzones.js) and one banner at a time (fightpres.js).
Sizes: a 390x844 phone, a small 360x640 phone and a 1920x1080 PC. Fights: a solo road fight, a dungeon fight with 5
foes and a boss's intro. Checks:
- no essential part of the screen (turn order, boss bar, foe card, event line, your orb, party plates, move buttons,
  first-fight tips) covers a fighter, and none of them covers another;
- nothing scrolls, every move button is fully on screen (44px+ on a phone);
- the boss intro plays once, with the tips and the "Your turn" banner held back while it plays; one banner at a time;
- the buttons don't move after a move (rapid taps never land on End turn);
- after a resize + coming back from the background the layout is still clean.
Screenshots go to $SHOTS (or the temp folder) as fightscreen_<tag>_<size>_<fight>.png.
Usage: python3 fightscreen_ui.py PORT [tag]   (tag "before" adds ?nozones: the old floating layout, no checks fail it)"""
import asyncio, sys, os, time, tempfile
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from playwright.async_api import async_playwright
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
  S.mpBonus=120; for (const id of ['flames','sparks','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  S.follower={id:'lydia',hp:9999,ts:0}; G.give(S,'potion_health',3); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; return true; }"""
ROAD = """()=>{ const S=window.__dbg.save();
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
SOLO = """()=>{ const pp=FOEGROUPS.prep; FOEGROUPS.prep=(f,pl)=>{ FOEGROUPS.prep=pp; pp(f,pl); return {n:1,hpMul:[1]}; }; }"""
DUNGEON = """()=>{ const S=window.__dbg.save(); S.trip=null; [S.x,S.y]=WORLD.places['Embershard Mine'].slice(0,2);
  S.dungeon={ place:'Embershard Mine', theme:'mine', tier:1, rows:[[{type:'fight',links:[]}]], row:0, col:0, room:null, found:[], gold:0, t:G.now() };
  const pp=FOEGROUPS.prep; FOEGROUPS.prep=(f,pl)=>{ FOEGROUPS.prep=pp; const r=pp(f,pl); const g=f.e.group||(f.e.group=[f.e.arch||'brute']);
    while (g.length<5) g.push(Object.keys(FOEGROUPS.ARCH).find(k=>FOEGROUPS.KINDS.bandit.includes(k))||g[0]); return {...r, n:5, hpMul:g.map(()=>0.5)}; };
  const e=G.scaleEnemy({name:'Bandit',health:400,damage:6,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
  TB.call(S, ()=>{ const f=new G.Fight(S,e); return f.run({trySneak:false}); }, ()=>{}); }"""
BOSS = """()=>{ FOEGROUPS.prep = (f, pl) => { f.e.name = 'Bandit chief'; f.e.tags = ['humanoid','elite']; f.tags.add('elite'); f.e.boss = true; f.e.level = 25; return { n: 1, hpMul: [1] }; };
  window.__intros = 0; new MutationObserver(ms=>{ for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('bfintro')) window.__intros++; }).observe(document.body,{childList:true});
  window.__during = []; const iv = setInterval(()=>{ if (!document.querySelector('.bfov.bfintro')) return; const vis=(e)=>{ const s=getComputedStyle(e); return s.display!=='none'&&s.visibility!=='hidden'&&e.getClientRects().length; };
    window.__during.push({ tips: [...document.querySelectorAll('#fhints .fhint')].filter(vis).length, bans: [...document.querySelectorAll('#tbf .tbban, .rxban')].filter(vis).length }); }, 100);
  setTimeout(()=>clearInterval(iv), 20000); }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelectorAll('#obtip').forEach(e=>e.remove())"

# essential UI boxes, fighter boxes (page px, clipped to the visible scene) and what overlaps what
LOOK = """()=>{ const el=document.getElementById('tbf'); const vw=innerWidth, vh=innerHeight;
  const vis=(e)=>{ if(!e) return false; for (let n=e; n && n.nodeType===1; n=n.parentElement) { const s=getComputedStyle(n); if (s.display==='none'||s.visibility==='hidden'||+s.opacity<0.05) return false; } const r=e.getBoundingClientRect(); return r.width>1&&r.height>1; };
  const box=(e,k)=>{ const r=e.getBoundingClientRect(); return {k, l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height, e}; };
  const Q=[['order','#tbf .tbtop'],['bossbar','#tbf .bfwrap'],['foe card','#tbf .c2ov .tbu.foe'],['event line','#tbf .c2ov .tblog'],['log arrow','#tbf .c2ov .pff-lt'],
    ['you','#tbf .c2ov .tbu.me'],['party','#tbf .c2ov .tbparty > .tbu'],['tip','#fhints .fhint'],['dock','#tbf .tbdock']];
  const ui=[]; for (const [k,q] of Q) for (const e of document.querySelectorAll(q)) if (vis(e)) ui.push(box(e,k));
  const btns=[...el.querySelectorAll('.tbdock [data-tba], .tbdock [data-tbm], .tbdock [data-hbs]')].filter(vis).map((b,i)=>box(b, b.dataset.tba||b.dataset.tbm||('hb'+(b.dataset.hbs??i))));
  const cv=el.querySelector('.fscene canvas'), L=cv&&cv.__fp, F=[];
  if (L) { const rc=cv.getBoundingClientRect(), k=rc.width/L.W; let cl={l:0,t:0,r:vw,b:vh};
    for (let n=cv.parentElement; n && n!==document.body; n=n.parentElement) { const s=getComputedStyle(n); if (s.overflow!=='visible'||s.overflowX!=='visible') { const r=n.getBoundingClientRect(); cl={l:Math.max(cl.l,r.left),t:Math.max(cl.t,r.top),r:Math.min(cl.r,r.right),b:Math.min(cl.b,r.bottom)}; } }
    const add=(p,who)=>{ if(!p||!isFinite(p.top)) return; const lf=isFinite(p.left)?p.left:p.x-20, rt=isFinite(p.right)?p.right:p.x+20;
      // the fighter's body: from the head (a raised weapon tip is not counted) to the feet, 10% in from each side
      const w=rt-lf, b={k:who, l:rc.left+(lf+w*0.1)*k, r:rc.left+(rt-w*0.1)*k, t:rc.top+p.top*k, b:rc.top+p.y*k};
      b.l=Math.max(b.l,cl.l); b.r=Math.min(b.r,cl.r); b.t=Math.max(b.t,cl.t); b.b=Math.min(b.b,cl.b); if (b.r-b.l>4 && b.b-b.t>4) F.push(b); };
    add(L.hero,'you'); add(L.foe,'foe'); (L.allies||[]).forEach((a,i)=>add(a,a.name||('ally'+i))); }
  const ov=(a,b)=>a.l<b.r-2&&b.l<a.r-2&&a.t<b.b-2&&b.t<a.b-2;
  const hits=[], clash=[];
  for (const u of ui) for (const f of F) if (ov(u,f)) hits.push(u.k+' on '+f.k+' ['+[u.l,u.t,u.r,u.b].map(Math.round)+'] ['+[f.l,f.t,f.r,f.b].map(Math.round)+']');
  for (let i=0;i<ui.length;i++) for (let j=i+1;j<ui.length;j++) { const a=ui[i], b=ui[j]; if (a.e.contains(b.e)||b.e.contains(a.e)) continue; if ([a.k,b.k].sort().join()==='event line,log arrow') continue; /* the fold arrow sits in the line's left padding (phonefight.js) */ if (a.k===b.k && a.k==='party') { if (ov(a,b)) clash.push('party on party'); continue; } if (ov(a,b)) clash.push(a.k+' on '+b.k); }
  // can the page scroll? (the long page behind the fight must not move: overflow hidden, or nothing taller than the screen)
  const de=document.documentElement, locked=getComputedStyle(de).overflowY==='hidden' || de.scrollHeight<=vh+1;
  return { vw, vh, sw: de.scrollWidth, sh: de.scrollHeight, locked, sy: scrollY,
    btns: btns.map(({e,...r})=>r), fighters: F.length, hits, clash, cls: el.className }; }"""

async def start(pg, size, kind):
    tag = f"{size}{kind}"
    q = "&nozones" if BEFORE else ""
    for _ in range(5):
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=fs{RUN}{tag}&tb{q}"); await pg.wait_for_timeout(1800)
        if await pg.evaluate("typeof ENC!=='undefined' && typeof TB!=='undefined' && typeof FOEGROUPS!=='undefined'"):
            try: await pg.wait_for_selector(".press", timeout=15000); break
            except Exception: pass
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Thumbs"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(HERO)
    if kind == "dungeon": await pg.evaluate(DUNGEON)
    else:
        await pg.evaluate(BOSS if kind == "boss" else SOLO)
        await pg.evaluate(ROAD)
    await pg.wait_for_timeout(600)
    for _ in range(12):
        if await pg.evaluate("!!document.querySelector('#tbf')"): break
        await pg.evaluate("(()=>{ const b=document.querySelector('#modal [data-act=ev][data-c=fight]'); if (b) return b.click(); document.querySelectorAll('#modal').forEach(m=>m.remove()); if (__dbg.save().trip && __dbg.save().trip.event) __dbg.openEvent(); })()"); await pg.wait_for_timeout(500)

async def to_my_turn(pg):
    for _ in range(80):
        await pg.evaluate(CLEAN)
        if await pg.evaluate(MYTURN): return True
        if await pg.evaluate("!!document.querySelector('.bfov.bfintro')"):
            try: await pg.click(".bfov.bfintro", timeout=2000)
            except Exception: pass
        if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
            try: await pg.click("#tbf [data-tbx=skip]", timeout=3000)
            except Exception: pass
        await pg.wait_for_timeout(250)
    return False

def check(tag, L, phone):
    ok(L["sw"] <= L["vw"] + 1 and (L["locked"] or BEFORE) and L["sy"] == 0, f"{tag}: no page scroll ({L['sw']} wide in {L['vw']}, locked {L['locked']}, at {L['sy']})")
    ok(L["fighters"] >= 2, f"{tag}: the fighters are on the battlefield ({L['fighters']})")
    if BEFORE: print("     (before) covering fighters:", L["hits"][:6], "clashing:", L["clash"][:6]); return
    ok(not L["hits"], f"{tag}: nothing essential covers a fighter {L['hits'][:4]}")
    ok(not L["clash"], f"{tag}: the screen's parts don't cover each other {L['clash'][:4]}")
    off = [f"{b['k']} {b['l']:.0f},{b['t']:.0f}-{b['r']:.0f},{b['b']:.0f}" for b in L["btns"] if b["l"] < -0.5 or b["t"] < -0.5 or b["r"] > L["vw"] + 0.5 or b["b"] > L["vh"] + 0.5]
    ok(len(L["btns"]) >= 4 and not off, f"{tag}: every move button is fully on screen ({len(L['btns'])}) {off}")
    if phone:
        small = [f"{b['k']} {b['w']:.0f}x{b['h']:.0f}" for b in L["btns"] if b["w"] < 43.5 or b["h"] < 43.5]
        ok(not small, f"{tag}: every move button is at least 44px {small}")

async def case(b, w, h, kind, errs):
    phone = w < 900
    size = f"{w}x{h}"; tag = f"{size} {kind}"
    kw = {"viewport": {"width": w, "height": h}, "device_scale_factor": 1}
    if phone: kw.update(has_touch=True, is_mobile=True)
    ctx = await b.new_context(**kw); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    await start(pg, size, kind)
    if kind == "boss":
        for _ in range(60):
            if await pg.evaluate("!!document.querySelector('.bfov.bfintro')"): break
            await pg.wait_for_timeout(100)
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=f"{OUT}fightscreen_{TAG}_{size}_boss_intro.png")
        ok(await pg.evaluate("window.__intros") == 1, f"{tag}: the intro plays ({await pg.evaluate('window.__intros')})")
    ok(await to_my_turn(pg), f"{tag}: the fight reaches your turn")
    await pg.mouse.move(1, 1); await pg.wait_for_timeout(900)
    await pg.mouse.wheel(0, 600); await pg.wait_for_timeout(300)   # a scroll wheel / swipe doesn't move the page
    L = await pg.evaluate(LOOK)
    await pg.screenshot(path=f"{OUT}fightscreen_{TAG}_{size}_{kind}.png")
    check(tag, L, phone)
    if BEFORE: await ctx.close(); return
    if kind == "boss":
        D = await pg.evaluate("window.__during")
        ok(bool(D) and all(d["tips"] == 0 and d["bans"] == 0 for d in D), f"{tag}: no tip and no banner during the intro ({len(D)} looks, {[d for d in D if d['tips'] or d['bans']][:2]})")
        await pg.evaluate("TB.redraw(TB.session,{turn:'me'})"); await pg.wait_for_timeout(600)
        ok(await pg.evaluate("window.__intros") == 1, f"{tag}: a redraw doesn't play the intro again")
    # one banner at a time, always (sampled while you play a few moves)
    await pg.evaluate("""()=>{ window.__most=0; const iv=setInterval(()=>{ const n=[...document.querySelectorAll('#tbf .tbban, .rxban, .bfov.bfphase, .bfov.bffin, .bfov.bfintro')].filter(e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden').length; window.__most=Math.max(window.__most,n); },60); setTimeout(()=>clearInterval(iv),15000); }""")
    # rapid taps: the buttons stay where they were, so a fast second tap never lands on End turn
    before = {x["k"]: (round(x["l"]), round(x["t"])) for x in L["btns"]}
    atk = await pg.evaluate("(()=>{ const r=document.querySelector('#tbf .tbdock [data-tba=attack]').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; })()")
    ends = await pg.evaluate("window.__ends=0; document.addEventListener('click', e=>{ if (e.target.closest && e.target.closest('#tbf [data-tba=end]')) window.__ends++; }, true); 0")
    for _ in range(5):
        if phone: await pg.touchscreen.tap(atk[0], atk[1])
        else: await pg.mouse.click(atk[0], atk[1])
        await pg.wait_for_timeout(90)
    ok(await pg.evaluate("window.__ends") == 0, f"{tag}: rapid taps on Attack never press End turn")
    await to_my_turn(pg); await pg.mouse.move(1, 1); await pg.wait_for_timeout(900)
    L2 = await pg.evaluate(LOOK)
    after = {x["k"]: (round(x["l"]), round(x["t"])) for x in L2["btns"]}
    moved = [k for k in before if k in after and (abs(before[k][0] - after[k][0]) > 2 or abs(before[k][1] - after[k][1]) > 2)]
    ok(not moved, f"{tag}: the move buttons don't shift after a move {moved[:4]}")
    if not await pg.evaluate("!!TB.session?.done"): check(tag + " after a move", L2, phone)
    ok(await pg.evaluate("window.__most") <= 1, f"{tag}: one big banner at a time ({await pg.evaluate('window.__most')})")
    await pg.screenshot(path=f"{OUT}fightscreen_{TAG}_{size}_{kind}_move.png")
    if kind == "road" and not await pg.evaluate("!!TB.session?.done"):
        # the phone turns / the window changes size while the game is in the background, then it comes back
        nw, nh = (h, w) if not phone else ((360, 640) if w != 360 else (390, 844))
        await pg.set_viewport_size({"width": nw, "height": nh})
        await pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(1200)
        L3 = await pg.evaluate(LOOK); check(f"{tag} back at {nw}x{nh}", L3, nw < 900)
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        for (w, h) in ((390, 844), (360, 640), (1920, 1080)):
            for kind in ("road", "dungeon", "boss"):
                try: await case(b, w, h, kind, errs)
                except Exception as e: ok(False, f"{w}x{h} {kind}: ran ({e})")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "ALL OK")
    sys.exit(1 if fails else 0)

asyncio.run(main())
