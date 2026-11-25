"""Fight feel on screen (fightfeel.js): hits have weight, fighters stand in formation, effects are drawn in code.
Usage: python3 fightfeel_ui.py PORT   -> "fightfeel_ui ok"
Serve game/ first:  node serve.js PORT ../game
- every blow that lands freezes the two fighters in it for 40-70 ms (hit-stop), a miss never does; while they hold still
  the rest of the scene keeps moving (the scene's own clock and its sparks run on)
- the swing winds up and holds a moment before it snaps through, the blow still lands on its contact frame
- fire, frost and shock each leave their own drawn impact; a block flashes on the shield; a dodge leaves speed streaks
- a worn-out fighter (low health) stands hunched
- formation at 390x844: 4 heroes + 2 followers against 5 foes, everyone's head shows (nobody hidden behind another)
- reduced motion (the phone's setting or the game's own): no hit-stop, no shaking
- frame time stays low (FIGHTART.perf p90)
Captures mid-swing and impact frames. Set SHOTS=/some/dir to save them (nothing is saved by default, never into tests/);
FF_LOOSE=1 only takes pictures (for a before/after comparison on an older build)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
SHOTS = os.environ.get("SHOTS")
PRE = os.environ.get("SHOT_PREFIX", "fightfeel_")
LOOSE = bool(os.environ.get("FF_LOOSE"))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c and not LOOSE: fails.append(m)
JS = r"""
window.__ff = {
  synth(o){
    const base=D.ENCOUNTERS.find(e=>e.name===(o.foe||'Bandit outlaw')) || D.ENCOUNTERS[0], e={...G.scaleEnemy(base,10)};
    const wt = o.wt || 'sword';
    const log=[{turn:1, rule:0, me: o.me || '', them: o.them || '', hp: o.hp ?? 191, ehp: o.ehp ?? 60, a: o.a || 'attack', wt}];
    const al = [];
    for (let i=0;i<(o.mates||0);i++) al.push({ name:['Beta','Ceta','Dera'][i], player:true, look:{ r:['nord','redguard','dunmer'][i], id:'m'+i, eq:{weapon:['steel_sword','iron_war_axe','hunting_bow'][i], chest:['steel_armor','hide_armor','leather_armor'][i]}, gl:{} } });
    for (let i=0;i<(o.fols||0);i++) al.push({ name:['Lydia','Jenassa'][i], follower:true, fid:['lydia','jenassa'][i] });
    const f = { log, hp0: o.hp0 ?? 200, ehp0:120, won: o.won ?? false, e, wt, wt0:wt, weapon:null, eq:{}, armor:{}, shield: o.shield ? {item:'iron_shield'} : null, allies: al, turn:1 };
    if (o.hpMax) f.tbHpMax = o.hpMax;
    if (o.wait) { f.tbWait = o.wait; f.tbTall = true; f.tbAspect = 0.66; f.tbMid = true; }
    this.f = f; return f;
  },
  mount(f, w, crop){
    document.getElementById('ffbox')?.remove(); const b=document.createElement('div'); b.id='ffbox';
    b.style.cssText=`position:fixed;left:0;top:0;width:${(crop||w)+12}px;z-index:9999;background:#111;padding:6px;overflow:hidden`; document.body.appendChild(b);
    const d=document.createElement('div'); d.style.cssText=`width:${w}px;margin-left:${crop ? -(w-crop)/2 : 0}px`; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); b.appendChild(d); return true;
  },
  info(){ const bs = FIGHTART.beatsOf(this.f, FIGHTART.heroOf(null, this.f)), b = bs[0]; if (!b) return null; const m = FIGHTART.MOVES[b.move] || {hits:[]}; return {move:b.move, who:b.who, dur:b.dur, hits:m.hits}; },
  cv(){ return document.querySelector('#ffbox .fscene canvas'); },
  feel(){ const c=this.cv(); return c && c.__feel ? c.__feel.state() : null; },
  log(){ const c=this.cv(); return c && c.__feel ? c.__feel.log.slice() : []; },
  mfx(){ const c=this.cv(); return c ? c.dataset.mfx || '' : ''; },
  vis(){ const c=this.cv(); return c && c.__fp && typeof FIGHTPOS !== 'undefined' && FIGHTPOS.visible ? FIGHTPOS.visible(c.__fp) : null; },
};
"""
# name, synth opts
CASES = [
    ("sword", {"wt": "sword", "me": "Attack: 20"}),
    ("warhammer_power", {"wt": "warhammer", "me": "Power attack: 40", "a": "power_attack"}),
    ("sword_miss", {"wt": "sword", "me": "Attack misses", "ehp": 120}),
    ("foe_hits_you", {"them": "Bandit outlaw hits 9", "hp": 191}),
    ("you_block", {"them": "Bandit outlaw hits 3 (block)", "hp": 197, "shield": True}),
    ("you_dodge", {"them": "Bandit outlaw misses", "hp": 200}),
    ("fire", {"me": "Firebolt: 25", "a": "spell:firebolt", "wt": "sword"}),
    ("frost", {"me": "Ice Spike: 25", "a": "spell:ice_spike", "wt": "sword"}),
    ("shock", {"me": "Sparks: 25", "a": "spell:sparks", "wt": "sword"}),
    ("sword_fire", {"wt": "sword", "me": "Attack: 20 +fire"}),
    ("tired", {"wt": "sword", "me": "Attack: 20", "hp": 22, "hp0": 22, "hpMax": 200}),
]
async def scene(pg, name, o, w, crop=None):
    js = "{" + ",".join(f"{k}:{('true' if v is True else repr(v))}" for k, v in o.items()) + "}"
    await pg.evaluate(f"()=>__ff.mount(__ff.synth({js}), {w}, {crop or 'null'})")
    await pg.wait_for_timeout(250)

async def main():
    if SHOTS: os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        for vw, vh, w in [(390, 844, 368), (1920, 1080, 900)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 500 else 1)
            pg = await ctx.new_page(); pg.set_default_timeout(90000); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&fightanim&assets&p=ff{vw}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Swordhand"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
            ok(LOOSE or await pg.evaluate("typeof FIGHTFEEL === 'object'"), f"{vw}: fightfeel.js loads")
            tag = "phone" if vw < 500 else "pc"
            for name, o in CASES:
                await scene(pg, name, o, w)
                el = await pg.query_selector("#ffbox .fscene")
                info = await pg.evaluate("__ff.info()")
                if not info: ok(False, f"{vw}: {name} has a beat"); continue
                hits, dur = info["hits"] or [0.5], info["dur"]
                h0 = hits[0]
                # wind-up, mid-swing, impact (+ a frame into the hit-stop), recoil
                t = 0
                for lab, at in [("1windup", h0 - 0.16), ("2swing", h0 - 0.05), ("3impact", h0 + 0.01), ("4recoil", h0 + 0.2)]:
                    tgt = max(0, int(at * dur))
                    if tgt > t: await pg.evaluate(f"FIGHTART.advance({tgt - t})"); t = tgt
                    if lab == "3impact":
                        st = await pg.evaluate("__ff.feel()")
                        if st and not LOOSE:
                            miss = "miss" in name or "dodge" in name
                            if miss: ok(st["stop"] <= 0, f"{vw}: {name}: a miss doesn't freeze anyone ({st['stop']:.3f})")
                            elif name not in ("fire", "frost", "shock"):
                                ok(st["stop"] > 0 or st["stopLast"] >= 0.04, f"{vw}: {name}: the blow freezes the fighters ({st})")
                                ok(0.04 <= st["stopLast"] <= 0.07, f"{vw}: {name}: hit-stop is 40-70 ms ({st['stopLast'] * 1000:.0f} ms)")
                                # while frozen, the beat clock holds but the scene's own clock runs on
                                if st["stop"] > 0.017:
                                    lt0, r0 = st["lt"], st["real"]
                                    await pg.evaluate("FIGHTART.advance(16)"); t += 16
                                    st2 = await pg.evaluate("__ff.feel()")
                                    ok(abs(st2["lt"] - lt0) < 1e-6 and st2["real"] > r0, f"{vw}: {name}: only the fighters in the blow hold still (beat {lt0:.1f}->{st2['lt']:.1f}, scene {r0:.3f}->{st2['real']:.3f})")
                    if SHOTS and (vw < 500 or lab in ("2swing", "3impact")): await el.screenshot(path=os.path.join(SHOTS, f"{PRE}{tag}_{name}_{lab}.png"))
                lg = await pg.evaluate("__ff.log()")
                if not LOOSE:
                    kinds = [e.get("kind") for e in lg if e["k"] == "fx"]
                    if name in ("fire", "frost", "shock"):
                        mk = await pg.evaluate("__ff.mfx()")   # a spell movefx.js paints has its own impact; the drawn one stays quiet then
                        ok(name in kinds or bool(mk), f"{vw}: {name}: its own impact plays ({kinds} / movefx {mk})")
                    if name == "sword_fire": ok("fire" in kinds, f"{vw}: an enchanted blade's fire shows at the hit ({kinds})")
                    if name == "you_block": ok("shield" in kinds, f"{vw}: a block flashes on the shield ({kinds})")
                    if name == "you_dodge": ok("dodge" in kinds, f"{vw}: a dodge leaves speed streaks ({kinds})")
                    if name == "sword":
                        wu = [e for e in lg if e["k"] == "wind"]
                        ok(len(wu) == 1 and wu[0]["hold"] > 0, f"{vw}: the swing holds at the top of its wind-up ({wu})")
                    if name == "tired":
                        st = await pg.evaluate("__ff.feel()")
                        ok(st and st["tired"] > 0.3, f"{vw}: a worn-out hero stands hunched ({st and st['tired']})")
                await pg.evaluate(f"FIGHTART.advance({int(dur) + 1500})")
            # formation: 4 heroes (you + 3) and 2 followers against 5 foes, on the phone's cropped stage
            await scene(pg, "formation", {"mates": 3, "fols": 2, "wait": 4, "me": "Attack: 20", "wt": "sword"}, 520 if vw < 500 else 900, 380 if vw < 500 else None)
            await pg.evaluate("FIGHTART.advance(300)")
            el = await pg.query_selector("#ffbox")
            if SHOTS: await el.screenshot(path=os.path.join(SHOTS, f"{PRE}{tag}_formation.png"))
            if not LOOSE:
                v = await pg.evaluate("__ff.vis()")
                print("     layout", await pg.evaluate("(()=>{const L=__ff.cv().__fp; return {W:L.W,l:L.l,r:L.r,Hh:L.Hh,foe:L.foe.x,fl:L.foe.left,fr:L.foe.right,ft:L.foe.top,fs:L.foe.fs,s:L.s,more:L.more,w:L.waiting.length,rows:L.rows}})()"))
                ok(v is not None, f"{vw}: the layout reports who can be seen")
                if v:
                    worst = min(v, key=lambda x: x["head"])
                    ok(worst["head"] >= 0.5, f"{vw}: every head shows (worst {worst})")
                    ok(sum(1 for x in v if x["who"].startswith("w")) + 1 >= 5, f"{vw}: all five foes show ({[x['who'] for x in v]})")
            # frame time
            pf = await pg.evaluate("FIGHTART.perf()")
            print(f"     {vw}: draw ms p50 {pf['p50']:.2f} p90 {pf['p90']:.2f} max {pf['max']:.2f} ({pf['frames']} frames)")
            ok(pf["p90"] < 25, f"{vw}: frames stay quick (p90 {pf['p90']:.1f} ms)")
            await ctx.close()
        # reduced motion: no hit-stop, no shaking
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        pg = await ctx.new_page(); pg.set_default_timeout(90000); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&fightanim&p=ffrm"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Stillhand"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
        await scene(pg, "rm", {"wt": "warhammer", "me": "Power attack: 40", "a": "power_attack"}, 368)
        info = await pg.evaluate("__ff.info()")
        await pg.evaluate(f"FIGHTART.advance({int(info['hits'][0] * info['dur']) + 20})")
        st = await pg.evaluate("__ff.feel()")
        if not LOOSE: ok(st is not None and st["stop"] <= 0 and st["stopLast"] <= 0, f"reduced motion: no hit-stop ({st})")
        await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "fightfeel_ui ok")
    if fails: sys.exit(1)
asyncio.run(main())
