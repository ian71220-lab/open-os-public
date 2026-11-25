/* OPEN OS v1.0.4.4 — shared notification surfaces; reads existing owner-scoped RPCs. */
(() => {
  'use strict';
  const rpc=(name,args={})=>window.IAN_OS_CLOUD.automationRequest(name,args);
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const bell=document.getElementById('notificationBell');
  const badge=document.getElementById('notificationBadge');
  const dropdown=document.getElementById('notificationDropdown');
  const itemsHost=document.getElementById('notificationDropdownItems');
  let active=false,loading=false,refreshTimer=null,tickerTimer=null,latest=[],unread=0,homeContext=null,tickerItems=[],tickerIndex=0;
  const category=n=>n.source==='phase2'?(/旅遊|旅程|出發|travel/i.test(n.title||'')?'travel':'credit'):'general';
  const label={credit:'信用卡',travel:'旅遊',general:'背景提醒'};
  const stamp=value=>{try{return new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));}catch{return '';}};
  const homeElement=()=>document.querySelector('[data-home-alert-ticker]');
  const currentUser=()=>window.IAN_OS_CLOUD?.user?.();
  function renderDropdown(){
    if(!active)return;
    badge.hidden=unread===0;
    badge.textContent=unread>99?'99+':String(unread);
    bell.setAttribute('aria-label',unread?`站內通知，${unread} 則未讀`:'站內通知，沒有未讀訊息');
    itemsHost.innerHTML=latest.length?latest.slice(0,8).map(n=>`<article class="notification-dropdown-item notification-kind--${category(n)} ${n.read_at?'is-read':'is-unread'}"><span class="notification-kind">${label[category(n)]}</span><strong>${safe(n.title)}</strong><p>${safe(n.message)}</p><small>${safe(stamp(n.created_at))}</small><div class="notification-dropdown-actions">${n.read_at?`<button type="button" data-notice-delete="${safe(n.id)}" data-source="${n.source}">刪除</button>`:`<button type="button" data-notice-read="${safe(n.id)}" data-source="${n.source}">標記已讀</button>`}</div></article>`).join(''):'<p class="notification-dropdown-empty">目前沒有站內通知。</p>';
  }
  function showTicker(){
    const root=homeElement();if(!root||!homeContext)return;
    const display=root.querySelector('[data-ticker-message]'),count=root.querySelector('[data-ticker-count]');
    if(!tickerItems.length){display.textContent='目前沒有即將到期或未讀的重要提醒。';count.textContent='';root.dataset.kind='none';return;}
    tickerIndex=((tickerIndex%tickerItems.length)+tickerItems.length)%tickerItems.length;
    const item=tickerItems[tickerIndex];display.textContent=item.text;root.dataset.kind=item.kind;
    count.textContent=`${tickerIndex+1} / ${tickerItems.length}`;
  }
  function parseDay(raw){
    const s=String(raw||'').trim();
    if(/^\d{1,2}$/.test(s))return Number(s);
    const m=/^\d{4}-\d{1,2}-(\d{1,2})(?:T.*)?$/.exec(s);
    return m?Number(m[1]):0;
  }
  function dayUTC(iso){return new Date(`${iso}T12:00:00Z`);}
  function formatISO(date){return date.toISOString().slice(0,10);}
  function localToday(zone){try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone||'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=k=>parts.find(p=>p.type===k)?.value;return `${v('year')}-${v('month')}-${v('day')}`;}catch{return formatISO(new Date());}}
  function nextCredit(raw,today){
    const dom=parseDay(raw);if(dom<1||dom>31)return null;
    const base=dayUTC(today);
    for(let step=0;step<3;step++){
      const y=base.getUTCFullYear(),m=base.getUTCMonth()+step;
      const first=new Date(Date.UTC(y,m,1,12)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0,12)).getUTCDate();
      const target=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(dom,last),12));
      if(target>=base)return formatISO(target);
    }
    return null;
  }
  function daysAway(iso,today){return Math.round((dayUTC(iso)-dayUTC(today))/86400000);}
  async function refreshHome(){
    if(!active||!homeContext||!homeElement())return;
    const owner=currentUser()?.id;
    let rules=[];
    try{rules=await rpc('ian_phase2_list');}catch(error){const display=homeElement()?.querySelector('[data-ticker-message]');if(display)display.textContent='重要提醒暫時無法載入，請稍後重新整理。';return;}
    if(!active||currentUser()?.id!==owner||!homeElement())return;
    const sources=homeContext;
    const upcoming=[];
    for(const r of rules){
      if(!r.enabled||r.archived)continue;
      const travel=r.source_type==='travel_departure';
      const src=(travel?sources.trips:sources.creditCards).find(x=>x.id===r.source_id);
      if(!src)continue;
      const today=localToday(r.timezone);
      const iso=travel?String(src.start||'').slice(0,10):nextCredit(src[r.source_type==='credit_due'?'dueDate':'closingDate'],today);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))continue;
      const left=daysAway(iso,today);
      if(left<0||left>(travel?60:45))continue;
      if(travel&&!Array.isArray(src.checklist))continue;
      if(travel&&!src.checklist.some(c=>c?.text?.trim()&&!c.done))continue;
      const title=String(src.title||src.name||'未命名').slice(0,90);
      const kind=travel?'travel':'credit';
      const prefix=travel?'旅遊出發':r.source_type==='credit_due'?'信用卡繳款':'信用卡結帳';
      upcoming.push({kind,days:left,text:`${prefix} · ${title}｜${iso}（${left===0?'今天':`還有 ${left} 天`}）`});
    }
    const unreadItems=latest.filter(n=>!n.read_at&&!/^【手動測試】/.test(n.title||'')).slice(0,5).map(n=>({kind:category(n),days:-1,text:`未讀 · ${n.title}｜${String(n.message||'').replace(/\s+/g,' ').slice(0,110)}`}));
    upcoming.sort((a,b)=>a.days-b.days);
    tickerItems=[...unreadItems,...upcoming].slice(0,10);
    tickerIndex=0;showTicker();
  }
  async function refresh(){
    if(!active||loading||!currentUser())return;
    loading=true;const owner=currentUser().id;
    try{
      const [general,phase2,count]=await Promise.all([
        rpc('ian_auto_inbox',{p_before:null,p_before_id:null}),
        rpc('ian_phase2_inbox',{p_before:null,p_before_id:null}),
        rpc('ian_notify_unread_count')
      ]);
      if(!active||currentUser()?.id!==owner)return;
      latest=[...(general||[]).map(n=>({...n,source:'general'})),...(phase2||[]).map(n=>({...n,source:'phase2'}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,30);
      unread=Math.max(0,Number(count)||0);renderDropdown();
      await refreshHome();
    }catch(error){if(active&&dropdown&&!dropdown.hidden)itemsHost.innerHTML=`<p class="notification-dropdown-empty">通知載入失敗：${safe(error.message)}。請確認增量 SQL 已安裝。</p>`;}
    finally{loading=false;}
  }
  function open(value){
    dropdown.hidden=!value;bell.setAttribute('aria-expanded',String(value));
    if(value)refresh();
  }
  async function updateNote(button,kind){
    if(button.disabled)return;
    if(kind==='delete'&&!confirm('確定刪除這筆已讀通知？刪除後不再顯示。'))return;
    const source=button.dataset.source,id=kind==='delete'?button.dataset.noticeDelete:button.dataset.noticeRead;
    const action=source==='phase2'?(kind==='delete'?'ian_phase2_delete_read':'ian_phase2_read'):(kind==='delete'?'ian_auto_delete_read':'ian_auto_read');
    button.disabled=true;
    try{const ok=await rpc(action,{p_id:id});if(!ok)throw new Error('通知已變更，請重新整理。');if(kind==='delete'){latest=latest.filter(n=>!(n.id===id&&n.source===source));}else{latest=latest.map(n=>n.id===id&&n.source===source?{...n,read_at:new Date().toISOString()}:n);}renderDropdown();document.dispatchEvent(new Event('open-os-public-notification-changed'));}
    catch(e){button.textContent=e.message;button.disabled=false;}
  }
  function mountHome({app,creditCards,trips}){
    clearInterval(tickerTimer);tickerTimer=null;
    homeContext={creditCards:Array.isArray(creditCards)?creditCards:[],trips:Array.isArray(trips)?trips:[]};
    const root=app.querySelector('[data-home-alert-ticker]');if(!root)return;
    root.querySelector('[data-ticker-prev]').onclick=()=>{tickerIndex--;showTicker();};
    root.querySelector('[data-ticker-next]').onclick=()=>{tickerIndex++;showTicker();};
    root.querySelector('[data-ticker-open]').onclick=()=>{open(true);};
    tickerTimer=setInterval(()=>{if(root.isConnected&&!root.matches(':hover')&&!root.contains(document.activeElement)&&!document.hidden){tickerIndex++;showTicker();}},7000);
    showTicker();if(active)refreshHome();
  }
  function start(){
    if(active){refresh();return;}
    active=true;bell.hidden=false;refresh();
    refreshTimer=setInterval(()=>{if(!document.hidden)refresh();},90000);
  }
  function stop(){
    active=false;latest=[];unread=0;homeContext=null;tickerItems=[];
    clearInterval(refreshTimer);clearInterval(tickerTimer);refreshTimer=null;tickerTimer=null;
    dropdown.hidden=true;bell.hidden=true;badge.hidden=true;bell.setAttribute('aria-expanded','false');
  }
  bell.addEventListener('click',()=>open(dropdown.hidden));
  document.getElementById('notificationRefresh').addEventListener('click',refresh);
  document.getElementById('notificationAll').addEventListener('click',()=>{
    open(false);document.querySelector('[data-view="automations"]')?.click();
    requestAnimationFrame(()=>document.querySelector('[data-notification-center]')?.scrollIntoView({behavior:'smooth',block:'start'}));
  });
  itemsHost.addEventListener('click',event=>{
    const del=event.target.closest('[data-notice-delete]'),read=event.target.closest('[data-notice-read]');
    if(del)updateNote(del,'delete');else if(read)updateNote(read,'read');
  });
  document.addEventListener('click',event=>{const path=event.composedPath();if(!dropdown.hidden&&!path.includes(dropdown)&&!path.includes(bell)&&!event.target.closest('[data-ticker-open]'))open(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dropdown.hidden){open(false);bell.focus();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)refresh();});
  document.addEventListener('open-os-public-notification-changed',()=>{if(active)refresh();});
  bell.hidden=true;
  window.IAN_OS_NOTIFICATIONS={start,stop,refresh,mountHome};
})();
