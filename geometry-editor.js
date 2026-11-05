/* COT Field Survey v14: viewport-aware dialog, shape buttons and GPS recenter. */
(function () {
  'use strict';
  var GE = { map:null, tiles:[], nodes:null, shape:null, points:[], type:'LineString',
    target:'form', selected:-1, history:[], mode:'add', busy:false, session:0, location:null };
  var style=document.createElement('style');
  style.textContent=`
  .geometry-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:6px}
  .geometry-choices .geometry-choice{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:0;min-height:68px;padding:9px 4px;font-size:14px}
  .geometry-choice svg{width:25px;height:25px;flex:none}
  .geometry-choice[aria-pressed=true]{background:#153c83!important;color:#fff!important;box-shadow:inset 0 0 0 2px #153c83}
  #geometry-dialog{position:fixed;inset:auto;margin:0;left:calc(var(--ge-left,0px) + (var(--ge-vw,100vw) - min(1000px,96vw))/2);top:calc(var(--ge-top,0px) + var(--ge-vh,100dvh)*.04);padding:0;width:min(1000px,96vw);max-width:none;height:calc(var(--ge-vh,100dvh)*.92);max-height:none;overflow:hidden;box-sizing:border-box;overscroll-behavior:contain}
  #geometry-dialog[open]{display:flex;flex-direction:column;animation:none}
  .ge-head,.ge-foot{padding:12px 14px;flex:none;min-width:0;box-sizing:border-box}.ge-head{border-bottom:1px solid #ccd3df;max-height:48%;overflow:auto;overscroll-behavior:contain}
  .ge-head h2{font-size:18px;margin:0 0 8px}.ge-options,.ge-tools,.ge-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
  .ge-options{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .ge-options label,.ge-shape-field{margin:0;min-width:0;font-size:12px}.ge-options select{margin-top:3px;width:100%;min-width:0;max-width:100%;min-height:44px;font-size:16px;box-sizing:border-box}
  .ge-shape-choices{display:flex;gap:4px;margin-top:3px}.ge-shape-choices button{flex:1;min-width:0;min-height:44px;padding:5px 3px;display:flex;align-items:center;justify-content:center;gap:3px;font-size:12px}.ge-shape-choices svg{width:18px;height:18px}
  .ge-tools{margin-top:8px}.ge-tools button{min-height:40px;padding:6px 10px;font-size:13px;width:auto}
  .ge-tools button[aria-pressed=true]{background:#153c83;color:white}
  #ge-help{font-size:12px;line-height:1.5;margin:8px 0 0;color:inherit;overflow-wrap:anywhere}
  #ge-map{flex:1;min-height:70px;min-width:0;width:100%;overflow:hidden;background:#e6eaf0;touch-action:none}
  #ge-gps-status:empty{display:none}#ge-gps-status{overflow-wrap:anywhere}
  .ge-foot{border-top:1px solid #ccd3df}.ge-foot p{font-size:13px;line-height:1.5;margin:0 0 8px}
  .ge-actions button{flex:1;min-height:44px}#ge-error{color:#b3261e}
  .ge-node-icon,.ge-mid-icon{background:transparent;border:0}
  .ge-node-icon span{display:flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:50%;background:#fff;color:#163b81;border:3px solid #163b81;box-sizing:border-box;font:bold 12px system-ui;box-shadow:0 1px 4px #0005}
  .ge-node-icon.selected span{background:#ffda64;color:#111;border-color:#a34d00;transform:scale(1.15)}
  .ge-mid-icon span{display:flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:50%;background:#fff;color:#163b81;border:2px dashed #163b81;box-sizing:border-box;font:bold 18px system-ui}
  @media(max-width:600px){#geometry-dialog{left:calc(var(--ge-left,0px) + 6px);top:calc(var(--ge-top,0px) + 6px);width:calc(var(--ge-vw,100vw) - 12px);height:calc(var(--ge-vh,100dvh) - 12px);border-radius:12px}.ge-head,.ge-foot{padding:9px 10px}.ge-head{padding-top:max(9px,env(safe-area-inset-top,0px))}.ge-foot{padding-bottom:max(9px,env(safe-area-inset-bottom,0px))}.ge-head h2{font-size:17px}.ge-tools{gap:5px}.ge-tools button{font-size:12px;padding:6px 8px}}
  `;
  document.head.appendChild(style);
  document.body.insertAdjacentHTML('beforeend',`<dialog id="geometry-dialog" aria-labelledby="ge-title">
    <div class="ge-head"><h2 id="ge-title">วาดและแก้ไขรูปทรง</h2>
      <div class="ge-options"><div class="ge-shape-field"><span id="ge-shape-label">รูปทรง</span><input type="hidden" id="ge-type" value="LineString"><div class="ge-shape-choices" role="group" aria-labelledby="ge-shape-label">
      <button type="button" class="s geometry-choice" id="ge-line" data-editor-type="LineString" aria-pressed="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 18 12 6l8 10"/><circle cx="4" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="20" cy="16" r="2"/></svg>เส้น</button>
      <button type="button" class="s geometry-choice" id="ge-polygon" data-editor-type="Polygon" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m4 18 5-13 11 5-2 10z"/></svg>พื้นที่ปิด</button></div></div>
      <label>ชั้นแผนที่<select id="ge-base"></select></label></div>
      <div class="ge-tools" role="group" aria-label="เครื่องมือวาดรูปทรง">
        <button type="button" class="s" id="ge-add" aria-pressed="true">＋ เพิ่มจุด</button>
        <button type="button" class="s" id="ge-edit" aria-pressed="false">แก้ไขจุด</button>
        <button type="button" class="s" id="ge-undo">ย้อนกลับ</button>
        <button type="button" class="d" id="ge-delete" disabled>ลบจุดที่เลือก</button>
        <button type="button" class="s" id="ge-clear">ล้างรูป</button>
        <button type="button" class="s" id="ge-fit">ดูทั้งรูป</button>
        <button type="button" class="s" id="ge-locate">◎ ตำแหน่งของฉัน</button>
      </div><p id="ge-help">แตะแผนที่เพื่อเพิ่มจุด · ลากวงกลมหมายเลขเพื่อย้ายจุด · แตะ + ระหว่างจุดเพื่อแทรกจุด</p>
    </div><div id="ge-map" aria-label="แผนที่วาดเส้นและพื้นที่"></div>
    <div class="ge-foot"><p id="ge-status" role="status"></p><p id="ge-gps-status" role="status"></p><p id="ge-error" role="alert"></p>
      <div class="ge-actions"><button type="button" class="s" id="ge-cancel">ยกเลิก</button><button type="button" class="p" id="ge-apply">ใช้รูปทรงนี้</button></div>
    </div></dialog>`);
  var dialog=$('geometry-dialog');
  var scrollLock=null;
  function syncViewport(){
    var v=window.visualViewport;
    dialog.style.setProperty('--ge-vh',(v?v.height:window.innerHeight)+'px');
    dialog.style.setProperty('--ge-vw',(v?v.width:window.innerWidth)+'px');
    dialog.style.setProperty('--ge-top',(v?v.offsetTop:0)+'px');
    dialog.style.setProperty('--ge-left',(v?v.offsetLeft:0)+'px');
  }
  addEventListener('resize',syncViewport);
  if(window.visualViewport){visualViewport.addEventListener('resize',syncViewport);visualViewport.addEventListener('scroll',syncViewport)}
  function blurControl(){var a=document.activeElement;if(a&&typeof a.blur==='function')a.blur()}
  function closeEditor(){
    blurControl();GE.session++;dialog.close();
  }
  dialog.addEventListener('close',function(){
    if(scrollLock){document.documentElement.style.overflow=scrollLock.html;document.body.style.overflow=scrollLock.body;scrollLock=null}
    $('ge-locate').disabled=false;$('ge-locate').textContent='◎ ตำแหน่งของฉัน';
  });
  function copy(v){return JSON.parse(JSON.stringify(v))}
  function geometry(){
    var c=copy(GE.points);
    if(GE.type==='Polygon'&&c.length>=3)c.push(c[0].slice());
    return {type:GE.type,coordinates:GE.type==='Polygon'?[c]:c};
  }
  function checkpoint(){GE.history.push(copy(GE.points));if(GE.history.length>80)GE.history.shift()}
  function valid(){
    return GE.points.length >= (GE.type==='Polygon'?3:2) && GE.points.every(function(p){return p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90}) && new Set(GE.points.map(function(p){return p.join(',')})).size >= (GE.type==='Polygon'?3:2);
  }
  function updateStatus(){
    $('ge-status').textContent=GE.points.length+' จุด'+(valid()?' · '+geoMeasure(geometry()):' · ต้องมีอย่างน้อย '+(GE.type==='Polygon'?3:2)+' จุดที่ต่างกัน')+(GE.selected>=0?' · เลือกจุด '+(GE.selected+1):'');
    $('ge-delete').disabled=GE.selected<0;
    $('ge-undo').disabled=!GE.history.length;
    $('ge-clear').disabled=!GE.points.length;
    $('ge-fit').disabled=!GE.points.length;
    $('ge-apply').disabled=!valid();
    $('ge-error').textContent='';
  }
  function shape(){
    if(GE.shape){GE.map.removeLayer(GE.shape);GE.shape=null}
    if(GE.points.length>1){
      var ll=GE.points.map(function(p){return[p[1],p[0]]});
      GE.shape=GE.type==='Polygon'&&GE.points.length>=3?L.polygon(ll,{color:'#d52b37',weight:4,fillOpacity:.16,interactive:false}):L.polyline(ll,{color:'#d52b37',weight:4,interactive:false});
      GE.shape.addTo(GE.map);
    }
  }
  function nodeIcon(index){return L.divIcon({className:'ge-node-icon'+(GE.selected===index?' selected':''),html:'<span>'+(index+1)+'</span>',iconSize:[26,26],iconAnchor:[13,13]})}
  function render(){
    shape();GE.nodes.clearLayers();
    GE.points.forEach(function(p,i){
      var marker=L.marker([p[1],p[0]],{icon:nodeIcon(i),draggable:true,autoPan:true,bubblingMouseEvents:false,title:'จุด '+(i+1)+' — ลากเพื่อย้าย หรือแตะเพื่อเลือก',alt:'จุด '+(i+1)}).addTo(GE.nodes);
      marker.on('click',function(){GE.selected=i;render()});
      marker.on('dragstart',function(){GE.busy=true;GE.selected=i;checkpoint()});
      marker.on('drag',function(){var ll=marker.getLatLng();GE.points[i]=[ll.lng,ll.lat];shape();updateStatus()});
      marker.on('dragend',function(){render();setTimeout(function(){GE.busy=false},0)});
    });
    var count=GE.type==='Polygon'&&GE.points.length>=3?GE.points.length:GE.points.length-1;
    for(var i=0;i<count;i++) midpoint(i,(i+1)%GE.points.length);
    updateStatus();
  }
  function midpoint(a,b){
    // Use projected midpoint so the handle stays visually on the drawn segment.
    var p=GE.map.project([GE.points[a][1],GE.points[a][0]]),q=GE.map.project([GE.points[b][1],GE.points[b][0]]),mid=GE.map.unproject(p.add(q).divideBy(2));
    var m=L.marker(mid,{icon:L.divIcon({className:'ge-mid-icon',html:'<span>+</span>',iconSize:[22,22],iconAnchor:[11,11]}),draggable:true,autoPan:true,bubblingMouseEvents:false,title:'แทรกจุดระหว่าง '+(a+1)+' และ '+(b+1),alt:'เพิ่มจุดระหว่างเส้น'}).addTo(GE.nodes);
    m.on('click',function(){checkpoint();var ll=m.getLatLng();GE.points.splice(a+1,0,[ll.lng,ll.lat]);GE.selected=a+1;render()});
    m.on('dragstart',function(){GE.busy=true;checkpoint();var ll=m.getLatLng();GE.points.splice(a+1,0,[ll.lng,ll.lat]);GE.selected=a+1});
    m.on('drag',function(){var ll=m.getLatLng();GE.points[a+1]=[ll.lng,ll.lat];shape();updateStatus()});
    m.on('dragend',function(){render();setTimeout(function(){GE.busy=false},0)});
  }
  function setMode(mode){GE.mode=mode;$('ge-add').setAttribute('aria-pressed',String(mode==='add'));$('ge-edit').setAttribute('aria-pressed',String(mode==='edit'))}
  function setBase(){
    GE.tiles.forEach(function(t){GE.map.removeLayer(t)});GE.tiles=[];
    var base=BASES[$('ge-base').value]||BASES.osm;
    base.l.forEach(function(config){GE.tiles.push(L.tileLayer(config[0],config[1]).addTo(GE.map))});
  }
  function fit(){if(!GE.points.length)return;GE.map.fitBounds(L.latLngBounds(GE.points.map(function(p){return[p[1],p[0]]})).pad(.2),{maxZoom:18,animate:false})}
  function refreshForm(){
    $('gtype').value=GFORM?GFORM.type:'Point';$('gdraw').disabled=!GFORM;
    document.querySelectorAll('[data-geometry-type]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.geometryType===$('gtype').value))});
    $('gmsg').textContent=GFORM?'บันทึกรูปทรงในแบบฟอร์มแล้ว · '+geoMeasure(GFORM)+' · กดเปิดหน้าต่างเพื่อแก้ไข':'จุดสำรวจจะใช้พิกัดด้านบนตามปกติ';
  }
  window.geometryFormRefresh=refreshForm;
  function refreshEditorType(){
    $('ge-type').value=GE.type;
    document.querySelectorAll('[data-editor-type]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.editorType===GE.type))});
  }
  window.geometryEditorOpen=function(target,type,g){
    if(!window.L){toast('แผนที่ยังโหลดไม่สำเร็จ กรุณาลองใหม่');if(target==='form')refreshForm();return}
    if(dialog.open)return;
    GE.session++;GE.target=target;GE.type=type==='Polygon'?'Polygon':'LineString';GE.selected=-1;GE.history=[];GE.busy=false;
    GE.points=g&&g.type!=='Point'?copy(g.type==='Polygon'?g.coordinates[0].slice(0,-1):g.coordinates):[];
    refreshEditorType();setMode(GE.points.length?'edit':'add');
    $('ge-gps-status').textContent='';$('ge-locate').disabled=false;$('ge-locate').textContent='◎ ตำแหน่งของฉัน';
    if(GE.location)GE.location.clearLayers();
    $('ge-base').innerHTML=Object.keys(BASES).map(function(k){return '<option value="'+k+'">'+esc(BASES[k].n)+'</option>'}).join('');
    $('ge-base').value=BASES[BV]?BV:'osm';
    if(GE.nodes)GE.nodes.clearLayers();
    if(GE.shape){GE.map.removeLayer(GE.shape);GE.shape=null}
    blurControl();syncViewport();
    scrollLock={html:document.documentElement.style.overflow,body:document.body.style.overflow};
    document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
    dialog.showModal();
    if(!GE.map){
      GE.map=L.map('ge-map',{doubleClickZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([cur&&isFinite(cur.lat)?cur.lat:14.6,cur&&isFinite(cur.lng)?cur.lng:101],15);
      GE.nodes=L.layerGroup().addTo(GE.map);
      GE.location=L.layerGroup().addTo(GE.map);
      GE.map.on('click',function(e){if(GE.mode!=='add'||GE.busy)return;if(GE.points.length>=5000){$('ge-error').textContent='รูปทรงรองรับไม่เกิน 5,000 จุด';return}checkpoint();GE.points.push([e.latlng.lng,e.latlng.lat]);GE.selected=GE.points.length-1;render()});
      GE.map.on('zoomend',function(){if(!GE.busy)render()});
      if(window.ResizeObserver)new ResizeObserver(function(){if(dialog.open)GE.map.invalidateSize({pan:false})}).observe($('ge-map'));
    }
    setBase();
    GE.map.invalidateSize({pan:false});render();
    if(GE.points.length)fit();else{var lat=parseFloat($(target==='edit'?'elat':'lat').value),lng=parseFloat($(target==='edit'?'elng':'lng').value);GE.map.setView(vc(lat,lng)?[lat,lng]:[cur&&isFinite(cur.lat)?cur.lat:14.6,cur&&isFinite(cur.lng)?cur.lng:101],vc(lat,lng)?18:15,{animate:false})}
  };
  $('ge-add').onclick=function(){setMode('add')};$('ge-edit').onclick=function(){setMode('edit')};
  document.querySelectorAll('[data-editor-type]').forEach(function(b){b.onclick=function(){GE.type=b.dataset.editorType;refreshEditorType();render()}});
  $('ge-base').onchange=setBase;
  $('ge-undo').onclick=function(){if(!GE.history.length)return;GE.points=GE.history.pop();GE.selected=-1;render()};
  $('ge-delete').onclick=function(){if(GE.selected<0)return;checkpoint();GE.points.splice(GE.selected,1);GE.selected=-1;render()};
  $('ge-clear').onclick=function(){if(!GE.points.length)return;checkpoint();GE.points=[];GE.selected=-1;setMode('add');render()};
  $('ge-fit').onclick=fit;
  $('ge-locate').onclick=function(){
    if(!navigator.geolocation){$('ge-gps-status').textContent='อุปกรณ์นี้ไม่รองรับการหาตำแหน่ง';return}
    var session=GE.session,button=this;button.disabled=true;button.textContent='กำลังค้นหา…';$('ge-gps-status').textContent='กำลังหาตำแหน่งปัจจุบัน…';
    navigator.geolocation.getCurrentPosition(function(p){
      if(session!==GE.session||!dialog.open)return;
      var lat=p.coords.latitude,lng=p.coords.longitude,accuracy=p.coords.accuracy;
      if(!vc(lat,lng)){finish('ไม่สามารถอ่านพิกัดปัจจุบันได้');return}
      GE.location.clearLayers();
      if(Number.isFinite(accuracy))L.circle([lat,lng],{radius:accuracy,color:'#2563eb',weight:1,fillOpacity:.08,interactive:false}).addTo(GE.location);
      L.circleMarker([lat,lng],{radius:7,color:'#fff',weight:3,fillColor:'#2563eb',fillOpacity:1,interactive:false}).addTo(GE.location);
      GE.map.setView([lat,lng],Math.max(16,GE.map.getZoom()),{animate:false});
      finish('ตำแหน่งของฉัน'+(Number.isFinite(accuracy)?' · ความแม่นยำ ±'+Math.round(accuracy)+' ม.':''));
    },function(e){
      if(session!==GE.session||!dialog.open)return;
      finish(e.code===1?'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์':e.code===3?'หาตำแหน่งไม่ทันเวลา กรุณาลองอีกครั้ง':'ยังหาตำแหน่งไม่ได้ กรุณาลองในที่โล่ง');
    },{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
    function finish(message){button.disabled=false;button.textContent='◎ ตำแหน่งของฉัน';$('ge-gps-status').textContent=message}
  };
  function cancel(){closeEditor();if(GE.target==='form')refreshForm()}
  $('ge-cancel').onclick=cancel;
  dialog.addEventListener('cancel',function(e){e.preventDefault();cancel()});
  $('ge-apply').onclick=function(){
    if(!valid())return;
    var g=geometry(),p=GE.points[0];
    if(GE.target==='edit'){
      EGEOM=g;$('elat').value=p[1].toFixed(6);$('elng').value=p[0].toFixed(6);
      $('egeom').textContent='รูปทรงปัจจุบัน: '+(g.type==='Polygon'?'พื้นที่ปิด':'เส้น')+' · '+geoMeasure(g);
      $('em').textContent='แก้ไขรูปทรงแล้ว กดบันทึกการแก้ไขเพื่อส่งข้อมูล';
    }else{
      GFORM=g;$('lat').value=p[1].toFixed(6);$('lng').value=p[0].toFixed(6);$('acc').value='';accUI(NaN);refreshForm();
    }
    closeEditor();
  };
  document.querySelectorAll('[data-geometry-type]').forEach(function(b){b.onclick=function(){var t=b.dataset.geometryType;if(t==='Point'){GFORM=null;refreshForm()}else geometryEditorOpen('form',t,GFORM)}});
  $('gdraw').onclick=function(){geometryEditorOpen('form',GFORM?GFORM.type:$('gtype').value,GFORM)};
  refreshForm();
})();
