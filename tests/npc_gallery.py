import asyncio, sys, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8782"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await (await b.new_context(viewport={"width": 900, "height": 900})).new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=gal"); await pg.wait_for_timeout(1500)
        for st in ["ink"]:
            u = await pg.evaluate("""(st)=>{ const ppl=[["Whiterun","general"],["Whiterun","blacksmith"],["Whiterun","wizard"],["Whiterun","inn"],["Whiterun","alchemy"],["Whiterun","stables"],["Whiterun","carriage"],["Whiterun","hire"],["Whiterun","notice"],["Whiterun","streets"],["Solitude","streets"],["Windhelm","streets"],["Riften","streets"],
                ["Solitude","general"],["Solitude","wizard"],["Windhelm","arena"],["Riften","fence"],["Riften","inn"],["Markarth","blacksmith"],["Markarth","wizard"],["Winterhold","wizard"],["Morthal","wizard"],["Dawnstar","blacksmith"],["High Hrothgar","greybeard"],["Karthwasten","general"],["Whiterun","hall"]].map(([t,s])=>NPCART.who(t,s));
              const tr=[["Aela the Huntress","Archery"],["Farkas","Heavy Armor"],["Kesh the Leaper","Acrobatics"],["Urag gro-Shub","Mysticism"],["Scouts-Many-Marshes","Light Armor"],["Vex","Lockpicking"],["Danica Pure-Spring","Restoration"],["Brother Tarn","Unarmored"]];
              const S=96, cols=9, all=ppl.length+tr.length+7, c=document.createElement('canvas'); c.width=cols*S; c.height=Math.ceil(all/cols)*S; const g=c.getContext('2d');
              const urls=[...ppl.map(n=>NPCART.portrait(n,S)), ...tr.map(([n,s])=>NPCART.trainer(n,s,S)), ...Object.keys(TOWNS.FOLLOWERS).map(id=>NPCART.follower(id,S))];
              return Promise.all(urls.map(h=>new Promise(r=>{ const m=h.match(/src="([^"]+)"/); const im=new Image(); im.onload=()=>r(im); im.onerror=()=>r(null); im.src=m?m[1]:''; }))).then(ims=>{ ims.forEach((im,i)=>{ if(im) g.drawImage(im,(i%cols)*S,Math.floor(i/cols)*S,S,S); }); return c.toDataURL(); }); }""", st)
            open(f"npc_gallery_{st}.png","wb").write(base64.b64decode(u.split(",")[1]))
        print("errors:", errs); await b.close()
asyncio.run(main())
