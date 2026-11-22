"""Gear looks in the browser: armour-set and weapon sheets in both art styles, two phones in a party seeing each other's real
gear (card code), travel picture, fight scene, Items 'Gear preview' and the Friends gear card. python3 gearlook_ui.py PORT"""
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8855"
OUT = "/home/claude/tests/gear/"
SETS = ["hd","fu","le","sd","cm","ir","bi","st","sp","sc","or","dw","el","gl","eb","da","ds","dp","sh","ch","bm","nc","an","fo","tg","ng","db","mr","ar","nm","mi","im","sk"]
WEAP = "dsamgbwpoxt"
GEAR_A = """() => { const S = window.__dbg.save(); for (const id of ['dwarven_sword','dwarven_armor','dwarven_helmet','spellbreaker','ancient_nord_boots','steel_gauntlets']) { if (!D.ITEMS[id]) continue; G.give(S, id); const r = S.inv.find(x => x.item === id); try { G.equip(S, r.id); } catch (e) {} } }"""
GEAR_B = """() => { const S = window.__dbg.save(); for (const id of ['steel_battleaxe','stormcloak_officer_armor','iron_helmet','hide_boots']) { if (!D.ITEMS[id]) continue; G.give(S, id); const r = S.inv.find(x => x.item === id); try { G.equip(S, r.id); } catch (e) {} } }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs = []; ok = True
        def check(c, m):
            nonlocal ok
            print(("ok  " if c else "FAIL") + " " + m); ok = ok and bool(c)
        for style in ["ink", "pixel"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=1)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            # ---- sheets
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " sheet " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?notut"); await pg.wait_for_timeout(2000)
            html = await pg.evaluate("""(sets)=>sets.map((m,i)=>`<div style="display:inline-block;width:100px;text-align:center;font:10px sans-serif;color:#000">${HEROART.figure({look:{r:['nord','imperial','dunmer','orc','altmer','redguard'][i%6],id:'gear'+i,eq:{},g:m+m+m+m+(['mr','ar','nm','mi','tg','ng','db'].includes(m)?'--':m)+'--f',gl:{}}},100,138)}<br>${GEARLOOK.label(m)}</div>`).join('')""", SETS)
            await pg.evaluate("(h)=>{document.body.innerHTML='<div style=\"background:#ddd;width:412px\">'+h+'</div>'}", html); await pg.wait_for_timeout(600)
            await pg.screenshot(path=f"{OUT}sets_{style}.png", full_page=True)
            whtml = await pg.evaluate("""(w)=>{ const mats=['ir','el','dw','da']; let out=''; for (const k of w) for (const m of mats) out+=`<div style="display:inline-block;width:100px">${HEROART.figure({look:{r:'nord',id:'w'+k+m,eq:{},g:'--'+m+'--'+m+('sdamp'.includes(k)?m:'--')+m+k,gl:{}}},100,138)}</div>`; return out; }""", WEAP)
            await pg.evaluate("(h)=>{document.body.innerHTML='<div style=\"background:#ddd;width:412px\">'+h+'</div>'}", whtml); await pg.wait_for_timeout(600)
            await pg.screenshot(path=f"{OUT}weapons_{style}.png", full_page=True)
            await pg.close()
            # ---- two phones in a party
            async def phone(tag, name):
                q = await ctx.new_page(); q.on("pageerror", lambda e: errs.append(style + " " + tag + " " + str(e)))
                await q.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=gl{style}{tag}"); await q.wait_for_timeout(1800)
                await q.click(".press"); await q.click(".mi[data-t=new]"); await q.fill("#nm", name); await q.click("#begin"); await q.wait_for_timeout(1200)
                await q.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
                return q
            async def clean(q): await q.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame').forEach(m => m.remove())")
            A = await phone("a", "Alfa"); B = await phone("b", "Beta")
            here = "() => { const S = window.__dbg.save(); S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; S.trip = null; S.level = 12; S.hpBonus = 80; G.setHealth(S, G.maxHealth(S)); }"
            for q in (A, B): await q.evaluate(here)
            await A.evaluate(GEAR_A); await B.evaluate(GEAR_B)
            look = await A.evaluate("HEROART.lookOf(window.__dbg.save())")
            check(isinstance(look.get("g"), str) and len(look["g"]) == 13 and look["g"].startswith("dwdw"), f"{style} card look carries the gear code {look.get('g')}")
            ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id")
            await A.evaluate(f"() => Store.put('parties', 'gl{style}', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}], invites: [], t: G.now() }})")
            for q in (A, B): await q.evaluate("() => window.__dbg.publish && window.__dbg.publish()")
            trip = "() => { const S = window.__dbg.save(); S.location = null; G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2)); window.__dbg.publish && window.__dbg.publish(); }"
            await A.evaluate(trip); await B.evaluate(trip)
            seen = False
            for _ in range(12):
                await A.wait_for_timeout(700)
                seen = await A.evaluate("() => (window.__dbg.others ? window.__dbg.others() : []).some(o => o.name === 'Beta' && o.look && o.look.g && o.look.g.startsWith('ir'))")
                if seen: break
            check(seen, f"{style} A sees B's gear code (iron helmet first)")
            for q, nm in ((A, "a"), (B, "b")):
                await clean(q); await q.click("[data-tab=map]"); await q.wait_for_timeout(1500)
                v = await q.query_selector(".tripvig canvas")
                if v: await v.screenshot(path=f"{OUT}travel_{style}_{nm}.png")
                check(v is not None, f"{style} travel picture on {nm}")
            # ---- a fight on A: hero drawn in dwarven gear; blows clank
            await A.evaluate("""() => { const S = window.__dbg.save(); const base = D.ENCOUNTERS.find(e => e.name === 'Bandit outlaw') || D.ENCOUNTERS[0];
                S.trip.status = 'encounter'; S.trip.encounter = { ...G.scaleEnemy(base, S.level), hold: 'Whiterun', danger: base.danger }; window.__dbg.publish && window.__dbg.publish(); }""")
            await A.wait_for_timeout(800)
            await clean(A); await A.click("[data-tab=map]"); await A.wait_for_timeout(400)
            if await A.query_selector("[data-act=openenc]"): await A.click("[data-act=openenc]")
            await A.wait_for_timeout(400)
            if await A.query_selector("[data-act=enc][data-a=fight]"):
                await A.click("[data-act=enc][data-a=fight]"); await A.wait_for_timeout(1500)
                el = await A.query_selector("#modal .fscene")
                if el:
                    await el.screenshot(path=f"{OUT}fight_{style}.png"); await A.wait_for_timeout(2200); await el.screenshot(path=f"{OUT}fight2_{style}.png")
                check(el is not None, f"{style} fight scene")
                rec = await A.evaluate("(() => { try { const s = window.__dbg.save(); return GEARLOOK.slotsOf(HEROART.lookOf(s)).chest.m } catch (e) { return String(e) } })()")
                check(rec == "dw", f"{style} hero gear in fight = {rec}")
            await clean(A)
            # ---- Items menu: Gear preview
            await A.evaluate("() => { const S = window.__dbg.save(); G.give(S, 'iron_helmet'); G.give(S, 'steel_battleaxe'); }")
            opened = await A.evaluate("""() => { try { window.__ui.openMenu && window.__ui.openMenu('items'); } catch (e) {} return !!document.querySelector('#sky, .sky'); }""")
            if not opened:
                await clean(A)
                for sel in ["[data-act=skyopen]", "[data-act=menu]", "[data-tab=pack]"]:
                    if await A.query_selector(sel): await A.click(sel); await A.wait_for_timeout(500); break
            sel = await A.evaluate("""() => { const S = window.__dbg.save(); const r = S.inv.find(x => x.item === 'steel_battleaxe'); const b = document.querySelector(`[data-act=skysel][data-id="${r.id}"]`); if (b) { b.click(); return true } return false }""")
            if not sel:
                await A.evaluate("() => { const b = document.querySelector('[data-act=skycat][data-id=weapons]') || document.querySelector('[data-act=skycat][data-id=all]'); b && b.click(); }"); await A.wait_for_timeout(400)
                sel = await A.evaluate("""() => { const S = window.__dbg.save(); const r = S.inv.find(x => x.item === 'steel_battleaxe'); const b = document.querySelector(`[data-act=skysel][data-id="${r.id}"]`); if (b) { b.click(); return true } return false }""")
            await A.wait_for_timeout(500)
            box = await A.query_selector(".gearprev-box")
            check(box is not None, f"{style} Gear preview in the Items menu (row found: {sel})")
            if box: await box.screenshot(path=f"{OUT}preview_{style}.png")
            # ---- Friends: B's gear card on A
            await clean(A); await A.evaluate("() => { try { window.__ui.closeMenu() } catch (e) {} }"); await A.wait_for_timeout(300)
            card = await A.evaluate("""() => { const o = (window.__dbg.others ? window.__dbg.others() : []).find(o => o.name === 'Beta'); if (!o) return null; const div = document.createElement('div'); div.id = 'gtest'; div.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#222;color:#eee;width:380px;padding:8px'; div.innerHTML = window.__gearCard ? window.__gearCard(o) : ''; document.body.appendChild(div); const d = div.querySelector('details'); if (d) d.open = true; return div.innerHTML.length }""")
            if card:
                await A.wait_for_timeout(400); el = await A.query_selector("#gtest")
                if el: await el.screenshot(path=f"{OUT}card_{style}.png")
            check(card and card > 100, f"{style} Friends gear card renders ({card})")
            await ctx.close()
        await b.close()
        check(not errs, "no page errors " + str(errs[:3]))
        print("RESULT OK" if ok else "RESULT FAIL")
asyncio.run(main())
