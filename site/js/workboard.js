(() => {
  'use strict';
  const asList=value=>Array.isArray(value)?value:[];
  const time=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0;};
  const recent=(a,b)=>time(b.updatedAt||b.dateTime||b.created_at)-time(a.updatedAt||a.dateTime||a.created_at);
  // Topic research: user-entered ideas kept in the synced preferences. Pure helpers so they can be tested directly.
  const TOPIC_STATUSES=[['new','新發現'],['researching','研究中'],['ready','可產出'],['used','已使用']];
  const TOPIC_LIMIT=100, TOPIC_TITLE_MAX=120, TOPIC_NOTE_MAX=300;
  const topicLabel=status=>(TOPIC_STATUSES.find(([key])=>key===status)||TOPIC_STATUSES[0])[1];
  const nextTopicStatus=status=>{const i=TOPIC_STATUSES.findIndex(([key])=>key===status);return TOPIC_STATUSES[(i<0?0:i+1)%TOPIC_STATUSES.length][0];};
  function safeUrl(value){const text=String(value||'').trim();if(!text)return '';try{const url=new URL(text);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
  function normalizeTopic(input={},existingCount=0,now=new Date()){
    const title=String(input.title||'').trim().slice(0,TOPIC_TITLE_MAX);
    if(!title)return {error:'請輸入話題標題。'};
    if(String(input.url||'').trim()&&!safeUrl(input.url))return {error:'來源連結需以 http:// 或 https:// 開頭。'};
    if(existingCount>=TOPIC_LIMIT)return {error:`話題最多 ${TOPIC_LIMIT} 筆，請先移除舊項目。`};
    const iso=now.toISOString();
    return {value:{id:`topic-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2,7)}`,title,url:safeUrl(input.url),note:String(input.note||'').trim().slice(0,TOPIC_NOTE_MAX),status:'new',createdAt:iso,updatedAt:iso}};
  }
  function collect(state={},remoteRules=[],notifications=[]){
    const tasks=asList(state?.tasks),communications=asList(state?.communications);
    const pending=[...tasks.filter(x=>['todo','reminder'].includes(x.status)).map(item=>({kind:'task',item,title:item.title||'未命名待辦',detail:item.notes||''})),...communications.filter(x=>x.status==='follow-up').map(item=>({kind:'communication',item,title:item.subject||item.contact||'待追蹤訊息',detail:item.contact||''}))].sort((a,b)=>recent(a.item,b.item));
    const active=tasks.filter(x=>x.status==='doing').sort(recent).map(item=>({kind:'task',item,title:item.title||'未命名待辦',detail:item.notes||''}));
    const done=tasks.filter(x=>x.status==='done').sort(recent).map(item=>({kind:'task',item,title:item.title||'未命名待辦',detail:item.notes||''}));
    const rules=asList(remoteRules).filter(x=>x?.enabled&&!x.archived).map(item=>({kind:'rule',item,title:item.name||'未命名規則',detail:item.last_execution?.status==='running'?'最近執行：執行中':item.next_run_at?'已啟用，等待排程':'已啟用'}));
    const unread=asList(notifications).filter(x=>x&&!x.read_at).map(item=>({kind:'notice',item,title:item.title||'未讀通知',detail:item.message||''}));
    const topics=asList(state?.settings?.preferences?.topicResearch).filter(x=>x&&x.id).slice().sort(recent).map(item=>({kind:'topic',item,title:item.title||'未命名話題',detail:item.note||''}));
    return {pending,active,done,rules,unread,topics};
  }
  function mount({root,getState,onOpen,saveTopics}){
    const section=document.createElement('section');section.className='panel ian-workboard';section.setAttribute('aria-labelledby','ianWorkboardTitle');
    const header=document.createElement('div');header.className='ian-workboard-heading';
    const heading=document.createElement('div'),eyebrow=document.createElement('span'),title=document.createElement('h2'),intro=document.createElement('p');
    eyebrow.className='eyebrow';eyebrow.textContent='WORK OVERVIEW';title.id='ianWorkboardTitle';title.textContent='工作看板';intro.textContent='依現有待辦、訊息紀錄與背景規則整理。狀態以已儲存資料為準。';heading.append(eyebrow,title,intro);header.append(heading);
    const status=document.createElement('p');status.className='ian-workboard-status';status.setAttribute('role','status');status.textContent='背景規則載入中';header.append(status);section.append(header);
    const groups=document.createElement('div');groups.className='ian-workboard-grid';section.append(groups);
    const rulesHost=document.createElement('div');rulesHost.className='ian-workboard-rules';section.append(rulesHost);
    root.querySelector('.automation-page-head')?.after(section);
    let remoteRules=[],notifications=[],loaded=false;
    function list(host,items,limit){
      if(!items.length){const empty=document.createElement('p');empty.className='ian-workboard-empty';empty.textContent='目前沒有項目';host.append(empty);return;}
      const ul=document.createElement('ul');ul.className='ian-workboard-list';
      for(const entry of items.slice(0,limit)){
        const li=document.createElement('li'),button=document.createElement('button'),name=document.createElement('strong');
        button.type='button';button.className='ian-workboard-item';name.textContent=entry.title;button.append(name);if(entry.detail){const detail=document.createElement('small');detail.textContent=entry.detail;button.append(detail);}button.onclick=()=>onOpen(entry.kind,entry.item);li.append(button);ul.append(li);
      }
      host.append(ul);
      if(items.length>limit){const more=document.createElement('p');more.className='ian-workboard-more';more.textContent=`另有 ${items.length-limit} 筆，請到原模組查看。`;host.append(more);}
    }
    function draw(){if(!section.isConnected)return;const data=collect(getState(),remoteRules,notifications);groups.replaceChildren();rulesHost.replaceChildren();
      for(const [label,key] of [['待你處理','pending'],['進行中','active'],['已完成','done']]){
        const card=document.createElement('section');card.className=`ian-workboard-column ian-workboard-${key}`;
        const h=document.createElement('h3'),count=document.createElement('span');h.textContent=label;count.textContent=String(data[key].length);h.append(count);card.append(h);list(card,data[key],5);groups.append(card);
      }
      const h=document.createElement('h3'),count=document.createElement('span');h.textContent='已啟用的背景規則';count.textContent=loaded?String(data.rules.length):'—';h.append(count);rulesHost.append(h);
      if(loaded){list(rulesHost,data.rules,5);if(data.unread.length){const note=document.createElement('p');note.className='ian-workboard-note';note.textContent=`另有 ${data.unread.length} 則未讀背景通知，請在下方「站內通知」查看。`;rulesHost.append(note);}}
      else{const p=document.createElement('p');p.className='ian-workboard-empty';p.textContent='正在讀取背景規則';rulesHost.append(p);}
      const topicCard=document.createElement('section');topicCard.className='ian-workboard-column ian-workboard-topics';
      const th=document.createElement('h3'),tc=document.createElement('span');th.textContent='話題研究';tc.textContent=String(data.topics.length);th.append(tc);topicCard.append(th);
      drawTopics(topicCard,data.topics);groups.append(topicCard);
    }
    function currentTopics(){return asList(getState()?.settings?.preferences?.topicResearch);}
    function saveList(next){if(typeof saveTopics==='function'){saveTopics(next);draw();}}
    function drawTopics(card,topics){
      const form=document.createElement('div');form.className='ian-topic-form';
      const title=document.createElement('input');title.type='text';title.maxLength=TOPIC_TITLE_MAX;title.placeholder='新增話題標題';title.setAttribute('aria-label','話題標題');
      const url=document.createElement('input');url.type='url';url.placeholder='來源連結（選填）';url.setAttribute('aria-label','來源連結');
      const add=document.createElement('button');add.type='button';add.className='secondary-btn compact';add.textContent='加入話題';
      const message=document.createElement('p');message.className='ian-topic-message';message.setAttribute('role','status');
      const submit=()=>{
        const result=normalizeTopic({title:title.value,url:url.value},currentTopics().length);
        if(result.error){message.textContent=result.error;return;}
        saveList([result.value,...currentTopics()]);
      };
      add.onclick=submit;title.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submit();}});
      form.append(title,url,add,message);card.append(form);
      if(!topics.length){const empty=document.createElement('p');empty.className='ian-workboard-empty';empty.textContent='尚無話題。把想追蹤的主題加在上方。';card.append(empty);return;}
      const ul=document.createElement('ul');ul.className='ian-workboard-list';
      for(const entry of topics.slice(0,5)){
        const t=entry.item,li=document.createElement('li'),row=document.createElement('div');row.className='ian-topic-row';
        const status=document.createElement('button');status.type='button';status.className='ian-topic-status';status.textContent=topicLabel(t.status);status.setAttribute('aria-label',`切換狀態：${entry.title}，目前${topicLabel(t.status)}`);
        status.onclick=()=>saveList(currentTopics().map(x=>x.id===t.id?{...x,status:nextTopicStatus(x.status),updatedAt:new Date().toISOString()}:x));
        const copy=document.createElement('div');copy.className='ian-topic-copy';const name=document.createElement('strong');name.textContent=entry.title;copy.append(name);
        row.append(status,copy);
        const href=safeUrl(t.url);
        if(href){const link=document.createElement('a');link.className='ian-topic-link';link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='來源';link.setAttribute('aria-label',`開啟來源：${entry.title}`);row.append(link);}
        const remove=document.createElement('button');remove.type='button';remove.className='ian-topic-remove';remove.textContent='×';remove.setAttribute('aria-label',`移除話題：${entry.title}`);
        remove.onclick=()=>{if(window.confirm(`移除「${entry.title}」？`))saveList(currentTopics().filter(x=>x.id!==t.id));};
        row.append(remove);li.append(row);ul.append(li);
      }
      card.append(ul);
      if(topics.length>5){const more=document.createElement('p');more.className='ian-workboard-more';more.textContent=`另有 ${topics.length-5} 筆，完整清單可在此移除或更新狀態。`;card.append(more);}
    }
    draw();
    return {update(rules,notes){remoteRules=asList(rules);notifications=asList(notes);loaded=true;status.textContent='背景規則已載入';draw();},error(){status.textContent='背景規則暫時無法載入，待辦與訊息仍可查看';},refresh:draw};
  }
  if(typeof window!=='undefined')window.IAN_OS_WORKBOARD={collect,mount,normalizeTopic,nextTopicStatus,safeUrl,topicLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports={collect,normalizeTopic,nextTopicStatus,safeUrl,topicLabel};
})();
