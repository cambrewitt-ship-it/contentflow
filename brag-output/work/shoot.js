const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const path=require('path');
(async()=>{
  const mode=process.argv[2];const V=!!process.env.VERT;const W=V?1080:1920,H=V?1920:1080;const FD=V?'frames_v':'frames';const SD=V?'stills_v':'stills'; // "stills t1,t2,..." or "frames"
  const b=await chromium.launch({args:['--allow-file-access-from-files']});
  const pg=await b.newPage({viewport:{width:W,height:H}});
  pg.on('console',m=>console.log('console:',m.text()));pg.on('pageerror',e=>console.log('ERR',e.message));
  await pg.goto('file://'+path.resolve('brag.html')+(V?'?v':''));
  await pg.evaluate(()=>window.ready);
  if(mode==='stills'){
    for(const t of process.argv[3].split(',').map(Number)){
      await pg.evaluate(t=>render(t),t);
      await pg.screenshot({path:`${SD}/s_${t.toFixed(2)}.jpg`,quality:80,type:'jpeg'});
    }
  } else {
    const fps=30,dur=26,N=Math.round(fps*dur);
    for(let i=0;i<N;i++){
      await pg.evaluate(t=>render(t),i/fps);
      await pg.screenshot({path:`${FD}/f_${String(i).padStart(4,'0')}.png`});
      if(i%60===0)console.log('frame',i);
    }
  }
  await b.close();
})();
