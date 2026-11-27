"""Fight look (fightart.js draw order, rig layers, fight screen layout): a dungeon fight with a follower on a
412x915 phone, a 360x780 phone and a 1280x800 PC, played with painted art and stepped frame by frame.
Checks: the striker is drawn in front of its target (hero melee -> "foe" before "me" in cv.__zo), waiting foes are
drawn behind the fighters, the shield always sits behind the body: the off hand is the back layer (PAINTRIG order) [offhand],
the hero's lunge never passes the foe's centre and nobody is knocked off the stage, nothing is wider than the screen,
the main fight buttons are at least 44px on phones, and on PC the rows strip doesn't cover the fighters or the log.
Screenshots go to $SHOTS/out_fightlook/.
Usage: python3 fightlook_ui.py PORT"""
import asyncio, sys, os, time, tempfile
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
RUN = str(int(time.time()) % 100000)
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "out_fightlook") + os.sep; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
HERO = """(k)=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=25; for (const n of ['One-Handed','Two-Handed','Archery','Destruction','Restoration','Conjuration','Illusion','Alteration','Athletics','Block']) if (S.skills[n]) S.skills[n].lvl=50;
  S.mpBonus=200; for (const id of ['flames','sparks','frostbite','firebolt','healing','conjure_familiar','fireball','ice_spike','lightning_bolt','oakflesh','fear','courage','conjure_flame_atronach','heal_other']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  if (k.fol) S.follower={id:'lydia',hp:9999,ts:0}; else S.follower=null;
  if (k.w) { G.give(S,k.w,1); try { const r=(S.inv||S.inventory||[]).find(x=>x.item===k.w); window.__eq=G.equip(S,r?r.id:k.w) } catch(e){ window.__eq=String(e) } } if (k.arrows) G.give(S,k.arrows,50);
  G.give(S,'potion_health',3); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; return Object.keys(D.SPELLS).filter(x=>S.spells.includes(x)); }"""
DUNGEON = """(n)=>{ const S=window.__dbg.save(); S.trip=null; [S.x,S.y]=WORLD.places['Embershard Mine'].slice(0,2);
  S.dungeon={ place:'Embershard Mine', theme:'mine', tier:1, rows:[[{type:'fight',links:[]}]], row:0, col:0, room:null, found:[], gold:0, t:G.now() };
  const pp=FOEGROUPS.prep; FOEGROUPS.prep=(f,pl)=>{ FOEGROUPS.prep=pp; const r=pp(f,pl); const g=f.e.group||(f.e.group=[f.e.arch||'brute']);
    while (g.length<n) g.push(Object.keys(FOEGROUPS.ARCH).find(k=>FOEGROUPS.KINDS.bandit.includes(k))||g[0]); return {...r, n, hpMul:g.map(()=>window.__LOWHP?0.04:2)}; };
  const e=G.scaleEnemy({name:'Bandit',health:400,damage:6,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
  TB.call(S, ()=>{ const f=new G.Fight(S,e); return f.run({trySneak:false}); }, ()=>{}); }"""
POS = """()=>{ const cv=[...document.querySelectorAll('#tbf canvas')].find(c=>c.__fp); if(!cv) return null; const L=cv.__fp; const o={};
  for (const w of ['me','foe',...(L.allies||[]).map(a=>a.name)]) { const p=FIGHTPOS.screenOf(cv,w); if(p) o[w]=[Math.round(p.x),Math.round(p.y),Math.round(p.top)]; } return o; }"""
