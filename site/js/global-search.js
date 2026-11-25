(() => {
  'use strict';
  function mount({getData,open,activate,deactivate,owner}) {
    const logic=window.IAN_OS_GLOBAL_SEARCH_LOGIC;
    const trigger=document.getElementById('globalSearch');
    const mobile=document.getElementById('globalSearchMobile');
    const overlay=document.getElementById('globalSearchOverlay');
    const input=document.getElementById('globalSearchDialogInput');
    const results=document.getElementById('globalSearchResults');
    const status=document.getElementById('globalSearchStatus');
    const closeButton=document.getElementById('globalSearchClose');
    let timer,groups=[],expanded=new Set(),selected=-1,origin=null;
    const storageKey=()=>`open-os-public-global-search:${owner()||'anonymous'}`;
    const read=()=>{try{const value=JSON.parse(localStorage.getItem(storageKey()));return Array.isArray(value)?value.filter(x=>typeof x==='string').slice(0,5):[];}catch{return [];}};
    const remember=value=>{const term=value.trim();if(!term)return;try{localStorage.setItem(storageKey(),JSON.stringify([term,...read().filter(x=>x!==term)].slice(0,5)));}catch{}};
    function mark(node,value,term){
      const source=String(value??''),needle=term.trim();
      if(!needle){node.textContent=source;return;}
      const lower=source.toLocaleLowerCase(),match=needle.toLocaleLowerCase();let from=0,index;
      while((index=lower.indexOf(match,from))!==-1){node.append(document.createTextNode(source.slice(from,index)));const marked=document.createElement('mark');marked.textContent=source.slice(index,index+needle.length);node.append(marked);from=index+needle.length;}
      node.append(document.createTextNode(source.slice(from)));
    }
    function description(key,item){return ({notes:item.content,bookmarks:item.description||item.url,tasks:item.notes,events:item.location||item.description,communications:item.contact||item.notes,projects:item.description,creditCards:item.bank||item.last4,trips:item.destination,restaurants:item.city||item.cuisine,vendors:item.contactPerson||item.phone,prompts:item.description,skills:item.description,videos:item.description})[key]||'';}
    function title(key,item){return key==='communications'?item.subject:item.title||item.name||'未命名';}
    function allButtons(){return [...results.querySelectorAll('.global-search-result')];}
    function select(index){const buttons=allButtons();if(!buttons.length)return;selected=(index+buttons.length)%buttons.length;buttons.forEach((button,i)=>{button.classList.toggle('is-selected',i===selected);button.setAttribute('aria-selected',String(i===selected));});input.setAttribute('aria-activedescendant',buttons[selected].id);buttons[selected].scrollIntoView({block:'nearest'});}
    function draw(){
      results.replaceChildren();selected=-1;input.removeAttribute('aria-activedescendant');
      const term=input.value.trim();
      if(!term){status.textContent='輸入關鍵字搜尋已載入資料';const recent=read();if(recent.length){const heading=document.createElement('h3');heading.textContent='最近搜尋';results.append(heading);recent.forEach(value=>{const button=document.createElement('button');button.type='button';button.className='global-search-recent';button.textContent=value;button.onclick=()=>{input.value=value;run();input.focus({preventScroll:true});};results.append(button);});}return;}
      const count=groups.reduce((sum,g)=>sum+g.count,0);status.textContent=`找到 ${count} 筆結果`;
      if(!count){const empty=document.createElement('p');empty.className='global-search-empty';empty.textContent='找不到符合的項目，請嘗試其他關鍵字。';results.append(empty);return;}
      groups.forEach(group=>{
        const section=document.createElement('section');section.className='global-search-group';
        const heading=document.createElement('h3');heading.textContent=`${group.label} · ${group.count}`;section.append(heading);
        logic.visible(group,expanded.has(group.key)).forEach((item,index)=>{
          const button=document.createElement('button');button.type='button';button.className='global-search-result';button.id=`global-search-${group.key}-${index}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
          const name=document.createElement('strong');mark(name,title(group.key,item),term);
          const detail=document.createElement('span');mark(detail,description(group.key,item),term);button.append(name,detail);
          button.onclick=()=>{remember(term);close();open(group.key,item);};section.append(button);
        });
        if(group.count>5&&!expanded.has(group.key)){const more=document.createElement('button');more.type='button';more.className='global-search-more';more.textContent=`顯示更多（${group.count-5}）`;more.onclick=()=>{expanded.add(group.key);draw();input.focus({preventScroll:true});};section.append(more);}
        results.append(section);
      });
    }
    function run(){clearTimeout(timer);groups=logic.search(getData(),input.value);expanded.clear();draw();}
    function show(from){if(!overlay.hidden)return;origin=from||document.activeElement;overlay.hidden=false;trigger.setAttribute('aria-expanded','true');mobile.setAttribute('aria-expanded','true');activate(overlay);input.value='';run();}
    function close(){if(overlay.hidden)return;clearTimeout(timer);overlay.hidden=true;trigger.setAttribute('aria-expanded','false');mobile.setAttribute('aria-expanded','false');deactivate(overlay);if(origin?.isConnected)requestAnimationFrame(()=>origin.focus({preventScroll:true}));}
    trigger.readOnly=true;trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.addEventListener('click',()=>show(trigger));trigger.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();show(trigger);}});
    mobile.addEventListener('click',()=>show(mobile));closeButton.addEventListener('click',close);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(run,150);});
    input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();select(selected+(event.key==='ArrowDown'?1:-1));}else if(event.key==='Enter'){event.preventDefault();const button=allButtons()[selected]||allButtons()[0];if(button)button.click();else if(input.value.trim())remember(input.value);}});
    document.addEventListener('keydown',event=>{
      if(!overlay.hidden&&event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();close();return;}
      if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.isComposing&&overlay.hidden&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!document.activeElement?.isContentEditable){event.preventDefault();event.stopImmediatePropagation();show(document.activeElement);}
    },true);
    return {show,close};
  }
  window.IAN_OS_GLOBAL_SEARCH={mount};
})();
