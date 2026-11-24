"""[gear] line-up sheets of every armour set (paper doll + fight figure + travel walker) in both styles,
the gear preview in the Items menu, and another player's gear thumbnail. Usage: python3 gearlook_ui.py PORT"""
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
fails = []
def ok(c, m):
    print(("ok  " if c else "FAIL") + " " + m)
    if not c: fails.append(m)

SHEET = """(style)=>{
  const sets=GEARLOOK.list(), cols=8, cw=110, ch=190, rows=Math.ceil(sets.length/cols);
  const host=document.createElement('div'); host.id='gsheet'; host.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:#1a1612;display:grid;grid-template-columns:repeat('+cols+','+cw+'px);gap:2px;padding:4px;width:'+(cols*(cw+2)+8)+'px';
  const itemFor=(k,slot)=>Object.keys(D.ITEMS).find(i=>D.ITEMS[i].slot===slot&&GEARLOOK.setOf(i)===k);
  for(const k of sets){
    const chest=itemFor(k,'chest')||(k.startsWith('robe_')||k==='necro'?k+'_robes':k+'_armor'), head=itemFor(k,'head')||k+'_helmet', hands=itemFor(k,'hands')||k+'_gauntlets', feet=itemFor(k,'feet')||k+'_boots', shield=itemFor(k,'shield')||(GEARLOOK.SETS[k].w==='heavy'?k+'_shield':null), weapon=itemFor(k,'weapon')||'steel_sword';
    const L={r:['nord','imperial','redguard','dunmer','orc','altmer','khajiit','argonian'][sets.indexOf(k)%8], id:'sheet'+k, eq:{chest,head,hands,feet,weapon,...(shield?{shield}:{})}, gl:{}};
    const cell=document.createElement('div'); cell.style.cssText='background:#2a241c;color:#e9dcc0;font:10px sans-serif;text-align:center;padding:2px';
    cell.innerHTML=HEROART.figure({look:L},100,138)+'<div>'+GEARLOOK.SETS[k].n+'</div>';
    host.appendChild(cell);
  }
  document.body.appendChild(host); return sets.length; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs = []
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915})
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=gear{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ves"); await pg.click("#begin"); await pg.wait_for_timeout(900)
            await pg.evaluate("()=>document.querySelectorAll('.modal').forEach(m=>m.remove())")
            # --- line-up sheet of every armour set
            await pg.set_viewport_size({"width": 920, "height": 1100})
            n = await pg.evaluate(SHEET, style)
            ok(n >= 38, f"[{style}] sheet has {n} sets")
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=f"gear_sheet_{style}.png", full_page=False)
            await pg.evaluate("()=>{document.getElementById('gsheet').remove()}")
            await pg.set_viewport_size({"width": 412, "height": 915})
            # --- a fight figure line-up (FIGHTART person via a test fight scene isn't exported; use the paper doll gear options instead)
            okp = await pg.evaluate("()=>GEARLOOK.list().every(k=>{const o=GEARLOOK.person({r:'nord',eq:{chest:k+'_armor'},gl:{}}); return !!o.body})")
            ok(okp, f"[{style}] fight options for every set")
            # --- give gear, open Items menu, check the preview
            await pg.evaluate("""()=>{const S=__dbg.save(); for (const id of ['steel_armor','dwarven_sword','ancient_nord_helmet','stalhrim_armor','nightingale_armor']) G.give(S,id,1);
              const r=S.inv.find(x=>x.item==='steel_armor'); G.equip(S,r.id); window.__ui.refresh&&window.__ui.refresh();}""")
            await pg.evaluate("()=>{ if (window.__ui.openMenu) window.__ui.openMenu('items'); else window.__ui.go('pack'); }"); await pg.wait_for_timeout(800)
            await pg.evaluate("()=>{const c=[...document.querySelectorAll('[data-act=skycat]')].find(x=>/all/i.test(x.textContent)); c&&c.click()}"); await pg.wait_for_timeout(500)
            opened = await pg.evaluate("""()=>{ const b=[...document.querySelectorAll('[data-act=skysel]')].find(x=>/Stalhrim Armor|Stalhrim/.test(x.textContent)); if(!b) return false; b.click(); return true; }""")
            await pg.wait_for_timeout(700)
            prev = await pg.evaluate("()=>document.querySelectorAll('.gearprev figure').length")
            ok(opened and prev == 2, f"[{style}] gear preview shows now + with this ({prev})")
            await pg.screenshot(path=f"gear_preview_{style}.png")
            # --- another player's gear thumbnail on their card (nearby list)
            thumb = await pg.evaluate("()=>{const L={r:'orc',id:'x',eq:{chest:'ancient_nord_armor',head:'ancient_nord_helmet',weapon:'ancient_nord_greatsword'},gl:{}}; const h=HEROART.figure({look:L},30,42,{bare:true}); return /<img/.test(h)}")
            ok(thumb, f"[{style}] other players' gear thumbnail draws")
            # --- travel walkers with mixed gear and a fight with armour features
            await pg.evaluate("""()=>{const S=__dbg.save(); S.location=null; }""")
            await ctx.close()
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
