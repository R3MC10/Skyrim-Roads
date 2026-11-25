"""The fight hotbar (hotbar.js): 10 slots, keys 1-0, set up by the player. Plays a real fight on a phone (390x844, touch)
and a PC (1440x900): the bar shows 10 numbered slots filled from the hero and fits the screen; Edit (the … menu, or a tap on an
empty slot) opens the picker; tap a slot then a spell puts it there; tap two slots swaps them; on a PC dragging a
move onto a slot and a slot off the bar works; the layout is kept in the save; pressing 3 casts the spell in slot 3; a key
pressed while typing (or with the … menu open) does nothing; on screen the slots read 1-0 row by row. Phones 360/390/412 wide and PCs: the bar fits the b276
fight layout (above the bottom edge, clear of your orb), and resting on / holding a slot still shows the move preview.
Screenshots go to the system temp folder (SHOTS=folder: there instead), never into tests/.
  node serve.js 8765 ../game &   then   python hotbar_ui.py 8765"""
import asyncio, sys, os, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
SHOTS = os.environ.get("SHOTS")
OUT = SHOTS or os.path.join(tempfile.gettempdir(), "rotn_hotbar")
os.makedirs(OUT, exist_ok=True)
SIZES = [(360, 780), (390, 844), (412, 915), (1440, 900), (1920, 1080)]
fails = 0
def ok(c, msg):
    global fails
    if not c: fails += 1
    print(("ok   " if c else "FAIL ") + msg)

