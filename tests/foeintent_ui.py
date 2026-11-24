"""Foe intents with a target (foeintent.js) on the real fight screen.
python3 foeintent_ui.py 8765   (serve ../game on that port first)
Phone 390x844 and desktop 1920x1080, ink and pixel art, alone and with Lydia. Checks: every intent chip names its
target ("→ you" / "→ Lydia"), the crosshair badge sits on the targeted card, the arrow is drawn in the battle scene,
nothing scrolls sideways, no page errors, reduce motion stops the animations, and after End turn the foe hits the one
its intent showed. Screenshots go to tests/out_foeintent/."""
import asyncio, sys, os
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_foeintent")
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(x, m):
    print(("ok  " if x else "FAIL"), m)
    if not x: fails.append(m)

START = """([st, lydia])=>{ ART.setStyle(st); document.querySelectorAll('#modal').forEach(m=>m.remove());
  try { const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.tbFast=true; localStorage.setItem('rotn_prefs', JSON.stringify(p)); } catch(e){}
  const S=window.__dbg.save(); S.level=20; S.gold=5000; S.thaneWhiterun=true; for (const k of ['One-Handed','Destruction','Restoration','Athletics','Acrobatics']) S.skills[k].lvl=45;
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  if (lydia) { S.location = TOWNS.FOLLOWERS.lydia[1]; TOWNS.hire(S, 'lydia'); }
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""

# what the screen shows right now
LOOK = """()=>{ const el=document.getElementById('tbf'), sess=TB.session, f=sess.f;
  const chips=[...el.querySelectorAll('.tbint')], tg=[...el.querySelectorAll('.tbint .fitg')].map(x=>x.textContent.trim());
  const sum=FOEINTENT.summary(sess), nx=sum.next;
  const card=(k)=> k===FOEINTENT.myKey(sess) ? el.querySelector('.tbu.me') : el.querySelector(`.tbu.ally[data-ally="${f.allies.findIndex(a=>FOEINTENT.keyOf(a)===k)}"]`);
  const badges=[...el.querySelectorAll('.fitm')];
  const onCards=[...sum.by.keys()].every(k=>{ const c=card(k); return !c || !!c.querySelector('.fitm'); });
  const b0=badges[0]?.getBoundingClientRect(), c0=badges[0]?.parentElement.getBoundingClientRect();
  const arrow=el.querySelector('.tbstage svg.fitarrow');
  return { chips: chips.length, tg, next: nx && { k: nx.k, n: nx.n }, keys:[...sum.by.keys()], badges: badges.length, onCards,
    inside: !b0 || (b0.left>=c0.left-1 && b0.right<=c0.right+1 && b0.top>=c0.top-1),
    arrow: !!arrow && !!arrow.querySelector('path.ln'), nextCard: !!el.querySelector('.fit-next'),
    wide: document.documentElement.scrollWidth - innerWidth,
    anim: arrow ? getComputedStyle(arrow.querySelector('path.ln')).animationName : null,
    tips: badges.map(b=>b.getAttribute('data-tip')) }; }"""

async def run(p, W, H, style, lydia, reduce=False):
    tag = f"{style}_{W}_{'lydia' if lydia else 'solo'}{'_still' if reduce else ''}"
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=1, has_touch=W < 800, reduced_motion="reduce" if reduce else "no-preference")
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fi{tag}&tb&fightanim"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Reader"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(START, [style, lydia]); await pg.wait_for_timeout(400)
    await pg.click("#modal [data-act=ev][data-c=fight]")
    for _ in range(100):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')"): break
        await pg.wait_for_timeout(200)
    await pg.evaluate("document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click()); document.querySelectorAll('#obtip').forEach(x=>x.remove())")
    await pg.wait_for_timeout(1200)
    # with Lydia, make sure one shot has a blow at her (the roll is random; the screen must follow whatever it says)
    if lydia:
        await pg.evaluate("""()=>{ const f=TB.session.f, L=f.allies.find(a=>a.follower); const its=FIGHTREAD.intents(TB.session), i=its.findIndex(it=>it.tgt); if (L && i>=0 && !its.some(it=>it.tgt&&it.tgt.k===FOEINTENT.keyOf(L))) { f.foeTgts[i]={k:FOEINTENT.keyOf(L), n:L.name, kind:'follower'}; } TB.redraw(TB.session, { turn: "me" }); }""")
        await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelectorAll('#obtip').forEach(x=>x.remove())")
    s = await pg.evaluate(LOOK)
    await pg.screenshot(path=os.path.join(OUT, tag + ".png"))
    ok(s["chips"] > 0 and len(s["tg"]) > 0 and all(t.startswith("→ ") for t in s["tg"]), f"{tag}: intent chips name a target {s['tg']}")
    if lydia: ok(any("Lydia" in t for t in s["tg"]), f"{tag}: a chip reads '→ Lydia'")
    else: ok(all(t == "→ you" for t in s["tg"]), f"{tag}: alone, every chip reads '→ you'")
    ok(s["badges"] >= 1 and s["onCards"] and s["inside"], f"{tag}: crosshair badge on each targeted card ({s['badges']}) {s['tips'][:1]}")
    ok(s["arrow"] and s["nextCard"], f"{tag}: arrow in the scene and the next target outlined")
    ok(s["wide"] <= 0, f"{tag}: no sideways scroll ({s['wide']})")
    if reduce: ok(s["anim"] in (None, "none"), f"{tag}: reduce motion stops the arrow's animation ({s['anim']})")
    # End turn: the foe's next blow lands on the one shown
    if not reduce:
        await pg.evaluate("""()=>{ window.__hits=[]; const dn=FOEINTENT.done, nx=FOEINTENT.next; FOEINTENT.next=(sess,r)=>{ const shown=sess.f.foeTgts&&sess.f.foeTgts[0]?{...sess.f.foeTgts[0]}:null; FOEINTENT.refresh(sess); const now=sess.f.foeTgts&&sess.f.foeTgts[0]?{...sess.f.foeTgts[0]}:null; const d=nx(sess,r); window.__hits.push({shown, now, d}); return d; };
          FOEINTENT.done=(sess)=>{ const h=window.__hits[window.__hits.length-1]; if (h) h.hit = sess.f.tgtHit===undefined ? 'none' : FOEINTENT.keyOf(sess.f.tgtHit); return dn(sess); }; }""")
        await pg.click("#tbf [data-tba=end]")
        for _ in range(60):
            if await pg.evaluate("(window.__hits||[]).length>0 && !!document.querySelector('#tbf [data-tba=attack]') || TB.session.done"): break
            await pg.wait_for_timeout(250)
        hits = await pg.evaluate("window.__hits")
        good = [h for h in hits if h.get("hit") not in (None, "none")]
        ok(len(good) > 0 and all(h["hit"] == h["d"]["k"] and (h["now"] is None or h["now"]["k"] == h["d"]["k"]) for h in good), f"{tag}: the foe hit who its intent showed {[(h['d']['n'], h['hit']) for h in good]}")
        await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelectorAll('#obtip').forEach(x=>x.remove())")
        await pg.screenshot(path=os.path.join(OUT, tag + "_after.png"))
    ok(not errs, f"{tag}: no page errors {errs[:2]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        for style in ["ink", "pixel"]:
            for W, H in [(390, 844), (1920, 1080)]:
                for lydia in [False, True]:
                    await run(p, W, H, style, lydia)
        await run(p, 360, 740, "pixel", True, reduce=True)
    print("FAILED " + str(len(fails)) if fails else "foeintent ui: all ok")
    sys.exit(1 if fails else 0)

asyncio.run(main())
