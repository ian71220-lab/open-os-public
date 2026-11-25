(() => {
  const u=zh=>window.IAN_OS_UI?.text(zh)||zh;
  const periods=[['morning','☀','早上'],['noon','◉','中午'],['afternoon','◐','下午'],['evening','☾','晚上']];
  const displayPeriods=[['☀','上午',['morning']],['◉','中午',['noon']],['◐','下午／傍晚',['afternoon','evening']]];
  const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function travelDateLabel(value,short=false){
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return String(value||'');
    const [,y,m,d]=match,date=new Date(0);date.setUTCFullYear(+y,+m-1,+d);date.setUTCHours(12,0,0,0);
    if(date.getUTCFullYear()!==+y||date.getUTCMonth()!==+m-1||date.getUTCDate()!==+d)return String(value);
    if(window.IAN_OS_UI?.lang()==='en')return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',...(short?{}:{year:'numeric'})}).format(date);
    return `${short?'':y+'/'}${m}/${d}（週${'日一二三四五六'[date.getUTCDay()]}）`;
  }
  function dates(start,end){const a=new Date(start+'T12:00:00'),b=new Date(end+'T12:00:00'),out=[];if(!Number.isFinite(+a)||!Number.isFinite(+b)||b<a)return out;for(let d=a;d<=b;d.setDate(d.getDate()+1)){out.push(dayKey(d));if(out.length>60)return [];}return out;}
  function blankDay(date){return {date,periods:Object.fromEntries(periods.map(([key])=>[key,Array.from({length:5},()=>({time:'',text:'',done:false}))])),highlight:'',breakfast:'',lunch:'',dinner:'',lateMeal:'',restaurants:'',transport:'',lodging:'',cost:0,notes:'',drivingSegments:[],routeStops:[],shoppingList:[]};}
  function checks(items){return (Array.isArray(items)?items:[]).slice(0,200).map(x=>({text:String(x.text||'').slice(0,300),done:!!x.done}));}
  const hasItineraryData=item=>!!(String(item?.text||'').trim()||String(item?.time||'').trim()||item?.done);
  function itineraryCount(day){const slots=periods.flatMap(([key])=>day?.periods?.[key]||[]);return slots.filter(hasItineraryData).length+['highlight','breakfast','lunch','dinner','lateMeal','restaurants','transport','lodging','notes'].filter(key=>String(day?.[key]||'').trim()).length+(Number(day?.cost)>0?1:0);}
  function preservedDayContent(day){if(!day)return 0;const slots=periods.flatMap(([key])=>day.periods?.[key]||[]),known=new Set(['date','periods','highlight','breakfast','lunch','dinner','lateMeal','restaurants','transport','lodging','cost','notes','drivingSegments','routeStops','attachments','shoppingList']);const unknown=Object.entries(day).filter(([key,value])=>!known.has(key)&&value!=null&&value!==''&&!(Array.isArray(value)&&!value.length)&&!(typeof value==='object'&&!Array.isArray(value)&&!Object.keys(value).length));const extraPeriods=Object.entries(day.periods||{}).filter(([key])=>!periods.some(([knownKey])=>knownKey===key)).flatMap(([,items])=>Array.isArray(items)?items:[]).filter(hasItineraryData).length;const shopping=(Array.isArray(day.shoppingList)?day.shoppingList:[]).filter(item=>String(item?.text||'').trim()).length;return itineraryCount(day)+extraPeriods+(day.drivingSegments||[]).length+(day.routeStops||[]).length+(Array.isArray(day.attachments)?day.attachments.length:0)+shopping+unknown.length;}
  function flightDate(trip,leg){const departureDate=String(leg?.departure||'').slice(0,10);return leg?.kind==='connection'?(leg.day||departureDate||''):(departureDate||((leg?.kind==='return')?trip?.end:trip?.start)||'');}
  function travelDays(trip){
    const range=dates(trip.start,trip.end),rangeSet=new Set(range),stored=new Map();
    (trip.days||[]).forEach(day=>{if(!day?.date)return;const current=stored.get(day.date);if(!current){stored.set(day.date,day);return;}const preferred=preservedDayContent(day)>preservedDayContent(current)?day:current,other=preferred===day?current:day;const lists=[...(Array.isArray(preferred.shoppingList)?preferred.shoppingList:[]),...(Array.isArray(other.shoppingList)?other.shoppingList:[])],seen=new Set();preferred.shoppingList=lists.filter(item=>{const key=item?.id||`${item?.text||''}|${!!item?.done}`;if(seen.has(key))return false;seen.add(key);return true;});stored.set(day.date,preferred);});
    const flightDates=new Set((trip.flights||[]).map(leg=>flightDate(trip,leg)).filter(Boolean));
    const preserved=new Set([...stored.values()].filter(day=>!rangeSet.has(day.date)&&preservedDayContent(day)>0).map(day=>day.date));
    flightDates.forEach(date=>{if(!rangeSet.has(date))preserved.add(date);});
    return [...range.map((date,index)=>({date,index,normal:true,day:stored.get(date)||blankDay(date)})),
      ...[...preserved].sort().map(date=>({date,normal:false,day:stored.get(date)||blankDay(date)}))];
  }
  function reconcileTripDays(trip,start,end){
    const range=dates(start,end);if(!range.length)return null;
    const old=trip?.days||[],flightDates=new Set((trip?.flights||[]).map(leg=>flightDate(trip,leg)).filter(Boolean)),keepDates=new Set([...range,...flightDates]);
    old.forEach(day=>{if(day?.date&&(range.includes(day.date)||flightDates.has(day.date)||preservedDayContent(day)>0))keepDates.add(day.date);});
    const days=old.filter(day=>day?.date&&keepDates.has(day.date)),existingDates=new Set(days.map(day=>day.date));
    [...keepDates].forEach(date=>{if(!existingDates.has(date))days.push(blankDay(date));});
    days.sort((a,b)=>a.date.localeCompare(b.date));
    return {range,days,preservedDates:[...keepDates].filter(date=>!range.includes(date)).sort()};
  }
  function setTripCompletion(trip,completed,now=new Date().toISOString()){
    trip.completedAt=completed?now:null;trip.updatedAt=now;return trip;
  }
  function clearDateItinerary(trip,date){
    const matching=(trip?.days||[]).filter(day=>day.date===date);
    matching.forEach(day=>{
      day.periods ||= {};
      periods.forEach(([key])=>{day.periods[key]=Array.from({length:5},()=>({time:'',text:'',done:false}));});
      ['highlight','breakfast','lunch','dinner','lateMeal','restaurants','transport','lodging','notes'].forEach(key=>{day[key]='';});day.cost=0;
    });
    const retained=matching.some(day=>preservedDayContent(day)>0)||(trip?.flights||[]).some(leg=>flightDate(trip,leg)===date);
    if(!retained&&trip)trip.days=trip.days.filter(day=>day.date!==date);
    return {matching:matching.length,retained};
  }
  function create(api){
    const {state,save,toast,escape:esc,removePreference,removeOwned}=api;let checklistDraft=[],tripId=null,activeDay='';
    const prefs=()=>state().settings.preferences ||= {};
    const trips=()=>prefs().trips ||= [];
    const travelDayEntries=travelDays;
    function relatedCount(trip,day){const date=day.date,shopping=(Array.isArray(day.shoppingList)?day.shoppingList:[]).filter(item=>String(item?.text||'').trim()).length;return Math.max(1,itineraryCount(day)+shopping+(day.drivingSegments||[]).length+(day.routeStops||[]).length+(Array.isArray(day.attachments)?day.attachments.length:0)+(trip.flights||[]).filter(leg=>flightDate(trip,leg)===date).length);}
    function modal(title,body,onSave,wide=false){title=u(title);const overlay=document.createElement('div');overlay.className='modal-backdrop planning-overlay';overlay.innerHTML=`<section class="modal ${wide?'wide-modal':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-header"><div><div class="eyebrow">QUICK CAPTURE</div><h2>${esc(title)}</h2></div><button type="button" class="icon-btn" data-close aria-label="關閉">×</button></div><form>${body}<div class="modal-actions"><button type="button" class="secondary-btn" data-close>取消</button><button class="primary-btn" type="submit">儲存</button></div></form></section>`;document.body.appendChild(overlay);window.IAN_OS_DIALOG?.activate(overlay);let dirty=false;overlay.oninput=overlay.onchange=()=>{dirty=true;};const dismiss=()=>{if(!dirty||confirm(u('有尚未儲存的修改。確定放棄修改並關閉？')))overlay.remove();};overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=dismiss);overlay.querySelector('form').onsubmit=e=>{e.preventDefault();if(onSave(new FormData(e.target))!==false)overlay.remove();};overlay.onkeydown=e=>{if(e.key==='Escape'&&!e.isComposing){e.stopPropagation();dismiss();}};(overlay.querySelector('form input:not([type=hidden]):not([disabled]),form textarea:not([disabled]),form select:not([disabled])')||overlay.querySelector('[data-close]'))?.focus();return overlay;}
    const flights=window.IAN_OS_FLIGHTS.create({modal,save,toast,escape:esc,render:()=>renderTravel(),state,removePreference});
    const roadTrips=window.IAN_OS_ROADTRIPS.create({modal,save,toast,escape:esc,render:()=>renderTravel(),state,removePreference,u});
    const travelRoot=document.getElementById('app');
    const travelDeleteObserver=new MutationObserver(()=>{
      travelRoot.querySelectorAll('.automation-roadmap + .panel details, [data-concepts] details').forEach((details,index)=>{
        if(details.querySelector('[data-delete-workflow]'))return;const workflow=state().workflows?.[index];if(!workflow)return;
        const remove=document.createElement('button');remove.type='button';remove.className='danger-btn secondary-danger compact';remove.dataset.deleteWorkflow=workflow.id;remove.textContent=window.IAN_OS_UI?.lang()==='en'?'Delete':'刪除';details.append(remove);
        remove.onclick=()=>removeOwned({table:'workflows',id:workflow.id,name:workflow.title,mutate:s=>{s.workflows=s.workflows.filter(value=>value.id!==workflow.id);},success:window.IAN_OS_UI?.lang()==='en'?'Workflow deleted':'已刪除工作流程'});
      });
    });
    travelDeleteObserver.observe(travelRoot,{childList:true,subtree:true});
    function editor(items=[]){checklistDraft=checks(items);drawEditor();}
    function drawEditor(){const host=document.getElementById('captureChecklist');if(!host)return;host.innerHTML=`<div class="section-head"><h3>☑ 勾選清單 <small>${checklistDraft.length}/200</small></h3><button type="button" class="secondary-btn compact" id="addChecklist" ${checklistDraft.length>=200?'disabled':''}>＋ 新增一項</button></div><div class="checklist-rows">${checklistDraft.map((x,i)=>`<div class="checklist-edit"><input type="checkbox" data-done="${i}" aria-label="完成第 ${i+1} 項" ${x.done?'checked':''}><input data-text="${i}" aria-label="第 ${i+1} 項" maxlength="300" value="${esc(x.text)}" placeholder="填寫待完成項目"><button type="button" class="icon-btn" data-remove="${i}" aria-label="移除第 ${i+1} 項">×</button></div>`).join('')}</div>`;host.querySelector('#addChecklist').onclick=()=>{if(checklistDraft.length<200){checklistDraft.push({text:'',done:false});drawEditor();host.querySelector('[data-text="'+(checklistDraft.length-1)+'"]')?.focus();}};host.querySelectorAll('[data-text]').forEach(el=>el.oninput=()=>checklistDraft[+el.dataset.text].text=el.value);host.querySelectorAll('[data-done]').forEach(el=>el.onchange=()=>checklistDraft[+el.dataset.done].done=el.checked);host.querySelectorAll('[data-remove]').forEach(el=>el.onclick=async()=>{const index=+el.dataset.remove,item=checklistDraft[index];const removed=await window.IAN_OS_DELETE.run({name:item?.text||u('勾選項目'),action:async()=>{}});if(!removed)return;checklistDraft.splice(index,1);drawEditor();});}
    function appendChecklist(host,item){const list=checks(item.checklist).filter(x=>x.text.trim());if(!list.length)return;let block=host.querySelector('.preview-checklist');if(!block){block=document.createElement('section');block.className='preview-checklist';(host.querySelector('.detail-panel,.prompt-detail,.video-detail')||host).appendChild(block);}const completed=list.filter(x=>x.done).length;block.innerHTML=`<h3>☑ 勾選清單 <small>${completed} / ${list.length}</small></h3><progress max="${list.length}" value="${completed}"></progress>${list.map((x,i)=>`<label class="checklist-view ${x.done?'checked':''}"><input type="checkbox" data-check="${i}" ${x.done?'checked':''}><span>${esc(x.text)}</span></label>`).join('')}`;block.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{list[+el.dataset.check].done=el.checked;item.checklist=list;save();appendChecklist(host,item);});}
    function shoppingItems(owner){if(!Array.isArray(owner.shoppingList))owner.shoppingList=[];owner.shoppingList=owner.shoppingList.map(item=>typeof item==='string'?{id:window.IAN_OS_CLOUD.uuid(),text:item,done:false}:{...item,id:item.id||window.IAN_OS_CLOUD.uuid(),text:String(item.text??item.name??''),done:!!item.done});return owner.shoppingList;}
    function shoppingOwner(trip,scope,date,create=false){if(scope==='trip')return trip;let day=(trip.days||[]).find(value=>value.date===date);if(!day&&create){day=blankDay(date);trip.days.push(day);}return day||null;}
    function travelChecklistMarkup(trip){const list=checks(trip.checklist);trip.checklist=list;const shown=list.map((item,index)=>item.text.trim()?`<div class="travel-list-row ${item.done?'is-done':''}" data-trip-check-row="${index}" data-reorder-index="${index}"><button type="button" class="travel-drag-handle" aria-label="${u('調整順序')}：${esc(item.text)}" title="${u('拖曳，或聚焦後按上下鍵移動')}">⠿</button><label class="travel-list-check"><input type="checkbox" data-trip-check="${index}" aria-label="${esc(item.text)}" ${item.done?'checked':''}><span title="${esc(item.text)}">${esc(item.text)}</span></label><div class="travel-list-actions"><button type="button" class="secondary-btn compact" data-trip-check-edit="${index}" aria-label="${u('編輯')}：${esc(item.text)}">${u('編輯')}</button><button type="button" class="secondary-btn compact" data-trip-check-delete="${index}" aria-label="${u('刪除')}：${esc(item.text)}">${u('刪除')}</button></div></div>`:'').join(''),completed=list.filter(item=>item.text.trim()&&item.done).length,total=list.filter(item=>item.text.trim()).length;return `<section class="panel travel-list-panel"><div class="section-head travel-list-head"><h2>${(globalThis.IAN_OS_ICON?.('check')||'')} ${u('勾選清單')}</h2><div class="travel-list-head-actions"><small>${completed} / ${total}</small><button type="button" class="secondary-btn compact" data-trip-check-add ${total>=200?'disabled':''}>＋ ${u('新增項目')}</button></div></div><div class="travel-list-items travel-checklist-items" data-reorder-key="checklist">${shown||`<p class="muted">${u('尚未安排')}</p>`}</div></section>`;}
    function shoppingPanelMarkup(scope,date,owner,title){const all=shoppingItems(owner),visible=all.filter(item=>item.text.trim()),done=visible.filter(item=>item.done).length,rows=all.map((item,index)=>item.text.trim()?`<div class="travel-list-row ${item.done?'is-done':''}" data-reorder-index="${index}"><button type="button" class="travel-drag-handle" aria-label="${u('調整順序')}：${esc(item.text)}" title="${u('拖曳，或聚焦後按上下鍵移動')}">⠿</button><label class="travel-list-check"><input type="checkbox" data-shopping-toggle="${esc(item.id)}" data-shopping-scope="${scope}" data-shopping-date="${esc(date||'')}" aria-label="${esc(item.done?u('標記為未購買'):u('標記為已購買'))}：${esc(item.text)}" ${item.done?'checked':''}><span title="${esc(item.text)}" aria-label="${esc(item.text)}">${esc(item.text)}</span></label><div class="travel-list-actions"><button type="button" class="secondary-btn compact" data-shopping-edit="${esc(item.id)}" data-shopping-scope="${scope}" data-shopping-date="${esc(date||'')}">${u('編輯')}</button><button type="button" class="secondary-btn compact" data-shopping-delete="${esc(item.id)}" data-shopping-scope="${scope}" data-shopping-date="${esc(date||'')}">${u('刪除')}</button></div></div>`:'').join('');return `<section class="panel travel-list-panel travel-shopping-panel"><div class="section-head travel-list-head"><h2>${(globalThis.IAN_OS_ICON?.('cart')||'')} ${u(title)}</h2><div class="travel-list-head-actions"><small>${done} / ${visible.length}</small><button type="button" class="secondary-btn compact" data-shopping-add data-shopping-scope="${scope}" data-shopping-date="${esc(date||'')}" ${visible.length>=200?'disabled':''}>＋ ${u('新增項目')}</button></div></div><div class="travel-list-items travel-checklist-items travel-shopping-trip-items" data-reorder-key="${scope==='trip'?'shop-trip':'shop-day-'+esc(date||'')}">${rows||`<p class="muted">${u('尚無購買項目')}</p>`}</div></section>`;}
    // Reorder helper for checklist and trip shopping rows (v1.0.4.35).
    // The dragged row floats under the pointer (fixed position + transform) while a placeholder marks the drop slot.
    // Other rows glide into place (FLIP), so items shift instead of swapping. Drop above or below the nearest row.
    // Mouse drags start after 4px of movement; touch and pen start after a 350ms long press.
    function attachReorder(container,onMove){
      if(!container)return;
      const ac=new AbortController(),sig={signal:ac.signal};
      // Keyboard path (v1.0.4.40): focus a row's ⠿ handle, then ↑/↓ moves it one place. Same onMove as dragging.
      container.addEventListener('keydown',e=>{const handle=e.target.closest?.('.travel-drag-handle');if(!handle||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const rows=[...container.querySelectorAll('[data-reorder-index]')],row=handle.closest('[data-reorder-index]'),at=rows.indexOf(row),neighbor=rows[at+(e.key==='ArrowUp'?-1:1)];if(!row||!neighbor)return;const from=Number(row.dataset.reorderIndex),target=Number(neighbor.dataset.reorderIndex),slot=e.key==='ArrowDown'?target+1:target,newIndex=from<slot?slot-1:slot,key=container.dataset.reorderKey;onMove(from,slot);requestAnimationFrame(()=>document.querySelector(`[data-reorder-key="${key}"] [data-reorder-index="${newIndex}"] .travel-drag-handle`)?.focus({preventScroll:true}));},sig);
      let drag=null,suppressUntil=0,frame=0;
      const live=()=>{if(container.isConnected)return true;ac.abort();return false;};
      const rowEls=()=>[...container.querySelectorAll('[data-reorder-index]')];
      const otherRows=()=>rowEls().filter(el=>el!==drag?.row);
      const animateMoves=(before)=>{
        before.forEach(({el,rect})=>{
          if(!el.isConnected)return;
          const now=el.getBoundingClientRect(),dx=rect.left-now.left,dy=rect.top-now.top;
          if((dx||dy)&&el.animate)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:200,easing:'cubic-bezier(.2,.7,.2,1)'});
        });
      };
      const snapshot=els=>els.map(el=>({el,rect:el.getBoundingClientRect()}));
      // Grid cells are measured once at activation (document coordinates), so the drop target does not move while rows shift.
      const updateSlot=()=>{
        if(!drag?.active||!drag.cells)return;
        const cells=drag.cells,n=cells.length,py=drag.y+window.scrollY,px=drag.x;
        let k=0,best=Infinity;
        cells.forEach((c,i)=>{const d=(c.x-px)**2*0.25+(c.y-py)**2;if(d<best){best=d;k=i;}});
        // Position among the other rows (the dragged row is excluded): before/after cell k, shifted by where the dragged row started.
        const fromOrd=cells.findIndex(c=>c.el===drag.row);
        const isBefore=py<cells[k].y;
        let p=isBefore?(k>fromOrd?k-1:k):(k>fromOrd?k:k+1);
        const others=otherRows();
        const ph=drag.ph;
        if(!others.length){drag.slot=0;return;}
        p=Math.max(0,Math.min(others.length,p));
        const alreadyThere=p<others.length?others[p].previousElementSibling===ph:others[others.length-1].nextElementSibling===ph;
        if(!alreadyThere){
          const before=snapshot(others);
          if(p<others.length)others[p].before(ph);else others[others.length-1].after(ph);
          animateMoves(before);
        }
        drag.slot=p<others.length?Number(others[p].dataset.reorderIndex):Number(others[others.length-1].dataset.reorderIndex)+1;
      };
      const tick=()=>{
        frame=0;
        if(!drag?.active||!live())return;
        const h=window.innerHeight,edge=80;
        let step=0;
        if(drag.y<edge)step=-Math.ceil((edge-drag.y)/5);
        else if(drag.y>h-edge)step=Math.ceil((drag.y-(h-edge))/5);
        if(step){window.scrollBy(0,step);updateSlot();}
        drag.row.style.transform=`translate(${drag.x-drag.x0}px,${drag.y-drag.y1}px)`;
        frame=requestAnimationFrame(tick);
      };
      const activate=()=>{
        if(!drag||drag.active)return;
        const row=drag.row,r=row.getBoundingClientRect();
        const ph=document.createElement('div');
        ph.className='travel-drag-slot';
        ph.style.height=r.height+'px';
        drag.cells=rowEls().map(el=>{const c=el.getBoundingClientRect();return {el,x:c.left+c.width/2,y:c.top+c.height/2+window.scrollY};});
        row.before(ph);
        container.appendChild(row);
        Object.assign(row.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:'0',zIndex:'50',pointerEvents:'none',transform:'translate(0,0)'});
        row.classList.add('is-dragging');
        container.classList.add('is-reordering');
        drag.active=true;drag.ph=ph;drag.x0=drag.x;drag.y1=drag.y;
        try{navigator.vibrate?.(12);}catch{}
        updateSlot();
        frame=requestAnimationFrame(tick);
      };
      const cancelPending=()=>{if(drag?.timer)clearTimeout(drag.timer);drag=null;};
      const finish=commit=>{
        if(!drag)return;
        const d=drag;drag=null;
        if(frame){cancelAnimationFrame(frame);frame=0;}
        if(d.timer)clearTimeout(d.timer);
        if(!d.active)return;
        suppressUntil=Date.now()+400;
        const {row,ph,from,slot}=d;
        const commitNow=commit&&slot!==null&&slot!==from&&slot!==from+1&&live();
        container.classList.remove('is-reordering');
        if(commitNow){
          row.remove();ph.remove();
          onMove(from,slot);
          return;
        }
        const before=snapshot([...rowEls().filter(el=>el!==row),row]);
        const rowRect=row.getBoundingClientRect();
        row.classList.remove('is-dragging');
        Object.assign(row.style,{position:'',left:'',top:'',width:'',height:'',margin:'',zIndex:'',pointerEvents:'',transform:''});
        ph.replaceWith(row);
        const now=row.getBoundingClientRect(),dx=rowRect.left-now.left,dy=rowRect.top-now.top;
        if((dx||dy)&&row.animate)row.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:200,easing:'cubic-bezier(.2,.7,.2,1)'});
        animateMoves(before);
      };
      container.addEventListener('pointerdown',e=>{
        if(!live()||e.button>0)return;
        if(e.target.closest('input,button,select,textarea,a')&&!e.target.closest('.travel-drag-handle'))return;
        const row=e.target.closest('[data-reorder-index]');
        if(!row||!container.contains(row))return;
        finish(false);cancelPending();
        drag={row,pid:e.pointerId,type:e.pointerType,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,y1:e.clientY,active:false,from:Number(row.dataset.reorderIndex),slot:null,ph:null,timer:null};
        if(e.pointerType!=='mouse')drag.timer=setTimeout(activate,350);
      },sig);
      document.addEventListener('pointermove',e=>{
        if(!drag||e.pointerId!==drag.pid||!live())return;
        drag.x=e.clientX;drag.y=e.clientY;
        if(!drag.active){
          const dist=Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0);
          if(drag.type==='mouse'&&dist>4)activate();
          else if(drag.type!=='mouse'&&dist>8){cancelPending();return;}
          else return;
        }
        updateSlot();
        if(!frame)frame=requestAnimationFrame(tick);
      },sig);
      document.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.pid)finish(true);},sig);
      document.addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.pid)finish(false);},sig);
      document.addEventListener('touchmove',e=>{if(drag?.active&&e.cancelable)e.preventDefault();},{passive:false,signal:ac.signal});
      document.addEventListener('contextmenu',e=>{if(drag?.active)e.preventDefault();},sig);
      document.addEventListener('click',e=>{if(Date.now()<suppressUntil&&container.contains(e.target)){e.preventDefault();e.stopPropagation();}},{capture:true,signal:ac.signal});
    }
    function appendTravelLists(host,trip,day){const block=document.createElement('div');block.className='travel-list-stack';block.innerHTML=`<div class="travel-lists-grid">${travelChecklistMarkup(trip)}${shoppingPanelMarkup('trip','',trip,'旅程購買清單')}</div>${shoppingPanelMarkup('day',day.date,day,u('每日購買清單')+' · '+travelDateLabel(day.date))}`;// Replace only the list block when reordering; rebuilding the entire travel page
      // would discard scroll position and cause the page to jump to the top.
      const previous=host.querySelector('.travel-list-stack');
      if(previous)previous.replaceWith(block);else host.appendChild(block);
      block.querySelectorAll('[data-trip-check]').forEach(input=>input.onchange=()=>{trip.checklist[+input.dataset.tripCheck].done=input.checked;trip.updatedAt=new Date().toISOString();save();renderTravel();});
      block.querySelector('[data-trip-check-add]').onclick=()=>editTripChecklistItem(trip);
      block.querySelectorAll('[data-trip-check-edit]').forEach(button=>button.onclick=()=>editTripChecklistItem(trip,+button.dataset.tripCheckEdit));
      const moveChecklistItem=(from,slot)=>{const list=trip.checklist;if(!Array.isArray(list)||!list[from])return;const [item]=list.splice(from,1);list.splice(from<slot?slot-1:slot,0,item);trip.updatedAt=new Date().toISOString();save();appendTravelLists(host,trip,day);};
      // Two columns fill top to bottom: row count follows the visible item count (up to 200 items = 100 rows).
      block.querySelectorAll('.travel-checklist-items').forEach(el=>{const n=el.querySelectorAll('[data-reorder-index]').length;el.style.setProperty('--rows',String(Math.max(1,Math.ceil(n/2))));});
      attachReorder(block.querySelector('.travel-checklist-items'),moveChecklistItem);
      // Trip and daily shopping lists share one path: the owner is the trip itself or that day.
      block.querySelectorAll('.travel-shopping-trip-items').forEach(el=>{const owner=el.dataset.reorderKey==='shop-trip'?trip:day;attachReorder(el,(from,slot)=>{const list=shoppingItems(owner);if(!list[from])return;const [item]=list.splice(from,1);list.splice(from<slot?slot-1:slot,0,item);trip.updatedAt=new Date().toISOString();save();appendTravelLists(host,trip,day);});});
      block.querySelectorAll('[data-trip-check-delete]').forEach(button=>button.onclick=async()=>{const index=+button.dataset.tripCheckDelete,item=trip.checklist[index];if(!item)return;const removed=await window.IAN_OS_DELETE.run({name:item.text,action:async()=>{}});if(!removed)return;if(trip.checklist[index]!==item)return;trip.checklist.splice(index,1);trip.updatedAt=new Date().toISOString();save();renderTravel();});
      block.querySelectorAll('[data-shopping-add]').forEach(button=>button.onclick=()=>editShoppingItem(trip,button.dataset.shoppingScope,button.dataset.shoppingDate));
      block.querySelectorAll('[data-shopping-edit]').forEach(button=>button.onclick=()=>editShoppingItem(trip,button.dataset.shoppingScope,button.dataset.shoppingDate,button.dataset.shoppingEdit));
      block.querySelectorAll('[data-shopping-toggle]').forEach(input=>input.onchange=()=>{const owner=shoppingOwner(trip,input.dataset.shoppingScope,input.dataset.shoppingDate),item=shoppingItems(owner).find(value=>value.id===input.dataset.shoppingToggle);if(!item)return;item.done=input.checked;trip.updatedAt=new Date().toISOString();save();renderTravel();});
      block.querySelectorAll('[data-shopping-delete]').forEach(button=>button.onclick=async()=>{const owner=shoppingOwner(trip,button.dataset.shoppingScope,button.dataset.shoppingDate),item=shoppingItems(owner).find(value=>value.id===button.dataset.shoppingDelete);if(!item)return;const removed=await window.IAN_OS_DELETE.run({name:item.text,action:async()=>{}});if(!removed)return;owner.shoppingList=owner.shoppingList.filter(value=>value.id!==item.id);trip.updatedAt=new Date().toISOString();save();renderTravel();});
    }
    function editTripChecklistItem(trip,index=-1){const existing=index>=0?trip.checklist?.[index]:null;if(index>=0&&!existing)return;if(!existing&&checks(trip.checklist).filter(item=>item.text.trim()).length>=200){toast(u('勾選清單最多 200 項'));return;}modal(existing?u('編輯項目'):u('新增項目'),`<label><span>${u('項目名稱')}</span><input name="text" maxlength="300" value="${esc(existing?.text||'')}" required></label>`,form=>{const text=String(form.get('text')||'').trim();if(!text){toast(u('請填寫項目名稱'));return false;}if(existing){if(trip.checklist[index]!==existing)return false;existing.text=text;}else{if(trip.checklist.length>=200){toast(u('勾選清單最多 200 項'));return false;}trip.checklist.push({text,done:false});}trip.updatedAt=new Date().toISOString();save();renderTravel();});}
    function editShoppingItem(trip,scope,date,id=''){const owner=shoppingOwner(trip,scope,date),existing=shoppingItems(owner||{}).find(item=>item.id===id),title=existing?u('編輯購買項目'):u('新增購買項目');modal(title,`<label><span>${u('項目名稱')}</span><input name="text" maxlength="300" value="${esc(existing?.text||'')}" required></label><label class="check-label"><input name="done" type="checkbox" ${existing?.done?'checked':''}><span>${u('已購買')}</span></label>`,form=>{const text=String(form.get('text')||'').trim();if(!text){toast(u('請填寫項目名稱'));return false;}const target=shoppingOwner(trip,scope,date,true),list=shoppingItems(target);if(existing){const item=list.find(value=>value.id===existing.id);if(item){item.text=text;item.done=form.has('done');}}else{if(list.filter(item=>item.text.trim()).length>=200){toast(u('購買清單最多 200 項'));return false;}list.push({id:window.IAN_OS_CLOUD.uuid(),text,done:form.has('done')});}trip.updatedAt=new Date().toISOString();save();renderTravel();});}
    function deleteTrip(trip){const segments=(trip.days||[]).reduce((n,day)=>n+(day.drivingSegments||[]).length,0),stops=(trip.days||[]).reduce((n,day)=>n+(day.routeStops||[]).length,0),flightsCount=(trip.flights||[]).length;const en=window.IAN_OS_UI?.lang()==='en';const message=en?`This also deletes ${trip.days.length} itinerary day${trip.days.length===1?'':'s'}, ${flightsCount} flight leg${flightsCount===1?'':'s'}, ${segments} driving segment${segments===1?'':'s'}, ${stops} route stop${stops===1?'':'s'}, and the preparation checklist. This action cannot be undone.`:`此操作會一併刪除 ${trip.days.length} 天行程、${flightsCount} 筆航段、${segments} 段開車路程、${stops} 個中途停靠點及出發準備清單，且無法復原。`;removePreference({name:trip.title,message,mutate:next=>{next.settings.preferences.trips=(next.settings.preferences.trips||[]).filter(value=>value.id!==trip.id);},success:en?'Trip deleted':'已刪除旅程',after:()=>{tripId=null;activeDay='';}});}
    function editTrip(trip){const input=(key,label,type='text',value='')=>`<label><span>${label}</span><input name="${key}" type="${type}" ${type==='number'?'min="0" step="0.01"':''} value="${esc(trip?.[key]??value)}" ${['title','start','end'].includes(key)?'required':''}></label>`;modal(trip?'編輯旅程':'建立旅程',`${input('title','旅程名稱')}<label><span>旅遊類型</span><select name="travelType"><option value="domestic" ${trip?.travelType==='domestic'?'selected':''}>國內旅遊</option><option value="international" ${trip?.travelType==='international'?'selected':''}>出國旅遊</option><option value="unspecified" ${!trip?.travelType||trip.travelType==='unspecified'?'selected':''}>尚未設定</option></select></label><label><span>${u('交通方式')}</span><select name="transportMode"><option value="flight" ${(trip?.transportMode||'flight')==='flight'?'selected':''}>✈ ${u('飛機')}</option><option value="road_trip" ${trip?.transportMode==='road_trip'?'selected':''}>🚗 ${u('自駕旅程')}</option></select></label>${input('destination','目的地')}<div class="field-grid two">${input('start','出發日期','date',dayKey(new Date()))}${input('end','返回日期','date',dayKey(new Date()))}${input('budget','預算','number','0')}<label><span>幣別</span><select name="currency">${['USD','TWD','JPY','EUR'].map(x=>`<option ${x===(trip?.currency||'USD')?'selected':''}>${x}</option>`).join('')}</select></label></div><label><span>旅程備註</span><textarea name="notes">${esc(trip?.notes||'')}</textarea></label>${trip?'':`<details class="capture-checklist"><summary>☑ 出發準備清單（最多 200 項，建立後可在清單中新增）</summary>${Array.from({length:50},(_,i)=>`<div class="day-slot" style="grid-template-columns:20px minmax(0,1fr)"><input type="checkbox" name="prep-${i}-done" aria-label="準備項目 ${i+1} 已完成" ${trip?.checklist?.[i]?.done?'checked':''}><input name="prep-${i}-text" aria-label="準備項目 ${i+1}" maxlength="300" placeholder="準備項目 ${i+1}" value="${esc(trip?.checklist?.[i]?.text||'')}"></div>`).join('')}</details>`}`,form=>{const data=Object.fromEntries(['title','destination','start','end','budget','currency','notes','travelType','transportMode'].map(k=>[k,form.get(k)]));data.checklist=trip?(trip.checklist||[]):Array.from({length:50},(_,i)=>({text:String(form.get(`prep-${i}-text`)||'').trim(),done:form.has(`prep-${i}-done`)})).filter(x=>x.text);data.title=data.title.trim();const range=dates(data.start,data.end);if(!data.title||!range.length||+data.budget<0){toast(u('請填寫旅程名稱、有效日期（最多 60 天）及非負預算。'));return false;}const reconciled=reconcileTripDays(trip,data.start,data.end);if(!reconciled){toast(u('請填寫旅程名稱、有效日期（最多 60 天）及非負預算。'));return false;}const value={...trip,...data,budget:+data.budget,id:trip?.id||crypto.randomUUID(),days:reconciled.days,updatedAt:new Date().toISOString()};if(trip)Object.assign(trip,value);else trips().push(value);tripId=value.id;activeDay=value.start;save();renderTravel();if(reconciled.preservedDates.length)toast(u('旅程日期已更新；區間外的航班或行程仍保留在「保留日期」中。'));});}
    function removePreservedDate(trip,date){
      const day=trip.days.find(value=>value.date===date);if(!day)return;const sameDays=trip.days.filter(value=>value.date===date);
      const itinerary=sameDays.reduce((count,value)=>count+itineraryCount(value),0);
      const en=window.IAN_OS_UI?.lang()==='en';
      if(!itinerary){toast(u(en?'There are no daily itinerary fields available to remove. Flights, driving segments, route stops, attachments, and other date data were kept.':'此日期沒有可移除的每日行程欄位；航班、自駕路段、停靠點、附件及其他日期資料均已保留。'));return;}
      const items=[];
      sameDays.forEach(value=>{periods.forEach(([key,,label])=>(value.periods?.[key]||[]).forEach(item=>{if(hasItineraryData(item)){const detail=[item.time,String(item.text||'').trim()||'未填寫項目',item.done?'已完成':''].filter(Boolean).join(' · ');items.push(label+': '+detail);}}));[['breakfast','早餐'],['lunch','午餐'],['dinner','晚餐'],['lateMeal','宵夜或其他'],['restaurants','既有餐廳資料'],['transport','交通工具'],['lodging','住宿'],['notes','備註']].forEach(([key,label])=>{if(String(value[key]||'').trim())items.push(label+': '+value[key]);});if(Number(value.cost))items.push('當日花費: '+value.cost+' '+(trip.currency||''));});
      const message=en?'This removes only the daily itinerary content listed below from '+date+'. Flights, driving segments, route stops, attachments, and other travel records will be kept.\n\n'+items.join(' · '):'這會只移除 '+date+' 下列每日行程內容。航班、自駕路段、中途停靠點、附件及其他旅遊資料都會保留。\n\n'+items.join(' · ');
      removePreference({name:en?'Preserved date '+date:'保留日期 '+date,message,mutate:next=>{
        const savedTrip=(next.settings.preferences.trips||[]).find(value=>value.id===trip.id);if(!savedTrip)return;
        const removed=clearDateItinerary(savedTrip,date);if(!removed.matching)return;
        savedTrip.updatedAt=new Date().toISOString();
      },success:en?'Daily itinerary removed; related travel records were kept.':'已移除確認的每日行程，其他旅遊資料已保留。',after:()=>{activeDay=trip.start;}});
    }
    function editDay(trip,day){
      day.periods ||= Object.fromEntries(periods.map(([key])=>[key,Array.from({length:5},()=>({time:'',text:'',done:false}))]));
      const part=displayPeriods.map(([icon,label,keys])=>`<fieldset class="day-period"><legend>${icon} ${u(label)}</legend>${keys.flatMap(key=>(day.periods[key]||[]).map((x,i)=>`<div class="day-slot itinerary-slot"><div class="itinerary-slot-meta"><input name="${key}-${i}-done" type="checkbox" aria-label="${label}第 ${i+1} 項完成" ${x.done?'checked':''}><input name="${key}-${i}-time" type="time" value="${esc(x.time)}" aria-label="${label}第 ${i+1} 項時間"></div><input name="${key}-${i}-text" value="${esc(x.text)}" maxlength="300" aria-label="${label}第 ${i+1} 項" placeholder="行程項目 ${i+1}"></div>`)).join('')}</fieldset>`).join('');
      const field=(key,label)=>`<label><span>${label}</span><input name="${key}" value="${esc(day[key]||'')}"></label>`;
      modal(`${u('每日規劃')} · ${travelDateLabel(day.date)}`,`<label class="travel-day-highlight"><span>${u('今日主要行程')}</span><input name="highlight" maxlength="300" value="${esc(day.highlight||'')}" placeholder="${u('例如：與朋友見面、重要預約')}"></label><div class="day-period-grid travel-day-period-grid">${part}</div><div class="travel-day-meals">${field('breakfast',u('早餐'))}${field('lunch',u('午餐'))}${field('dinner',u('晚餐'))}${field('lateMeal',u('宵夜或其他'))}${String(day.restaurants||'').trim()?field('restaurants',u('既有餐廳資料')):''}</div><div class="field-grid two travel-day-fields"><label><span>＄當日花費 · ${esc(trip.currency)}</span><input name="cost" type="number" min="0" step="0.01" value="${day.cost||0}" required></label>${field('transport','↗ 交通工具')}${field('lodging','⌂ 住宿')}</div><label class="travel-day-notes"><span>備註／預訂資訊</span><textarea name="notes">${esc(day.notes||'')}</textarea></label>`,form=>{
        for(const [key] of periods)day.periods[key]=Array.from({length:5},(_,i)=>({time:form.get(`${key}-${i}-time`)||'',text:String(form.get(`${key}-${i}-text`)||'').trim(),done:form.has(`${key}-${i}-done`)}));
        day.highlight=String(form.get('highlight')||'').trim().slice(0,300);
        for(const key of ['breakfast','lunch','dinner','lateMeal','transport','lodging','notes',...(form.has('restaurants')?['restaurants']:[])])day[key]=String(form.get(key)||'').trim();day.cost=Number(form.get('cost')||0);
        const normal=dates(trip.start,trip.end).includes(day.date),hasContent=preservedDayContent(day)>0,hasFlight=(trip.flights||[]).some(leg=>flightDate(trip,leg)===day.date);
        if(normal||hasContent||hasFlight){const index=trip.days.indexOf(day);if(index>=0)trip.days[index]=day;else if(!trip.days.some(value=>value.date===day.date))trip.days.push(day);}else trip.days=trip.days.filter(value=>value.date!==day.date);
        trip.updatedAt=new Date().toISOString();save();renderTravel();
      },true);
    }
    function openTrip(id,date){const trip=trips().find(value=>value.id===id);if(!trip)return false;tripId=trip.id;const entries=travelDayEntries(trip);activeDay=entries.some(day=>day.date===date)?date:(trip.start||entries[0]?.date||'');renderTravel();return true;}
    // Only preserve scroll when updating the already-visible travel screen.
    // Opening a trip / returning to trip list is genuine navigation.
    function renderTravel(){
      const app=document.getElementById('app');
      const sameScreen=!!(tripId?app.querySelector('.travel-trip-hero'):app.querySelector('.travel-operational'));
      return window.IAN_OS_SCROLL ? window.IAN_OS_SCROLL.keep(()=>renderTravelContent(),sameScreen) : renderTravelContent();
    }
    function renderTravelContent(){const app=document.getElementById('app'),previousDayScroll=app.querySelector('.travel-day-tabs')?.scrollLeft||0,legacy=state().events.filter(e=>['旅遊','Travel'].includes(e.category)),trip=trips().find(x=>x.id===tripId);if(!trip){app.innerHTML=`<section class="page-head travel-operational"><div><div class="eyebrow">LIFE · TRAVEL STUDIO</div><h1 class="page-title">✈ 旅遊規劃</h1><p class="page-subtitle">一趟旅程，多天安排。把時間、交通、餐廳與住宿放在一起。</p></div><button class="primary-btn" id="newTrip">＋ 建立旅程</button></section><div class="project-grid">${trips().map(t=>`<article class="project-card travel-card ${t.completedAt?'is-completed':''}" data-trip="${esc(t.id)}"><span class="type-pill">${t.transportMode==='road_trip'?'🚗':'✈'} ${t.transportMode==='road_trip'?u('自駕旅程'):t.travelType==='domestic'?'國內':t.travelType==='international'?'出國':'旅程'} · ${dates(t.start,t.end).length} 天</span>${t.completedAt?`<span class="travel-complete-badge">${u('已完成')}</span>`:''}<h2>${esc(t.title)}</h2><p>${esc(t.destination)}</p><p>${esc(travelDateLabel(t.start))} → ${esc(travelDateLabel(t.end))}</p><span class="project-open"><span>開啟每日規劃 →</span><button type="button" class="secondary-btn compact travel-complete-toggle" data-complete-trip="${esc(t.id)}" aria-label="${u(t.completedAt?'重新開啟旅遊':'完成旅遊')}：${esc(t.title)}">${u(t.completedAt?'重新開啟旅遊':'完成旅遊')}</button><button type="button" class="secondary-btn compact card-list-delete" data-delete-trip-list="${esc(t.id)}">${u('刪除')}</button></span></article>`).join('')||`<section class="panel">${globalThis.IAN_OS_EMPTY_GUIDE({title:'還沒有旅程',hint:'建立第一趟旅程，把時間、交通、餐廳與住宿放在一起。',target:'#newTrip'})}</section>`}</div>`;if(legacy.length){app.innerHTML+=`<section class="panel section"><h2>既有旅遊行程</h2><p>${u('原有行事曆資料仍保留；新旅程使用上方每日規劃。')}</p>${legacy.map(e=>`<div class="checklist-view"><div><strong>${esc(e.title)}</strong><p>${esc(e.start)} · ${window.IAN_OS_EDITOR.renderInline(e.notes||'')}</p></div></div>`).join('')}</section>`;}window.IAN_OS_PDF.mount(app.querySelector('.page-head'),'travel',()=>trips(),true);app.querySelector('#newTrip').onclick=()=>editTrip();app.querySelectorAll('[data-trip]').forEach(b=>{b.tabIndex=0;b.setAttribute('role','button');b.onclick=e=>{if(e.target.closest('[data-delete-trip-list],[data-complete-trip]'))return;tripId=b.dataset.trip;activeDay='';renderTravel();};b.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();tripId=b.dataset.trip;activeDay='';renderTravel();}};});app.querySelectorAll('[data-complete-trip]').forEach(button=>button.onclick=e=>{e.stopPropagation();const value=trips().find(item=>item.id===button.dataset.completeTrip);if(!value)return;setTripCompletion(value,!value.completedAt);save();renderTravel();app.querySelector(`[data-complete-trip=\"${CSS.escape(value.id)}\"]`)?.focus({preventScroll:true});});app.querySelectorAll('[data-delete-trip-list]').forEach(button=>button.onclick=e=>{e.stopPropagation();const value=trips().find(item=>item.id===button.dataset.deleteTripList);if(!value)return;removePreference({name:value.title,message:window.IAN_OS_UI?.lang()==='en'?`This also deletes ${value.days.length} itinerary day${value.days.length===1?'':'s'}, ${(value.flights||[]).length} flight leg${(value.flights||[]).length===1?'':'s'}, ${(value.days||[]).reduce((n,day)=>n+(day.drivingSegments||[]).length,0)} driving segment(s), ${(value.days||[]).reduce((n,day)=>n+(day.routeStops||[]).length,0)} route stop(s), and the preparation checklist. This action cannot be undone.`:`此操作會一併刪除 ${value.days.length} 天行程、${(value.flights||[]).length} 筆航段、${(value.days||[]).reduce((n,day)=>n+(day.drivingSegments||[]).length,0)} 段開車路程、${(value.days||[]).reduce((n,day)=>n+(day.routeStops||[]).length,0)} 個中途停靠點與出發準備清單，且無法復原。`,mutate:next=>{next.settings.preferences.trips=(next.settings.preferences.trips||[]).filter(item=>item.id!==value.id);},success:window.IAN_OS_UI?.lang()==='en'?'Trip deleted':'已刪除旅程'});});return;}
      const dayEntries=travelDayEntries(trip);if(!dayEntries.some(item=>item.date===activeDay))activeDay=trip.start;const entry=dayEntries.find(item=>item.date===activeDay)||dayEntries[0];const day=entry.day;activeDay=day.date;const normalCount=dates(trip.start,trip.end).length;const preservedEntries=dayEntries.filter(item=>!item.normal);const normalTabs=dayEntries.filter(item=>item.normal).map(item=>`<button class="filter-chip ${item.date===activeDay?'active':''}" data-day="${item.date}" ${item.date===activeDay?'aria-current="date"':''}>Day ${item.index+1} · ${esc(travelDateLabel(item.date,true))}</button>`).join('');const preservedTabs=preservedEntries.length?'<span class="preserved-date-divider" aria-hidden="true"></span>'+preservedEntries.map(item=>`<span class="preserved-date-tab ${item.date===activeDay?'active':''}"><button class="filter-chip preserved-date-button ${item.date===activeDay?'active':''}" data-day="${item.date}" ${item.date===activeDay?'aria-current="date"':''} title="${u('保留日期')}">${u('保留日期')} · ${esc(travelDateLabel(item.date,true))} · ${relatedCount(trip,item.day)}</button><button type="button" class="text-btn preserved-date-remove" data-remove-preserved="${item.date}" aria-label="${u('移除保留日期')} ${item.date}">×</button></span>`).join('')+'<span class="preserved-date-add"><input type="date" data-preserved-date-input aria-label="新增保留日期"><button type="button" class="secondary-btn compact" data-add-preserved>＋ 日期</button></span>':'';const dayTabs=normalTabs+preservedTabs;const all=trip.days.flatMap(d=>Object.values(d.periods).flat()).filter(x=>x.text),done=all.filter(x=>x.done).length,total=trip.days.reduce((n,d)=>n+Number(d.cost||0),0);app.innerHTML=`<button class="secondary-btn travel-back" id="tripsBack">← 所有旅程</button><section class="project-hero travel-trip-hero"><div class="project-hero-copy"><div class="eyebrow">TRAVEL · ${trip.transportMode==='road_trip'?u('自駕旅程'):u('飛機')} · ${trip.travelType==='domestic'?'國內旅遊':trip.travelType==='international'?'出國旅遊':'旅程'} · ${normalCount} DAYS</div><h1>${esc(trip.title)}</h1><p>${esc(trip.destination)} · ${esc(travelDateLabel(trip.start))} → ${esc(travelDateLabel(trip.end))}</p><p class="rendered-content">${window.IAN_OS_EDITOR.renderInline(trip.notes||'')}</p></div><div class="travel-trip-actions"><button class="danger-btn secondary-danger compact" id="deleteTrip">${u('刪除')}</button><button class="secondary-btn" id="editTrip">${u('編輯旅程')}</button><button class="secondary-btn travel-complete-toggle" id="completeTrip" aria-pressed="${!!trip.completedAt}">${u(trip.completedAt?'重新開啟旅遊':'完成旅遊')}</button></div></section><div class="travel-metrics"><div class="panel">☑ 已完成<strong>${done} / ${all.length}</strong></div><div class="panel">＄累計花費<strong>${esc(trip.currency)} ${total.toLocaleString()}</strong></div><div class="panel">◈ 預算<strong>${esc(trip.currency)} ${Number(trip.budget).toLocaleString()}</strong></div></div><nav class="day-tabs travel-day-tabs" aria-label="旅程日期">${dayTabs}</nav>${trip.transportMode==='road_trip'?roadTrips.markup(trip,day):flights.markup(trip,day.date)}<section class="panel travel-day-panel"><div class="section-head"><h2>${esc(travelDateLabel(day.date))} ${u('每日行程')}</h2><button class="primary-btn" id="editDay">＋ 編輯每日規劃</button></div>${day.highlight?`<div class="travel-day-highlight-view"><strong>${u('今日主要行程')}</strong><p>${esc(day.highlight)}</p></div>`:''}<div class="day-period-grid travel-day-period-grid">${displayPeriods.map(([icon,label,keys])=>`<section class="period-preview"><h3>${icon} ${u(label)}</h3>${keys.flatMap(key=>(day.periods[key]||[]).map((x,i)=>x.text?`<label class="trip-task ${x.done?'checked':''}"><div class="trip-task-meta"><input type="checkbox" data-slot="${key}:${i}" ${x.done?'checked':''}><time>${esc(x.time||'未定時間')}</time></div><span class="trip-task-title">${esc(x.text)}</span></label>`:'')).join('')||`<p class="muted">${u('尚未安排')}</p>`}</section>`).join('')}</div><dl class="travel-details travel-day-details">${[['breakfast','早餐'],['lunch','午餐'],['dinner','晚餐'],['lateMeal','宵夜或其他'],...(String(day.restaurants||'').trim()?[['restaurants','既有餐廳資料']]:[]),['cost',`當日花費 · ${trip.currency}`],['transport','交通工具'],['lodging','住宿'],['notes','備註']].map(([key,label])=>`<div class="${key==='notes'?'travel-day-notes-view':''}"><dt>${esc(u(label))}</dt><dd class="rendered-content">${window.IAN_OS_EDITOR.render(day[key]||'—')}</dd></div>`).join('')}</dl></section>`;const dayScroller=app.querySelector('.travel-day-tabs'),selectedTab=dayScroller.querySelector('[aria-current="date"]');dayScroller.scrollLeft=previousDayScroll;if(selectedTab){const left=selectedTab.getBoundingClientRect().left-dayScroller.getBoundingClientRect().left+dayScroller.scrollLeft,right=left+selectedTab.offsetWidth;if(left<dayScroller.scrollLeft)dayScroller.scrollLeft=left;else if(right>dayScroller.scrollLeft+dayScroller.clientWidth)dayScroller.scrollLeft=right-dayScroller.clientWidth;}window.IAN_OS_PDF.mount(app.querySelector('.travel-trip-actions'),'travel',()=>[trip]);appendTravelLists(app,trip,day);if(trip.transportMode==='road_trip')roadTrips.bind(app,trip,day);else flights.bind(app,trip,day.date);app.querySelector('#tripsBack').onclick=()=>{tripId=null;renderTravel();};app.querySelector('#editTrip').onclick=()=>editTrip(trip);app.querySelector('#completeTrip').onclick=()=>{setTripCompletion(trip,!trip.completedAt);save();renderTravel();app.querySelector('#completeTrip')?.focus({preventScroll:true});};app.querySelector('#deleteTrip').onclick=()=>deleteTrip(trip);app.querySelector('#editDay').onclick=()=>editDay(trip,day);app.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{activeDay=b.dataset.day;renderTravel();});app.querySelectorAll('[data-remove-preserved]').forEach(button=>button.onclick=()=>removePreservedDate(trip,button.dataset.removePreserved));const addPreserved=app.querySelector('[data-add-preserved]');if(addPreserved)addPreserved.onclick=()=>{const date=app.querySelector('[data-preserved-date-input]').value;if(!date){toast(u('請先選擇日期。'));return;}const range=dates(trip.start,trip.end);if(range.includes(date)){activeDay=date;renderTravel();return;}const existing=trip.days.find(value=>value.date===date);if(travelDayEntries(trip).some(item=>item.date===date)){activeDay=date;renderTravel();return;}editDay(trip,existing||blankDay(date));};app.querySelectorAll('[data-slot]').forEach(b=>b.onchange=()=>{const [key,i]=b.dataset.slot.split(':');day.periods[key][+i].done=b.checked;save();renderTravel();});
    }
    function renderRoutines(){window.IAN_OS_ROUTINES.render({state,save,toast,escape:esc,modal,removePreference});}
    const rules=[{id:'morning',icon:'☀',title:'每日早報',time:'08:00',detail:'整理今日到期、逾期與待回覆訊息。',message:'今日到期 {today_due} 件，逾期 {overdue} 件，待追蹤訊息 {followups} 筆。'},{id:'followup',icon:'✉',title:'午後追蹤提醒',time:'13:00',detail:'列出尚未完成的待回覆訊息。',message:'{followups} 筆訊息需要追蹤。'},{id:'review',icon:'☾',title:'收工檢查',time:'17:30',detail:'確認尚未完成的待辦，安排明日工作。',message:'尚有 {open_tasks} 件未完成待辦，請檢查明天的安排。'}];
    const ruleById=id=>rules.find(r=>r.id===id);
    const effectiveRule=r=>{
      const saved=state().settings.preferences?.dailyAutomation?.config?.[r.id]||{};
      return {...r,title:typeof saved.title==='string'&&saved.title.trim()?saved.title:r.title,time:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(saved.time||'')?saved.time:r.time,message:typeof saved.message==='string'&&saved.message.trim()?saved.message:r.message,detail:typeof saved.message==='string'&&saved.message.trim()?saved.message:r.detail};
    };
    function runRule(id){
      const base=ruleById(id);if(!base)throw new Error('無效的摘要規則。');
      const s=state(),open=s.tasks.filter(x=>!['done','cancelled'].includes(x.status)),messages=s.communications.filter(x=>['follow-up','waiting'].includes(x.status)),today=dayKey(new Date()),en=window.IAN_OS_UI?.lang()==='en';
      const due=open.filter(x=>x.dueDate===today).length,overdue=open.filter(x=>x.dueDate&&x.dueDate<today).length;
      const custom=s.settings.preferences?.dailyAutomation?.config?.[id]?.message;
      if(typeof custom==='string'&&custom.trim()){
        const values={today_due:due,overdue,followups:messages.length,open_tasks:open.length};
        return custom.replace(/\{(today_due|overdue|followups|open_tasks)\}/g,(_,key)=>String(values[key]));
      }
      if(id==='followup')return en?`${messages.length} messages need follow-up.`:`${messages.length} 筆訊息需要追蹤。`;
      if(id==='review')return en?`${open.length} open tasks remain. Review tomorrow’s plan.`:`尚有 ${open.length} 件未完成待辦，請檢查明天的安排。`;
      return en?`${due} due today, ${overdue} overdue, ${messages.length} messages to follow up.`:`今日到期 ${due} 件，逾期 ${overdue} 件，待追蹤訊息 ${messages.length} 筆。`;
    }
    function runDaily(){
      const auto=prefs().dailyAutomation;if(!auto)return;
      const today=dayKey(new Date()),now=new Date(),minutes=now.getHours()*60+now.getMinutes();
      for(const base of rules){
        const r=effectiveRule(base),[h,m]=r.time.split(':').map(Number);
        if(auto[r.id]&&minutes>=h*60+m&&auto.last?.[r.id]!==today){
          auto.last ||= {};auto.last[r.id]=today;auto.history ||= [];
          const result=runRule(r.id);auto.history.unshift({id:r.id,date:now.toISOString(),result});auto.history=auto.history.slice(0,30);
          save();toast(`${u(r.title)}：${result}`);
        }
      }
    }
    // Owner-scoped settings use the existing synced user_settings.preferences.dailyAutomation object.
    // Only the page-open local routine is edited here; PostgreSQL Phase 1/2 Cron remains untouched.
    const summaryRules={
      list:()=>{const auto=state().settings.preferences?.dailyAutomation||{};return rules.map(base=>{const r=effectiveRule(base);return {...r,enabled:!!auto[r.id],last:(auto.history||[]).find(x=>x.id===r.id)||null};});},
      setEnabled:(id,enabled)=>{
        if(!ruleById(id)||typeof enabled!=='boolean')throw new Error('無效的摘要規則。');
        const auto=prefs().dailyAutomation ||= {};
        if(!!auto[id]===enabled)return false;
        auto[id]=enabled;save();return true;
      },
      setConfig:(id,data)=>{
        const base=ruleById(id);if(!base)throw new Error('無效的摘要規則。');
        const title=String(data.title||'').trim(),time=String(data.time||''),message=String(data.message||'').trim();
        if(!title||title.length>120)throw new Error('名稱需為 1–120 字。');
        if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('請輸入有效的 24 小時制時間。');
        if(!message||message.length>1000)throw new Error('提醒內容需為 1–1000 字。');
        const auto=prefs().dailyAutomation ||= {};
        auto.config ||= {};
        auto.config[id]={title,time,message};
        if(typeof data.enabled==='boolean')auto[id]=data.enabled;
        save();return true;
      },
      test:id=>{if(!ruleById(id))throw new Error('無效的摘要規則。');return runRule(id);},
      history:id=>{if(!ruleById(id))throw new Error('無效的摘要規則。');return (state().settings.preferences?.dailyAutomation?.history||[]).filter(x=>x.id===id).map(x=>({...x}));},
      concepts:()=>state().workflows||[]
    };
    function renderAutomations(){const app=document.getElementById('app'),auto=prefs().dailyAutomation ||= {};app.innerHTML=`<section class="page-head automations-operational"><div><div class="eyebrow">DAILY ROUTINES</div><h1 class="page-title">◷ 每日自動化</h1><p class="page-subtitle">依裝置當地時間執行。頁面需保持開啟；若稍晚開啟，當天會補跑一次。</p></div></section><div class="automation-grid">${summaryRules.list().map(r=>`<article class="panel operational-rule" data-rule-state="${auto[r.id]?'enabled':'paused'}"><div class="section-head"><h2>${r.icon} ${u(r.title)}</h2><label class="check-label"><input type="checkbox" data-rule="${r.id}" ${auto[r.id]?'checked':''}>啟用</label></div><div class="rule-flow"><div class="rule-trigger"><span>${u('觸發')} · ${u('每日')} ${r.time}</span></div><div class="rule-action"><span>執行動作</span><p>${u(r.detail)}</p></div></div><div class="rule-foot"><span class="rule-state">${auto[r.id]?'已啟用':'已暫停'}</span><span class="rule-last">${(auto.history||[]).find(x=>x.id===r.id)?u('最近執行')+' · '+esc(new Date((auto.history||[]).find(x=>x.id===r.id).date).toLocaleString()):'尚無執行紀錄'}</span></div><button class="secondary-btn" data-test-rule="${r.id}">▷ 立即測試</button><p class="routine-result" id="result-${r.id}" role="status"></p></article>`).join('')}</div><section class="panel section"><h2>${u('執行紀錄')}</h2>${(auto.history||[]).map(x=>`<p>${esc(new Date(x.date).toLocaleString())} · ${esc(x.result)}</p>`).join('')||`<p class="muted">${u('尚無自動執行紀錄；手動測試不會消耗每日執行次數。')}</p>`}</section><section class="panel section automation-roadmap"><h2>${u('後續可加入的固定項目')}</h2><ul><li>${u('每日雲端備份：需要伺服器排程與備份儲存空間。')}</li><li>${u('信用卡到期提醒：需要將各卡日期統一為可排程欄位。')}</li><li>${u('出發前旅遊提醒：可依出發日期整理未完成準備清單。')}</li><li>${u('Email 自動擷取與整理：需要另外串接信箱並授權。')}</li></ul></section>`;if(state().workflows?.length)app.innerHTML+=`<section class="panel section"><h2>${u('既有工作流程構想')}</h2><p class="muted">${u('以下為舊版保存的規劃，尚未接上背景執行服務。')}</p>${state().workflows.map(w=>`<details><summary>${esc(w.title)}</summary><p>${esc(w.description||'')}</p><ul>${(w.actions||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></details>`).join('')}</section>`;app.querySelectorAll('[data-rule]').forEach(b=>b.onchange=()=>{auto[b.dataset.rule]=b.checked;save();const card=b.closest('.operational-rule');if(card){card.dataset.ruleState=b.checked?'enabled':'paused';card.querySelector('.rule-state').textContent=b.checked?'已啟用':'已暫停';}});app.querySelectorAll('[data-test-rule]').forEach(b=>b.onclick=()=>{document.getElementById('result-'+b.dataset.testRule).textContent=runRule(b.dataset.testRule);});}
    return {editor,readChecklist:()=>checks(checklistDraft).filter(x=>x.text.trim()),appendChecklist,openTrip,renderTravel,renderRoutines,renderAutomations,summaryRules,runDaily,runRule,trips,dayKey};
  }
  window.IAN_OS_PLANNING={create,dates,blankDay,checks,travelDays,reconcileTripDays,preservedDayContent,clearDateItinerary,setTripCompletion};
})();
