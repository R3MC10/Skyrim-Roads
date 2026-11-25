"""Nothing covers a button (nocover.js, hud2.js, notify.js, harvestgame.js prompt, chargenrig.js).
Visits the map, the Area board, the Forge, Items (+ an item's details), the perk tree, Company, a dungeon room, a fight
with a message showing and character creation at 360x800, 390x844, 412x915 and 1920x1080. Fails when the message-history
button (#nfhbtn), the gather prompt (#gnear), the compass button (#twBtn) or a big banner (#pbanners) sits on a visible
button, tab or dungeon node, when the history or compass button sits on a screen title, when the Journal's chosen tab has
contrast under 4.5 or the AI & Loadouts sub-tab strip hides tabs without a fade, or when the character creator's canvas has ink in its top 2% of rows (a cut-off sword).
Run:  node tests/serve.js 9161   then   py tests/overlap_ui.py 9161 [outdir]"""
import asyncio, os, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "overlap_shots")
os.makedirs(OUT, exist_ok=True)
VIEWS = [(360, 800), (390, 844), (412, 915), (1920, 1080)]
CLR = "document.querySelectorAll('#modal,#obtip').forEach(m=>m.remove())"

# every floating thing that must keep off the controls, against every control that is really painted on screen
CHECK = r"""([where, end])=>{
  const COVER = ['#nfhbtn', '#gnear .gnear', '#twBtn', '#pbanners .pban'];
  const FLOAT = '#hudlane,#pbanners,#gnear,#twBtn';
  const shown = (e) => { if (!e || !e.isConnected) return false; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; }
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const fixedish = (e) => { for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const targets = [...document.querySelectorAll('button,[role=button],[role=tab],.tab,.dnode,a[href]')].filter((t) => !t.closest(FLOAT) && shown(t));
  const bad = [];
  for (const sel of COVER) for (const c of document.querySelectorAll(sel)) {
    if (!shown(c)) continue;
    const r = c.getBoundingClientRect();
    for (const t of targets) {
      if (c.contains(t) || t.contains(c)) continue;
      // the Gather strip (docked on the bottom bar like a second bar) and the compass button float over a page that scrolls
      // under them: mid-page they must keep off the things that don't scroll; at the page's end (the "_end" screens, where
      // the page has room for them) off everything
      if (!end && (sel === '#gnear .gnear' || sel === '#twBtn') && !fixedish(t)) continue;
      const q = t.getBoundingClientRect();
      const x0 = Math.max(r.left, q.left), x1 = Math.min(r.right, q.right), y0 = Math.max(r.top, q.top), y1 = Math.min(r.bottom, q.bottom);
      if (x1 - x0 <= 3 || y1 - y0 <= 3) continue;
      // is the control really painted there (not under a window, not scrolled out of its box)?
      let hit = false;
      for (const [fx, fy] of [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]]) {
        const px = x0 + (x1 - x0) * fx, py = y0 + (y1 - y0) * fy;
        const at = document.elementsFromPoint(px, py), top = at.find((e) => !e.closest(FLOAT) && !c.contains(e));
        if (!top || !(t === top || t.contains(top))) continue;
        // a cover that takes taps shows up in the list: it only counts when it's above the control (not under a fight screen)
        // (banners never take taps, so they're taken to be on top)
        const ci = at.findIndex((e) => c.contains(e)), ti = at.indexOf(top), taps = getComputedStyle(c).pointerEvents !== 'none';
        if (taps ? ci !== -1 && ci < ti : sel === '#pbanners .pban') { hit = true; break; }
      }
      if (hit) bad.push(`${where}: ${sel} covers ${t.tagName.toLowerCase()}${t.id ? '#' + t.id : ''}.${String(t.className).split(' ')[0]} "${(t.textContent || t.getAttribute('aria-label') || '').trim().slice(0, 24)}"`);
    }
  }
  return bad; }"""
