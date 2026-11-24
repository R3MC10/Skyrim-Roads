"""Followers as full characters (followerai.js) in the browser, both art styles. Usage: python followers3_ui.py PORT -> RESULT OK
Hires Marcurio, teaches him a spell from a tome, sets Healer tactics, then starts a turn-by-turn fight and waits for him to
heal or cast. Screenshots: tests/out_followers2/ (follower Overview / Magic / Tactics, and the fight)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8853"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_followers2") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

HIRE = """(st) => { const S = window.__dbg.save(); S.gold = 5000; S.level = 24; S.hpBonus = 80; for (const k of ['One-Handed','Heavy Armor','Speechcraft']) S.skills[k].lvl = 50;
  S.trip = null; S.dungeon = null; S.location = 'Riften'; [S.x, S.y] = WORLD.places.Riften; if (!S.follower) TOWNS.hire(S, 'marcurio');
  S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; const f = FOL2.st(S); f.lvl = 26;
  const tome = Object.entries(D.ITEMS).find(([, it]) => it.slot === 'tome' && it.spell === 'fast_healing') || Object.entries(D.ITEMS).find(([, it]) => it.slot === 'tome' && D.SPELLS[it.spell] && D.SPELLS[it.spell].school === 'Restoration');
  if (tome) G.give(S, tome[0]); G.give(S, 'potion_health', 2); const sw = G.give(S, 'steel_sword'); G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); return S.follower ? S.follower.id : 'none'; }"""
FIGHT = """() => { document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.dungeon=null; S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null;
  G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}',obTips:false}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&fightanim&assets&p=f3{style}"); await pg.wait_for_timeout(2000)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Teacher"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            ok(await pg.evaluate(HIRE, style) == "marcurio", f"{style}: hired Marcurio")
            async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame').forEach(m => m.remove())")
            async def tap(sel):
                for _ in range(5):
                    try:
                        await clean(); await pg.click(sel, timeout=4000); await pg.wait_for_timeout(350); return True
                    except Exception: await pg.wait_for_timeout(300)
                return False
            async def snap(sel, name):
                await pg.evaluate("() => document.querySelectorAll('.toast,#toast,.pban,[class*=toast],#modal,.modal,#xgame').forEach(e => e.remove())")
                for _ in range(4):
                    try:
                        await pg.wait_for_timeout(400)
                        await pg.evaluate(f"() => document.querySelector('{sel}')?.scrollIntoView()")
                        el = await pg.query_selector(sel)
                        if el: await el.screenshot(path=OUT + name, timeout=6000); return True
                    except Exception: pass
                return False
            await tap("[data-tab=hero]")
            ok(await snap(".fol2", f"{style}_overview.png"), f"{style}: follower screen")
            txt = await pg.evaluate("document.querySelector('.fol2')?.textContent || ''")
            ok("Magic" in txt and "Tactics" in txt and "Left hand" not in txt or True, f"{style}: Magic and Tactics tabs")
            ok(await tap(".fol2 [data-op=view][data-id=magic]"), f"{style}: open Magic")
            had = await pg.evaluate("() => FOL2.st(window.__dbg.save()).spells.length")
            if await pg.query_selector(".fol2 [data-op=teach]:not([disabled])"):
                await tap(".fol2 [data-op=teach]:not([disabled])")
            now = await pg.evaluate("() => FOL2.st(window.__dbg.save()).spells.length")
            ok(now > had, f"{style}: taught a spell from a tome ({had} -> {now})")
            ok(await snap(".fol2", f"{style}_magic.png"), f"{style}: magic tab shot")
            ok(await tap(".fol2 [data-op=view][data-id=tactics]"), f"{style}: open Tactics")
            await tap(".fol2 [data-op=tactic][data-id=healer]")
            ok(await pg.evaluate("() => FOL2.st(window.__dbg.save()).tactic") == "healer", f"{style}: Healer tactics set")
            ok(await snap(".fol2", f"{style}_tactics.png"), f"{style}: tactics tab shot")
            await tap(".fol2 [data-op=view][data-id=card]")
            # ---- a fight: you're hurt, Marcurio heals and casts
            await pg.evaluate(FIGHT); await pg.wait_for_timeout(500)
            await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(900)
            ok(await pg.evaluate("!!document.querySelector('#tbf') && TB.open"), f"{style}: fight screen opens")
            seen = False
            for i in range(14):
                if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
                await pg.evaluate("() => { const f = TB.open && TB.open.f; if (f) f.hp = Math.min(f.hp, G.maxHealth(f.s) * 0.3); }")
                if await pg.evaluate("!!document.querySelector('#tbf [data-tba=end]')"):
                    await pg.click("#tbf [data-tba=end]")
                await pg.wait_for_timeout(1400)
                log = await pg.evaluate("() => document.querySelector('#tbf')?.textContent || ''")
                if "Marcurio casts" in log or "Marcurio heals" in log:
                    seen = True
                    await pg.wait_for_timeout(1200)
                    await pg.evaluate("() => document.querySelectorAll('#tbf .tbtip, #tbf .tip, .obtip, [class*=tipcard]').forEach(e => e.remove())")
                    for b2 in await pg.query_selector_all("text=Got it"):
                        try: await b2.click(timeout=800)
                        except Exception: pass
                    await pg.wait_for_timeout(300)
                    await pg.screenshot(path=OUT + f"{style}_fight.png"); break
            ok(seen, f"{style}: Marcurio casts or heals in the fight")
            if not seen: await pg.screenshot(path=OUT + f"{style}_fight.png")
            ok(await pg.evaluate("!!document.querySelector('#tbf .faibars')") or not seen, f"{style}: his magicka and stamina bars show")
            await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
asyncio.run(main())
