(() => {
  const u=zh=>window.IAN_OS_UI?.text(zh)||zh;
  function render(api){
    const sameScreen=!!document.getElementById('app')?.querySelector('.routines-operational');
    return window.IAN_OS_SCROLL ? window.IAN_OS_SCROLL.keep(()=>renderContent(api),sameScreen) : renderContent(api);
  }
  function renderContent(api){
    const {state,save,toast,escape:esc,modal,removePreference}=api;
    const prefs=state().settings.preferences ||= {};
    const lists=prefs.routineChecklists ||= [];
    const app=document.getElementById('app');
    function edit(item){
      const draft=(item?.items||[]).map(x=>({...x}));if(!draft.length)draft.push({text:'',done:false});
      const overlay=modal(item?'編輯 Routine checklist':'新增 Routine checklist',`<label><span>清單名稱</span><input name="title" maxlength="100" value="${esc(item?.title||'')}" required></label><div class="section-head"><h3>勾選項目 <small id="routineCount"></small></h3><button type="button" class="secondary-btn compact" id="routineAdd">＋ 新增一列</button></div><div id="routineRows"></div>`,form=>{
        const title=String(form.get('title')||'').trim();if(!title){toast(u('請填寫清單名稱'));return false;}
        const value={id:item?.id||crypto.randomUUID(),title,items:draft.filter(x=>x.text.trim()).map(x=>({text:x.text.trim(),done:!!x.done}))};
        if(!value.items.length){toast(u('請至少填寫一項工作'));return false;}
        if(item)Object.assign(item,value);else lists.push(value);save();render(api);
      });
      function draw(){
        overlay.querySelector('#routineCount').textContent=`${draft.length} / 50`;
        overlay.querySelector('#routineAdd').disabled=draft.length>=50;
        overlay.querySelector('#routineRows').innerHTML=draft.map((x,i)=>`<div class="checklist-edit routine-edit-row"><input type="checkbox" data-rdone="${i}" aria-label="第 ${i+1} 項完成" ${x.done?'checked':''}><input data-rtext="${i}" maxlength="300" value="${esc(x.text)}" aria-label="第 ${i+1} 項" placeholder="固定工作事項"><div class="routine-reorder"><button type="button" class="icon-btn" data-rup="${i}" aria-label="第 ${i+1} 項上移" ${i===0?'disabled':''}>↑</button><button type="button" class="icon-btn" data-rdown="${i}" aria-label="第 ${i+1} 項下移" ${i===draft.length-1?'disabled':''}>↓</button></div><button type="button" class="icon-btn" data-rremove="${i}" aria-label="移除第 ${i+1} 項">×</button></div>`).join('');
        overlay.querySelectorAll('[data-rtext]').forEach(el=>el.oninput=()=>draft[+el.dataset.rtext].text=el.value);
        overlay.querySelectorAll('[data-rdone]').forEach(el=>el.onchange=()=>draft[+el.dataset.rdone].done=el.checked);
        for(const [attr,delta] of [['rup',-1],['rdown',1]])overlay.querySelectorAll('[data-'+attr+']').forEach(el=>el.onclick=()=>{const i=+el.dataset[attr],j=i+delta;if(j<0||j>=draft.length)return;[draft[i],draft[j]]=[draft[j],draft[i]];overlay.oninput();draw();overlay.querySelector('[data-'+attr+'="'+j+'"]')?.focus();});
        overlay.querySelectorAll('[data-rremove]').forEach(el=>el.onclick=async()=>{const index=+el.dataset.rremove,item=draft[index];const removed=await window.IAN_OS_DELETE.run({name:item?.text||u('固定工作事項'),action:async()=>{}});if(!removed)return;draft.splice(index,1);overlay.oninput();draw();});
      }
      overlay.querySelector('#routineAdd').onclick=()=>{if(draft.length<50){draft.push({text:'',done:false});overlay.oninput();draw();overlay.querySelector(`[data-rtext="${draft.length-1}"]`)?.focus();}};
      draw();
    }
    app.innerHTML=`<section class="page-head routines-operational"><div><div class="eyebrow">WORKSPACE · ROUTINES</div><h1 class="page-title">☑ Routine checklist</h1><p class="page-subtitle">固定工作的操作清單，無日期、無期限。完成後保留，下一輪可清除勾選重新使用。</p></div><button class="primary-btn" id="newRoutine">＋ 新增清單</button></section><div class="routine-grid">${lists.map(list=>{const done=list.items.filter(x=>x.done).length;return `<section class="panel routine-panel"><div class="section-head"><h2>${esc(list.title)}</h2><span>${done} / ${list.items.length}</span></div><progress max="${list.items.length||1}" value="${done}" aria-label="完成進度"></progress><div class="routine-items">${list.items.map((x,i)=>`<label class="checklist-view ${x.done?'checked':''}"><input type="checkbox" data-routine="${esc(list.id)}" data-index="${i}" ${x.done?'checked':''}><span>${esc(x.text)}</span></label>`).join('')}</div><div class="routine-actions"><button class="secondary-btn compact" data-reset-routine="${esc(list.id)}">↺ 重新開始</button><button class="secondary-btn compact" data-edit-routine="${esc(list.id)}">編輯</button><button class="secondary-btn compact" data-delete-routine="${esc(list.id)}">刪除</button></div></section>`;}).join('')||`<section class="panel">${globalThis.IAN_OS_EMPTY_GUIDE({title:'還沒有固定工作清單',hint:'建立第一份固定工作清單，每份最多 50 項。'})}</section>`}</div>`;
    app.querySelector('#newRoutine').onclick=()=>edit();
    app.querySelectorAll('[data-routine]').forEach(el=>el.onchange=()=>{const list=lists.find(x=>x.id===el.dataset.routine);if(!list)return;list.items[+el.dataset.index].done=el.checked;save();render(api);});
    app.querySelectorAll('[data-edit-routine]').forEach(el=>el.onclick=()=>edit(lists.find(x=>x.id===el.dataset.editRoutine)));
    app.querySelectorAll('[data-reset-routine]').forEach(el=>el.onclick=()=>{if(!confirm(u('清除這份清單的所有勾選，開始下一輪？')))return;lists.find(x=>x.id===el.dataset.resetRoutine).items.forEach(x=>x.done=false);save();render(api);});
    app.querySelectorAll('[data-delete-routine]').forEach(el=>el.onclick=()=>{const list=lists.find(x=>x.id===el.dataset.deleteRoutine);if(!list)return;removePreference({name:list.title,message:window.IAN_OS_UI?.lang()==='en'?`This also deletes ${list.items.length} checklist item${list.items.length===1?'':'s'}. This action cannot be undone.`:`此操作會一併刪除 ${list.items.length} 個清單項目，且無法復原。`,mutate:next=>{next.settings.preferences.routineChecklists=(next.settings.preferences.routineChecklists||[]).filter(x=>x.id!==list.id);},success:window.IAN_OS_UI?.lang()==='en'?'Routine Checklist deleted':'已刪除 Routine checklist'});});
  }
  window.IAN_OS_ROUTINES={render};
})();