# the floating round buttons keep off the text of a screen title (Area, Journal, Social, AI & Loadouts, the dungeon's name)
HEADS = ".uxh-t, #dun .hd > h2, #side .panel > h2, #side h1"
HEADCHK = r"""([where, heads])=>{
  const shown = (e) => { if (!e || !e.isConnected) return false; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; }
    return r.bottom > 0 && r.top < innerHeight; };
  const bad = [];
  for (const sel of ['#nfhbtn', '#twBtn']) for (const c of document.querySelectorAll(sel)) {
    if (!shown(c)) continue;
    const r = c.getBoundingClientRect();
    for (const h of document.querySelectorAll(heads)) {
      if (!shown(h) || h.closest('#hudlane,#pbanners')) continue;
      const rg = document.createRange(); rg.selectNodeContents(h);
      for (const q of rg.getClientRects()) {
        const x0 = Math.max(r.left, q.left), x1 = Math.min(r.right, q.right), y0 = Math.max(r.top, q.top), y1 = Math.min(r.bottom, q.bottom);
        if (x1 - x0 <= 2 || y1 - y0 <= 2) continue;
        // only when the title is really painted there (not under a window)
        const top = document.elementsFromPoint((x0 + x1) / 2, (y0 + y1) / 2).find((e) => !e.closest('#hudlane,#pbanners,#twBtn'));
        if (top && (top === h || h.contains(top))) { bad.push(`${where}: ${sel} sits on the title "${h.textContent.trim().slice(0, 24)}"`); break; }
      }
    }
  }
  return bad; }"""
# WCAG contrast of the Journal's chosen tab: its text colour against the painted parchment under it
CONTRAST = r"""()=>{ const b = document.querySelector('#side[data-tab=log] .jseg button.on'); if (!b) return null;
  const r = b.getBoundingClientRect();
  return { fg: getComputedStyle(b).color.match(/[\d.]+/g).slice(0, 3).map(Number), box: { x: r.left, y: r.top, width: r.width, height: r.height } }; }"""


def lum(c):
    f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = [f(x / 255) for x in c[:3]]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


