import asyncio
from playwright.async_api import async_playwright
exec(open('perf.py').read().split('async def main')[0])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        await pg.goto("http://localhost:8765/index.html?p=perf2&net=bc&notut"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        for _ in range(5):
            if await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
        await pg.evaluate(SEED)
        await pg.evaluate("document.querySelector('[data-tab=log]').click()")
        await pg.wait_for_timeout(1000)
        r = await pg.evaluate("""()=>new Promise(res=>{let n=0; const side=document.querySelector('#side'); const mo=new MutationObserver(()=>n++); mo.observe(side,{childList:true}); 
          const origPut=Store.put; let puts={}; Store.put=function(c,...a){puts[c]=(puts[c]||0)+1; return origPut.call(this,c,...a);}; 
          const origSave=Store.save; let saves=0; Store.save=function(...a){saves++; return origSave.apply(this,a);};
          setTimeout(()=>{mo.disconnect(); Store.put=origPut; Store.save=origSave; res({rebuilds:n, puts, saves});},6000);})""")
        print(r)
        await b.close()
asyncio.run(main())
