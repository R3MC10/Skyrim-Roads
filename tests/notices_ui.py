"""One queue for pop-ups (notices.js), on a phone (390x844) and a PC (1920x1080).
  node serve.js 8765 &   then   python notices_ui.py 8765 [outdir]   — prints RESULT OK.
Checks: a first-time tip, a message and a quest banner that fire together are stacked (no two overlap, none on the top
or bottom bar buttons); with one window open, three more messages (one twice) give one window on screen, two waiting,
and they open one after the other as you close them; during a turn-by-turn fight a message waits until the fight is
over; a combo banner dropped on the action buttons slides above them; a combo banner while Items is open waits until
it closes. Screenshots go to outdir (default: notices_shots in the temp folder)."""
import asyncio, os, sys, tempfile, time
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "notices_shots")
os.makedirs(OUT, exist_ok=True)
# visible notices and key buttons, and which ones touch
OVERLAP = """(()=>{ const v=(e)=>!!e && e.getClientRects().length>0 && getComputedStyle(e).visibility!=='hidden' && getComputedStyle(e).display!=='none' && +getComputedStyle(e).opacity>0.05;
 const N=[...document.querySelectorAll('#hudlane .hl-log .toast:not(.hide), #pbanners .pban:not(.out), #skillup.on, #lvln .lvn, #obtip, #greetask, .rxban, #fhints .fhint:not([hidden])')].filter(v).map(e=>{const r=e.getBoundingClientRect(); return {id:(e.id||e.className).toString().slice(0,24), l:r.left,t:r.top,r:r.right,b:r.bottom};});
 const K=[...document.querySelectorAll((typeof TB!=='undefined' && TB.open) ? '#tbf .tbdock' : '#app .top button, #tabs, #dun .dstrip')].filter(v).map(e=>{const r=e.getBoundingClientRect(); return {id:e.id||e.className.toString().slice(0,20), l:r.left,t:r.top,r:r.right,b:r.bottom};});
 const hit=(a,b)=>a.l<b.r-1&&b.l<a.r-1&&a.t<b.b-1&&b.t<a.b-1; const over=[];
 for(let i=0;i<N.length;i++){ for(let j=i+1;j<N.length;j++) if(hit(N[i],N[j])) over.push(N[i].id+' x '+N[j].id); for(const k of K) if(hit(N[i],k)) over.push(N[i].id+' on '+k.id); }
 return {n:N.map(x=>x.id), over}; })()"""
START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=25; S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
MODAL = "(document.querySelector('#modal h2')||{}).textContent||''"
fails = []


