"""Reward moments (rewards.js): a level-up that opens something new plays as one full-screen scene ("LEVEL 4 ·
Smithing unlocked") with a first-quest button, a stream of loot, gold and skill practice comes out as one quiet line
(item names in their rarity colour), and a big moment that happens mid-fight waits for the fight to end.
On a phone (390x844) and a PC (1920x1080). unlocks.js is stood in for by a small fake with its API.
Usage: python3 rewards_ui.py PORT [outdir]      BEFORE=1: only the shots, for a build without rewards.js"""
import asyncio, sys, os
from playwright.async_api import async_playwright
_SHOTS = (os.environ.get("SHOTS") or os.path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = (sys.argv[2] if len(sys.argv) > 2 else _SHOTS + "rewards").rstrip("/\\") + "/"
os.makedirs(OUT, exist_ok=True)
BEFORE = os.environ.get("BEFORE") == "1"
PRE = "rewards_before_" if BEFORE else "rewards_"
fails = []
def ok(c, m):
    if BEFORE: return
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

FAKE_UNLOCKS = """()=>{ window.UNLOCKS = {
  get: (id) => ({ smithing: { id: 'smithing', level: 4, name: 'Smithing' }, followers: { id: 'followers', level: 5, name: 'Followers and hirelings' } })[id] || null,
  justOpened: (s) => (s.level === 4 ? ['smithing'] : []),
  next: (s) => (s.level < 4 ? [{ id: 'smithing', level: 4, name: 'Smithing' }] : [{ id: 'followers', level: 5, name: 'Followers and hirelings' }]),
  open: () => true, on: () => () => {} }; }"""
FIGHT = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration']) S.skills[k].lvl=45;
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.lvn').forEach(m=>m.remove())"

async def run(p, name, vp, mobile):
    exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
    b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, has_touch=mobile, is_mobile=mobile)
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&hub=0&tb&p=rw{name}{'b' if BEFORE else ''}"); await pg.wait_for_timeout(1500)
    for _ in range(120):
        if await pg.query_selector("#nm"): break
        await pg.evaluate("(document.querySelector('.mi[data-t=new]')||document.querySelector('.press')||document.querySelector('#title'))?.click()"); await pg.wait_for_timeout(500)
    await pg.fill("#nm", "Sigrid"); await pg.evaluate("document.querySelector('#begin').click()")
    await pg.wait_for_function("window.__dbg && window.__dbg.save && window.__dbg.save()", timeout=60000); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
    await pg.evaluate(CLEAR)
    await pg.evaluate(FAKE_UNLOCKS)
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.discovered.push('Whiterun');
      S.level=3; S.charXp=0; S.pendingLevels=0; window.__ui.refresh(); }""")
    await pg.wait_for_timeout(800); await pg.evaluate(CLEAR)
    # 0) the preview under the level bar
    if not BEFORE:
        nx = await pg.evaluate("REWARDS.nextText(__dbg.save())")
        ok(nx == "Level 4 brings: Smithing · a perk point", f"{name}: preview: {nx!r}")
    await pg.evaluate("TABMENU.openHub()"); await pg.wait_for_timeout(900); await pg.evaluate(CLEAR)
    if not BEFORE:
        ok("Level 4 brings" in await pg.evaluate("document.querySelector('#tw .tw-next')?.textContent||''"), f"{name}: the compass level bar says what level 4 brings")
    await pg.screenshot(path=f"{OUT}{PRE}{name}_0_preview.png")
    await pg.evaluate("TABMENU.close ? TABMENU.close() : document.querySelector('#tw')?.remove()"); await pg.wait_for_timeout(500)
    # 1) level 3 -> 4: one big scene, not a LEVEL UP banner as well
    await pg.evaluate("""()=>{const S=__dbg.save(); S.charXp=F.charXpNeeded(S.level)-5; G.raiseSkill(S,'Smithing');}""")
    await pg.wait_for_timeout(3000)
    for _ in range(20):   # a quest window from walking into Whiterun may come first: the scene waits its turn behind it
        if BEFORE or await pg.evaluate("!!document.querySelector('#modal.rw-scene')"): break
        await pg.evaluate("document.querySelectorAll('#modal:not(.rw-scene)').forEach(m=>m.remove())"); await pg.wait_for_timeout(500)
    if BEFORE: await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(1200)
    if not BEFORE:
        t = await pg.evaluate("document.querySelector('#modal.rw-scene')?.innerText||''")
        ok("Smithing unlocked" in t and "LEVEL 4" in t.upper(), f"{name}: level-up scene: {t[:80]!r}")
        ok("START:" in t.upper() and "BLACKSMITH" in t.upper(), f"{name}: the scene offers the first smithing quest")
        ok(not await pg.evaluate("!!document.querySelector('#lvln .lvn-level')"), f"{name}: no LEVEL UP banner on top of the scene")
    await pg.screenshot(path=f"{OUT}{PRE}{name}_1_levelscene.png")
    if not BEFORE:
        await pg.click("#modal.rw-scene .rw-go"); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("!!__dbg.save().quests.intro_smith && __dbg.save().trackQ==='intro_smith'"), f"{name}: the first quest starts and is tracked")
        ok(not await pg.evaluate("!!document.querySelector('#modal.rw-scene')"), f"{name}: the scene closes")
    await pg.wait_for_timeout(2500); await pg.evaluate(CLEAR)
    # 2) a stream of loot, gold and skill practice
    item = await pg.evaluate("Object.entries(D.ITEMS).find(([k,v])=>v.slot==='weapon' && typeof CC!=='undefined' && CC.tier(k)==='superior')?.[1].name || 'Elven Sword'")
    await pg.evaluate(f"""async ()=>{{ const w=(ms)=>new Promise(r=>setTimeout(r,ms));
      __dbg.toast('You find 10 gold.'); await w(150); __dbg.toast('Looted: Iron Dagger'); await w(150);
      LEVELUP.emit && LEVELUP.emit('xp', {{ s: __dbg.save(), skill: 'One-Handed', xp: 6 }}); await w(150);
      __dbg.toast('You find 14 gold.'); await w(150); __dbg.toast('Looted: Iron Dagger'); await w(150);
      __dbg.toast('Looted: {item}'); await w(150); LEVELUP.emit && LEVELUP.emit('xp', {{ s: __dbg.save(), skill: 'One-Handed', xp: 9 }}); }}""")
    await pg.wait_for_timeout(1900)
    if not BEFORE:
        t = await pg.evaluate("document.querySelector('#toast')?.textContent||''")
        ok(t.startswith("+24 gold · +15 One-Handed") and "Iron Dagger ×2" in t and item in t, f"{name}: one quiet line: {t!r}")
        ok(await pg.evaluate("!!document.querySelector('#toast .rw-qn.q-superior')"), f"{name}: the better item's name is in its rarity colour")
    await pg.screenshot(path=f"{OUT}{PRE}{name}_2_tinyline.png")
    await pg.wait_for_timeout(3500)
    if BEFORE:
        await b.close(); return
    # 3) a big moment mid-fight waits for the fight
    await pg.evaluate(FIGHT); await pg.wait_for_timeout(600)
    await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove())")
    ok(await pg.evaluate("!!document.querySelector('#tbf') && !!TB.open"), f"{name}: a fight is on")
    await pg.evaluate("()=>{ const S=__dbg.save(); S.horse={ name:'Frost', id:'frost' }; }")
    await pg.wait_for_timeout(2500)
    ok(not await pg.evaluate("!!document.querySelector('#modal.rw-scene')"), f"{name}: your first horse waits while you fight")
    ok(await pg.evaluate("REWARDS.queued>0 && __dbg.save().rw.seen['h:1']!==1"), f"{name}: it is queued")
    await pg.screenshot(path=f"{OUT}{PRE}{name}_3_heldinfight.png")
    await pg.evaluate("TB.close(); document.querySelectorAll('#tbf').forEach(e=>e.remove()); document.querySelectorAll('#modal:not(.rw-scene)').forEach(m=>m.remove()); __dbg.save().trip=null; window.__ui.refresh()")
    for _ in range(20):
        if await pg.evaluate("!!document.querySelector('#modal.rw-scene')"): break
        await pg.evaluate("document.querySelectorAll('#modal:not(.rw-scene)').forEach(m=>m.remove())"); await pg.wait_for_timeout(400)
    t = await pg.evaluate("document.querySelector('#modal.rw-scene')?.innerText||''")
    ok("Frost" in t and "first horse" in t.lower(), f"{name}: after the fight the scene plays: {t[:60]!r}")
    ok(await pg.evaluate("document.querySelectorAll('#modal').length") == 1, f"{name}: one window at a time")
    await pg.screenshot(path=f"{OUT}{PRE}{name}_4_afterfight.png")
    await pg.click("#modal.rw-scene .rw-go"); await pg.wait_for_timeout(500)
    ok(not errs, f"{name}: no page errors {errs[:3]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        for name, vp, mob in [("phone", {"width": 390, "height": 844}, True), ("pc", {"width": 1920, "height": 1080}, False)]:
            await run(p, name, vp, mob)
    print("FAILED" if fails else "rewards_ui ok", len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
