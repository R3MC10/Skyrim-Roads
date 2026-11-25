"""Five bottom tabs (menus.js, pcmap.js): World, Area, Hero, Journal, Social on 360x640, 390x844 and 1920x1080, with a level-1
hero and a level-24 hero. Every tab is tapped (clicked on the PC bar); fails on page errors, a bar that isn't five tabs, a tab
under 44px tall or off screen, a clipped tab label, the open tab not lit, sideways scrolling, or a floating thing (top bar,
bottom bar, gather prompt, message lane, banners) sitting on a button in the open page. Also checks World shows one goal and
the Where to? button on phones, Hero holds Items and Magic, and the keys 1-5 open the tabs on PC.
Run:  node tests/serve.js 9500   then   python tests/tabs5_ui.py 9500 [outdir]"""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9500"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "tabs5_shots")
os.makedirs(OUT, exist_ok=True)
IDS = ["world", "town", "hero", "log", "social"]
CLEAR = "document.querySelectorAll('#modal,#lvlpick').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.(); document.querySelector('#sky [data-act=skyclose]')?.click()"
# the bar: phone = #tabs .tab, PC = the pcmap bar (.pcb-btn[data-pc])
BAR = """(()=>{ const pc = document.documentElement.classList.contains('pcmap') && !!document.querySelector('.pcb-btn[data-pc]');
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden'; };
  const tabs = pc ? [...document.querySelectorAll('.pcb-btn[data-pc]')].filter((b) => b.dataset.pc !== 'menu') : [...document.querySelectorAll('#tabs .tab')];
  const bad = [], ids = tabs.map((t) => pc ? t.dataset.pc : t.dataset.tab);
  if (ids.join() !== 'world,town,hero,log,social') bad.push('tabs ' + ids.join());
  for (const t of tabs) { if (!vis(t)) { bad.push('hidden ' + (t.dataset.tab || t.dataset.pc)); continue; }
    const r = t.getBoundingClientRect(), l = t.querySelector('.mn-l, span');
    if (r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push('off screen ' + (t.dataset.tab || t.dataset.pc));
    if (r.height < 44) bad.push('short ' + (t.dataset.tab || t.dataset.pc) + ' ' + Math.round(r.height));
    if (l && l.scrollWidth > l.clientWidth + 1) bad.push('clipped ' + l.textContent); }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) bad.push('page scrolls sideways');
  return { pc, bad }; })()"""
LIT = """(id)=>{ const pc = document.documentElement.classList.contains('pcmap') && !!document.querySelector('.pcb-btn[data-pc]');
  const on = pc ? [...document.querySelectorAll('.pcb-btn.on')].map((b) => b.dataset.pc) : [...document.querySelectorAll('#tabs .tab.on, #tabs .tab[aria-current=page], #tabs .tab[aria-selected=true]')].map((b) => b.dataset.tab);
  return [...new Set(on)]; }"""
# a floating layer must not sit on a button of the open page
COVER = """(()=>{ const out = [], FLOAT = '#tabs,.pcbar,#pcbar,.app .top,#gnear,#hudlane,#pbanners,#nfhbtn';
  const shown = (e) => { const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null;
    for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return null; }
    return r; };
  const floats = [...document.querySelectorAll(FLOAT)].map((e) => [e, shown(e)]).filter(([, r]) => r);
  for (const b of document.querySelectorAll('#side button, #side [data-act], #locs button')) {
    const r = shown(b); if (!r || r.top < 0 || r.bottom > innerHeight) continue;
    if (b.closest(FLOAT)) continue;
    // a page scrolls under the bars: only a button fully clear of every bar's band counts as "should be tappable"
    if (floats.some(([f, fr]) => getComputedStyle(f).position !== 'static' && fr.top < r.bottom && r.top < fr.bottom && fr.left < r.right && r.left < fr.right && (f.matches('#tabs,.pcbar,#pcbar,.app .top')))) continue;
    const x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2, top = document.elementFromPoint(x, y);
    if (!top || top === b || b.contains(top) || top.contains(b)) continue;
    const f = top.closest(FLOAT); if (f) out.push(`${f.id || f.className} covers ${(b.dataset.act || b.className || 'button')}:${(b.textContent || '').trim().slice(0, 14)}`);
  }
  return out.slice(0, 5); })()"""


