# Character creation (chargen.js): every tab on a phone and two PC windows, the live preview really draws, nothing spills
# sideways, touch targets are big, Randomise/Undo/zoom work, the made look and standing stone reach the save, the hero
# shows in a fight and on the map, and the mirror opens the same screen without the Race and Start tabs.
# usage: python3 chargen_ui.py [port] [out_dir]   (serve ../game on the port)
import asyncio, sys, os, json
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
HOST = os.environ.get("HOST", "localhost")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("OUT", _SHOTS)
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
            # [chargensex] the Male / Female switch sits above the tabs: big buttons, switches the preview, keeps the race, no beard for a woman
            ok(await pg.evaluate("document.querySelectorAll('.cgsex .cgsexb').length") == 2, f"{tag}: Male / Female switch above the tabs")
            ok(await pg.evaluate("(()=>{const s=document.querySelector('.cgsex').getBoundingClientRect(), t=document.querySelector('.cgtabs').getBoundingClientRect(); return s.bottom<=t.top+1 && s.height>0;})()"), f"{tag}: switch is above the tabs")
            szs = await pg.evaluate("[...document.querySelectorAll('.cgsexb')].map(b=>{const r=b.getBoundingClientRect(); return Math.min(r.width,r.height);})")
            ok(min(szs) >= 44, f"{tag}: switch buttons at least 44px {szs}")
            await pg.click(f".rpick[data-race={race}]"); await pg.wait_for_timeout(300)
            try: await pg.wait_for_function("document.querySelector('.cg').classList.contains('cg-painted')", timeout=30000)
            except Exception: pass
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=os.path.join(OUT, f"cs_{tag}_male.png"))
            await pg.click(".cgsexb[data-v=f]"); await pg.wait_for_timeout(400)
            af = json.loads(await pg.evaluate(APP))
            ok(af["sx"] == "f" and af["beard"] == "none" and await pg.evaluate("CHARGEN.state.race") == race, f"{tag}: Female picked, race kept, no beard")
            ok(await pg.evaluate("document.querySelector('.cgsexb[data-v=f]').getAttribute('aria-checked')") == "true", f"{tag}: Female button marked")
            ok("Brynja" in await pg.evaluate("document.querySelector('#nm').placeholder"), f"{tag}: name example follows the sex")
            for _ in range(4):
                await pg.click("[data-cg=rand]"); await pg.wait_for_timeout(120)
                ok(json.loads(await pg.evaluate(APP))["sx"] == "f", f"{tag}: Randomise keeps Female")
            try: await pg.wait_for_function("document.querySelector('.cg').classList.contains('cg-painted')", timeout=30000)
            except Exception: pass
            await pg.wait_for_timeout(500)
            ok(await pg.evaluate(INK) > 0.01, f"{tag}: female preview draws")
            ok(await pg.evaluate("FIGART.specOf(FIGART.lookFor({look:CHARGEN.state && (()=>{const L={r:CHARGEN.state.race,id:'t',eq:{},gl:{},a:APPEAR.compact(CHARGEN.state.app)};return L;})()})).fem"), f"{tag}: the preview figure is a woman")
            await pg.screenshot(path=os.path.join(OUT, f"cs_{tag}_female.png"))
            # the keyboard: arrows on the switch flip it back
            await pg.focus(".cgsexb[data-v=f]"); await pg.keyboard.press("ArrowLeft"); await pg.wait_for_timeout(250)
            ok(json.loads(await pg.evaluate(APP))["sx"] == "m" and await pg.evaluate("document.activeElement?.dataset.v") == "m", f"{tag}: arrow keys flip the switch")
            await pg.click(".cgsexb[data-v=f]"); await pg.wait_for_timeout(300)   # make a woman for the rest of the run
            # race tab: pick a race, its card shows lore + gift + power
            await pg.click(f".rpick[data-race={race}]"); await pg.wait_for_timeout(500)
            card = await pg.evaluate("document.querySelector('.rshow')?.innerText||''")
            ok(len(card) > 80, f"{tag}: race card for {race} has lore, gift and power ({len(card)} chars)")
            ok(await pg.evaluate("!!document.querySelector('.rshow .heroprev img')"), f"{tag}: race card portrait")
            # [chargenrig] the preview is the painted fight figure (chargenrig.js) once its parts load, in every pose
            try: await pg.wait_for_function("document.querySelector('.cg').classList.contains('cg-painted')", timeout=30000)
            except Exception: pass
            ok(await pg.evaluate("document.querySelector('.cg').classList.contains('cg-painted')"), f"{tag}: preview uses the painted fight figure")
            ok(await pg.evaluate("!!document.querySelector('.rshow .bust-hero')"), f"{tag}: race card shows the painted bust")
            for pose in ["walk", "attack", "idle"]:
                await pg.click(f"[data-cg=pose][data-pose={pose}]"); await pg.wait_for_timeout(300)
                ink = await pg.evaluate(INK)
                ok(ink > 0.01 and await pg.evaluate("document.querySelector('.cg').classList.contains('cg-painted')"), f"{tag}: painted {pose} pose draws ({ink:.3f})")
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
            s = json.loads(await pg.evaluate("JSON.stringify((({race,app,stone,name,location,sex})=>({race,app,stone,name,location,sex}))(__dbg.save()))"))
            ok(s["app"]["sx"] == "f" and s.get("sex") == "f", f"{tag}: save keeps Female (app.sx and sex)")
            ok(s["race"] == race and s["stone"] == "warrior", f"{tag}: save has race {s['race']} and stone {s['stone']}")
            ok(json.dumps(s["app"], sort_keys=True) == json.dumps(json.loads(want), sort_keys=True), f"{tag}: save has the look made on screen")
            ok(await pg.evaluate("!document.querySelector('.cg')"), f"{tag}: creation screen closed")
            ok(await pg.evaluate("!__dbg.save().remake && __dbg.save().rmkV >= 1"), f"{tag}: a new hero gets no remake")
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
            # [remake] an old hero (saved before this build) gets "Make your hero anew" once, at a quiet moment on the map
            if tag in ("phone", "pc"):
                await pg.evaluate("()=>{ try { TB.close(); } catch {} document.querySelectorAll('#modal,#tbf').forEach(x=>x.remove()); }")
                await pg.wait_for_timeout(300)
                print("   remake state:", await pg.evaluate("[TB.open, __ui.safeToUpdate(), [...document.querySelectorAll('#modal,#tbf,#tbwatch,#lvlpick,#nickbox,.cg-over')].map(e=>e.id||e.className)]"))
                old = "()=>{ const S=__dbg.save(); delete S.rmkV; delete S.remake; G.migrate(S); return S.remake; }"
                ok(await pg.evaluate(old) == 1, f"{tag}: an old save gets the remake flag on load")
                # in a dungeon: it waits
                await pg.evaluate("()=>{ const S=__dbg.save(); S.dungeon={ place:'Embershard Mine', theme:'mine', tier:1, rows:[[{type:'fight',links:[]}]], row:0, col:0, room:null, found:[], gold:0, t:G.now() }; }")
                await pg.wait_for_timeout(2500)
                ok(await pg.evaluate("!document.querySelector('.cg-remake')"), f"{tag}: no remake in a dungeon")
                await pg.evaluate("__dbg.save().dungeon=null")
                try: await pg.wait_for_selector(".cg-remake", timeout=6000)
                except Exception: pass
                ok(await pg.evaluate("!!document.querySelector('.cg-remake')"), f"{tag}: remake opens back on the map")
                await pg.wait_for_timeout(600)
                info = json.loads(await pg.evaluate("""JSON.stringify({ h:document.querySelector('.cg-remake h2')?.textContent, p:document.querySelector('.cg-remake .cghead p')?.textContent,
                  tabs:[...document.querySelectorAll('.cg-remake .cgtab')].map(t=>t.dataset.tab).join(), nm:document.querySelector('.cg-remake #rmknm')?.value, me:__dbg.save().name,
                  keep:!!document.querySelector('[data-cg=keep]'), done:!!document.querySelector('[data-cg=remade]'), cancel:!!document.querySelector('.cg-remake [data-cg=cancel]') })"""))
                ok(info["h"] == "Make your hero anew" and "women heroes" in (info["p"] or ""), f"{tag}: remake title and line {info['h']}")
                ok("race" in info["tabs"] and "start" not in info["tabs"] and "hair" in info["tabs"], f"{tag}: remake tabs {info['tabs']}")
                ok(info["nm"] == info["me"], f"{tag}: name kept in the box ({info['nm']})")
                ok(info["keep"] and info["done"] and not info["cancel"], f"{tag}: Keep as is + Done, no Cancel")
                ok(await pg.evaluate(SPILL) <= 1, f"{tag}: remake doesn't spill sideways")
                small = await pg.evaluate(SMALL)
                ok(not small, f"{tag}: remake touch targets at least 32px {small}")
                await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
                ok(await pg.evaluate("!!document.querySelector('.cg-remake')"), f"{tag}: Escape doesn't skip the remake")
                try: await pg.wait_for_function("document.querySelector('.cg').classList.contains('cg-painted')", timeout=30000)
                except Exception: pass
                await pg.wait_for_timeout(500)
                await pg.screenshot(path=os.path.join(OUT, f"rmk_{tag}_open.png"))
                to, sx = ("khajiit", "m") if tag == "pc" else ("nord", "m")
                was = json.loads(await pg.evaluate("JSON.stringify({ r:__dbg.save().race, k:__dbg.save().skills, lvl:__dbg.save().level })"))
                await pg.click(f".rpick[data-race={to}]"); await pg.wait_for_timeout(300)
                await pg.click(f".cgsexb[data-v={sx}]"); await pg.wait_for_timeout(300)
                await pg.click(".cgtab[data-tab=hair]"); await pg.wait_for_timeout(300)
                await pg.locator(".cgpanel .cgarr[data-cg=inc]").first.click(); await pg.wait_for_timeout(200)
                await pg.fill("#rmknm", "Torvar" if tag == "pc" else "Eirik"); await pg.wait_for_timeout(200)
                try: await pg.wait_for_function("document.querySelector('.cg').classList.contains('cg-painted')", timeout=30000)
                except Exception: pass
                await pg.wait_for_timeout(500)
                await pg.screenshot(path=os.path.join(OUT, f"rmk_{tag}_changed.png"))
                await pg.click("[data-cg=remade]"); await pg.wait_for_timeout(800)
                s = json.loads(await pg.evaluate("JSON.stringify((S=>({ r:S.race, sex:S.sex||'m', sx:S.app.sx||'m', n:S.name, rm:!!S.remake, k:S.skills, lvl:S.level, look:HEROART.lookOf(S).r }))(__dbg.save()))"))
                ok(await pg.evaluate("!document.querySelector('.cg-remake')"), f"{tag}: Done closes the remake")
                ok(s["r"] == to and s["look"] == to and s["sex"] == sx and s["n"] == ("Torvar" if tag == "pc" else "Eirik") and not s["rm"] and s["lvl"] == was["lvl"], f"{tag}: save has the new race, sex, name, flag cleared {s['r']} {s['sex']} {s['n']}")
                bo, bn = await pg.evaluate(f"[REMAKE.bonus('{was['r']}'), REMAKE.bonus('{to}')]")
                for k in ["Two-Handed", "Sneak", "Archery", "Destruction", "Alteration"]:
                    want = min(100, max(15, was["k"][k]["lvl"] - bo.get(k, 0)) + bn.get(k, 0))
                    ok(s["k"][k]["lvl"] == want, f"{tag}: {k} {was['k'][k]['lvl']} -> {s['k'][k]['lvl']} (want {want})")
                await pg.wait_for_timeout(600)
                await pg.screenshot(path=os.path.join(OUT, f"rmk_{tag}_after.png"))
                await pg.wait_for_timeout(3000)
                ok(await pg.evaluate("!document.querySelector('.cg-remake')"), f"{tag}: it doesn't come back")
                # Keep as is: a second old hero confirms what they have
                await pg.evaluate(old)
                try: await pg.wait_for_selector(".cg-remake", timeout=6000)
                except Exception: pass
                before = await pg.evaluate("JSON.stringify((S=>({r:S.race,a:S.app,k:S.skills,n:S.name}))(__dbg.save()))")
                await pg.click("[data-cg=keep]"); await pg.wait_for_timeout(600)
                after = await pg.evaluate("JSON.stringify((S=>({r:S.race,a:S.app,k:S.skills,n:S.name}))(__dbg.save()))")
                ok(await pg.evaluate("!document.querySelector('.cg-remake') && !__dbg.save().remake") and before == after, f"{tag}: Keep as is closes, clears the flag, changes nothing")
            ok(not errs, f"{tag}: no page errors {errs[:3]}")
            await ctx.close()
        await b.close()
    print("screenshots in", OUT)
    if fails:
        print("FAILED", len(fails)); sys.exit(1)
    print("chargen_ui ok")

asyncio.run(main())
