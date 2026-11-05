/* KML 2.2 and compressed KMZ (doc.kml); local/offline geometry export. */
(function(){
 'use strict';
 var scope='filtered',busy=false;
 document.body.insertAdjacentHTML('beforeend','<dialog id="kml-dialog" aria-labelledby="kml-title"><h2 id="kml-title" tabindex="-1">ส่งออก KML / KMZ</h2><div class="export-scope" role="group" aria-label="ข้อมูลที่ส่งออก"><button type="button" class="s" data-kml-scope="project" aria-pressed="false">ทั้งโครงการ</button><button type="button" class="s" data-kml-scope="filtered" aria-pressed="true">ตามตัวกรองแผนที่</button></div><p class="hint">ส่งออกจุด เส้น และพื้นที่จริง พร้อมข้อมูลสำรวจ รองรับเปิดใน Google Earth หรือโปรแกรม GIS ไม่รวมไฟล์รูป เสียง และวิดีโอ</p><div class="row"><button type="button" class="p" id="download-kml">ดาวน์โหลด KML</button><button type="button" class="s" id="download-kmz">ดาวน์โหลด KMZ</button></div><p id="kml-status" role="status" class="hint"></p><button type="button" class="s" id="kml-close">ปิด</button></dialog>');
 function chosen(){return scope==='project'?S:vis()}
 function count(){$('kml-status').textContent=chosen().length+' รายการที่เลือก'}
 $('kml-export').onclick=function(){count();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();$('kml-dialog').showModal();$('kml-title').focus({preventScroll:true})};
 document.querySelectorAll('[data-kml-scope]').forEach(function(b){b.onclick=function(){if(busy)return;scope=b.dataset.kmlScope;document.querySelectorAll('[data-kml-scope]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});count()}});
 $('kml-close').onclick=function(){if(!busy)$('kml-dialog').close()};$('kml-dialog').addEventListener('cancel',function(e){if(busy)e.preventDefault()});
 function xml(v){return String(v==null?'':v).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]})}
 function pos(p){return Array.isArray(p)&&p.length>=2&&p[0]!==null&&p[1]!==null&&p[0]!==''&&p[1]!==''&&vc(p[1],p[0])&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))}
 function tuple(p){return Number(p[0])+','+Number(p[1])+',0'}
 function ring(points,outer){
  if(!Array.isArray(points)||points.length<3||!points.every(pos))throw Error('พิกัดพื้นที่ไม่ครบ');
  var a=points.map(function(p){return[Number(p[0]),Number(p[1])]});if(a[0][0]===a[a.length-1][0]&&a[0][1]===a[a.length-1][1])a.pop();
  if(new Set(a.map(function(p){return p.join(',')})).size<3)throw Error('พื้นที่ต้องมี 3 จุดที่ต่างกัน');
  var area=a.reduce(function(total,p,i){var q=a[(i+1)%a.length];return total+p[0]*q[1]-q[0]*p[1]},0);if(outer?area<0:area>0)a.reverse();a.push(a[0].slice());
  return'<LinearRing><coordinates>'+a.map(tuple).join(' ')+'</coordinates></LinearRing>';
 }
 function geometry(row){
  var g=geoCoords(row[11]);if(!g)g={type:'Point',coordinates:[row[6],row[5]]};
  if(g.type==='Point'){if(!pos(g.coordinates))throw Error('พิกัดจุดไม่ถูกต้อง');return'<Point><altitudeMode>clampToGround</altitudeMode><coordinates>'+tuple(g.coordinates)+'</coordinates></Point>'}
  if(g.type==='LineString'){if(!Array.isArray(g.coordinates)||g.coordinates.length<2||!g.coordinates.every(pos))throw Error('พิกัดเส้นไม่ครบ');return'<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>'+g.coordinates.map(tuple).join(' ')+'</coordinates></LineString>'}
  if(g.type==='Polygon'){if(!Array.isArray(g.coordinates)||!g.coordinates.length)throw Error('พื้นที่ไม่มีวงรอบ');return'<Polygon><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><outerBoundaryIs>'+ring(g.coordinates[0],true)+'</outerBoundaryIs>'+g.coordinates.slice(1).map(function(r){return'<innerBoundaryIs>'+ring(r,false)+'</innerBoundaryIs>'}).join('')+'</Polygon>'}
  throw Error('รูปทรงไม่รองรับ');
 }
 function style(status){return Object.prototype.hasOwnProperty.call(col,status)?status:'Completed'}
 function data(name,label,value){return'<Data name="'+xml(name)+'"><displayName>'+xml(label)+'</displayName><value>'+xml(value)+'</value></Data>'}
 function build(rows,project){
  var skipped=[],placemarks=[];
  rows.forEach(function(r){try{
   var g=geometry(r),time=new Date(r[8]),extra=[data('id','รหัสรายการ',r[0]),data('type','ประเภท',r[1]),data('surveyor','ผู้สำรวจ',r[2]),data('status','สถานะ',st(r[3])),data('date','วันสำรวจ',Number.isFinite(time.getTime())?time.toISOString():r[8]),data('description','รายละเอียด',r[7]),data('photos','ภาพที่ส่งแล้ว/ทั้งหมด',r[4]+'/'+r[9])];
   (project.fields||[]).forEach(function(f){extra.push(data('custom.'+f.key,f.label,(r[10]||{})[f.key]||''))});
   placemarks.push('<Placemark><name>'+xml(r[0]+' • '+r[1])+'</name><description>'+xml(esc(r[7]||'').replace(/\r?\n/g,'<br/>'))+'</description>'+(Number.isFinite(time.getTime())?'<TimeStamp><when>'+time.toISOString()+'</when></TimeStamp>':'')+'<styleUrl>#status-'+style(r[3])+'</styleUrl><ExtendedData>'+extra.join('')+'</ExtendedData>'+g+'</Placemark>');
  }catch(e){skipped.push(String(r[0]))}});
  var styles=Object.keys(col).map(function(key){var hex=col[key].replace('#',''),color=hex.slice(4,6)+hex.slice(2,4)+hex.slice(0,2);return'<Style id="status-'+key+'"><IconStyle><color>ff'+color+'</color><scale>1.1</scale></IconStyle><LineStyle><color>ff'+color+'</color><width>3</width></LineStyle><PolyStyle><color>55'+color+'</color><fill>1</fill><outline>1</outline></PolyStyle></Style>'}).join('');
  return{text:'<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>'+xml(project.code+' '+(project.name||''))+'</name><description>'+xml('ข้อมูลสำรวจ COT Field Survey • '+placemarks.length+' รายการ')+'</description>'+styles+placemarks.join('')+'</Document></kml>',count:placemarks.length,skipped:skipped};
 }
 function save(name,bytes,type){var u=URL.createObjectURL(new Blob([bytes],{type:type})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},60000)}
 async function run(kind){
  if(busy)return;var rows=JSON.parse(JSON.stringify(chosen()));if(!rows.length){$('kml-status').textContent='ไม่มีรายการสำหรับส่งออก';return}
  busy=true;['download-kml','download-kmz','kml-close'].forEach(function(id){$(id).disabled=true});document.querySelectorAll('[data-kml-scope]').forEach(function(b){b.disabled=true});
  try{var project=JSON.parse(JSON.stringify(cur)),result=build(rows,project);if(!result.count)throw Error('ไม่มีพิกัดที่ส่งออกได้ กรุณาตรวจรายการ');
   if(result.skipped.length){$('kml-status').textContent='ยังไม่ส่งออก: พิกัดไม่ถูกต้องในรายการ '+result.skipped.join(', ')+'. กรุณาแก้พิกัดหรือกรองรายการเหล่านี้ออกก่อน';return}
   var bytes=result.text;if(kind==='kmz'){var zip=new JSZip();zip.file('doc.kml',result.text);bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})}
   var now=new Date(),date=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');save('COT-'+project.code+'-'+date+'.'+kind,bytes,kind==='kmz'?'application/vnd.google-earth.kmz':'application/vnd.google-earth.kml+xml');$('kml-status').textContent='ส่งออก '+kind.toUpperCase()+' แล้ว '+result.count+' รายการ';
  }catch(e){$('kml-status').textContent=e.message}finally{busy=false;['download-kml','download-kmz','kml-close'].forEach(function(id){$(id).disabled=false});document.querySelectorAll('[data-kml-scope]').forEach(function(b){b.disabled=false})}
 }
 $('download-kml').onclick=function(){run('kml')};$('download-kmz').onclick=function(){run('kmz')};
})();
