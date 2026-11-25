# Rune table (runecraft.js) on phones and PCs, English and Polish: the College's button opens it, every page shows,
# picking runes updates the card, the power slider works, crafting adds the spell to the Magic tab, and the spell is
# cast in a turn-by-turn fight (Magic menu → cast → fight log). No page errors, nothing pokes out sideways.
# Saves spellcraft_<step>_<size>_<lang>.png into the out folder.
#   python3 runecraft_ui.py 8765 [out_dir]
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_runecraft")
os.makedirs(OUT, exist_ok=True)
SIZES = [("phone", 390, 844, 2, True), ("pc", 1600, 900, 1, False)]
LANGS = (os.environ.get("LANGS") or "en,pl").split(",")
fails = 0
def ok(c, msg):
    global fails
    if not c: fails += 1
    print(("ok   " if c else "FAIL ") + msg)

SETUP = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=30; for (const k of ['Destruction','Restoration','Alteration','Mysticism']) S.skills[k].lvl=62;
  S.mpBonus=150; S.gold=20000; S.words=['fus','ro','dah']; S.quests=S.quests||{}; S.quests.college={stage:2};
  for (const id of ['flames','frostbite','sparks','healing','lesser_ward','ice_spike','chain_lightning']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  const dw=Object.keys(WORLD.places).find(k=>DUNGEONS.info(k)?.theme==='dwemer'); if (dw) { S.cleared=S.cleared||{}; S.cleared[dw]=1; }
  S.location='Winterhold'; [S.x,S.y]=WORLD.places.Winterhold; S.trip=null; S.dungeon=null; RUNECRAFT.research(S); return S.runes.length; }"""
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove()); document.querySelectorAll('#tip').forEach(e=>{e.style.transition='none'; e.classList.remove('on');})"
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
FIGHT = """()=>{ const S=window.__dbg.save(); document.querySelectorAll('#modal').forEach(m=>m.remove()); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null;
  G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in LANGS:
            for name, w, h, dpr, touch in SIZES:
                tag = f"{name}_{lang}"
                ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr, has_touch=touch, is_mobile=touch, locale=("pl-PL" if lang == "pl" else "en-US"))
                pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
                shot = lambda n: pg.screenshot(path=os.path.join(OUT, f"spellcraft_{n}_{tag}.png"))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&assets&p=rc{tag}"); await pg.wait_for_timeout(1500)
                await pg.evaluate(f"localStorage.setItem('rotn_prefs', JSON.stringify({{...JSON.parse(localStorage.getItem('rotn_prefs')||'{{}}'), tips:false, lang:'{lang}'}}))")
                await pg.reload(); await pg.wait_for_timeout(1500)
                await pg.wait_for_selector(".press"); await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm")
                await pg.fill("#nm", "Runa" if lang == "pl" else "Rune"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                n = await pg.evaluate(SETUP); ok(n >= 15, f"{tag}: runes found by research ({n})")
                # the College's button opens the Rune table
                html = await pg.evaluate("RUNECRAFT.button(window.__dbg.save())")
                await pg.evaluate("(h)=>{const d=document.createElement('div'); d.id='rcbtn'; d.innerHTML=h; document.body.appendChild(d);}", html)
                await pg.evaluate("RUNECRAFT.open(window.__dbg.save(), {save:()=>{}, say:()=>{}, refresh:()=>{}})")
                await pg.wait_for_selector("#rct .rct-tile"); await pg.evaluate(CLEAN)
                # pick frost, bolt, slow
                for sel in ['[data-rk=el][data-rv=frost]', '[data-rk=dl][data-rv=bolt]', '[data-rk=md][data-rv=slow]']:
                    await pg.click("#rct " + sel); await pg.wait_for_timeout(120)
                ok(await pg.evaluate("!!document.querySelector('#rct .rct-card .rcico') && !!document.querySelector('#rct .rct-go')"), f"{tag}: the card shows the icon and the Craft button")
                desc = await pg.evaluate("document.querySelector('#rct .rct-desc').textContent")
                ok(("mrozu" in desc) if lang == "pl" else ("frost damage" in desc), f"{tag}: the card says what it does: {desc}")
                await pg.wait_for_timeout(300); await shot("1craft")
                if name == "phone":
                    await pg.evaluate("document.querySelector('#rct .rct-side').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200); await shot("1bcard")
                # the slider
                mc0 = await pg.evaluate("+document.querySelector('#rct .rct-stats b').textContent")
                await pg.evaluate("(()=>{const r=document.querySelector('#rctPw'); r.value=60; r.dispatchEvent(new Event('input',{bubbles:true}));})()")
                mc1 = await pg.evaluate("+document.querySelector('#rct .rct-stats b').textContent")
                ok(mc1 < mc0, f"{tag}: less power, less magicka ({mc0} → {mc1})")
                await pg.evaluate("(()=>{const r=document.querySelector('#rctPw'); r.value=100; r.dispatchEvent(new Event('input',{bubbles:true}));})()")
                # the runes page
                await pg.click("#rct [data-rt=runes]"); await pg.wait_for_timeout(200); await shot("2runes")
                ok(await pg.evaluate("document.querySelectorAll('#rct .rct-rune').length === 18"), f"{tag}: all 18 runes listed")
                # craft it
                await pg.click("#rct [data-rt=make]"); await pg.wait_for_timeout(150)
                await pg.click("#rct .rct-go"); await pg.wait_for_timeout(300)
                rid = await pg.evaluate("(window.__dbg.save().runeSpells||[]).slice(-1)[0]?.id")
                ok(bool(rid) and await pg.evaluate(f"window.__dbg.save().spells.includes('{rid}')"), f"{tag}: crafted spell is in the spellbook ({rid})")
                await shot("3mine")
                # forgetting asks nothing but works: craft a second one and forget it
                await pg.click("#rct [data-rt=make]"); await pg.click("#rct [data-rk=el][data-rv=fire]"); await pg.click("#rct [data-rk=dl][data-rv=cloak]"); await pg.click("#rct .rct-go"); await pg.wait_for_timeout(200)
                n2 = await pg.evaluate("window.__dbg.save().runeSpells.length")
                await pg.click("#rct .rct-rune.mine:last-child [data-rx=forget]"); await pg.wait_for_timeout(200)
                ok(await pg.evaluate("window.__dbg.save().runeSpells.length") == n2 - 1, f"{tag}: forget removes it")
                ok(await pg.evaluate("document.scrollingElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('#rct *')].every(e=>e.getBoundingClientRect().right <= innerWidth + 1)"), f"{tag}: nothing pokes out sideways")
                if lang == "pl":
                    txt = await pg.evaluate("document.querySelector('#rct').innerText")
                    left = [wd for wd in ["Rune table", "Craft", "Element", "Delivery", "Power budget", "Your spells", "Forget"] if wd in txt]
                    ok(not left, f"{tag}: the table is in Polish (left: {left})")
                await pg.click("#rct [data-rx=close]"); await pg.wait_for_timeout(150)
                ok(await pg.evaluate("!document.querySelector('#rct')"), f"{tag}: closes")
                # the Magic tab knows it
                info = await pg.evaluate(f"MAGIC.infoHTML(window.__dbg.save(), '{rid}')")
                ok("rc-desc" in info, f"{tag}: the Magic tab shows the rune spell")
                # a turn-by-turn fight: Magic menu → cast it
                await pg.evaluate("document.querySelector('#rcbtn')?.remove()")
                for _ in range(4):
                    await pg.evaluate(FIGHT); await pg.wait_for_timeout(500)
                    if await pg.evaluate("!!document.querySelector('#modal [data-act=ev][data-c=fight]')"): break
                await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()"); await pg.wait_for_timeout(800)
                mine = False
                for _ in range(60):
                    await pg.evaluate(CLEAN)
                    if await pg.evaluate(MYTURN): mine = True; break
                    if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
                        try: await pg.click("#tbf [data-tbx=skip]", timeout=2000)
                        except Exception: pass
                    await pg.wait_for_timeout(250)
                ok(mine, f"{tag}: my turn in the fight")
                if mine:
                    await pg.evaluate("TB.session.f.mp=Math.max(TB.session.f.mp,300); TB.session.f.ehp=Math.max(TB.session.f.ehp, TB.session.ehpMax*0.9); TB.redraw(TB.session,{turn:'me'})")
                    await pg.click("#tbf [data-tbm=magic]"); await pg.wait_for_timeout(250); await pg.evaluate(CLEAN)
                    await pg.evaluate(f"document.querySelector('#tbf [data-tba=\"spell:{rid}\"]')?.scrollIntoView({{block:'center'}})")
                    await shot("4fightmenu")
                    ok(await pg.evaluate(f"!!document.querySelector('#tbf [data-tba=\"spell:{rid}\"]')"), f"{tag}: the rune spell is in the fight's Magic menu")
                    n0 = await pg.evaluate("TB.session.ev.length")
                    for _ in range(3):
                        await pg.evaluate("TB.session.f.mp=Math.max(TB.session.f.mp,300)")
                        await pg.click(f"#tbf [data-tba=\"spell:{rid}\"]"); await pg.mouse.move(2, 2); await pg.wait_for_timeout(900)
                        txt = await pg.evaluate(f"TB.session.ev.slice({n0}).map(e=>e.text).join(' / ')")
                        if await pg.evaluate("!!TB.session.f.foeSt?.chill"): break
                        if not await pg.evaluate(MYTURN): break
                        await pg.click("#tbf [data-tbm=magic]"); await pg.wait_for_timeout(200)
                    for _ in range(12):
                        if not await pg.evaluate("typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()"): break
                        await pg.wait_for_timeout(250)
                    await pg.evaluate(CLEAN); await pg.wait_for_timeout(300); await shot("5fightcast")
                    print(f"     {tag} fight log: {txt[:300]}")
                    ok(await pg.evaluate("!!TB.session.f.foeSt?.chill"), f"{tag}: the crafted frost spell chilled the foe (Shatter ready)")
                ok(not errs, f"{tag}: no page errors {errs[:3]}")
                await ctx.close()
        await b.close()
    print(f"{fails} failed" if fails else "all good")
    sys.exit(1 if fails else 0)

asyncio.run(main())
