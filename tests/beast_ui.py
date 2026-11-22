# Werewolf and Vampire Lord: fight-scene forms (both art styles), the perk skies on the Hero tab and the compass
# Skills page, taking a perk, the cure quest in the Journal. python3 beast_ui.py [port]  → RESULT OK
import asyncio, sys, io
from playwright.async_api import async_playwright
from PIL import Image
PORT = sys.argv[1] if len(sys.argv) > 1 else "8839"
OUT = "/home/claude/tests/"

JS = r"""
window.__bx = {
  wipe(){ document.getElementById('bxbox')?.remove(); const b=document.createElement('div'); b.id='bxbox'; b.style.cssText='position:fixed;left:0;top:0;width:380px;z-index:9999;background:#111;padding:6px'; document.body.appendChild(b); return b; },
  fight(kind){
    const S=window.__dbg.save(); S.level=24; S.hpBonus=220; for (const k of Object.keys(S.skills)) S.skills[k].lvl=45; G.setHealth(S,G.maxHealth(S));
    S.werewolf = kind==='wolf' ? {since:0} : null; S.vampire = kind==='lord' ? {since:0, fedAt:G.now()} : null; S.beastAt=0; S.lordAt=0;
    S.beastPerks = {wolf:{bestial_strength:2,totem_terror:1,totem_predator:1,totem_ice_brothers:1}, lord:{power_grave:1,detect_all:1,blood_healing:1,vampiric_grip:1,night_cloak:1}, feeds:20, kills:20};
    const base=D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw');
    const f=new G.Fight(S,{...G.scaleEnemy(base,S.level), health:700, hp:700},[{if:'always',do: kind==='wolf'?'power:beast':'power:lord'},{if:'always',do:'attack'}]);
    f.allies=[]; f.run({trySneak:false, maxTurns:6}); return f;
  },
  mount(f){ const box=this.wipe(); const d=document.createElement('div'); d.style.width='368px'; d.innerHTML=FIGHTART.placeholder(f, window.__dbg.save()); box.appendChild(d); return d; },
};
"""

async def main():
    errs, fails = [], []
    def ok(c, m):
        print(("ok   " if c else "FAIL ") + m)
        if not c: fails.append(m)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 412, "height": 915}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?p=bx1&notut&fightanim"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal').forEach(m=>m.remove()),200)")
        await pg.evaluate(JS)
        # ---- the forms in the fight scene, both styles
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')"); await pg.evaluate("FIGHTART.manual(true)")
            for kind in ["wolf", "lord"]:
                log = await pg.evaluate(f"()=>{{ const f=__bx.fight('{kind}'); window.__cf=f; __bx.mount(f); return f.log.map(l=>l.me); }}")
                ok(("Beast Form" if kind == "wolf" else "Vampire Lord") in log[0], f"{kind} changes on turn 1: {log[0][:70]}")
                if kind == "lord": ok(any("drain life" in l for l in log), "the Lord drains: " + next((l for l in log if "drain life" in l), "")[:80])
                el = await pg.query_selector("#bxbox")
                shots, tprev = [], 0
                for t in [500, 1600, 2300, 3200, 4100]:
                    await pg.evaluate(f"FIGHTART.advance({t - tprev})"); tprev = t
                    shots.append(Image.open(io.BytesIO(await el.screenshot())))
                w, h = shots[0].size; sheet = Image.new("RGB", (w * len(shots), h), (17, 17, 17))
                for i, im in enumerate(shots): sheet.paste(im, (i * w, 0))
                sheet.save(OUT + f"beast_fight_{kind}_{style}.png")
            await pg.evaluate("FIGHTART.manual(false); document.getElementById('bxbox')?.remove()")
        await pg.evaluate("ART.setStyle('ink')")
        # ---- the Hero tab: werewolf sky, tap a star, take a perk
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.vampire=null; S.werewolf={since:0}; S.beastPerks={wolf:{},lord:{},feeds:5,kills:0}; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;}")
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(500)
        sky = await pg.query_selector("#side .bsky.wolf")
        ok(sky is not None, "werewolf sky on the Hero tab")
        if sky: await sky.scroll_into_view_if_needed()
        await pg.click("#side [data-act=bpick][data-id='wolf:bestial_strength']"); await pg.wait_for_timeout(300)
        ok("Beast Form hits" in await pg.inner_text("#side"), "tapping a star shows its perk")
        await pg.click("#side [data-act=bperk]"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("window.__dbg.save().beastPerks.wolf.bestial_strength") == 1, "took Bestial Strength")
        panel = await pg.query_selector("#side .bstars")
        if panel: await panel.screenshot(path=OUT + "beast_sky_wolf.png")
        ok("Purity of the Blood" in await pg.inner_text("#side"), "the cure quest shows on the werewolf panel")
        # ---- vampire: Lord sky on the Hero tab and in the compass Skills page, both styles
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.werewolf=null; S.vampire={since:0,fedAt:G.now()-7200*2.2}; S.beastPerks={wolf:{},lord:{power_grave:1,vampiric_grip:1},feeds:0,kills:9}; QUESTS.ensure(S);}")
        await pg.click("[data-tab=map]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(500)
        txt = await pg.inner_text("#side")
        ok("stage 3 of 4" in txt and "Rising at Dawn" in txt, "vampire panel: hunger stage and the cure quest")
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')"); await pg.wait_for_timeout(200)
            await pg.click("[data-tab=map]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(400)
            panel = await pg.query_selector("#side .bstars")
            if panel: await panel.screenshot(path=OUT + f"beast_sky_lord_{style}.png")
        await pg.evaluate("ART.setStyle('ink')")
        has_tab = await pg.evaluate("typeof TABMENU !== 'undefined'")
        if has_tab:
            await pg.evaluate("()=>{ TABMENU.starSkill='Vampire Lord'; window.__ui.go?.('stars'); }"); await pg.wait_for_timeout(600)
            ok(await pg.query_selector("#side .bsky.lord") is not None and await pg.query_selector("#side .tw-card.bcard.on") is not None, "Vampire Lord sky in the compass Skills page")
            await pg.screenshot(path=OUT + "beast_compass_lord.png")
        # ---- Tactics and Magic list the Lord
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(250); await pg.click("[data-act=tabgo][data-id=tactics]"); await pg.wait_for_timeout(300)
        ok("Vampire Lord" in await pg.inner_text("#side"), "Tactics offers Vampire Lord")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
asyncio.run(main())
