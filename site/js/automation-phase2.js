/* OPEN OS Phase 2 — credit-card and travel source reminders.
   No local scheduling: the PostgreSQL Cron worker reads current saved preferences. */
(() => {
  'use strict';
  const kinds={credit_due:'信用卡繳款提醒',credit_closing:'信用卡結帳提醒',travel_departure:'旅遊出發提醒'};
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validId=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
  const asList=v=>Array.isArray(v)?v:[];
  const localDate=zone=>{
    const p=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=k=>p.find(x=>x.type===k)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  function mount({root,zone,creditCards,trips,modal,rpc}){
    const cards=asList(creditCards).filter(c=>validId(c.id));
    const journeys=asList(trips).filter(t=>validId(t.id));
    const group=document.createElement('section');
    group.className='automation-rule-group phase2-group';
    group.innerHTML=`<div class="phase2-header automation-zone-heading"><div class="automation-zone-icon" aria-hidden="true">✧</div><div class="phase2-header-copy"><span class="automation-kicker">SOURCE REMINDERS</span><h2>來源提醒</h2><p class="muted">信用卡與旅遊分區顯示，從現有資料建立規則，由伺服器排程產生通知。</p></div><button type="button" class="primary-btn" data-phase2-add disabled>＋ 新增來源提醒</button></div><p class="field-hint" role="status" data-phase2-status>載入中…</p><div class="phase2-categories"><section class="phase2-category phase2-category--credit"><div class="phase2-category-head"><div><span class="automation-kicker">FINANCE · CREDIT CARDS</span><h3>▣ 信用卡提醒</h3><p>繳款日與帳單結帳日，掌握重要財務日期。</p></div><span class="phase2-category-count" data-credit-count>0 項規則</span></div><div class="automation-grid phase2-rule-grid" data-phase2-credit></div></section><section class="phase2-category phase2-category--travel"><div class="phase2-category-head"><div><span class="automation-kicker">TRAVEL · DEPARTURES</span><h3>✈ 旅遊提醒</h3><p>出發倒數與旅程準備清單，避免遺漏行程。</p></div><span class="phase2-category-count" data-travel-count>0 項規則</span></div><div class="automation-grid phase2-rule-grid" data-phase2-travel></div></section></div>`;
    root.querySelector('[data-rules]').append(group);
    const panel=root.querySelector('[data-inbox]').closest('.panel');
    const sub=document.createElement('div');sub.className='phase2-inbox';
    sub.innerHTML=`<div class="phase2-inbox-heading"><h3>信用卡與旅遊通知</h3><p class="muted">依通知來源使用不同視覺標記。</p></div><div class="automation-notice-grid" data-phase2-notes></div><button class="secondary-btn" type="button" data-phase2-more hidden>載入較早通知</button>`;
    panel.append(sub);
    const status=group.querySelector('[data-phase2-status]'),host=group;
    const add=group.querySelector('[data-phase2-add]'),notesHost=sub.querySelector('[data-phase2-notes]'),more=sub.querySelector('[data-phase2-more]');
    let before=null,busy=false,ready=false;
    const sources=kind=>(kind==='travel_departure'?journeys:cards).map(x=>({id:x.id,name:x.title||x.name||'未命名'}));
    const getSource=(kind,id)=>(kind==='travel_departure'?journeys:cards).find(x=>x.id===id);
    const showDate=v=>v?new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(new Date(v)):'尚無';
    function edit(rule=null){
      const first=rule?.source_type||(cards.length?'credit_due':'travel_departure');
      const d=modal(rule?'編輯來源提醒':'新增來源提醒',`<form data-phase2-form><label><span>提醒類型</span><select name="source_type" required>${Object.entries(kinds).map(([key,label])=>`<option value="${key}" ${key===first?'selected':''}>${label}</option>`).join('')}</select></label><label><span>選擇信用卡／旅程</span><select name="source_id" required></select></label><div class="field-grid two"><label><span>提前幾天通知（0–60 天）</span><input type="number" name="days_before" min="0" max="60" step="1" required value="${rule?.days_before??(first==='travel_departure'?14:3)}"></label><label><span>通知時間</span><input type="time" name="local_time" required step="60" value="${safe(String(rule?.local_time||'09:00').slice(0,5))}"></label></div><label><span>時區（IANA）</span><input name="timezone" required maxlength="64" list="phase2-timezones" value="${safe(rule?.timezone||zone)}"><datalist id="phase2-timezones"><option value="America/Los_Angeles"><option value="Asia/Taipei"><option value="America/New_York"><option value="UTC"></datalist></label><label class="check-label"><input name="enabled" type="checkbox" ${rule?.enabled!==false?'checked':''}>啟用規則</label><p class="field-hint">信用卡使用每月結帳日／繳款日；若該月沒有 29–31 日，採月底。旅遊使用出發日期，並僅提醒尚未完成的準備清單。每日按所選時區檢查，提醒不會在網站關閉時停止。</p><p class="field-hint">儲存後才會啟用。相同來源、提醒類型與提前天數不能重複；可分別建立提前 7、3、1 天的規則。</p><p role="alert" data-phase2-error></p><div class="modal-actions"><button type="button" class="secondary-btn" data-close>取消</button><button type="submit" class="primary-btn">儲存</button></div></form>`);
      const form=d.overlay.querySelector('form'),error=d.overlay.querySelector('[data-phase2-error]');
      const kind=form.elements.source_type,source=form.elements.source_id;
      const fill=()=>{
        const list=sources(kind.value),old=source.value||rule?.source_id||'';
        const orphaned=!!rule&&kind.value===rule.source_type&&!list.some(x=>x.id===rule.source_id);
        if(orphaned)list.unshift({id:rule.source_id,name:'（原來源已刪除）'});
        source.innerHTML=list.map(x=>`<option value="${safe(x.id)}">${safe(x.name)}</option>`).join('');
        if(list.some(x=>x.id===old))source.value=old;
        source.disabled=!list.length;
        if(orphaned)error.textContent='來源已刪除。可重新選擇來源，或停用／封存原規則；無法重新啟用不存在的來源。';
        else if(!list.length)error.textContent='尚無此類型資料。請先新增信用卡或旅程，再回來建立提醒。';
        else error.textContent='';
      };
      kind.onchange=()=>{source.value='';fill();};fill();
      let submitting=false;
      form.onsubmit=async e=>{
        e.preventDefault();if(submitting||!form.reportValidity())return;
        if(!source.value){error.textContent='請先選擇信用卡或旅程';return;}
        const data=Object.fromEntries(new FormData(form));data.enabled=form.elements.enabled.checked;
        try{new Intl.DateTimeFormat('zh-TW',{timeZone:data.timezone});}catch{error.textContent='請填寫有效的時區';return;}
        submitting=true;d.setBusy(true);form.querySelector('[type=submit]').disabled=true;error.textContent='儲存中…';
        try{await rpc('ian_phase2_save',{p_id:rule?.id||null,p_revision:rule?.revision||null,p_data:data});d.setBusy(false);d.close();await reload();}
        catch(err){error.textContent=err.code==='40001'?'規則已在其他裝置修改，請重新載入後再試':err.message;}
        finally{submitting=false;d.setBusy(false);if(form.isConnected)form.querySelector('[type=submit]').disabled=false;}
      };
    }
    function preview(rule){
      const src=getSource(rule.source_type,rule.source_id);
      if(!src)return '來源已刪除；這項規則不會發送提醒。';
      if(rule.source_type==='travel_departure'){
        const todo=asList(src.checklist).filter(x=>String(x?.text||'').trim()&&!x.done);
        return `出發：${src.start||'尚未設定'}。未完成準備事項 ${todo.length} 項：\n${todo.slice(0,15).map(x=>'• '+x.text.trim()).join('\n')||'（目前全部完成，將不發送提醒）'}`;
      }
      const key=rule.source_type==='credit_due'?'dueDate':'closingDate';
      const raw=String(src[key]??'');const match=/^(?:\d{4}-\d{1,2}-)?(\d{1,2})(?:T.*)?$/.exec(raw);
      return `每月${rule.source_type==='credit_due'?'繳款':'結帳'}日：${match?Number(match[1])+' 日':'尚未設定'}。提前 ${rule.days_before} 天提醒；日期不存在的月份以月底計算。`;
    }
    async function act(card,callback){
      if(card.dataset.busy)return;card.dataset.busy='1';card.querySelectorAll('button').forEach(b=>b.disabled=true);
      const result=card.querySelector('[data-phase2-result]');result.textContent='處理中…';
      try{const outcome=await callback();if(outcome?.message)status.textContent=outcome.message;await reload();}
      catch(e){result.textContent=e.message;}
      finally{delete card.dataset.busy;card.querySelectorAll('button').forEach(b=>b.disabled=false);}
    }
    function draw(rules){
      const credit=rules.filter(r=>r.source_type!=='travel_departure'),travel=rules.filter(r=>r.source_type==='travel_departure');
      const markup=items=>items.map(r=>{
        const isTravel=r.source_type==='travel_departure',src=getSource(r.source_type,r.source_id);
        const raw=isTravel?String(src?.start||''):String(src?.[r.source_type==='credit_due'?'dueDate':'closingDate']||'');
        const dateLabel=isTravel?(raw?`出發日 ${raw.slice(0,10)}`:'尚未設定出發日期'):(raw?`每月 ${Number((raw.match(/(\d{1,2})(?:T.*)?$/)||[])[1]||0)||'—'} 日`:'尚未設定日期');
        return `<article class="panel operational-rule phase2-reminder-card ${isTravel?'is-travel':'is-credit'}" data-phase2-id="${safe(r.id)}"><div class="section-head"><div><span class="automation-kicker">${isTravel?'TRAVEL REMINDER':r.source_type==='credit_due'?'PAYMENT DUE':'STATEMENT CLOSING'}</span><h4>${safe(r.source_name)}</h4></div><span class="automation-state ${r.enabled?'is-enabled':'is-disabled'}">${r.enabled?'已啟用':'已停用'}</span></div><div class="phase2-reminder-type">${safe(kinds[r.source_type]||'來源提醒')}</div><div class="phase2-reminder-highlight"><strong>${safe(dateLabel)}</strong><span>提前 ${r.days_before} 天提醒</span></div><p class="phase2-reminder-time">◷ ${safe(String(r.local_time||'').slice(0,5))} · ${safe(r.timezone)}</p><dl class="automation-meta"><dt>最近通知</dt><dd>${safe(showDate(r.last_notification?.created_at))}</dd><dt>提醒來源</dt><dd>${r.source_name==='（來源已刪除）'?'來源已刪除；不會發送提醒':'目前儲存的'+(isTravel?'旅遊':'信用卡')+'資料'}</dd></dl><div class="section-actions"><button type="button" class="secondary-btn compact" data-p2-edit>編輯</button><button type="button" class="secondary-btn compact" data-p2-toggle>${r.enabled?'停用':'啟用'}</button><button type="button" class="secondary-btn compact" data-p2-preview>預覽內容</button><button type="button" class="secondary-btn compact" data-p2-run ${r.enabled?'':'disabled'}>立即測試</button><button type="button" class="secondary-btn compact" data-p2-archive>封存</button></div><p class="field-hint">立即測試只建立【手動測試】通知，不修改來源資料。</p><p role="status" data-phase2-result></p></article>`;
      }).join('');
      host.querySelector('[data-phase2-credit]').innerHTML=markup(credit)||'<p class="automation-empty">尚無信用卡提醒，請新增來源提醒。</p>';
      host.querySelector('[data-phase2-travel]').innerHTML=markup(travel)||'<p class="automation-empty">尚無旅遊提醒，請新增來源提醒。</p>';
      host.querySelector('[data-credit-count]').textContent=`${credit.length} 項規則`;
      host.querySelector('[data-travel-count]').textContent=`${travel.length} 項規則`;
      rules.forEach(r=>{
        const card=[...host.querySelectorAll('[data-phase2-id]')].find(x=>x.dataset.phase2Id===r.id),out=card.querySelector('[data-phase2-result]');
        card.querySelector('[data-p2-edit]').onclick=()=>edit(r);
        card.querySelector('[data-p2-preview]').onclick=()=>{out.textContent=preview(r);out.style.whiteSpace='pre-line';};
        card.querySelector('[data-p2-toggle]').onclick=()=>act(card,()=>rpc('ian_phase2_save',{p_id:r.id,p_revision:r.revision,p_data:{...r,enabled:!r.enabled}}));
        card.querySelector('[data-p2-run]').onclick=()=>act(card,()=>rpc('ian_phase2_run',{p_id:r.id,p_request:crypto.randomUUID()}));
        card.querySelector('[data-p2-archive]').onclick=()=>{if(confirm(`封存「${kinds[r.source_type]} · ${r.source_name}」？舊通知會保留。`))act(card,()=>rpc('ian_phase2_archive',{p_id:r.id,p_revision:r.revision}));};
      });
    }
    function drawNotes(rows,append=false){
      if(!append)notesHost.innerHTML='';
      notesHost.insertAdjacentHTML('beforeend',rows.map(n=>`<article class="automation-history-row automation-notice automation-notice--${/旅遊|旅程|出發|travel/i.test(n.title||'')?'travel':'credit'} ${n.read_at?'is-read':'is-unread'}"><div class="section-head"><strong>${safe(n.title)}</strong>${n.read_at?`<span class="automation-notice-actions"><small>已讀</small><button type="button" class="secondary-btn compact notice-delete" data-p2-delete="${safe(n.id)}">刪除</button></span>`:`<button class="secondary-btn compact" data-p2-read="${safe(n.id)}">標記已讀</button>`}</div><p class="automation-message">${safe(n.message)}</p><small>${safe(showDate(n.created_at))}</small></article>`).join('')||(!append?'<p class="muted automation-empty">尚無信用卡或旅遊通知。</p>':''));
      if(rows.length)before={time:rows.at(-1).created_at,id:rows.at(-1).id};
      more.hidden=rows.length<50;
    }
    async function loadNotes(append=false){
      const rows=await rpc('ian_phase2_inbox',{p_before:append?before?.time||null:null,p_before_id:append?before?.id||null:null});
      if(root.isConnected)drawNotes(rows,append);
    }
    async function reload(){
      if(busy||!root.isConnected)return;busy=true;add.disabled=true;status.textContent='載入來源提醒…';
      try{
        const [rules,notes]=await Promise.all([rpc('ian_phase2_list'),rpc('ian_phase2_inbox',{p_before:null,p_before_id:null})]);
        if(!root.isConnected)return;
        draw(rules);before=null;drawNotes(notes);ready=true;add.disabled=!(cards.length||journeys.length);
        status.textContent=!(cards.length||journeys.length)?'請先建立信用卡或旅程，才能新增來源提醒。':'來源提醒已載入；實際執行依賴 Phase 2 Cron 排程，這個畫面無法驗證 Cron 是否運作。';
      }catch(e){if(root.isConnected){ready=false;status.textContent=e.message+'。若尚未安裝 Phase 2，請先完成資料庫遷移。';}}
      finally{busy=false;}
    }
    add.onclick=()=>{if(ready)edit();};
    sub.addEventListener('click',async e=>{
      const button=e.target.closest('[data-p2-read]');if(!button||button.disabled)return;
      button.disabled=true;
      try{const ok=await rpc('ian_phase2_read',{p_id:button.dataset.p2Read});if(ok){const group=document.createElement('span');group.className='automation-notice-actions';group.innerHTML=`<small>已讀</small><button type="button" class="secondary-btn compact notice-delete" data-p2-delete="${safe(button.dataset.p2Read)}">刪除</button>`;button.replaceWith(group);document.dispatchEvent(new Event('open-os-public-notification-changed'));}else button.disabled=false;}
      catch(err){status.textContent=err.message;button.disabled=false;}
    });
    sub.addEventListener('click',async e=>{
      const button=e.target.closest('[data-p2-delete]');if(!button||button.disabled)return;
      if(!confirm('確定刪除這筆已讀通知？刪除後不再顯示。'))return;
      button.disabled=true;
      try{const ok=await rpc('ian_phase2_delete_read',{p_id:button.dataset.p2Delete});if(!ok)throw new Error('只能刪除自己的已讀通知。');button.closest('.automation-notice')?.remove();document.dispatchEvent(new Event('open-os-public-notification-changed'));}
      catch(err){status.textContent=err.message;alert('刪除通知失敗：'+err.message);button.disabled=false;}
    });
    more.onclick=async()=>{more.disabled=true;try{await loadNotes(true);}catch(e){status.textContent=e.message;}finally{more.disabled=false;}};
    return {reload};
  }
  window.IAN_OS_AUTOMATION_PHASE2={mount};
})();
