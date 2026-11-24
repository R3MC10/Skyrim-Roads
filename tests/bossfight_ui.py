"""Boss fights (bossfight.js) on the real fight screen.
python3 bossfight_ui.py 8765   (serve ../game on that port first; on Windows set PYTHONIOENCODING=utf-8)
Phone 390x844, hand-drawn art (a bandit chief as a dungeon's end boss, and a dragon). Checks: the intro card with
the letterbox bars and the boss's title, the boss bar with its phase marks, a big attack shown a turn ahead (warning
strip + intent chip), the phase banner, the finishing card, the loot card, reduce motion keeps the cards still, nothing
scrolls sideways, no page errors. Screenshots go to tests/out_boss/."""
import asyncio, sys, os
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_boss")
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(x, m):
    print(("ok  " if x else "FAIL"), m)
    if not x: fails.append(m)

START = """([st, kind])=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  try { const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.tbFast=true; localStorage.setItem('rotn_prefs', JSON.stringify(p)); } catch(e){}
  const S=window.__dbg.save(); S.level=25; S.hpBonus=220; S.gold=5000; for (const k of ['One-Handed','Blocking','Heavy Armor','Restoration','Athletics']) S.skills[k].lvl=50;
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  // the toll bandits' leader becomes a dungeon's end boss (or a dragon): one foe, boss-sized
  FOEGROUPS.prep = (f, pl) => {
    if (kind === 'dragon') { f.e.name = 'Dragon'; f.e.tags = ['big','dragon','elite']; f.tags.add('dragon'); }
    else { f.e.name = 'Bandit chief'; f.e.tags = ['humanoid','elite']; }
    f.tags.add('elite'); f.e.boss = true; f.e.level = 25; return { n: 1, hpMul: [1] }; };
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""

LOOK = """()=>{ const el=document.getElementById('tbf'), sess=TB.session, f=sess&&sess.f;
  const ov=[...document.querySelectorAll('.bfov')].map(o=>o.className);
  const chips=[...el.querySelectorAll('.tbint')].map(x=>(x.textContent+' '+(x.dataset.tip||'')).replace(/\\s+/g,' ').trim());
  return { bar: !!el.querySelector('.bfbar'), ticks: el.querySelectorAll('.bftick').length, tele: (el.querySelector('.bftele')||{}).textContent||'',
    ov, chips, phase: f&&f.bf ? f.bf.phase : -1, wide: document.documentElement.scrollWidth - innerWidth, done: !!(sess&&sess.done),
    still: [...document.querySelectorAll('.bfov')].map(o=>getComputedStyle(o.querySelector('.bfcard,.bfpc')||o).animationName) }; }"""

async def shot(pg, name):
    await pg.evaluate("document.querySelectorAll('#obtip').forEach(x=>x.remove())")
    await pg.screenshot(path=os.path.join(OUT, name + ".png"))

async def run(p, style, kind, reduce=False):
    tag = f"{kind}_{style}{'_still' if reduce else ''}"
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, has_touch=True, reduced_motion="reduce" if reduce else "no-preference")
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=bf{tag}&tb&fightanim"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Bossa"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(START, [style, kind]); await pg.wait_for_timeout(400)
    await pg.click("#modal [data-act=ev][data-c=fight]")
    for _ in range(60):
        if await pg.evaluate("!!document.querySelector('.bfov.bfintro')"): break
        await pg.wait_for_timeout(100)
    await pg.wait_for_timeout(250 if reduce else 900)
    s = await pg.evaluate(LOOK)
    await shot(pg, tag + "_1intro")
    ok(any("bfintro" in o for o in s["ov"]), f"{tag}: the intro card shows {s['ov']}")
    if reduce: ok(all(a in ("none", "") for a in s["still"]), f"{tag}: reduce motion: the cards stay still {s['still']}")
    # tap skips it
    await pg.evaluate("document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click())")
    await pg.click(".bfov.bfintro", timeout=3000) if await pg.evaluate("!!document.querySelector('.bfov.bfintro')") else None
    ok(not await pg.evaluate("!!document.querySelector('.bfov.bfintro')"), f"{tag}: a tap skips the intro")
    for _ in range(100):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')"): break
        await pg.wait_for_timeout(200)
    s = await pg.evaluate(LOOK)
    ok(s["bar"] and s["ticks"] >= 1, f"{tag}: the boss bar with {s['ticks']} phase marks")
    # a big attack shown a turn ahead: end turns until it readies one (or force it after a few)
    for i in range(6):
        if await pg.evaluate("!!(TB.session.f.bf.tele)"): break
        await pg.evaluate("document.querySelectorAll('#obtip,.bfov').forEach(x=>x.remove())")
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=end]')"): await pg.click("#tbf [data-tba=end]")
        for _ in range(60):
            if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]') || TB.session.done"): break
            await pg.wait_for_timeout(200)
        await pg.evaluate("()=>{ const f=TB.session.f; f.hp=Math.max(f.hp, G.maxHealth(f.s)*0.8); }")
    forced = False
    if not await pg.evaluate("!!(TB.session.f.bf.tele)"):
        forced = True
        await pg.evaluate("""()=>{ const sess=TB.session, f=sess.f, b=f.bf, key=BOSSFIGHT.teleKey(b); b.tele={key, round:sess.round, idx:sess.idx, meAfter:true};
          const ord=sess.order; let j=0; for (let i=sess.idx;i<ord.length;i++) if (ord[i].id.startsWith('foe')) { f.kit.plan[j]={id:'land', wind:'bf_'+key, bf:'land'}; break; }
          TB.redraw(sess,{turn:'me'}); }""")
    for _ in range(60):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]') || TB.session.done"): break
        await pg.wait_for_timeout(200)
    await pg.evaluate("()=>{ TB.redraw(TB.session,{turn:'me'}); }"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelectorAll('.bfov').forEach(x=>x.remove())")
    s = await pg.evaluate(LOOK)
    await shot(pg, tag + "_2telegraph")
    ok("readies" in s["tele"].lower() and ("shout" in s["tele"].lower()), f"{tag}: the warning strip says what's coming and how to answer ({'forced' if forced else 'real'}): {s['tele'][:90]}")
    ok(any(("readies" in c.lower()) or any(n in c.lower() for n in ["crushing blow", "great breath", "tail sweep", "wide sweep"]) for c in s["chips"]), f"{tag}: an intent chip shows the big attack {s['chips'][:3]}")
    # phase banner: knock it under the first mark
    for _ in range(60):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]') || TB.session.done"): break
        await pg.wait_for_timeout(200)
    await pg.evaluate("()=>{ const sess=TB.session, f=sess.f; f.ehp=Math.min(f.ehp, sess.ehpMax*f.bf.th[0]-1); f.hp=G.maxHealth(f.s); }")
    await pg.evaluate("()=>{ const b=document.querySelector('#tbf [data-tba=attack]'); b&&b.click(); }")
    for _ in range(40):
        if await pg.evaluate("!!document.querySelector('.bfov.bfphase')"): break
        await pg.wait_for_timeout(100)
    await pg.wait_for_timeout(150 if reduce else 450)
    s = await pg.evaluate(LOOK)
    await shot(pg, tag + "_3phase")
    ok(any("bfphase" in o for o in s["ov"]) and s["phase"] >= 1, f"{tag}: the phase banner shows (phase {s['phase'] + 1})")
    # the finishing blow: straight to the last phase with a sliver left
    await pg.evaluate("document.querySelectorAll('.bfov').forEach(x=>x.remove())")
    for _ in range(60):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]') || TB.session.done"): break
        await pg.wait_for_timeout(200)
    await pg.evaluate("()=>{ const sess=TB.session, f=sess.f; f.bf.phase=f.bf.th.length; f.ehp=1; f.hp=G.maxHealth(f.s); f.dStance=null; TB.redraw(sess,{turn:'me'}); }")
    await pg.wait_for_timeout(300)
    for _ in range(4):
        if await pg.evaluate("TB.session.done"): break
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')"): await pg.evaluate("()=>{ const b=document.querySelector('#tbf [data-tba=attack]'); b&&b.click(); }")
        await pg.wait_for_timeout(400)
    for _ in range(60):
        if await pg.evaluate("!!document.querySelector('.bfov.bffin')"): break
        await pg.wait_for_timeout(100)
    await pg.wait_for_timeout(200 if reduce else 800)
    s = await pg.evaluate(LOOK)
    await shot(pg, tag + "_4finisher")
    ok(s["done"] and any("bffin" in o for o in s["ov"]), f"{tag}: the finishing card shows {s['ov']}")
    ok(s["wide"] <= 0, f"{tag}: no sideways scroll ({s['wide']})")
    # the loot card after the fight
    await pg.evaluate("document.querySelectorAll('.bfov').forEach(x=>x.remove())")
    await pg.evaluate("()=>{ const b=document.querySelector('#tbf [data-tbx=done]'); b&&b.click(); }")
    await pg.wait_for_timeout(1200)
    if not await pg.evaluate("!!document.querySelector('.bfov.bfloot')"):
        await pg.evaluate("()=>{ const f=TB.session? TB.session.f : null; }")
    lo = await pg.evaluate("(document.querySelector('.bfov.bfloot')||{}).innerText||''")
    if lo:
        await pg.wait_for_timeout(200 if reduce else 1400)
        await shot(pg, tag + "_5loot")
    ok(bool(lo) and ("gold" in lo.lower() or "loot" in lo.lower()), f"{tag}: the boss loot card shows: {lo[:60]!r}")
    ok(not errs, f"{tag}: no page errors {errs[:2]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        for style in ["ink"]:
            await run(p, style, "chief")
        await run(p, "ink", "dragon")
        await run(p, "ink", "chief", reduce=True)
    print("FAILED " + str(len(fails)) if fails else "bossfight ui: all ok")
    sys.exit(1 if fails else 0)

asyncio.run(main())
