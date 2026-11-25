(() => {
  const {dateKey,localDatePart,monthStart,escapeHtml,renderInlineSafe,escapeAttr}=window.IAN_OS_CONTENT_UTILS;
  const THEME_KEY = 'open-os-public-theme';
  const {safeStorageGet,safeStorageSet,I18N,ui,localizeUI,lang,t}=window.IAN_OS_APP_SHARED;
  const cloneSeed = () => JSON.parse(JSON.stringify(window.IAN_OS_SEED));

  window.IAN_OS_UI={text:ui,localize:localizeUI,lang:()=>lang()};
  const uiObserver=new MutationObserver(records=>{
    const roots=new Set(records.map(record=>record.target).filter(node=>node.nodeType===Node.ELEMENT_NODE));
    for(const root of roots)localizeUI(root);
    syncCurrentPageTitle();
  });
  uiObserver.observe(document.body,{childList:true,subtree:true});

  let state = cloneSeed();
  let currentView = 'home';
  let activeFilter = 'All';
  let taskPlannerFilter = 'open';
  let query = '';
  let selectedSearchTag = null;
  let searchCache=new WeakMap(),searchLimit=40;
  let detailId = null;
  let editingPromptImages = [];
  let calendarCursor = monthStart(new Date());
  let selectedDay = today();
  let communicationFilter = 'All';
  const channelLabel = c => c==='Message' ? (lang()==='zh'?'訊息':'Message') : c;
  let activeGraphId = null;
  let weatherCity = {name:'示範海岸城',latitude:0,longitude:0};
  let weatherResult = null;
  let clockTimer=null,reminderTimer=null,promptUrlTimer=null;
  const expandedTrees = new Set(['projects','calendar']);
  const expandedYears = new Set([String(new Date().getFullYear())]);
  const manualYearExpansion=new Map();
  let sidebarCalendarYear=new Date().getFullYear();
  let calendarSelectionExplicit=false;
  let calendarRolloverTimer;
  const syncCurrentPageTitle=()=>{
    if(!app||!state?.settings)return;
    sidebarModule.syncPageTitle(app,currentView,!detailId&&!query&&!(currentView==='graph'&&activeGraphId));
  };
  const sidebarModule=window.IAN_OS_APP_SIDEBAR.create({getState:()=>state,cloneState,activateDialog,toast,escapeHtml,escapeAttr,onLabelsChanged:syncCurrentPageTitle,navigate:view=>goView(view)});
  const {applyLabels:applySidebarLabels,applyOrder:applySidebarOrder,openOrderEditor:openSidebarOrderEditor,openLabelEditor:openSidebarLabelEditor}=sidebarModule;
  function checkCalendarYear(){
    const now=new Date(),year=now.getFullYear();
    if(year===sidebarCalendarYear)return;
    sidebarCalendarYear=year;expandedYears.clear();expandedYears.add(String(year));
    for(const [key,open] of manualYearExpansion){if(open)expandedYears.add(key);else expandedYears.delete(key);}
    if(calendarSelectionExplicit){expandedYears.add(String(calendarCursor.getFullYear()));}
    else{calendarCursor=monthStart(now);selectedDay=dateKey(now);}
    renderSidebarTree();
    if(currentView==='calendar')render();
  }
  function scheduleCalendarRollover(){
    clearTimeout(calendarRolloverTimer);checkCalendarYear();
    const now=new Date(),midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    calendarRolloverTimer=setTimeout(scheduleCalendarRollover,Math.max(1000,+midnight-+now+100));
  }
  function revealCalendarSelection(){calendarSelectionExplicit=true;expandedYears.add(String(calendarCursor.getFullYear()));renderSidebarTree();}


  const app = document.getElementById('app');
  const sidebar = document.getElementById('sidebar');
  const searchInput = document.getElementById('globalSearch');
  const PWA_ROUTE_KEY = 'open-os-public-pwa-route-v1';
  const PWA_RESTORABLE_VIEWS = new Set(['home','vendors','restaurants','tasks','credit-cards','travel','system-health','calendar','communications','videos','home-assets','projects','settings','routines','automations','graph','notes','prompts','skills','bookmarks']);
  window.IAN_OS_PWA_NAVIGATION = {
    snapshot(){
      return {view:currentView,detailId,query,activeFilter,calendarMonth:`${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth()+1).padStart(2,'0')}`,selectedDay,communicationFilter,activeGraphId};
    },
    restoreAfterAuthentication(owner){
      let saved;
      try{const raw=sessionStorage.getItem(PWA_ROUTE_KEY);if(!raw)return null;sessionStorage.removeItem(PWA_ROUTE_KEY);saved=JSON.parse(raw);}catch{return null;}
      if(saved?.owner!==owner||!Number.isFinite(saved.savedAt)||Date.now()-saved.savedAt>10*60*1000||!saved.route||typeof saved.route!=='object')return null;
      const route=saved.route,categoryView=(state.categories||[]).some(item=>item.name===route.view);
      if(typeof route.view!=='string'||(!PWA_RESTORABLE_VIEWS.has(route.view)&&!categoryView))return null;
      currentView=route.view;
      query=typeof route.query==='string'?route.query.slice(0,300):'';
      searchInput.value=query;selectedSearchTag=null;searchLimit=40;
      activeFilter=typeof route.activeFilter==='string'?route.activeFilter.slice(0,100):'All';
      detailId=typeof route.detailId==='string'&&findItem(route.detailId)&&findItem(route.detailId)?.type!=='bookmark'?route.detailId:null;
      if(typeof route.calendarMonth==='string'&&/^\\d{4}-(0[1-9]|1[0-2])$/.test(route.calendarMonth)){
        const [year,month]=route.calendarMonth.split('-').map(Number);calendarCursor=new Date(year,month-1,1);
      }
      if(typeof route.selectedDay==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(route.selectedDay))selectedDay=route.selectedDay;
      if(typeof route.communicationFilter==='string')communicationFilter=route.communicationFilter.slice(0,100);
      activeGraphId=typeof route.activeGraphId==='string'&&(state.graphSets||[]).some(item=>item.id===route.activeGraphId)?route.activeGraphId:null;
      syncNav();
      return {scrollX:Number.isFinite(saved.scrollX)?Math.max(0,Math.min(saved.scrollX,100000)):0,scrollY:Number.isFinite(saved.scrollY)?Math.max(0,Math.min(saved.scrollY,100000)):0};
    },
    restoreScroll(position){
      if(!position)return;
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({left:position.scrollX,top:position.scrollY,behavior:'instant'})));
    }
  };
  const captureBackdrop = document.getElementById('captureBackdrop');
  const captureForm = document.getElementById('captureForm');
  const promptBackdrop = document.getElementById('promptBackdrop');
  const authGate = document.getElementById('authGate');
  const authForm = document.getElementById('authForm');
  const authSubmit = document.getElementById('authSubmit');
  let authBootstrapComplete=false;
  let signInPending=false;
  let workspaceLoadPromise=null;
  let loadedWorkspaceUserId=null;
  const authMessage = document.getElementById('authMessage');
  const syncStatus = document.getElementById('syncStatus');
  const accountBtn = document.getElementById('accountBtn');
  const accountMenu = document.getElementById('accountMenu');
  const activeDialogs=[];
  let dataConflictDialog=null;
  const dialogOrigins=new WeakMap();
  let dialogBodyOverflow='';
  const dialogFocusable='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const focusSafely=node=>{try{node?.focus({preventScroll:true});}catch{node?.focus();}};

  function activateDialog(overlay){
    if(!overlay||activeDialogs.includes(overlay))return;
    dialogOrigins.set(overlay,document.activeElement);
    if(!activeDialogs.length){dialogBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
    activeDialogs.push(overlay);
    document.querySelector('.app-shell').inert=true;
    const dialog=overlay.querySelector('[role="dialog"]')||overlay;
    const heading=dialog.querySelector('h1,h2');
    if(!dialog.hasAttribute('aria-label')&&!dialog.hasAttribute('aria-labelledby')&&heading){heading.id ||= `dialog-title-${Date.now()}-${activeDialogs.length}`;dialog.setAttribute('aria-labelledby',heading.id);}
    dialog.querySelectorAll('button').forEach(button=>{if(button.textContent.trim()==='×'&&!button.hasAttribute('aria-label'))button.setAttribute('aria-label','關閉');});
    if(!dialog.hasAttribute('tabindex'))dialog.tabIndex=-1;
    requestAnimationFrame(()=>{const target=dialog.querySelector('[autofocus],input:not([type="hidden"]),textarea,select,button');focusSafely(target||dialog);});
  }
  function deactivateDialog(overlay){
    const index=activeDialogs.lastIndexOf(overlay);if(index<0)return;
    activeDialogs.splice(index,1);
    document.querySelector('.app-shell').inert=activeDialogs.length>0;
    if(!activeDialogs.length)document.body.style.overflow=dialogBodyOverflow;
    const origin=dialogOrigins.get(overlay);dialogOrigins.delete(overlay);
    if(origin?.isConnected)requestAnimationFrame(()=>focusSafely(origin));
  }
  document.addEventListener('keydown',e=>{
    if(e.key!=='Tab'||!activeDialogs.length)return;
    const overlay=activeDialogs[activeDialogs.length-1];
    const dialog=overlay.querySelector('[role="dialog"]')||overlay;
    const items=[...dialog.querySelectorAll(dialogFocusable)].filter(el=>!el.hidden&&el.offsetParent!==null);
    if(!items.length){e.preventDefault();dialog.focus();return;}
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  },true);
  new MutationObserver(()=>{
    [...activeDialogs].forEach(overlay=>{if(!overlay.isConnected||overlay.hidden)deactivateDialog(overlay);});
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  window.IAN_OS_DIALOG={activate:activateDialog,deactivate:deactivateDialog};
  function showDataConflict(){
    if(dataConflictDialog?.isConnected)return;
    const zh=lang()==='zh';
    const overlay=document.createElement('div');overlay.className='modal-backdrop';overlay.dataset.dataConflict='true';
    overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="dataConflictTitle"><div class="modal-header"><div><div class="eyebrow">${zh?'同步保護':'SAVE PROTECTION'}</div><h2 id="dataConflictTitle">${zh?'資料已在其他裝置更新':'Data changed elsewhere'}</h2></div></div><p>${zh?'資料已在其他裝置更新。為避免覆蓋較新的資料，請重新載入最新版本。':'This data was updated on another device. Reload the latest version before saving to avoid overwriting newer changes.'}</p><div class="modal-actions"><button type="button" class="secondary-btn" data-conflict-keep>${zh?'留在此頁':'Keep working here'}</button><button type="button" class="primary-btn" data-conflict-reload>${zh?'重新載入最新版本':'Reload Latest'}</button></div></section>`;
    document.body.appendChild(overlay);dataConflictDialog=overlay;activateDialog(overlay);
    overlay.querySelector('[data-conflict-keep]').onclick=()=>{deactivateDialog(overlay);overlay.remove();dataConflictDialog=null;};
    overlay.querySelector('[data-conflict-reload]').onclick=()=>window.location.reload();
  }

  function bindPressable(elements,handler){
    elements.forEach(element=>{
      element.tabIndex=0;element.setAttribute('role','button');
      element.addEventListener('click',handler);
      element.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button,a,input,select,textarea,summary')){event.preventDefault();handler.call(element,event);}});
    });
  }

  const planning=window.IAN_OS_PLANNING.create({state:()=>state,save:()=>saveState(),toast,escape:escapeHtml,removePreference:options=>deletePreferenceRecord(options),removeOwned:options=>deleteOwnedRecord(options)});
  const restaurantsModule=window.IAN_OS_RESTAURANTS.create({
    app,cloud:window.IAN_OS_CLOUD,toast,dialog:activateDialog,isActive:()=>currentView==='restaurants',
    getCuisines:()=>Array.isArray(state.settings.preferences?.restaurantCuisines)?[...state.settings.preferences.restaurantCuisines]:[],
    getCuisineOrder:()=>state.settings.preferences?.restaurantCuisineOrder||[],
    saveCuisines:async (values,order)=>{
      const owner=window.IAN_OS_CLOUD.user()?.id;
      if(!owner)throw new Error('Sign in required');
      await window.IAN_OS_CLOUD.flushSave();
      if(window.IAN_OS_CLOUD.user()?.id!==owner)throw new Error('Session changed');
      const next=cloneState();next.settings.preferences ||= {};
      next.settings.preferences.restaurantCuisines=[...values];
      if(Array.isArray(order))next.settings.preferences.restaurantCuisineOrder=[...order];
      await window.IAN_OS_CLOUD.savePreferences(next);
      if(window.IAN_OS_CLOUD.user()?.id!==owner)throw new Error('Session changed');
      state.settings.preferences.restaurantCuisines=[...values];
      if(Array.isArray(order))state.settings.preferences.restaurantCuisineOrder=[...order];
    }
  });
  const vendorsModule=window.IAN_OS_VENDORS.create({app,state:()=>state,save:()=>saveState(),uuid:()=>window.IAN_OS_CLOUD.uuid(),lang,toast,removeOwned:deleteOwnedRecord});
  const calendarViewState={get cursor(){return calendarCursor;},set cursor(value){calendarCursor=value;},get selectedDay(){return selectedDay;},set selectedDay(value){selectedDay=value;}};
  const navigationViewState={get view(){return currentView;},set view(value){currentView=value;},get detailId(){return detailId;},set detailId(value){detailId=value;},get query(){return query;},set query(value){query=value;}};
  const categoryFilterState={get active(){return activeFilter;},set active(value){activeFilter=value;}};
  const taskFilterState={get active(){return taskPlannerFilter;},set active(value){taskPlannerFilter=value;}};
  const tasksModule=window.IAN_OS_APP_TASKS.create({
    getState:()=>state,app,navigation:navigationViewState,taskFilter:taskFilterState,searchInput,
    lang,ui,t,escapeHtml,escapeAttr,filterCategory,categoryFilters,taskSort,sectionHead,emptyInline,
    bindDynamicActions,bindCategoryFilters,bindPressable,saveState,render,deleteEntity,openCapture,tagHtml,
    formatDateTime,priorityLabel,statusLabel,today,localDatePart,addISODateDays,safeStorageGet,safeStorageSet,toast,planning,syncNav
  });
  const {taskRow,bindRows:bindTaskRows}=tasksModule;
  const calendarModule=window.IAN_OS_APP_CALENDAR.create({
    getState:()=>state,app,calendar:calendarViewState,navigation:navigationViewState,filters:categoryFilterState,searchInput,
    lang,ui,t,escapeHtml,escapeAttr,filterCategory,categoryIcon,creditDay,priorityLabel,statusLabel,channelLabel,taskSort,eventRow,taskRow,commRow,
    bindDynamicActions,bindTaskRows,bindCommRows,bindCategoryFilters,openActivity,openCapture,render,syncNav,renderSidebarTree,revealCalendarSelection,showCreditCard,planning,importICS,
    today,localDatePart,dateKey,addISODateDays,shiftISODateMonth,monthStart,formatDateFromISO,formatTime,formatDateTime,sectionHead,emptyInline,
    calendarDaysUntil,travelCountdownLabel,travelPreferences,upcomingTravelCountdowns
  });
  const {eventOnDay,calendarAllDayLabel}=calendarModule;
  initTheme();
  bindShell();
  window.IAN_OS_GLOBAL_SEARCH.mount({
    getData:()=>({...state,restaurants:restaurantsModule.loadedRecords(),trips:state.settings.preferences?.trips||[],vendors:(state.vendors||[]).map(v=>({...v,categoryNames:(v.categoryIds||[]).map(id=>state.vendorCategories.find(c=>c.id===id)?.name||'')}))}),
    owner:()=>window.IAN_OS_CLOUD.user()?.id,
    activate:activateDialog,deactivate:deactivateDialog,
    open:(key,item)=>{
      query='';selectedSearchTag=null;searchInput.value='';detailId=null;
      const view={events:'calendar',creditCards:'credit-cards',trips:'travel'}[key]||key;
      currentView=view;syncNav();renderSidebarTree();
      if(key==='creditCards'){render();showCreditCard((state.creditCards||[]).find(x=>x.id===item.id));}
      else if(key==='trips'){render();planning.openTrip(item.id);}
      else if(key==='restaurants'){render();restaurantsModule.openRecord(item.id);}
      else if(key==='vendors'){render();vendorsModule.openRecord(item.id);}
      else if(key==='projects'){renderProjectDetail(item.id);}
      else if(key==='prompts'){render();openPrompt(item.id);}
      else if(key==='videos'){render();openVideo(item.id);}
      else if(['tasks','events','communications'].includes(key)){openActivity(item);}
      else{detailId=item.id;render();}
    }
  });
  bindCloudShell();
  window.addEventListener('ian-attachment-error',event=>toast(event.detail||ui('圖片讀取失敗')));
  bootstrap();
  if(!authGate.hidden)activateDialog(authGate);

  function normalizeState(s) {
    const seed = cloneSeed();
    ['categories','notes','prompts','skills','videos','bookmarks','projects','graphSets','tasks','events','communications','workflows','creditCards','vendors','vendorCategories'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
    s.prompts = s.prompts.map(p => ({...p, styleImages:(Array.isArray(p.styleImages) ? p.styleImages : []).map(normalizeImage)}));
    s.settings = {...seed.settings, ...(s.settings || {})};
    const checklistMap=s.settings.preferences?.itemChecklists||{};
    for(const key of ['notes','prompts','skills','videos','bookmarks','tasks','events','communications'])for(const item of s[key]){item.checklist=window.IAN_OS_PLANNING.checks(checklistMap[item.id]||item.checklist);item.attachments=Array.isArray(item.attachments)?item.attachments:[];}
    const eventCompletion=s.settings.preferences?.calendarEventCompletion||{};
    for(const item of s.events)item.completed=!!eventCompletion[item.id]||!!item.completed;
    return s;
  }
  function saveState() { searchCache=new WeakMap();state.settings.preferences ||= {};state.settings.preferences.itemChecklists=Object.fromEntries(allGraphItems().filter(x=>x.checklist?.length).map(x=>[x.id,window.IAN_OS_PLANNING.checks(x.checklist)]));state.settings.preferences.calendarEventCompletion=Object.fromEntries(state.events.filter(item=>item.completed).map(item=>[item.id,true]));window.IAN_OS_CLOUD?.queueSave(state); renderSidebarTree(); }

  const deleteTable={note:'content_items',prompt:'content_items',skill:'content_items',video:'content_items',bookmark:'content_items',task:'tasks',event:'calendar_events',communication:'communications',project:'projects'};
  function cloneState(){return JSON.parse(JSON.stringify(state));}
  function relationIdsFor(id){return (state.graphSets||[]).flatMap(graph=>(graph.relations||[]).filter(relation=>relation.from===id||relation.to===id).map(relation=>relation.id));}
  function removeRelations(next,ids){const targets=new Set(ids);for(const graph of next.graphSets||[])graph.relations=(graph.relations||[]).filter(relation=>!targets.has(relation.id));}
  function deleteMessage(label){return lang()==='zh'?`已刪除${label}`:`${label} deleted`;}
  async function deleteEntity(item,{close,after}={}){
    if(!item||!deleteTable[item.type])return false;
    const collection=collectionForType(item.type)||'projects';
    const relations=relationIdsFor(item.id);
    const checklist=state.settings.preferences?.itemChecklists?.[item.id];
    const promptPaths=item.type==='prompt'?(item.styleImages||[]).map(image=>image.storage_path).filter(Boolean):[];
    const label=lang()==='zh'?({note:'筆記',prompt:'Prompt',skill:'Skill',video:'影音',bookmark:'書籤',task:'待辦',event:'行程',communication:'訊息紀錄',project:'專案'})[item.type]||'資料':({note:'Note',prompt:'Prompt',skill:'Skill',video:'Video note',bookmark:'Bookmark',task:'Task',event:'Calendar event',communication:'Message record',project:'Project'})[item.type]||'Item';
    const children=item.type==='project'?(item.entries||[]).length:0;
    const message=children||relations.length?(lang()==='zh'?`此操作會一併刪除 ${children} 筆 Daily Logs${relations.length?` 與 ${relations.length} 筆關聯`:''}，且無法復原。`:`This also deletes ${children} Daily Log${children===1?'':'s'}${relations.length?` and ${relations.length} graph relation${relations.length===1?'':'s'}`:''}. This action cannot be undone.`):undefined;
    const removed=await window.IAN_OS_DELETE.run({name:item.title||item.subject,message,action:async()=>{
      for(const relationId of relations)await window.IAN_OS_CLOUD.deleteRecord('graph_relations',relationId);
      await window.IAN_OS_CLOUD.deleteRecord(deleteTable[item.type],item.id);
    }});
    if(!removed)return false;
    state[collection]=state[collection].filter(value=>value.id!==item.id);
    removeRelations(state,relations);
    if(checklist&&state.settings.preferences?.itemChecklists)delete state.settings.preferences.itemChecklists[item.id];
    if(item.type==='event'&&state.settings.preferences?.calendarEventCompletion){delete state.settings.preferences.calendarEventCompletion[item.id];saveState();}
    if(promptPaths.length)window.IAN_OS_CLOUD.deletePrivatePaths(promptPaths).catch(()=>toast(lang()==='zh'?'資料已刪除；部分圖片清理將於稍後重試。':'Item deleted; some image cleanup will need another attempt.'));
    if(item.attachments?.length)window.IAN_OS_CLOUD.deleteAttachmentsForEntity(item.type,item.id,item.attachments).catch(()=>toast(lang()==='zh'?'資料已刪除；部分附件清理將於稍後重試。':'Item deleted; some attachment cleanup will need another attempt.'));
    searchCache=new WeakMap();detailId=null;close?.();renderSidebarTree();after?.();render();toast(deleteMessage(label));return true;
  }
  async function deletePreferenceRecord({name,message,mutate,success,close,after}){
    const next=normalizeState(cloneState());mutate(next);
    const removed=await window.IAN_OS_DELETE.run({name,message,action:()=>window.IAN_OS_CLOUD.savePreferences(next)});
    if(!removed)return false;
    state=next;searchCache=new WeakMap();close?.();renderSidebarTree();after?.();render();toast(success);return true;
  }
  async function deleteOwnedRecord({table,id,name,message,mutate,success,close,after}){
    const removed=await window.IAN_OS_DELETE.run({name,message,action:()=>table==='categories'?window.IAN_OS_CLOUD.deleteCategory(id):window.IAN_OS_CLOUD.deleteRecord(table,id)});
    if(!removed)return false;
    mutate?.(state);searchCache=new WeakMap();close?.();renderSidebarTree();after?.();render();toast(success);return true;
  }

  async function bootstrap(){
    authSubmit.disabled=true;
    if(!window.IAN_OS_CLOUD?.configured()){
      authMessage.textContent=ui('展示資料尚未準備完成。');
      syncStatus.dataset.state='offline';syncStatus.textContent='SETUP';
      authBootstrapComplete=true;authSubmit.disabled=false;return;
    }
    try{
      window.IAN_OS_CLOUD.init();
      window.IAN_OS_CLOUD.onAuthChange((sessionValue,event)=>{
        if(event==='SIGNED_OUT'&&authGate.hidden){
          // A transient cross-tab auth broadcast must not immediately destroy the active view.
          // Verify the actual session first; never bypass authentication if it is gone.
          Promise.resolve().then(()=>window.IAN_OS_CLOUD.session()).then(active=>{
            if(!active && authGate.hidden)showAuth();
          }).catch(error=>console.warn('[OPEN OS] Session recheck failed',error));
        }
      });
      window.IAN_OS_CLOUD.onStatus(({state:status,message})=>{
        syncStatus.dataset.state=status;
        syncStatus.textContent=({saved:'LOCAL',syncing:'SAVING',pending:'PENDING',error:'ERROR',conflict:'CONFLICT'})[status]||'LOCAL';
        if(status==='conflict')showDataConflict();
        syncStatus.title=message||'';
        if(currentView==='system-health'&&authGate.hidden)renderSystemHealth();
      });
    }catch(error){
      authBootstrapComplete=true;authSubmit.disabled=false;
      logAuthDiagnostic('client-initialization',error);
      showAuth(ui('無法開啟本機展示資料，請稍後再試。'));return;
    }
    let activeSession=null;
    try{activeSession=await window.IAN_OS_CLOUD.session();}
    catch(error){
      logAuthDiagnostic('session-restoration',error);
      authBootstrapComplete=true;authSubmit.disabled=false;
      showAuth(ui('無法確認登入狀態，請重新登入。'));return;
    }
    authBootstrapComplete=true;authSubmit.disabled=false;
    if(activeSession){
      try{await enterCloudApp(activeSession.user);}
      catch(error){showWorkspaceLoadError(activeSession.user,error,'workspace-initialization-after-session-restoration');}
    }else showAuth();
  }

  async function enterCloudApp(user){
    if(!user?.id)return false;
    if(loadedWorkspaceUserId===user.id)return true;
    if(workspaceLoadPromise)return workspaceLoadPromise;
    const load=async()=>{
      authMessage.textContent='';
      authGate.hidden=true;deactivateDialog(authGate);
      accountBtn.hidden=false;
      accountBtn.dataset.initial=(user.email||'I').slice(0,1);
      accountBtn.textContent=accountBtn.dataset.initial;
      document.getElementById('accountEmail').textContent='展示使用者 · 本機資料';
      app.innerHTML=`<section class="panel loading-state" role="status">${ui('正在載入你的工作空間…')}</section>`;
      document.querySelector('.app-shell').inert=true;
      let pwaRouteScroll=null;
      try {
        const loadedState=await window.IAN_OS_CLOUD.loadState(state);
        if(window.IAN_OS_CLOUD.user()?.id!==user.id)return false;
        state=normalizeState(loadedState);
        // A browser may discard an inactive tab. Restore the restaurant view for this user only.
        try{if(sessionStorage.getItem('open-os-public-active-restaurant-view')===user.id)currentView='restaurants';}catch{}
        pwaRouteScroll=window.IAN_OS_PWA_NAVIGATION.restoreAfterAuthentication(user.id);
      } catch(error) {
        showWorkspaceLoadError(user,error,'workspace-data-load-after-authentication');
        return false;
      } finally {
        document.querySelector('.app-shell').inert=false;
      }
      try{
        loadedWorkspaceUserId=user.id;
        weatherCity = state.settings.preferences?.weatherCity || weatherCity;
        updateAccountAvatar();
        applyStaticI18n();renderSidebarTree();render();
        window.IAN_OS_PWA_NAVIGATION.restoreScroll(pwaRouteScroll);
        window.IAN_OS_NOTIFICATIONS?.start();
        refreshWeather();
      clearInterval(clockTimer);clearInterval(reminderTimer);
      clockTimer=setInterval(tickClocks,30000);
      reminderTimer=setInterval(tasksModule.checkReminders,60000);
      clearInterval(promptUrlTimer);
      promptUrlTimer=setInterval(()=>window.IAN_OS_CLOUD.refreshPromptUrls(state.prompts).then(()=>{
        if(!promptBackdrop.hidden && activePromptId)openPrompt(activePromptId);
        else if(detailId)render();
      }).catch(()=>{}),240000);
      tasksModule.checkReminders();
        return true;
      }catch(error){loadedWorkspaceUserId=null;showWorkspaceLoadError(user,error,'workspace-ui-initialization-after-authentication');return false;}
    };
    const pending=load();workspaceLoadPromise=pending;
    try{return await pending;}finally{if(workspaceLoadPromise===pending)workspaceLoadPromise=null;}
  }

  function logAuthDiagnostic(stage,error){
    console.error('[OPEN OS auth]',stage,{name:error?.name||'Error',message:String(error?.message||'').slice(0,180),code:error?.code||error?.status||'',status:error?.status||''});
  }

  function showWorkspaceLoadError(user,error,stage='workspace-load-after-authentication'){
    logAuthDiagnostic(stage,error);
    document.querySelector('.app-shell').inert=false;
    syncStatus.dataset.state='error';syncStatus.textContent='ERROR';
    const retryLabel=lang()==='zh'?'重試載入':'Retry loading';
    const signOutLabel=lang()==='zh'?'登出':'Sign out';
    app.innerHTML=`<section class="panel workspace-load-error" role="alert"><h2>${ui('已登入，但工作區載入失敗。')}</h2><p>${ui('請檢查網路連線後重試；你的登入狀態仍已保留。')}</p><div class="modal-actions"><button type="button" class="secondary-btn" id="workspaceSignOut">${signOutLabel}</button><button type="button" class="primary-btn" id="workspaceRetry">${retryLabel}</button></div></section>`;
    document.getElementById('workspaceRetry').addEventListener('click',()=>enterCloudApp(user));
    document.getElementById('workspaceSignOut').addEventListener('click',async()=>{try{await window.IAN_OS_CLOUD.signOut();loadedWorkspaceUserId=null;showAuth();}catch(signOutError){toast(ui('登出失敗，請稍後再試。'));logAuthDiagnostic('sign-out-after-workspace-load-failure',signOutError);}});
  }

  function showAuth(message=''){
    loadedWorkspaceUserId=null;
    try{sessionStorage.removeItem('open-os-public-active-restaurant-view');sessionStorage.removeItem(PWA_ROUTE_KEY);}catch{}
    window.IAN_OS_HOME_QUICK_LINKS?.closeEditor();
    window.IAN_OS_HOME_ASSETS?.reset();
    vendorsModule.reset();
    window.IAN_OS_HOME_LAYOUT.reset();
    window.IAN_OS_NOTIFICATIONS?.stop();
    document.querySelector('.topbar-actions .home-layout-toolbar')?.remove();
    clearInterval(clockTimer);clearInterval(reminderTimer);clearInterval(promptUrlTimer);
    for(const view of Object.keys(knowledgeBrowse))delete knowledgeBrowse[view];
    state=normalizeState(cloneSeed());app.innerHTML='';
    document.getElementById('promptDetailContent').innerHTML='';
    document.getElementById('imageViewerContent').innerHTML='';
    document.getElementById('videoDetailContent').innerHTML='';
    promptBackdrop.hidden=true;document.getElementById('imageBackdrop').hidden=true;
    document.getElementById('videoBackdrop').hidden=true;captureBackdrop.hidden=true;window.IAN_OS_ATTACHMENTS?.close();
    document.getElementById('authPassword').value='';
    authGate.hidden=false;activateDialog(authGate);accountBtn.hidden=true;accountMenu.hidden=true;
    accountBtn.replaceChildren();accountBtn.style.backgroundImage='';
    if(authBootstrapComplete)authSubmit.disabled=false;
    if(message)authMessage.textContent=message;
  }

  function bindCloudShell(){
    authSubmit.disabled=true;
    authForm.addEventListener('submit',async e=>{
      e.preventDefault();
      if(signInPending||!authBootstrapComplete)return;
      signInPending=true;authSubmit.disabled=true;authMessage.textContent=ui('登入中…');
      let result;
      try{
        result=await window.IAN_OS_CLOUD.signIn(document.getElementById('authEmail').value.trim(),document.getElementById('authPassword').value);
      }catch(error){
        logAuthDiagnostic('password-sign-in-request',error);
        authMessage.textContent=authError(error);
        signInPending=false;authSubmit.disabled=false;return;
      }
      document.getElementById('authPassword').value='';
      try{await enterCloudApp(result.user);}
      catch(error){showWorkspaceLoadError(result.user,error,'workspace-initialization-after-password-sign-in');}
      finally{signInPending=false;authSubmit.disabled=false;}
    });
    accountBtn.addEventListener('click',()=>{accountMenu.hidden=!accountMenu.hidden});
    const avatarFile=document.getElementById('avatarFile');
    const avatarUpload=document.getElementById('avatarUploadBtn');
    const avatarRemove=document.getElementById('avatarRemoveBtn');
    const avatarError=document.getElementById('avatarError');
    avatarUpload.addEventListener('click',()=>avatarFile.click());
    avatarFile.addEventListener('change',async()=>{
      const file=avatarFile.files?.[0];avatarFile.value='';if(!file)return;
      avatarError.hidden=true;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){avatarError.textContent='請選擇 10 MB 以下的 JPG、PNG 或 WebP 圖片。';avatarError.hidden=false;return;}
      avatarUpload.disabled=true;
      try{
        const data=await resizeAccountAvatar(file);
        const next=cloneState();next.settings.preferences ||= {};next.settings.preferences.accountAvatar=data;
        await window.IAN_OS_CLOUD.savePreferences(next);
        state.settings.preferences=next.settings.preferences;updateAccountAvatar();toast('頭像已更新');
      }catch(error){avatarError.textContent='頭像儲存失敗，請稍後重試。';avatarError.hidden=false;}
      finally{avatarUpload.disabled=false;}
    });
    avatarRemove.addEventListener('click',async()=>{
      avatarError.hidden=true;avatarRemove.disabled=true;
      try{
        const next=cloneState();next.settings.preferences ||= {};delete next.settings.preferences.accountAvatar;
        await window.IAN_OS_CLOUD.savePreferences(next);
        state.settings.preferences=next.settings.preferences;updateAccountAvatar();toast('頭像已移除');
      }catch(error){avatarError.textContent='移除失敗，請稍後重試。';avatarError.hidden=false;}
      finally{avatarRemove.disabled=false;}
    });
    document.getElementById('signOutBtn').addEventListener('click',async()=>{try{await window.IAN_OS_CLOUD.signOut();showAuth();}catch(error){toast(ui('登出前同步失敗：')+error.message);}});
  }

  function updateAccountAvatar(){
    const value=state.settings.preferences?.accountAvatar;
    const valid=typeof value==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)&&value.length<100000;
    accountBtn.textContent=valid?'':(accountBtn.dataset.initial||'I');
    accountBtn.style.backgroundImage=valid?`url("${value}")`:'';
    document.getElementById('avatarRemoveBtn').hidden=!valid;
  }

  async function resizeAccountAvatar(file){
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.src=url;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
      const side=Math.min(img.naturalWidth,img.naturalHeight);
      if(!side)throw new Error('Invalid image');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,160,160);
      ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,160,160);
      const data=canvas.toDataURL('image/jpeg',0.78);
      if(data.length>100000)throw new Error('Avatar too large');
      return data;
    }finally{URL.revokeObjectURL(url);}
  }

  function authError(error){
    const value=(error?.message||'').toLowerCase();
    if(value.includes('invalid login'))return ui('Email 或密碼不正確。');
    if(value.includes('email not confirmed'))return ui('請先完成 Email 驗證。');
    if(error?.status===0||value.includes('failed to fetch')||value.includes('network')||value.includes('load failed'))return ui('網路連線失敗，請檢查連線後再試。');
    return ui('登入失敗，請檢查帳號或稍後重試。');
  }

  function applyStaticI18n() {
    document.documentElement.lang = 'zh-TW';
    document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.dataset.i18n; if (I18N[lang()][key]) el.textContent = I18N[lang()][key]; });
    searchInput.placeholder = t('search');
    for(const [id,zh,en]of [['addBtn','新增','Add'],['sidebarClose','關閉側邊欄','Close sidebar'],['menuBtn','開啟側邊欄','Open sidebar'],['themeBtn','切換主題','Toggle theme'],['accountBtn','帳號','Account'],['captureClose','關閉','Close'],['promptClose','關閉 Prompt 詳細內容','Close Prompt detail'],['imageClose','關閉圖片檢視器','Close image viewer'],['videoClose','關閉影音詳細內容','Close video detail']]){const node=document.getElementById(id);if(node){node.setAttribute('data-ui-original-aria-label',zh);node.setAttribute('aria-label',lang()==='zh'?zh:en);}}
    localizeUI(document);
    window.IAN_OS_EDITOR?.localize?.();
    applySidebarLabels();
  }

  function bindShell() {
    document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', e => { if(e.target.closest('.tree-chevron'))return; goView(btn.dataset.view); }));
    document.getElementById('menuBtn').addEventListener('click', () => sidebar.classList.add('open'));
    document.getElementById('sidebarClose').addEventListener('click', () => sidebar.classList.remove('open'));
    document.getElementById('addBtn').addEventListener('click', () => openCapture('note'));
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('resetBtn').addEventListener('click', resetData);
    sidebar.addEventListener('click', handleSidebarAction);
    scheduleCalendarRollover();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleCalendarRollover();});
    window.addEventListener('pageshow',scheduleCalendarRollover);

    document.getElementById('captureClose').addEventListener('click', closeCapture);
    document.getElementById('captureCancel').addEventListener('click', closeCapture);
    // Background clicks never discard an editing session.
    document.getElementById('captureType').addEventListener('change', updateCaptureFields);
    captureForm.addEventListener('submit', saveCapture);
    document.getElementById('taskDueMode').addEventListener('change',updateCaptureFields);
    document.getElementById('promptImageUpload').addEventListener('change', async e => {
      const files = [...e.target.files].slice(0, 8);
      for (const file of files) {
        try { editingPromptImages.push(await readImageMeta(file)); }
        catch { toast(ui('圖片讀取失敗')); }
      }
      editingPromptImages = editingPromptImages.slice(0, 10);
      renderStyleEditor();
    });

    document.getElementById('promptClose').addEventListener('click', closePrompt);
    promptBackdrop.addEventListener('click', e => { if (e.target === promptBackdrop) closePrompt(); });
    document.getElementById('imageClose').addEventListener('click', closeImageViewer);
    document.getElementById('imageBackdrop').addEventListener('click',e=>{if(e.target.id==='imageBackdrop')closeImageViewer();});
    document.getElementById('videoClose').addEventListener('click', closeVideo);
    document.getElementById('videoBackdrop').addEventListener('click',e=>{if(e.target.id==='videoBackdrop')closeVideo();});
    window.IAN_OS_EDITOR.init();
    document.getElementById('categoryAddBtn').addEventListener('click',()=>window.IAN_OS_EDITOR.category({categories:state.categories,toast,save:value=>{state.categories.push({id:window.IAN_OS_CLOUD.uuid(),...value});saveState();refreshCategorySelect(value.name);toast(ui('分類已新增'));}}));
    document.getElementById('cancelCategoryBtn').addEventListener('click',()=>document.getElementById('newCategoryRow').hidden=true);
    document.getElementById('saveCategoryBtn').addEventListener('click',saveNewCategory);

    window.IAN_OS_INPUT.attach(document.getElementById('captureTags'),()=>allGraphItems().flatMap(x=>x.tags||[]));
    window.IAN_OS_INPUT.bindSearch(searchInput,value=>{const wasTagSearch=selectedSearchTag!==null;selectedSearchTag=null;if(value===query&&!wasTagSearch)return;query=value;searchLimit=40;detailId=null;render();});
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); searchInput.focus(); }
      if (e.key === 'Escape' && !e.isComposing) { if (!document.getElementById('imageBackdrop').hidden) { closeImageViewer(); return; } if (!captureBackdrop.hidden) { closeCapture(); return; } if (!document.getElementById('videoBackdrop').hidden) { closeVideo(); return; } closePrompt(); if (detailId) { detailId = null; render(); } }
    });
  }

  function handleSidebarAction(e){
    const toggle=e.target.closest('[data-tree-toggle]');
    if(toggle){e.preventDefault();e.stopPropagation();const key=toggle.dataset.treeToggle;expandedTrees.has(key)?expandedTrees.delete(key):expandedTrees.add(key);renderSidebarTree();return;}
    const year=e.target.closest('[data-calendar-year]');
    if(year){const y=year.dataset.calendarYear,open=!expandedYears.has(y);manualYearExpansion.set(y,open);open?expandedYears.add(y):expandedYears.delete(y);renderSidebarTree();return;}
    const month=e.target.closest('[data-calendar-month]');
    if(month){const [y,m]=month.dataset.calendarMonth.split('-').map(Number);calendarCursor=new Date(y,m-1,1);selectedDay=dateKey(calendarCursor);currentView='calendar';revealCalendarSelection();syncNav();sidebar.classList.remove('open');render();return;}
    const project=e.target.closest('[data-tree-project]');if(project){sidebar.classList.remove('open');renderProjectDetail(project.dataset.treeProject);return;}
    const channel=e.target.closest('[data-comm-channel]');if(channel){communicationFilter=channel.dataset.commChannel;currentView='communications';syncNav();sidebar.classList.remove('open');render();return;}
    const graph=e.target.closest('[data-tree-graph]');if(graph){activeGraphId=graph.dataset.treeGraph;currentView='graph';syncNav();sidebar.classList.remove('open');render();return;}
    if(e.target.closest('[data-new-project]')){openProjectEditor();return;}
    if(e.target.closest('[data-new-graph]')){openGraphEditor();return;}
  }

  function renderSidebarTree(){
    if(!sidebar||!state)return;
    document.querySelectorAll('.nav-tree').forEach(tree=>{const key=tree.dataset.tree;tree.classList.toggle('expanded',expandedTrees.has(key));const chevron=tree.querySelector('.tree-chevron');if(chevron)chevron.dataset.treeToggle=key;});
    const p=document.getElementById('projectTree');if(p)p.innerHTML=`${(state.projects||[]).map(x=>`<button class="tree-item" data-tree-project="${escapeAttr(x.id)}"><span class="tree-dot"></span><b>${escapeHtml(x.title)}</b><small>${escapeHtml(currentProjectVersion(x))}</small></button>`).join('')}<button class="tree-add" data-new-project>＋ ${lang()==='zh'?'新增專案':'New project'}</button>`;
    applySidebarLabels();applySidebarOrder();
    const yearOf=value=>{const match=String(value||'').match(/^(\d{4})-/);return match?Number(match[1]):null;};
    const years=[...new Set([new Date().getFullYear(),calendarCursor.getFullYear(),...expandedYears].map(Number).concat(state.events.flatMap(x=>[yearOf(localDatePart(x.start)),yearOf(localDatePart(x.end))]),state.tasks.flatMap(x=>[yearOf(x.dueDate),yearOf(localDatePart(x.remindAt))]),state.communications.map(x=>yearOf(localDatePart(x.dateTime)))) )].filter(y=>Number.isInteger(y)&&y>0&&y<=9999).sort((a,b)=>b-a);
    const c=document.getElementById('calendarTree');const activeMonth=`${calendarCursor.getFullYear()}-${calendarCursor.getMonth()+1}`;if(c)c.innerHTML=years.map(y=>`<div class="tree-year ${expandedYears.has(String(y))?'open':''}"><button class="tree-item tree-year-button" data-calendar-year="${y}" aria-expanded="${expandedYears.has(String(y))}"><span>▸</span><b>${y}</b></button><div class="tree-months">${Array.from({length:12},(_,i)=>{const key=`${y}-${i+1}`;return `<button class="tree-item tree-month ${key===activeMonth?'current-month':''}" data-calendar-month="${key}">${String(i+1).padStart(2,'0')} ${lang()==='zh'?'月':new Intl.DateTimeFormat('en',{month:'short'}).format(new Date(y,i,1))}</button>`}).join('')}</div></div>`).join('');
    const channels=['All',...new Set(['Email','Message',...state.communications.map(x=>x.channel).filter(Boolean)])];const cm=document.getElementById('communicationTree');if(cm)cm.innerHTML=channels.map(x=>`<button class="tree-item ${communicationFilter===x?'selected':''}" data-comm-channel="${escapeAttr(x)}"><span class="tree-dot"></span><b>${escapeHtml(x==='All'?(lang()==='zh'?'全部管道':'All channels'):channelLabel(x))}</b><small>${x==='All'?state.communications.length:state.communications.filter(c=>c.channel===x).length}</small></button>`).join('');
    const g=document.getElementById('graphTree');if(g)g.innerHTML=`${(state.graphSets||[]).map(x=>`<button class="tree-item ${activeGraphId===x.id?'selected':''}" data-tree-graph="${escapeAttr(x.id)}"><span class="tree-dot"></span><b>${escapeHtml(x.title)}</b><small>${(x.relations||[]).length}</small></button>`).join('')}<button class="tree-add" data-new-graph>＋ ${lang()==='zh'?'新增圖譜':'New graph'}</button>`;
  }

  function goView(view) {
    if(currentView==='restaurants')restaurantsModule.rememberPosition();
    try{if(view==='restaurants')sessionStorage.setItem('open-os-public-active-restaurant-view',window.IAN_OS_CLOUD.user()?.id||'');else sessionStorage.removeItem('open-os-public-active-restaurant-view');}catch{}
    closeVideo();
    currentView = view; detailId = null; query = ''; selectedSearchTag = null; searchInput.value = ''; activeFilter = 'All'; if(view==='communications')communicationFilter='All'; if(['projects','calendar','communications','graph'].includes(view))expandedTrees.add(view); sidebar.classList.remove('open'); syncNav(); renderSidebarTree(); render();
  }
  function syncNav() { document.querySelectorAll('.nav-item[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === currentView)); }

  let lastRenderedScreen = '';
  function render() {
    const screen = `${currentView}|${detailId||''}|${query||''}`;
    const sameScreen = screen===lastRenderedScreen;
    lastRenderedScreen=screen;
    return window.IAN_OS_SCROLL ? window.IAN_OS_SCROLL.keep(renderCurrentScreen,sameScreen) : renderCurrentScreen();
  }
  function renderCurrentScreen() {
    document.querySelector('.topbar-actions .home-layout-toolbar')?.remove();
    applyStaticI18n();
    if(detailId && ['event','communication'].includes(findItem(detailId)?.type))return renderActivityPreview(findItem(detailId));
    if (detailId && currentView === 'tasks') return tasksModule.renderPage();
    if (detailId && findItem(detailId)?.type==='bookmark') detailId=null;
    if (detailId) return renderDetail(detailId);
    if (query) return renderSearch();
    if (currentView === 'home') return renderHome();
    if (currentView === 'vendors') return vendorsModule.render();
    if (currentView === 'restaurants') return restaurantsModule.render();
    if (currentView === 'tasks') return tasksModule.renderPage();
    if (currentView === 'credit-cards') return renderCreditCards();
    if (currentView === 'travel') return planning.renderTravel();
    if (currentView === 'system-health') return renderSystemHealth();
    if (currentView === 'calendar') return calendarModule.renderPage();
    if (currentView === 'communications') return renderCommunicationsPage();
    if (currentView === 'videos') return renderVideos();
    if (currentView === 'home-assets') return renderHomeAssets();
    if (currentView === 'projects') return renderProjects();
    if (currentView === 'settings') return renderSettings();
    if (currentView === 'routines') return planning.renderRoutines();
    if (currentView === 'automations') return window.IAN_OS_AUTOMATION.render({timezone:state.settings.timezone,summaries:planning.summaryRules,creditCards:state.creditCards,trips:state.settings.preferences?.trips,workboard:{getState:()=>state,saveTopics:list=>{state.settings.preferences ||= {};state.settings.preferences.topicResearch=list;saveState();},onOpen:(kind,item)=>{if(kind==='task'){currentView='tasks';detailId=item.id;query='';searchInput.value='';syncNav();render();}else if(kind==='communication'){currentView='communications';openActivity(item);}else if(kind==='rule'){document.querySelector('[data-auto="'+CSS.escape(item.id)+'"]')?.scrollIntoView({block:'center'});}else if(kind==='notice'){document.querySelector('[data-notification-center]')?.scrollIntoView({block:'start'});}}}});
    if (currentView === 'graph') return renderGraph();
    return renderLibrary(currentView);
  }

  let homeTagsExpanded=false;
  let homeTagsQuery='';
  function visibleHomeTags(tags,search,expanded) {
    const needle=search.trim().toLowerCase();
    const ranked=tags.map(([tag,count],rank)=>({tag,count,rank}));
    return needle?ranked.filter(item=>item.tag.toLowerCase().includes(needle)):(expanded?ranked:ranked.slice(0,15));
  }
  function bindHomeTags(tags) {
    const panel=app.querySelector('.home-tags');
    const input=panel.querySelector('[data-home-tags-search]');
    const list=panel.querySelector('.tag-filter-list');
    const toggle=panel.querySelector('[data-home-tags-toggle]');
    const status=panel.querySelector('[data-home-tags-status]');
    input.value=homeTagsQuery;
    const update=()=>{
      const shown=visibleHomeTags(tags,homeTagsQuery,homeTagsExpanded);
      list.innerHTML=shown.length?shown.map(({tag,count,rank})=>`<button type="button" class="tag-filter tag-tone-${rank%4}" data-home-tag="${escapeAttr(tag)}"><span>#</span><span class="home-tag-name">${escapeHtml(tag)}</span><b>${count}</b></button>`).join(''):`<span class="muted">${tags.length?'找不到符合的標籤':'目前尚未建立標籤'}</span>`;
      status.textContent=`顯示 ${shown.length}／${tags.length} 個標籤`;
      toggle.hidden=tags.length<=15||!!homeTagsQuery.trim();
      toggle.textContent=homeTagsExpanded?'收合標籤':'顯示全部標籤';
      toggle.setAttribute('aria-expanded',String(homeTagsExpanded));
    };
    let composing=false;
    input.addEventListener('compositionstart',()=>{composing=true;});
    input.addEventListener('compositionend',()=>{composing=false;homeTagsQuery=input.value;update();});
    input.addEventListener('input',event=>{if(composing||event.isComposing)return;homeTagsQuery=input.value;update();});
    toggle.addEventListener('click',()=>{homeTagsExpanded=!homeTagsExpanded;update();});
    list.addEventListener('click',event=>{
      const b=event.target.closest('[data-home-tag]');
      if(!b||!list.contains(b))return;
      selectedSearchTag=b.dataset.homeTag;query=selectedSearchTag;searchLimit=40;searchInput.value=query;detailId=null;render();
    });
    update();
  }
  function renderHome() {
    const todayKey = today();
    const todayEvents = state.events.filter(e => eventOnDay(e,todayKey)).sort((a,b) => a.start.localeCompare(b.start));
    const openTasks = state.tasks.filter(x => !['done','archived','cancelled'].includes(x.status));
    const todayTasks = openTasks.filter(x => x.dueDate === todayKey).sort(taskSort);
    const allOpenTasks = openTasks.sort(taskSort);
    const followups = state.communications.filter(x => !['done','archived','cancelled'].includes(x.status)).sort((a,b) => b.dateTime.localeCompare(a.dateTime));
    const todayComms = state.communications.filter(x => localDatePart(x.dateTime) === todayKey).sort((a,b) => b.dateTime.localeCompare(a.dateTime));
    const overdueTasks = openTasks.filter(x => x.dueDate && x.dueDate < todayKey).sort(taskSort);
    const overdueCount = overdueTasks.length;
    const nextEvent = todayEvents.find(e => new Date(e.start) >= new Date());
    const autoBrief = buildBrief([...todayTasks,...overdueTasks], todayEvents, followups, nextEvent);
    const assetCount = homeAssetCount();
    const projectEntries = (state.projects||[]).reduce((n,p)=>n+(p.entries||[]).length,0);
    const latestProject = (state.projects||[]).flatMap(p=>(p.entries||[]).map(e=>({...e,projectTitle:p.title,projectId:p.id}))).sort(entryOrder)[0];
    const tagCounts={};[...state.notes,...state.prompts,...state.skills,...state.bookmarks,...state.videos,...(state.projects||[]),...state.tasks,...state.events,...state.communications].forEach(x=>(x.tags||[]).forEach(tag=>{tagCounts[tag]=(tagCounts[tag]||0)+1}));const homeTags=Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]);
    const futureTrips=upcomingTravelCountdowns(),nextTrip=futureTrips[0];
    const todayTravel=homeTravelAgenda(todayKey);
    const todayScheduleCount=todayEvents.length+todayTravel.reduce((count,group)=>count+group.items.length,0);

    app.innerHTML = `
      <section class="page-head home-operational">
        <div><div class="eyebrow">OPEN OS · LOCAL DEMO</div><h1 class="page-title">${greeting()}, ${lang()==='zh'?'朋友':'friend'}.</h1><div class="weather-line"><span>${formatLongDate(new Date())}</span><span aria-hidden="true">·</span><span id="weatherStatus">${weatherResult ? escapeHtml(weatherLabel()) : (lang()==='zh'?'天氣載入中…':'Loading weather…')}</span><button class="text-btn" id="weatherCityBtn">${escapeHtml(weatherCity.name)} · ${lang()==='zh'?'更換地點':'Change city'}</button></div></div>${clockPanel(true)}
      </section>
      <section class="home-alert-ticker" data-home-alert-ticker aria-label="重要提醒" role="region"><span class="home-alert-ticker-label">重要提醒</span><span class="home-alert-ticker-content" data-ticker-message>正在整理提醒…</span><div class="home-alert-ticker-actions"><button type="button" data-ticker-prev aria-label="上一則提醒">‹</button><span data-ticker-count></span><button type="button" data-ticker-next aria-label="下一則提醒">›</button><button type="button" data-ticker-open class="home-alert-ticker-open">查看通知</button></div></section>

      ${window.IAN_OS_HOME_AI_STATUS.render({rules:planning.summaryRules.list(),ui,lang:lang(),escapeHtml})}
      <div class="dashboard-grid home-daily-workspace">
        <div class="dashboard-col">
          <section class="panel brief-panel">
            <div class="eyebrow">${uiIcon('sun')} ${t('morning').toUpperCase()}</div><div class="brief-date">${formatLongDate(new Date())}</div>
            <h2 class="brief-title">${lang()==='zh'?'今天先看最重要的事。':'Start with what matters today.'}</h2>
            <div class="brief-summary">${escapeHtml(autoBrief)}</div>
            <div class="brief-metrics brief-counts">
              <div><div class="brief-metric-value">${uiIcon('calendar')}<strong>${todayScheduleCount}</strong></div><span>${t('schedule')}</span></div>
              <div><div class="brief-metric-value">${uiIcon('task')}<strong>${todayTasks.length}</strong></div><span>${t('dueToday')}</span></div>
              <div><div class="brief-metric-value">${uiIcon('alert')}<strong>${overdueCount}</strong></div><span>${t('overdue')}</span></div>
              <div><div class="brief-metric-value">${uiIcon('message')}<strong>${followups.length}</strong></div><span>${t('followup')}</span></div>
            </div>
            <div class="brief-list">
              <section class="brief-list-group"><h3>${t('schedule')} <b>${todayScheduleCount}</b></h3><ul>${todayEvents.map(e=>`<li>${escapeHtml(e.title)}</li>`).join('') || (!todayTravel.length?`<li class="brief-empty">${lang()==='zh'?'今天沒有行程':'No events today'}</li>`:'')}${todayTravel.map(group=>homeTravelAgendaMarkup(group,todayKey)).join('')}</ul></section>
              <section class="brief-list-group"><h3>${t('dueToday')} <b>${todayTasks.length}</b></h3><ul>${todayTasks.map(x=>`<li>${escapeHtml(x.title)}</li>`).join('') || `<li class="brief-empty">${lang()==='zh'?'今天沒有到期事項':'No tasks due today'}</li>`}</ul></section>
              <section class="brief-list-group"><h3>${t('overdue')} <b>${overdueCount}</b></h3><ul>${overdueTasks.map(x=>`<li>${escapeHtml(x.title)}</li>`).join('') || `<li class="brief-empty">${lang()==='zh'?'目前沒有逾期':'No overdue tasks'}</li>`}</ul></section>
              <section class="brief-list-group"><h3>${t('followup')} <b>${followups.length}</b></h3><ul>${followups.map(x=>`<li>${escapeHtml(x.subject||x.contact||'待追蹤訊息')}</li>`).join('') || `<li class="brief-empty">${lang()==='zh'?'目前沒有待追蹤':'No follow-ups'}</li>`}</ul></section>
            </div>
            <section class="brief-open-tasks">
              ${sectionHead(lang()==='zh'?'未完成待辦':'Open tasks', `<button class="text-btn" data-view-jump="tasks">${lang()==='zh'?'全部待辦 →':'All tasks →'}</button><button class="text-btn" data-add="task">＋ ${t('addTask')}</button>`)}
              <div class="task-list">${allOpenTasks.length ? allOpenTasks.map(taskRow).join('') : `<div class="brief-empty-task">${lang()==='zh'?'目前沒有未完成待辦':'No open tasks'}</div>`}</div>
            </section>
          </section>
        </div>
        <div class="dashboard-col">
          <section class="panel">
            ${sectionHead(t('quick'))}
            <div class="quick-grid">
              ${quickCard('note','▤',t('addNote'),lang()==='zh'?'想法、工作筆記、影片':'Ideas, notes, video')}
              ${quickCard('prompt','✦',t('addPrompt'),lang()==='zh'?'指令與風格圖片':'Prompt + style images')}
              ${quickCard('task','✓',t('addTask'),lang()==='zh'?'今天要交辦的事':'Daily action item')}
              ${quickCard('communication','✉',t('logMessage'),lang()==='zh'?'Email / Teams 回覆':'Email / message')}
              ${window.IAN_OS_SCORE_CARDS.render(state.settings.preferences?.scoreCards,lang()==='zh')}
            </div>
            ${window.IAN_OS_SCORE_CARDS.footer(lang()==='zh')}
          </section>
          <section class="panel">
            ${sectionHead(t('todayAgenda'), `<button class="text-btn" data-add="event">＋ ${t('addEvent')}</button>`)}
            <div class="agenda-list">${todayEvents.length ? todayEvents.map(eventRow).join('') : emptyInline({hint:'今天沒有行程，新增一個活動開始規劃。',action:false})}</div>
          </section>
          <section class="panel">
            ${sectionHead(t('messages'), `<button class="text-btn" data-add="communication">＋ ${t('logMessage')}</button>`)}
            <div class="comm-list">${(todayComms.length ? todayComms : followups).map(commRow).join('') || emptyInline({title:'沒有待追蹤訊息',hint:'記錄往來訊息後，需要回覆的會顯示在這裡。',view:'communications'})}</div>
          </section>
        </div>
      </div>

      <section class="home-tags panel"><div class="overview-heading"><div><div class="eyebrow">TAGS</div><h2>${uiIcon('tag')} ${ui('快速篩選標籤')}</h2></div><span>${ui('點選標籤查看相關內容')}</span></div><div class="home-tags-controls"><input type="search" data-home-tags-search placeholder="搜尋標籤…" aria-label="搜尋標籤" autocomplete="off"><span class="muted" data-home-tags-status role="status" aria-live="polite"></span><button type="button" class="secondary-btn compact" data-home-tags-toggle aria-controls="homeTagList" hidden>顯示全部標籤</button></div><div id="homeTagList" class="tag-filter-list"></div></section>

      ${window.IAN_OS_HOME_QUICK_LINKS.render(state.settings.preferences?.homeQuickLinks,lang())}

      <section class="system-overview" aria-label="${lang()==='zh'?'全系統摘要':'System overview'}">
        <div class="overview-heading"><div><div class="eyebrow">SYSTEM OVERVIEW</div><h2>${lang()==='zh'?'所有內容概況':'Workspace at a glance'}</h2></div><span>${lang()==='zh'?'點選卡片直接進入模組':'Open any module directly'}</span></div>
        <div class="overview-grid">
          ${overviewCard('notes','▤',lang()==='zh'?'筆記':'Notes',state.notes.length,lang()==='zh'?`${state.notes.filter(x=>x.favorite).length} 筆收藏`:`${state.notes.filter(x=>x.favorite).length} favorites`)}
          ${overviewCard('prompts','✦','Prompts',state.prompts.length,lang()==='zh'?`${state.prompts.reduce((n,p)=>n+(p.styleImages||[]).length,0)} 張風格圖`:`${state.prompts.reduce((n,p)=>n+(p.styleImages||[]).length,0)} style images`)}
          ${overviewCard('skills','⌘','Skills',state.skills.length,lang()==='zh'?'AI 工作角色':'AI work roles')}
          ${overviewCard('videos','▶',lang()==='zh'?'影音牆':'Videos',state.videos.length,lang()==='zh'?`${state.videos.filter(x=>x.favorite).length} 筆收藏`:`${state.videos.filter(x=>x.favorite).length} favorites`)}
          ${overviewCard('bookmarks','↗',lang()==='zh'?'書籤':'Bookmarks',state.bookmarks.length,lang()==='zh'?'已保存連結':'saved links')}
          ${overviewCard('communications','✉',lang()==='zh'?'訊息':'Messages',state.communications.length,lang()==='zh'?`${followups.length} 筆待追蹤`:`${followups.length} to follow up`,followups.length>0)}
          ${overviewCard('projects','◇',lang()==='zh'?'專案':'Projects',(state.projects||[]).length,lang()==='zh'?`${projectEntries} 個紀錄點`:`${projectEntries} log entries`)}
          ${overviewCard('home-assets','⌂',lang()==='zh'?'家中物品':'Home Assets',assetCount ?? '—',assetCount===null?(lang()==='zh'?'開啟後開始建立':'Open to begin'):(lang()==='zh'?'已登錄物品':'items recorded'))}
        </div>
        <div class="home-projects">${(state.projects||[]).filter(p=>p.status!=='completed').map(p=>{const latest=[...(p.entries||[])].sort(entryOrder)[0];return `<button class="latest-project-strip" data-project-latest="${escapeAttr(p.id)}"><span class="status-pulse"></span><span><b>${escapeHtml(p.title)}</b><small>${escapeHtml(currentProjectVersion(p))} · ${ui(p.status==='on-hold'?'暫停':p.status==='archived'?'已封存':'進行中')}${latest?' · '+escapeHtml(latest.title):' · '+ui('尚無紀錄')}</small></span><strong>${ui('查看專案')} →</strong></button>`}).join('')}</div>
        ${nextTrip?homeTravelCountdownStrip(nextTrip,futureTrips.length-1):''}
      </section>

      <section class="section panel month-card home-month-card">
        ${sectionHead(t('month'), `<button class="text-btn" data-view-jump="calendar">${lang()==='zh'?'開啟完整行程 →':'Open full calendar →'}</button>`)}
        ${calendarModule.calendarMarkup(calendarCursor, 'home')}
      </section>
    `;

    bindDynamicActions(); bindTaskRows(); calendarModule.bindCalendar('home'); bindCommRows();
    app.querySelectorAll('[data-overview-view]').forEach(el=>el.addEventListener('click',()=>goView(el.dataset.overviewView)));
    app.querySelectorAll('[data-project-latest]').forEach(b=>b.addEventListener('click',e=>renderProjectDetail(e.currentTarget.dataset.projectLatest)));
    app.querySelectorAll('[data-home-ai-open]').forEach(button=>button.addEventListener('click',()=>{currentView='automations';detailId=null;query='';selectedSearchTag=null;searchInput.value='';syncNav();renderSidebarTree();render();}));
    app.querySelectorAll('[data-home-trip]').forEach(button=>button.addEventListener('click',()=>{currentView='travel';detailId=null;query='';selectedSearchTag=null;searchInput.value='';syncNav();renderSidebarTree();planning.openTrip(button.dataset.homeTrip);}));
    app.querySelectorAll('[data-home-itinerary-trip]').forEach(button=>button.addEventListener('click',()=>{currentView='travel';detailId=null;query='';selectedSearchTag=null;searchInput.value='';syncNav();renderSidebarTree();planning.openTrip(button.dataset.homeItineraryTrip,todayKey);}));
    bindHomeTags(homeTags);
    window.IAN_OS_HOME_QUICK_LINKS.bind(app,{
      get:()=>state.settings.preferences?.homeQuickLinks,
      save:async links=>{const next=normalizeState(cloneState());next.settings.preferences ||= {};next.settings.preferences.homeQuickLinks=links;await window.IAN_OS_CLOUD.savePreferences(next);state=next;renderSidebarTree();render();},
      lang,toast
    });
    window.IAN_OS_SCORE_CARDS.bind(app,{
      get:()=>state.settings.preferences?.scoreCards,
      save:async cards=>{const next=normalizeState(cloneState());next.settings.preferences ||= {};next.settings.preferences.scoreCards=cards;await window.IAN_OS_CLOUD.savePreferences(next);state=next;renderSidebarTree();render();},
      lang,toast
    });
    window.IAN_OS_NOTIFICATIONS?.mountHome({app,creditCards:state.creditCards,trips:state.settings.preferences?.trips});
    window.IAN_OS_HOME_LAYOUT.mount({app,preferences:()=>state.settings.preferences,save:async layout=>{const next=normalizeState(cloneState());next.settings.preferences ||= {};if(layout)next.settings.preferences.homeLayout=layout;else delete next.settings.preferences.homeLayout;await window.IAN_OS_CLOUD.savePreferences(next);state=next;renderSidebarTree();toast(lang()==='zh'?'首頁配置已儲存':'Home layout saved');},render:renderHome,lang});
    document.getElementById('weatherCityBtn')?.addEventListener('click',changeWeatherCity);
    tickClocks();
  }

  function overviewCard(view,icon,label,value,meta,attention=false){const svg=globalThis.IAN_OS_ICON?.(view)||'';return `<button class="overview-card ${attention?'needs-attention':''}" data-overview-view="${escapeAttr(view)}"><span class="overview-icon">${svg}</span><span class="overview-copy"><b>${escapeHtml(label)}</b><small>${escapeHtml(meta)}</small></span><strong>${escapeHtml(String(value))}</strong></button>`}
  function homeAssetCount(){return window.IAN_OS_CLOUD?.homeAssetCount?.() ?? null}

  function clockPeriod(zone){
    const h=Number(new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',hour12:false}).format(new Date()));
    if(h>=5&&h<8)return '清晨'; if(h>=8&&h<10)return '早上'; if(h>=10&&h<12)return '上午'; if(h>=12&&h<14)return '中午'; if(h>=14&&h<18)return '下午'; if(h>=18&&h<24)return '晚間'; return '凌晨';
  }
  function clockPanel(inHead=false){
    const zones=[['New York','America/New_York','美東'],['Chicago','America/Chicago','美中'],['San Francisco','America/Los_Angeles','美西'],['Taipei','Asia/Taipei','台北']];
    return `<section class="panel clock-panel ${inHead?'head-clock-panel':''}"><div class="clock-panel-title">${uiIcon('clock')} ${lang()==='zh'?'世界時間':'World clocks'}</div><div class="clock-grid">${zones.map(([city,zone,zh])=>`<div class="clock-tile"><span>${lang()==='zh'?zh:city}</span><strong data-clock-zone="${zone}">--:--</strong><small data-clock-period="${zone}">${clockPeriod(zone)}</small><small data-clock-date="${zone}"></small></div>`).join('')}</div></section>`;
  }
  function tickClocks(){
    document.querySelectorAll('[data-clock-zone]').forEach(el=>{
      const zone=el.dataset.clockZone;
      el.textContent=new Intl.DateTimeFormat(lang()==='zh'?'zh-TW':'en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
      const period=document.querySelector(`[data-clock-period="${zone}"]`); if(period) period.textContent=ui(clockPeriod(zone));
      document.querySelector(`[data-clock-date="${zone}"]`).textContent=new Intl.DateTimeFormat(lang()==='zh'?'zh-TW':'en-US',{timeZone:zone,month:'short',day:'numeric',weekday:'short'}).format(new Date());
    });
  }
  function weatherLabel(){
    const code=weatherResult?.weather_code;
    const condition=ui(code===0?'晴朗':code<4?'多雲':code<50?'霧':code<70?'下雨':code<80?'下雪':code<90?'陣雨':'雷雨');
    const source=Number(weatherResult.temperature_2m);
    const celsiusSource=String(weatherResult.temperature_unit||'').toLowerCase().includes('c');
    const fahrenheit=celsiusSource?source*9/5+32:source;
    const celsius=celsiusSource?source:(source-32)*5/9;
    return `${weatherCity.name} · ${condition} · ${Math.round(fahrenheit)}°F / ${Math.round(celsius)}°C`;
  }
  async function refreshWeather(){
    const el=document.getElementById('weatherStatus');
    if(el)el.textContent=lang()==='zh'?'示範天氣，無即時資料':'Demo weather, no live data';
  }
  async function changeWeatherCity(){
    const name=prompt(lang()==='zh'?'輸入展示城市名稱':'Enter a demo city name',weatherCity.name)?.trim();
    if(!name)return;
    weatherCity={name:name.slice(0,80),latitude:0,longitude:0};
    state.settings.preferences={...state.settings.preferences,weatherCity};saveState();render();refreshWeather();
  }


  function renderCreditCards(){
    const cards=state.creditCards||[];
    const uses=[...new Set(cards.flatMap(creditUseTags))];
    const useFilters=uses.length?`<section class="credit-use-filters" aria-label="${lang()==='zh'?'推薦用途篩選':'Recommended use filters'}"><h2>${lang()==='zh'?'推薦用途':'Recommended Uses'}</h2><div class="credit-use-filter-list"><button type="button" class="credit-use-filter is-active" data-credit-use-filter="" aria-pressed="true">${lang()==='zh'?'全部':'All'}</button>${uses.map(use=>`<button type="button" class="credit-use-filter" data-credit-use-filter="${escapeAttr(use)}" aria-pressed="false">${escapeHtml(use)}</button>`).join('')}</div><p class="credit-use-filter-status" role="status" aria-live="polite"></p></section>`:'';
    app.innerHTML=`<section class="page-head compact-head utility-page utility-credit"><div><div class="eyebrow">LIFE · PERSONAL FINANCE</div><h1 class="page-title">${t('creditCards')}</h1><p class="page-subtitle">${lang()==='zh'?'管理個人信用卡，只保存卡片名稱、後四碼與備註；資料僅儲存在這個瀏覽器。':'Manage personal cards with only the last four digits and notes. Stored only in this browser.'}</p></div><button class="primary-btn" id="addCardBtn">＋ ${lang()==='zh'?'新增信用卡':'Add card'}</button></section>${useFilters}<div class="card-grid credit-card-grid">${cards.length?cards.map(creditCardPreview).join(''):emptyInline()}</div>`;
    window.IAN_OS_PDF.mount(app.querySelector('.page-head'),'credit',()=>cards,true);
    document.getElementById('addCardBtn').onclick=()=>editCreditCard();
    app.querySelectorAll('[data-credit-use-filter]').forEach(button=>button.onclick=()=>{const selected=button.dataset.creditUseFilter;app.querySelectorAll('[data-credit-use-filter]').forEach(chip=>{const active=chip===button;chip.classList.toggle('is-active',active);chip.setAttribute('aria-pressed',String(active));});let shown=0;app.querySelectorAll('.credit-card-preview').forEach(card=>{const item=cards.find(value=>value.id===card.dataset.cardId);card.hidden=!!selected&&!creditUseTags(item).includes(selected);if(!card.hidden)shown++;});const status=app.querySelector('.credit-use-filter-status');if(status)status.textContent=lang()==='zh'?`顯示 ${shown} 張信用卡`:`Showing ${shown} cards`;});
    app.querySelectorAll('[data-card-edit]').forEach(b=>b.onclick=()=>editCreditCard(cards.find(c=>c.id===b.dataset.cardEdit)));
    app.querySelectorAll('[data-card-preview]').forEach(button=>button.onclick=()=>showCreditCard(cards.find(c=>c.id===button.dataset.cardPreview)));
    app.querySelectorAll('[data-card-delete]').forEach(button=>button.onclick=()=>{const card=cards.find(c=>c.id===button.dataset.cardDelete);if(card)deletePreferenceRecord({name:card.name,mutate:next=>{next.creditCards=next.creditCards.filter(value=>value.id!==card.id);},success:deleteMessage(lang()==='zh'?'信用卡':'Credit card')});});
    app.querySelectorAll('.credit-card-preview').forEach(card=>card.onclick=e=>{if(!e.target.closest('button,a'))showCreditCard(cards.find(c=>c.id===card.dataset.cardId));});
  }

  function creditDay(value){const raw=String(value??'').trim();const match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);const day=Number(match?match[3]:raw);if(match){const date=new Date(Number(match[1]),Number(match[2])-1,day);if(date.getFullYear()!==Number(match[1])||date.getMonth()+1!==Number(match[2])||date.getDate()!==day)return '';}return /^(?:\d{1,2}|\d{4}-\d{1,2}-\d{1,2}(?:T.*)?)$/.test(raw)&&day>=1&&day<=31?String(day):'';}
  function creditMoney(value){const raw=String(value??'').trim();if(!raw)return '—';const amount=Number(raw.replace(/[$,\s]/g,''));return Number.isFinite(amount)?`$${new Intl.NumberFormat(lang()==='zh'?'zh-TW':'en-US',{maximumFractionDigits:2}).format(amount)}`:raw;}
  function creditHighlights(value){
    const lines=String(value||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    const summaries=[];
    for(let i=0;i<lines.length&&summaries.length<4;i++){
      let line=lines[i];
      if(/^\|?\s*:?-{3,}/.test(line)||/^\s*\|?\s*[-:| ]+\|?\s*$/.test(line))continue;
      if(line.includes('|')){
        const cells=line.replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim()).filter(Boolean);
        if(i+1<lines.length&&/^\s*\|?\s*[-:| ]+\|?\s*$/.test(lines[i+1]))continue;
        line=cells.slice(0,2).join(' · ');
      }
      line=line.replace(/^(?:[-*+]\s+|\d+\.\s+|#{1,6}\s+)/,'').replace(/\*\*|__|~~|`/g,'').trim();
      if(line)summaries.push(Array.from(line).slice(0,90).join(''));
    }
    return summaries;
  }
  function creditCardFacts(c){return `<div class="card-finance-grid"><div><small>${lang()==='zh'?'結帳日':'Closing Date'}</small><b>${escapeHtml(creditDay(c.closingDate)||c.closingDate||'—')}</b></div><div><small>${lang()==='zh'?'繳款日':'Due Date'}</small><b>${escapeHtml(creditDay(c.dueDate)||c.dueDate||'—')}</b></div><div><small>${lang()==='zh'?'年費':'Annual Fee'}</small><b>${escapeHtml(creditMoney(c.statementBalance))}</b></div><div><small>${lang()==='zh'?'信用卡額度':'Credit Limit'}</small><b>${escapeHtml(creditMoney(c.creditLimit))}</b></div></div>`;}
  function creditUseTags(card){return Array.isArray(card?.recommendedUses)?card.recommendedUses.filter(value=>typeof value==='string').map(value=>value.trim()).filter(Boolean):[];}
  function creditUseMarkup(card,full=false){const tags=creditUseTags(card);if(!tags.length)return '';return `<section class="credit-use ${full?'credit-use-full':''}" aria-label="推薦用途"><h3>推薦用途${!full&&tags.length>2?` <small>另 ${tags.length-2} 項</small>`:''}</h3><div class="credit-use-tags">${(full?tags:tags.slice(0,2)).map(tag=>`<span class="credit-use-tag user-content" title="${escapeAttr(tag)}">${escapeHtml(tag)}</span>`).join('')}</div></section>`;}
  function creditCardPreview(c){const highlights=creditHighlights(c.benefits);return `<article class="panel credit-card-preview" data-card-id="${escapeAttr(c.id)}"><div class="credit-card-heading"><div class="credit-card-identity"><div class="eyebrow">CREDIT CARD</div><h2>${escapeHtml(c.name||'Personal Card')}</h2><strong class="card-last-four">•••• ${escapeHtml(c.last4||'----')}</strong></div>${creditUseMarkup(c)}</div>${creditCardFacts(c)}<div class="credit-benefit-summary"><h3>${lang()==='zh'?'福利摘要':'Benefits Highlights'}</h3>${highlights.length?`<ul>${highlights.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:`<p>${lang()==='zh'?'尚無福利資料':'No benefits yet'}</p>`}</div><div class="credit-card-actions"><button class="secondary-btn" data-card-preview="${escapeAttr(c.id)}">${lang()==='zh'?'查看完整福利':'View Full Benefits'}</button><button class="secondary-btn" data-card-edit="${escapeAttr(c.id)}">✎ ${t('edit')}</button><button class="secondary-btn card-list-delete" data-card-delete="${escapeAttr(c.id)}">${lang()==='zh'?'刪除':'Delete'}</button></div></article>`;}
  function showCreditCard(card){
    if(!card)return;
    const overlay=document.createElement('div');overlay.className='modal-backdrop';
    const headingId='credit-detail-title';
    const renderRich=value=>value?window.IAN_OS_EDITOR.render(value):`<p>${lang()==='zh'?'尚無資料':'No information yet'}</p>`;
    const highlights=creditHighlights(card.benefits);
    overlay.innerHTML=`<section class="modal modal-wide credit-card-detail" role="dialog" aria-modal="true" aria-labelledby="${headingId}"><div class="modal-header"><div><div class="eyebrow">CREDIT CARD</div><h2 id="${headingId}">${escapeHtml(card.name||'Personal Card')}</h2><span class="card-last-four">•••• ${escapeHtml(card.last4||'----')}</span></div><button type="button" class="icon-btn" data-close aria-label="${lang()==='zh'?'關閉':'Close'}">×</button></div>${creditUseMarkup(card,true)}${creditCardFacts(card)}${highlights.length?`<section class="credit-detail-highlights"><h3>${lang()==='zh'?'福利摘要':'Benefits Highlights'}</h3><ul>${highlights.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></section>`:''}<section class="credit-detail-section credit-detail-benefits"><h3>${lang()==='zh'?'完整福利':'Full Benefits'}</h3><div class="credit-rich-content rendered-content">${renderRich(card.benefits)}</div></section><section class="credit-detail-section credit-detail-notes"><h3>${lang()==='zh'?'備註':'Notes'}</h3><div class="credit-rich-content rendered-content">${renderRich(card.notes)}</div></section><div class="modal-actions"><button type="button" class="danger-btn secondary-danger" data-detail-delete>${lang()==='zh'?'刪除':'Delete'}</button><button type="button" class="secondary-btn" data-detail-edit>✎ ${t('edit')}</button><button type="button" class="secondary-btn" data-close>${lang()==='zh'?'關閉':'Close'}</button></div></section>`;
    document.body.appendChild(overlay);
    window.IAN_OS_PDF.mount(overlay.querySelector('.modal-actions'),'credit',()=>[card]);
    overlay.querySelectorAll('.credit-detail-benefits table').forEach(table=>{
      const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
      table.querySelectorAll('tbody tr').forEach(row=>[...row.cells].forEach((cell,index)=>cell.setAttribute('data-column-label',headers[index]||'')));
    });
    activateDialog(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>overlay.remove());
    overlay.querySelector('[data-detail-edit]').onclick=()=>{overlay.remove();editCreditCard(card);};
    overlay.querySelector('[data-detail-delete]').onclick=()=>deletePreferenceRecord({name:card.name,mutate:next=>{next.creditCards=next.creditCards.filter(value=>value.id!==card.id);},success:deleteMessage(lang()==='zh'?'信用卡':'Credit card'),close:()=>overlay.remove()});
  }
  function editCreditCard(card=null){
    const overlay=document.createElement('div');overlay.className='modal-backdrop';
    const field=(key,label,type='text',extra='')=>`<label><span>${label}</span><input name="${key}" type="${type}" value="${escapeAttr(['closingDate','dueDate'].includes(key)?creditDay(card?.[key]):type==='number'?String(card?.[key]??'').replace(/[$,\s]/g,''):(card?.[key]??''))}" ${extra}></label>`;
    const dayHint=lang()==='zh'?'每月幾日':'Day of month';
    overlay.innerHTML=`<section class="modal credit-card-editor" role="dialog" aria-modal="true" aria-label="${t('creditCards')}"><div class="modal-header"><h2>${card?(lang()==='zh'?'編輯信用卡':'Edit Credit Card'):(lang()==='zh'?'新增信用卡':'Add Credit Card')}</h2><button type="button" class="icon-btn" data-close aria-label="${lang()==='zh'?'關閉':'Close'}">×</button></div><form>${field('name',lang()==='zh'?'信用卡名稱':'Card Name','text','required') }<div class="field-grid two">${field('last4',lang()==='zh'?'後四碼':'Last Four Digits','text','required inputmode="numeric" pattern="[0-9]{4}" maxlength="4"')}${field('creditLimit',lang()==='zh'?'信用卡額度':'Credit Limit','number','min="0" step="0.01"')}</div><div class="field-grid two">${field('closingDate',lang()==='zh'?'結帳日':'Closing Date','number',`min="1" max="31" step="1" inputmode="numeric" placeholder="${dayHint}"`)}${field('dueDate',lang()==='zh'?'繳款日':'Due Date','number',`min="1" max="31" step="1" inputmode="numeric" placeholder="${dayHint}"`)}</div>${field('statementBalance',lang()==='zh'?'年費':'Annual Fee','number','min="0" step="0.01"')}<fieldset class="credit-use-editor"><legend>推薦用途</legend><div data-credit-use-list></div><div class="credit-use-add"><input type="text" data-credit-use-new aria-label="新增推薦用途" placeholder="例如：Hilton 飯店住宿"><button type="button" class="secondary-btn compact" data-credit-use-add>新增用途</button></div><small>可自行新增多項用途，直接修改欄位即可編輯。</small></fieldset><label><span>${lang()==='zh'?'福利重點':'Benefits'}</span><textarea name="benefits">${escapeHtml(card?.benefits||'')}</textarea></label><label><span>${lang()==='zh'?'備註':'Notes'}</span><textarea name="notes">${escapeHtml(card?.notes||'')}</textarea></label><div class="modal-actions">${card?`<button type="button" class="danger-btn secondary-danger" data-delete-card>${lang()==='zh'?'刪除':'Delete'}</button>`:''}<button type="button" class="secondary-btn" data-close>${lang()==='zh'?'取消':'Cancel'}</button><button class="primary-btn" type="submit">${lang()==='zh'?'儲存':'Save'}</button></div></form></section>`;
    document.body.appendChild(overlay);activateDialog(overlay);overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>overlay.remove());
    const useList=overlay.querySelector('[data-credit-use-list]'),useInput=overlay.querySelector('[data-credit-use-new]');
    const addUse=(value='')=>{const row=document.createElement('div');row.className='credit-use-edit-row';const input=document.createElement('input');input.type='text';input.value=value;input.setAttribute('aria-label','推薦用途');input.dataset.creditUseValue='';const remove=document.createElement('button');remove.type='button';remove.className='secondary-btn compact';remove.textContent='移除';remove.setAttribute('aria-label','移除此推薦用途');remove.onclick=()=>{row.remove();useInput.focus();};row.append(input,remove);useList.append(row);return input;};
    creditUseTags(card).forEach(value=>addUse(value));
    const commitUse=()=>{const value=useInput.value.trim();if(!value)return;addUse(value);useInput.value='';useInput.focus();};
    overlay.querySelector('[data-credit-use-add]').onclick=commitUse;
    useInput.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();commitUse();}};
    overlay.querySelector('[data-delete-card]')?.addEventListener('click',()=>deletePreferenceRecord({name:card.name,mutate:next=>{next.creditCards=next.creditCards.filter(value=>value.id!==card.id);},success:deleteMessage(lang()==='zh'?'信用卡':'Credit card'),close:()=>overlay.remove()}));
    overlay.querySelector('form').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(!data.name.trim()||!/^\d{4}$/.test(data.last4)||['closingDate','dueDate'].some(key=>data[key]&&!creditDay(data[key])))return;for(const key of ['closingDate','dueDate']){const old=String(card?.[key]??'');if(data[key])data[key]=card&&/^\d{4}-\d{1,2}-\d{1,2}(?:T.*)?$/.test(old)&&data[key]===creditDay(old)?old:creditDay(data[key]);else if(old&&!creditDay(old))data[key]=old;}const recommendedUses=[...useList.querySelectorAll('[data-credit-use-value]')].map(input=>input.value.trim()).concat(useInput.value.trim()).filter(Boolean);const item={...(card||{}),...data,recommendedUses,name:data.name.trim(),id:card?.id||window.IAN_OS_CLOUD.uuid(),updatedAt:today(),createdAt:card?.createdAt||today()};if(card)Object.assign(card,item);else state.creditCards.push(item);saveState();overlay.remove();render();};
  }



  function renderHomeAssets() {
    window.IAN_OS_HOME_ASSETS.render({app,lang:lang(),toast,onCountChange:renderSidebarTree,isCurrent:()=>currentView==='home-assets'&&!detailId&&!query});
  }

  function renderProjects() {
    const projects = filterCategory(state.projects || []);
    app.innerHTML = `
      <section class="page-head"><div><div class="eyebrow">PROJECT CONTROL</div><h1 class="page-title">${t('projects')}</h1><p class="page-subtitle">${lang()==='zh'?'用每日紀錄追蹤版本、修改內容、決策與下一步。每一天建立新的紀錄點，過去紀錄仍可編輯。':'Track versions, changes, decisions and next steps through editable daily logs.'}</p></div><button class="primary-btn" id="newProjectBtn">＋ ${lang()==='zh'?'新增專案':'New project'}</button></section>
      ${categoryFilters(state.projects)}<div class="project-grid">${projects.length?projects.map(projectCard).join(''):(state.projects.length?globalThis.IAN_OS_EMPTY_FILTERED():emptyInline({hint:emptyHints.projects}))}</div>`;
    bindProjectCards();
    document.getElementById('newProjectBtn').onclick=()=>openProjectEditor();bindCategoryFilters();
  }

  function projectCard(p) {
    const entries=[...(p.entries||[])].sort(entryOrder);
    const latest=entries[0];
    return `<article class="project-card" data-project="${escapeAttr(p.id)}"><div class="project-card-top"><span class="project-status"><i></i>${escapeHtml(({active:'ACTIVE','on-hold':'ON HOLD',completed:'COMPLETED',archived:'ARCHIVED'})[p.status]||p.status)}</span><span class="version-badge">${escapeHtml(currentProjectVersion(p)||'—')}</span></div><h2>${escapeHtml(p.title)}</h2><p class="clamp-3">${escapeHtml(p.description||'')}</p><div class="project-stats"><div><strong>${entries.length}</strong><span>${lang()==='zh'?'紀錄點':'entries'}</span></div><div><strong>${latest?escapeHtml(latest.date):'—'}</strong><span>${lang()==='zh'?'最後更新':'last update'}</span></div></div><div class="project-open"><span>${lang()==='zh'?'開啟專案':'Open project'} →</span><button class="secondary-btn compact card-list-delete" data-project-delete="${escapeAttr(p.id)}" aria-label="${lang()==='zh'?'刪除專案':'Delete project'}：${escapeAttr(p.title)}">${lang()==='zh'?'刪除':'Delete'}</button></div></article>`;
  }

  function bindProjectCards(){
    bindPressable(app.querySelectorAll('[data-project]'),function(e){if(e.target.closest('[data-project-delete]'))return;renderProjectDetail(this.dataset.project);});
    app.querySelectorAll('[data-project-delete]').forEach(button=>button.onclick=e=>{e.stopPropagation();const project=state.projects.find(value=>value.id===button.dataset.projectDelete);if(project)deleteEntity(project,{after:()=>{currentView='projects';}});});
  }

  function renderProjectDetail(id) {
    const p=state.projects.find(x=>x.id===id); if(!p)return renderProjects();
    const entries=[...(p.entries||[])].sort(entryOrder);
    currentView='projects';
    app.innerHTML=`<button class="secondary-btn" id="projectBack">← ${t('back')}</button>
      <section class="project-hero"><div class="project-hero-copy"><div class="eyebrow">ACTIVE PROJECT · ${escapeHtml(currentProjectVersion(p))}</div><h1>${escapeHtml(p.title)}</h1><div class="project-description rendered-content">${window.IAN_OS_EDITOR.render(p.description||'')}</div><div class="tags">${(p.tags||[]).map(tagHtml).join('')}</div></div><div class="detail-actions"><button class="danger-btn secondary-danger" id="deleteProject">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn" id="editProject">✎ ${t('edit')}</button><button class="primary-btn" id="addProjectEntry">＋ ${lang()==='zh'?'新增今日紀錄':'Add today’s log'}</button></div></section>
      <div class="project-layout"><aside class="project-summary panel"><div class="eyebrow">PROJECT OVERVIEW</div><div class="project-overview-grid"><div><span>${lang()==='zh'?'目前版本':'Current version'}</span><strong>${escapeHtml(currentProjectVersion(p)||'—')}</strong></div><div><span>${lang()==='zh'?'狀態':'Status'}</span><strong>${escapeHtml(({active:'進行中','on-hold':'暫停',completed:'完成',archived:'已封存'})[p.status]||p.status)}</strong></div><div><span>${lang()==='zh'?'紀錄總數':'Total entries'}</span><strong>${entries.length}</strong></div><div><span>${lang()==='zh'?'最近更新':'Last updated'}</span><strong>${escapeHtml(entries[0]?.date||'—')}</strong></div></div></aside><section class="project-timeline">${entries.length?entries.map(e=>projectEntryMarkup(p,e)).join(''):emptyInline({hint:'還沒有紀錄，新增第一筆版本或進度。',target:'#addProjectEntry'})}</section></div>`;
    document.getElementById('projectBack').onclick=renderProjects;
    document.getElementById('addProjectEntry').onclick=()=>openProjectEntry(p);
    document.getElementById('editProject').onclick=()=>openProjectEditor(p);
    document.getElementById('deleteProject').onclick=()=>deleteEntity(p,{after:()=>{currentView='projects';}});
    app.querySelectorAll('[data-edit-entry]').forEach(b=>b.onclick=()=>openProjectEntry(p,p.entries.find(e=>e.id===b.dataset.editEntry)));
    app.querySelectorAll('[data-delete-entry]').forEach(b=>b.onclick=()=>deleteProjectEntry(p,p.entries.find(e=>e.id===b.dataset.deleteEntry)));
  }

  function protectEditor(overlay,selector){
    activateDialog(overlay);
    let dirty=false;overlay.oninput=overlay.onchange=()=>{dirty=true;};
    const dismiss=()=>{if(!dirty||confirm(ui('有尚未儲存的修改。確定放棄修改並關閉？')))overlay.remove();};
    overlay.querySelectorAll(selector).forEach(b=>b.onclick=dismiss);
    overlay.onclick=()=>{};overlay.onkeydown=e=>{if(e.key==='Escape'&&!e.isComposing){e.stopPropagation();dismiss();}};
  }
  function openProjectEditor(project=null){
    const overlay=document.createElement('div');overlay.className='modal-backdrop';
    overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><div class="eyebrow">PROJECT</div><h2>${project?(lang()==='zh'?'編輯專案':'Edit project'):(lang()==='zh'?'新增專案':'New project')}</h2></div><button class="icon-btn" data-close-project>×</button></div><form><label><span>${lang()==='zh'?'專案名稱':'Project name'}</span><input id="projectName" value="${escapeAttr(project?.title||'')}" required></label><label><span>${lang()==='zh'?'說明':'Description'}</span><textarea id="projectDescription" rows="3">${escapeHtml(project?.description||'')}</textarea></label><div class="field-grid two"><label><span>${lang()==='zh'?'目前版本':'Current version'}</span><input id="projectVersion" value="${escapeAttr(currentProjectVersion(project))}"></label><label><span>${lang()==='zh'?'狀態':'Status'}</span><select id="projectStatus"><option value="active" ${!project||project.status==='active'?'selected':''}>${lang()==='zh'?'進行中':'Active'}</option><option value="archived" ${project?.status==='archived'?'selected':''}>${lang()==='zh'?'已封存':'Archived'}</option><option value="on-hold" ${project?.status==='on-hold'?'selected':''}>暫停</option><option value="completed" ${project?.status==='completed'?'selected':''}>完成</option></select></label></div><label><span>分類 / Category</span><select id="projectCategory">${categoryOptions(project?.category)}</select></label><label><span>${lang()==='zh'?'標籤（逗號分隔）':'Tags (comma separated)'}</span><input id="projectTags" value="${escapeAttr((project?.tags||[]).join(', '))}"></label><div class="modal-actions"><button type="button" class="secondary-btn" data-close-project>${lang()==='zh'?'取消':'Cancel'}</button><button class="primary-btn" type="submit">${lang()==='zh'?'儲存專案':'Save project'}</button></div></form></section>`;
    document.body.appendChild(overlay);window.IAN_OS_INPUT.attach(overlay.querySelector('#projectTags'),()=>allGraphItems().flatMap(x=>x.tags||[]));protectEditor(overlay,'[data-close-project]');
    overlay.querySelector('form').onsubmit=e=>{e.preventDefault();const now=today();const value={id:project?.id||window.IAN_OS_CLOUD.uuid(),type:'project',title:overlay.querySelector('#projectName').value.trim(),description:overlay.querySelector('#projectDescription').value.trim(),category:overlay.querySelector('#projectCategory').value||'Uncategorized',status:overlay.querySelector('#projectStatus').value,version:overlay.querySelector('#projectVersion').value.trim(),tags:window.IAN_OS_INPUT.normalize(overlay.querySelector('#projectTags').value),entries:project?.entries||[],createdAt:project?.createdAt||now,updatedAt:now};if(!value.title)return;if(project)Object.assign(project,value);else state.projects.unshift(value);saveState();overlay.remove();currentView='projects';activeFilter='All';syncNav();renderProjects();toast(lang()==='zh'?'專案已儲存':'Project saved')};
  }

  function projectProse(value){
    const source=String(value||'').trim();if(!source)return '';
    /* Older project logs may contain inline numbered/bullet runs. Normalize
       only the display input, then use the same semantic renderer as Notes. */
    const displaySource=source.includes('\n')?source:source.replace(/\s+(?=(?:\d+\.|[•▪◦])\s)/g,'\n');
    return window.IAN_OS_EDITOR.render(displaySource);
  }

  function projectChangesProse(changes){
    const lines=(Array.isArray(changes)?changes:String(changes||'').split('\n')).map(value=>String(value??'').trim()).filter(Boolean);if(!lines.length)return '';
    /* Legacy logs stored one unmarked change per array item. Keep those as a
       list, but once Markdown block syntax is present preserve every line so
       headings, paragraphs, unordered lists and ordered lists remain distinct. */
    const hasBlockSyntax=lines.some(line=>/^#{2,3}\s+|^\s*[-*+•▪◦]\s+|^\s*\d+\.\s+/.test(line));
    return window.IAN_OS_EDITOR.render((hasBlockSyntax?lines:lines.map(line=>`- ${line}`)).join('\n'));
  }
  function projectEntryMarkup(p,e){return `<article class="timeline-entry"><div class="timeline-date"><strong>${escapeHtml(formatDateFromISO(e.date))}</strong><span>${escapeHtml(e.createdAt?.includes('T')?new Date(e.createdAt).toLocaleString(lang()==='zh'?'zh-TW':'en-US',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):e.date)}</span></div><div class="timeline-card"><div class="timeline-head"><div><span class="type-pill">DAILY LOG</span><h3>${escapeHtml(e.title)}</h3></div><div class="detail-actions"><button class="danger-btn secondary-danger compact" data-delete-entry="${escapeAttr(e.id)}">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn compact" data-edit-entry="${escapeAttr(e.id)}">✎ ${t('edit')}</button></div></div><div class="entry-summary entry-prose rendered-content">${projectProse(e.summary||'')}</div>${(e.changes||[]).length?`<div class="entry-block"><h4>${lang()==='zh'?'完成／修改':'Changes'}</h4><div class="entry-prose rendered-content">${projectChangesProse(e.changes)}</div></div>`:''}${e.decisions?`<div class="entry-block"><h4>${lang()==='zh'?'決策與備註':'Decisions & notes'}</h4><div class="entry-prose rendered-content">${projectProse(e.decisions)}</div></div>`:''}${e.nextSteps?`<div class="entry-next"><strong>${lang()==='zh'?'下一步':'Next'}</strong><div class="entry-prose rendered-content">${projectProse(e.nextSteps)}</div></div>`:''}</div></article>`}

  async function deleteProjectEntry(project,entry,close){
    if(!project||!entry)return;
    const removed=await window.IAN_OS_DELETE.run({name:entry.title,action:()=>window.IAN_OS_CLOUD.deleteRecord('project_entries',entry.id)});
    if(!removed)return;
    project.entries=project.entries.filter(value=>value.id!==entry.id);project.updatedAt=new Date().toISOString();close?.();renderSidebarTree();renderProjectDetail(project.id);toast(deleteMessage(lang()==='zh'?'專案紀錄':'Project log'));
  }

  function openProjectEntry(project,entry=null){
    const overlay=document.createElement('div');overlay.className='modal-backdrop';overlay.id='projectEntryBackdrop';
    overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><div class="eyebrow">${escapeHtml(project.title)}</div><h2>${entry?(lang()==='zh'?'編輯紀錄':'Edit log'):(lang()==='zh'?'新增每日紀錄':'New daily log')}</h2></div><button class="icon-btn" data-close-entry>×</button></div><form id="projectEntryForm"><div class="field-grid two"><label><span>${lang()==='zh'?'紀錄日期':'Date'}</span><input id="entryDate" type="date" value="${escapeAttr(entry?.date||today())}" required></label><label><span>${lang()==='zh'?'紀錄標題':'Title'}</span><input id="entryTitle" value="${escapeAttr(entry?.title||'')}" placeholder="${lang()==='zh'?'例如：修正 Admin 頂部列':'e.g. Admin topbar fix'}" required></label></div><label><span>${lang()==='zh'?'摘要':'Summary'}</span><textarea id="entrySummary" rows="2">${escapeHtml(entry?.summary||'')}</textarea></label><label><span>${lang()==='zh'?'完成／修改項目（每行一項）':'Changes (one per line)'}</span><textarea id="entryChanges" rows="6">${escapeHtml((entry?.changes||[]).join('\n'))}</textarea></label><label><span>${lang()==='zh'?'決策、問題與備註':'Decisions, issues and notes'}</span><textarea id="entryDecisions" rows="4">${escapeHtml(entry?.decisions||'')}</textarea></label><label><span>${lang()==='zh'?'下一步':'Next steps'}</span><textarea id="entryNext" rows="3">${escapeHtml(entry?.nextSteps||'')}</textarea></label><div class="modal-actions"><button type="button" class="secondary-btn" data-close-entry>${lang()==='zh'?'取消':'Cancel'}</button><button class="primary-btn" type="submit">${lang()==='zh'?'儲存紀錄':'Save log'}</button></div></form></section>`;
    document.body.appendChild(overlay);protectEditor(overlay,'[data-close-entry]');
    overlay.querySelector('form').onsubmit=e=>{e.preventDefault();const now=new Date().toISOString();const value={id:entry?.id||window.IAN_OS_CLOUD.uuid(),date:overlay.querySelector('#entryDate').value,title:overlay.querySelector('#entryTitle').value.trim(),summary:overlay.querySelector('#entrySummary').value.trim(),changes:overlay.querySelector('#entryChanges').value.split('\n').map(x=>x.trim()).filter(Boolean),decisions:overlay.querySelector('#entryDecisions').value.trim(),nextSteps:overlay.querySelector('#entryNext').value.trim(),createdAt:entry?.createdAt||now,updatedAt:now};if(!value.title)return;if(entry){Object.assign(entry,value)}else project.entries.unshift(value);project.version=currentProjectVersion(project);project.updatedAt=now;saveState();overlay.remove();renderProjectDetail(project.id);toast(lang()==='zh'?'專案紀錄已儲存':'Project log saved')};
  }

  function buildBrief(tasks, events, followups, nextEvent) {
    if (lang() === 'en') {
      const next = nextEvent ? ` Your next scheduled item is “${nextEvent.title}” at ${formatTime(nextEvent.start)}.` : '';
      return `You have ${tasks.length} task${tasks.length===1?'':'s'} due or overdue, ${events.length} event${events.length===1?'':'s'} today, and ${followups.length} communication item${followups.length===1?'':'s'} still needing attention.${next}`;
    }
    const next = nextEvent ? (lang()==='zh'?`下一個行程是 ${formatTime(nextEvent.start)}「${nextEvent.title}」。`:`Next: ${nextEvent.title} at ${formatTime(nextEvent.start)}.`) : (lang()==='zh'?'目前今天沒有排定的下一個行程。':'No more events scheduled today.');
    return lang()==='zh'?`今天有 ${tasks.length} 件到期或逾期交辦、${events.length} 個行程，另外有 ${followups.length} 筆 Email／訊息仍需要追蹤。${next}`:`${tasks.length} due or overdue tasks, ${events.length} events, and ${followups.length} messages to follow up. ${next}`;
  }

  const knowledgeBrowse = Object.create(null);
  function knowledgeBrowseState(view){return knowledgeBrowse[view] ||= {favoritesOnly:false,search:''};}
  function knowledgeSelection(items,view){
    const mode=knowledgeBrowseState(view),term=mode.search.trim().toLocaleLowerCase();
    const matching=items.filter(x=>(activeFilter==='All'||(x.category||'Uncategorized')===activeFilter)&&(!term||[x.title,x.description,x.content,x.url,...(x.tags||[])].some(value=>String(value||'').toLocaleLowerCase().includes(term))));
    const favorites=matching.filter(x=>x.favorite);
    return {matching,favorites,visible:mode.favoritesOnly?favorites:matching};
  }
  function knowledgeToolbar(view,selection){
    const mode=knowledgeBrowseState(view),zh=lang()==='zh';
    return `<div class="knowledge-toolbar"><div class="knowledge-mode" role="group" aria-label="${zh?'收藏篩選':'Favorites filter'}"><button type="button" class="filter-chip ${!mode.favoritesOnly?'active':''}" data-knowledge-mode="all" aria-pressed="${!mode.favoritesOnly}">${t('all')} <span>${selection.matching.length}</span></button><button type="button" class="filter-chip ${mode.favoritesOnly?'active':''}" data-knowledge-mode="favorites" aria-pressed="${mode.favoritesOnly}">★ ${t('favorite')} <span>${selection.favorites.length}</span></button></div><label class="knowledge-search"><span>${zh?'搜尋此模組':'Search this module'}</span><input type="search" id="knowledgeSearch" value="${escapeAttr(mode.search)}" placeholder="${zh?'標題、標籤或內容':'Title, tags or content'}"></label></div>`;
  }
  function knowledgeFavorites(view,selection){
    if(knowledgeBrowseState(view).favoritesOnly||!selection.favorites.length)return '';
    const zh=lang()==='zh';
    const top=[...selection.favorites].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,6);
    return `<section class="panel knowledge-favorites" aria-labelledby="knowledgeFavoritesTitle"><div class="section-head"><h2 id="knowledgeFavoritesTitle">${globalThis.IAN_OS_ICON?.('star')||''} ${t('favorite')}</h2><button type="button" class="secondary-btn compact" data-show-favorites>${zh?'查看全部收藏':'View all favorites'} (${selection.favorites.length})</button></div><div class="knowledge-favorite-list">${top.map(item=>{const thumb=view==='videos'?safeExternalHref(videoThumb(item)):'';const href=view==='bookmarks'?safeExternalHref(item.url):'';const label=`${thumb?`<img src="${escapeAttr(thumb)}" alt="" loading="lazy">`:'<span class="knowledge-favorite-icon" aria-hidden="true">★</span>'}<span class="knowledge-favorite-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.category||'—')}</small></span>`;return `<div class="knowledge-favorite-row">${href?`<a class="knowledge-favorite-open" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${label}<span aria-hidden="true">↗</span></a>`:`<button type="button" class="knowledge-favorite-open" data-favorite-open="${escapeAttr(item.id)}">${label}</button>`}<button type="button" class="star-btn is-fav" data-star="${escapeAttr(item.id)}" aria-label="${zh?'取消收藏':'Remove favorite'}：${escapeAttr(item.title)}">★</button></div>`;}).join('')}</div></section>`;
  }
  function bindKnowledgeBrowse(view){
    const mode=knowledgeBrowseState(view);
    app.querySelectorAll('[data-knowledge-mode]').forEach(button=>button.onclick=()=>{mode.favoritesOnly=button.dataset.knowledgeMode==='favorites';render();app.querySelector(`[data-knowledge-mode="${mode.favoritesOnly?'favorites':'all'}"]`)?.focus({preventScroll:true});});
    app.querySelector('[data-show-favorites]')?.addEventListener('click',()=>{mode.favoritesOnly=true;render();app.querySelector('[data-knowledge-mode="favorites"]')?.focus({preventScroll:true});});
    const input=app.querySelector('#knowledgeSearch');
    if(input){const search=()=>{mode.search=input.value;const position=input.selectionStart;render();const next=app.querySelector('#knowledgeSearch');next?.focus({preventScroll:true});if(next&&position!==null)next.setSelectionRange(position,position);};input.oninput=e=>{if(!e.isComposing)search();};input.oncompositionend=search;}
    app.querySelectorAll('[data-favorite-open]').forEach(button=>button.onclick=()=>{const item=findItem(button.dataset.favoriteOpen);if(!item)return;if(item.type==='prompt')openPrompt(item.id);else if(item.type==='video')openVideo(item.id);else if(item.type==='bookmark')openCapture('bookmark',item);else{detailId=item.id;render();}});
  }

  function renderLibrary(view) {
    const config = {
      notes:{arr:state.notes,title:t('notesTitle'),sub:t('notesSub'),add:t('addNote'),type:'note'},
      prompts:{arr:state.prompts,title:'Prompts',sub:t('promptsSub'),add:t('addPrompt'),type:'prompt'},
      skills:{arr:state.skills,title:'Skills',sub:t('skillsSub'),add:t('addSkill'),type:'skill'},
      bookmarks:{arr:state.bookmarks,title:t('bookmarks'),sub:t('bookmarksSub'),add:t('addBookmark'),type:'bookmark'}
    }[view];
    if (!config) return renderHome();
    const cats = ['All', ...new Set(config.arr.map(x => x.category||'Uncategorized'))];
    if(!cats.includes(activeFilter))activeFilter='All';
    const selection=knowledgeSelection(config.arr,view),filtered=selection.visible;
    app.innerHTML = `
      <section class="page-head ${view==='bookmarks'?'utility-page utility-bookmarks':''}"><div><div class="eyebrow">LIBRARY</div><h1 class="page-title">${escapeHtml(config.title)}</h1><p class="page-subtitle">${escapeHtml(config.sub)}</p></div><div class="section-actions">${view==='skills'?'<button class="secondary-btn" id="importSkillMd" type="button">'+(lang()==='zh'?'匯入 .md':'Import .md')+'</button><input id="skillMdFile" class="visually-hidden-file" type="file" accept=".md,text/markdown" aria-label="'+(lang()==='zh'?'選擇 Markdown Skill 檔案':'Choose a Markdown Skill file')+'">':''}<button class="primary-btn" id="pageAdd">＋ ${escapeHtml(config.add)}</button></div></section>
      <div class="filter-bar">${cats.map(c => `<button class="filter-chip ${c===activeFilter?'active':''}" data-filter="${escapeAttr(c)}">${escapeHtml(c==='All'?t('all'):c)}</button>`).join('')}</div>
      ${knowledgeToolbar(view,selection)}
      ${knowledgeFavorites(view,selection)}
      ${filtered.length?(view==='bookmarks'?bookmarkList(filtered):cardsGrid(filtered,view)):`${config.arr.length?globalThis.IAN_OS_EMPTY_FILTERED():emptyInline({hint:emptyHints[view]})}`}
    `;
    window.IAN_OS_PDF.mount(app.querySelector('.section-actions'),config.type,()=>config.arr,true);
    document.getElementById('pageAdd').addEventListener('click', () => openCapture(config.type));
    if(view==='skills'){
      const input=document.getElementById('skillMdFile');
      document.getElementById('importSkillMd').onclick=()=>input.click();
      input.onchange=async()=>{
        const file=input.files?.[0];input.value='';
        if(!file)return;
        if(!/\.md$/i.test(file.name)){toast(lang()==='zh'?'請選擇 .md 檔案':'Choose a .md file');return;}
        try{
          const markdown=await file.text();
          if(!markdown.trim()){toast(lang()==='zh'?'Markdown 檔案沒有內容':'Markdown file is empty');return;}
          const heading=markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
          openCapture('skill');
          document.getElementById('captureTitle').value=heading||file.name.replace(/\.md$/i,'');
          document.getElementById('captureContent').value=markdown;
          document.getElementById('captureTitle').focus();
        }catch{toast(lang()==='zh'?'無法讀取 Markdown 檔案':'Could not read Markdown file');}
      };
    }
    app.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { activeFilter = b.dataset.filter; render(); }));
    app.querySelectorAll('[data-bookmark-edit]').forEach(b=>b.onclick=()=>openCapture('bookmark',state.bookmarks.find(x=>x.id===b.dataset.bookmarkEdit)));
    app.querySelectorAll('[data-bookmark-delete]').forEach(b=>b.onclick=()=>{const item=state.bookmarks.find(x=>x.id===b.dataset.bookmarkDelete);if(item)deleteEntity(item);});
    bindKnowledgeBrowse(view);bindCards();
  }

  function cardsGrid(items, view) {
    if (!items.length) return `<div class="empty-state"><strong>${t('noItems')}</strong>${lang()==='zh'?'使用右上方「新增」建立第一筆資料。':'Use Add to create the first item.'}</div>`;
    if(view==='notes')return noteList(items);
    return `<div class="card-grid">${items.map(item => view==='prompts' ? promptCard(item) : view==='videos' ? videoCard(item) : genericCard(item)).join('')}</div>`;
  }
  function noteList(items){
    return `<div class="note-list">${items.map(noteRow).join('')}</div>`;
  }
  function noteRow(item){
    const summary=(item.content||'').replace(/[#*_~`>|-]+/g,' ').replace(/\s+/g,' ').trim();
    const video=item.videoUrl?`<span class="tag">▶ Video</span>`:'';
    return `<article class="item-card note-card note-list-row" data-id="${escapeAttr(item.id)}" aria-label="${lang()==='zh'?'開啟筆記':'Open note'}：${escapeAttr(item.title)}"><span class="note-list-icon" aria-hidden="true">▤</span><div class="note-list-copy"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(summary)}</p></div><div class="note-list-taxonomy"><span class="category-pill">${escapeHtml(item.category||'—')}</span>${video}${(item.tags||[]).map(tagHtml).join('')}</div><time class="note-list-date" datetime="${escapeAttr(item.updatedAt||'')}">${escapeHtml(localDatePart(item.updatedAt)||'—')}</time><div class="card-inline-actions note-list-actions"><button class="star-btn ${item.favorite?'is-fav':''}" data-star="${escapeAttr(item.id)}" aria-label="${item.favorite?'取消收藏':'加入收藏'}：${escapeAttr(item.title)}">${item.favorite?'★':'☆'}</button><button class="secondary-btn compact card-list-delete" data-card-delete="${escapeAttr(item.id)}" aria-label="${lang()==='zh'?'刪除':'Delete'}：${escapeAttr(item.title)}">${lang()==='zh'?'刪除':'Delete'}</button></div></article>`;
  }
  function genericCard(item) {
    const video = item.type === 'note' && item.videoUrl ? `<span class="tag">▶ Video</span>` : '';
    const summary=item.type==='note'?(item.content||'').replace(/[#*_~`>|-]+/g,' ').replace(/\s+/g,' ').trim():item.description||'';
    return `<article class="item-card${item.type==='note'?' note-card':''}" data-id="${escapeAttr(item.id)}" aria-label="開啟：${escapeAttr(item.title)}"><div class="card-top">${knowledgeBadge(item.type)}<div class="card-inline-actions"><button class="star-btn ${item.favorite?'is-fav':''}" data-star="${escapeAttr(item.id)}" aria-label="${item.favorite?'取消收藏':'加入收藏'}：${escapeAttr(item.title)}">${item.favorite?'★':'☆'}</button><button class="secondary-btn compact card-list-delete" data-card-delete="${escapeAttr(item.id)}" aria-label="${lang()==='zh'?'刪除':'Delete'}：${escapeAttr(item.title)}">${lang()==='zh'?'刪除':'Delete'}</button></div></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(summary)}</p><div class="tags">${video}${(item.tags||[]).map(tagHtml).join('')}</div><div class="card-footer"><span>${escapeHtml(item.category||'—')}</span><span>${escapeHtml(localDatePart(item.updatedAt)||'—')}</span></div></article>`;
  }
  function promptCard(item) {
    return `<article class="item-card prompt-card" data-id="${escapeAttr(item.id)}"><button type="button" class="prompt-card-hit" data-open-prompt="${escapeAttr(item.id)}" aria-label="開啟：${escapeAttr(item.title)}"></button><div class="prompt-card-body"><div class="card-top">${knowledgeBadge('prompt')}<div class="card-inline-actions"><button class="star-btn ${item.favorite?'is-fav':''}" data-star="${escapeAttr(item.id)}" aria-label="${item.favorite?'取消收藏':'加入收藏'}：${escapeAttr(item.title)}">${item.favorite?'★':'☆'}</button><button class="secondary-btn compact card-list-delete" data-card-delete="${escapeAttr(item.id)}" aria-label="${lang()==='zh'?'刪除':'Delete'}：${escapeAttr(item.title)}">${lang()==='zh'?'刪除':'Delete'}</button></div></div><h3>${escapeHtml(item.title)}</h3><p>${renderInlineSafe(item.description||'')}</p><div class="tags">${(item.tags||[]).map(tagHtml).join('')}</div><div class="card-footer"><span>${escapeHtml(item.category||'—')}</span><span>${escapeHtml(localDatePart(item.updatedAt)||'—')}</span></div></div></article>`;
  }
  function tagHtml(x) { return `<span class="tag">${escapeHtml(x)}</span>`; }
  function typeLabel(type) { return ({note:'NOTE',prompt:'PROMPT',skill:'SKILL',video:'VIDEO',bookmark:'LINK',project:'PROJECT',task:'TASK',event:'EVENT',communication:'MESSAGE'})[type] || String(type).toUpperCase(); }

  function bindCards() {
    bindPressable(app.querySelectorAll('.item-card:not(.prompt-card)'),function(e){const card=this;
      if (e.target.closest('[data-star],[data-delete-video],[data-card-delete]')) return;
      const item = findItem(card.dataset.id);
      if(item?.type==='video') openVideo(item.id); else if(item?.type==='bookmark'){currentView='bookmarks';detailId=null;query='';searchInput.value='';syncNav();render();} else { detailId = card.dataset.id; render(); }
    });
    app.querySelectorAll('[data-open-prompt]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();openPrompt(button.dataset.openPrompt);}));
    app.querySelectorAll('[data-delete-video]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();deleteVideo(btn.dataset.deleteVideo);}));
    app.querySelectorAll('[data-card-delete]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const item=findItem(btn.dataset.cardDelete);if(item)deleteEntity(item);}));
    app.querySelectorAll('[data-star]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); toggleFavorite(btn.dataset.star);const next=[...app.querySelectorAll('[data-star]')].find(node=>node.dataset.star===btn.dataset.star);(next||app.querySelector('[data-knowledge-mode="favorites"]'))?.focus({preventScroll:true}); }));
  }

  function safeExternalHref(value){try{const parsed=new URL(String(value||''));return ['https:','http:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password?parsed.href:'';}catch{return '';}}
  function renderDetail(id) {
    const item = findItem(id); if (!item) { detailId = null; return render(); }
    const safeItemUrl=safeExternalHref(item.url);
    const video = item.type === 'note' && item.videoUrl ? videoHtml(item.videoUrl) : '';
    app.innerHTML = `<button class="secondary-btn" id="backBtn">← ${t('back')}</button><section class="detail-panel section editorial-detail${['note','skill'].includes(item.type)?` note-skill-reading ${item.type}-reading`:''}"><div class="detail-head"><div>${knowledgeBadge(item.type)}<h1>${escapeHtml(item.title)}</h1>${item.type==='note'?'':`<div class="detail-description rendered-content">${window.IAN_OS_EDITOR.render(item.description||'')}</div>`}</div><div class="detail-actions"><button class="danger-btn secondary-danger" id="deleteBtn">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn" id="editBtn">${t('edit')}</button><button class="secondary-btn" id="favBtn">${item.favorite?'★':'☆'} ${t('favorite')}</button>${safeItemUrl?`<a class="link-btn" href="${escapeAttr(safeItemUrl)}" target="_blank" rel="noopener noreferrer">${t('open')} ↗</a>`:''}</div></div><div class="filter-bar"><span class="tag">${escapeHtml(item.category||'—')}</span>${(item.tags||[]).map(tagHtml).join('')}</div><div class="detail-content rendered-content">${window.IAN_OS_EDITOR.render(item.content||'')}</div>${window.IAN_OS_ATTACHMENTS.gallery(item.attachments)}${video}</section>`;
    window.IAN_OS_PDF.mount(app.querySelector('.detail-actions'),item.type,()=>[item]);
    planning.appendChecklist(app,item);
    document.getElementById('backBtn').addEventListener('click', () => { detailId = null; render(); });
    document.getElementById('editBtn').addEventListener('click', () => openCapture(item.type, item));
    document.getElementById('favBtn').addEventListener('click', () => toggleFavorite(item.id));
    document.getElementById('deleteBtn').addEventListener('click', () => deleteEntity(item));
    window.IAN_OS_ATTACHMENTS.bindGallery(app,item.attachments);
  }

  function videoHtml(url) {
    const embed = youtubeEmbed(url),href=safeExternalHref(url);
    return `<div class="video-card"><div class="eyebrow">VIDEO REFERENCE</div>${embed?`<iframe src="${escapeAttr(embed)}" title="${lang()==='zh'?'影片參考':'Video reference'}" allowfullscreen loading="lazy"></iframe>`:''}${href?`<a class="video-link" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${lang()==='zh'?'開啟影片連結':'Open video link'} ↗</a>`:''}</div>`;
  }
  function youtubeEmbed(url) {
    const id=youtubeId(url);return id?`https://www.youtube.com/embed/${encodeURIComponent(id)}`:'';
  }

  let activePromptId=null;
  function openPrompt(id) {
    const item = state.prompts.find(x => x.id === id); if (!item) return;
    activePromptId=id;
    const imgs = item.styleImages || [];
    document.getElementById('promptDetailContent').innerHTML = `${imgs.length?`<div class="prompt-gallery">${imgs.map((img,i)=>`<figure data-style-view="${i}"><img src="${escapeAttr(imageSrc(img))}" alt="Style ${i+1}"><span class="img-index">${i+1}/${imgs.length} · ${imageDims(img)}</span></figure>`).join('')}</div>`:`<div class="prompt-gallery"><figure style="display:grid;place-items:center;color:var(--muted)">${lang()==='zh'?'尚未加入風格圖片':'No style images yet'}</figure></div>`}<div class="prompt-main editorial-prompt"><div class="prompt-meta-row">${knowledgeBadge('prompt')}<span class="tag">${escapeHtml(item.category||'—')}</span>${(item.tags||[]).map(tagHtml).join('')}</div><h1>${escapeHtml(item.title)}</h1><div class="prompt-desc rendered-content">${window.IAN_OS_EDITOR.render(item.description||'')}</div><div class="prompt-toolbar"><div class="left"><button class="secondary-btn" id="promptFav">${item.favorite?'★':'☆'} ${t('favorite')}</button><button class="secondary-btn" id="promptEdit">✎ ${t('edit')}</button><button class="danger-btn secondary-danger" id="promptDelete">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn" id="promptAddImage">＋ ${lang()==='zh'?'加入風格圖片':'Add style image'}</button></div><div class="right"><button class="primary-btn" id="promptCopy">${t('copy')}</button></div></div><div class="prompt-section-title">${t('prompt')}</div><div class="prompt-box rendered-content">${window.IAN_OS_EDITOR.render(item.content||'')}</div>${window.IAN_OS_ATTACHMENTS.gallery(item.attachments)}</div>`;
    promptBackdrop.hidden = false;activateDialog(promptBackdrop);
    window.IAN_OS_PDF.mount(document.querySelector('#promptDetailContent .prompt-toolbar .left'),'prompt',()=>[item]);
    try{planning.appendChecklist(document.getElementById('promptDetailContent'),item);}catch(error){console.warn('Prompt checklist unavailable',error);}
    document.getElementById('promptFav').addEventListener('click', () => { toggleFavorite(item.id, false); openPrompt(item.id); });
    document.getElementById('promptEdit').addEventListener('click', () => { closePrompt(); openCapture('prompt', item); });
    document.getElementById('promptDelete').addEventListener('click', () => deleteEntity(item,{close:closePrompt}));
    document.getElementById('promptAddImage').addEventListener('click', () => { closePrompt(); openCapture('prompt', item); setTimeout(()=>document.getElementById('promptImageUpload').click(),80); });
    document.getElementById('promptCopy').addEventListener('click', () => copyText(item.content || item.title));
    document.querySelectorAll('[data-style-view]').forEach(el=>el.addEventListener('click',()=>openImageViewer(item, Number(el.dataset.styleView))));
    try{window.IAN_OS_ATTACHMENTS.bindGallery(document.getElementById('promptDetailContent'),item.attachments);}catch(error){console.warn('Prompt attachments unavailable',error);}
  }
  function closePrompt() { promptBackdrop.hidden = true;activePromptId=null; }

  function normalizeImage(x){ return typeof x==='string'?{src:x,name:'Image',width:0,height:0,size:0,mime:'unknown'}:{...x,src:x?.src||'',name:x?.name||x?.file_name||'Image',width:x?.width||0,height:x?.height||0,size:x?.size??x?.file_size??0,mime:x?.mime||x?.mime_type||'unknown'}; }
  function imageSrc(x){ return typeof x==='string'?x:(x?.src||''); }
  function imageDims(x){ const m=normalizeImage(x); return m.width&&m.height?`${m.width} × ${m.height}`:'尺寸讀取中 / Remote'; }
  function formatBytes(n){ if(!n)return '—'; if(n<1024)return `${n} B`; if(n<1048576)return `${(n/1024).toFixed(1)} KB`; return `${(n/1048576).toFixed(1)} MB`; }
  async function readImageMeta(file){if(!file.type.startsWith('image/'))throw new Error('Not an image');const src=URL.createObjectURL(file);return await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve({src,file,name:file.name,width:im.naturalWidth,height:im.naturalHeight,size:file.size,mime:file.type});im.onerror=()=>{URL.revokeObjectURL(src);reject(new Error('Invalid image'));};im.src=src;}); }
  function openImageViewer(prompt,index){ const img=normalizeImage(prompt.styleImages[index]); const ratio=img.width&&img.height?(img.width/img.height).toFixed(2):'—',backdrop=document.getElementById('imageBackdrop');backdrop.classList.remove('attachment-lightbox'); document.getElementById('imageViewerContent').innerHTML=`<div class="image-viewer-layout"><div class="image-viewer-stage"><img src="${escapeAttr(img.src)}" alt=""></div><aside class="image-viewer-info"><div class="eyebrow">STYLE IMAGE ${index+1}/${prompt.styleImages.length}</div><h2>${escapeHtml(img.name)}</h2><dl><dt>Actual Size</dt><dd>${imageDims(img)}</dd><dt>Aspect Ratio</dt><dd>${ratio}</dd><dt>File Size</dt><dd>${formatBytes(img.size)}</dd><dt>Format</dt><dd>${escapeHtml(img.mime)}</dd></dl><button class="primary-btn" id="viewerEdit">✎ 編輯 Prompt</button></aside></div>`; backdrop.hidden=false;activateDialog(backdrop); document.getElementById('viewerEdit').onclick=()=>{closeImageViewer();closePrompt();openCapture('prompt',prompt);}; }
  function closeImageViewer(){ const backdrop=document.getElementById('imageBackdrop');backdrop.hidden=true;backdrop.classList.remove('attachment-lightbox');document.getElementById('imageViewerContent').innerHTML=''; }
  function youtubeId(url){try{const u=new URL(String(url||''));if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return '';const host=u.hostname.toLowerCase();let id='';if(host==='youtu.be')id=u.pathname.slice(1).split('/')[0];else if(host==='youtube.com'||host.endsWith('.youtube.com'))id=u.searchParams.get('v')||(u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:'');return /^[A-Za-z0-9_-]{6,20}$/.test(id)?id:'';}catch{return '';}}
  function videoThumb(v){ return v.thumbnailUrl || (youtubeId(v.url)?`https://i.ytimg.com/vi/${youtubeId(v.url)}/hqdefault.jpg`:''); }
  function deleteVideo(id){ const v=state.videos.find(x=>x.id===id);if(v)deleteEntity(v,{close:closeVideo}); }
  function videoCard(v){ const th=videoThumb(v); return `<article class="video-wall-card item-card" data-id="${escapeAttr(v.id)}" aria-label="開啟影音：${escapeAttr(v.title)}">${th?`<div class="video-thumb"><img src="${escapeAttr(th)}" alt=""><span>▶</span></div>`:`<div class="video-thumb empty">▶</div>`}<div class="prompt-card-body"><div class="card-top">${knowledgeBadge('video')}<button class="star-btn ${v.favorite?'is-fav':''}" data-star="${escapeAttr(v.id)}" aria-label="${v.favorite?'取消收藏':'加入收藏'}：${escapeAttr(v.title)}">${v.favorite?'★':'☆'}</button></div><h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.description||'')}</p><div class="tags">${(v.tags||[]).map(tagHtml).join('')}</div><div class="card-footer"><span>${escapeHtml(v.category||'—')}</span><span>${escapeHtml(localDatePart(v.updatedAt)||'—')}</span><button type="button" class="secondary-btn compact video-delete" data-delete-video="${escapeAttr(v.id)}" aria-label="刪除影音：${escapeAttr(v.title)}">刪除</button></div></div></article>`; }
  function renderVideos(){
    const cats=['All',...new Set(state.videos.map(x=>x.category||'Uncategorized'))];if(!cats.includes(activeFilter))activeFilter='All';
    const selection=knowledgeSelection(state.videos,'videos');
    app.innerHTML=`<section class="page-head"><div><div class="eyebrow">VIDEO ENGINE WALL</div><h1 class="page-title">影音牆</h1><p class="page-subtitle">影片收藏、封面、時間碼筆記與相關知識集中在同一個觀看介面。</p></div><button class="primary-btn" id="pageAdd">＋ 新增影片</button></section><div class="filter-bar">${cats.map(c=>`<button class="filter-chip ${c===activeFilter?'active':''}" data-filter="${escapeAttr(c)}">${escapeHtml(c==='All'?t('all'):c)}</button>`).join('')}</div>${knowledgeToolbar('videos',selection)}${knowledgeFavorites('videos',selection)}${selection.visible.length?`<div class="video-wall">${selection.visible.map(videoCard).join('')}</div>`:`${state.videos.length?globalThis.IAN_OS_EMPTY_FILTERED():emptyInline({hint:emptyHints.videos})}`}`;
    window.IAN_OS_PDF.mount(app.querySelector('.page-head'),'video',()=>state.videos,true);document.getElementById('pageAdd').onclick=()=>openCapture('video');app.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;render();});bindKnowledgeBrowse('videos');bindCards();
  }
  function openVideo(id){
    const v=state.videos.find(x=>x.id===id);if(!v)return;closeVideo();
    const yid=youtubeId(v.url),safeVideoHref=safeExternalHref(v.url);const lines=(v.content||'').split('\n').filter(Boolean);
    document.getElementById('videoDetailContent').innerHTML=`<div class="video-detail editorial-video"><div class="eyebrow">VIDEO LIBRARY</div><h1>${escapeHtml(v.title)}</h1><div class="video-meta"><div class="tags"><span class="tag">${escapeHtml(v.category||'—')}</span>${(v.tags||[]).map(tagHtml).join('')}</div><div class="detail-actions"><button class="danger-btn secondary-danger" id="videoDelete">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn" id="videoEdit">✎ ${t('edit')}</button></div></div>${v.description?`<div class="detail-description rendered-content">${window.IAN_OS_EDITOR.render(v.description)}</div>`:''}${yid?`<div class="video-player"><iframe title="${escapeAttr(v.title)}" src="https://www.youtube.com/embed/${escapeAttr(yid)}" allowfullscreen></iframe></div>`:safeVideoHref?`<a class="link-btn" href="${escapeAttr(safeVideoHref)}" target="_blank" rel="noopener noreferrer">${lang()==='zh'?'開啟影片':'Open Video'} ↗</a>`:`<span class="muted">${lang()==='zh'?'無有效影片連結':'No valid video link'}</span>`}${window.IAN_OS_ATTACHMENTS.gallery(v.attachments)}<section class="video-timeline"><div class="section-head"><h2>${ui('時間碼 / Notes')}</h2><span>${lines.length} ${ui('則筆記')}</span></div><div class="timestamps">${lines.length?lines.map(x=>{const m=x.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)$/);return `<div class="timestamp-row">${m?`<time>${escapeHtml(m[1])}</time><div class="rendered-content">${renderInlineSafe(m[2])}</div>`:`<div class="rendered-content">${renderInlineSafe(x)}</div>`}</div>`;}).join(''):emptyInline({hint:'還沒有時間碼筆記，編輯影片時可加入時間碼與重點。',target:'#videoEdit'})}</div></section></div>`;
    window.IAN_OS_PDF.mount(document.querySelector('#videoDetailContent .detail-actions'),'video',()=>[v]);planning.appendChecklist(document.getElementById('videoDetailContent'),v);window.IAN_OS_ATTACHMENTS.bindGallery(document.getElementById('videoDetailContent'),v.attachments);document.getElementById('videoBackdrop').hidden=false;activateDialog(document.getElementById('videoBackdrop'));document.getElementById('videoEdit').onclick=()=>{closeVideo();openCapture('video',v);};document.getElementById('videoDelete').onclick=()=>deleteEntity(v,{close:closeVideo});
  }
  function closeVideo(){document.getElementById('videoDetailContent').innerHTML='';document.getElementById('videoBackdrop').hidden=true;}

  function renderAutomations(){ app.innerHTML=`<section class="page-head"><div><div class="eyebrow">WORKFLOW</div><h1 class="page-title">AI 與自動化</h1><p class="page-subtitle">虛構的工作流程展示，本版本不會連接服務或在背景執行。</p></div></section><div class="automation-grid">${state.workflows.map(w=>`<article class="automation-card"><div class="automation-head"><span class="type-pill">AUTOMATION</span><button class="toggle ${w.active?'on':''}" data-flow="${escapeAttr(w.id)}" role="switch" aria-checked="${w.active}" aria-label="${escapeAttr((lang()==='zh'?'切換自動化：':'Toggle automation: ')+w.title)}"></button></div><h3>${escapeHtml(w.title)}</h3><p>${escapeHtml(w.description)}</p><div class="automation-trigger">Trigger · ${escapeHtml(w.trigger)}</div><div class="automation-actions">${w.actions.map(a=>`<div class="automation-action">→ ${escapeHtml(a)}</div>`).join('')}</div></article>`).join('')}</div>`; app.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>{const w=state.workflows.find(x=>x.id===b.dataset.flow);w.active=!w.active;saveState();render();}); }
  function allGraphItems(){return [...state.notes,...state.prompts,...state.skills,...state.videos,...state.bookmarks,...(state.projects||[]),...state.tasks,...state.events,...state.communications];}
  function renderGraph(){
    const sets=state.graphSets||[];const graph=sets.find(x=>x.id===activeGraphId);
    if(!graph){app.innerHTML=`<section class="page-head utility-page utility-graph"><div><div class="eyebrow">MEMORY GRAPH COLLECTIONS</div><h1 class="page-title">關聯圖譜</h1><p class="page-subtitle">${lang()==='zh'?'每個圖譜都是獨立的關係集合，可依專案或主題分開管理。':'Manage separate relationship collections by project or topic.'}</p></div><button class="primary-btn" id="newGraphBtn">＋ ${lang()==='zh'?'新增圖譜':'New graph'}</button></section><div class="project-grid">${sets.map(g=>`<article class="project-card" data-open-graph="${escapeAttr(g.id)}"><div class="project-card-top"><span class="type-pill">GRAPH</span><span class="version-badge">${(g.relations||[]).length} ${lang()==='zh'?'個關係':'relations'}</span></div><h2>${escapeHtml(g.title)}</h2><p>${escapeHtml(g.description||'')}</p><div class="project-open">${lang()==='zh'?'開啟圖譜':'Open graph'} <span>→</span></div></article>`).join('')}</div>`;document.getElementById('newGraphBtn').onclick=()=>openGraphEditor();bindPressable(app.querySelectorAll('[data-open-graph]'),function(){activeGraphId=this.dataset.openGraph;renderSidebarTree();renderGraph()});return;}
    const relations=graph.relations||[];
    app.innerHTML=`<button class="secondary-btn" id="graphBack">← ${t('back')}</button><section class="project-hero utility-page utility-graph"><div><div class="eyebrow">RELATIONSHIP COLLECTION</div><h1>${escapeHtml(graph.title)}</h1><p>${escapeHtml(graph.description||'')}</p></div><div class="detail-actions"><button class="danger-btn secondary-danger" id="deleteGraph">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn" id="editGraph">✎ ${t('edit')}</button><button class="primary-btn" id="addRelation">＋ ${lang()==='zh'?'新增關係':'Add relation'}</button></div></section><section class="relation-list">${relations.length?relations.map(r=>relationRow(r)).join(''):`<div class="empty-state"><strong>${lang()==='zh'?'尚未建立關係':'No relationships yet'}</strong>${lang()==='zh'?'加入兩筆內容之間的連結。':'Connect two items in this graph.'}</div>`}</section>`;
    document.getElementById('graphBack').onclick=()=>{activeGraphId=null;renderSidebarTree();renderGraph()};document.getElementById('editGraph').onclick=()=>openGraphEditor(graph);document.getElementById('addRelation').onclick=()=>openRelationEditor(graph);document.getElementById('deleteGraph').onclick=()=>deleteOwnedRecord({table:'graph_sets',id:graph.id,name:graph.title,message:lang()==='zh'?`此操作會一併刪除 ${relations.length} 筆關聯，且無法復原。`:`This also deletes ${relations.length} relation${relations.length===1?'':'s'}. This action cannot be undone.`,mutate:s=>{s.graphSets=s.graphSets.filter(value=>value.id!==graph.id);activeGraphId=null;},success:deleteMessage(lang()==='zh'?'圖譜':'Graph')});app.querySelectorAll('[data-edit-relation]').forEach(b=>b.onclick=()=>openRelationEditor(graph,relations.find(r=>r.id===b.dataset.editRelation)));app.querySelectorAll('[data-delete-relation]').forEach(b=>b.onclick=()=>deleteGraphRelation(graph,relations.find(r=>r.id===b.dataset.deleteRelation)));
  }
  function relationRow(r){const a=findItem(r.from),b=findItem(r.to);return `<article class="relation-row"><div class="relation-node"><span>${typeLabel(a?.type||'item')}</span><b>${escapeHtml(a?.title||'Missing item')}</b></div><div class="relation-link"><strong>${escapeHtml(r.label||'related to')}</strong><small>${escapeHtml(r.note||'')}</small></div><div class="relation-node"><span>${typeLabel(b?.type||'item')}</span><b>${escapeHtml(b?.title||'Missing item')}</b></div><div class="detail-actions"><button class="danger-btn secondary-danger compact" data-delete-relation="${escapeAttr(r.id)}" aria-label="${lang()==='zh'?'刪除關聯':'Delete relation'}">×</button><button class="secondary-btn compact" data-edit-relation="${escapeAttr(r.id)}" aria-label="${lang()==='zh'?'編輯關聯':'Edit relation'}">✎</button></div></article>`}
  async function deleteGraphRelation(graph,relation){if(!graph||!relation)return;const removed=await window.IAN_OS_DELETE.run({name:relation.label||'',action:()=>window.IAN_OS_CLOUD.deleteRecord('graph_relations',relation.id)});if(!removed)return;graph.relations=graph.relations.filter(value=>value.id!==relation.id);renderGraph();toast(deleteMessage(lang()==='zh'?'關聯':'Relation'));}
  function openGraphEditor(graph=null){const overlay=document.createElement('div');overlay.className='modal-backdrop';overlay.innerHTML=`<section class="modal utility-editor"><div class="modal-header"><div><div class="eyebrow">MEMORY GRAPH</div><h2>${graph?(lang()==='zh'?'編輯圖譜':'Edit graph'):(lang()==='zh'?'新增圖譜':'New graph')}</h2></div><button class="icon-btn" data-close-graph>×</button></div><form><label><span>${lang()==='zh'?'圖譜名稱':'Graph name'}</span><input id="graphTitle" value="${escapeAttr(graph?.title||'')}" required></label><label><span>${lang()==='zh'?'說明':'Description'}</span><textarea id="graphDescription">${escapeHtml(graph?.description||'')}</textarea></label><div class="modal-actions"><button type="button" class="secondary-btn" data-close-graph>${lang()==='zh'?'取消':'Cancel'}</button><button class="primary-btn">${lang()==='zh'?'儲存':'Save'}</button></div></form></section>`;document.body.appendChild(overlay);protectEditor(overlay,'[data-close-graph]');overlay.querySelector('form').onsubmit=e=>{e.preventDefault();const now=today(),value={id:graph?.id||window.IAN_OS_CLOUD.uuid(),title:overlay.querySelector('#graphTitle').value.trim(),description:overlay.querySelector('#graphDescription').value.trim(),relations:graph?.relations||[],createdAt:graph?.createdAt||now,updatedAt:now};if(graph)Object.assign(graph,value);else state.graphSets.unshift(value);activeGraphId=value.id;saveState();overlay.remove();currentView='graph';syncNav();renderGraph()};}
  function openRelationEditor(graph,relation=null){const items=allGraphItems();const options=items.map(x=>`<option value="${escapeAttr(x.id)}">${escapeHtml(typeLabel(x.type))} · ${escapeHtml(x.title)}</option>`).join('');const overlay=document.createElement('div');overlay.className='modal-backdrop';overlay.innerHTML=`<section class="modal utility-editor"><div class="modal-header"><div><div class="eyebrow">${escapeHtml(graph.title)}</div><h2>${relation?(lang()==='zh'?'編輯關係':'Edit relation'):(lang()==='zh'?'新增關係':'Add relation')}</h2></div><button class="icon-btn" data-close-relation>×</button></div><form><div class="field-grid two"><label><span>${lang()==='zh'?'來源內容':'From item'}</span><select id="relationFrom">${options}</select></label><label><span>${lang()==='zh'?'連結內容':'To item'}</span><select id="relationTo">${options}</select></label></div><label><span>${lang()==='zh'?'關係名稱':'Relationship label'}</span><input id="relationLabel" value="${escapeAttr(relation?.label||'相關於')}" required></label><label><span>${lang()==='zh'?'關係備註':'Note'}</span><textarea id="relationNote">${escapeHtml(relation?.note||'')}</textarea></label><div class="modal-actions"><button type="button" class="secondary-btn" data-close-relation>${lang()==='zh'?'取消':'Cancel'}</button><button class="primary-btn">${lang()==='zh'?'儲存關係':'Save relation'}</button></div></form></section>`;document.body.appendChild(overlay);if(relation){overlay.querySelector('#relationFrom').value=relation.from;overlay.querySelector('#relationTo').value=relation.to}protectEditor(overlay,'[data-close-relation]');overlay.querySelector('form').onsubmit=e=>{e.preventDefault();const value={id:relation?.id||window.IAN_OS_CLOUD.uuid(),from:overlay.querySelector('#relationFrom').value,to:overlay.querySelector('#relationTo').value,label:overlay.querySelector('#relationLabel').value.trim(),note:overlay.querySelector('#relationNote').value.trim(),updatedAt:today()};if(value.from===value.to)return toast(lang()==='zh'?'請選擇兩筆不同內容':'Choose two different items');if(relation)Object.assign(relation,value);else graph.relations.push(value);graph.updatedAt=today();saveState();overlay.remove();renderGraph()};}
  function relationScore(a,b){let n=0;if(a.category&&a.category===b.category)n+=3;const A=new Set((a.tags||[]).map(x=>x.toLowerCase()));for(const t of (b.tags||[]))if(A.has(t.toLowerCase()))n+=2;return n;}
  function categoryIcon(name){const icon=state.categories.find(c=>c.name===name)?.icon||'';return window.IAN_OS_EDITOR.icons.includes(icon)?icon:'';}
  function updateCategory(category,value){const previous=category.name;Object.assign(category,value);if(previous!==value.name){allGraphItems().forEach(item=>{if(item.category===previous)item.category=value.name;});if(activeFilter===previous)activeFilter=value.name;}saveState();refreshCategorySelect();renderSettings();}
  function renderSettings(){
    const cats=state.categories;
    app.innerHTML=`<section class="page-head utility-page utility-settings"><div><div class="eyebrow">SETTINGS</div><h1 class="page-title">${ui('分類管理')}</h1><p class="page-subtitle">${ui('修改名稱、圖示與顏色；重新命名會同步更新使用此分類的內容。')}</p></div><button class="primary-btn" id="settingsAddCategory">＋ ${ui('新增分類')}</button></section><section class="panel"><div class="settings-categories">${cats.map(c=>`<div class="category-setting-row"><span class="category-symbol">${escapeHtml(categoryIcon(c.name)||'📁')}</span><strong>${escapeHtml(c.name)}</strong><span>${allGraphItems().filter(x=>x.category===c.name).length} ${lang()==='zh'?'項':'items'}</span><div class="detail-actions"><button class="danger-btn secondary-danger compact" data-delete-category="${escapeAttr(c.id)}">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn compact" data-edit-category="${escapeAttr(c.id)}">${t('edit')}</button></div></div>`).join('')}</div></section>`;
    const customize=document.createElement('section');customize.className='page-head utility-page utility-settings section';
    customize.setAttribute('aria-labelledby','sidebarManagementTitle');
    customize.innerHTML='<div><div class="eyebrow">導覽設定</div><h2 class="page-title" id="sidebarManagementTitle">側欄選單管理</h2><p class="page-subtitle">自訂模組名稱會同步顯示在側欄與頁面標題，不影響原有功能與資料。</p></div><button class="secondary-btn compact" type="button" id="customizeSidebarBtn">自訂選單</button>';
    app.append(customize);customize.querySelector('button').onclick=openSidebarLabelEditor;
    const orderButton=document.createElement('button');orderButton.className='secondary-btn compact sidebar-order-trigger';orderButton.type='button';orderButton.textContent='自訂側邊欄順序';orderButton.onclick=openSidebarOrderEditor;customize.append(orderButton);
    document.getElementById('settingsAddCategory').onclick=()=>window.IAN_OS_EDITOR.category({categories:cats,toast,save:value=>{cats.push({id:window.IAN_OS_CLOUD.uuid(),...value});saveState();renderSettings();}});
    app.querySelectorAll('[data-edit-category]').forEach(b=>b.onclick=()=>{const category=cats.find(c=>c.id===b.dataset.editCategory);window.IAN_OS_EDITOR.category({categories:cats,initial:category,toast,save:value=>updateCategory(category,value)});});
    app.querySelectorAll('[data-delete-category]').forEach(b=>b.onclick=()=>deleteUserCategory(cats.find(c=>c.id===b.dataset.deleteCategory)));
    
  }
  function deleteUserCategory(category){
    if(!category)return;const count=allGraphItems().filter(item=>item.category===category.name).length;
    return deleteOwnedRecord({table:'categories',id:category.id,name:category.name,message:count?(lang()==='zh'?`${count} 筆資料會改為「未分類」；資料本身不會刪除。`:`${count} item${count===1?'':'s'} will move to Uncategorized; the items will remain.`):undefined,mutate:s=>{s.categories=s.categories.filter(value=>value.id!==category.id);for(const key of ['notes','prompts','skills','videos','bookmarks','projects','tasks','events','communications'])for(const item of s[key]||[])if(item.category===category.name)item.category='Uncategorized';if(activeFilter===category.name)activeFilter='All';},success:deleteMessage(lang()==='zh'?'分類':'Category')});
  }
  function knowledgeBadge(type){return `<span class="knowledge-badge" title="${escapeAttr(typeLabel(type))}" aria-label="${escapeAttr(typeLabel(type))}">${uiIcon(({note:'note',prompt:'prompt',skill:'grid',video:'video',bookmark:'bookmark'})[type]||'note')}</span>`;}
  function bookmarkList(items){return `<div class="bookmark-table-wrap"><table class="bookmark-table"><thead><tr><th>${ui('名稱')}</th><th>${ui('類別')}</th><th>${ui('連結')}</th><th>${ui('操作')}</th></tr></thead><tbody>${items.map(x=>{let url='';try{const u=new URL(x.url);if(['http:','https:'].includes(u.protocol))url=u.href;}catch{}return `<tr><td><strong>${escapeHtml(x.title)}</strong></td><td>${escapeHtml(x.category||ui('未分類'))}</td><td>${url?`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`:ui('尚未設定有效連結')}</td><td><div class="bookmark-actions"><button type="button" class="star-btn ${x.favorite?'is-fav':''}" data-star="${escapeAttr(x.id)}" aria-label="${x.favorite?'取消收藏':'加入收藏'}：${escapeAttr(x.title)}">${x.favorite?'★':'☆'}</button>${url?`<a class="secondary-btn compact" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${lang()==='zh'?'開啟':'Open'} ↗</a>`:''}<button class="secondary-btn compact" data-bookmark-edit="${escapeAttr(x.id)}">${t('edit')}</button><button class="danger-btn secondary-danger compact" data-bookmark-delete="${escapeAttr(x.id)}">${lang()==='zh'?'刪除':'Delete'}</button></div></td></tr>`;}).join('')||`<tr><td colspan="4">${ui('目前沒有書籤')}</td></tr>`}</tbody></table></div>`;}
  function entryOrder(a,b){return (Date.parse(b.createdAt||b.date)||0)-(Date.parse(a.createdAt||a.date)||0);}
  // Only a version explicitly named in a log title is a release declaration.
  // Notes and next steps can mention planned releases and must not promote them.
  function entryVersion(entry){
    const matches=[...String(entry?.title||'').matchAll(/(?:\bv\.?\s*|版本\s*[:：]?\s*)(\d+(?:\.\d+){1,3}(?:-[a-zA-Z0-9.-]+)?)(?![\w.])/gi)];
    return matches.length?'v'+matches[matches.length-1][1]:'';
  }
  function compareProjectVersions(a,b){
    const parse=value=>/^v?(\d+(?:\.\d+){1,3})(?:-([a-zA-Z0-9.-]+))?$/i.exec(String(value||'').trim());
    const left=parse(a),right=parse(b);if(!left||!right)return null;
    const numeric=(x,y)=>{x=String(x).replace(/^0+(?=\d)/,'');y=String(y).replace(/^0+(?=\d)/,'');return x.length!==y.length?Math.sign(x.length-y.length):(x===y?0:x>y?1:-1);};
    const l=left[1].split('.'),r=right[1].split('.');
    for(let i=0;i<Math.max(l.length,r.length);i++){const n=numeric(l[i]||'0',r[i]||'0');if(n)return n;}
    if(!left[2]||!right[2])return left[2]===right[2]?0:left[2]?-1:1;
    const lp=left[2].split('.'),rp=right[2].split('.');
    for(let i=0;i<Math.max(lp.length,rp.length);i++){
      if(lp[i]===undefined)return -1;if(rp[i]===undefined)return 1;if(lp[i]===rp[i])continue;
      const ln=/^\d+$/.test(lp[i]),rn=/^\d+$/.test(rp[i]);
      if(ln&&rn)return numeric(lp[i],rp[i]);if(ln!==rn)return ln?-1:1;
      return lp[i]>rp[i]?1:-1;
    }
    return 0;
  }
  function currentProjectVersion(project){
    if(!project)return '';
    const saved=String(project.version||'').trim();
    const logs=(Array.isArray(project.entries)?project.entries:[])
      .filter(entry=>/^\d{4}-\d{2}-\d{2}$/.test(entry.date||'')&&entry.date<=today())
      .slice().sort((a,b)=>b.date.localeCompare(a.date)||entryOrder(a,b)||String(b.id||'').localeCompare(String(a.id||'')));
    const candidate=logs.map(entryVersion).find(Boolean)||'';
    if(!candidate)return saved;if(!saved)return candidate;
    // Repair stale version fields without replacing custom labels or downgrading
    // a manually set newer release. Reading a project never writes cloud data.
    return compareProjectVersions(candidate,saved)>0?candidate:saved;
  }

  function categoryOptions(selected='Uncategorized'){
    // Event source/type values are metadata, not reusable content categories.
    // Only user-managed categories belong in Quick Capture selectors.
    // state.categories only holds categories the user creates in 分類管理; calendar import never writes them.
    // The two calendar import values can appear on events, so they are never offered as a choice.
    const calendarImportNames=new Set(['Imported Calendar','Apple Calendar']);
    const managed=state.categories.map(c=>c.name).filter(name=>!calendarImportNames.has(name));
    const safeSelected=calendarImportNames.has(selected)?'Uncategorized':selected;
    const names=[...new Set(['Uncategorized',...managed,safeSelected||'Uncategorized'])];
    return names.map(name=>`<option value="${escapeAttr(name)}" ${name===(selected||'Uncategorized')?'selected':''}>${escapeHtml(categoryIcon(name))} ${escapeHtml(name==='Uncategorized'?(lang()==='zh'?'未分類':'Uncategorized'):name)}</option>`).join('');
  }
  function filterCategory(items){return activeFilter==='All'?items:items.filter(x=>(x.category||'Uncategorized')===activeFilter);}
  function categoryFilters(items){return `<div class="filter-bar category-filters" aria-label="分類">${['All',...new Set(items.map(x=>x.category||'Uncategorized'))].map(name=>`<button class="filter-chip ${activeFilter===name?'active':''}" data-category-filter="${escapeAttr(name)}">${escapeHtml(categoryIcon(name))}${escapeHtml(name==='All'?t('all'):name==='Uncategorized'?'未分類':name)} <small>${name==='All'?items.length:items.filter(x=>(x.category||'Uncategorized')===name).length}</small></button>`).join('')}</div>`;}
  function bindCategoryFilters(){app.querySelectorAll('[data-category-filter]').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.categoryFilter;render();});}
  function addISODateDays(value,amount){const date=new Date(`${value}T12:00:00`);if(!Number.isFinite(date.getTime()))return '';date.setDate(date.getDate()+amount);return dateKey(date);}
  function shiftISODateMonth(value,amount){const date=new Date(`${value}T12:00:00`);if(!Number.isFinite(date.getTime()))return '';const day=date.getDate(),month=new Date(date.getFullYear(),date.getMonth()+amount,1);return dateKey(new Date(month.getFullYear(),month.getMonth(),Math.min(day,new Date(month.getFullYear(),month.getMonth()+1,0).getDate())));}
  function openActivity(item){detailId=item.id;query='';searchInput.value='';if(item.type==='task'){currentView='tasks';syncNav();}render();}
  function renderActivityPreview(item){
    const when=item.type==='event'?(item.allDay?`${formatDateFromISO(localDatePart(item.start))} – ${formatDateFromISO(localDatePart(item.end||item.start))} · ${calendarAllDayLabel()}`:`${formatDateTime(item.start)} – ${formatDateTime(item.end)}`):formatDateTime(item.dateTime);
    app.innerHTML=`<button class="secondary-btn" id="activityBack">← ${t('back')}</button><section class="detail-panel section"><div class="detail-head"><div>${knowledgeBadge(item.type)}<h1>${escapeHtml(item.title||item.subject||'')}</h1><p class="detail-description">${escapeHtml(when)}</p></div><div class="detail-actions"><button class="danger-btn secondary-danger" id="activityDelete">${lang()==='zh'?'刪除':'Delete'}</button><button class="secondary-btn" id="activityEdit">${t('edit')}</button></div></div><div class="filter-bar">${[item.type==='event'&&item.category==='Imported Calendar'?'':item.category||'未分類',item.contact,item.status?statusLabel(item.status):''].filter(Boolean).map(tagHtml).join('')}</div>${item.type==='event'&&window.IAN_OS_CALENDAR_IMPORT.sourceLabel(item)?`<p class="muted">來源：${escapeHtml(window.IAN_OS_CALENDAR_IMPORT.sourceLabel(item))}</p>`:''}<div class="detail-content rendered-content">${window.IAN_OS_EDITOR.render(item.notes||'')}</div>${window.IAN_OS_ATTACHMENTS.gallery(item.attachments)}</section>`;
    planning.appendChecklist(app,item);
    document.getElementById('activityBack').onclick=()=>{detailId=null;render();};document.getElementById('activityEdit').onclick=()=>openCapture(item.type,item);document.getElementById('activityDelete').onclick=()=>deleteEntity(item);
    window.IAN_OS_ATTACHMENTS.bindGallery(app,item.attachments);
  }
  function refreshCategorySelect(selected=''){const sel=document.getElementById('captureCategory');if(sel)sel.innerHTML=categoryOptions(selected||'Uncategorized');}
  function saveNewCategory(){ let name=document.getElementById('newCategoryName').value.trim(); if(!name)return toast(ui('請輸入分類名稱')); const match=state.categories.find(c=>c.name.toLowerCase()===name.toLowerCase());if(match)name=match.name; if(!(state.categories||[]).some(c=>c.name.toLowerCase()===name.toLowerCase()))state.categories.push({id:window.IAN_OS_CLOUD.uuid(),name,color:document.getElementById('newCategoryColor').value,icon:'📁'}); saveState();refreshCategorySelect(name);document.getElementById('newCategoryName').value='';document.getElementById('newCategoryRow').hidden=true;toast(ui('分類已新增')); }
  function homeTravelAgenda(key){
    const trips=Array.isArray(state.settings?.preferences?.trips)?state.settings.preferences.trips:[];
    return trips.filter(trip=>trip.start&&trip.end&&trip.start<=key&&key<=trip.end).map(trip=>{
      const day=(trip.days||[]).find(item=>item.date===key);if(!day)return null;const items=[];let index=0;
      for(const [period,rows] of Object.entries(day.periods||{}))for(const row of Array.isArray(rows)?rows:[])if(String(row.text||'').trim())items.push({time:String(row.time||''),text:String(row.text).trim(),rank:index++});
      for(const segment of day.drivingSegments||[])items.push({time:String(segment.departureTime||''),text:`🚗 ${segment.from||''} → ${segment.to||''}`.trim(),rank:index++});
      for(const stop of day.routeStops||[])items.push({time:String(stop.arrivalTime||''),text:`${stop.name||''}${stop.location?` · ${stop.location}`:''}`,rank:index++});
      items.sort((a,b)=>{if(a.time&&b.time)return a.time.localeCompare(b.time)||a.rank-b.rank;if(a.time)return -1;if(b.time)return 1;return a.rank-b.rank;});
      return items.length?{trip,items}:null;
    }).filter(Boolean);
  }
  function homeTravelAgendaMarkup(group,key){const title=group.trip.title||group.trip.destination|| (lang()==='zh'?'旅程':'Trip'),icon=group.trip.transportMode==='road_trip'?'🚗':'✈';return `<li class="home-travel-agenda"><button type="button" class="home-travel-agenda-title" data-home-itinerary-trip="${escapeAttr(group.trip.id)}">${icon} ${escapeHtml(title)} <span aria-hidden="true">→</span></button><ul>${group.items.map(item=>`<li><time>${escapeHtml(item.time||ui('未定時間'))}</time><span>${escapeHtml(item.text)}</span></li>`).join('')}</ul></li>`;}

  function travelPreferences(){return Array.isArray(state.settings?.preferences?.trips)?state.settings.preferences.trips:[];}
  function calendarDaysUntil(value){const a=new Date(`${today()}T12:00:00`),b=new Date(`${value}T12:00:00`);return Math.round((b-a)/86400000);}
  function travelCountdownLabel(days){if(days===0)return lang()==='zh'?'今天出發':'Departs today';if(days===1)return lang()==='zh'?'明天出發':'Departs tomorrow';return lang()==='zh'?`倒數 ${days} 天`:`${days} days` ;}
  function upcomingTravelCountdowns(){return travelPreferences().map(trip=>({...trip,countdown:calendarDaysUntil(trip.start)})).filter(trip=>trip.start&&trip.countdown>=0).sort((a,b)=>a.start.localeCompare(b.start));}
  function travelRouteLabel(trip){const legs=Array.isArray(trip.flights)?trip.flights:[],outbound=legs.filter(leg=>leg.kind!=='return'),route=outbound.length?outbound:legs,points=[];for(const leg of route){const from=String(leg.from||'').trim().toUpperCase(),to=String(leg.to||'').trim().toUpperCase(),last=points[points.length-1];if(from&&last!==from)points.push(from);if(to&&points[points.length-1]!==to)points.push(to);}return points.length>1?points.join(' → '):(trip.destination||'');}
  function homeTravelCountdownStrip(trip,moreCount){const title=trip.title||trip.destination||(lang()==='zh'?'下一趟旅程':'Next trip'),route=travelRouteLabel(trip)||(lang()==='zh'?'路線待補充':'Route to be added'),date=new Intl.DateTimeFormat(lang()==='zh'?'zh-TW':'en-US',{year:'numeric',month:lang()==='zh'?'2-digit':'short',day:'2-digit'}).format(new Date(`${trip.start}T12:00:00`)),countdown=trip.countdown===0?(lang()==='zh'?'今天':'TODAY'):String(trip.countdown);return `<section class="home-travel-strip" aria-label="${lang()==='zh'?'下一趟旅程倒數':'Next trip countdown'}"><div class="home-travel-identity"><span class="home-travel-mark" aria-hidden="true">✈</span><span><small>${lang()==='zh'?'下一趟旅程':'NEXT TRIP'}</small><b title="${escapeAttr(title)}">${escapeHtml(title)}</b></span></div><div class="home-travel-route" title="${escapeAttr(route)}">${escapeHtml(route)}</div><div class="home-travel-countdown"><strong>${escapeHtml(countdown)}</strong><span>${trip.countdown===0?'':(lang()==='zh'?'天':'DAYS TO GO')}</span></div><div class="home-travel-date"><time datetime="${escapeAttr(trip.start)}">${escapeHtml(date)}</time>${moreCount>0?`<small>+${moreCount} ${lang()==='zh'?'趟即將出發':'upcoming'}</small>`:''}</div><button type="button" class="text-btn home-travel-open" data-home-trip="${escapeAttr(trip.id)}">${lang()==='zh'?'查看旅程':'View Trip'} →</button></section>`;}
  let calendarImportOpen=false;
  async function importICS(e){
    const file=e.target.files?.[0];e.target.value='';
    if(!file||calendarImportOpen)return;
    calendarImportOpen=true;
    try{
      if(file.size>5*1024*1024)throw new Error('請將行事曆分成小於 5 MB 的 ICS 檔案匯入。');
      await window.IAN_OS_CLOUD.checkCalendarImportSchema();
      const parsed=window.IAN_OS_CALENDAR_IMPORT.parse(await file.text());
      await window.IAN_OS_CALENDAR_IMPORT.preview({parsed,events:state.events,uuid:()=>window.IAN_OS_CLOUD.uuid(),apply:async(parsed,source,allowUnidentified)=>{
        // Complete prior saves, then plan against the current local state, not a stale preview.
        await window.IAN_OS_CLOUD.flushSave();
        const plan=window.IAN_OS_CALENDAR_IMPORT.plan(state.events,parsed,source,allowUnidentified);
        if(!plan.add.length&&!plan.update.length)throw new Error('沒有可安全儲存的變更，請重新開啟匯入預覽。');
        for(const update of plan.update){const current=state.events.find(x=>x.id===update.id);Object.assign(current,update.fields,{importMetadata:update.importMetadata,updatedAt:today()});}
        for(const entry of plan.add)state.events.push({...entry,id:window.IAN_OS_CLOUD.uuid(),type:'event',eventType:'personal',category:'Uncategorized',createdAt:today(),updatedAt:today()});
        saveState();render();
        try{await window.IAN_OS_CLOUD.flushSave();}catch(error){throw new Error(error?.code==='IAN_DATA_CONFLICT'?'資料已在其他裝置變更，匯入尚未完整同步。保留本機內容，請依既有衝突提示處理，勿重複匯入。':'匯入尚未完整同步，本機變更仍保留。請檢查同步狀態與連線，勿重複匯入。');}
        toast(`已新增 ${plan.add.length} 筆、更新 ${plan.update.length} 筆；保留 ${plan.conflicts.length} 筆衝突資料。`);
      }});
    }catch(error){toast(error.message||'行事曆匯入失敗。');}
    finally{calendarImportOpen=false;}
  }


  function renderTravelPage(){
    const trips=state.events.filter(e=>e.category==='旅遊'||e.category==='Travel').sort((a,b)=>a.start.localeCompare(b.start));
    app.innerHTML=`<section class="page-head"><div><div class="eyebrow">LIFE · TRAVEL</div><h1 class="page-title">旅遊規劃</h1><p class="page-subtitle">以旅遊分類整理行程；備註可記錄住宿、交通與景點。</p></div><button class="primary-btn" id="addTrip">＋ 新增旅遊行程</button></section><section class="panel"><div class="agenda-list">${trips.map(eventRow).join('')||emptyInline()}</div></section>`;
    document.getElementById('addTrip').onclick=()=>{openCapture('event');refreshCategorySelect('旅遊');document.getElementById('eventType').value='personal';};bindEventRows();
  }
  function renderSystemHealth(){
    const status=syncStatus.dataset.state;
    const counts=[['sync','本機儲存',syncStatus.textContent,syncStatus.title||ui('尚未取得同步結果')],['auth','展示模式',ui('不需要登入'),''],['weather','天氣',weatherResult?ui('已取得'):ui('尚未取得'),''],['count','內容數量',`${allGraphItems().length} ${lang()==='zh'?'筆':'items'}`,ui('不包含家中物品與信用卡')]];
    app.innerHTML=`<section class="page-head health-operational"><div><div class="eyebrow">SYSTEM STATUS</div><h1 class="page-title">${t('health')}</h1><p class="page-subtitle">${ui('顯示本機儲存與展示狀態，不連接任何伺服器。')}</p></div></section><section class="panel health-overview" data-health-state="${status==='error'?'error':status==='saved'?'healthy':'warning'}"><h2>${ui(status==='error'?'同步需要處理':status==='saved'?'最近同步成功':'同步狀態待確認')}</h2><div class="health-list">${counts.map(([key,label,value,note])=>`<div class="health-row" data-health-state="${key==='sync'?(status==='error'?'error':status==='saved'?'healthy':'warning'):key==='auth'?(window.IAN_OS_CLOUD?.user()?'healthy':'error'):key==='weather'?(weatherResult?'healthy':'warning'):'neutral'}"><div><b>${escapeHtml(ui(label))} · ${escapeHtml(value)}</b><small>${escapeHtml(note)}</small></div></div>`).join('')}</div></section>`;
  }
  function renderCommunicationsPage() {
    const allRows=[...state.communications].sort((a,b)=>b.dateTime.localeCompare(a.dateTime));const rows=filterCategory(communicationFilter==='All'?allRows:allRows.filter(x=>x.channel===communicationFilter));
    app.innerHTML = `<section class="page-head utility-page utility-communications"><div><div class="eyebrow">COMMUNICATION LOG · ${escapeHtml(communicationFilter==='All'?(lang()==='zh'?'全部管道':'ALL CHANNELS'):channelLabel(communicationFilter))}</div><h1 class="page-title">${t('communications')}</h1><p class="page-subtitle">${t('commSub')}</p></div><div class="section-actions"><button class="secondary-btn" data-add-channel="Email">＋ Email</button><button class="primary-btn" data-add-channel="Message">＋ ${lang()==='zh'?'訊息':'Message'}</button></div></section><div class="filter-bar">${['All',...new Set(['Email','Message',...state.communications.map(x=>x.channel)])].map(c=>`<button class="filter-chip ${communicationFilter===c?'active':''}" data-channel-filter="${escapeAttr(c)}">${escapeHtml(c==='All'?(lang()==='zh'?'全部':c):channelLabel(c))}</button>`).join('')}</div>${categoryFilters(state.communications)}${rows.length?`<div class="table-scroll"><table class="comm-table"><thead><tr><th>${lang()==='zh'?'日期':'Date'}</th><th>${lang()==='zh'?'管道':'Channel'}</th><th>${lang()==='zh'?'對象':'Contact'}</th><th>${lang()==='zh'?'主旨 / 內容':'Subject'}</th><th>${lang()==='zh'?'方向':'Direction'}</th><th>${lang()==='zh'?'狀態':'Status'}</th><th>${lang()==='zh'?'操作':'Actions'}</th></tr></thead><tbody>${rows.map(c=>`<tr data-comm-id="${escapeAttr(c.id)}"><td>${escapeHtml(formatDateTime(c.dateTime))}</td><td>${escapeHtml(channelLabel(c.channel))}</td><td>${escapeHtml(c.contact||'—')}</td><td><strong>${escapeHtml(c.subject||'')}</strong><div class="item-meta">${escapeHtml(c.notes||'')}</div></td><td>${escapeHtml(directionLabel(c.direction))}</td><td>${escapeHtml(statusLabel(c.status))}</td><td>${rowMenuMarkup(`data-comm-delete="${escapeAttr(c.id)}"`,c.subject||c.contact||'')}</td></tr>`).join('')}</tbody></table></div>`:emptyInline()}`;
    bindDynamicActions(); bindCommRows();bindCategoryFilters();
    app.querySelectorAll('[data-add-channel]').forEach(b=>b.onclick=()=>openCapture('communication',null,'',b.dataset.addChannel));
    app.querySelectorAll('[data-channel-filter]').forEach(b=>b.onclick=()=>{communicationFilter=b.dataset.channelFilter;renderSidebarTree();render()});
  }

  function matchesSearchTag(item,tag){return (item.tags||[]).some(value=>String(value).trim().toLocaleLowerCase()===tag.trim().toLocaleLowerCase());}
  function renderSearch() {
    const q=query.toLowerCase();
    const matches=selectedSearchTag===null?item=>searchable(item).includes(q):item=>matchesSearchTag(item,selectedSearchTag);
    const groups=[
      ['notes',state.notes.filter(x=>matches(x))],['prompts',state.prompts.filter(x=>matches(x))],['skills',state.skills.filter(x=>matches(x))],['bookmarks',state.bookmarks.filter(x=>matches(x))],['videos',state.videos.filter(x=>matches(x))],
      ['projects',(state.projects||[]).filter(x=>matches(x))],['tasks',state.tasks.filter(x=>matches(x))],['events',state.events.filter(x=>matches(x))],['communications',state.communications.filter(x=>matches(x))]
    ].filter(([,arr])=>arr.length);
    const total=groups.reduce((n,[,a])=>n+a.length,0);
    app.innerHTML=`<section class="page-head"><div><div class="eyebrow">${selectedSearchTag===null?'GLOBAL SEARCH':'TAG SEARCH'}</div><h1 class="page-title">“${escapeHtml(query)}”</h1><p class="page-subtitle">${total} ${t('searchResults')}</p></div></section>${groups.length?groups.map(([name,items])=>searchGroup(name,items.slice(0,searchLimit))+(items.length>searchLimit?`<button class="secondary-btn search-more" data-search-more>${lang()==='zh'?`顯示更多（此類別尚有 ${items.length-searchLimit} 筆）`:`Show more (${items.length-searchLimit} remaining in this group)`}</button>`:'')).join(''):`<div class="empty-state"><strong>${t('noItems')}</strong></div>`}`;
    app.querySelectorAll('[data-search-more]').forEach(b=>b.onclick=()=>{searchLimit+=40;renderSearch()});
    bindCards(); bindSearchSpecial(); bindProjectCards();
  }
  function searchGroup(name,items){
    const titles={notes:t('notes'),prompts:'Prompts',skills:'Skills',bookmarks:t('bookmarks'),videos:t('videos'),projects:t('projects'),tasks:t('todayTasks'),events:t('calendar'),communications:t('communications')};
    if(name==='projects') return `<section class="search-results-group"><h2>${titles[name]} <span class="search-count">${items.length}</span></h2><div class="project-grid">${items.map(projectCard).join('')}</div></section>`;
    if(['notes','prompts','skills','bookmarks','videos'].includes(name)) return `<section class="search-results-group"><h2>${titles[name]} <span class="search-count">${items.length}</span></h2>${cardsGrid(items,name)}</section>`;
    return `<section class="search-results-group"><h2>${titles[name]} <span class="search-count">${items.length}</span></h2><div class="agenda-list">${items.map(x=>specialSearchRow(x)).join('')}</div></section>`;
  }
  function specialSearchRow(x){
    if(x.type==='task') return `<div class="task-item" data-search-edit="${x.id}"><span class="priority ${x.priority}">${priorityLabel(x.priority)}</span><div><strong>${escapeHtml(x.title)}</strong><div class="item-meta">${escapeHtml(x.notes||'')} · ${escapeHtml(x.dueDate)}</div></div><span>${statusLabel(x.status)}</span></div>`;
    if(x.type==='event') return `<div class="agenda-item" data-search-edit="${x.id}"><span class="agenda-time">${formatTime(x.start)}</span><div><strong>${escapeHtml(x.title)}</strong><div class="item-meta">${escapeHtml(formatDateTime(x.start))}</div></div><span class="agenda-dot"></span></div>`;
    return `<div class="comm-item" data-search-edit="${x.id}"><span class="comm-direction">${escapeHtml(channelLabel(x.channel))}</span><div><strong>${escapeHtml(x.subject)}</strong><div class="item-meta">${escapeHtml(x.contact)} · ${escapeHtml(x.notes||'')}</div></div><span class="status-dot ${escapeAttr(x.status)}"></span></div>`;
  }
  function bindSearchSpecial(){ bindPressable(app.querySelectorAll('[data-search-edit]'),function(){const x=findItem(this.dataset.searchEdit);if(x)openActivity(x);}); }
  function searchable(x){if(searchCache.has(x))return searchCache.get(x);const text=[x.title,x.subject,x.description,x.category,x.content,x.notes,x.contact,x.channel,(x.tags||[]).join(' '),(x.entries||[]).map(e=>[e.title,e.summary,(e.changes||[]).join(' '),e.decisions,e.nextSteps].join(' ')).join(' ')].filter(Boolean).join(' ').toLowerCase();searchCache.set(x,text);return text;}

  function uiIcon(name){return globalThis.IAN_OS_ICON?.(name)||'';}
  function quickCard(type,icon,title,sub){ return `<button class="quick-card" data-add="${type}"><b>${uiIcon(type==='communication'?'message':type)} ${escapeHtml(title)}</b><span>${escapeHtml(sub)}</span></button>`; }
  function sectionHead(title,actions=''){ return `<div class="section-head"><h2>${uiIcon(/行程|排程|Schedule|calendar/i.test(title)?'calendar':/訊息|Message/i.test(title)?'message':/待辦|交辦|task/i.test(title)?'task':'grid')} ${escapeHtml(title)}</h2><div class="section-actions">${actions}</div></div>`; }
  // v1.0.4.41: guided empty state. Its button hands off to the page's own primary add button, so pages need no extra wiring.
  const emptyHints={notes:'新增第一則筆記，開始整理想法。',prompts:'新增第一組 Prompt，之後可一鍵複製。',skills:'新增第一個 Skill，定義 AI 的工作角色。',videos:'收藏第一支影片，方便之後查找。',bookmarks:'儲存第一個網址，之後可快速開啟。',projects:'建立第一個專案，開始追蹤版本與進度。',communications:'記錄第一則往來訊息，之後可追蹤回覆。','home-assets':'登錄第一件家中物品。','credit-cards':'新增第一張信用卡，追蹤額度與到期日。',vendors:'新增第一位廠商聯絡資料。',restaurants:'新增第一家想去的餐廳。',travel:'建立第一趟旅程。',routines:'建立第一組例行清單。',tasks:'新增第一項待辦，開始整理工作與生活細節。',calendar:'今天還沒有行程，新增一個活動開始規劃。'};
  function emptyInline(opts={}){return globalThis.IAN_OS_EMPTY_GUIDE({title:opts.title,hint:opts.hint||emptyHints[currentView]||'新增第一筆資料，開始建立內容。',view:opts.view,target:opts.target,action:opts.action!==false});}
  // Row actions: destructive delete lives in a ⋯ menu instead of sitting on the row (v1.0.4.41).
  function rowMenuMarkup(deleteAttr,label){const zh=lang()==='zh';return `<details class="row-menu"><summary class="row-menu-trigger" aria-label="${escapeAttr((zh?'更多操作：':'More actions: ')+label)}">${globalThis.IAN_OS_ICON?.('more')||'⋯'}</summary><div class="row-menu-panel"><button type="button" class="danger-menu-item" ${deleteAttr} aria-label="${escapeAttr((zh?'刪除：':'Delete: ')+label)}">${zh?'刪除':'Delete'}</button></div></details>`;}
  function eventRow(x){ return `<div class="agenda-item" data-event-id="${x.id}"><span class="agenda-time">${formatTime(x.start)}</span><div><strong>${escapeHtml(x.title)}</strong><div class="item-meta">${escapeHtml(x.notes||'')}</div></div><span class="agenda-dot"></span>${rowMenuMarkup(`data-event-delete="${escapeAttr(x.id)}"`,x.title)}</div>`; }
  function commRow(x){ return `<div class="comm-item" data-comm-id="${x.id}"><span class="comm-direction">${escapeHtml(channelLabel(x.channel))}</span><div><strong>${escapeHtml(x.subject)}</strong><div class="item-meta">${escapeHtml(x.contact||'')} · ${escapeHtml(directionLabel(x.direction))} · ${escapeHtml(statusLabel(x.status))}</div></div><span class="status-dot ${escapeAttr(x.status)}"></span>${rowMenuMarkup(`data-comm-delete="${escapeAttr(x.id)}"`,x.subject)}</div>`; }
  function bindEventRows(){app.querySelectorAll('[data-event-delete]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const item=state.events.find(value=>value.id===b.dataset.eventDelete);if(item)deleteEntity(item);}));bindPressable(app.querySelectorAll('[data-event-id]'),function(e){if(e.target.closest('[data-event-delete],.row-menu'))return;const x=state.events.find(t=>t.id===this.dataset.eventId);if(x)openActivity(x);}); }
  function bindCommRows(){app.querySelectorAll('[data-comm-delete]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const item=state.communications.find(value=>value.id===b.dataset.commDelete);if(item)deleteEntity(item);}));bindPressable(app.querySelectorAll('[data-comm-id]'),function(e){if(e.target.closest('[data-comm-delete],.row-menu'))return;const x=state.communications.find(t=>t.id===this.dataset.commId);if(x)openActivity(x);}); }
  function bindDynamicActions(){
    app.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>openCapture(b.dataset.add)));
    app.querySelectorAll('[data-view-jump]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.viewJump)));
    // Guided empty states hand off to the page's primary add action; with none on the page, the button is removed.
    bindEventRows();
  }

  function openCapture(type='note', item=null, presetDate='', presetChannel='Email') {
    captureForm.reset();
    for(const id of ['eventStart','eventEnd']){const input=document.getElementById(id);input.type='datetime-local';input.dataset.restoreTime='';}
    document.getElementById('eventAllDay').checked=false;
    document.getElementById('eventCompleted').checked=false;
    planning.editor(item?.checklist||[]);
    document.getElementById('editingId').value = item?.id || '';
    document.getElementById('captureType').value = type;
    document.getElementById('captureType').disabled=!!item;
    document.getElementById('newCategoryRow').hidden=true;
    editingPromptImages = item?.styleImages ? [...item.styleImages] : [];
    window.IAN_OS_ATTACHMENTS.open(item,type);
    const f = id => document.getElementById(id);
    refreshCategorySelect(item?.category || '');
    if (item) {
      f('captureTitle').value = item.title || item.subject || '';
      f('captureDescription').value = item.description || '';
      f('captureCategory').value = item.category || '';
      f('captureContent').value = item.content || item.notes || '';
      f('captureTags').value = (item.tags||[]).join(', ');
      f('captureFavorite').checked = !!item.favorite;
      if(type==='note') f('noteVideoUrl').value=item.videoUrl||'';
      if(type==='bookmark') f('bookmarkUrl').value=item.url||'';
      if(type==='video'){ f('videoUrl').value=item.url||''; f('videoThumbnailUrl').value=item.thumbnailUrl||''; }
      if(type==='task'){ f('taskDueDate').value=item.dueDate||''; f('taskDueMode').value=item.dueDate?'date':'none'; f('taskPriority').value=item.priority||'medium'; f('taskStatus').value=item.status||'todo'; f('taskScope').value=item.scope||'work'; f('taskReminder').value=item.remindAt?toLocalInput(item.remindAt):''; }
      if(type==='event'){ const startLocal=toLocalInput(item.start),endLocal=toLocalInput(item.end);f('eventStart').value=item.allDay?`${startLocal.slice(0,10)}T09:00`:startLocal;f('eventEnd').value=item.allDay?`${endLocal.slice(0,10)}T09:30`:endLocal;const eventCategory=f('captureCategory');if(item.category&&!Array.from(eventCategory.options).some(option=>option.value===item.category)){const option=new Option(item.category,item.category);eventCategory.add(option);}if(item.category)eventCategory.value=item.category;f('eventType').value=item.eventType||'work';f('eventAllDay').checked=!!item.allDay;f('eventCompleted').checked=!!item.completed; }
      if(type==='communication'){ f('commChannel').value=item.channel||'Email'; f('commDirection').value=item.direction||'received'; f('commStatus').value=item.status||'follow-up'; f('commContact').value=item.contact||''; f('commDateTime').value=toLocalInput(item.dateTime); }
    } else {
      if(type==='task'){ f('taskDueDate').value=presetDate||today(); f('taskDueMode').value='date'; }
      if(type==='event'){ f('eventStart').value=`${presetDate||today()}T09:00`; f('eventEnd').value=`${presetDate||today()}T09:30`; }
      if(type==='communication'){ f('commChannel').value=presetChannel; f('commDateTime').value=toLocalInput(new Date().toISOString()); }
    }
    if(type==='event'){
      setEventAllDayControls(!!f('eventAllDay').checked);
      f('eventAllDay').onchange=()=>setEventAllDayControls(f('eventAllDay').checked);
      for(const id of ['eventStart','eventEnd'])f(id).oninput=event=>{const time=event.currentTarget.value.split('T')[1];if(time)event.currentTarget.dataset.restoreTime=time;};
    }
    f('promptImageUrls').value=''; f('promptImageUpload').value='';
    updateCaptureFields(); renderStyleEditor();
    document.getElementById('captureTitleText').textContent = type==='bookmark'?(lang()==='zh'?(item?'編輯書籤':'新增書籤'):(item?'Edit bookmark':'Add bookmark')):item ? (lang()==='zh'?'編輯資料':'Edit item') : (lang()==='zh'?'新增到 OPEN OS':'Add to OPEN OS');
    captureBaseline=captureSnapshot(); captureBackdrop.hidden=false;activateDialog(captureBackdrop); setTimeout(()=>f('captureTitle').focus(),50);
  }
  let captureBaseline='';
  function captureSnapshot(){return JSON.stringify({fields:Array.from(captureForm.querySelectorAll('input,textarea,select')).map(x=>[x.id||x.name,x.value,x.checked]),checklist:planning.readChecklist(),images:editingPromptImages,attachments:window.IAN_OS_ATTACHMENTS.signature()});}
  function closeCapture(force=false){if(captureBackdrop.hidden)return true;if(force!==true&&captureSnapshot()!==captureBaseline&&!confirm(ui('有尚未儲存的修改。確定放棄修改並關閉？')))return false;editingPromptImages.forEach(x=>{if(x.src?.startsWith('blob:'))URL.revokeObjectURL(x.src);});window.IAN_OS_ATTACHMENTS.close();captureBackdrop.hidden=true;return true;}


  function compactKnowledgeCapture(type){return ['video','bookmark','skill','prompt'].includes(type);}

  function updateCaptureFields(){
    const type=document.getElementById('captureType').value;
    document.getElementById('taskDueDate').disabled=document.getElementById('taskDueMode').value==='none';
    document.querySelectorAll('.conditional-fields').forEach(el=>el.classList.add('is-hidden'));
    const ids={note:'noteFields',prompt:'promptFields',video:'videoFields',bookmark:'bookmarkFields',task:'taskFields',event:'eventFields',communication:'communicationFields'};
    if(ids[type]) document.getElementById(ids[type]).classList.remove('is-hidden');
    const compact=compactKnowledgeCapture(type);
    for(const id of ['captureImagesSection','captureChecklist'])document.getElementById(id).classList.toggle('is-hidden',compact);
    const titleWrap=document.getElementById('captureTitle').closest('.generic-field');
    const descWrap=document.getElementById('captureDescription').closest('.generic-field');
    const catWrap=document.querySelector('.category-field');
    const contentWrap=document.getElementById('captureContent').closest('.generic-field');
    const tagsWrap=document.getElementById('captureTags').closest('.generic-field');
    titleWrap.classList.remove('is-hidden');
    contentWrap.classList.toggle('is-hidden',type==='bookmark');
    descWrap.classList.toggle('is-hidden',['note','bookmark','task','event','communication'].includes(type));
    captureBackdrop.classList.toggle('bookmark-capture',type==='bookmark');
    tagsWrap.classList.toggle('is-hidden',['task','event','communication'].includes(type));
    catWrap.classList.remove('is-hidden');
    const contentText=document.getElementById('contentText');
    contentText.textContent = type==='prompt'?'Prompt 指令 / Prompt':type==='bookmark'?'為什麼收藏 / Why I Saved It':type==='communication'?'訊息內容 / Notes':type==='task'||type==='event'?'備註 / Notes':'內容 / Content';
  }

  function setEventAllDayControls(allDay){
    const dateInputs=['eventStart','eventEnd'].map(id=>document.getElementById(id));
    dateInputs.forEach((input,index)=>{
      const defaultTime=index===0?'09:00':'09:30';
      if(allDay){
        const [date,time='']=input.value.split('T');
        if(time)input.dataset.restoreTime=time;
        input.type='date';
        input.value=date||today();
      }else{
        const [currentDate,currentTime='']=input.value.split('T');
        const date=currentDate||today();
        const time=input.dataset.restoreTime||currentTime||defaultTime;
        input.type='datetime-local';
        input.value=`${date}T${time}`;
      }
    });
  }

  function renderStyleEditor(){
    const el=document.getElementById('styleImageEditor');
    el.innerHTML = editingPromptImages.length ? editingPromptImages.map((img,i)=>`<div class="style-edit-thumb"><img src="${escapeAttr(imageSrc(img))}" alt=""><small>${imageDims(img)}</small><button type="button" class="style-remove" data-remove-style="${i}">×</button></div>`).join('') : `<div class="day-empty">${lang()==='zh'?'尚未加入圖片。可貼圖片網址或從電腦選取。':'No images yet. Add URLs or upload files.'}</div>`;
    el.querySelectorAll('[data-remove-style]').forEach(b=>b.addEventListener('click',async()=>{const index=Number(b.dataset.removeStyle),image=editingPromptImages[index];const removed=await window.IAN_OS_DELETE.run({name:image?.file_name||image?.name||(lang()==='zh'?'風格參考圖':'Style image'),action:async()=>{}});if(!removed)return;editingPromptImages.splice(index,1);renderStyleEditor();}));
  }

  async function saveCapture(e){
    e.preventDefault();
    const type=document.getElementById('captureType').value;
    const editingId=document.getElementById('editingId').value;
    const existing=editingId?findItem(editingId):null;
    const createdAt=existing?.createdAt||today(); const updatedAt=today();
    const title=document.getElementById('captureTitle').value.trim();
    const content=type==='bookmark'?(existing?.content??''):document.getElementById('captureContent').value;
    const category=document.getElementById('captureCategory').value.trim()||'Uncategorized';
    if(existing && existing.type!==type){toast(ui('編輯時請保留原本類型。'));return;}
    if(type==='event'){
      const start=document.getElementById('eventStart').value,end=document.getElementById('eventEnd').value,allDay=document.getElementById('eventAllDay').checked;
      const valid=allDay?/^\d{4}-\d{2}-\d{2}$/.test(start)&&/^\d{4}-\d{2}-\d{2}$/.test(end)&&end>=start:Number.isFinite(+new Date(start))&&Number.isFinite(+new Date(end))&&new Date(end)>=new Date(start);
      if(!valid){toast(ui(allDay?'請設定有效的開始與結束日期，結束不可早於開始。':'請設定有效的開始與結束時間，結束不可早於開始。'));return;}
    }
    if(type==='communication'&&!Number.isFinite(+new Date(document.getElementById('commDateTime').value))){toast(ui('請設定有效的訊息時間。'));return;}
    if(type==='bookmark'&&!safeExternalHref(document.getElementById('bookmarkUrl').value.trim())){toast(lang()==='zh'?'請輸入有效的 http:// 或 https:// 網址':'Enter a valid http:// or https:// URL');document.getElementById('bookmarkUrl').focus();return;}
    if(!title){toast(lang()==='zh'?'請輸入標題':'Please enter a title');return;}
    let item;
    if(['note','prompt','skill','video','bookmark'].includes(type)){
      item={...(existing||{}),id:existing?.id||window.IAN_OS_CLOUD.uuid(),type,title,description:['note','bookmark'].includes(type)?(existing?.description||''):document.getElementById('captureDescription').value,category:document.getElementById('captureCategory').value.trim()||'Uncategorized',tags:window.IAN_OS_INPUT.normalize(document.getElementById('captureTags').value),content,favorite:document.getElementById('captureFavorite').checked,createdAt,updatedAt};
      if(type==='note') item.videoUrl=document.getElementById('noteVideoUrl').value.trim();
      if(type==='bookmark') item.url=document.getElementById('bookmarkUrl').value.trim();
      if(type==='video'){ item.url=document.getElementById('videoUrl').value.trim(); item.thumbnailUrl=document.getElementById('videoThumbnailUrl').value.trim(); }
      if(type==='prompt'){
        const urls=document.getElementById('promptImageUrls').value.split('\n').map(s=>s.trim()).filter(Boolean);
        try {
          const originals=[...editingPromptImages,...urls.map(src=>({src,name:'URL image',width:0,height:0,size:0,mime:'remote'}))]
            .filter((x,i,a)=>a.findIndex(y=>imageSrc(y)===imageSrc(x))===i).slice(0,30);
          item.styleImages=[];
          for(const image of originals){
            if(image.storage_path){item.styleImages.push(image);continue;}
            let file=image.file;
            if(!file && image.src?.startsWith('data:image/')){file=await (await fetch(image.src)).blob();}
            if(!file && /^https:\/\//i.test(image.src||'')){
              const response=await fetch(image.src,{mode:'cors'});if(!response.ok)throw new Error('Cannot fetch remote image');
              file=await response.blob();
            }
            if(!file)throw new Error('Cannot migrate image');
            const meta=await window.IAN_OS_CLOUD.uploadPromptStyleImage(file,item.id,{...image,sort_order:item.styleImages.length});
            item.styleImages.push({...meta,src:await window.IAN_OS_CLOUD.signedFileUrl(meta.storage_path)});
          }
        } catch {toast(ui('圖片無法上傳私人儲存空間；請檢查連線或改用檔案上傳。原資料尚未儲存。'));return;}
      }
    } else if(type==='task') item={...(existing||{}),id:existing?.id||window.IAN_OS_CLOUD.uuid(),type,title,notes:content,dueDate:document.getElementById('taskDueMode').value==='none'?'':(document.getElementById('taskDueDate').value||''),priority:document.getElementById('taskPriority').value,status:document.getElementById('taskStatus').value,scope:document.getElementById('taskScope').value,remindAt:document.getElementById('taskReminder').value?new Date(document.getElementById('taskReminder').value).toISOString():'',createdAt,updatedAt};
    else if(type==='event') item={...(existing||{}),category:document.getElementById('captureCategory').value||'Uncategorized',id:existing?.id||window.IAN_OS_CLOUD.uuid(),type,title,notes:content,start:document.getElementById('eventStart').value,end:document.getElementById('eventEnd').value,eventType:document.getElementById('eventType').value,allDay:document.getElementById('eventAllDay').checked,completed:document.getElementById('eventCompleted').checked,createdAt,updatedAt};
    else item={...(existing||{}),id:existing?.id||window.IAN_OS_CLOUD.uuid(),type:'communication',subject:title,notes:content,channel:document.getElementById('commChannel').value,direction:document.getElementById('commDirection').value,status:document.getElementById('commStatus').value,contact:document.getElementById('commContact').value.trim(),dateTime:document.getElementById('commDateTime').value,createdAt,updatedAt};

    if(!compactKnowledgeCapture(type))item.checklist=planning.readChecklist();
    item.category=category;
    if(type==='event'){const atLocalNoon=date=>new Date(`${date}T12:00:00`).toISOString();if(item.allDay){item.start=atLocalNoon(item.start);item.end=atLocalNoon(item.end);}else{item.start=new Date(item.start).toISOString();item.end=new Date(item.end).toISOString();}}
    if(type==='communication')item.dateTime=new Date(item.dateTime).toISOString();
    const collection=collectionForType(type); const arr=state[collection];
    if(existing){const idx=arr.findIndex(x=>x.id===existing.id);if(idx>=0)arr[idx]=item;} else arr.unshift(item);
    saveState();
    try{
      await window.IAN_OS_CLOUD.flushSave();
      if(!compactKnowledgeCapture(type))item.attachments=await window.IAN_OS_ATTACHMENTS.commit(type,item.id);
    }catch(error){
      if(!compactKnowledgeCapture(type))item.attachments=window.IAN_OS_ATTACHMENTS.current(true);
      document.getElementById('editingId').value=item.id;
      document.getElementById('captureType').disabled=true;
      document.getElementById('captureTitleText').textContent=lang()==='zh'?'編輯資料':'Edit item';
      toast((lang()==='zh'?'資料已儲存；圖片尚未全部同步，可直接再次儲存重試：':'Item saved; some images are still pending. Save again to retry: ')+(error?.message||''));return;
    }
    closeCapture(true); toast(lang()==='zh'?'已更新本機展示資料':'Updated and synced');
    activeFilter='All';
    if(type==='prompt'){ currentView='prompts'; detailId=null; syncNav(); render(); openPrompt(item.id); }
    else if(type==='video'){currentView='videos';detailId=null;syncNav();render();openVideo(item.id);}
    else {currentView=type==='note'?'notes':type==='skill'?'skills':type==='bookmark'?'bookmarks':type==='task'?'tasks':type==='event'?'calendar':'communications';detailId=type==='bookmark'?null:item.id;syncNav();render();}
  }

  function collectionForType(type){ return ({note:'notes',prompt:'prompts',skill:'skills',video:'videos',bookmark:'bookmarks',task:'tasks',event:'events',communication:'communications'})[type]; }
  function findItem(id){ for(const k of ['notes','prompts','skills','videos','bookmarks','tasks','events','communications','projects']){const x=state[k]?.find(i=>i.id===id);if(x)return x;} return null; }
  function toggleFavorite(id, rerender=true){ const x=findItem(id);if(x&&'favorite'in x){x.favorite=!x.favorite;x.updatedAt=today();saveState();render();} }

  async function compressImage(file){
    const raw=await fileToDataURL(file); if(file.size<300000) return raw;
    return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const max=1200;const scale=Math.min(1,max/img.width);const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.8));};img.onerror=reject;img.src=raw;});
  }
  function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
  async function copyText(text){try{await navigator.clipboard.writeText(text);}catch{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}toast(lang()==='zh'?'已複製到剪貼簿':'Copied');}

  function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`open-os-public-v0.3-${today()}.json`;a.click();URL.revokeObjectURL(url);toast(lang()==='zh'?'JSON 已匯出':'JSON exported');}
  function resetData(){if(!confirm(lang()==='zh'?'確定要清除這個瀏覽器的展示資料並恢復範例？':'Reset local demo data?'))return;state=normalizeState(window.IAN_OS_CLOUD.remapLegacy(cloneSeed()));saveState();currentView='home';detailId=null;query='';searchInput.value='';calendarCursor=monthStart(new Date());selectedDay=today();syncNav();applyStaticI18n();render();}
  function syncBrandAssets(){const dark=document.documentElement.dataset.theme==='dark';document.querySelectorAll('img[data-brand-light][data-brand-dark]').forEach(image=>{const next=dark?image.dataset.brandDark:image.dataset.brandLight;if(image.getAttribute('src')!==next)image.setAttribute('src',next);});}
  function initTheme(){const saved=safeStorageGet(THEME_KEY);if(saved)document.documentElement.dataset.theme=saved;else if(window.matchMedia?.('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark';syncBrandAssets();}
  function toggleTheme(){const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;safeStorageSet(THEME_KEY,next);syncBrandAssets();}
  function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1700);}

  function greeting(){const h=new Date().getHours();if(lang()==='en')return h<12?'Good morning':h<18?'Good afternoon':'Good evening';return h<12?'早安':h<18?'午安':'晚安';}
  function today(){return dateKey(new Date());}
  function formatLongDate(d){return new Intl.DateTimeFormat(lang()==='zh'?'zh-TW':'en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(d);}
  function formatDateFromISO(s){const d=new Date(`${s}T12:00:00`);return new Intl.DateTimeFormat(lang()==='zh'?'zh-TW':'en-US',{weekday:'short',month:'long',day:'numeric'}).format(d);}
  function formatTime(s){if(!s)return'—';const d=new Date(s);return new Intl.DateTimeFormat(lang()==='zh'?'zh-TW':'en-US',{hour:'numeric',minute:'2-digit'}).format(d);}
  function formatDateTime(s){if(!s)return'—';const d=new Date(s);return new Intl.DateTimeFormat(lang()==='zh'?'zh-TW':'en-US',{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d);}
  function toLocalInput(s){if(!s)return'';const d=new Date(s);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
  function taskSort(a,b){const p={high:0,medium:1,low:2};return (a.dueDate||'9999').localeCompare(b.dueDate||'9999')||(p[a.priority]-p[b.priority]);}
  function priorityLabel(x){if(lang()==='en')return ({high:'High',medium:'Medium',low:'Low'})[x]||x;return ({high:'高',medium:'中',low:'低'})[x]||x;}
  function statusLabel(x){if(lang()==='en')return ({todo:'To do',reminder:'Reminder',doing:'In progress',done:'Done',cancelled:'Cancelled',archived:'Archived','follow-up':'Follow-up',waiting:'Waiting'})[x]||x;return ({todo:'待處理',reminder:'提醒',doing:'進行中',done:'完成',cancelled:'已取消',archived:'已封存','follow-up':'需追蹤',waiting:'等待回覆'})[x]||x;}
  function directionLabel(x){return lang()==='en'?(x==='sent'?'Sent / Replied':'Received'):(x==='sent'?'已回覆 / 寄出':'收到');}
})();