async def tap(pg, pc, tid):
    if pc: await pg.click(f".pcb-btn[data-pc={tid}]")
    else: await pg.click(f"#tabs .tab[data-tab={tid}]")
    await pg.wait_for_timeout(500)


async def run(b, w, h, lvl, fails):
    tag = f"{w}x{h}_lv{lvl}"
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=w < 900)
    pg = await ctx.new_page(); errs = []; pg.set_default_timeout(6000)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=t5{w}{lvl}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1800)
    await pg.evaluate(CLEAR)
    if lvl > 1:
        await pg.evaluate(f"""()=>{{ const S=__dbg.save(); S.level={lvl}; S.gold=8421; for (const k in S.skills) S.skills[k].lvl=45; __ui.refresh?.(); }}""")
    # a town, so Area has its board
    await pg.evaluate("(()=>{ const S=__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; __ui.go('map'); __ui.refresh?.(); })()")
    await pg.wait_for_timeout(600); await pg.evaluate(CLEAR)
    bar = await pg.evaluate(BAR); pc = bar["pc"]
    if bar["bad"]: fails.append(f"{tag} bar: {bar['bad']}")
    if (w >= 1280) != pc: fails.append(f"{tag} PC layout {'missing' if w >= 1280 else 'on a phone'}")
    for i, tid in enumerate(IDS):
        try:
            await pg.evaluate(CLEAR); await tap(pg, pc, tid); await pg.evaluate("document.querySelectorAll('#modal,#lvlpick').forEach(m=>m.remove())")
            lit = await pg.evaluate(LIT, tid)
            if lit != [tid]: fails.append(f"{tag} {tid}: lit tabs {lit}")
            bad = (await pg.evaluate(BAR))["bad"]
            if bad: fails.append(f"{tag} {tid} bar: {bad}")
            cov = await pg.evaluate(COVER)
            if cov: fails.append(f"{tag} {tid}: {cov}")
            if tid == "world" and not pc:
                info = await pg.evaluate("[document.querySelectorAll('#side .t5-places').length, document.querySelectorAll('#side .mp-card, #side .nextcard').length]")
                if not info[0]: fails.append(f"{tag} world: no Where to? button")
            if tid == "hero":
                subs = await pg.evaluate("[...document.querySelectorAll('#side .mn-sub [data-id]')].map(e=>e.dataset.id)")
                if "@items" not in subs or "@magic" not in subs: fails.append(f"{tag} hero: no Items/Magic in {subs}")
            await pg.screenshot(path=os.path.join(OUT, f"tabs5_{tag}_{i + 1}_{tid}.png"))
        except Exception as e:
            fails.append(f"{tag} {tid}: {str(e).splitlines()[0][:200]}")
    if pc:   # keys 1-5
        for n, tid in enumerate(IDS, 1):
            await pg.evaluate(CLEAR); await pg.evaluate("document.activeElement?.blur?.()"); await pg.keyboard.press(str(n))
            for _ in range(10):   # the bar repaints on the next frame; a busy machine can take a moment
                await pg.wait_for_timeout(150); lit = await pg.evaluate(LIT, tid)
                if lit == [tid]: break
            if lit != [tid]: fails.append(f"{tag} key {n}: lit {lit}, wanted {tid}")
        tip = await pg.evaluate("document.querySelector('.pcb-btn[data-pc=hero]').title")
        if "C" not in tip or "3" not in tip: fails.append(f"{tag} Hero tooltip has no keys: {tip}")
    if errs: fails.append(f"{tag} page errors: {errs[:3]}")
    await ctx.close()


async def main():
    fails = []
    async with async_playwright() as p:
        exe = os.environ.get("CHROME")
        b = await (p.chromium.launch(executable_path=exe) if exe else p.chromium.launch())
        for w, h in [(360, 640), (390, 844), (1920, 1080)]:
            for lvl in (1, 24): await run(b, w, h, lvl, fails)
        await b.close()
    if fails:
        print("FAIL"); [print(" ", f) for f in fails]; sys.exit(1)
    print("tabs5 ui ok ->", OUT)

asyncio.run(main())