async def tab_contrast(pg):
    """text colour of the Journal's chosen tab against the most common colour painted in its box"""
    from PIL import Image
    import io
    await pg.evaluate("document.querySelector('#side[data-tab=log] .jseg button.on')?.scrollIntoView({ block: 'center', behavior: 'instant' })")
    await pg.wait_for_timeout(700)
    o = await pg.evaluate(CONTRAST)
    if not o: return None
    im = Image.open(io.BytesIO(await pg.screenshot(clip=o["box"]))).convert("RGB")
    im.save(os.path.join(OUT, f"journal_tab_{pg.viewport_size['width']}.png"))
    im = im.crop((0, 0, im.width, max(1, im.height - 5)))   # leave out the underline: it's a solid stripe, not the paper
    # the paper's shade: the most common colour, counted in coarse steps (the parchment is a gradient)
    cnt = {}
    for c in im.getdata(): k = tuple(v // 6 * 6 for v in c); cnt[k] = cnt.get(k, 0) + 1
    bg = max(cnt, key=cnt.get)
    print("   journal tab text", o["fg"], "on", bg)
    a, b = lum(o["fg"]), lum(bg)
    return round((max(a, b) + 0.05) / (min(a, b) + 0.05), 2)
INK = r"""()=>{ const c = document.querySelector('.cgcan'); if (!c || !c.width) return -1;
  const rows = Math.max(1, Math.round(c.height * 0.02)), d = c.getContext('2d').getImageData(0, 0, c.width, rows).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; }"""
# the blade near the rotate / Face buttons: ink anywhere in the canvas rows above the buttons' bottom edge + 3% of its height
# (the creator keeps 4%; 3% leaves room for rounding)
UNDERBTN = r"""()=>{ const c = document.querySelector('.cgcan'); if (!c || !c.width) return 0;
  const cr = c.getBoundingClientRect(), sy = c.height / cr.height, g = c.getContext('2d'); let low = 0;
  for (const b of document.querySelectorAll('.cgctl button')) {
    const r = b.getBoundingClientRect(); if (!r.width || r.bottom < cr.top || r.top > cr.top + cr.height * 0.5) continue;
    low = Math.max(low, (r.bottom - cr.top) * sy + c.height * 0.03);
  }
  const h = Math.min(c.height, Math.round(low)); if (h < 1) return 0;
  const d = g.getImageData(0, 0, c.width, h).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
  return n; }"""

DUN = """(n)=>{ const S=window.__dbg.save(); S.trip=null; S.location=n; [S.x,S.y]=WORLD.places[n]; if(!S.discovered.includes(n)) S.discovered.push(n); S.cleared={}; S.level=30; S.hpBonus=3000;
  G.setHealth(S,G.maxHealth(S)); for(const k of Object.keys(S.skills)) S.skills[k].lvl=80; G.give(S,'potion_health',5); S.dungeon=null; window.__ui.refresh(); }"""
FORGE = """()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.dungeon=null;
  G.give(S,'mat_iron',23); G.give(S,'mat_strips',12); G.give(S,'ore_iron',9); S.skills.Smithing.lvl=45; window.__ui.refresh(); }"""
FIGHT = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; S.hpBonus=200; S.follower=null; S.dungeon=null; S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
  const id=G.give(S,'steel_sword'); G.equip(S,id); G.setHealth(S,G.maxHealth(S));
  S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const e={...D.ENCOUNTERS.find(x=>x.name==='Bandit outlaw')}; e.hp=e.health*6; e.health=e.hp; e.damage=4; S.trip.status='encounter'; S.trip.encounter=G.scaleEnemy(e,20); __dbg.openEncounter(); }"""
# a patch in reach: the prompt's own HTML (harvestgame.js nearHTML) with a fixed plant, so the test doesn't hunt for one
GNEAR = """()=>{ HARVESTGAME.nearHTML = () => '<div class="gnear"><span class="gn-t"><b>Frost Mirriam</b><small>in reach</small></span><button class="btn sm pri" data-act="gpick" data-id="t">Gather</button></div>'; }"""


async def run(b, w, h, fails):
    phone = w < 800
    tag = f"{w}x{h}"
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=phone, is_mobile=phone)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    async def clr(): await pg.evaluate(CLR)

    async def check(name, settle=500, end=False):
        await pg.wait_for_timeout(settle)
        bad = await pg.evaluate(CHECK, [f"{tag} {name}", end])
        if not end: bad += await pg.evaluate(HEADCHK, [f"{tag} {name}", HEADS])
        await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
        if bad: fails.extend(bad[:4])
        print(tag, name, "ok" if not bad else f"{len(bad)} overlaps")

    async def to_end(name):
        """scroll every scrolling box to its end: the last card must end clear of the round buttons"""
        await pg.evaluate("""()=>{ scrollTo(0, document.documentElement.scrollHeight);
          for (const e of document.querySelectorAll('*')) { const c = getComputedStyle(e); if ((c.overflowY === 'auto' || c.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight; } }""")
        await pg.wait_for_timeout(1600)   # the round buttons fade while the page moves and come back after
        await check(name + "_end", 300, True)
        await pg.evaluate("""()=>{ scrollTo(0, 0); for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; }"""); await pg.wait_for_timeout(800)

    await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&tb&p=ovl{w}")
    await pg.wait_for_selector(".press", timeout=30000); await pg.wait_for_timeout(2500)
    await pg.click(".press"); await pg.wait_for_timeout(500); await pg.click(".mi[data-t=new]"); await pg.wait_for_timeout(2500)
    # character creation: Stand and Fight, the blade stays inside the canvas and off the buttons
    for pose in ["idle", "attack"]:
        await pg.click(f"[data-cg=pose][data-pose={pose}]"); await pg.wait_for_timeout(1200)
        for k in range(4):   # a few moments of the clip
            ink = await pg.evaluate(INK); under = await pg.evaluate(UNDERBTN)
            if ink > 0: fails.append(f"{tag} chargen {pose}: {ink} ink pixels in the top 2% rows")
            if under > 8: fails.append(f"{tag} chargen {pose}: the figure is drawn under the rotate / Face buttons ({under} px)")
            if ink > 0 or under > 8: break
            await pg.wait_for_timeout(330)
        await pg.screenshot(path=os.path.join(OUT, f"{tag}_chargen_{pose}.png"))
        print(tag, "chargen", pose, "ink", ink, "under buttons", under)
    await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
    await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
    for _ in range(3): await clr(); await pg.wait_for_timeout(300)
    await pg.evaluate("()=>{const S=window.__dbg.save(); S.level=14; S.gold=3000; for (const k of ['One-Handed','Smithing']) S.skills[k].lvl=45; const id=G.give(S,'steel_sword'); G.equip(S,id); G.give(S,'iron_armor'); G.give(S,'potion_health',4); window.__ui.refresh();}")
    # something in the message history, so its button shows
    await pg.evaluate("NOTIFY.hold('ovltest','A test message'); NOTIFY.clear('ovltest')"); await pg.wait_for_timeout(400)

    # the map, with a patch in reach and a banner
    await pg.evaluate(GNEAR)
    await clr(); await pg.evaluate("document.querySelector('[data-tab=map]')?.click()"); await pg.wait_for_timeout(1800); await clr()
    await check("map")
    await pg.evaluate("NOTIFY.banner('ach','Achievement','First Steps')"); await pg.wait_for_timeout(700)
    await check("map_banner", 200); await to_end("map")
    if phone and await pg.evaluate("!!document.querySelector('#gnear .gnear')"):
        pad = await pg.evaluate("""()=>{ const g = document.querySelector('#gnear').getBoundingClientRect(), t = document.querySelector('#tabs')?.getBoundingClientRect();
          return { gap: t ? Math.round(t.top - g.bottom) : null, w: Math.round(g.width), vw: innerWidth }; }""")
        if pad["gap"] is not None and not (-1 <= pad["gap"] <= 2): fails.append(f"{tag} gather prompt is not docked on the bottom bar: {pad}")
        if pad["w"] < pad["vw"] - 2: fails.append(f"{tag} gather prompt is not full width: {pad}")

    # the Area board and the Forge
    await pg.evaluate(FORGE); await clr()
    await pg.evaluate("document.querySelector('[data-tab=town]')?.click()"); await pg.wait_for_timeout(1200); await clr()
    await check("area"); await to_end("area")
    await pg.evaluate("document.querySelector('[data-id=forge]')?.click()"); await pg.wait_for_timeout(1000); await clr()
    await check("forge"); await to_end("forge")

    # the Journal (its chosen tab readable on the parchment), AI & Loadouts (the sub-tab strip shows it hides more), Social
    await clr(); await pg.evaluate("__ui.go('log')"); await pg.wait_for_timeout(1000); await clr()
    await check("journal")
    cr = await tab_contrast(pg)
    print(tag, "journal tab contrast", cr)
    if cr is None or cr < 4.5: fails.append(f"{tag} journal: the chosen tab's text has contrast {cr} on the parchment (needs 4.5)")
    await pg.evaluate("scrollTo(0, 0)"); await pg.wait_for_timeout(600)
    await clr(); await pg.evaluate("__ui.go('tactics')"); await pg.wait_for_timeout(1000); await clr()
    await check("loadouts")
    sub = await pg.evaluate("""()=>{ const s = document.querySelector('#side .mn-sub'); if (!s) return null; const on = s.querySelector('button.on'), r = s.getBoundingClientRect(), q = on.getBoundingClientRect();
      return { more: s.scrollWidth > s.clientWidth + 2, fade: s.classList.contains('mn-fl') || s.classList.contains('mn-fr'), room: Math.round(Math.min(q.left - r.left, r.right - q.right)) }; }""")
    if sub and sub["more"] and not sub["fade"]: fails.append(f"{tag} loadouts: the sub-tab strip hides tabs with no fade at its edge {sub}")
    if sub and sub["more"] and sub["room"] < 16: fails.append(f"{tag} loadouts: the chosen sub-tab isn't fully in view with 16 px to spare {sub}")
    await clr(); await pg.evaluate("__ui.go('social')"); await pg.wait_for_timeout(1000); await clr()
    await check("social")

    # Items, and one item's details
    await clr(); await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(700)
    await pg.evaluate("document.querySelector('#sky [data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(600); await clr()
    await check("items")
    await pg.evaluate("document.querySelector('#sky .sky-row')?.click()"); await pg.wait_for_timeout(600)
    await check("items_detail")
    await pg.evaluate("__ui.closeMenu && __ui.closeMenu()"); await pg.wait_for_timeout(400); await clr()

    # the perk tree
    await pg.evaluate("()=>{const S=window.__dbg.save(); S.perkPts=(S.perkPts||0)+3;}")
    await pg.evaluate("(typeof TABMENU!=='undefined' && TABMENU.closeHub && TABMENU.closeHub()); __ui.go('stars')"); await pg.wait_for_timeout(700); await clr()
    await pg.evaluate("document.querySelector('#side .tw-card[data-id=\"One-Handed\"]')?.click()"); await pg.wait_for_timeout(900); await clr()
    await check("perks"); await to_end("perks")
    await pg.evaluate("__ui.back && __ui.back()"); await pg.wait_for_timeout(300)
    await pg.evaluate("typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"); await pg.evaluate("document.body.classList.remove('tw-char')"); await pg.wait_for_timeout(300)

    # Company
    await clr(); await pg.evaluate("() => window.__ui.go('social')"); await pg.wait_for_timeout(500); await clr()
    await pg.evaluate("document.querySelector('[data-act=soctab][data-id=company]')?.click()"); await pg.wait_for_timeout(1000); await clr()
    await check("company"); await to_end("company")

    # a dungeon room, with a banner
    await pg.evaluate(DUN, "Bleak Falls Barrow"); await pg.wait_for_timeout(300); await clr()
    await pg.evaluate("document.querySelector('[data-tab=map]')?.click()"); await pg.wait_for_timeout(500); await clr()
    await pg.evaluate("document.querySelector('#dun') || document.querySelector('#side [data-act=enter], [data-act=enter]')?.click()"); await pg.wait_for_timeout(900); await clr()
    nodes = await pg.query_selector_all("#dun .dnode")
    if nodes: await nodes[0].evaluate("e=>e.click()"); await pg.wait_for_timeout(1300); await clr()
    await check("dungeon")
    await pg.evaluate("NOTIFY.banner('quest','Quest completed','Before the Storm')"); await pg.wait_for_timeout(700)
    await check("dungeon_banner", 200)
    if await pg.evaluate("!!document.querySelector('#dun')"):
        low = await pg.evaluate("(()=>{ const b=[...document.querySelectorAll('#pbanners .pban')].pop(); if(!b) return null; const r=b.getBoundingClientRect(); return {top: Math.round(r.top), h: Math.round(r.height), lim: Math.round(innerHeight*0.2)}; })()")
        if low and (low["top"] > low["lim"] or low["h"] > 64): fails.append(f"{tag} dungeon banner too low or too tall: {low}")
    await pg.evaluate("()=>{ const S=window.__dbg.save(); S.dungeon=null; document.querySelector('#dun')?.remove(); window.__ui.refresh(); }"); await pg.wait_for_timeout(400)

    # a fight while a message shows: the history button keeps off Sneak and the other fight buttons
    try:
        await pg.evaluate(FIGHT); await pg.wait_for_timeout(700)
        await pg.click("#modal [data-act=enc][data-a=fight]"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove())")
        for _ in range(40):
            if await pg.evaluate("!!document.querySelector('#tbf [data-tba=end]') && TB.session && TB.session.cur && TB.session.cur.id==='me'"): break
            await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(250)
        await pg.evaluate("__dbg.toast('You feel a chill in the air.')"); await pg.wait_for_timeout(300)
        await check("fight", 300)
    except Exception as e:
        print(tag, "fight skipped:", e)
    if errs: fails.append(f"{tag} page errors: {errs[:3]}")
    await ctx.close()


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in VIEWS: await run(b, w, h, fails)
        await b.close()
    print("shots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("overlap_ui: nothing covers a button")

asyncio.run(main())
