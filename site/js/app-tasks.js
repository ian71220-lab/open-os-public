(() => {
  window.IAN_OS_APP_TASKS={create(deps){
    const {getState,app,navigation,taskFilter,searchInput,lang,ui,t,escapeHtml,escapeAttr,filterCategory,categoryFilters,taskSort,sectionHead,emptyInline,bindDynamicActions,bindCategoryFilters,bindPressable,saveState,render,deleteEntity,openCapture,tagHtml,formatDateTime,priorityLabel,statusLabel,today,localDatePart,addISODateDays,safeStorageGet,safeStorageSet,toast,planning,syncNav}=deps;
    const state=new Proxy(Object.create(null),{get(_target,key){return getState()?.[key];}});
  function renderTasksPage(){
    if(navigation.detailId){ const item=state.tasks.find(x=>x.id===navigation.detailId); if(item) return renderTaskPreview(item); navigation.detailId=null; }
    const source=filterCategory(state.tasks),visible=source.filter(x=>taskMatchesPlannerFilter(x,taskFilter.active)).sort(taskSort);
    const open=visible.filter(x=>!['done','cancelled'].includes(x.status));
    const done=visible.filter(x=>['done','cancelled'].includes(x.status));
    const scopes=taskFilter.active==='completed'?[['completed',lang()==='zh'?'已完成':'Completed']]:[['work',lang()==='zh'?'工作':'Work'],['life',lang()==='zh'?'生活':'Life']];
    app.innerHTML=`<section class="page-head tasks-operational"><div><div class="eyebrow">ACTION CENTER</div><h1 class="page-title">${t('reminders')}</h1><p class="page-subtitle">${lang()==='zh'?'工作交辦、生活細節與提醒時間集中整理。到期提醒會在頁面內顯示。':'Track work, life and reminders in one place.'}</p></div><div class="section-actions"><button class="secondary-btn" id="notificationBtn">${lang()==='zh'?'開啟瀏覽器通知':'Enable notifications'}</button><button class="primary-btn" data-add="task">＋ ${t('addTask')}</button></div></section>${categoryFilters(state.tasks)}${taskPlannerFiltersMarkup(source)}<div class="task-groups">${scopes.map(([scope,title])=>{const rows=scope==='completed'?done:open.filter(x=>(x.scope||'work')===scope);return `<section class="panel">${sectionHead(title,`<span class="task-count">${rows.length}</span>`)}<div class="task-list">${rows.slice(0,scope==='completed'?30:Infinity).map(x=>taskRow(x,true)).join('')||taskEmptyMarkup()}</div></section>`}).join('')}</div>${taskFilter.active==='open'?`<section class="panel section">${sectionHead(lang()==='zh'?'已完成':'Completed')}<div class="task-list">${source.filter(x=>['done','cancelled'].includes(x.status)).sort(taskSort).slice(0,30).map(x=>taskRow(x,true)).join('')||taskEmptyMarkup()}</div></section>`:''}`;
    bindDynamicActions();bindTaskRows();bindCategoryFilters();
    app.querySelectorAll('[data-task-planner-filter]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.taskPlannerFilter===taskFilter.active)return;const next=button.dataset.taskPlannerFilter;const apply=()=>{taskFilter.active=next;render();};window.IAN_OS_SCROLL?window.IAN_OS_SCROLL.keep(apply):apply();}));
    document.getElementById('notificationBtn').onclick=async()=>toast(ui(typeof Notification==='undefined'?'此瀏覽器不支援通知':(await Notification.requestPermission())==='granted'?'瀏覽器通知已開啟':'未授權通知，頁面內提醒仍可使用'));
  }
  function taskPlannerFiltersMarkup(tasks){
    const zh=lang()==='zh',options=[['open',zh?'待辦':'Open'],['today',zh?'今天':'Today'],['next7',zh?'接下來 7 天':'Next 7 Days'],['overdue',zh?'逾期':'Overdue'],['unscheduled',zh?'未排期':'Unscheduled'],['completed',zh?'已完成':'Completed']];
    return `<div class="filter-bar task-planner-filters" role="group" aria-label="${zh?'待辦篩選':'Task filters'}">${options.map(([key,label])=>`<button type="button" class="filter-chip ${taskFilter.active===key?'active':''}" data-task-planner-filter="${key}" aria-pressed="${taskFilter.active===key}">${label}<small>${tasks.filter(item=>taskMatchesPlannerFilter(item,key)).length}</small></button>`).join('')}</div>`;
  }
  function taskMatchesPlannerFilter(item,filter,day=today()){
    const closed=['done','cancelled'].includes(item.status),reminderDate=localDatePart(item.remindAt);
    if(filter==='completed')return closed;
    if(closed)return false;
    if(filter==='today')return item.dueDate===day||reminderDate===day;
    if(filter==='next7'){const end=addISODateDays(day,6);return [item.dueDate,reminderDate].some(date=>date&&date>=day&&date<=end);}
    if(filter==='overdue')return !!item.dueDate&&item.dueDate<day;
    if(filter==='unscheduled')return !item.dueDate&&!item.remindAt;
    return true;
  }
  function renderTaskPreview(item){
    const scopeLabel=(item.scope||'work')==='life'?(lang()==='zh'?'生活':'Life'):(lang()==='zh'?'工作':'Work');
    const taskTags=[item.category||scopeLabel,scopeLabel,priorityLabel(item.priority||'medium'),statusLabel(item.status),item.dueDate|| (lang()==='zh'?'無到期日':'No due date'),item.remindAt?`${lang()==='zh'?'提醒':'Reminder'} · ${formatDateTime(item.remindAt)}`:''].filter(Boolean);
    app.innerHTML=`<button class="secondary-btn" id="backTasks">← ${lang()==='zh'?'返回待辦':'Back to tasks'}</button><section class="detail-panel section task-detail-panel"><div class="detail-head"><div><span class="type-pill">TASK</span><h1>${escapeHtml(item.title)}</h1><div class="detail-description rendered-content">${window.IAN_OS_EDITOR.render(item.description||'')}</div></div><div class="detail-actions"><button class="danger-btn secondary-danger" id="deleteTask">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn" id="editTask">✎ ${t('edit')}</button></div></div><div class="filter-bar task-preview-tags">${[...new Set(taskTags)].map(tagHtml).join('')}</div><div class="detail-content rendered-content">${window.IAN_OS_EDITOR.render(item.notes|| (lang()==='zh'?'尚未新增備註。':'No notes yet.'))}</div>${window.IAN_OS_ATTACHMENTS.gallery(item.attachments)}</section>`;
    planning.appendChecklist(app,item);
    document.getElementById('backTasks').onclick=()=>{navigation.detailId=null;render();};document.getElementById('editTask').onclick=()=>openCapture('task',item);document.getElementById('deleteTask').onclick=()=>deleteEntity(item);
    window.IAN_OS_ATTACHMENTS.bindGallery(app,item.attachments);
  }
  function checkReminders(){
    if(!window.IAN_OS_CLOUD?.user())return;
    planning.runDaily();
    const now=Date.now();
    state.tasks.filter(x=>!['done','cancelled'].includes(x.status)&&x.remindAt).forEach(x=>{
      const due=new Date(x.remindAt).getTime();if(!Number.isFinite(due)||due>now)return;
      const key=`open-os-public-reminded-${x.id}-${x.remindAt}`;
      if(safeStorageGet(key))return;
      safeStorageSet(key,'1');toast(`${lang()==='zh'?'提醒':'Reminder'}：${x.title}`);
      if(typeof Notification!=='undefined' && Notification.permission==='granted')new Notification('OPEN OS · '+(lang()==='zh'?'提醒':'Reminder'),{body:x.title});
    });
  }
  function taskRow(x, operational=false){ return `<div class="task-item ${x.status==='done'?'done':''}" ${operational===true?`data-due-state="${['done','cancelled'].includes(x.status)?'closed':!x.dueDate?'unscheduled':x.dueDate<today()?'overdue':x.dueDate===today()?'today':'upcoming'}"`:''} data-task-id="${x.id}"><button class="task-check" data-task-toggle="${x.id}" aria-label="${escapeAttr((x.status==='done'?(lang()==='zh'?'標記為未完成：':'Mark incomplete: '):(lang()==='zh'?'標記為完成：':'Mark complete: '))+x.title)}" aria-pressed="${x.status==='done'}">${x.status==='done'?'✓':''}</button><div><strong>${escapeHtml(x.title)}</strong><div class="item-meta">${escapeHtml(x.notes||'')} ${x.dueDate?`· ${operational===true?`<span class="task-due">${escapeHtml(x.dueDate)} · ${escapeHtml(['done','cancelled'].includes(x.status)?(lang()==='zh'?'已結束':'Closed'):x.dueDate<today()?(lang()==='zh'?'逾期':'Overdue'):x.dueDate===today()?(lang()==='zh'?'今天':'Today'):(lang()==='zh'?'即將到期':'Upcoming'))}</span>`:escapeHtml(x.dueDate)}`:''}${x.remindAt?` · 🔔 ${escapeHtml(formatDateTime(x.remindAt))}`:''}</div></div><span class="priority ${escapeAttr(x.priority)}">${priorityLabel(x.priority)}</span><details class="task-row-menu"><summary class="task-row-menu-trigger" aria-label="${escapeAttr(lang()==='zh'?'更多操作：':'More actions: ')}${escapeAttr(x.title)}">${globalThis.IAN_OS_ICON?.('more')||'⋯'}</summary><div class="task-row-menu-panel"><button type="button" class="danger-menu-item" data-task-delete="${escapeAttr(x.id)}" aria-label="${lang()==='zh'?'刪除待辦':'Delete task'}：${escapeAttr(x.title)}">${lang()==='zh'?'刪除':'Delete'}</button></div></details></div>`; }
  // v1.0.4.39: one guidance block per empty group, with the next useful action, instead of a bare placeholder.
  function taskEmptyMarkup(){const zh=lang()==='zh',hints={open:zh?'新增第一項待辦，開始整理工作與生活細節。':'Add your first task to start planning.',today:zh?'今天沒有到期或設定提醒的項目。':'Nothing due or reminding today.',next7:zh?'未來 7 天還沒有安排。':'Nothing scheduled for the next 7 days.',overdue:zh?'沒有逾期項目，進度都在時程內。':'Nothing overdue.',unscheduled:zh?'所有待辦都已經有到期日。':'Every task has a due date.',completed:zh?'完成的項目會出現在這裡。':'Completed tasks appear here.'};return `<div class="task-empty"><strong>${zh?'這裡目前沒有項目':'Nothing here yet'}</strong><span>${hints[taskFilter.active]||hints.open}</span>${taskFilter.active==='completed'?'':`<button type="button" class="secondary-btn compact" data-add="task">＋ ${t('addTask')}</button>`}</div>`;}
  function bindTaskRows(){
    app.querySelectorAll('[data-task-toggle]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation(); const x=state.tasks.find(t=>t.id===b.dataset.taskToggle); if(x){x.status=x.status==='done'?'todo':'done';x.updatedAt=today();saveState();render();}}));
    app.querySelectorAll('[data-task-delete]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const item=state.tasks.find(value=>value.id===b.dataset.taskDelete);if(item)deleteEntity(item);}));
    bindPressable(app.querySelectorAll('[data-task-id]'),function(e){if(e.target.closest('[data-task-toggle],[data-task-delete],.task-row-menu'))return;const x=state.tasks.find(t=>t.id===this.dataset.taskId);if(x){navigation.detailId=x.id;navigation.view='tasks';navigation.query='';searchInput.value='';syncNav();render();}});
  }
    return {renderPage:renderTasksPage,taskRow,bindRows:bindTaskRows,checkReminders};
  }};
})();
