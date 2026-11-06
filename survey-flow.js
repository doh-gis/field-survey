(function(){
 'use strict';var next=false,choices=null;
 var style=document.createElement('style');style.textContent='.field-error{color:#b3261e;font-size:13px;margin:5px 0 8px}[aria-invalid=true]{border-color:#b3261e!important;box-shadow:0 0 0 1px #b3261e}.continue-options{margin:14px 0;padding:12px;border:1px solid var(--line);border-radius:12px}.continue-options label{font-size:13px;font-weight:400;display:block;margin:8px 0}.continue-options input{width:auto;min-height:0;margin-right:7px}#save-next{width:100%;margin-top:10px}';document.head.appendChild(style);
 var opts=document.createElement('details');opts.className='continue-options';opts.innerHTML='<summary>ค่าที่ใช้ต่อเมื่อสำรวจจุดถัดไป</summary><label><input type="checkbox" id="carry-type" checked>ประเภทการสำรวจ</label><label><input type="checkbox" id="carry-name" checked>ชื่อผู้สำรวจ</label><label><input type="checkbox" id="carry-custom">ข้อมูลเพิ่มเติมของโครงการ</label><p class="hint">พิกัด ความแม่นยำ รูปทรง รายละเอียด และไฟล์แนบ จะเริ่มใหม่ทุกครั้ง</p>';$('save').before(opts);
 var btn=document.createElement('button');btn.id='save-next';btn.type='button';btn.className='s';btn.textContent='บันทึกและสำรวจจุดถัดไป';$('save').after(btn);
 function clear(){document.querySelectorAll('#p-survey .field-error').forEach(function(e){e.remove()});document.querySelectorAll('#p-survey [aria-invalid]').forEach(function(e){e.removeAttribute('aria-invalid');e.removeAttribute('aria-describedby')})}
 function invalid(id,msg){var field=$(id),note=document.createElement('p');note.className='field-error';note.id='error-'+id;note.textContent=msg;field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',note.id);field.after(note);return field}
 window.surveyValidate=function(){clear();var first=null;function bad(id,msg){var el=invalid(id,msg);if(!first)first=el}
  if(!$('lat').value.trim()||!isFinite(Number($('lat').value))||Math.abs(Number($('lat').value))>90)bad('lat','ระบุละติจูดตั้งแต่ -90 ถึง 90');
  if(!$('lng').value.trim()||!isFinite(Number($('lng').value))||Math.abs(Number($('lng').value))>180)bad('lng','ระบุลองจิจูดตั้งแต่ -180 ถึง 180');
  if($('gtype').value!=='Point'&&!geometryValue())bad('gdraw','วาดรูปทรงให้ครบและกดใช้รูปทรงนี้ก่อน');
  (cur.fields||[]).forEach(function(f){var el=$('f_'+f.key);if(f.required&&!el.value.trim())bad(el.id,'กรุณากรอก '+f.label);else if(f.type==='number'&&el.validity.badInput)bad(el.id,'กรุณาระบุตัวเลข')});
  if(first){first.scrollIntoView({behavior:'smooth',block:'center'});first.focus({preventScroll:true});$('smsg').textContent='ตรวจช่องที่แสดงข้อความสีแดงก่อนบันทึก';return false}return true;
 };
 var original=$('save').onclick;$('save').onclick=function(){if($('save').disabled)return;if(window.draftReady&&!draftReady())return original();if(!surveyValidate()){next=false;return}choices={type:$('carry-type').checked,name:$('carry-name').checked,custom:$('carry-custom').checked};original();btn.disabled=$('save').disabled;};
 btn.onclick=function(){if($('save').disabled)return;next=true;$('save').onclick()};
 $('save').addEventListener('click',function(){next=false},true);
 window.surveyAfterQueued=function(rec){if(!next)return false;next=false;var c=choices||{};$('stype').value=c.type?rec.d.type:'';$('sname').value=c.name?rec.d.surveyor:'';(cur.fields||[]).forEach(function(f){$('f_'+f.key).value=c.custom?(rec.d.custom[f.key]||''):''});$('smsg').textContent='✓ เก็บรายการก่อนหน้าในเครื่องแล้ว · พร้อมสำรวจจุดถัดไป';$('stype').scrollIntoView({behavior:'smooth',block:'center'});$('stype').focus({preventScroll:true});return true};
 window.surveyFlowDone=function(){btn.disabled=false;next=false};
 var originalEnter=enter;enter=function(p,f){next=false;clear();return originalEnter(p,f)};
})();
