"""Where everyone stands in a fight (fightpos.js) on the turn-by-turn fight screen. Usage: py fightpos_ui.py PORT -> RESULT OK
Serve game/ first:  py -m http.server PORT --directory ../game
At 390x844 (phone, touch) and 1920x1080 (PC): a solo fight, a full party of 8 with followers (foes waiting their turn),
a party against a giant, a dragon, a mounted party. Checks from the scene's own layout (canvas data-fp):
- you, every party member and the foes on screen (on a phone the fight screen crops the scene's sides)
- your side left of the foe, feet on the ground line, back rows a little higher
- the foe's health plate sits over the foe; the foes still waiting stand behind it
Fails on page errors. Screenshots go to $SHOTS (or the temp folder), never into tests/."""
import asyncio, sys, os, json, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = (os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/fightpos/"
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

LOOKS = [['steel_sword','steel_armor','steel_helmet','steel_shield'],['hunting_bow','leather_armor'],['iron_war_axe','hide_armor'],['staff_flames','mage_robes'],['iron_greatsword','steel_armor'],['steel_sword','chainmail'],['iron_mace','iron_armor','iron_helmet']]
# name, other players, followers, ride, foe name regex
CASES = [("solo", 0, 0, False, "^Bandit outlaw$"), ("party8", 7, 2, False, "^Bandit outlaw$"), ("party4_giant", 3, 0, False, "^Giant$"),
         ("dragon", 1, 1, False, "^Dragon$"), ("ride4", 3, 0, True, "^Bandit outlaw$")]
SETUP = """([players, fols, ride, foeRe]) => {
  document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=30; S._test=true; S.hpBonus=400; S.follower=null; S.dungeon=null; S.trip=null; S.gold=5000;
  for (const k of Object.keys(S.skills)) S.skills[k].lvl=40;
  const id=G.give(S,'steel_sword'); G.equip(S,id); G.setHealth(S,G.maxHealth(S));
  const looks=%s; const al=[];
  for (let i=0;i<players;i++){ const eq=looks[i%%7]; al.push({ name:['Beta','Ceta','Dera','Echo','Foxa','Gala','Hilo'][i], dmg:6, hp:120, maxHp:120, red:0.2, role:'fighter', player:true, coop:true, party:true, uid:'x'+i,
     look:{ r:['nord','redguard','dunmer','imperial','orc','breton','khajiit'][i], id:'m'+i, eq:{weapon:eq[0],chest:eq[1],head:eq[2],shield:eq[3]}, gl:{} }, mt: ride && i%%2===0 ? {up:true, coat:'#8a6a44'} : undefined }); }
  const fl=['lydia','jenassa','aela'];
  for (let i=0;i<fols;i++) al.push({ name:fl[i][0].toUpperCase()+fl[i].slice(1), follower:true, fid:fl[i], dmg:8, hp:150, maxHp:150, red:0.2 });
  G.setAllyProvider(()=>al.map(a=>({...a})));
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
  if (ride) { if (!S.horse) HORSES.buy(S,'Frost','bay'); S.horse.mounted=true; S.horse.hp=HORSES.maxHp(S.horse); S.horse.away=null; } else if (S.horse) S.horse.mounted=false;
  S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const re=new RegExp(foeRe); const base=D.ENCOUNTERS.find(x=>re.test(x.name)) || D.ENCOUNTERS[0];
  const e={...base}; e.hp=(e.health||50)*6; e.health=e.hp; S.trip.status='encounter'; S.trip.encounter=G.scaleEnemy(e,30); __dbg.openEncounter();
  return base.name; }""" % json.dumps(LOOKS)
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove()); document.querySelectorAll('.tbtip').forEach(t=>t.classList.remove('on'))"
READ = """(()=>{ const c=document.querySelector('#tbf .fscene canvas'); if(!c||!c.dataset.fp) return null; const r=c.getBoundingClientRect();
  const p=document.querySelector('#tbf .c2ov .tbu.foe'), pr=p&&p.offsetParent?p.getBoundingClientRect():null;
  return { fp: JSON.parse(c.dataset.fp), cv:[r.left,r.top,r.width,r.height], vw: innerWidth, plate: pr?[pr.left,pr.top,pr.width,pr.height]:null, waves: TB.session&&TB.session.waves, wave: TB.session&&TB.session.wave }; })()"""

