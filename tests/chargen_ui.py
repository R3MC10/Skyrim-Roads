# Character creation (chargen.js): every tab on a phone and two PC windows, the live preview really draws, nothing spills
# sideways, touch targets are big, Randomise/Undo/zoom work, the made look and standing stone reach the save, the hero
# shows in a fight and on the map, and the mirror opens the same screen without the Race and Start tabs.
# usage: python3 chargen_ui.py [port] [out_dir]   (serve ../game on the port)
import asyncio, sys, os, json
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
HOST = os.environ.get("HOST", "localhost")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("OUT", "/home/claude/tests/")
os.makedirs(OUT, exist_ok=True)
SIZES = [("phone", 390, 844, 3, "khajiit"), ("pc", 1920, 1080, 1, "nord"), ("wide", 2560, 1080, 1, "argonian")]
TABS = ["race", "body", "head", "face", "hair", "marks", "start"]
# how much of the preview canvas is not empty (the figure really drew)
INK = """()=>{ const c=document.querySelector('.cgcan'); if(!c||!c.width) return 0; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=16) if(d[i]>20) n++; return n/(d.length/16); }"""
SPILL = "()=>document.documentElement.scrollWidth - window.innerWidth"
SMALL = """()=>[...document.querySelectorAll('.cg button, .cg [role=tab], .cg [role=radio], .cg input')].filter(b=>{ const r=b.getBoundingClientRect(); return r.width>0 && (r.height<32 || r.width<32); }).map(b=>(b.className||b.tagName)+':'+Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height)).slice(0,6)"""
APP = "()=>JSON.stringify(CHARGEN.state && CHARGEN.state.app)"

