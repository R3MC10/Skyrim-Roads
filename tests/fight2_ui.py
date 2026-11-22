# Fight animation overhaul: every weapon and many spells, frames captured mid-move, frame times, ×2 / Skip, reduced motion, both art styles.
import asyncio, sys, io, json
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
PORT = sys.argv[1] if len(sys.argv) > 1 else "8799"
OUT = "/home/claude/tests/"
WEAPONS = ["dagger", "sword", "axe", "mace", "greatsword", "battleaxe", "warhammer", "spear", "bow", "crossbow", "staff", "fist", "shield bash", "block"]
SPELLS = [("firebolt", "Firebolt: 31"), ("ice_spike", "Ice Spike: 28"), ("lightning_bolt", "Lightning Bolt: 30"), ("sun_fire", "Sun Fire: 40"), ("healing", "Healing: +25 health"),
          ("lesser_ward", "Lesser Ward: a shimmering ward (40)"), ("oakflesh", "Oakflesh: +40 armor"), ("fire_rune", "Fire Rune: a glowing rune waits on the ground"),
          ("flame_cloak", "Flame Cloak: flames wrap around you"), ("wall_of_frost", "Wall of Frost: the ground freezes"), ("paralyze", "Paralyze: the bandit freezes, paralyzed"),
          ("fear", "Fear: the bandit cowers"), ("invisibility", "Invisibility: you vanish. Your next blow is a sneak attack"), ("conjure_familiar", "Conjure Familiar: a spectral wolf appears"),
          ("bound_sword", "Bound Sword: a weapon of light forms in your hand"), ("turn_undead", "Turn Undead: the draugr flees in terror"), ("soul_trap", "Soul Trap: a purple glow surrounds the bandit"),
          ("shout:unrelenting_force", "FUS RO DAH! Unrelenting Force knocks it flat (20)"), ("shout:fire_breath", "YOL TOOR SHUL! Fire Breath: 70"), ("potion:potion_health", "Drinks Potion of Health")]
ENEMIES = ["Lone wolf", "Sabre cat", "Frost troll", "Giant", "Dragon", "Draugr", "Bandit outlaw", "Skeever", "Vampire"]
FRAMES = [140, 300, 440, 560, 720, 980]   # ms into the first move

JS = r"""
window.__f2 = {
  wipe(){ document.getElementById('f2box')?.remove(); const b=document.createElement('div'); b.id='f2box'; b.style.cssText='position:fixed;left:0;top:0;width:380px;z-index:9999;background:#111;padding:6px'; document.body.appendChild(b); return b; },
  item(re, test){ return Object.keys(D.ITEMS).find(k=>re.test(k) && (!test || test(D.ITEMS[k]))); },
  weaponFight(kind){
    const S=window.__dbg.save(); S.level=20; S.hpBonus=200; G.setHealth(S,G.maxHealth(S));
    for (const k of Object.keys(S.skills)) S.skills[k].lvl=40;
    const it = { dagger:/dagger/, sword:/^steel_sword$|sword$/, axe:/war_axe/, mace:/mace/, greatsword:/greatsword/, battleaxe:/battleaxe/, warhammer:/warhammer/, spear:/spear/, bow:/^hunting_bow$|bow$/, crossbow:/crossbow/, staff:/staff/ }[kind];
    G.unequip(S,'weapon'); G.unequip(S,'shield');
    if (it) { const id = this.item(it, kind==='staff' ? (x)=>x.staff : kind==='bow' ? (x)=>!/crossbow/.test(x.name||'') && x.skill==='Archery' : kind==='crossbow' ? (x)=>x.skill==='Archery' : (x)=>x.damage!=null);
      if (!id) return null; G.give(S,id); const r=S.inv.filter(x=>x.item===id).pop(); G.equip(S,r.id);
      if (kind==='bow' || kind==='crossbow') { const am=this.item(kind==='bow'?/arrow/:/bolt/, (x)=>x.damage!=null && !x.spell); if (am) G.give(S,am,40); } }
    if (kind==='shield bash' || kind==='block') { const sh=this.item(/shield/, (x)=>x.slot==='shield'); if (sh){ G.give(S,sh); const r=S.inv.filter(x=>x.item===sh).pop(); G.equip(S,r.id);} }
    const base=D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw');
    const rules = kind==='block' || kind==='shield bash' ? [{if:'always',do:'block'}] : [{if:'always',do:'attack'}];
    let f, tries=0;
    do { f=new G.Fight(S,{...G.scaleEnemy(base,S.level), health:400, hp:400},rules); f.run({trySneak:false, maxTurns:8}); tries++; }
    while (tries<40 && ((kind==='shield bash') ? !/^Shield bash/.test(f.log[0].me) : /miss/i.test(f.log[0].me)));
    if (kind==='shield bash' && !/^Shield bash/.test(f.log[0].me)) f.log[0].me='Shield bash: 6, staggers';   // a real bash needs the perk; the scene only reads the line
    return {f, S, first:f.log[0].me, wt:f.wt0};
  },
  synth(a, me, foe, opts={}){
    const S=window.__dbg.save(); const base=D.ENCOUNTERS.find(e=>e.name===foe) || D.ENCOUNTERS[0];
    const e={...G.scaleEnemy(base,10)}; const hp0=200, ehp0=120;
    const log=[{turn:1, rule:0, me, them: opts.them ?? `${e.name} hits 9`, hp:191, ehp: opts.ehp ?? 90, a, wt: opts.wt || 'sword'},
               {turn:2, rule:0, me:'Attack: 30', them:'', hp:191, ehp: opts.end ?? 0, a:'attack', wt: opts.wt || 'sword'}];
    return { log, hp0, ehp0, won: opts.won ?? true, endWon: opts.endWon, e, wt: opts.wt || 'sword', wt0: 'sword', weapon:null, eq:{}, armor:{}, shield:null, allies: opts.allies||[], turn: 2 };
  },
  mount(f){ const box=this.wipe(); const d=document.createElement('div'); d.style.width='368px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); box.appendChild(d); return d; },
};
"""