ZO = "(()=>{const c=[...document.querySelectorAll('#tbf canvas')].find(c=>c.__zo); return c? c.__zo.join(','):null})()"
RIG = "(()=>{ if (typeof PAINTRIG==='undefined'||!PAINTRIG.last) return null; const r=PAINTRIG.last('me'); return r? r.order.join(','):null; })()"
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove())"
TAPS = """()=>{ const vis=(e)=>{ const s=getComputedStyle(e); const r=e.getBoundingClientRect(); return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1; };
  const out=[]; for (const sel of ['#tbf [data-tba]','#tbf .c2ord .c2o','#tbf .fdc-mb','#tbf .inimore','.rowfield .rfrow.many .rfp'])
    for (const e of document.querySelectorAll(sel)) if (vis(e)) { const r=e.getBoundingClientRect(); if (r.width<43.5||r.height<43.5) out.push(sel+' '+Math.round(r.width)+'x'+Math.round(r.height)); }
  return out; }"""
STRIP = """()=>{ const rf=document.querySelector('.rowfield'); const cv=[...document.querySelectorAll('#tbf canvas')].find(c=>c.__fp);
  if (!rf||!cv||getComputedStyle(rf).display==='none') return {none:true}; const R=rf.getBoundingClientRect(); const hit=[];
  const L=cv.__fp; for (const w of ['me','foe',...(L.allies||[]).map(a=>a.name)]) { const p=FIGHTPOS.screenOf(cv,w); if(!p) continue;
    const bx=[p.x-30,p.top+10,p.x+30,p.y-10]; if (bx[0]<R.right&&bx[2]>R.left&&bx[1]<R.bottom&&bx[3]>R.top) hit.push(w); }
  for (const e of document.querySelectorAll('#tbf .tblog, #tbf .c2feed')) { const r=e.getBoundingClientRect(); if (r.width>2&&r.height>2&&getComputedStyle(e).display!=='none'&&r.left<R.right-2&&r.right>R.left+2&&r.top<R.bottom-2&&r.bottom>R.top+2) hit.push('log'); }
  return {hit, sw:document.documentElement.scrollWidth}; }"""
async def wait_turn(pg, n=80):
    for _ in range(n):
        await pg.evaluate(CLEAN)
        if await pg.evaluate(MYTURN): return True
        if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
            try: await pg.click("#tbf [data-tbx=skip]", timeout=2000)
            except Exception: pass
        await pg.wait_for_timeout(250)
    return False
async def step(pg, tag, steps=40, ms=60):
    fr = []
    for i in range(steps):
        await pg.evaluate(f"FIGHTART.advance({ms})")
        fr.append({"pos": await pg.evaluate(POS), "zo": await pg.evaluate(ZO), "rig": await pg.evaluate(RIG)})
        if i == 8: await pg.screenshot(path=f"{OUT}{tag}.png")
        if i > 6 and not await pg.evaluate("FIGHTART.playing && FIGHTART.playing()"): break
    return fr
async def act(pg, a):
    await pg.evaluate(CLEAN)
    if not await pg.evaluate(f"!!document.querySelector('#tbf [data-tba=\"{a}\"]:not([disabled])')"): return False
    await pg.evaluate(f"document.querySelector('#tbf [data-tba=\"{a}\"]').click()"); return True
