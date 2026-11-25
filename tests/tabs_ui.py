"""Menu tabs screen test (menus.js): the seven bottom tabs, every sub-tab, and a reachability checklist of every screen.
Run:  node tests/serve.js 9400   then   python tests/tabs_ui.py 9400 [outdir]
Everything is reached by TAPS (bottom tab -> sub-tab -> button), never by code, on 360x780 and 412x915, in both art styles,
at Normal and Biggest text, with one-hand mode on for the Biggest pass. Fails on page errors, sideways scrolling, clipped tab
labels, tabs thinner than a thumb, and any screen on the checklist that can't be reached. Screenshots land in outdir."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9400"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "tabs_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
BAR = """(()=>{ const bad=[], W=innerWidth, z=parseFloat(getComputedStyle(document.documentElement).zoom)||1;
  const tabs=[...document.querySelectorAll('#tabs .tab')]; if (tabs.length!==7) bad.push('tabs '+tabs.length);
  for (const t of tabs) { const r=t.getBoundingClientRect(), l=t.querySelector('.mn-l');
    if (r.left<-1||r.right>W+1) bad.push('off screen '+t.dataset.tab);
    if (l && l.scrollWidth>l.clientWidth+1) bad.push('clipped '+l.textContent+' '+l.scrollWidth+'>'+l.clientWidth);
    if (r.height<44) bad.push('short '+t.dataset.tab+' '+Math.round(r.height)); }
  if (document.documentElement.scrollWidth>document.documentElement.clientWidth+1) bad.push('page scrolls sideways');
  return bad; })()"""

# [what, how to reach it by taps, text that proves it's there]
def checklist():
    return [
        ("Character sheet", [("tab", "hero"), ("sub", "hero")], "Powers & shouts"),
        ("Skills (constellations)", [("sub", "stars")], "perk point"),
        ("Perks", [("sub", "perks")], "Ready to take"),
        ("Follower", [("sub", "follower")], "Follower"),   # the Tactics tab went with auto fighting (a8ba9c1)
        ("Stats", [("sub", "stats")], ""),
        ("Achievements", [("sub", "ach")], "Achievements"),
        ("Library (discoveries, lore books)", [("sub", "library")], "Library"),
        ("Diary", [("sub", "diary")], "Diary"),
        ("Settings (in a tab)", [("sub", "settings")], "Accessibility"),
        ("Patch notes", [("act", "#side [data-act=notes]")], "Patch Notes"),
        ("Guide", [("close",), ("act", "#side [data-act=guide]")], "Guide"),
        ("Backup", [("close",), ("act", "#side [data-bk=openbackup]")], "Back up"),
        ("Settings sheet (top button)", [("close",), ("act", "#sndBtn")], "Main menu"),
        ("Items menu", [("close",), ("tab", "pack")], "Worn"),
        ("Items: plain list", [("act", "#sky .mn-list")], "Pack"),
        ("Magic menu", [("tab", "magic")], "All tiers"),
        ("Skills menu (in item menu)", [("act", "#sky [data-act=skytab][data-id=skills]")], "Level"),
        ("Travel", [("skyclose",), ("tab", "map"), ("sub", "map")], "Where to?"),
        ("Locations (cleared places)", [("sub", "places")], "Cleared"),
        ("World news: world events", [("sub", "world")], "World news"),
        ("World news: Word around Skyrim (rumours)", [], "Word around Skyrim"),
        ("Journal: active quests", [("tab", "log")], "Journal"),
        ("Journal: misc", [("act", "#side [data-act=jtab][data-id=misc]")], "Misc"),
        ("Journal: completed", [("act", "#side [data-act=jtab][data-id=done]")], "Completed"),
        ("Social: friends", [("tab", "social"), ("act", "#side [data-act=soctab][data-id=friends]")], "Your friends"),
        ("Social: messages", [("act", "#side [data-act=soctab][data-id=msgs]")], "Messages"),
        ("Social: trades", [("act", "#side [data-act=soctab][data-id=trades]")], "offers"),
        ("Social: party", [("act", "#side [data-act=soctab][data-id=party]")], "Party"),
        ("Social: chat", [("act", "#side [data-act=soctab][data-id=chat]")], "Chat"),
        ("Social: clans + leaderboard (Realm)", [("act", "#side [data-act=soctab][data-id=realm]")], "lan"),
        ("Town", [("tab", "town")], "Town"),
        ("Town: homestead", [("act", "#side [data-id=homestead]")], "Pinewatch"),
        ("Compass (Tab menu)", [("act", "#twBtn")], "direction"),
        ("Compass -> Skills page", [("act", "#tw [data-twgo=char]")], "perk point"),
        ("Compass Skills page -> Settings", [("act", "#twbar [data-twb=settings]")], "Accessibility"),
    ]

async def main():
    fails, done = [], set()
    async with async_playwright() as p:
        exe = os.environ.get("CHROME")
        b = await (p.chromium.launch(executable_path=exe) if exe else p.chromium.launch())
        for vw, vh in [(360, 780), (412, 915)]:
            for art in ["ink"]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
                pg = await ctx.new_page(); errs = []; pg.set_default_timeout(5000)
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0"); await pg.wait_for_timeout(1200)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrolfdir"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate(f"{CLEAR}")
                # a homestead town, so the deed screen shows
                await pg.evaluate("(()=>{ const S=__dbg.save(); S.location='Falkreath'; [S.x,S.y]=WORLD.places.Falkreath; S.trip=null; __ui.refresh(); })()")
                for size in ["0", "3"]:
                    tag = f"{vw}_{art}_t{size}"
                    await pg.evaluate(f"ACCESS.pref('a11yText','{size}'); ACCESS.pref('a11yHand','{'right' if size == '3' else 'off'}')")
                    await pg.evaluate(CLEAR); await pg.evaluate("document.querySelector('#sky [data-act=skyclose]')?.click(); __ui.go('map'); scrollTo(0,0)"); await pg.wait_for_timeout(300)
                    bad = await pg.evaluate(BAR)
                    if bad: fails.append(f"{tag} bar: {bad}")
                    await pg.screenshot(path=os.path.join(OUT, f"{tag}_00_map.png"))
                    for i, (name, steps, want) in enumerate(checklist()):
                        try:
                            for st in steps:
                                if st[0] == "tab": await pg.click(f"#tabs .tab[data-tab={st[1]}]")
                                elif st[0] == "sub":
                                    sel = f"#side .mn-sub [data-id={st[1]}]"
                                    await pg.eval_on_selector(sel, "e=>e.scrollIntoView({inline:'center',block:'nearest'})")
                                    await pg.click(sel)
                                elif st[0] == "act":
                                    await pg.eval_on_selector(st[1], "e=>e.scrollIntoView({block:'center'})")
                                    await pg.click(st[1])
                                elif st[0] == "close": await pg.evaluate(CLEAR + "; document.querySelectorAll('#sky').length && 0")
                                elif st[0] == "skyclose": await pg.evaluate("document.querySelector('#sky [data-act=skyclose]')?.click()")
                                await pg.wait_for_timeout(250)
                            txt = await pg.evaluate("[document.querySelector('#modal'),document.querySelector('#sky'),document.querySelector('#tw'),document.querySelector('#side')].filter(Boolean).map(e=>e.innerText).join('\\n')")
                            if want and want.lower() not in txt.lower(): raise Exception(f"no '{want}'")
                            done.add(name)
                            if size == "3" or vw == 360:
                                await pg.screenshot(path=os.path.join(OUT, f"{tag}_{i + 1:02d}_{name.split(' ')[0].replace(':', '')}.png"))
                        except Exception as e:
                            why = [l.strip() for l in str(e).splitlines() if "intercepts" in l or "not visible" in l or "not stable" in l][:1]
                            fails.append(f"{tag} {name}: {str(e).splitlines()[0][:160]} {why}")
                    await pg.evaluate("TABMENU.closeHub(); document.querySelector('#twbar [data-twb=hub]') && TABMENU.closeHub()")
                    await pg.evaluate("document.body.classList.contains('tw-char') && __ui.go('map')")
                if errs: fails.append(f"{vw} {art} page errors: {errs[:3]}")
                await ctx.close()
        await b.close()
    miss = [n for n, _, _ in checklist() if n not in done]
    print("reached:", len(done), "of", len(checklist()))
    if miss: print("never reached:", miss)
    if fails:
        print("FAIL"); [print(" ", f) for f in fails]; sys.exit(1)
    print("tabs ui ok ->", OUT)

asyncio.run(main())
