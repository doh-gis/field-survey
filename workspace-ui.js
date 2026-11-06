(function(){
 'use strict';
 var style=document.createElement('style');style.textContent=`
 header{padding-top:calc(10px + env(safe-area-inset-top,0px));padding-bottom:10px;min-height:64px}header .pn{font-size:13px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 #p-map>h2{margin:8px 0 12px}.map-filter-box{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:10px 12px;margin-bottom:12px}.map-filter-box summary{cursor:pointer;font-weight:600;min-height:28px}.map-filter-box .row{margin:10px 0 0!important}.map-filter-box input,.map-filter-box select{min-width:0}
 #mapw{height:clamp(320px,58dvh,680px)}#map{height:100%!important}.map-actions{display:flex;gap:8px;margin:12px 0}.map-actions>button{flex:1;min-width:0;font-size:14px}
 #export-menu{width:min(440px,calc(100% - 28px));box-sizing:border-box;max-height:85dvh;overflow:auto}#export-menu h2:focus{outline:none}.export-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.export-grid button{font-size:14px;min-height:64px;min-width:0}.export-grid svg{height:22px;width:22px;display:block;margin:0 auto 5px}
 button{border-radius:12px}nav button{border-radius:0}button.p{font-weight:650}button.d{box-shadow:none}.hint{line-height:1.6}#p-survey .card,#p-user .card{border-radius:16px}#p-user footer{margin-top:20px;padding-bottom:12px}
 @media(max-width:600px){header h1{min-width:0}header #chg{font-size:12px;padding:8px;min-height:40px}header .qb{font-size:11px;padding:7px;max-width:115px}header .pc{font-size:16px}header .pn{font-size:12px}#p-map .tw{margin-top:12px}nav button{padding-top:10px;padding-bottom:10px}main{padding-bottom:calc(85px + env(safe-area-inset-bottom,0px))}}
 `;document.head.appendChild(style);
 var filter=document.createElement('details');filter.id='map-filters';filter.className='map-filter-box';filter.innerHTML='<summary>ค้นหาและตัวกรอง <span id="filter-count" class="hint"></span></summary>';
 var row=$('base').parentElement;$('base').classList.add('hide');$('base').setAttribute('aria-hidden','true');$('p-map').insertBefore(filter,row);filter.appendChild(row);
 var actions=$('reports').parentElement;actions.className='map-actions';actions.removeAttribute('style');
 var launch=document.createElement('button');launch.type='button';launch.className='s';launch.id='exports-open';launch.textContent='ส่งออก / รายงาน';actions.insertBefore(launch,actions.firstChild);
 var dialog=document.createElement('dialog');dialog.id='export-menu';dialog.setAttribute('aria-labelledby','export-title');dialog.innerHTML='<h2 id="export-title" tabindex="-1">ส่งออก / รายงาน</h2><p class="hint">CSV และ GeoJSON ใช้รายการตามตัวกรอง ส่วนรายงานและ KML / KMZ เลือกขอบเขตได้ในขั้นถัดไป</p><div class="export-grid"></div><button type="button" class="s" id="exports-close" style="margin-top:14px;width:100%">ปิด</button>';document.body.appendChild(dialog);
 ['reports','csv','gj','kml-export'].forEach(function(id){var b=$(id);dialog.querySelector('.export-grid').appendChild(b);b.className='s';b.addEventListener('click',function(){dialog.close()},true)});
 launch.onclick=function(){if(document.activeElement)document.activeElement.blur();dialog.showModal();$('export-title').focus()};$('exports-close').onclick=function(){dialog.close()};
 var footer=document.querySelector('footer');if(footer)$('p-user').appendChild(footer);
 // Replace the recording emoji with an icon from the same stroke family.
 var audio=$('media-audio');if(audio)audio.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg> บันทึกเสียง';
 var v=$('media-video');if(v)v.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="13" height="14" rx="2"/><path d="m15 10 7-4v12l-7-4"/></svg> บันทึกวิดีโอ';
})();
