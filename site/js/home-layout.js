(() => {
  'use strict';
  const definitions=[
    ['header','Greeting / World Clock',12],
    ['daily','Daily Workspace',12],
    ['filters','Quick Filters',12],['links','Quick Links',12],
    ['overview','System Overview',12],['calendar','Calendar',12]
  ];
  const widths={header:[12],daily:[12],filters:[12,8,6],links:[12,8,6],overview:[12],calendar:[12]};
  const namesZh={header:'問候／世界時間',daily:'每日早報／待辦／行程／訊息',filters:'快速篩選標籤',links:'常用網站',overview:'系統概況',calendar:'行事曆'};
  const defaults=()=>definitions.map(([id,,width])=>({id,visible:true,width}));
  const copy=x=>x.map(item=>({...item}));
  const normalized=source=>{
    const saved=Array.isArray(source)?source:[];
    const legacyIds=new Set(['greeting','clock','brief','tasks','quick','schedule','messages','projects']);
    if(saved.some(item=>legacyIds.has(item?.id)))return defaults();
    const byId=new Map(saved.filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
    const order=[...new Set(saved.map(x=>x?.id).filter(id=>definitions.some(d=>d[0]===id)))];
    for(const [id] of definitions)if(!order.includes(id))order.push(id);
    return order.map(id=>{const data=byId.get(id)||{};return {id,visible:data.visible!==false,width:widths[id].includes(data.width)?data.width:definitions.find(d=>d[0]===id)[2]};});
  };
  let editing=false,draft=null;

  function mount({app,preferences,save,render,lang}) {
    const zh=lang()==='zh';
    const header=app.querySelector('.home-operational');
    if(!header)return;
    app.querySelector(':scope > .home-layout-toolbar')?.remove();
    const toolbar=document.createElement('div');toolbar.className=`home-layout-toolbar${editing?' is-editing':''}`;
    if(editing){
      const status=document.createElement('span');status.className='home-layout-status';const copyBlock=document.createElement('span');copyBlock.className='home-layout-copy';copyBlock.innerHTML=`<strong>${zh?'首頁編輯模式':'Home edit mode'}</strong><small>${zh?'用 ↑ ↓ 調整順序；「隱藏」可收起模組；寬度可選滿版、2/3、1/2。完成後按「儲存首頁」。':'Use ↑ ↓ to reorder, Hide to collapse a module, and Width to resize. Press Save Home when done.'}</small>`;status.append(copyBlock);toolbar.append(status);
      const reset=document.createElement('button');reset.className='secondary-btn home-layout-reset';reset.type='button';reset.textContent=zh?'重設為預設':'Reset to Default';
      reset.onclick=()=>{draft=defaults();render();};toolbar.append(reset);
      const cancel=document.createElement('button');cancel.className='secondary-btn home-layout-cancel';cancel.type='button';cancel.textContent=zh?'取消':'Cancel';
      cancel.onclick=()=>{editing=false;draft=null;render();};toolbar.append(cancel);
      const submit=document.createElement('button');submit.className='primary-btn home-layout-save';submit.type='button';submit.textContent=zh?'儲存首頁':'Save Home';
      submit.onclick=async()=>{submit.disabled=true;submit.textContent=zh?'儲存中…':'Saving…';try{await save(copy(draft));editing=false;draft=null;render();}catch{submit.disabled=false;submit.textContent=zh?'儲存首頁':'Save Home';}};toolbar.append(submit);
    }else{
      const hint=document.createElement('span');hint.className='home-layout-copy';hint.innerHTML=`<strong>${zh?'首頁可自訂':'Customize Home'}</strong><small>${zh?'調整模組順序、隱藏或改變寬度。':'Reorder, hide, or resize modules.'}</small>`;toolbar.append(hint);
      const action=document.createElement('button');action.className='secondary-btn home-layout-toggle';action.type='button';action.textContent=zh?'編輯首頁':'Customize Home';
      action.onclick=()=>{editing=true;draft=normalized(preferences()?.homeLayout);render();};toolbar.append(action);
    }
    document.querySelectorAll('.topbar .home-layout-toggle-top').forEach(node=>node.remove());
    const phoneTopbar=!editing&&window.matchMedia('(max-width:780px)').matches&&document.querySelector('.topbar-actions');
    if(phoneTopbar){
      const entry=toolbar.querySelector('.home-layout-toggle');
      if(entry){entry.classList.add('home-layout-toggle-top');entry.innerHTML=`<span aria-hidden="true">✎</span><span class="home-layout-top-label">${zh?'自訂首頁':'Customize'}</span>`;entry.setAttribute('aria-label',zh?'編輯首頁':'Customize Home');entry.title=zh?'編輯首頁':'Customize Home';phoneTopbar.insertBefore(entry,document.getElementById('addBtn'));}
    }else app.insertBefore(toolbar,header); 
    const stored=preferences()?.homeLayout;
    if(!editing&&!Array.isArray(stored))return;

    const hero=header;
    const daily=app.querySelector('.home-daily-workspace');
    const filters=app.querySelector('.home-tags');
    const links=app.querySelector('.home-quick-links');
    const overview=app.querySelector('.system-overview');
    const calendar=app.querySelector('.home-month-card');
    if(![hero,daily,filters,links,overview,calendar].every(Boolean))return;
    const nodes={header:hero,daily,filters,links,overview,calendar};
    const homeTicker=app.querySelector('[data-home-alert-ticker]');
    const marker=document.createElement('span');marker.className='home-operational';marker.hidden=true;
    const grid=document.createElement('div');grid.className='home-layout-grid';
    app.insertBefore(marker,hero);app.insertBefore(grid,hero);
    const layout=editing?draft:normalized(stored);
    for(const item of layout){
      const wrapper=document.createElement('div');wrapper.className='home-layout-module';wrapper.dataset.module=item.id;
      wrapper.style.setProperty('--module-span',item.width);
      if(!item.visible&&!editing)wrapper.hidden=true;
      if(!item.visible&&editing)wrapper.classList.add('home-layout-hidden');
      if(editing){
        const controls=document.createElement('div');controls.className='home-layout-controls';
        const title=document.createElement('strong');title.textContent=zh?namesZh[item.id]:definitions.find(d=>d[0]===item.id)[1];controls.append(title);
        const button=(label,attr,value)=>{const b=document.createElement('button');b.type='button';b.className='secondary-btn compact';b.textContent=label;b.setAttribute(attr,value);b.setAttribute('aria-label',`${attr==='data-home-move'?(value==='-1'?(zh?'上移':'Move up'):(zh?'下移':'Move down')):label}: ${title.textContent}`);controls.append(b);};
        button(zh?'拖曳':'Drag','data-home-grip',item.id);
        button('↑','data-home-move','-1');button('↓','data-home-move','1');
        button(item.visible?(zh?'隱藏':'Hide'):(zh?'顯示':'Show'),'data-home-visible',item.id);
        const select=document.createElement('select');select.setAttribute('aria-label',`${title.textContent} ${zh?'寬度':'width'}`);select.dataset.homeWidth=item.id;
        for(const [size,label] of [[12,zh?'滿版':'Full'],[8,'2/3'],[6,'1/2'],[4,'1/3']]){if(!widths[item.id].includes(size))continue;const option=document.createElement('option');option.value=size;option.textContent=label;option.selected=item.width===size;select.append(option);}controls.append(select);
        wrapper.draggable=true;wrapper.prepend(controls);
      }
      wrapper.append(nodes[item.id]);grid.append(wrapper);
      if(item.id==='header'&&homeTicker){const slot=document.createElement('div');slot.className='home-ticker-layout-slot';slot.append(homeTicker);grid.append(slot);}
    }
    if(!editing)return;
    const move=(id,step)=>{const index=draft.findIndex(x=>x.id===id),target=index+step;if(target<0||target>=draft.length)return;[draft[index],draft[target]]=[draft[target],draft[index]];render();app.querySelector(`[data-module="${id}"] [data-home-move="${step}"]`)?.focus({preventScroll:true});};
    grid.querySelectorAll('[data-home-move]').forEach(b=>b.onclick=()=>move(b.closest('[data-module]').dataset.module,Number(b.dataset.homeMove)));
    grid.querySelectorAll('[data-home-visible]').forEach(b=>b.onclick=()=>{const item=draft.find(x=>x.id===b.dataset.homeVisible);item.visible=!item.visible;render();app.querySelector(`[data-home-visible="${item.id}"]`)?.focus({preventScroll:true});});
    grid.querySelectorAll('[data-home-width]').forEach(s=>s.onchange=()=>{const id=s.dataset.homeWidth;draft.find(x=>x.id===id).width=Number(s.value);render();app.querySelector(`[data-home-width="${id}"]`)?.focus({preventScroll:true});});
    const place=(id,target)=>{const from=draft.findIndex(x=>x.id===id),to=draft.findIndex(x=>x.id===target);if(from>=0&&to>=0&&from!==to){draft.splice(to,0,draft.splice(from,1)[0]);render();app.querySelector(`[data-home-grip="${id}"]`)?.focus({preventScroll:true});}};
    grid.querySelectorAll('[data-home-grip]').forEach(handle=>{
      handle.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;handle.setPointerCapture(e.pointerId);});
      handle.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-module]');if(target)place(handle.dataset.homeGrip,target.dataset.module);});
    });
    let dragging=null;
    grid.querySelectorAll('.home-layout-module').forEach(el=>{
      el.addEventListener('dragstart',e=>{if(e.target.closest('button,input,select,a')&&!e.target.closest('[data-home-grip]')){e.preventDefault();return;}dragging=el.dataset.module;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragging);});
      el.addEventListener('dragover',e=>{if(dragging)e.preventDefault();});
      el.addEventListener('drop',e=>{e.preventDefault();place(dragging,el.dataset.module);dragging=null;});
      el.addEventListener('dragend',()=>dragging=null);
    });
  }
  window.IAN_OS_HOME_LAYOUT={mount,normalized,defaults,reset:()=>{editing=false;draft=null;}};
})();
