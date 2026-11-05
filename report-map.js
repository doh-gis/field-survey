/* Render one report viewport with CORS-safe raster tiles, attribution and vector geometry. */
(function(){
 'use strict';
 var W=1100,H=560,FRESH=7*86400000;
 function canvas(){var c=document.createElement('canvas');c.width=W;c.height=H;return c}
 function positions(row){var g=geoCoords(row[11]);if(!g)return vc(row[5],row[6])?[[Number(row[6]),Number(row[5])]]:[];return g.type==='Point'?[g.coordinates]:g.type==='Polygon'?(g.coordinates||[]).flat():g.coordinates||[]}
 function valid(p){return Array.isArray(p)&&p.length>=2&&vc(p[1],p[0])}
 function point(p,z){return L.CRS.EPSG3857.latLngToPoint(L.latLng(Math.max(-85.0511,Math.min(85.0511,Number(p[1]))),Number(p[0])),z)}
 async function decode(blob){var u=URL.createObjectURL(blob);try{return await new Promise(function(ok,no){var i=new Image();i.onload=function(){ok(i)};i.onerror=function(){no(new Error('อ่านภาพแผนที่ไม่ได้'))};i.src=u})}finally{URL.revokeObjectURL(u)}}
 async function fetchBlob(url,signal){if(signal.aborted)throw Error('ยกเลิกการโหลดแผนที่');var timer=setTimeout(function(){controller.abort()},12000),controller=new AbortController(),abort=function(){controller.abort()};signal.addEventListener('abort',abort,{once:true});try{var r=await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal});if(!r.ok||r.type==='opaque')throw new Error('โหลดภาพแผนที่ไม่ได้');return await r.blob()}finally{clearTimeout(timer);signal.removeEventListener('abort',abort)}}
 function fallbackCredit(base){if(base==='osm')return'© OpenStreetMap contributors • https://www.openstreetmap.org/copyright';if(base==='topo')return'© OpenStreetMap contributors • SRTM • OpenTopoMap (CC-BY-SA) • https://opentopomap.org';return'Tiles © Esri • Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community'}
 async function credit(key,base,signal){
  if(key==='osm'||key==='topo')return fallbackCredit(key);
  var parts=[];
  for(var config of base.l){var service=config[0].split('/tile/')[0],cache='report-credit:'+service,hit=await kvk('get',cache).catch(function(){return null});
   if(hit&&(navigator.onLine===false||Date.now()-hit.at<FRESH)){parts.push(hit.text);continue}
   if(navigator.onLine===false){parts.push(fallbackCredit(key));continue}
   try{var b=await fetchBlob(service+'?f=pjson',signal),json=JSON.parse(await b.text()),text=String(json.copyrightText||'').replace(/<[^>]+>/g,' ').trim();if(!text)throw Error('No credit');await kvk('put',cache,{at:Date.now(),text:text}).catch(function(){});parts.push(text)}catch(e){parts.push(fallbackCredit(key))}
  }
  return'© Esri • '+Array.from(new Set(parts)).join(' • ');
 }
 function wrap(ctx,text,width){var lines=[],line='';String(text).split(/\s+/).forEach(function(word){if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=word}else line+=(line?' ':'')+word});if(line)lines.push(line);return lines}
 function labelAndCredit(c,attribution,name){var ctx=c.getContext('2d');ctx.font='14px Tahoma, sans-serif';var lines=wrap(ctx,name+' • '+attribution,W-24),height=lines.length*18+12;ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(0,H-height,W,height);ctx.fillStyle='#24344b';lines.forEach(function(t,i){ctx.fillText(t,12,H-height+20+i*18)});ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(W-68,8,60,32);ctx.fillStyle='#172c52';ctx.font='bold 19px Tahoma, sans-serif';ctx.fillText('N ↑',W-58,31)}
 async function remember(key,value){try{await kvk('put',key,value);var index=await kvk('get','report-base-index')||[];index=index.filter(function(k){return k!==key});index.push(key);var remove=index.splice(0,Math.max(0,index.length-8));await qtx(['kv'],'readwrite',function(kv){remove.forEach(function(k){kv.delete(k)});kv.put(index,'report-base-index')})}catch(e){}}
 window.buildReportMap=async function(items,options){
  var check=options.check||function(){},progress=options.progress||function(){},key=BASES[options.base]?options.base:'osm',base=BASES[key],all=items.flatMap(function(i){return positions(i.row)}).filter(valid),c=canvas(),ctx=c.getContext('2d');
  if(!all.length){ctx.fillStyle='#f3f6fb';ctx.fillRect(0,0,W,H);ctx.fillStyle='#52627a';ctx.font='26px Tahoma, sans-serif';ctx.fillText('ไม่มีพิกัดสำหรับแสดงบนแผนที่',40,80);c.reportAttribution='ไม่มีพิกัด';return c}
  var xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;all.forEach(function(p){var v=point(p,0);xmin=Math.min(xmin,v.x);xmax=Math.max(xmax,v.x);ymin=Math.min(ymin,v.y);ymax=Math.max(ymax,v.y)});
  var controller=new AbortController(),attribution=await credit(key,base,controller.signal);check();ctx.font='14px Tahoma, sans-serif';var footerHeight=wrap(ctx,base.n+' • '+attribution,W-24).length*18+12,mapHeight=Math.max(160,H-footerHeight);
  var maxZoom=Math.min.apply(null,base.l.map(function(l){return l[1].maxNativeZoom||l[1].maxZoom||19}));
  var zoom=xmax-xmin<1e-10&&ymax-ymin<1e-10?Math.min(16,maxZoom):Math.max(0,Math.min(maxZoom,Math.floor(Math.min(Math.log2((W-160)/Math.max(xmax-xmin,1e-10)),Math.log2((mapHeight-120)/Math.max(ymax-ymin,1e-10))))));
  var scale=Math.pow(2,zoom),left=(xmin+xmax)/2*scale-W/2,top=(ymin+ymax)/2*scale-mapHeight/2,cacheKey='report-base:'+key+':'+zoom+':'+left.toFixed(5)+':'+top.toFixed(5),cache=await kvk('get',cacheKey).catch(function(){return null});
  check();
  if(cache&&(navigator.onLine===false||Date.now()-cache.at<FRESH)){
   progress('ใช้ภาพแผนที่ฐานที่เก็บไว้ในเครื่อง');ctx.drawImage(await decode(cache.blob),0,0);attribution=cache.attribution;
  }else{
   try{
    check();var completed=0;
    var tx0=Math.floor(left/256),tx1=Math.floor((left+W-1)/256),ty0=Math.floor(top/256),ty1=Math.floor((top+H-1)/256),tiles=(tx1-tx0+1)*(ty1-ty0+1),total=tiles*base.l.length;
    ctx.fillStyle='#dbe7ee';ctx.fillRect(0,0,W,H);
    for(var config of base.l){
     var jobs=[];for(var y=ty0;y<=ty1;y++)for(var x=tx0;x<=tx1;x++)jobs.push({x:x,y:y});var next=0;
     async function worker(){while(next<jobs.length){check();var job=jobs[next++],n=Math.pow(2,zoom);if(job.y<0||job.y>=n){completed++;continue}var wrapped=((job.x%n)+n)%n,s=config[1].subdomains||'abc',url=L.Util.template(config[0],{x:wrapped,y:job.y,z:zoom,s:s[0],r:''}),blob=await fetchBlob(url,controller.signal),im=await decode(blob);if(im.width<64||im.height<64)throw Error('ไม่พบกระเบื้องแผนที่ในเครื่อง');check();ctx.drawImage(im,job.x*256-left,job.y*256-top,256,256);completed++;progress('กำลังโหลดแผนที่ '+completed+'/'+total)}}
     await Promise.all(Array.from({length:Math.min(4,jobs.length)},worker));
    }
    var png=await new Promise(function(ok,no){c.toBlob(function(b){b?ok(b):no(Error('สร้างภาพแผนที่ไม่ได้'))},'image/png')});await remember(cacheKey,{at:Date.now(),blob:png,attribution:attribution});
   }catch(e){controller.abort();check();if(cache){ctx.clearRect(0,0,W,H);ctx.drawImage(await decode(cache.blob),0,0);attribution=cache.attribution;progress('ใช้ภาพแผนที่ที่เก็บไว้ เพราะเครือข่ายไม่พร้อม')}else throw new Error('โหลดแผนที่ฐานไม่ครบ จึงยังไม่สร้างรายงาน กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่ หรือเปลี่ยนชั้นแผนที่ในแท็บแผนที่')}
  }
  check();
  function project(p){var v=point(p,zoom);return[v.x-left,v.y-top]}
  var clusters=[];
  items.forEach(function(item){var r=item.row,g=geoCoords(r[11]),p=positions(r).filter(valid);if(!p.length)return;var points=p.map(project),color=col[r[3]]||'#1d4ba3';ctx.lineWidth=4;ctx.strokeStyle=color;ctx.fillStyle=color;
   if(g&&g.type==='Polygon'){ctx.beginPath();(g.coordinates||[]).forEach(function(ring){ring.filter(valid).forEach(function(v,i){var q=project(v);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.closePath()});ctx.globalAlpha=.15;ctx.fill('evenodd');ctx.globalAlpha=1;ctx.stroke()}
   else if(g&&g.type==='LineString'){ctx.beginPath();points.forEach(function(v,i){i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1])});ctx.stroke()}
   var first=points[0];ctx.beginPath();ctx.arc(first[0],first[1],7,0,Math.PI*2);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();
   var group=clusters.find(function(group){return Math.hypot(group.x-first[0],group.y-first[1])<24});if(!group){group={x:first[0],y:first[1],ids:[]};clusters.push(group)}group.ids.push(r[0]);
  });
  ctx.font='bold 18px Tahoma, sans-serif';ctx.lineJoin='round';clusters.forEach(function(g){var text=g.ids.slice(0,4).join(', ')+(g.ids.length>4?' +'+(g.ids.length-4):''),width=ctx.measureText(text).width,x=Math.min(W-width-12,Math.max(12,g.x+12)),y=Math.max(25,g.y-12);ctx.lineWidth=5;ctx.strokeStyle='#fff';ctx.strokeText(text,x,y);ctx.fillStyle='#163b81';ctx.fillText(text,x,y)});
  labelAndCredit(c,attribution,base.n);c.reportAttribution=base.n+' • '+attribution;return c;
 };
})();
