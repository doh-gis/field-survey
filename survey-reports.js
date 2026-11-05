/* Offline PDF and XLSX reports. One thumbnail per survey, no external services. */
(function(){
 'use strict';
 var running=false,cancelled=false;
 document.body.insertAdjacentHTML('beforeend','<dialog id="report-dialog" style="max-height:90dvh;overflow:auto" aria-labelledby="report-title"><h2 id="report-title">รายงานโครงการ</h2><label for="report-scope">ข้อมูลที่ใช้</label><select id="report-scope"><option value="project">ทุกรายการในโครงการ</option><option value="filtered">เฉพาะรายการตามตัวกรองแผนที่</option></select><p class="hint">รวมตารางรายการ ภาพย่อไม่เกิน 1 ภาพต่อรายการ และแผนผังพิกัดรวม (ไม่มีแผนที่ฐาน) Excel มีตารางไฟล์แนบเพิ่มด้วย</p><p class="hint">ใช้รายการที่แอปโหลดไว้ล่าสุด ไม่รวมรายการที่อยู่เฉพาะในเครื่อง เมื่อออฟไลน์จะใช้เฉพาะภาพและข้อมูลไฟล์แนบที่เคยเก็บไว้</p><div class="row"><button type="button" class="p" id="report-pdf">ดาวน์โหลด PDF</button><button type="button" class="s" id="report-xlsx">ดาวน์โหลด Excel</button></div><p id="report-progress" role="status" class="hint"></p><button type="button" class="s" id="report-close">ปิด</button></dialog>');
 $('reports').onclick=function(){cancelled=false;$('report-progress').textContent=S.length+' รายการที่โหลดไว้';$('report-dialog').showModal()};
 function close(){if(running){cancelled=true;$('report-progress').textContent='กำลังยกเลิก กรุณารอคำขอที่กำลังทำอยู่…'}else $('report-dialog').close()}
 $('report-close').onclick=close;$('report-dialog').addEventListener('cancel',function(e){e.preventDefault();close()});
 function guard(){if(cancelled)throw new Error('ยกเลิกการสร้างรายงานแล้ว')}
 function progress(t){$('report-progress').textContent=t}
 function save(name,data,type){var u=URL.createObjectURL(new Blob([data],{type:type})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},60000)}
 function image(u){return new Promise(function(ok,no){var im=new Image();im.onload=function(){ok(im)};im.onerror=function(){no(new Error('อ่านภาพย่อไม่ได้'))};im.src=u})}
 async function thumbnail(base64){var im=await image(base64.indexOf('data:')===0?base64:'data:image/jpeg;base64,'+base64),c=document.createElement('canvas'),scale=Math.min(1,320/im.width,220/im.height);c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.75)}
 async function collect(rows,project){
  var metadata={},online=navigator.onLine!==false,warnings=[];
  if(online){for(var n=0;n<rows.length;n+=200){guard();try{var r=await api('reportData',{surveyIds:rows.slice(n,n+200).map(function(r){return r[0]})},project);r.items.forEach(function(m){metadata[m.id]=m})}catch(e){warnings.push('ข้อมูลไฟล์แนบบางส่วนโหลดไม่ได้: '+e.message)}}}
  var items=[];
  for(var i=0;i<rows.length;i++){
   guard();var row=rows[i],m=metadata[row[0]],cached=await kvk('get','media-meta:'+project+':'+row[0]).catch(function(){return null});
   var item={row:row,attachments:m?m.attachments:cached,photo:null};
   if(m)await kvk('put','media-meta:'+project+':'+row[0],m.attachments).catch(function(){});
   progress('เตรียมข้อมูลและภาพย่อ '+(i+1)+'/'+rows.length);
   var cachedPhoto=await kvk('get','report-thumb:'+project+':'+row[0]).catch(function(){return null});
   if(cachedPhoto&&typeof cachedPhoto==='object')item.photo=(!m||cachedPhoto.id===m.photoId)?cachedPhoto.url:null;else if(!online)item.photo=cachedPhoto;
   if(!item.photo&&(!online||!m))item.photo=await kvk('get',thKey(row[0],project)).catch(function(){return null});
   if(m&&!m.photoId)item.photo=null;
   if(!item.photo&&m&&m.photoId&&online){try{var ph=await api('getPhoto',{surveyId:row[0],photoId:m.photoId},project);item.photo=await thumbnail(ph.data);await kvk('put','report-thumb:'+project+':'+row[0],{id:m.photoId,url:item.photo}).catch(function(){})}catch(e){warnings.push('โหลดภาพรายการ '+row[0]+' ไม่ได้')}}
   items.push(item);
  }
  return{items:items,warnings:warnings};
 }
 function coords(row){var g=geoCoords(row[11]);if(!g)return vc(row[5],row[6])?[[Number(row[6]),Number(row[5])]]:[];return g.type==='Point'?[g.coordinates]:g.type==='Polygon'?g.coordinates[0]:g.coordinates}
 function mapCanvas(items){
  var c=document.createElement('canvas');c.width=1100;c.height=560;var x=c.getContext('2d');x.fillStyle='#f3f6fb';x.fillRect(0,0,c.width,c.height);
  var all=items.flatMap(function(i){return coords(i.row)}).filter(function(p){return p&&vc(p[1],p[0])});
  if(!all.length){x.fillStyle='#52627a';x.font='24px Tahoma, sans-serif';x.fillText('ไม่มีพิกัดสำหรับแสดงแผนผัง',40,80);return c}
  var rad=Math.PI/180;
  function merc(p){return[p[0]*rad,Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,p[1]))*rad/2))]}
  var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;all.forEach(function(p){var q=merc(p);minX=Math.min(minX,q[0]);maxX=Math.max(maxX,q[0]);minY=Math.min(minY,q[1]);maxY=Math.max(maxY,q[1])});
  var sx=maxX-minX||.0001,sy=maxY-minY||.0001,scale=Math.min(920/sx,400/sy),cx=(maxX+minX)/2,cy=(maxY+minY)/2;
  function project(p){var m=merc(p);return[550+(m[0]-cx)*scale,280-(m[1]-cy)*scale]}
  x.strokeStyle='#dbe2ee';x.lineWidth=1;for(var k=0;k<6;k++){var gx=90+k*184,gy=80+k*80;x.beginPath();x.moveTo(gx,80);x.lineTo(gx,480);x.stroke();x.beginPath();x.moveTo(90,gy);x.lineTo(1010,gy);x.stroke()}
  items.forEach(function(item){var r=item.row,p=coords(r),g=geoCoords(r[11]);if(!p.length)return;var points=p.map(project);x.strokeStyle=col[r[3]]||'#1d4ba3';x.fillStyle=x.strokeStyle;x.lineWidth=4;if(g&&g.type!=='Point'){x.beginPath();points.forEach(function(q,i){i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])});if(g.type==='Polygon'){x.closePath();x.globalAlpha=.13;x.fill();x.globalAlpha=1}x.stroke()}var first=points[0];x.beginPath();x.arc(first[0],first[1],6,0,Math.PI*2);x.fill();});
  if(items.length<=100){var labels={};items.forEach(function(item){var p=coords(item.row)[0];if(!p)return;var key=p.map(function(n){return Number(n).toFixed(6)}).join(',');if(!labels[key])labels[key]={p:project(p),ids:[]};labels[key].ids.push(item.row[0])});x.font='bold 18px Tahoma, sans-serif';x.fillStyle='#172c52';Object.values(labels).forEach(function(g){x.fillText(g.ids.slice(0,3).join(' / ')+(g.ids.length>3?' +'+(g.ids.length-3):''),g.p[0]+9,g.p[1]-9)})}
  x.fillStyle='#52627a';x.font='18px Tahoma, sans-serif';x.fillText('แผนผังพิกัด • ไม่มีแผนที่ฐาน',22,535);x.fillText('N ↑',1010,35);
  var left=cx-460/scale,right=cx+460/scale,bottom=cy-200/scale,top=cy+200/scale;x.font='15px Tahoma, sans-serif';x.fillText((left/rad).toFixed(5)+'°E',90,505);x.fillText((right/rad).toFixed(5)+'°E',900,505);x.fillText(((Math.atan(Math.exp(top))*2-Math.PI/2)/rad).toFixed(5)+'°N',15,60);
  return c;
 }
 function lineWrap(ctx,text,width){
  var out=[],lines=String(text==null?'':text).replace(/\r/g,'').split('\n'),segmenter=window.Intl&&Intl.Segmenter?new Intl.Segmenter('th',{granularity:'grapheme'}):null;
  lines.forEach(function(line){var buf='';var chars=segmenter?Array.from(segmenter.segment(line),function(x){return x.segment}):Array.from(line);chars.forEach(function(ch){if(buf&&ctx.measureText(buf+ch).width>width){out.push(buf);buf=ch}else buf+=ch});out.push(buf)});return out;
 }
 async function pdfReport(data,project,fields){
  var doc=await PDFLib.PDFDocument.create();doc.setTitle('COT Field Survey - '+project.code);doc.setAuthor('COT Field Survey');
  var canvas,ctx,y,page=0,W=1240,H=1754;
  async function flush(){if(!canvas)return;ctx.fillStyle='#64748b';ctx.font='19px Tahoma, sans-serif';ctx.fillText('COT Field Survey • '+project.code,60,1690);ctx.textAlign='right';ctx.fillText('หน้า '+page,1180,1690);ctx.textAlign='left';var png=await doc.embedPng(canvas.toDataURL('image/png'));var p=doc.addPage([595.28,841.89]);p.drawImage(png,{x:0,y:0,width:595.28,height:841.89});canvas.width=1;canvas.height=1}
  async function fresh(){await flush();guard();canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#163b81';ctx.fillRect(0,0,W,12);ctx.font='bold 25px Tahoma, sans-serif';ctx.fillText('COT FIELD SURVEY | '+project.code,60,65);ctx.strokeStyle='#d9e0ec';ctx.beginPath();ctx.moveTo(60,84);ctx.lineTo(1180,84);ctx.stroke();y=125;page++}
  async function text(value,size,bold,color,indent){ctx.font=(bold?'bold ':'')+(size||24)+'px Tahoma, sans-serif';var lines=lineWrap(ctx,value,1120-(indent||0));for(var line of lines){if(y>1605){await fresh();ctx.font=(bold?'bold ':'')+(size||24)+'px Tahoma, sans-serif'}ctx.fillStyle=color||'#1e293b';ctx.fillText(line,60+(indent||0),y);y+=(size||24)*1.45}}
  await fresh();await text('รายงานสรุปการสำรวจภาคสนาม',38,true,'#163b81');await text(project.name||project.code,28,true);await text('ออกรายงาน: '+new Date().toLocaleString('th-TH'),21,false,'#64748b');await text('รายการ '+data.items.length+' • ส่งครบ '+data.items.filter(function(i){return i.row[3]==='Completed'}).length+' • ภาพย่อ '+data.items.filter(function(i){return!!i.photo}).length,23,true);
  ctx.drawImage(mapCanvas(data.items),60,y,1120,570);y+=605;await text('ตารางรายการ',28,true,'#163b81');
  var columns=[110,310,280,160,260];
  function tableRow(values,header,index){
   ctx.font=(header?'bold ':'')+'21px Tahoma, sans-serif';
   var lines=values.map(function(v,i){return lineWrap(ctx,v,columns[i]-20)}),height=Math.max(48,...lines.map(function(a){return a.length*29+20}));
   var x=60;ctx.fillStyle=header?'#163b81':index%2?'#f3f6fb':'#fff';ctx.fillRect(60,y-25,1120,height);
   values.forEach(function(v,i){ctx.fillStyle=header?'#fff':'#1e293b';lines[i].forEach(function(line,n){ctx.fillText(line,x+10,y+n*29)});x+=columns[i]});
   ctx.strokeStyle='#d9e0ec';ctx.beginPath();ctx.moveTo(60,y-25+height);ctx.lineTo(1180,y-25+height);ctx.stroke();y+=height;return height;
  }
  tableRow(['รหัส','ประเภท','ผู้สำรวจ','สถานะ','วันที่'],true,0);
  for(var index=0;index<data.items.length;index++){guard();var item=data.items[index],values=[item.row[0],item.row[1],item.row[2],st(item.row[3]),fmt(item.row[8])];ctx.font='21px Tahoma, sans-serif';var ht=Math.max(48,...values.map(function(v,i){return lineWrap(ctx,v,columns[i]-20).length*29+20}));if(y+ht>1605){await fresh();tableRow(['รหัส','ประเภท','ผู้สำรวจ','สถานะ','วันที่'],true,0)}tableRow(values,false,index);}
  if(data.warnings.length)await text('หมายเหตุ: '+Array.from(new Set(data.warnings)).join(' • '),20,false,'#a15300');
  await fresh();await text('รายละเอียดและภาพประกอบ',32,true,'#163b81');
  for(var item of data.items){guard();progress('สร้าง PDF รายการ '+item.row[0]);if(y>1260)await fresh();var r=item.row;y+=12;await text(r[0]+' • '+r[1],29,true,'#163b81');await text('ผู้สำรวจ: '+r[2]+' | วันที่: '+fmt(r[8])+' | สถานะ: '+st(r[3]),22,false);
   await text('พิกัดตัวแทน: '+r[5]+', '+r[6]+(r[11]&&r[11].type!=='Point'?' | '+geoMeasure(r[11]):''),21,false);
   if(item.photo){try{var im=await image(item.photo),h=Math.min(180,im.height),w=h*im.width/im.height;if(y+h>1590)await fresh();ctx.drawImage(im,60,y,w,h);y+=h+25}catch(e){await text('ไม่สามารถแสดงภาพย่อ',21,false)}}else await text(r[4]?'ไม่ได้โหลดภาพย่อ':'ไม่มีภาพถ่าย',20,false,'#64748b');
   await text('รายละเอียด: '+(r[7]||'-'),23,false);for(var field of fields)await text(field.label+': '+((r[10]||{})[field.key]||'-'),22,false);
   if(item.attachments===null||item.attachments===undefined)await text('เสียง/วิดีโอ: ไม่ได้โหลดข้อมูล',21,false,'#a15300');else if(!item.attachments.length)await text('เสียง/วิดีโอ: ไม่มี',21,false,'#64748b');else for(var a of item.attachments)await text((a.kind==='audio'?'เสียง':'วิดีโอ')+': '+a.name+' • '+Math.ceil(a.duration)+' วินาที • '+(a.size/1048576).toFixed(2)+' MB • '+st(a.status),21,false);
   y+=20;
  }
  await flush();return doc.save();
 }
 function xml(s){return String(s==null?'':s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]})}
 function excelGeometry(r){var text=JSON.stringify(r[11]||{type:'Point',coordinates:[Number(r[6]),Number(r[5])]});return text.length>30000?'GeoJSON ยาวเกินขนาดเซลล์ ใช้ Export GeoJSON ในแอปเพื่อรับรูปทรงเต็ม':text}
 function colName(n){var s='';do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1}while(n>=0);return s}
 function cell(v,row,col,style){var ref=colName(col)+row;if(style!==1&&typeof v==='string'&&/^0[0-9]+$/.test(v))style=3;if(typeof v==='number'&&Number.isFinite(v))return'<c r="'+ref+'" s="'+(style||0)+'"><v>'+v+'</v></c>';return'<c r="'+ref+'" t="inlineStr" s="'+(style||0)+'"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>'}
 async function xlsxReport(data,project,fields){
  var zip=new JSZip(),sheets=[],images=[],drawingFiles=[];
  function sheet(name,rows,widths,photos,heights,freeze,merges){
   var i=sheets.length+1,drawing=photos&&photos.length?i:null,cols=widths.map(function(w,k){return'<col min="'+(k+1)+'" max="'+(k+1)+'" width="'+w+'" customWidth="1"/>'}).join('');
   var body=rows.map(function(row,r){return'<row r="'+(r+1)+'"'+(heights&&heights[r]?' ht="'+heights[r]+'" customHeight="1"':'')+'>'+row.map(function(v,c){return cell(v,r+1,c,r===0?1:2)}).join('')+'</row>'}).join('');
   zip.file('xl/worksheets/sheet'+i+'.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" showGridLines="0">'+(freeze?'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>':'')+'</sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>'+cols+'</cols><sheetData>'+body+'</sheetData>'+(freeze?'<autoFilter ref="A1:'+colName(widths.length-1)+rows.length+'"/>':'')+(merges?'<mergeCells count="'+merges.length+'">'+merges.map(function(m){return'<mergeCell ref="'+m+'"/>'}).join('')+'</mergeCells>':'')+'<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'+(drawing?'<drawing r:id="rId1"/>':'')+'</worksheet>');
   if(drawing){
    zip.file('xl/worksheets/_rels/sheet'+i+'.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing'+i+'.xml"/></Relationships>');
    var anchors=[],rels=[];photos.forEach(function(p,k){var ext=p.url.indexOf('data:image/png')===0?'png':'jpeg',num=images.length+1,file='image'+num+'.'+ext;images.push(file);zip.file('xl/media/'+file,p.url.split(',')[1],{base64:true});rels.push('<Relationship Id="rId'+(k+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/'+file+'"/>');anchors.push('<xdr:oneCellAnchor><xdr:from><xdr:col>'+p.col+'</xdr:col><xdr:colOff>19050</xdr:colOff><xdr:row>'+p.row+'</xdr:row><xdr:rowOff>19050</xdr:rowOff></xdr:from><xdr:ext cx="'+Math.round(p.width*9525)+'" cy="'+Math.round(p.height*9525)+'"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="'+(k+1)+'" name="ภาพ '+(k+1)+'"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId'+(k+1)+'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+Math.round(p.width*9525)+'" cy="'+Math.round(p.height*9525)+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>')});
    zip.file('xl/drawings/drawing'+i+'.xml','<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+anchors.join('')+'</xdr:wsDr>');
    zip.file('xl/drawings/_rels/drawing'+i+'.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>');drawingFiles.push(i);
   }
   sheets.push(name);
  }
  var missing=data.items.filter(function(i){return i.row[4]>0&&!i.photo}).length;
  var summary=[['COT FIELD SURVEY','รายงานสรุปโครงการ'],['รหัสโครงการ',project.code],['ชื่อโครงการ',project.name||''],['วันที่ออกรายงาน',new Date().toLocaleString('th-TH')],['รายการทั้งหมด',data.items.length],['ส่งครบ',data.items.filter(function(i){return i.row[3]==='Completed'}).length],['ภาพย่อที่โหลดไม่ได้',missing],['ขอบเขต','ข้อมูลที่โหลดไว้ ไม่รวมรายการที่อยู่เฉพาะในเครื่อง'],['ภาพรวมพิกัด','ไม่มีแผนที่ฐาน']];for(var i=0;i<23;i++)summary.push([]);
  sheet('สรุป',summary,[23,35,16,16,16,16,16,16],[{url:mapCanvas(data.items).toDataURL('image/png'),row:9,col:0,width:900,height:458}],[32,24,48,26,24,24,24,38,24],false,['B1:H1','B2:H2','B3:H3','B4:H4','B8:H8','B9:H9']);
  var headers=['รหัส','วันที่','ประเภท','ผู้สำรวจ','สถานะ','ละติจูด','ลองจิจูด','ความยาว/พื้นที่','รายละเอียด'].concat(fields.map(function(f){return f.label}),['จำนวนเสียง/วิดีโอ','GeoJSON','ภาพย่อ']),rows=[headers],photos=[],heights=[32];
  for(var index=0;index<data.items.length;index++){var item=data.items[index],r=item.row;rows.push([r[0],fmt(r[8]),r[1],r[2],st(r[3]),Number(r[5]),Number(r[6]),r[11]?geoMeasure(r[11]):'',r[7]].concat(fields.map(function(f){return(r[10]||{})[f.key]||''}),[item.attachments?item.attachments.length:'ไม่ได้โหลด',excelGeometry(r),item.photo?'':r[4]?'ไม่ได้โหลด':'ไม่มีภาพ']));heights.push(Math.max(90,Math.min(400,Math.ceil(String(r[7]||'').length/45)*15)));if(item.photo){var im=await image(item.photo),scale=Math.min(118/im.width,88/im.height);photos.push({url:item.photo,row:index+1,col:headers.length-1,width:im.width*scale,height:im.height*scale})}};
  sheet('รายการสำรวจ',rows,[12,18,24,22,16,18,18,28,55].concat(fields.map(function(){return 24}),[20,45,20]),photos,heights,true);
  var attachments=[['รหัสรายการ','ประเภทไฟล์','ชื่อไฟล์','วินาที','ขนาด MB','ชนิด MIME','สถานะ','Drive URL']];data.items.forEach(function(item){(item.attachments||[]).forEach(function(a){attachments.push([item.row[0],a.kind==='audio'?'เสียง':'วิดีโอ',a.name,Math.round(a.duration*10)/10,Math.round(a.size/1048576*1000)/1000,a.mime,st(a.status),a.url||''])});if(!item.attachments)attachments.push([item.row[0],'ไม่ได้โหลดข้อมูล','','','','','',''])});
  sheet('ไฟล์แนบ',attachments,[12,16,45,14,14,24,16,60],[],null,true);
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets.map(function(n,i){return'<sheet name="'+xml(n)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>'}).join('')+'</sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map(function(n,i){return'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>'}).join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/styles.xml','<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Tahoma"/><color rgb="FF172C52"/></font><font><b/><sz val="11"/><name val="Tahoma"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163B81"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FFD9E0EC"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map(function(n,i){return'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'}).join('')+drawingFiles.map(function(i){return'<Override PartName="/xl/drawings/drawing'+i+'.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'}).join('')+'</Types>');
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
 }
 async function run(kind){
  if(running)return;var rows=JSON.parse(JSON.stringify($('report-scope').value==='filtered'?vis():S));if(!rows.length){progress('ไม่มีรายการสำหรับออกรายงาน');return}
  var project=JSON.parse(JSON.stringify(cur));running=true;cancelled=false;$('report-pdf').disabled=$('report-xlsx').disabled=true;$('report-scope').disabled=true;$('report-close').textContent='ยกเลิก';
  try{var data=await collect(rows,project.code);guard();progress('กำลังสร้างไฟล์…');var bytes=kind==='pdf'?await pdfReport(data,project,project.fields||[]):await xlsxReport(data,project,project.fields||[]);guard();save('COT-'+project.code+'-'+new Date().toISOString().slice(0,10)+'.'+kind,bytes,kind==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');progress('สร้างแล้ว '+rows.length+' รายการ'+(data.warnings.length?' · มีข้อมูล/ภาพบางส่วนโหลดไม่ได้ ตรวจหมายเหตุในรายงาน':''))}catch(e){progress(e.message)}finally{running=false;$('report-pdf').disabled=$('report-xlsx').disabled=false;$('report-scope').disabled=false;$('report-close').textContent='ปิด'}
 }
 $('report-pdf').onclick=function(){run('pdf')};$('report-xlsx').onclick=function(){run('xlsx')};
})();
