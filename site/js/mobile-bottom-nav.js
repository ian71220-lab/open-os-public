(() => {
  'use strict';
  const media=matchMedia('(max-width:780px)');
  const sidebar=document.getElementById('sidebar');
  const sourceNav=document.getElementById('mainNavigation');
  const meta=sidebar?.querySelector('.sidebar-meta');
  const auth=document.getElementById('authGate');
  if(!sidebar||!sourceNav||!meta||!auth)return;
  const labels={navKnowledge:'知識',navLife:'生活',navWorkspace:'工作空間',other:'其他'};
  const ic=n=>globalThis.IAN_OS_ICON?.(n)||'';const icons={home:ic('home'),navKnowledge:ic('notes'),navLife:ic('home-assets'),navWorkspace:ic('grid'),other:ic('more')};
  const bar=document.createElement('nav');
  bar.id='mobileBottomNav';bar.className='mobile-bottom-nav';bar.setAttribute('aria-label','手機主要導覽');
  const buttons=new Map();
  for(const [key,name] of [['home','首頁'],['navKnowledge','知識'],['navLife','生活'],['navWorkspace','工作空間'],['other','其他']]){
    const button=document.createElement('button');button.type='button';button.dataset.bottomGroup=key;
    button.setAttribute('aria-label',name);
    if(key!=='home'){button.setAttribute('aria-controls','mobileBottomDialog');button.setAttribute('aria-expanded','false');}
    const icon=document.createElement('span');icon.className='bottom-nav-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=icons[key];
    const caption=document.createElement('span');caption.className='bottom-nav-text';caption.textContent=name;
    button.append(icon,caption);bar.append(button);buttons.set(key,button);
  }
  const overlay=document.createElement('div');overlay.className='mobile-bottom-overlay';overlay.hidden=true;
  const scrim=document.createElement('div');scrim.className='mobile-bottom-scrim';scrim.setAttribute('aria-hidden','true');
  const dialog=document.createElement('section');dialog.id='mobileBottomDialog';dialog.className='mobile-bottom-sheet';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
  const head=document.createElement('div');head.className='mobile-bottom-head';
  const heading=document.createElement('h2');heading.id='mobileBottomTitle';dialog.setAttribute('aria-labelledby',heading.id);
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='icon-btn';closeButton.setAttribute('aria-label','關閉');closeButton.textContent='×';
  head.append(heading,closeButton);
  const items=document.createElement('div');items.className='mobile-bottom-items';
  dialog.append(head,items);overlay.append(scrim,dialog);document.body.append(bar,overlay);
  let openGroup=null,trigger=null,lockedAt=0,oldBody={position:'',top:'',left:'',right:'',overflow:''},updateQueued=false;

  function groups(){
    const result={navKnowledge:[],navLife:[],navWorkspace:[],other:[]};let current=null;
    for(const child of sourceNav.children){
      if(child.classList.contains('nav-label')){current=child.dataset.i18n;continue;}
      if(!Object.hasOwn(result,current))continue;
      const primary=child.matches('.nav-item')?child:child.querySelector(':scope > .nav-item');
      if(primary)result[current].push(primary);
      if(child.matches('.nav-tree.expanded')){
        child.querySelectorAll('.nav-children .tree-item, .nav-children .tree-add').forEach(node=>{
          if(node.closest('.tree-months')&&!node.closest('.tree-year.open'))return;
          result[current].push(node);
        });
      }
    }
    result.other=[...meta.querySelectorAll(':scope > button:not([hidden])'),document.getElementById('themeBtn')].filter(Boolean);
    return result;
  }
  function groupName(key){
    const label=sourceNav.querySelector(`.nav-label[data-i18n="${key}"]`);
    return label?.textContent.trim()||labels[key];
  }
  function nameOf(node){return node.querySelector('b')?.textContent.trim()||node.getAttribute('aria-label')||node.textContent.trim();}
  function blockingDialog(){return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]:not(#mobileBottomDialog)')].some(node=>node.getClientRects().length>0);}
  function selectedGroup(){
    const active=sourceNav.querySelector('.nav-item.active')||meta.querySelector('.nav-item.active');
    if(!active)return 'home';
    if(meta.contains(active))return 'other';
    let child=active.closest('.nav-tree')||active;
    for(let item=child;item;item=item.previousElementSibling){if(item.classList.contains('nav-label'))return item.dataset.i18n;}
    return 'home';
  }
  function sync(){
    if(!auth.hidden&&openGroup)close(false);
    bar.hidden=!media.matches||!auth.hidden;
    for(const [key,button] of buttons){
      if(key!=='home'){
        const title=groupName(key);button.querySelector('.bottom-nav-text').textContent=title;button.setAttribute('aria-label',title);
        button.setAttribute('aria-expanded',String(openGroup===key));
      }
      button.classList.toggle('active',selectedGroup()===key);
      if(selectedGroup()===key)button.setAttribute('aria-current',key==='home'?'page':'true');else button.removeAttribute('aria-current');
    }
    if(!media.matches&&openGroup)close(false);
  }
  function scheduleSync(){if(updateQueued)return;updateQueued=true;queueMicrotask(()=>{updateQueued=false;sync();if(openGroup)paint(openGroup);});}
  function paint(group){
    heading.textContent=groupName(group);dialog.setAttribute('aria-label',heading.textContent);
    const fragment=document.createDocumentFragment();
    for(const source of groups()[group]){
      const button=document.createElement('button');button.type='button';button.className='mobile-bottom-item';
      button.dataset.sourceView=source.dataset.view||source.id||'';
      if(source.classList.contains('tree-item')||source.classList.contains('tree-add'))button.classList.add('is-child');
      const symbol=document.createElement('span');symbol.className='mobile-bottom-item-icon';symbol.setAttribute('aria-hidden','true');symbol.innerHTML=source.querySelector(':scope > span')?.innerHTML||''.trim()||'•';
      const caption=document.createElement('span');caption.textContent=nameOf(source);button.setAttribute('aria-label',caption.textContent);
      button.append(symbol,caption);
      button.addEventListener('click',()=>{
        if(blockingDialog())return;
        close(false);source.click();scheduleSync();
      });
      fragment.append(button);
    }
    items.replaceChildren(fragment);
  }
  function open(group,button){
    if(!media.matches||!auth.hidden)return;
    if(openGroup===group){close();return;}
    if(openGroup)close(false);
    openGroup=group;trigger=button;paint(group);
    lockedAt=window.scrollY;
    oldBody={position:document.body.style.position,top:document.body.style.top,left:document.body.style.left,right:document.body.style.right,overflow:document.body.style.overflow};
    Object.assign(document.body.style,{position:'fixed',top:`-${lockedAt}px`,left:'0',right:'0',overflow:'hidden'});
    overlay.hidden=false;sync();(items.querySelector('button')||closeButton).focus({preventScroll:true});
  }
  function close(restore=true){
    if(!openGroup)return;
    const button=trigger;openGroup=null;trigger=null;overlay.hidden=true;
    Object.assign(document.body.style,oldBody);window.scrollTo({top:lockedAt,behavior:'instant'});
    sync();if(restore)button?.focus({preventScroll:true});
  }
  bar.addEventListener('click',event=>{
    const button=event.target.closest('[data-bottom-group]');if(!button)return;
    const group=button.dataset.bottomGroup;
    if(group==='home'){
      if(blockingDialog())return;
      close(false);sourceNav.querySelector('.nav-item[data-view="home"]')?.click();scheduleSync();return;
    }
    open(group,button);
  });
  scrim.addEventListener('click',()=>close());closeButton.addEventListener('click',()=>close());
  document.addEventListener('keydown',event=>{
    if(!openGroup)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
    if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not([disabled])')];
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus({preventScroll:true});}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true});}
    else if(!dialog.contains(document.activeElement)){event.preventDefault();first.focus({preventScroll:true});}
  },true);
  function keyboard(){
    const viewport=window.visualViewport;
    const input=document.activeElement?.matches?.('input,textarea,[contenteditable="true"]');
    const covered=viewport&&window.innerHeight-viewport.height-viewport.offsetTop>120;
    bar.classList.toggle('keyboard-open',!!(input&&covered));
  }
  window.visualViewport?.addEventListener('resize',keyboard);
  window.visualViewport?.addEventListener('scroll',keyboard);
  document.addEventListener('focusin',keyboard);document.addEventListener('focusout',()=>requestAnimationFrame(keyboard));
  media.addEventListener('change',sync);
  new MutationObserver(scheduleSync).observe(sourceNav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','data-i18n'],characterData:true});
  new MutationObserver(scheduleSync).observe(meta,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden'],characterData:true});
  new MutationObserver(sync).observe(auth,{attributes:true,attributeFilter:['hidden']});
  sync();
})();
