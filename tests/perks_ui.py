"""Bigger perk trees + statuses on screen. Usage: python3 perks_ui.py PORT  — screenshots in tests/perks/, prints RESULT OK."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8843"
OUT = "/home/claude/tests/perks/"; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok  " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=1&fightanim&p=pk1"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate(clear)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=40; for (const k in S.skills) S.skills[k].lvl=75;
          S.perks={armsman:3,fighting_stance:1,critical_charge:1,bladesman:1,dual_flurry:1,novice_destruction:1,apprentice_destruction:1,augmented_flames:1,intense_flames:1,stealth:2,muffled_movement:1}; }""")
        for style in ["ink", "pixel"]:
            if style == "pixel": await pg.evaluate("ART.setStyle('pixel')")
            for sk in ["One-Handed", "Destruction", "Sneak", "Unarmored"]:
                await pg.evaluate("TABMENU.closeHub && TABMENU.closeHub(); __ui.go('stars')"); await pg.wait_for_timeout(500); await pg.evaluate(clear)
                await pg.evaluate(f"document.querySelector('#side .tw-card[data-id=\"{sk}\"]')?.click()"); await pg.wait_for_timeout(500); await pg.evaluate(clear)
                n = await pg.evaluate("document.querySelectorAll('#side .tw-big [data-sk-perk]').length")
                ok(n >= 9, f"{style} {sk}: {n} stars drawn")
                # labels must not overlap each other
                over = await pg.evaluate("""()=>{const L=[...document.querySelectorAll('#side .tw-big text.lbl')].map(t=>t.getBoundingClientRect()); let o=0;
                  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j]; if(a.left<b.right-2&&b.left<a.right-2&&a.top<b.bottom-2&&b.top<a.bottom-2)o++;} return o;}""")
                ok(over == 0, f"{style} {sk}: no overlapping labels ({over})")
                el = await pg.query_selector("#side .tw-big")
                if el: await el.screenshot(path=OUT + f"tree_{style}_{sk.replace(' ', '_')}.png")
            # old perk list screen too (Hero → Perks)
            await pg.evaluate("__ui.go('hero')"); await pg.wait_for_timeout(400); await pg.evaluate(clear)
            await pg.evaluate("document.querySelector('[data-act=pskill][data-id=\"Destruction\"]')?.click()"); await pg.wait_for_timeout(500)
            el = await pg.query_selector("#side .skc")
            if el: await el.screenshot(path=OUT + f"hero_tree_{style}.png")
            # a fight with statuses: fire mage vs you, your firebolt on a troll
            r = await pg.evaluate("""()=>{const S=__dbg.save(); S.spells=[...new Set([...(S.spells||[]),'firebolt','flames'])];
              const troll=D.ENCOUNTERS.find(e=>/troll/i.test(e.name)); const f=new G.Fight(S, G.scaleEnemy({...troll}, 20));
              f.rules=[{if:'always',do:'spell:firebolt'}]; f.ai=false; f.mp=9999; f.run({trySneak:false}); f.apply && 0;
              return {has: f.log.some(l=>l.st && l.st.foe && l.st.foe.burn), txt: f.log.map(l=>l.me).join(' ').slice(0,300), f};}""")
            ok(r["has"], f"{style}: burning shows in fight data")
            ok("burns for" in r["txt"], f"{style}: log says the troll burns")
            await pg.evaluate("""()=>{ const S=__dbg.save(); S.spells=[...new Set([...(S.spells||[]),'firebolt'])]; const troll=D.ENCOUNTERS.find(e=>/troll/i.test(e.name));
              const f=new G.Fight(S, G.scaleEnemy({...troll}, 20)); f.rules=[{if:'always',do:'spell:firebolt'}]; f.ai=false; f.mp=9999; f.hp=9999; f.run({trySneak:false});
              document.getElementById('pkbox')?.remove(); const b=document.createElement('div'); b.id='pkbox'; b.style.cssText='position:fixed;left:0;top:0;width:380px;z-index:9999;background:#111;padding:6px';
              document.body.appendChild(b); const d=document.createElement('div'); d.style.width='368px'; d.innerHTML=FIGHTART.placeholder(f, S); b.appendChild(d); FIGHTART.manual(true); }""")
            await pg.wait_for_timeout(300)
            await pg.evaluate("FIGHTART.advance(2600)"); await pg.wait_for_timeout(100)
            box = await pg.query_selector("#pkbox")
            if box: await box.screenshot(path=OUT + f"fight_burn_{style}.png")
            chips = await pg.evaluate("(()=>{ const c=document.querySelector('#pkbox canvas'); return !!c; })()")
            ok(chips, f"{style}: fight scene drawn")
            await pg.evaluate("FIGHTART.manual(false); document.getElementById('pkbox')?.remove()")
            await pg.evaluate(clear)
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL {len(fails)}")
asyncio.run(main())