async def run(p, w, h, touch):
    kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
    b = await p.chromium.launch(**kw)
    for name, players, fols, ride, foeRe in CASES:
        tag = f"{w}x{h} {name}"
        ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=touch, is_mobile=touch)
        await ctx.add_init_script("try{localStorage.setItem('rotn_prefs',JSON.stringify({tips:false,obTips:false,obNext:false}))}catch(e){}")
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "404" not in m.text and "Failed to load" not in m.text else None)
        await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=fpos{w}{name}&tb&mountcombat"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Torvald"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate(SETUP, [players, fols, ride, foeRe]); await pg.wait_for_timeout(500)
        for _ in range(12):
            if await pg.evaluate("!!document.querySelector('#modal [data-act=enc][data-a=fight]')"): break
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('[data-act=openenc]')?.click() || __dbg.openEncounter()"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('#modal [data-act=enc][data-a=fight]')?.click()"); await pg.wait_for_timeout(1500)
        for _ in range(20):
            if await pg.evaluate("!document.querySelector('#tbf .tbskip')"): break
            await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(200)
        await pg.wait_for_timeout(1200); await pg.evaluate(CLEAN); await pg.mouse.move(2, 2)
        d = await pg.evaluate(READ)
        await pg.screenshot(path=OUT + f"{w}x{h}_{name}.png")
        ok(d is not None, f"{tag}: the scene publishes where everyone stands")
        if d:
            fp, (cl, ct, cw, ch), vw = d["fp"], d["cv"], d["vw"]
            k = cw / fp["W"]; X = lambda x: cl + x * k
            ok(fp["l"] <= 2 or touch, f"{tag}: band starts at the stage edge on a PC ({fp['l']})")
            ok(X(fp["l"]) >= -2 and X(fp["r"]) <= vw + 2, f"{tag}: the band is what's on screen ({X(fp['l']):.0f}..{X(fp['r']):.0f} of {vw})")
            xs = [("you", fp["h"][0]), ("foe", fp["f"][0])] + [(f"ally {i}", a[0]) for i, a in enumerate(fp["a"])] + [(f"waiting {i}", x[0]) for i, x in enumerate(fp["w"])]
            for who, x in xs: ok(8 <= X(x) <= vw - 8, f"{tag}: {who} on screen (x {X(x):.0f})")
            ok(fp["h"][0] < fp["f"][0], f"{tag}: you stand left of the foe")
            ok(len(fp["a"]) == players + fols, f"{tag}: every ally has a spot ({len(fp['a'])} of {players + fols})")
            ok(all(a[0] < fp["f"][0] for a in fp["a"]), f"{tag}: the company is on your side")
            ok(all(fp["gy"] - 40 <= a[1] <= fp["gy"] + 0.5 for a in fp["a"]), f"{tag}: allies' feet on the ground line or a row behind")
            if d["waves"] and d["waves"] > d["wave"] and not touch and name != "dragon":   # (a dragon fills the stage: the next one waits out of sight)
                ok(len(fp["w"]) >= 1, f"{tag}: the foes still to come stand behind it ({len(fp['w'])} of {d['waves'] - d['wave']})")
            ok(all(x[0] > fp["f"][0] for x in fp["w"]), f"{tag}: the waiting foes stand behind the foe")
            if d["plate"]:
                pl, pt, pw, ph = d["plate"]; fxp = X(fp["f"][0])
                ok(pl - 30 <= fxp <= pl + pw + 30 or pl + pw >= vw - 12, f"{tag}: the foe's plate is over the foe (plate {pl:.0f}..{pl + pw:.0f}, foe {fxp:.0f})")
        ok(not errs, f"{tag}: no page errors {errs[:3]}")
        await ctx.close()
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, 390, 844, True)
        await run(p, 1920, 1080, False)
    print("screenshots:", OUT)
    print("RESULT", "OK" if not fails else f"FAIL ({len(fails)})")
    if fails: sys.exit(1)
asyncio.run(main())
