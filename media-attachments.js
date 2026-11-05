/* Audio/video capture, private playback and resumable IndexedDB uploads. */
(function(){
 'use strict';
 var M={items:[],loading:0,rec:null,stream:null,timer:null,session:0,starting:false},CHUNK=262143;
 var limits={audio:{seconds:120,bytes:8*1048576},video:{seconds:60,bytes:20*1048576}};
 var types={m4a:'audio/mp4',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',ogg:'audio/ogg',oga:'audio/ogg',mp3:'audio/mpeg',aac:'audio/aac',wav:'audio/wav'};
 var ALLOWED=['audio/mp4','audio/x-m4a','audio/aac','audio/mpeg','audio/ogg','audio/webm','audio/wav','audio/x-wav','video/mp4','video/webm','video/quicktime'];
 var style=document.createElement('style');style.textContent='.media-panel{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}.media-panel h3{margin:0 0 8px}.media-list{display:grid;gap:8px;margin-top:10px}.media-item{border:1px solid var(--line);padding:10px;border-radius:10px;overflow-wrap:anywhere}.media-item audio,.media-item video,#media-live{display:block;width:100%;max-height:220px;margin:8px 0}.media-item button{min-height:40px}.media-item small{display:block}.media-actions{display:flex;gap:7px;flex-wrap:wrap}.media-actions button{flex:1;min-width:100px;min-height:44px}#media-live.hide{display:none}.media-error{color:#b3261e}.media-panel input[type=file]{max-width:100%}';document.head.appendChild(style);
 $('media-panel').className='media-panel';$('media-panel').innerHTML='<h3>เสียง / วิดีโอ <span class="hint" id="media-count">0/3 ไฟล์</span></h3><p class="hint">เสียงไม่เกิน 2 นาที / 8 MB · วิดีโอไม่เกิน 1 นาที / 20 MB · รวมไม่เกิน 3 ไฟล์</p><div class="media-actions"><button type="button" class="s" id="media-audio">🎙 บันทึกเสียง</button><button type="button" class="s" id="media-video">▣ บันทึกวิดีโอ</button><button type="button" class="s" id="media-pick">เลือกไฟล์</button></div><input type="file" id="media-files" accept="audio/*,video/*,.m4a,.mp3,.wav,.aac,.ogg,.webm,.mp4,.mov" multiple hidden><video id="media-live" class="hide" playsinline muted></video><div class="media-actions"><button type="button" class="d hide" id="media-stop">หยุดบันทึก</button><button type="button" class="s hide" id="media-cancel">ยกเลิกบันทึก</button></div><p id="media-status" class="hint" role="status"></p><div id="media-list" class="media-list"></div>';
 function size(n){return(n/1048576).toFixed(2)+' MB'}
 function id(){return'A'+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):Date.now().toString(36)+Math.random().toString(36).slice(2))}
 function say(t){$('media-status').textContent=t}
 function releaseItems(){M.items.forEach(function(x){if(x.url)URL.revokeObjectURL(x.url)})}
 function render(){
  $('media-count').textContent=M.items.length+'/3 ไฟล์';
  ['media-audio','media-video','media-pick'].forEach(function(i){$(i).disabled=M.starting||!!M.rec||M.loading>0||M.items.length>=3});
  $('media-list').innerHTML=M.items.map(function(x,i){return'<div class="media-item"><b>'+esc(x.name)+'</b><small>'+esc(x.kind==='audio'?'เสียง':'วิดีโอ')+' · '+Math.ceil(x.duration)+' วินาที · '+size(x.size)+'</small><'+x.kind+' controls preload="metadata" '+(x.kind==='video'?'playsinline':'')+' src="'+x.url+'"></'+x.kind+'><button type="button" class="d" data-media-remove="'+i+'">ลบไฟล์นี้</button></div>'}).join('');
 }
 function stopTracks(){if(M.stream){M.stream.getTracks().forEach(function(t){t.stop()});M.stream=null}$('media-live').srcObject=null;$('media-live').classList.add('hide')}
 window.attachmentsReset=function(){M.session++;if(M.rec){M.rec.discard=true;if(M.rec.state!=='inactive')M.rec.stop()}M.rec=null;M.starting=false;clearInterval(M.timer);stopTracks();releaseItems();M.items=[];$('media-stop').classList.add('hide');$('media-cancel').classList.add('hide');say('');render()};
 window.attachmentsReady=function(){return !M.starting&&!M.rec&&!M.loading};
 window.attachmentsSnapshot=function(){return M.items.slice()};
 function baseMime(file){var t=String(file.type||'').split(';')[0].toLowerCase();if(ALLOWED.indexOf(t)>=0)return t;var ext=(file.name||'').split('.').pop().toLowerCase();return types[ext]||''}
 function duration(file,mime){return new Promise(function(ok,no){
  var el=document.createElement(mime.indexOf('video/')===0?'video':'audio'),u=URL.createObjectURL(file),timer=setTimeout(function(){finish(new Error('อ่านความยาวไฟล์นี้ไม่ได้ กรุณาใช้ MP4/M4A หรือบันทึกจากแอป'))},12000);
  el.preload='metadata';el.muted=true;el.playsInline=true;
  function finish(e,n){clearTimeout(timer);el.onloadedmetadata=el.ondurationchange=el.onerror=null;el.removeAttribute('src');el.load();URL.revokeObjectURL(u);e?no(e):ok(n)}
  function check(){if(Number.isFinite(el.duration)&&el.duration>0)finish(null,el.duration)}
  el.onloadedmetadata=function(){if(!Number.isFinite(el.duration)){try{el.currentTime=1e10}catch(e){}}check()};el.ondurationchange=check;el.onerror=function(){finish(new Error('เครื่องนี้อ่านไฟล์ '+(file.name||'')+' ไม่ได้ กรุณาเลือกรูปแบบอื่น'))};el.src=u;
 })}
 async function prepare(file,knownDuration){
  var mime=baseMime(file),kind=mime.split('/')[0];if(ALLOWED.indexOf(mime)<0)throw new Error('รองรับเฉพาะไฟล์เสียง/วิดีโอ MP4, M4A, WebM, OGG, AAC, MP3, WAV หรือ MOV');
  if(!file.size||file.size>limits[kind].bytes)throw new Error((kind==='audio'?'เสียงเกิน 8 MB':'วิดีโอเกิน 20 MB')+' — '+(file.name||''));
  var sec=knownDuration||await duration(file,mime);if(sec>limits[kind].seconds+.5)throw new Error(kind==='audio'?'เสียงยาวเกิน 2 นาที':'วิดีโอยาวเกิน 1 นาที');
  return{id:id(),name:file.name||'recording',kind:kind,mime:mime,size:file.size,duration:sec,file:file,url:URL.createObjectURL(file)};
 }
 async function addFiles(files){
  if(files.length+M.items.length>3){say('แนบได้รวมไม่เกิน 3 ไฟล์');return}var session=M.session;M.loading++;render();say('กำลังตรวจไฟล์…');
  try{var prepared=[];for(var f of files)prepared.push(await prepare(f));if(session!==M.session){prepared.forEach(function(x){URL.revokeObjectURL(x.url)});return}M.items=M.items.concat(prepared);say('ไฟล์พร้อมแล้ว กดบันทึกข้อมูลเพื่อเก็บลงเครื่อง')}catch(e){(prepared||[]).forEach(function(x){URL.revokeObjectURL(x.url)});if(session===M.session)say(e.message)}finally{M.loading--;render()}
 }
 $('media-pick').onclick=function(){$('media-files').click()};$('media-files').onchange=function(){var files=Array.from(this.files);this.value='';addFiles(files)};
 $('media-list').onclick=function(e){var b=e.target.closest('[data-media-remove]');if(!b)return;var x=M.items.splice(Number(b.dataset.mediaRemove),1)[0];if(x)URL.revokeObjectURL(x.url);render()};
 async function record(kind){
  if(!attachmentsReady()||M.items.length>=3)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){say('เบราว์เซอร์นี้บันทึกไม่ได้ กรุณาเลือกไฟล์จากเครื่อง');return}
  M.starting=true;render();say('กำลังขอสิทธิ์'+(kind==='audio'?'ไมโครโฟน':'กล้องและไมโครโฟน')+'…');var session=M.session,stream;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'?{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}:false});
   if(session!==M.session){stream.getTracks().forEach(function(t){t.stop()});return}M.stream=stream;
   var candidates=kind==='audio'?['audio/mp4','audio/webm;codecs=opus','audio/ogg;codecs=opus']:['video/mp4','video/webm;codecs=vp8,opus','video/webm'];
   var mime=candidates.filter(function(m){return MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(m)})[0],options=kind==='video'?{videoBitsPerSecond:1000000,audioBitsPerSecond:64000}:{audioBitsPerSecond:64000};if(mime)options.mimeType=mime;
   var rec=new MediaRecorder(stream,options),parts=[],total=0,start=performance.now();M.rec=rec;
   rec.ondataavailable=function(e){if(e.data.size){parts.push(e.data);total+=e.data.size;if(total>limits[kind].bytes&&rec.state!=='inactive')rec.stop()}};
   rec.onerror=function(){rec.discard=true;say('บันทึกไม่สำเร็จ กรุณาลองใหม่');if(rec.state!=='inactive')rec.stop();stopTracks()};
   rec.onstop=async function(){
    if(session!==M.session){stream.getTracks().forEach(function(t){t.stop()});return}
    clearInterval(M.timer);stopTracks();M.rec=null;$('media-stop').classList.add('hide');$('media-cancel').classList.add('hide');
    if(rec.discard||session!==M.session){render();return}
    var sec=(performance.now()-start)/1000,actual=rec.mimeType||(parts[0]&&parts[0].type)||mime;
    var ext=actual&&actual.indexOf('mp4')>=0?(kind==='audio'?'.m4a':'.mp4'):actual&&actual.indexOf('ogg')>=0?'.ogg':'.webm';
    M.loading++;render();try{var f=new File(parts,['เสียง','วิดีโอ'][kind==='video'?1:0]+'-'+new Date().toISOString().replace(/[:.]/g,'-')+ext,{type:actual});var item=await prepare(f,Math.max(.1,sec));if(session===M.session){M.items.push(item);say('บันทึกแล้ว ตรวจฟัง/ดูได้ก่อนกดบันทึกข้อมูล')}else URL.revokeObjectURL(item.url)}catch(e){say(e.message)}finally{M.loading--;render()}
   };
   if(kind==='video'){$('media-live').classList.remove('hide');$('media-live').srcObject=stream;$('media-live').play().catch(function(){})}
   rec.start(1000);$('media-stop').classList.remove('hide');$('media-cancel').classList.remove('hide');
   M.timer=setInterval(function(){var sec=(performance.now()-start)/1000;say('กำลังบันทึก '+Math.floor(sec)+' / '+limits[kind].seconds+' วินาที');if(sec>=limits[kind].seconds&&rec.state!=='inactive')rec.stop()},250);
  }catch(e){if(session===M.session){stopTracks();say(e.name==='NotAllowedError'?'ไม่ได้รับสิทธิ์กล้อง/ไมโครโฟน เลือกไฟล์จากเครื่องแทนได้':e.message)}}finally{M.starting=false;render()}
 }
 $('media-audio').onclick=function(){record('audio')};$('media-video').onclick=function(){record('video')};$('media-stop').onclick=function(){if(M.rec&&M.rec.state!=='inactive')M.rec.stop()};$('media-cancel').onclick=function(){if(M.rec){M.rec.discard=true;if(M.rec.state!=='inactive')M.rec.stop()}say('ยกเลิกการบันทึกแล้ว')};
 addEventListener('pagehide',function(){if(M.rec){M.rec.discard=true;if(M.rec.state!=='inactive')M.rec.stop()}stopTracks()});
 async function hash(ab){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',ab))).map(function(b){return b.toString(16).padStart(2,'0')}).join('')}
 function meta(x,sha){return{id:x.id,name:x.name,kind:x.kind,mime:x.mime,size:x.size,duration:x.duration,sha:sha}}
 window.attachmentsPersist=async function(rec,blobs,items){rec.attachments=[];rec.attachmentProgress={};for(var x of items){var ab=await x.file.arrayBuffer();rec.attachments.push(meta(x,await hash(ab)));blobs.push({id:x.id,ab:ab})}};
 window.attachmentsSend=async function(it){
  var items=it.attachments||[];it.attachmentProgress=it.attachmentProgress||{};
  for(var a of items){
   var begin=await api('attachmentBegin',{surveyId:it.sid,attachmentId:a.id},it.project);
   if(!begin.completed){
    var b=await qBlob(a.id);if(!b)throw new Error('ไม่พบเสียง/วิดีโอในเครื่อง กรุณาลบรายการคิวนี้แล้วแนบใหม่');
    var total=Math.ceil(a.size/CHUNK),got=new Set(begin.received||[]);
    for(var i=0;i<total;i++){
     if(!got.has(i))await api('attachmentChunk',{surveyId:it.sid,attachmentId:a.id,index:i,data:ab2b64(b.ab.slice(i*CHUNK,(i+1)*CHUNK))},it.project);
     it.attachmentProgress[a.id]=i+1;if(!await qPut(it))throw QGONE;
     var text='กำลังส่ง '+a.name+' '+Math.round((i+1)/total*100)+'%';if(QSAVE===it.id)$('smsg').textContent=text;if($('qst'))$('qst').textContent=text;
    }
    await api('attachmentFinish',{surveyId:it.sid,attachmentId:a.id},it.project);
    // Best-effort playback cache; upload success never depends on spare cache quota.
    await kvk('put','media:'+it.project+':'+a.id,new Blob([b.ab],{type:a.mime})).catch(function(){});
   }
   it.attachmentProgress[a.id]='done';if(!await qPut(it))throw QGONE;
  }
  if(items.length){var fresh=await api('listAttachments',{surveyId:it.sid},it.project);await kvk('put','media-meta:'+it.project+':'+it.sid,fresh.attachments).catch(function(){})}
 };
 var detailURLs=[];
 $('det').addEventListener('close',function(){detailURLs.forEach(function(u){URL.revokeObjectURL(u)});detailURLs=[]});
 window.attachmentsDetails=async function(sid){
  var project=cur.code,div=document.createElement('div');div.id='detail-media';div.className='media-panel';div.innerHTML='<h3>เสียง / วิดีโอ</h3><p class="hint">กำลังโหลดรายการไฟล์…</p>';$('db').appendChild(div);
  try{var list;try{var r=await api('listAttachments',{surveyId:sid},project);list=r.attachments;await kvk('put','media-meta:'+project+':'+sid,list).catch(function(){})}catch(e){list=await kvk('get','media-meta:'+project+':'+sid);if(!list)throw e}
   if(!det||det[0]!==sid||!div.isConnected)return;
   div.innerHTML='<h3>เสียง / วิดีโอ</h3>'+list.map(function(a,i){return'<div class="media-item"><b>'+esc(a.name)+'</b><small>'+Math.ceil(a.duration)+' วินาที · '+size(a.size)+' · '+esc(st(a.status))+'</small><button type="button" class="s" data-play="'+i+'" '+(a.status!=='Completed'?'disabled':'')+'>โหลดเพื่อเล่น / ดาวน์โหลด</button><div class="media-player"></div><p class="hint" role="status"></p></div>'}).join('')+(list.length?'':'<p class="hint">ไม่มีไฟล์แนบ</p>');
   div.onclick=async function(e){var b=e.target.closest('[data-play]');if(!b)return;var a=list[+b.dataset.play],box=b.closest('.media-item'),status=box.querySelector('p');b.disabled=true;
    try{var blob=await kvk('get','media:'+project+':'+a.id);if(!blob){var pieces=[],n=Math.ceil(a.size/1048576);for(var i=0;i<n;i++){if(!div.isConnected||!$('det').open)throw new Error('ยกเลิกการโหลดไฟล์');status.textContent='กำลังโหลด '+Math.round(i/n*100)+'%';var r=await api('getAttachmentChunk',{surveyId:sid,attachmentId:a.id,index:i},project);pieces.push(b642ab(r.data))}blob=new Blob(pieces,{type:a.mime});if(await hash(await blob.arrayBuffer())!==a.sha)throw new Error('ตรวจสอบไฟล์ไม่ผ่าน กรุณาลองใหม่');await kvk('put','media:'+project+':'+a.id,blob).catch(function(){})}
     if(!div.isConnected||!$('det').open)return;var u=URL.createObjectURL(blob);detailURLs.push(u);var player=document.createElement(a.kind);player.controls=true;player.preload='metadata';player.setAttribute('playsinline','');player.src=u;var link=document.createElement('a');link.href=u;link.download=a.name;link.textContent='ดาวน์โหลดไฟล์';box.querySelector('.media-player').replaceChildren(player,link);status.textContent=player.canPlayType(a.mime)?'':'เครื่องนี้อาจเล่นรูปแบบนี้ไม่ได้ ใช้ลิงก์ดาวน์โหลดเพื่อเปิดด้วยแอปอื่น';b.classList.add('hide');
    }catch(e){status.textContent=e.message}finally{b.disabled=false}
   };
  }catch(e){if(div.isConnected)div.innerHTML='<h3>เสียง / วิดีโอ</h3><p class="hint">โหลดไม่ได้: '+esc(e.message)+' (ตรวจว่า Deploy Apps Script v16 แล้ว)</p>'}
 };
 window.attachmentsQueuePanel=async function(id){
  var container=$('qe-media');if(!container){container=document.createElement('div');container.id='qe-media';container.className='media-panel';$('qedyn').after(container)}
  var rec=await qGet(id);if(!rec||!QED||QED.id!==id)return;
  container.innerHTML='<h3>เสียง / วิดีโอในคิว</h3><p class="hint">การเพิ่ม/ลบไฟล์ในส่วนนี้บันทึกลงคิวทันที</p>'+(rec.attachments||[]).map(function(a){return'<div class="media-item">'+esc(a.name)+' · '+size(a.size)+' <button type="button" class="d" data-rm-media="'+a.id+'">ลบไฟล์</button></div>'}).join('')+'<input type="file" id="qe-media-file" accept="audio/*,video/*,.m4a,.mp4,.mov,.webm" multiple><button type="button" class="s" id="qe-media-add">เพิ่มไฟล์ลงคิว</button><p id="qe-media-msg" class="hint" role="status"></p>';
  async function mutate(add,remove){
   var locked=await qLock(async function(){
   var current=await qGet(id);if(!current||current.sid||QCUR===id)throw new Error('รายการนี้เริ่มส่งแล้ว แก้ไฟล์ไม่ได้');
   current.attachments=(current.attachments||[]).filter(function(a){return a.id!==remove});if(current.attachments.length+add.length>3)throw new Error('แนบได้รวมไม่เกิน 3 ไฟล์');
   var blobs=[];for(var x of add){var ab=await x.file.arrayBuffer();current.attachments.push(meta(x,await hash(ab)));blobs.push({id:x.id,ab:ab})}
   // Recheck atomically, so a concurrent sender cannot be overwritten.
   await qtx(['q','qb'],'readwrite',function(q,b){var get=q.get(id);get.onsuccess=function(){if(!get.result||get.result.sid||QCUR===id){q.transaction.abort();return}var latest=get.result;latest.attachments=current.attachments;q.put(latest,id);blobs.forEach(function(x){b.put({ab:x.ab},x.id)});if(remove)b.delete(remove)}});
   add.forEach(function(x){URL.revokeObjectURL(x.url)});await qRefresh();attachmentsQueuePanel(id);return true;
   });if(locked===null)throw new Error('คิวกำลังส่งอยู่ กรุณารอแล้วลองอีกครั้ง');
  }
  container.onclick=async function(e){var b=e.target.closest('[data-rm-media]');if(!b)return;try{await mutate([],b.dataset.rmMedia)}catch(e){$('qe-media-msg').textContent=e.message}};
  $('qe-media-add').onclick=async function(){var b=this;b.disabled=true;var prepared=[];try{for(var file of Array.from($('qe-media-file').files))prepared.push(await prepare(file));await mutate(prepared,null)}catch(e){prepared.forEach(function(x){URL.revokeObjectURL(x.url)});$('qe-media-msg').textContent=e.message}finally{b.disabled=false}};
 };
 render();
})();