async def run(b, w, h, phone, errs):
    tag = f"{w}x{h}"
    kw = {"viewport": {"width": w, "height": h}, "device_scale_factor": 1}
    if phone: kw.update(has_touch=True, is_mobile=True)
    ctx = await b.new_context(**kw); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    for _ in range(5):
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=flk{RUN}{w}&tb&fightanim&assets"); await pg.wait_for_timeout(1800)
        try: await pg.wait_for_selector(".press", timeout=15000); break
        except Exception: pass
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Looker"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(HERO, {"fol": True, "w": None, "arrows": None})
    await pg.evaluate("window.__LOWHP=false"); await pg.evaluate(DUNGEON, 5); await pg.wait_for_timeout(600)
    for _ in range(12):
        if await pg.evaluate("!!document.querySelector('#tbf')"): break
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(500)
    ok(await wait_turn(pg), f"{tag}: my turn comes")
    await pg.mouse.move(1, 1); await pg.wait_for_timeout(500); await pg.screenshot(path=f"{OUT}{tag}_start.png")
    st = await pg.evaluate(STRIP)
    sw = await pg.evaluate("document.documentElement.scrollWidth")
    ok(sw <= w + 1, f"{tag}: nothing wider than the screen ({sw})")
    if not st.get("none"): ok(not st["hit"], f"{tag}: rows strip covers nothing {st['hit']}")
    if phone:
        small = await pg.evaluate(TAPS); ok(not small, f"{tag}: fight buttons at least 44px {small[:4]}")
    z0 = await pg.evaluate(ZO) or ""
    zs = z0.split(",")
    if "waiting" in zs: ok(zs.index("waiting") < zs.index("me"), f"{tag}: waiting foes drawn behind the fighters ({z0})")
    # hero melee: striker in front, lunge stays short of the foe's centre, shield behind when lowered
    await pg.evaluate("FIGHTART.manual(true)")
    did = await act(pg, "attack"); ok(did, f"{tag}: attack button")
    fr = await step(pg, f"{tag}_attack") if did else []
    await pg.evaluate("FIGHTART.manual(false)")
    zo = [f["zo"] for f in fr if f["zo"]]
    ok(any(z.split(",").index("foe") < z.split(",").index("me") for z in zo if "foe" in z and "me" in z), f"{tag}: hero drawn in front of the foe while striking")
    pass_ = [f["pos"] for f in fr if f["pos"] and "me" in f["pos"] and "foe" in f["pos"] and f["pos"]["me"][0] >= f["pos"]["foe"][0]]
    ok(not pass_, f"{tag}: hero's lunge never passes the foe ({pass_[:1]})")
    jump = 0; prev = None
    for f in fr:
        p = f["pos"] and f["pos"].get("me")
        if p and prev: jump = max(jump, abs(p[0] - prev[0]))
        prev = p or prev
    ok(jump < w * 0.25, f"{tag}: no frame jump in the hero's position (max {jump}px)")
    off = [f["pos"] for f in fr if f["pos"] and any(v[0] < -10 or v[0] > w + 10 for v in f["pos"].values())]
    ok(not off, f"{tag}: nobody knocked off the stage ({off[:1]})")
    rigs = [f["rig"].split(",") for f in fr if f["rig"] and "shield" in f["rig"]]
    if rigs: ok(all(r.index("shield") == 0 for r in rigs), f"{tag}: the shield is the back layer, behind the whole body [offhand]")
    # foes' and the follower's turn
    if await wait_turn(pg, 40):
        await pg.evaluate("FIGHTART.manual(true)"); await pg.evaluate("document.querySelector('#tbf [data-tba=end]')?.click()"); await pg.wait_for_timeout(200)
        fr2 = await step(pg, f"{tag}_foeturn", 60, 60); await pg.evaluate("FIGHTART.manual(false)")
        al = [z for z in (f["zo"] for f in fr2) if z and "ally:" in z]
        late = [z for z in al if z.split(",").index("foe") < max(i for i, n in enumerate(z.split(",")) if n.startswith("ally:"))]
        print(f"info {tag}: ally frames {len(al)}, ally drawn in front while striking {len(late)}")
        off = [f["pos"] for f in fr2 if f["pos"] and any(v[0] < -10 or v[0] > w + 10 for v in f["pos"].values())]
        ok(not off, f"{tag}: nobody knocked off the stage on the foes' turn ({off[:1]})")
    await ctx.close()
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h, ph in [(412, 915, True), (360, 780, True), (1280, 800, False)]:
            try: await run(b, w, h, ph, errs)
            except Exception as e: ok(False, f"{w}x{h} crashed: {e}")
        await b.close()
    ok(not errs, f"no page errors {errs[:3]}")
    print(f"\n{len(fails)} failed" if fails else "\nall ok"); sys.exit(1 if fails else 0)
asyncio.run(main())
