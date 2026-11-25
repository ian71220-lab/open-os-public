(() => {
'use strict';
const fields=['title','notes','start','end','allDay'];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const instant=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():String(value||'');};
const snapshot=event=>({title:String(event.title||''),notes:String(event.notes||''),start:instant(event.start),end:instant(event.end||event.start),allDay:!!event.allDay});
const equal=(a,b)=>JSON.stringify(snapshot(a))===JSON.stringify(snapshot(b));
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function metadata(event){const m=event?.importMetadata;return m&&m.version===1&&uuidPattern.test(m.source_id)&&['apple','google','file'].includes(m.source_type)&&typeof m.source_name==='string'&&typeof m.uid==='string'&&typeof m.instance==='string'?m:null;}
function sources(events){const list=new Map();for(const event of events){const m=metadata(event);if(m&&!list.has(m.source_id))list.set(m.source_id,{id:m.source_id,name:m.source_name,type:m.source_type});}return [...list.values()];}
function sourceLabel(event){const m=metadata(event);if(!m)return '';return `${({apple:'Apple Calendar',google:'Google Calendar',file:'匯入檔案'})[m.source_type]}${m.source_name?' · '+m.source_name:''}`;}
function dateValue(raw,params){
 const m=raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
 if(!m)throw new Error('日期格式不支援');
 const test=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
 if(test.getUTCFullYear()!==+m[1]||test.getUTCMonth()!==+m[2]-1||test.getUTCDate()!==+m[3]||+(m[4]||0)>23||+(m[5]||0)>59||+(m[6]||0)>59)throw new Error('日期無效');
 const stamp=`${m[1]}-${m[2]}-${m[3]}T${m[4]||'00'}:${m[5]||'00'}:${m[6]||'00'}`;
 if(m[7])return new Date(stamp+'Z').toISOString();
 const zone=params.match(/TZID="?([^";:]+)"?/i)?.[1];
 if(!zone)return new Date(stamp).toISOString();
 const target=Date.parse(stamp+'Z');let time=target;
 const format=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const v=Object.fromEntries(format.formatToParts(time).map(x=>[x.type,x.value]));const seen=Date.UTC(+v.year,+v.month-1,+v.day,+v.hour,+v.minute,+v.second);const delta=target-seen;time+=delta;if(!delta)break;}
 return new Date(time).toISOString();
}
function parse(text){
 const source=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/\n[ \t]/g,'');
 if(!/^BEGIN:VCALENDAR\s*$/mi.test(source)||!/^END:VCALENDAR\s*$/mi.test(source))throw new Error('請選擇有效的 ICS 行事曆檔案。');
 const events=[],skipped=[];const decode=value=>String(value||'').replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');
 for(const block of source.split(/^BEGIN:VEVENT\s*$/mi).slice(1)){
  const values={};let nested=0;
  for(const line of block.split(/^END:VEVENT\s*$/mi)[0].split('\n')){if(/^BEGIN:/.test(line)){nested++;continue;}if(/^END:/.test(line)){nested--;continue;}if(nested)continue;const colon=line.indexOf(':');if(colon<0)continue;const head=line.slice(0,colon),key=head.split(';')[0].toUpperCase();values[key]={value:line.slice(colon+1),params:head};}
  const title=decode(values.SUMMARY?.value)||'未命名活動';
  const skip=reason=>skipped.push({title,reason});
  if(!/^END:VEVENT\s*$/mi.test(block)){skip('活動區塊不完整');continue;}
  if(values.RRULE||values.RDATE||values.EXDATE){skip('週期規則尚未支援，請匯出為獨立實例');continue;}
  if(values.STATUS?.value==='CANCELLED'){skip('來源取消通知，未刪除既有活動');continue;}
  if(values.DURATION||values['RECURRENCE-ID']?.params.includes('RANGE=')){skip('活動時長或週期範圍更新尚未支援');continue;}
  try{
   if(!values.DTSTART)throw new Error('缺少開始日期');
   const start=dateValue(values.DTSTART.value,values.DTSTART.params),allDay=/^\d{8}$/.test(values.DTSTART.value);
   if(values.DTEND&&/^\d{8}$/.test(values.DTEND.value)!==allDay)throw new Error('開始與結束日期型別不一致');
   let end;if(values.DTEND)end=dateValue(values.DTEND.value,values.DTEND.params);else if(allDay){const next=new Date(start);next.setDate(next.getDate()+1);end=next.toISOString();}else end=new Date(+new Date(start)+3600000).toISOString();
   if(new Date(end)<new Date(start))throw new Error('結束早於開始');
   const recurrence=values['RECURRENCE-ID'];
   const instance=recurrence?(/^\d{8}$/.test(recurrence.value)?'date:'+recurrence.value:'time:'+dateValue(recurrence.value,recurrence.params)):'';
   const uid=String(values.UID?.value||'').trim();
   if(new TextEncoder().encode(uid).length>512)throw new Error('UID 過長，請先確認來源檔案');
   const sequence=values.SEQUENCE?Number(values.SEQUENCE.value):0;
   if(!Number.isSafeInteger(sequence)||sequence<0)throw new Error('來源版本無效');
   const modified=values['LAST-MODIFIED']?dateValue(values['LAST-MODIFIED'].value,values['LAST-MODIFIED'].params):null;
   events.push({title,notes:decode(values.DESCRIPTION?.value),start,end,allDay,uid,instance,sequence,modified});
  }catch(error){skip(error.message);}
 }
 return {events,skipped};
}
const identity=(uid,instance)=>JSON.stringify([uid,instance]);
function versionOrder(incoming,previous){if(incoming.sequence!==previous.sequence)return incoming.sequence>previous.sequence?1:-1;if(incoming.modified&&previous.modified){const diff=Date.parse(incoming.modified)-Date.parse(previous.modified);if(diff)return diff>0?1:-1;}return 0;}
function plan(existing,parsed,source,allowUnidentified=false){
 const result={add:[],update:[],unchanged:[],conflicts:[],unidentified:[],skipped:parsed.skipped.slice()};
 const old=new Map(),incoming=new Map();
 for(const event of existing){const m=metadata(event);if(!m||m.source_id!==source.id||!m.uid)continue;const key=identity(m.uid,m.instance);old.set(key,[...(old.get(key)||[]),event]);}
 for(const event of parsed.events){if(!event.uid){result.unidentified.push(event);continue;}const key=identity(event.uid,event.instance);incoming.set(key,[...(incoming.get(key)||[]),event]);}
 const meta=event=>({version:1,source_id:source.id,source_type:source.type,source_name:source.name,uid:event.uid,instance:event.instance,sequence:event.sequence,modified:event.modified,imported_at:new Date().toISOString(),baseline:snapshot(event)});
 for(const [key,rows] of incoming){const event=rows[0];if(rows.some(row=>!equal(row,event)||row.sequence!==event.sequence||row.modified!==event.modified)){result.conflicts.push({title:event.title,reason:'檔案包含同身份的不同版本，保留既有資料'});continue;}
  const matches=old.get(key)||[];if(matches.length>1){result.conflicts.push({title:event.title,reason:'既有資料存在重複來源身份，未更新'});continue;}
  if(!matches.length){result.add.push({...snapshot(event),importMetadata:meta(event)});continue;}
  const current=matches[0],previous=metadata(current);
  if(!previous.baseline||!Number.isSafeInteger(previous.sequence)){result.conflicts.push({title:event.title,reason:'缺少可靠匯入基準，未更新'});continue;}
  const order=versionOrder(event,previous);
  if(order<0){result.skipped.push({title:event.title,reason:'來源版本較舊，未更新'});continue;}
  if(!equal(current,previous.baseline)){
   if(equal(event,previous.baseline)){result.unchanged.push(event);continue;}
   result.conflicts.push({title:event.title,reason:'活動已在 OPEN OS 編輯且來源有變更，保留本機內容'});continue;
  }
  if(equal(event,previous.baseline)&&order===0){result.unchanged.push(event);continue;}
  if(!equal(event,previous.baseline)&&order===0){result.conflicts.push({title:event.title,reason:'來源內容已變，但無較新版本證據，未覆寫'});continue;}
  result.update.push({id:current.id,fields:snapshot(event),importMetadata:meta(event)});
 }
 if(allowUnidentified)for(const event of result.unidentified)result.add.push({...snapshot(event),importMetadata:meta(event)});
 return result;
}
function preview({parsed,events,apply,uuid}){
 return new Promise(resolve=>{
  const known=sources(events),fresh={id:uuid(),name:'',type:'file'};
  const overlay=document.createElement('div');overlay.className='modal-backdrop';
  overlay.innerHTML=`<section class="modal calendar-import-modal" role="dialog" aria-modal="true" aria-label="匯入行事曆檔案"><div class="modal-header"><h2>匯入行事曆檔案</h2><button type="button" class="icon-btn" data-close aria-label="關閉">×</button></div><p class="muted">這是檔案快照，不是即時同步。重新匯入請選擇相同來源，不會刪除檔案未包含的活動。</p><form><label><span>匯入來源</span><select name="source" required>${known.map(x=>`<option value="${escape(x.id)}">${escape(x.name)}（${escape(({apple:'Apple Calendar',google:'Google Calendar',file:'匯入檔案'})[x.type])}）</option>`).join('')}<option value="new" selected>建立新的匯入來源</option></select></label><div data-new-source><label><span>來源名稱</span><input name="sourceName" maxlength="80" required placeholder="例如：個人行事曆"></label><label><span>來源類型，請依實際匯出來源選擇</span><select name="sourceType"><option value="file">匯入檔案／不確定</option><option value="apple">Apple Calendar</option><option value="google">Google Calendar</option></select></label></div><p class="muted">舊活動若沒有來源 UID，無法自動配對，新增可能與舊資料重複。來源名稱不會建立分類。</p><label class="calendar-import-choice"><input type="checkbox" name="unidentified"><span>允許新增沒有 UID 的活動。我了解再次匯入可能重複。</span></label><div data-summary role="status" aria-live="polite"></div><div class="calendar-import-results" data-results></div><p data-error role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-close>取消</button><button type="submit" class="primary-btn">確認匯入</button></div></form></section>`;
  document.body.appendChild(overlay);window.IAN_OS_DIALOG?.activate(overlay);
  const form=overlay.querySelector('form'),sourceSelect=form.elements.source,name=form.elements.sourceName,type=form.elements.sourceType,allow=form.elements.unidentified,submit=form.querySelector('[type=submit]');let busy=false,applied=false;
  const selected=()=>sourceSelect.value==='new'?{...fresh,name:name.value.trim(),type:type.value}:known.find(x=>x.id===sourceSelect.value);
  const draw=()=>{const isNew=sourceSelect.value==='new';overlay.querySelector('[data-new-source]').hidden=!isNew;name.required=isNew;const p=plan(events,parsed,selected(),allow.checked);overlay.querySelector('[data-summary]').textContent=`新增 ${p.add.length} 筆，更新 ${p.update.length} 筆，未變更 ${p.unchanged.length} 筆，衝突 ${p.conflicts.length} 筆，略過 ${p.skipped.length+(allow.checked?0:p.unidentified.length)} 筆。`;overlay.querySelector('[data-results]').innerHTML=[...p.add.map(x=>({title:x.title,reason:'新增'})),...p.update.map(x=>({title:x.fields.title,reason:'更新'})),...p.conflicts,...p.skipped,...(!allow.checked?p.unidentified.map(x=>({title:x.title,reason:'沒有 UID，預設略過'})):[])].map(x=>`<div><b>${escape(x.title)}</b><small>${escape(x.reason)}</small></div>`).join('');submit.disabled=busy||applied||!(p.add.length+p.update.length);};
  const close=()=>{if(busy)return;overlay.remove();resolve();};overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}},true);
  sourceSelect.onchange=draw;name.oninput=draw;type.onchange=draw;allow.onchange=draw;
  form.onsubmit=async e=>{e.preventDefault();if(busy||applied)return;const source=selected();if(!source?.name)return;busy=true;submit.disabled=true;overlay.querySelectorAll('[data-close]').forEach(b=>b.disabled=true);try{await apply(parsed,source,allow.checked);applied=true;busy=false;close();}catch(error){applied=true;overlay.querySelector('[data-error]').textContent=error.message||'匯入未完成，請檢查同步狀態。';}finally{busy=false;overlay.querySelectorAll('[data-close]').forEach(b=>b.disabled=false);submit.disabled=applied;}};
  draw();sourceSelect.focus();
 });
}
window.IAN_OS_CALENDAR_IMPORT={parse,plan,metadata,sources,sourceLabel,snapshot,preview};
})();