async def run(b, w, h):
    tag = f"{w}x{h}"
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=w < 900)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    def check(c, m):
        print(("ok   " if c else "FAIL ") + tag + " " + m)
        if not c: fails.append(f"{tag}: {m}")
    shot = lambda n: pg.screenshot(path=os.path.join(OUT, f"notices_{tag}_{n}.png"))
    for attempt in range(3):   # a busy machine sometimes stalls a load or a tap: start over
        try:
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&p=nq{w}{attempt}{int(time.time())}"); await pg.wait_for_timeout(2000)
            await pg.click(".press", timeout=20000); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]", timeout=20000); await pg.fill("#nm", "Sigrid", timeout=20000)
            for _ in range(30):
                if await pg.evaluate("!!window.__dbg && !!__dbg.save() && !document.querySelector('#begin')"): break
                await pg.evaluate("document.querySelector('#begin')?.click()"); await pg.wait_for_timeout(1000)
            if await pg.evaluate("!!window.__dbg && !!__dbg.save()"): break
        except Exception as e:
            print("retry start", tag, str(e).splitlines()[0])
    check(await pg.evaluate("typeof NOTICES!=='undefined'"), "notices.js is loaded")
    await pg.wait_for_timeout(3000)
    await pg.evaluate("document.querySelectorAll('#modal,#obtip').forEach(e=>e.remove())")
    await pg.wait_for_timeout(3000)   # let the start-up messages finish (and the last tap age)

    # 1. a first-time tip, a message and a quest banner together: stacked
    await pg.evaluate("()=>{const S=__dbg.save(); S.level=2; S.pendingLevels=1; S.onb=S.onb||{seen:{}}; S.onb.seen={welcome:1}; }")
    for _ in range(30):
        if await pg.evaluate("!!document.querySelector('#obtip')"): break
        await pg.wait_for_timeout(100)
    await pg.evaluate("()=>{ __dbg.toast('You set off for Riverwood.'); POLISH.banner('quest','Quest started','The Golden Claw'); }")
    worst, seen = [], set()
    for _ in range(40):
        await pg.wait_for_timeout(100)
        o = await pg.evaluate(OVERLAP); seen.update(o["n"])
        if o["over"] and not worst: worst = o["over"]
    check(not worst, f"tip, message and banner never overlap or sit on the bar buttons {worst}")
    if not any("pban" in s for s in seen): print("DBG ban", await pg.evaluate("[JSON.stringify(NOTIFY.screen()), NOTIFY.C.queue.map(q=>q.text), NOTIFY.C.showing.ban&&NOTIFY.C.showing.ban.text, document.querySelector('#pbanners')?.className, document.querySelector('#pbanners')?.style.translate, (document.querySelector('#pbanners')?.innerHTML||'').slice(0,80), NOTIFY.history.slice(0,4).map(h=>h.text)]"))
    check(any("obtip" in s for s in seen) and any("pban" in s for s in seen), f"the tip and the banner both showed {sorted(seen)}")
    await shot("1_stacked")
    await pg.evaluate("()=>{document.querySelector('[data-obt=ok]')?.click(); __dbg.save().pendingLevels=0;}")
    await pg.wait_for_timeout(3500)

    # 2. windows: one at a time, the same one once, then in order
    await pg.evaluate("()=>{ __dbg.message('First','The first window.'); }")
    await pg.wait_for_timeout(300)
    await pg.evaluate("()=>{ NOTICES._input(0); __dbg.message('A courier','Three letters for you.'); __dbg.message('A courier','Three letters for you.'); __dbg.message('World event','A dragon is seen near Whiterun.'); }")
    await pg.wait_for_timeout(400)
    check(await pg.evaluate("document.querySelectorAll('#modal').length") == 1 and await pg.evaluate(MODAL) == "First", f"the open window stays ({await pg.evaluate(MODAL)})")
    check(await pg.evaluate("NOTICES.queued") == 2, f"two wait, the courier once ({await pg.evaluate('NOTICES.queued')})")
    await shot("2_one_window")
    order = []
    for _ in range(3):
        await pg.click("#modal [data-act=close]")
        for _ in range(20):
            await pg.wait_for_timeout(100)
            t = await pg.evaluate(MODAL)
            if t: order.append(t); break
    check(order == ["A courier", "World event"], f"they open one after the other as you close them {order}")
    await pg.wait_for_timeout(300)
    check(await pg.evaluate("!document.querySelector('#modal') && NOTICES.queued===0"), "nothing left waiting")

    # 3. a fight: a message waits for it, combo banners keep off the buttons and wait for Items
    for _ in range(3):
        await pg.evaluate(START); await pg.wait_for_timeout(600)
        if await pg.evaluate("!!document.querySelector('#modal [data-act=ev][data-c=fight]')"): break
    await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()")
    for _ in range(40):
        if await pg.evaluate("typeof TB!=='undefined' && TB.open && !!document.querySelector('#tbf .tbdock')"): break
        await pg.wait_for_timeout(150)
    check(await pg.evaluate("TB.open"), "the fight is open")
    await pg.wait_for_timeout(2700)   # the tap that started it is old now
    await pg.evaluate("()=>{ __dbg.message('Quest','Word from Whiterun.'); }")
    await pg.wait_for_timeout(500)
    check(await pg.evaluate("!document.querySelector('#modal') && NOTICES.C.queue.some(q=>q.key==='Quest|Word from Whiterun.')"), "a message during the fight waits " + str(await pg.evaluate("[!!document.querySelector('#modal'), NOTICES.C.queue.map(q=>q.key.slice(0,40))]")))
    # a combo banner dropped right on the action buttons
    await pg.evaluate("""()=>{ const d=document.querySelector('#tbf .tbdock').getBoundingClientRect(); const o=document.createElement('div'); o.className='rxban rx-shatter'; o.innerHTML='<b>Shatter!</b>';
      const z=typeof FITCANVAS!=='undefined'?FITCANVAS.zoom():1; o.style.top=((d.top+20)/z)+'px'; document.body.appendChild(o); }""")
    await pg.wait_for_timeout(600)
    o = await pg.evaluate(OVERLAP)
    check(any("rxban" in s for s in o["n"]) and not any("rxban" in x for x in o["over"]), f"a combo banner slides off the action buttons {o}")
    await shot("3_fight_banner")
    await pg.evaluate("document.querySelectorAll('.rxban').forEach(e=>e.remove())")
    # Items open: a fight tip waits until it closes
    items = await pg.query_selector("#tbf [data-tbm=items]")
    if items and await items.is_visible():
        await items.click(); await pg.wait_for_timeout(500)
    if not await pg.evaluate("!!document.querySelector('#tbf .fc-pick')"):
        await pg.evaluate("()=>{ const d=document.createElement('div'); d.className='tbsheet'; d.style.cssText='position:fixed;inset:40% 0 0 0;z-index:80;background:#111'; d.id='nqfake'; document.body.appendChild(d); }")
        await pg.wait_for_timeout(300)
    ran = await pg.evaluate("NOTICES.fightTip('rx', ()=>{ window.__nqran=1; })")
    check(not ran and not await pg.evaluate("!!window.__nqran"), "a combo banner waits while Items is open")
    await shot("4_fight_items")
    if await pg.evaluate("!!document.querySelector('#nqfake')"): await pg.evaluate("document.querySelector('#nqfake').remove()")
    else:
        await pg.evaluate("document.querySelector('#tbf .fc-pick [data-fcx=cancel], #tbf .fc-pick [data-fcx]')?.click()")
        for _ in range(10):
            await pg.wait_for_timeout(150)
            if not await pg.evaluate("!!document.querySelector('#tbf .fc-pick')"): break
            await pg.keyboard.press("Escape")
    for _ in range(20):
        await pg.wait_for_timeout(100)
        if await pg.evaluate("!!window.__nqran"): break
    check(await pg.evaluate("!!window.__nqran"), "and shows once Items closes")
    # the fight ends: the message opens
    await pg.evaluate("TB.close()")
    t = ""
    for _ in range(80):   # the fight's own result window, and anything that was waiting before ours: close them in turn
        await pg.wait_for_timeout(150)
        t = await pg.evaluate(MODAL); body = await pg.evaluate("(document.querySelector('#modal p')||{}).textContent||''")
        if "Word from Whiterun" in body: break
        if t: await pg.evaluate("(document.querySelector('#modal [data-act=close]')||document.querySelector('#modal button'))?.click()")
    check("Word from Whiterun" in body, f"after the fight the waiting message opens ({t}: {body[:40]})")
    await shot("5_after_fight")
    check(not errs, f"no page errors {errs[:3]}")
    await ctx.close()


async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        for w, h in [(390, 844), (1920, 1080)]: await run(b, w, h)
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL\n" + "\n".join(fails))
    sys.exit(1 if fails else 0)

asyncio.run(main())