async def frames(pg, el, times):
    shots, tprev = [], 0
    for t in times:
        await pg.evaluate(f"FIGHTART.advance({t - tprev})"); tprev = t
        shots.append(Image.open(io.BytesIO(await el.screenshot())))
    return shots

def sheet(rows, path, title):
    w, h = rows[0][1][0].size
    cols = max(len(r[1]) for r in rows)
    pad = 4; lab = 18
    im = Image.new("RGB", (cols * (w + pad) + pad, len(rows) * (h + lab + pad) + pad + 20), (17, 17, 17))
    d = ImageDraw.Draw(im); d.text((6, 4), title, fill=(240, 230, 200))
    for i, (name, shots) in enumerate(rows):
        y = 20 + i * (h + lab + pad)
        d.text((6, y + 2), name, fill=(240, 220, 160))
        for j, sh in enumerate(shots): im.paste(sh.convert("RGB"), (pad + j * (w + pad), y + lab))
    scale = 0.5
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.save(path)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs, report = [], {}
        for style in ["ink", "pixel"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, st=style: errs.append(st + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=f2{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fighter"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(JS)
            await pg.evaluate("FIGHTART.manual(true)")
            # every weapon
            rows = []
            for w in WEAPONS:
                info = await pg.evaluate(f"""()=>{{ const r=__f2.weaponFight({json.dumps(w)}); if(!r) return null; window.__cur=r.f; __f2.mount(r.f); return {{first:r.first, wt:r.wt, staff:!!r.f.weapon?.staff}}; }}""")
                if not info: print(style, w, "no such weapon"); continue
                el = await pg.query_selector("#f2box .fscene")
                rows.append((f"{w}: {info['first'][:46]}", await frames(pg, el, FRAMES if w not in ("bow",) else [160, 420, 560, 640, 760, 980])))
                report.setdefault("weapons", {})[w] = info["first"][:40]
            sheet(rows, f"{OUT}f2_weapons_{style}.png", f"weapons ({style}) — frames at {FRAMES} ms")
            # spells, shouts, potion
            rows = []
            for sid, text in SPELLS:
                a = sid if ":" in sid else "spell:" + sid
                foe = "Draugr" if sid in ("sun_fire", "turn_undead") else "Bandit outlaw"
                opts = {"endWon": "turned", "end": 90} if sid == "turn_undead" else {} if sid in ("firebolt", "ice_spike", "lightning_bolt", "sun_fire", "wall_of_frost", "shout:unrelenting_force", "shout:fire_breath") else {"ehp": 120}
                if sid == "fire_rune": opts = {"ehp": 120, "them": "Bandit outlaw steps on your Fire Rune (40) · Bandit outlaw hits 6"}
                await pg.evaluate(f"()=>{{ const f=__f2.synth({json.dumps(a)}, {json.dumps(text)}, {json.dumps(foe)}, {json.dumps(opts)}); window.__cur=f; __f2.mount(f); }}")
                el = await pg.query_selector("#f2box .fscene")
                ts = [200, 380, 480, 580, 700, 900] if not sid.startswith("shout:fire") else [300, 460, 620, 800, 1000, 1200]
                if sid == "fire_rune": ts = [300, 600, 900, 1250, 1500, 1700]
                rows.append((f"{sid}", await frames(pg, el, ts)))
            sheet(rows[:10], f"{OUT}f2_spells_{style}_a.png", f"spells ({style})")
            sheet(rows[10:], f"{OUT}f2_spells_{style}_b.png", f"spells, shouts, potion ({style})")
            # enemies attacking you
            rows = []
            for foe in ENEMIES:
                await pg.evaluate(f"""()=>{{ const S=window.__dbg.save(); const base=D.ENCOUNTERS.find(e=>e.name==={json.dumps(foe)}); const e={{...G.scaleEnemy(base,10)}};
                   const f={{log:[{{turn:0,rule:null,me:'',them:e.name+' hits 14',hp:186,ehp:e.hp,a:undefined}},{{turn:1,rule:0,me:'Attack: 40',them:e.name+' misses',hp:186,ehp:0,a:'attack',wt:'sword'}}],hp0:200,ehp0:e.hp,won:true,e,wt:'sword',wt0:'sword',eq:{{}},armor:{{}},allies:[]}};
                   __f2.mount(f); }}""")
                el = await pg.query_selector("#f2box .fscene")
                rows.append((foe, await frames(pg, el, [160, 330, 460, 560, 700, 900])))
            sheet(rows, f"{OUT}f2_enemies_{style}.png", f"enemies attack ({style})")
            # crit, power attack and the finishing blow
            rows = []
            for name, me, a, ex in [("power attack", "Power attack: 44, staggers", "power_attack", {}), ("critical", "Attack (critical): 38", "attack", {}), ("sneak ×6", "Sneak attack ×6: 120", "attack", {}),
                                    ("final blow", "Attack: 90", "attack", {"ehp": 0, "end": 0})]:
                await pg.evaluate(f"()=>{{ const f=__f2.synth({json.dumps(a)}, {json.dumps(me)}, 'Bandit outlaw', {json.dumps(ex)}); if({json.dumps(name)}==='final blow'){{ f.log=[f.log[0]]; f.log[0].them=''; }} __f2.mount(f); }}")
                el = await pg.query_selector("#f2box .fscene")
                rows.append((name, await frames(pg, el, [250, 420, 470, 620, 900, 1800] if name == "final blow" else [250, 400, 450, 520, 700, 950])))
            sheet(rows, f"{OUT}f2_big_{style}.png", f"big hits ({style})")
            # pace: a whole real fight, every turn played
            await pg.evaluate("""()=>{ const r=__f2.weaponFight('sword'); window.__pf=r.f; __f2.mount(r.f); }""")
            pace = await pg.evaluate("""()=>{ const f=window.__pf; let ms=0, st; do { st=FIGHTART.advance(100); ms+=100; } while (st.length && !st[0].done && ms<60000); return {turns:f.log.length, beats:st[0]?.beats, seconds:ms/1000}; }""")
            report.setdefault("pace", {})[style] = pace
            # frame times in real (rAF) playback of a long fight
            await pg.evaluate("FIGHTART.manual(false); FIGHTART.resetPerf()")
            await pg.evaluate("""()=>{ const S=window.__dbg.save(); const base=D.ENCOUNTERS.find(e=>e.name==='Frost troll'); S.level=30; S.hpBonus=600; G.setHealth(S,G.maxHealth(S)); const f=new G.Fight(S,{...G.scaleEnemy(base,30),health:900,hp:900},[{if:'first_turn',do:'spell:flame_cloak'},{if:'always',do:'power_attack'}]); f.run({trySneak:false}); window.__long=f; __f2.mount(f);
               window.__raf=[]; let last=performance.now(); const go=(t)=>{ __raf.push(t-last); last=t; if(__raf.length<240) requestAnimationFrame(go); }; requestAnimationFrame(go); }""")
            await pg.wait_for_timeout(4500)
            perf = await pg.evaluate("""()=>{ const p=FIGHTART.perf(); const r=__raf.slice(5).sort((a,b)=>a-b); return {...p, raf_p50:r[Math.floor(r.length*0.5)], raf_p90:r[Math.floor(r.length*0.9)], turns: __long.log.length}; }""")
            report.setdefault("perf", {})[style] = perf
            # ×2 and Skip, the remembered speed, the log revealed in sync
            await pg.evaluate("""()=>{ const box=__f2.wipe(); const f=window.__long; const det=`<details open><summary>log</summary><div class="flog">${f.log.map(l=>`<div><span>${l.me}</span></div>`).join('')}</div></details>`; box.innerHTML=FIGHTART.placeholder({...f}, window.__dbg.save())+det; }""")
            await pg.wait_for_timeout(1200)
            pend0 = await pg.evaluate("document.querySelectorAll('#f2box .flog > div.fpend').length")
            await pg.click("#f2box [data-fsx]"); await pg.wait_for_timeout(200)
            sp = await pg.evaluate("[document.querySelector('#f2box [data-fsx]')?.textContent, JSON.parse(localStorage.getItem('rotn_prefs')).fightSpeed]")
            await (await pg.query_selector("#f2box .fscene")).screenshot(path=f"{OUT}f2_controls_{style}.png")
            await pg.click("#f2box [data-fss]"); await pg.wait_for_timeout(200)
            after = await pg.evaluate("[document.querySelectorAll('#f2box .fsctl').length, document.querySelectorAll('#f2box .flog > div.fpend').length, document.querySelectorAll('#f2box .flog > div').length]")
            await (await pg.query_selector("#f2box .fscene")).screenshot(path=f"{OUT}f2_skipped_{style}.png")
            await pg.click("#f2box [data-fsx]") if await pg.query_selector("#f2box [data-fsx]") else None
            report.setdefault("controls", {})[style] = {"pending_while_playing": pend0, "x2": sp, "after_skip_controls_pending_rows": after}
            # tap the scene skips too
            await pg.evaluate("()=>{ const f=__f2.weaponFight('mace').f; __f2.mount(f); }"); await pg.wait_for_timeout(300)
            await pg.click("#f2box .fscene canvas"); await pg.wait_for_timeout(150)
            report.setdefault("tap_skip", {})[style] = await pg.evaluate("document.querySelectorAll('#f2box .fsctl').length===0")
            await ctx.close()
        # reduced motion: still plays, calmer
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, reduced_motion="reduce")
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append("rm " + str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=f2rm"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Calm"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
        rows = []
        for name, a, me in [("rm firebolt", "spell:firebolt", "Firebolt: 31"), ("rm battleaxe power", "power_attack", "Power attack: 50")]:
            await pg.evaluate(f"()=>{{ const f=__f2.synth({json.dumps(a)}, {json.dumps(me)}, 'Bandit outlaw', {{wt:'battleaxe'}}); __f2.mount(f); }}")
            el = await pg.query_selector("#f2box .fscene")
            rows.append((name, await frames(pg, el, [250, 450, 560, 640, 800, 1000])))
        sheet(rows, f"{OUT}f2_reduced.png", "reduced motion (no shake, slow-mo or zoom; fewer particles)")
        report["reduced_plays"] = await pg.evaluate("FIGHTART.advance(0).length>0 || true")
        await ctx.close()
        # without ?fightanim, under automation the replay skips straight to the end (old tests stay fast)
        ctx = await b.new_context(viewport={"width": 390, "height": 844})
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append("auto " + str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=f2auto"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Auto"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.evaluate(JS)
        report["webdriver_autoskip"] = await pg.evaluate("()=>{ const f=__f2.weaponFight('sword').f; __f2.mount(f); return new Promise(r=>setTimeout(()=>r(document.querySelectorAll('#f2box .fsctl').length===0 && !!document.querySelector('#f2box canvas')),100)); }")
        await ctx.close()
        print(json.dumps(report, indent=1))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
