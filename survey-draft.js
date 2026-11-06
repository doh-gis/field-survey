/* One local draft per project. Files are structured-cloned in the same IDB
   transaction as fields; never store object URLs or use unload as sole save. */
(function(){
 'use strict';
 var active='',epoch=0,timer=null,chain=Promise.resolve(),blocked=false,restoring=false,dirty=false,last='',candidate=null;
 var panel=document.createElement('div');panel.className='card';panel.style.marginBottom='12px';
 panel.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span id="draft-status" class="hint" role="status" style="flex:1;margin:0">ฉบับร่างเก็บอัตโนมัติในเครื่องนี้</span><button type="button" class="s hide" id="draft-retry">ลองอ่านอีกครั้ง</button><button type="button" class="s" id="draft-new">เริ่มรายการใหม่</button></div>';
 $('p-survey').insertBefore(panel,$('p-survey').children[2]);
 var dialog=document.createElement('dialog');dialog.id='draft-dialog';dialog.style.cssText='width:min(460px,calc(100% - 32px));max-height:85dvh;overflow:auto';
 dialog.innerHTML='<h2 tabindex="-1" id="draft-heading">พบฉบับร่างที่ยังไม่บันทึก</h2><p id="draft-summary"></p><p class="hint">ข้อมูลนี้อยู่ในเครื่องนี้เท่านั้น ยังไม่ได้ส่งเป็นรายการสำรวจ</p><div class="row"><button type="button" class="p" id="draft-resume">ทำต่อจากฉบับร่าง</button><button type="button" class="s" id="draft-discard">เริ่มใหม่</button></div><p id="draft-error" role="status" class="hint"></p>';
 document.body.appendChild(dialog);
 function status(t){$('draft-status').textContent=t}
 function key(code){return'draft:'+String(code).toUpperCase()}
 function tx(mode,fn){return qtx(['kv'],mode,function(k){fn(k)})}
 function store(k,d){var r=k.get('draft-saved:'+d.project);r.onsuccess=function(){if(r.result===d.sid)return;if(meaningful(d))k.put(d,key(d.project));else k.delete(key(d.project))}}
 function snapshot(){
  var fields={};(cur.fields||[]).forEach(function(f){fields[f.key]=$('f_'+f.key).value});
  return{version:1,project:active,sid:$('sid').value,at:Date.now(),type:$('stype').value,name:$('sname').value,description:$('sdesc').value,lat:$('lat').value,lng:$('lng').value,accuracy:$('acc').value,custom:fields,geometry:GFORM?JSON.parse(JSON.stringify(GFORM)):null,photos:PF.slice(),media:(window.attachmentsSnapshot?attachmentsSnapshot():[]).map(function(x){return{id:x.id,name:x.name,kind:x.kind,mime:x.mime,size:x.size,duration:x.duration,file:x.file}})};
 }
 function meaningful(d){return !!(d.type||d.description||d.lat||d.lng||d.geometry||d.photos.length||d.media.length||Object.values(d.custom).some(function(v){return v!==''})||d.name!==UN)}
 function signature(d){return JSON.stringify([d.sid,d.type,d.name,d.description,d.lat,d.lng,d.accuracy,d.custom,d.geometry,d.photos.map(function(f){return[f.name,f.size,f.lastModified]}),d.media.map(function(x){return x.id})])}
 function flush(){
  clearTimeout(timer);if(!active||blocked||restoring||!dirty||!cur)return chain;
  var d=snapshot(),sig=signature(d),e=epoch;dirty=false;if(sig===last)return chain;
  status('กำลังเก็บฉบับร่าง…');
  chain=chain.catch(function(){}).then(function(){if(e!==epoch)return;return tx('readwrite',function(k){store(k,d)}).then(function(){if(e!==epoch)return;last=sig;status(meaningful(d)?'เก็บฉบับร่างในเครื่องแล้ว · '+new Date(d.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'ฉบับร่างเก็บอัตโนมัติในเครื่องนี้')})}).catch(function(err){if(e!==epoch)return;dirty=true;status('เก็บฉบับร่างไม่สำเร็จ: '+qErr(err)+' · กรุณาอย่าปิดหน้านี้')});return chain;
 }
 window.draftChanged=function(){if(!active||blocked||restoring)return;dirty=true;clearTimeout(timer);timer=setTimeout(flush,500)};
 window.draftReset=function(){var e=++epoch;clearTimeout(timer);dirty=false;last='';status('ฉบับร่างเก็บอัตโนมัติในเครื่องนี้');queueMicrotask(function(){if(e===epoch&&active&&cur&&!blocked){last=signature(snapshot());dirty=false;clearTimeout(timer)}})};
 // Flush immediately on leaving, before invalidating the old generation.
 window.draftLeave=function(){clearTimeout(timer);if(active&&!blocked&&cur){var d=snapshot();chain=chain.catch(function(){}).then(function(){return tx('readwrite',function(k){store(k,d)})}).catch(function(){toast('เก็บฉบับร่างไม่สำเร็จ กรุณาตรวจพื้นที่ในเครื่อง')})}active='';epoch++;dirty=false;blocked=false;if(dialog.open)dialog.close();$('p-survey').inert=false};
 window.draftEnter=async function(){
  active=String(cur.code).toUpperCase();var code=active,e=++epoch;blocked=true;$('draft-retry').classList.add('hide');$('draft-new').disabled=true;$('p-survey').inert=true;status('กำลังตรวจฉบับร่าง…');
  try{await chain;var d=await kvk('get',key(code));if(e!==epoch)return;if(d&&await qGet(d.sid)){await tx('readwrite',function(k){k.delete(key(code))});d=null}if(e!==epoch)return;
   if(d){candidate=d;$('draft-summary').textContent='โครงการ '+code+' · '+new Date(d.at).toLocaleString('th-TH')+' · '+d.photos.length+' รูป · '+d.media.length+' ไฟล์เสียง/วิดีโอ';$('draft-error').textContent='';dialog.showModal();$('draft-heading').focus()}
   else{blocked=false;$('draft-new').disabled=false;$('p-survey').inert=false;last=signature(snapshot());status('ฉบับร่างเก็บอัตโนมัติในเครื่องนี้')}
  }catch(err){if(e!==epoch)return;$('p-survey').inert=false;$('draft-retry').classList.remove('hide');status('อ่านฉบับร่างไม่ได้: '+qErr(err)+' · กดลองอ่านอีกครั้งก่อนบันทึก')}
 };
 function finish(){blocked=false;restoring=false;$('draft-new').disabled=false;$('p-survey').inert=false;dialog.close();candidate=null;last=signature(snapshot());dirty=false}
 $('draft-resume').onclick=function(){
  var d=candidate;restoring=true;try{
   $('sid').value=d.sid;$('stype').value=d.type;$('sname').value=d.name;$('sdesc').value=d.description;$('lat').value=d.lat;$('lng').value=d.lng;$('acc').value=d.accuracy;accUI(d.accuracy);
   (cur.fields||[]).forEach(function(f){$('f_'+f.key).value=d.custom[f.key]==null?'':d.custom[f.key]});GFORM=d.geometry;geometryFormRefresh();PF=d.photos.map(function(f){return f instanceof File?f:new File([f],f.name||'photo.jpg',{type:f.type})});rp();attachmentsRestore(d.media);finish();status('กู้ฉบับร่างแล้ว · เก็บการแก้ไขอัตโนมัติ')
  }catch(err){restoring=false;$('draft-error').textContent='กู้ไม่สำเร็จ: '+qErr(err)+' · ฉบับร่างเดิมยังอยู่'}
 };
 async function discard(){
  var code=active;epoch++;clearTimeout(timer);dirty=false;try{await chain;await tx('readwrite',function(k){k.delete(key(code))});restoring=true;newSurvey();$('stype').value='';$('sname').value=UN;restoring=false;finish();status('เริ่มรายการใหม่แล้ว · เก็บฉบับร่างอัตโนมัติ')}catch(err){restoring=false;$('draft-error').textContent=qErr(err);status('ล้างฉบับร่างไม่สำเร็จ กรุณาลองใหม่')}
 }
 $('draft-discard').onclick=discard;$('draft-retry').onclick=draftEnter;
 window.draftReady=function(){return !blocked};
 $('draft-new').onclick=function(){if(confirm('เริ่มรายการใหม่และล้างฉบับร่างของโครงการนี้? รายการที่บันทึกเข้าคิวแล้วจะไม่ถูกลบ'))discard()};
 dialog.addEventListener('cancel',function(e){e.preventDefault()});
 $('p-survey').addEventListener('input',draftChanged);$('p-survey').addEventListener('change',draftChanged);
 document.addEventListener('visibilitychange',function(){if(document.hidden)flush()});addEventListener('pagehide',flush);
 addEventListener('beforeunload',function(e){if(dirty||(window.attachmentsReady&&!attachmentsReady())){flush();e.preventDefault();e.returnValue=''}});
 // Retry failed writes and capture programmatic field changes, without rewriting files each tick.
 setInterval(function(){if(active&&!blocked&&!restoring&&cur){var d=snapshot();if(signature(d)!==last){dirty=true;flush()}}},2000);
})();