START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration']) S.skills[k].lvl=45;
  S.mpBonus=120; for (const id of ['flames','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  delete S.hotbar; G.give(S,'potion_health',3); S.dungeon=null; S.trip=null; S.follower=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip,#fhints').forEach(e=>e.remove()); document.querySelectorAll('#tip,.tip').forEach(e=>{e.style.transition='none'; e.classList.remove('on');})"
FIT = """(()=>{ const b=[...document.querySelectorAll('#tbf .hb-bar [data-hbs]')].map(e=>e.getBoundingClientRect());
  const side=[...document.querySelectorAll('#tbf .hb-side > *')].map(e=>e.getBoundingClientRect());
  const all=[...b,...side]; const over=(r,q)=>r.left<q.right-1&&q.left<r.right-1&&r.top<q.bottom-1&&q.top<r.bottom-1;
  let clash=0; for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++) if(over(all[i],all[j])) clash++;
  const orb=document.querySelector('#tbf .c2ov .tbu.me .c2orb')?.getBoundingClientRect(); const barTop=Math.min(...all.map(r=>r.top));
  return { orbClear: !orb || !orb.height || orb.bottom <= barTop + 2, n:b.length, inside: all.every(r=>r.left>=0&&r.right<=innerWidth+0.5&&r.bottom<=innerHeight+0.5&&r.width>20), clash, wide: document.scrollingElement.scrollWidth<=innerWidth+1, w: Math.round(Math.min(...b.map(r=>r.width))) }; })()"""
ONSCREEN = """(()=>{ const s=[...document.querySelectorAll('#tbf .hb-bar [data-hbs]')].map(e=>({r:e.getBoundingClientRect(),k:e.querySelector('.fc-k')?.textContent||'?'}));
  s.sort((a,b)=>Math.abs(a.r.top-b.r.top)>a.r.height/2 ? a.r.top-b.r.top : a.r.left-b.r.left); return s.map(x=>x.k).join(''); })()"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, h) in SIZES:
            tag = f"{w}x{h}"; phone = w < 900
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=phone)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            bad = []; pg.on("requestfailed", lambda r: bad.append(r.url) if "localhost" in r.url or "127.0.0.1" in r.url else None)
            async def shot(n):
                await pg.evaluate(CLEAN)
                await pg.screenshot(path=os.path.join(OUT, f"hotbar_{tag}_{n}.png"))
            async def my_turn():
                for _ in range(80):
                    await pg.evaluate(CLEAN)
                    if await pg.evaluate(MYTURN): return True
                    if await pg.evaluate("!!TB.session?.done"): return False
                    if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
                        try: await pg.click("#tbf [data-tbx=skip]", timeout=3000)
                        except Exception: pass
                    await pg.wait_for_timeout(250)
                return False
            async def tap(sel):
                if phone: await pg.tap(sel)
                else: await pg.click(sel)
            async def evn(): return await pg.evaluate("TB.session ? TB.session.ev.length : 0")
            async def slots(): return await pg.evaluate("HOTBAR.layout(TB.session.f.s, TB.session.f)")
            async def open_edit():
                if await pg.evaluate("!!document.querySelector('#tbf .fdc-mb')"):
                    await tap("#tbf .fdc-mb"); await pg.wait_for_timeout(200)
                await tap("#tbf [data-tbx=hbedit]"); await pg.wait_for_timeout(300)
            for _ in range(5):   # a busy local server sometimes drops a script: load again rather than test half a game
                bad.clear(); errs.clear(); await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=hb{w}&tb"); await pg.wait_for_timeout(2000)
                if not bad and await pg.evaluate("typeof ENC!=='undefined' && typeof HOTBAR!=='undefined' && typeof POWERS!=='undefined' && typeof COMBAT2!=='undefined'"):
                    try: await pg.wait_for_selector(".press", timeout=15000); break
                    except Exception: pass
                print("   reload, missing:", [u.split('/')[-1] for u in bad[:4]])
            await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Tester"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
            for _ in range(3):   # the event window can redraw under a click: press Fight from the page itself (set it up again if it never shows)
                await pg.evaluate(START); await pg.wait_for_timeout(500)
                for _ in range(6):
                    if await pg.evaluate("!!document.querySelector('#tbf')"): break
                    await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()"); await pg.wait_for_timeout(400)
                if await pg.evaluate("!!document.querySelector('#tbf')"): break
            await pg.wait_for_timeout(300)
            ok(await my_turn(), f"{tag}: the fight starts on your turn")
            # ---- the bar
            fit = await pg.evaluate(FIT)
            ok(fit["n"] == 10, f"{tag}: 10 slots ({fit['n']})")
            ok(fit["inside"] and fit["clash"] == 0 and fit["wide"], f"{tag}: the bar and its buttons fit the screen, nothing overlaps {fit}")
            ok(fit["orbClear"], f"{tag}: your health orb stays above the bar {fit}")
            ok(fit["w"] >= 38, f"{tag}: slots stay thumb-sized ({fit['w']}px)")
            keys = await pg.evaluate("[...document.querySelectorAll('#tbf .hb-bar [data-hbs]')].map(e=>e.querySelector('.fc-k')?.textContent).join('')")
            ok(keys == "1234567890", f"{tag}: slots numbered 1-0 ({keys})")
            # on screen (row by row, left to right) the slots read 1-0 too: no CSS grid spot pulls one out of line (layout-3)
            seen = await pg.evaluate(ONSCREEN)
            L = await slots()
            ok(seen == "1234567890", f"{tag}: slots sit in key order on screen ({seen}; Catch your breath in slot {L.index('recover') + 1 if 'recover' in L else '-'})")
            ok(L[0] == "attack" and L[1] == "power_attack" and sum(1 for a in L if a) >= 6, f"{tag}: the bar fills itself from the hero {L}")
            ok("spell:flames" in L and "potion:health" in L, f"{tag}: the default holds your attack spell and a health potion")
            badge = await pg.evaluate("document.querySelector('#tbf .hb-bar [data-tba=\"potion:health\"] .fc-n')?.textContent")
            have = await pg.evaluate("String(HOTBAR.potCount(TB.session.f.s, TB.session.f, 'health'))")
            ok(badge == have and int(have) >= 3, f"{tag}: the potion slot shows how many you have ({badge}/{have})")
            await shot("1_bar")
            # greyed out when you can't pay: no magicka
            await pg.evaluate("TB.session.f.mp=0; document.querySelector('#tbf [data-tbm=magic]').click()"); await pg.wait_for_timeout(150)
            await pg.evaluate("document.querySelector('#tbf [data-tbm=\"\"]')?.click()"); await pg.wait_for_timeout(200)
            g = await pg.evaluate("(()=>{const b=document.querySelector('#tbf .hb-bar [data-tba=\"spell:flames\"]'); return b && [b.disabled, b.querySelector('.fc-why')?.textContent||'', !!b.querySelector('.cp')]})()")
            ok(g and g[0] and "magicka" in g[1] and g[2], f"{tag}: a spell you can't pay for is greyed out, says why and still shows its cost {g}")
            await shot("1b_grey")
            await pg.evaluate("TB.session.f.mp=G.maxMagicka(TB.session.f.s)")
            # ---- the move preview (movepreview.js) still works on a slot: rest the mouse on it (PC) or hold a finger on it (phone)
            sel1 = '#tbf .hb-bar [data-tba="attack"]'
            if phone:
                await pg.evaluate("""(()=>{const b=document.querySelector('#tbf .hb-bar [data-tba="attack"]'); const r=b.getBoundingClientRect();
                  b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:7,clientX:r.left+10,clientY:r.top+10,isPrimary:true}));})()""")
                await pg.wait_for_timeout(900)
            else:
                await pg.hover(sel1); await pg.wait_for_timeout(300)
            pv = await pg.evaluate("[!!document.querySelector('#tbf.mpv-on'), document.querySelectorAll('#tbf .mpv').length, !!document.querySelector('#tbf .hb-edit')]")
            ok(pv[0] and pv[1] > 0 and not pv[2], f"{tag}: {'holding' if phone else 'resting the mouse on'} a slot shows the move preview (and doesn't open edit mode) {pv}")
            await shot("1c_preview")
            if phone: await pg.evaluate("window.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerType:'touch',pointerId:7}))")
            else: await pg.mouse.move(2, 2)
            await pg.wait_for_timeout(200)
            ok(await pg.evaluate("!document.querySelector('#tbf.mpv-on')"), f"{tag}: letting go clears the preview")
            # ---- edit: open from the … menu
            await open_edit()
            ok(await pg.evaluate("!!document.querySelector('#tbf .hb-edit .hb-list [data-hbp]') && document.querySelectorAll('#tbf .hb-edit .hb-slot').length===10"), f"{tag}: Edit hotbar opens the picker and the 10 slots")
            tabs = await pg.evaluate("[...document.querySelectorAll('#tbf .hb-tab')].map(e=>e.firstChild.textContent).join(',')")
            ok(tabs == "Weapons,Spells,Shouts,Items,Abilities", f"{tag}: picker categories ({tabs})")
            await shot("2_edit")
            # tap slot 3, then Spells, then Healing -> slot 3 holds Healing
            await tap('#tbf .hb-slot[data-hbs="2"]'); await pg.wait_for_timeout(150)
            await tap('#tbf .hb-tab[data-hbtab="spells"]'); await pg.wait_for_timeout(150)
            await tap('#tbf [data-hbp="spell:healing"]'); await pg.wait_for_timeout(200)
            L = await slots()
            ok(L[2] == "spell:healing", f"{tag}: tap a slot, then a spell, puts it there {L[2]}")
            # put Flames in slot 3 again (it moves from where it was: the two trade places)
            was = L.index("spell:flames") if "spell:flames" in L else -1
            await tap('#tbf .hb-slot[data-hbs="2"]'); await pg.wait_for_timeout(150)
            await tap('#tbf [data-hbp="spell:flames"]'); await pg.wait_for_timeout(200)
            L2 = await slots()
            ok(L2[2] == "spell:flames" and L2.count("spell:flames") == 1 and (was < 0 or L2[was] == "spell:healing"), f"{tag}: a move already on the bar trades places {L2}")
            # swap slots 1 and 2 by tapping both
            await tap('#tbf .hb-slot[data-hbs="0"]'); await pg.wait_for_timeout(150)
            await tap('#tbf .hb-slot[data-hbs="1"]'); await pg.wait_for_timeout(200)
            L3 = await slots()
            ok(L3[0] == L2[1] and L3[1] == L2[0], f"{tag}: tapping two slots swaps them {L3[:2]}")
            await tap('#tbf .hb-slot[data-hbs="0"]'); await pg.wait_for_timeout(150)
            await tap('#tbf .hb-slot[data-hbs="1"]'); await pg.wait_for_timeout(200)   # back again
            if not phone:   # mouse: drag a potion onto slot 10, drag slot 10 off the bar
                await pg.click('#tbf .hb-tab[data-hbtab="items"]'); await pg.wait_for_timeout(150)
                src = await pg.query_selector('#tbf [data-hbp="potion:magicka"]'); dst = await pg.query_selector('#tbf .hb-slot[data-hbs="9"]')
                s0 = await src.bounding_box(); d0 = await dst.bounding_box()
                await pg.mouse.move(s0["x"] + 20, s0["y"] + 15); await pg.mouse.down(); await pg.mouse.move(s0["x"] + 60, s0["y"] - 40, steps=4)
                await pg.mouse.move(d0["x"] + d0["width"] / 2, d0["y"] + d0["height"] / 2, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(300)
                ok((await slots())[9] == "potion:magicka", f"{tag}: dragging a move onto a slot puts it there")
                d0 = await (await pg.query_selector('#tbf .hb-slot[data-hbs="9"]')).bounding_box()
                await pg.mouse.move(d0["x"] + 20, d0["y"] + 20); await pg.mouse.down(); await pg.mouse.move(d0["x"], d0["y"] - 60, steps=4)
                await pg.mouse.move(w / 2, 120, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(300)
                ok((await slots())[9] is None, f"{tag}: dragging a slot off the bar clears it")
                d1 = await (await pg.query_selector('#tbf .hb-slot[data-hbs="0"]')).bounding_box(); d2 = await (await pg.query_selector('#tbf .hb-slot[data-hbs="1"]')).bounding_box()
                L4 = await slots()
                await pg.mouse.move(d1["x"] + 20, d1["y"] + 20); await pg.mouse.down(); await pg.mouse.move(d2["x"] + 20, d2["y"] + 20, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(300)
                L5 = await slots()
                ok(L5[0] == L4[1] and L5[1] == L4[0], f"{tag}: dragging a slot onto another swaps them")
                await pg.mouse.move(d1["x"] + 20, d1["y"] + 20); await pg.mouse.down(); await pg.mouse.move(d2["x"] + 20, d2["y"] + 20, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("Array.isArray(window.__dbg.save().hotbar) && window.__dbg.save().hotbar[2]==='spell:flames'"), f"{tag}: the layout is kept in the hero's save")
            await shot("3_edited")
            await tap("#tbf [data-hbx=done]"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("!document.querySelector('#tbf .hb-edit') && document.querySelectorAll('#tbf .hb-bar [data-hbs]').length===10"), f"{tag}: Done goes back to the bar")
            await shot("4_custom")
            # ---- keys: 3 casts Flames (the spell now in slot 3)
            await pg.evaluate("TB.session.f.mp=G.maxMagicka(TB.session.f.s)")
            await pg.evaluate("document.querySelector('#tbf [data-tbm=magic]').click()"); await pg.wait_for_timeout(150)
            await pg.evaluate("document.querySelector('#tbf [data-tbm=\"\"]')?.click()"); await pg.wait_for_timeout(200)
            mp0 = await pg.evaluate("TB.session.f.mp"); n0 = await evn()
            await pg.mouse.move(2, 2); await pg.keyboard.press("3"); await pg.wait_for_timeout(500)
            cast = await pg.evaluate(f"TB.session.ev.slice({n0}).some(e=>e.a==='spell:flames') || TB.session.f.mp < {mp0} - 1")
            ok(cast, f"{tag}: pressing 3 casts the spell in slot 3")
            ok(await my_turn(), f"{tag}: and the turn comes back")
            # typing in a field: nothing fires
            await pg.evaluate("(()=>{const i=document.createElement('input'); i.id='hbchat'; i.style.cssText='position:fixed;top:60px;left:10px;z-index:9999'; document.body.appendChild(i); i.focus();})()")
            n0 = await evn(); sp0 = await pg.evaluate("TB.session.f.sp")
            await pg.keyboard.type("1230"); await pg.wait_for_timeout(500)
            ok(await evn() == n0 and await pg.evaluate(f"TB.session.f.sp==={sp0}") and await pg.evaluate("document.querySelector('#hbchat').value==='1230'"), f"{tag}: number keys typed into a field do nothing in the fight")
            await pg.evaluate("document.querySelector('#hbchat').remove(); document.activeElement?.blur()")
            # with the … menu open: nothing fires
            if await pg.evaluate("!!document.querySelector('#tbf .fdc-mb')"):
                await tap("#tbf .fdc-mb"); await pg.wait_for_timeout(200)
                n0 = await evn(); await pg.keyboard.press("1"); await pg.wait_for_timeout(400)
                ok(await evn() == n0, f"{tag}: with the … menu open, a number key does nothing")
                if await pg.evaluate("FIGHTDC.menuOpen"): await tap("#tbf .fdc-mb"); await pg.wait_for_timeout(200)
            # and 1 works again with nothing open
            await my_turn()
            pre = await pg.evaluate("JSON.stringify([TB.session.ev.length, TB.session.f.sp, TB.session.round, TB.session.ev.at(-1)?.a])")
            await pg.keyboard.press("1"); await pg.wait_for_timeout(500)
            post = await pg.evaluate("JSON.stringify([TB.session.ev.length, TB.session.f.sp, TB.session.round, TB.session.ev.at(-1)?.a])")
            ok(pre != post, f"{tag}: with nothing open, 1 uses slot 1 {pre} -> {post}")
            ok(not errs, f"{tag}: no page errors {errs[:3]}")
            await ctx.close()
        await b.close()
    print(f"{fails} FAILED" if fails else "ALL OK")
    sys.exit(1 if fails else 0)
asyncio.run(main())
