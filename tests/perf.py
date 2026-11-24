import asyncio, json, sys
from playwright.async_api import async_playwright
SEED = """()=>{
 const S=window.__dbg.save(); S.level=30; S.gold=50000;
 S.pins=[...Array(20)].map((_,i)=>({id:'p'+i,x:0.2+Math.random()*0.6,y:0.2+Math.random()*0.6,label:'Pin '+i,icon:'\ue122'}));
 const IDS=Object.keys(D.ITEMS).filter(k=>!k.startsWith('brew|')&&D.ITEMS[k]&&D.ITEMS[k].slot); for(let i=0;i<300;i++) G.give(S, IDS[i%IDS.length], 1);
 S.discovered=Object.keys(WORLD.places);
 for(let i=0;i<120;i++) S.explored.push([Math.random(),Math.random()]);
 const put=(c,n,f)=>{for(let i=0;i<n;i++) Store.put(c,'x'+c+i,f(i));};
 const now=G.now();
 put('chat',80,i=>({from:'u'+i%9,name:'Player'+i%9,text:'Message number '+i+' about the dragon over Whiterun',ch:'world',t:now-i}));
 put('news',40,i=>({text:'\ue130 Someone did something '+i,t:now-i}));
 put('ladder',40,i=>({name:'P'+i,race:'nord',level:i,gold:i*100,dragons:i%5,cleared:i%9,kills:0,t:now}));
 put('homes',30,i=>({name:'H'+i,race:'nord',level:5,towns:['Whiterun','Riften'],dragons:2,cleared:3,titles:[],show:[],souls:0,t:now}));
 put('bounty',40,i=>({uid:'u'+i,name:'P'+i,week:BOUNTY.week(),c:{foes:3,dungeons:1,arrivals:2,potions:1,dragons:0,jobs:1},t:now}));
 put('hall',40,i=>({name:'P'+i,pts:500+i,t:now}));
 put('clans',10,i=>({name:'Clan '+i,tag:'C'+i,colors:['#8c2b22','#c9a75e'],founder:'xclans'+i,founderName:'F'+i,invites:[],kicked:[],t:now}));
 put('clanmem',40,i=>({clan:'xclans'+(i%10),name:'M'+i,t:now}));
 put('trades',10,i=>({from:'u'+i,fromName:'P'+i,to:'zz',toName:'Q',items:[],gold:10,ask:0,status:'open',t:now}));
 Store.save(S); return JSON.stringify(S).length;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=perf&net=bc&notut"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        for _ in range(5):
            if await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
        print("save bytes:", await pg.evaluate(SEED))
        cdp = await pg.context.new_cdp_session(pg); await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        await pg.wait_for_timeout(2000)
        # tab switch cost
        for t in ["log","town","hero","tactics","map","log"]:
            ms = await pg.evaluate(f"()=>{{const t0=performance.now(); document.querySelector('[data-tab={t}]').click(); return Math.round(performance.now()-t0);}}")
            print(f"tab {t}: {ms} ms")
            for _ in range(3):
                if await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
        # long tasks + frame rate on map
        await pg.evaluate("document.querySelector('[data-tab=map]').click(); scrollTo(0,0)")
        stats = await pg.evaluate("""()=>new Promise(res=>{const long=[]; const ob=new PerformanceObserver(l=>l.getEntries().forEach(e=>long.push(Math.round(e.duration)))); ob.observe({entryTypes:['longtask']});
          let n=0, t0=performance.now(), last=t0, worst=0; const f=(ts)=>{n++; worst=Math.max(worst, ts-last); last=ts; if(ts-t0<5000) requestAnimationFrame(f); else { ob.disconnect(); res({fps: Math.round(n/((ts-t0)/1000)), worstFrame: Math.round(worst), longTasks: long.length, longest: Math.max(0,...long)}); } }; requestAnimationFrame(f);})""")
        print("map 5 s at 4x slower CPU:", stats)
        st2 = await pg.evaluate("""()=>new Promise(res=>{document.querySelector('[data-tab=log]').click(); const long=[]; const ob=new PerformanceObserver(l=>l.getEntries().forEach(e=>long.push(Math.round(e.duration)))); ob.observe({entryTypes:['longtask']}); setTimeout(()=>{ob.disconnect(); res({longTasks: long.length, longest: Math.max(0,...long), total: long.reduce((a,b)=>a+b,0)});}, 5000);})""")
        print("journal open 5 s:", st2)
        print("world bytes in storage:", await pg.evaluate("Object.keys(localStorage).filter(k=>k.includes('sk.w.')).map(k=>k+':'+localStorage.getItem(k).length).join(' ')"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
