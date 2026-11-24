"""The house chest (homestash.js) in a real browser at phone (360x780) and PC (1600x900) width, ink style:
every row on both sides (Chest / Your pack) has its item icon, nothing overlaps or runs off the screen, categories and
sort work, Store / Take 1, an amount and all keep the counts right, worn gear isn't listed, and the chest comes back
after a reload. Usage: python3 stash_ui.py PORT   (screenshots go to $OUT or tests/out_stash/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_stash")) + os.sep
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
# one item of every kind in the pack (3 each), another of every kind in the chest (2 each), a sword worn
SETUP = """()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=60000; S.thaneWhiterun=true; S.bounty=null;
 S.homes={...(S.homes||{}), Whiterun:{chest:[],garden:0}}; const by={};
 for(const [k,it] of Object.entries(D.ITEMS)) if(!k.includes('|')&&!it.quest) (by[it.slot]=by[it.slot]||[]).push(k);
 for(const l of Object.values(by)){ G.give(S,l[0],3); if(l[1]) S.homes.Whiterun.chest.push({item:l[1],qty:2,charge:null}); }
 G.give(S,'steel_sword',1); G.equip(S,S.inv.find(r=>r.item==='steel_sword').id); G.give(S,'potion_health',9);
 return Object.keys(by).length }"""
CLEAR = "setInterval(()=>document.querySelectorAll('#modal,.toast,.pbanner,#banner,.pban').forEach(m=>m.remove()),150)"
ICONS = """()=>[...document.querySelectorAll('#side .hs-list .sky-row')].map(r=>{const i=r.querySelector('img.ico'); const b=i&&i.getBoundingClientRect();
  return {n:r.querySelector('.hs-nm')?.innerText||'?', ok:!!i&&b.width>=18&&b.height>=18&&i.complete&&i.naturalWidth>0}})"""
# inside each row: icon, name and the three number columns must not overlap; nothing past the right edge
OVERLAP = """()=>{const W=innerWidth,bad=[];
  for(const r of document.querySelectorAll('#side .hs-list .sky-row')){const p=[r.querySelector('img.ico'),r.querySelector('.hs-nm'),...r.querySelectorAll(':scope>.num')].filter(Boolean).map(e=>e.getBoundingClientRect());
    for(let i=1;i<p.length;i++) if(p[i].left<p[i-1].right-1) bad.push((r.querySelector('.hs-nm')?.innerText||'')+'#'+i);
    if(r.getBoundingClientRect().right>W+1) bad.push('row past edge');}
  for(const e of document.querySelectorAll('#side .hs-box *')){const b=e.getBoundingClientRect(); if(!b.width) continue; let p=e.parentElement,clip=false;
    while(p&&p!==document.body){if(/auto|scroll|hidden/.test(getComputedStyle(p).overflowX)){clip=true;break} p=p.parentElement}
    if(!clip&&b.right>W+1) bad.push((e.className||e.tagName)+'@'+Math.round(b.right));}
  return bad.slice(0,6)}"""
COUNT = "(it)=>{const S=window.__dbg.save(); const h=S.homes.Whiterun; return [S.inv.filter(r=>r.item===it).reduce((a,r)=>a+r.qty,0), h.chest.filter(r=>r.item===it).reduce((a,r)=>a+r.qty,0)]}"
async def run(b, w, h):
    tag = "pc" if w > 1000 else "phone"
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({artStyle:'ink'}))")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    url = f"http://localhost:{PORT}/index.html?net=bc&notut&p=hs{tag}"
    await pg.goto(url); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    kinds = await pg.evaluate(SETUP); await pg.evaluate(CLEAR)
    async def tap(sel):
        try: await pg.click(sel, timeout=4000); await pg.wait_for_timeout(250); return True
        except Exception: return False
    async def open_home():
        await pg.evaluate("window.__ui.go('town')"); await pg.wait_for_timeout(300)
        await tap("[data-act=shop][data-id=home]"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#homechest')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200)
    await open_home()
    ok(await pg.evaluate("!!document.querySelector('#side .hs-box')"), f"{tag}: the chest screen is there")
    # ---- icons on every row, both sides
    for side in ["chest", "pack"]:
        await tap(f"#side [data-op=side][data-id={side}]"); await pg.wait_for_timeout(300)
        rows = await pg.evaluate(ICONS)
        miss = [r["n"] for r in rows if not r["ok"]]
        ok(len(rows) >= (kinds - 2 if side == "chest" else kinds) and not miss, f"{tag}: {side}: {len(rows)} rows, every one has its icon (missing: {miss[:5]})")
        ov = await pg.evaluate(OVERLAP); ok(ov == [], f"{tag}: {side}: nothing overlaps or runs off the screen {ov}")
        ok(await pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"{tag}: {side}: no sideways page scroll")
    # worn sword isn't on Your pack
    names = await pg.evaluate("[...document.querySelectorAll('#side .hs-list .hs-nm')].map(e=>e.innerText)")
    ok(not any(n.startswith("Steel Sword") for n in names), f"{tag}: the worn Steel Sword isn't listed")
    # ---- categories and sort
    await tap("#side .hs-cats [data-id=potions]")
    cat = await pg.evaluate("[...document.querySelectorAll('#side .hs-list .sky-row')].length")
    ok(cat >= 1 and await pg.evaluate("document.querySelector('#side .hs-cats .sky-cat.on')?.dataset.id") == "potions", f"{tag}: Potions filter ({cat} rows)")
    await tap("#side .hs-cats [data-id=all]")
    await tap("#side .hs-sort [data-id=weight]")
    ws = await pg.evaluate("[...document.querySelectorAll('#side .hs-list .sky-row')].map(r=>+r.querySelectorAll(':scope>.num')[1].innerText)")
    ok(len(ws) > 3 and ws == sorted(ws, reverse=True), f"{tag}: sorted by weight, heaviest first")
    await tap("#side .hs-sort [data-id=name]")
    # ---- move potions: Store 1, an amount, all; then Take back
    inv0, ch0 = await pg.evaluate(COUNT, "potion_health"); tot = inv0 + ch0
    await tap("#side .hs-list .sky-row:has-text('Potion of Healing')")
    ok(await pg.evaluate("!!document.querySelector('#side .hs-detail .sky-ico img.ico')"), f"{tag}: details show the icon")
    await tap("#side .hs-detail [data-n='1']")
    i1, c1 = await pg.evaluate(COUNT, "potion_health"); ok(i1 == inv0 - 1 and c1 == ch0 + 1, f"{tag}: Store 1 ({inv0},{ch0}) -> ({i1},{c1})")
    await pg.fill("#hsAmt", "3"); await tap("#side .hs-detail [data-n=amt]")
    i2, c2 = await pg.evaluate(COUNT, "potion_health"); ok(i2 == i1 - 3 and c2 == c1 + 3, f"{tag}: Store 3 -> ({i2},{c2})")
    await pg.evaluate("document.querySelector('#side .hs-detail')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    await pg.screenshot(path=OUT + f"after_{tag}_detail.png")
    await tap("#side .hs-detail [data-act=stash]:has-text('all')")
    i3, c3 = await pg.evaluate(COUNT, "potion_health"); ok(i3 == 0 and c3 == tot, f"{tag}: Store all -> ({i3},{c3})")
    ok(await pg.evaluate("window.__dbg.save().homes.Whiterun.chest.filter(r=>r.item==='potion_health').length") == 1, f"{tag}: the potions are one stack in the chest")
    await tap("#side [data-op=side][data-id=chest]")
    await tap("#side .hs-list .sky-row:has-text('Potion of Healing')")
    await tap("#side .hs-detail [data-n='1']")
    i4, c4 = await pg.evaluate(COUNT, "potion_health"); ok(i4 == 1 and c4 == tot - 1, f"{tag}: Take 1 -> ({i4},{c4})")
    await tap("#side .hs-detail [data-act=unstash]:has-text('all')")
    i5, c5 = await pg.evaluate(COUNT, "potion_health"); ok(i5 == tot and c5 == 0, f"{tag}: Take all -> ({i5},{c5})")
    # a sword into the chest for the reload check
    await tap("#side [data-op=side][data-id=pack]")
    await tap("#side .hs-cats [data-id=weapons]")
    await tap("#side .hs-list .sky-row:has-text('Iron Dagger')")
    await tap("#side .hs-detail [data-act=stash][data-n='1']")
    await tap("#side .hs-cats [data-id=all]")
    await tap("#side [data-op=side][data-id=chest]")
    await pg.evaluate("document.querySelector('#homechest')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(250)
    await pg.screenshot(path=OUT + f"after_{tag}.png")
    chest = await pg.evaluate("JSON.stringify(window.__dbg.save().homes.Whiterun.chest)")
    # ---- reload: the chest comes back the same
    await pg.wait_for_timeout(600)
    await pg.goto(url); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await tap(".mi[data-t=continue]"); await pg.wait_for_timeout(1200); await pg.evaluate(CLEAR)
    chest2 = await pg.evaluate("JSON.stringify((window.__dbg.save().homes||{}).Whiterun?.chest)")
    ok(chest2 == chest, f"{tag}: chest is the same after a reload")
    await open_home()
    rows = await pg.evaluate(ICONS)
    ok(len(rows) > 0 and all(r["ok"] for r in rows), f"{tag}: after reload every chest row still has its icon ({len(rows)})")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        for w, h in [(360, 780), (1600, 900)]: await run(b, w, h)
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
    sys.exit(1 if fails else 0)
asyncio.run(main())