async def main():
    fails = []
    def ok(c, m):
        print(("ok   " if c else "FAIL ") + m)
        if not c: fails.append(m)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for tag, w, h, dpr, race in SIZES:
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr)
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:300]))
            await pg.goto(f"http://{HOST}:{PORT}/index.html?assets&net=bc&notut&tb&p=cg{tag}"); await pg.wait_for_timeout(1500)
            await pg.wait_for_selector(".press", state="attached", timeout=20000); await pg.evaluate("document.querySelector('.press').click()"); await pg.wait_for_timeout(500)
            await pg.wait_for_selector(".mi[data-t=new]", state="attached", timeout=10000); await pg.evaluate("document.querySelector('.mi[data-t=new]').click()")
            await pg.wait_for_selector(".cg .cgcan", timeout=10000); await pg.wait_for_timeout(700)
            ok(await pg.evaluate("document.querySelectorAll('.cg .cgtab').length") == 7, f"{tag}: seven tabs")
            # race tab: pick a race, its card shows lore + gift + power
            await pg.click(f".rpick[data-race={race}]"); await pg.wait_for_timeout(500)
            card = await pg.evaluate("document.querySelector('.rshow')?.innerText||''")
            ok(len(card) > 80, f"{tag}: race card for {race} has lore, gift and power ({len(card)} chars)")
            ok(await pg.evaluate("!!document.querySelector('.rshow .heroprev img')"), f"{tag}: race card portrait")
            for t in TABS:
                await pg.click(f".cgtab[data-tab={t}]"); await pg.wait_for_timeout(250)
                ok(await pg.evaluate(f"document.querySelector('.cgtab[data-tab={t}]').getAttribute('aria-selected')") == "true", f"{tag}: {t} tab selected")
                # nudge the first two sliders / swatches on the tab
                na = await pg.evaluate("document.querySelectorAll('.cgpanel .cgarr[data-cg=inc]').length")
                for i in range(min(2, na)): await pg.locator(".cgpanel .cgarr[data-cg=inc]").nth(i).click(); await pg.wait_for_timeout(120)
                if t == "face": await pg.click(".cgic[data-cg=zoom]"); await pg.wait_for_timeout(500)
                await pg.wait_for_timeout(350)
                ink = await pg.evaluate(INK)
                ok(ink > 0.01, f"{tag}: preview draws on the {t} tab ({ink:.3f})")
                ok(await pg.evaluate(SPILL) <= 1, f"{tag}: nothing spills sideways on {t}")
                await pg.screenshot(path=os.path.join(OUT, f"cg_{tag}_{t}.png"))
                if t == "hair": await pg.click(".cgic[data-cg=zoom]"); await pg.wait_for_timeout(300)
            small = await pg.evaluate(SMALL)
            ok(not small, f"{tag}: touch targets at least 32px {small}")
            # Randomise then Undo returns the same look
            a0 = await pg.evaluate(APP)
            await pg.click("[data-cg=rand]"); await pg.wait_for_timeout(250); a1 = await pg.evaluate(APP)
            await pg.click("[data-cg=undo]"); await pg.wait_for_timeout(250); a2 = await pg.evaluate(APP)
            ok(a1 != a0 and a2 == a0, f"{tag}: Randomise changes the look and Undo brings it back")
            # keyboard: arrows on the tab list move between tabs
            await pg.focus(".cgtab[data-tab=start]"); await pg.keyboard.press("ArrowLeft"); await pg.wait_for_timeout(200)
            ok(await pg.evaluate("document.activeElement?.dataset.tab") == "marks", f"{tag}: arrow keys move along the tabs")
            await pg.click(".cgtab[data-tab=start]"); await pg.wait_for_timeout(200)
            # name validation + standing stone, then begin
            await pg.fill("#nm", ""); await pg.wait_for_timeout(150)
            await pg.fill("#nm", "Brynja" if tag != "pc" else "Hakon"); await pg.wait_for_timeout(200)
            await pg.click(".cgstone[data-stone=warrior]"); await pg.wait_for_timeout(200)
            ok(await pg.evaluate("document.querySelector('.cgstone[data-stone=warrior]').getAttribute('aria-checked')") == "true", f"{tag}: Warrior Stone picked")
            await pg.screenshot(path=os.path.join(OUT, f"cg_{tag}_start_named.png"))
            want = await pg.evaluate(APP)
            await pg.click("#begin"); await pg.wait_for_timeout(1800)
            s = json.loads(await pg.evaluate("JSON.stringify((({race,app,stone,name,location})=>({race,app,stone,name,location}))(__dbg.save()))"))
            ok(s["race"] == race and s["stone"] == "warrior", f"{tag}: save has race {s['race']} and stone {s['stone']}")
            ok(json.dumps(s["app"], sort_keys=True) == json.dumps(json.loads(want), sort_keys=True), f"{tag}: save has the look made on screen")
            ok(await pg.evaluate("!document.querySelector('.cg')"), f"{tag}: creation screen closed")
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=os.path.join(OUT, f"cg_{tag}_ingame_map.png"))
            # a real fight with the new hero
            await pg.evaluate("""()=>{ const S=__dbg.save(); S.trip=null; [S.x,S.y]=WORLD.places['Embershard Mine'].slice(0,2);
              S.dungeon={ place:'Embershard Mine', theme:'mine', tier:1, rows:[[{type:'fight',links:[]}]], row:0, col:0, room:null, found:[], gold:0, t:G.now() };
              const e=G.scaleEnemy({name:'Bandit',health:120,damage:9,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
              TB.call(S, ()=>{ const f=new G.Fight(S,e); f.allies=[]; return f.run({trySneak:false}); }, ()=>{}); }""")
            await pg.wait_for_timeout(1500)
            await pg.evaluate("document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click())")
            await pg.wait_for_timeout(1500)
            ok(await pg.evaluate("!!document.querySelector('#tbf')"), f"{tag}: fight screen open")
            await pg.screenshot(path=os.path.join(OUT, f"cg_{tag}_ingame_fight.png"))
            await pg.evaluate("document.querySelectorAll('#tbf').forEach(x=>x.remove()); const S=__dbg.save(); S.dungeon=null;")
            # the mirror: same screen, no Race or Start tab, Done applies for free
            await pg.evaluate("""()=>CHARGEN.open({ mode:'mirror', save:__dbg.save(), cost:0, onDone:(a)=>{ window.__mir=a; CHARGEN.close(); }, onCancel:()=>CHARGEN.close() })""")
            await pg.wait_for_timeout(600)
            tabs = await pg.evaluate("[...document.querySelectorAll('.cg .cgtab')].map(t=>t.dataset.tab).join()")
            ok("race" not in tabs and "start" not in tabs and "hair" in tabs, f"{tag}: mirror tabs {tabs}")
            ok(await pg.evaluate(INK) > 0.01, f"{tag}: mirror preview draws")
            await pg.click(".cgtab[data-tab=hair]"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, f"cg_{tag}_mirror.png"))
            await pg.locator(".cgpanel .cgarr[data-cg=inc]").first.click(); await pg.wait_for_timeout(200)
            await pg.click("[data-cg=done]"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("!!window.__mir && !document.querySelector('.cg')"), f"{tag}: mirror Done closes and hands back the look")
            ok(not errs, f"{tag}: no page errors {errs[:3]}")
            await ctx.close()
        await b.close()
    print("screenshots in", OUT)
    if fails:
        print("FAILED", len(fails)); sys.exit(1)
    print("chargen_ui ok")

asyncio.run(main())
