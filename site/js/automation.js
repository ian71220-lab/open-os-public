/* Phase 1: owner-scoped RPC UI. All scheduling and execution lives in PostgreSQL. */
(() => {
  'use strict';
  const types={manual:'手動',once:'單次',daily:'每日',weekly:'每週',monthly:'每月'};
  const statuses={pending:'待執行',running:'執行中',succeeded:'成功',failed:'失敗',skipped:'已略過'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rpc=(name,args)=>window.IAN_OS_CLOUD.automationRequest(name,args);
  const stamp=(v,zone)=>v?new Intl.DateTimeFormat('zh-TW',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'尚無';
  const zoneOrDefault=zone=>{try{new Intl.DateTimeFormat('zh-TW',{timeZone:zone||'America/Los_Angeles'});return zone||'America/Los_Angeles';}catch{return 'America/Los_Angeles';}};
  const localDay=zone=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=k=>p.find(x=>x.type===k).value;return `${get('year')}-${get('month')}-${get('day')}`;};
  const summary=r=>r.trigger_type==='manual'?'僅手動執行':`${types[r.trigger_type]}${r.trigger_type==='weekly'?' · 週'+['日','一','二','三','四','五','六'][r.weekday]:r.trigger_type==='monthly'?' · '+r.monthday+' 日':''} · ${r.local_time?.slice(0,5)||''} · ${r.timezone} · ${r.trigger_type==='once'?'執行日期':'開始日期'} ${r.start_date}`;
  function modal(title,body){
    const overlay=document.createElement('div');overlay.className='modal-backdrop';
    overlay.innerHTML=`<section class="modal automation-editor" role="dialog" aria-modal="true"><div class="modal-header"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="關閉">×</button></div>${body}</section>`;
    document.body.append(overlay);window.IAN_OS_DIALOG.activate(overlay);
    let busy=false;const close=()=>{if(busy)return;window.IAN_OS_DIALOG.deactivate(overlay);overlay.remove();};
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
    return {overlay,close,setBusy:v=>{busy=v;overlay.querySelectorAll('[data-close]').forEach(b=>b.disabled=v);}};
  }
  async function history(rule,zone){
    const d=modal('執行紀錄',`<p>${esc(rule.name)}</p><div data-history></div><p role="status" data-status></p><button type="button" class="secondary-btn" data-more>載入紀錄</button>`);
    let before=null;const more=d.overlay.querySelector('[data-more]'),status=d.overlay.querySelector('[data-status]');
    more.onclick=async()=>{more.disabled=true;status.textContent='載入中';try{
      const rows=await rpc('ian_auto_history',{p_id:rule.id,p_before:before?.time||null,p_before_id:before?.id||null});if(!d.overlay.isConnected)return;
      d.overlay.querySelector('[data-history]').insertAdjacentHTML('beforeend',rows.map(e=>`<article class="automation-history-row"><strong>${esc(statuses[e.status]||e.status)} · ${esc(types[e.trigger_type])}</strong><p>預定：${esc(stamp(e.scheduled_at,zone))}<br>開始：${esc(stamp(e.started_at,zone))}<br>完成：${esc(stamp(e.completed_at,zone))}</p><small>嘗試 ${e.attempts} 次 · ${e.duration_ms??0} ms${e.error_message?' · '+esc(e.error_message):''}</small></article>`).join(''));
      status.textContent=rows.length?'':'沒有更多紀錄';before=rows.length?{time:rows.at(-1).created_at,id:rows.at(-1).id}:before;more.hidden=rows.length<50;
    }catch(e){status.textContent=e.message;}finally{more.disabled=false;}};await more.onclick();
  }
  function edit(rule,zone,onSaved){
    const r=rule||{name:'',description:'',message:'您的排程提醒已準備好。',enabled:true,trigger_type:'manual',timezone:zone,start_date:localDay(zone),local_time:'09:00',weekday:1,monthday:1};
    const field=(key,label,type='text',extra='')=>`<label><span>${label}</span><input name="${key}" type="${type}" value="${esc(r[key]??'')}" ${extra}></label>`;
    const d=modal(rule?'編輯自動化':'建立自動化',`<form data-auto-form>${field('name','名稱','text','required maxlength="120"')}<label><span>說明</span><textarea name="description" rows="2" maxlength="1000">${esc(r.description)}</textarea></label><label class="check-label"><input name="enabled" type="checkbox" ${r.enabled?'checked':''}>啟用</label><label><span>觸發方式</span><select name="trigger_type">${Object.entries(types).map(([k,v])=>`<option value="${k}" ${k===r.trigger_type?'selected':''}>${v}</option>`).join('')}</select></label><div class="automation-schedule field-grid two">${field('start_date','執行／開始日期','date','min="2000-01-01" max="2100-12-31"')}${field('local_time','執行時間','time','step="60"')}${field('timezone','時區（IANA）','text','required list="automation-timezones"')}<datalist id="automation-timezones">${['America/Los_Angeles','Asia/Taipei','America/New_York','Europe/London','UTC'].map(z=>`<option value="${z}"></option>`).join('')}</datalist><label data-weekday><span>星期</span><select name="weekday">${['日','一','二','三','四','五','六'].map((v,k)=>`<option value="${k}" ${k===r.weekday?'selected':''}>週${v}</option>`).join('')}</select></label><label data-monthday><span>每月日期</span><input name="monthday" type="number" min="1" max="31" value="${r.monthday||1}"></label></div><p class="field-hint" data-schedule-help>每月日期不存在時使用月底。夏令時間不存在的時間：重複排程跳過該日，單次排程不接受。秋季重複時間採後一次，僅執行一次。停機後只補執行一次，不補發所有歷史提醒。</p><label><span>動作：建立站內通知</span><textarea name="message" rows="3" required maxlength="2000">${esc(r.message)}</textarea></label><p class="field-hint">通知保存在自動化頁面的「站內通知」。不寄送 Email 或手機推播。其他動作尚未開放。</p><p role="alert" data-error></p><div class="modal-actions"><button type="button" class="secondary-btn" data-close>取消</button><button type="submit" class="primary-btn">儲存</button></div></form>`);
    const form=d.overlay.querySelector('form'),error=d.overlay.querySelector('[data-error]'),submit=form.querySelector('[type=submit]');
    // Keep textareas plain: the shared editor intentionally upgrades modal textareas.
    form.querySelectorAll('textarea').forEach(t=>t.dataset.richReady='automation-plain-text');
    const adjust=()=>{const kind=form.elements.trigger_type.value;const manual=kind==='manual';form.querySelector('.automation-schedule').hidden=manual;form.querySelector('[data-schedule-help]').hidden=manual;
      for(const key of ['start_date','local_time']){form.elements[key].disabled=manual;form.elements[key].required=!manual;}
      form.querySelector('[data-weekday]').hidden=kind!=='weekly';form.elements.weekday.disabled=kind!=='weekly';
      form.querySelector('[data-monthday]').hidden=kind!=='monthly';form.elements.monthday.disabled=kind!=='monthly';form.elements.monthday.required=kind==='monthly';
    };form.elements.trigger_type.onchange=adjust;adjust();
    let pending=false;
    form.onsubmit=async event=>{event.preventDefault();if(pending)return;if(!form.reportValidity())return;
      const data=Object.fromEntries(new FormData(form));data.enabled=form.elements.enabled.checked;
      try{new Intl.DateTimeFormat('zh-TW',{timeZone:data.timezone});}catch{error.textContent='請輸入有效的 IANA 時區，例如 Asia/Taipei。';return;}
      pending=true;submit.disabled=true;d.setBusy(true);error.textContent='儲存中';
      try{await rpc('ian_auto_save',{p_id:rule?.id||null,p_revision:rule?.revision||null,p_data:data});d.setBusy(false);d.close();await onSaved();}
      catch(e){error.textContent=e.code==='40001'?'規則已在其他視窗更新。請複製尚未儲存的文字，關閉後重新載入。':e.message;}
      finally{pending=false;submit.disabled=false;d.setBusy(false);}
    };
  }
  function summaryHistory(rule,adapter){
    const rows=adapter.history(rule.id);
    modal('頁面摘要執行紀錄',`<p>${esc(rule.title)}</p><p class="field-hint">僅列出原有自動檢查紀錄，立即測試不寫入紀錄。</p>${rows.map(row=>`<article class="automation-history-row"><small>${esc(stamp(row.date))}</small><p>${esc(row.result)}</p></article>`).join('')||'<p class="muted">尚無執行紀錄</p>'}`);
  }
  function editSummary(rule,adapter,onSaved){
    const d=modal('編輯每日摘要',`<form data-summary-form><div class="automation-edit-intro"><span class="automation-kicker">DAILY ROUTINE</span><h3>${esc(rule.icon)} ${esc(rule.title)}</h3><p class="field-hint">時間與提醒內容會儲存到目前帳號的設定。每日摘要仍由網站載入時的本機檢查觸發，不是背景 Cron 排程。</p></div><label><span>摘要名稱</span><input name="title" maxlength="120" required value="${esc(rule.title)}"></label><div class="field-grid two"><label><span>每日檢查時間（裝置當地時間）</span><input name="time" type="time" step="60" required value="${esc(rule.time)}"></label><label class="check-label automation-edit-enabled"><input name="enabled" type="checkbox" ${rule.enabled?'checked':''}>啟用這項摘要</label></div><label><span>摘要內容／訊息範本</span><textarea name="message" rows="5" maxlength="1000" required>${esc(rule.message)}</textarea></label><div class="automation-template-help"><strong>可插入的即時資料</strong><p><code>{today_due}</code> 今日到期待辦　<code>{overdue}</code> 逾期待辦<br><code>{followups}</code> 待追蹤訊息　<code>{open_tasks}</code> 未完成待辦</p><p>其他文字會照原樣顯示。立即測試可預覽套用資料後的結果。</p></div><p role="alert" data-error></p><div class="modal-actions"><button type="button" class="secondary-btn" data-close>取消</button><button type="submit" class="primary-btn">儲存變更</button></div></form>`);
    const form=d.overlay.querySelector('form'),error=form.querySelector('[data-error]');
    form.querySelector('textarea').dataset.richReady='automation-plain-text';
    let pending=false;
    form.onsubmit=event=>{
      event.preventDefault();if(pending||!form.reportValidity())return;pending=true;
      try{adapter.setConfig(rule.id,{title:form.elements.title.value,time:form.elements.time.value,message:form.elements.message.value,enabled:form.elements.enabled.checked});d.close();onSaved('摘要設定已更新，正在透過既有同步流程儲存。');}
      catch(e){error.textContent=e.message;}
      finally{pending=false;}
    };
  }
  async function render({timezone,summaries,creditCards,trips,workboard}){

    const zone=zoneOrDefault(timezone),app=document.getElementById('app');
    const root=document.createElement('div');root.className='automation-phase1';
    root.innerHTML=`<section class="page-head automation-page-head"><div><div class="eyebrow">AUTOMATION CENTER</div><h1 class="page-title">自動化管理</h1><p class="page-subtitle">公開展示版只保存本機規則，背景排程與通知不會執行。</p></div><div class="section-actions"><button class="secondary-btn" data-refresh>重新整理</button><button class="primary-btn" data-add disabled>＋ 新增背景規則</button></div></section><p role="status" class="automation-global-status" data-status>載入中</p><section class="panel section automation-notification-center" data-notification-center><div class="automation-zone-heading"><div class="automation-zone-icon" aria-hidden="true">♧</div><div><span class="automation-kicker">INBOX · NOTIFICATIONS</span><h2>站內通知</h2><p class="muted">信用卡、旅遊與背景通知集中在最上方。僅站內顯示，不是 Email 或手機推播。</p></div></div><div class="automation-notice-grid" data-inbox></div><button class="secondary-btn compact" data-inbox-more hidden>載入較早通知</button></section><div class="automation-sections" data-rules><section class="automation-zone automation-zone--summary"><div class="automation-zone-heading"><div class="automation-zone-icon" aria-hidden="true">☼</div><div><span class="automation-kicker">DAILY ROUTINES</span><h2>每日摘要</h2><p class="muted">每日早報、午後追蹤、收工檢查 · 可編輯時間與摘要內容</p></div></div><div class="automation-grid automation-summary-grid" data-summary-rules></div></section><section class="automation-zone automation-zone--background"><div class="automation-zone-heading"><div class="automation-zone-icon" aria-hidden="true">◷</div><div><span class="automation-kicker">BACKGROUND RULES</span><h2>背景提醒規則</h2><p class="muted">獨立於每日摘要的排程站內通知。</p></div></div><div class="automation-grid automation-background-grid" data-engine-rules></div></section></div><div data-concepts></div>`;
    app.replaceChildren(root);const board=workboard?window.IAN_OS_WORKBOARD.mount({root,...workboard}):null;const status=root.querySelector('[data-status]');let loading=false;const requestIds=new Map();let inboxBefore=null;
    const localCards=root.querySelector('[data-summary-rules]'),remoteCards=root.querySelector('[data-engine-rules]');
    const phase2=window.IAN_OS_AUTOMATION_PHASE2?.mount({root,zone,creditCards,trips,modal,rpc});
    const renderSummaries=(message)=>{
      const rows=summaries?.list()||[];
      localCards.innerHTML=rows.map(r=>`<article class="panel operational-rule automation-summary-card" data-summary="${esc(r.id)}" data-summary-kind="${esc(r.id)}"><div class="section-head"><div><span class="automation-kicker">${esc(r.id==='morning'?'MORNING':r.id==='followup'?'AFTERNOON':'EVENING')}</span><h3>${esc(r.icon)} ${esc(r.title)}</h3></div><span class="automation-state ${r.enabled?'is-enabled':'is-disabled'}">${r.enabled?'已啟用':'已停用'}</span></div><div class="automation-summary-time"><span class="automation-summary-clock">${esc(r.time)}</span><span>每日 · 裝置當地時間</span></div><p class="automation-summary-copy">${esc(r.message)}</p><dl class="automation-meta"><dt>觸發方式</dt><dd>網站開啟時檢查（非背景排程）</dd><dt>最近執行</dt><dd>${esc(stamp(r.last?.date))}</dd><dt>最近結果</dt><dd>${esc(r.last?.result||'尚無紀錄')}</dd></dl><div class="section-actions"><button class="secondary-btn compact" data-summary-edit>編輯時間／內容</button><button class="secondary-btn compact" data-summary-toggle>${r.enabled?'停用':'啟用'}</button><button class="secondary-btn compact" data-summary-test>立即測試</button><button class="secondary-btn compact" data-summary-history>執行紀錄</button></div><p data-summary-result role="status"></p></article>`).join('');
      for(const r of rows){
        const card=[...localCards.children].find(c=>c.dataset.summary===r.id),result=card.querySelector('[data-summary-result]');
        card.querySelector('[data-summary-edit]').onclick=()=>editSummary(r,summaries,renderSummaries);
        card.querySelector('[data-summary-toggle]').onclick=()=>{try{summaries.setEnabled(r.id,!r.enabled);renderSummaries('摘要設定已更新，等待既有同步流程儲存。請留意全域同步狀態。');}catch(e){result.textContent=e.message;}};
        card.querySelector('[data-summary-test]').onclick=()=>{try{result.textContent=summaries.test(r.id);}catch(e){result.textContent=e.message;}};
        card.querySelector('[data-summary-history]').onclick=()=>summaryHistory(r,summaries);
      }
      const concepts=summaries?.concepts()||[];
      root.querySelector('[data-concepts]').innerHTML=concepts.length?`<section class="panel section"><h2>既有工作流程構想</h2><p class="muted">原有規劃資料，尚未接上執行服務。</p>${concepts.map(w=>`<details><summary>${esc(w.title)}</summary><p>${esc(w.description||'')}</p><ul>${(w.actions||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></details>`).join('')}</section>`:'';
      if(message)status.textContent=message;
    };
    renderSummaries();
    const noteClass=n=>/旅遊|旅程|出發|travel/i.test(n.title||'')?'travel':/信用卡|繳款|結帳|credit/i.test(n.title||'')?'credit':'general';
    const inbox=(rows,append=false)=>{const host=root.querySelector('[data-inbox]');if(!append)host.innerHTML='';host.insertAdjacentHTML('beforeend',rows.map(n=>`<article class="automation-history-row automation-notice automation-notice--${noteClass(n)} ${n.read_at?'is-read':'is-unread'}"><div class="section-head"><strong>${esc(n.title)}</strong>${n.read_at?`<span class="automation-notice-actions"><small>已讀</small><button type="button" class="secondary-btn compact notice-delete" data-delete="${esc(n.id)}">刪除</button></span>`:`<button class="secondary-btn compact" data-read="${esc(n.id)}">標記已讀</button>`}</div><p class="automation-message">${esc(n.message)}</p><small>${esc(stamp(n.created_at,zone))}</small></article>`).join('')||(!append?'<p class="muted automation-empty">目前沒有一般背景通知。</p>':''));inboxBefore=rows.length?{time:rows.at(-1).created_at,id:rows.at(-1).id}:inboxBefore;root.querySelector('[data-inbox-more]').hidden=rows.length<50;};
    const load=async()=>{if(loading||!root.isConnected)return;loading=true;root.querySelector('[data-refresh]').disabled=true;status.textContent='載入中';renderSummaries();try{
      const [rules,notes]=await Promise.all([rpc('ian_auto_list'),rpc('ian_auto_inbox',{p_before:null})]);if(!root.isConnected)return;
      remoteCards.innerHTML=rules.map(r=>`<article class="panel operational-rule" data-auto="${esc(r.id)}"><div class="section-head"><h2>${esc(r.name)}</h2><span>${r.enabled?'已啟用':'已停用'}</span></div><p class="muted">背景站內通知</p><p>${esc(r.description)}</p><p>觸發：${esc(summary(r))}</p><dl class="automation-meta"><dt>最近執行</dt><dd>${esc(stamp(r.last_execution?.started_at||r.last_execution?.created_at,r.timezone))}</dd><dt>下次執行</dt><dd>${r.next_run_at?esc(stamp(r.next_run_at,r.timezone)):r.enabled&&r.trigger_type==='once'?'排程已結束':r.trigger_type==='manual'?'僅手動':'未排程'}</dd><dt>最近結果</dt><dd>${esc(statuses[r.last_execution?.status]||'尚無紀錄')}</dd></dl><div class="section-actions"><button class="secondary-btn compact" data-edit>編輯</button><button class="secondary-btn compact" data-toggle>${r.enabled?'停用':'啟用'}</button><button class="secondary-btn compact" data-run ${r.enabled?'':'disabled'}>立即執行</button><button class="secondary-btn compact" data-history>執行紀錄</button><button class="secondary-btn compact" data-archive>封存</button></div><p data-result role="status"></p></article>`).join('')||'<p class="muted automation-empty">尚無背景規則，可使用右上角新增規則。</p>';
      inbox(notes);board?.update(rules,notes);root.querySelector('[data-add]').disabled=false;status.textContent='資料已載入。背景排程須由管理者確認 Cron 已啟用；此畫面不能證明排程服務正在運作。';
      for(const r of rules){const card=root.querySelector(`[data-auto="${r.id}"]`),result=card.querySelector('[data-result]');
        card.querySelector('[data-edit]').onclick=()=>edit(r,zone,load);card.querySelector('[data-history]').onclick=()=>history(r,r.timezone);
        const perform=async(button,action)=>{if(card.dataset.busy)return;card.dataset.busy='1';card.querySelectorAll('button').forEach(b=>b.disabled=true);result.textContent='處理中';try{const outcome=await action();await load();return outcome;}catch(e){result.textContent=e.message;}finally{delete card.dataset.busy;card.querySelectorAll('button').forEach(b=>b.disabled=false);card.querySelector('[data-run]').disabled=!r.enabled;}};
        card.querySelector('[data-toggle]').onclick=event=>perform(event.currentTarget,()=>rpc('ian_auto_save',{p_id:r.id,p_revision:r.revision,p_data:{...r,enabled:!r.enabled}}));
        card.querySelector('[data-archive]').onclick=event=>{if(confirm(`封存「${r.name}」？排程將停止，執行紀錄與通知會保留。`))perform(event.currentTarget,()=>rpc('ian_auto_archive',{p_id:r.id,p_revision:r.revision}));};
        card.querySelector('[data-run]').onclick=event=>perform(event.currentTarget,async()=>{
          const id=requestIds.get(r.id)||crypto.randomUUID();requestIds.set(r.id,id);
          const e=await rpc('ian_auto_run',{p_id:r.id,p_request:id});requestIds.delete(r.id);
          // Success is reported only from the committed backend result.
          result.textContent=`${statuses[e.status]||e.status}${e.error_message?'：'+e.error_message:''}`;return e;
        });
      }
    }catch(e){if(root.isConnected){status.textContent=e.message;board?.error();}}finally{loading=false;root.querySelector('[data-refresh]').disabled=false;}};
    root.querySelector('[data-refresh]').onclick=()=>Promise.all([load(),phase2?.reload()]);root.querySelector('[data-add]').onclick=()=>edit(null,zone,load);
    root.addEventListener('click',async event=>{const b=event.target.closest('[data-read]');if(!b||b.disabled)return;b.disabled=true;try{await rpc('ian_auto_read',{p_id:b.dataset.read});b.outerHTML=`<span class="automation-notice-actions"><small>已讀</small><button type="button" class="secondary-btn compact notice-delete" data-delete="${esc(b.dataset.read)}">刪除</button></span>`;document.dispatchEvent(new Event('open-os-public-notification-changed'));}catch(e){status.textContent=e.message;b.disabled=false;}});
    root.addEventListener('click',async event=>{
      const b=event.target.closest('[data-delete]');if(!b||b.disabled)return;
      if(!confirm('確定刪除這筆已讀通知？刪除後不再顯示。'))return;
      b.disabled=true;
      try{const ok=await rpc('ian_auto_delete_read',{p_id:b.dataset.delete});if(!ok)throw new Error('只能刪除自己的已讀通知。');b.closest('.automation-notice')?.remove();document.dispatchEvent(new Event('open-os-public-notification-changed'));}
      catch(e){status.textContent=e.message;alert('刪除通知失敗：'+e.message);b.disabled=false;}
    });
    root.querySelector('[data-inbox-more]').onclick=async event=>{const b=event.currentTarget;b.disabled=true;try{const rows=await rpc('ian_auto_inbox',{p_before:inboxBefore?.time||null,p_before_id:inboxBefore?.id||null});if(root.isConnected)inbox(rows,true);}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
    await Promise.all([load(),phase2?.reload()]);
  }
  window.IAN_OS_AUTOMATION={render};
})();
