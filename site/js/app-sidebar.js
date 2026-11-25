(() => {
  window.IAN_OS_APP_SIDEBAR={create({getState,cloneState,activateDialog,toast,escapeHtml,escapeAttr,onLabelsChanged,navigate}){
    const state=new Proxy(Object.create(null),{get(_target,key){return getState()?.[key];},set(_target,key,value){getState()[key]=value;return true;}});
  const sidebarLabelDefinitions=[...document.querySelectorAll('#sidebar .nav-item b,#sidebar .nav-label')].map(node=>({
    node,key:node.matches('.nav-label')?'section:'+node.dataset.i18n:'item:'+(node.closest('.nav-item').dataset.view||node.closest('.nav-item').id),
    label:node.textContent.trim()
  }));
  sidebarLabelDefinitions.forEach(({node,key})=>node.dataset.sidebarLabel=key);
  function applySidebarLabels(){
    const labels=state.settings.preferences?.sidebarLabels||{};
    for(const {node,key,label} of sidebarLabelDefinitions){const value=typeof labels[key]==='string'&&labels[key].trim()?labels[key].trim().slice(0,60):label;if(node.textContent!==value)node.textContent=value;node.title=value;}
  }
  const syncPageTitle=(app,view,isTopLevel)=>{
    if(!isTopLevel)return;
    const heading=app.querySelector('.page-head .page-title');
    if(!heading)return;
    const custom=state.settings.preferences?.sidebarLabels?.['item:'+view];
    const title=typeof custom==='string'&&custom.trim()?custom.trim().slice(0,60):heading.dataset.originalModuleTitle;
    if(!title)return;
    if(!heading.dataset.originalModuleTitle)heading.dataset.originalModuleTitle=heading.textContent;
    if(heading.textContent!==title)heading.textContent=title;
  };
  // Store stable navigation keys, never markup or child-tree state. Future entries are appended once.
  const sidebarSections=(()=>{const nav=document.querySelector('#sidebar .nav-list'),groups=[{key:'home',label:'首頁',nodes:[]}];let group=groups[0];for(const child of [...nav.children]){if(child.classList.contains('nav-label')){group={key:child.dataset.i18n,label:child.textContent.trim(),header:child,nodes:[]};groups.push(group);}else{const key=child.dataset.view||child.dataset.tree;if(key&&!(groups.some(g=>g.nodes.some(x=>x.key===key))))group.nodes.push({key,node:child});}}return groups;})();
  function sidebarOrderFor(group){const valid=group.nodes.map(x=>x.key),stored=state?.settings?.preferences?.sidebarOrder?.[group.key];return [...new Set([...(Array.isArray(stored)?stored:[]).filter(x=>valid.includes(x)),...valid])];}
  function applySidebarOrder(){const nav=document.querySelector('#sidebar .nav-list');for(const group of sidebarSections){const byKey=new Map(group.nodes.map(x=>[x.key,x.node]));for(const key of sidebarOrderFor(group))nav.appendChild(byKey.get(key));if(group.header){const first=byKey.get(sidebarOrderFor(group)[0]);if(first)nav.insertBefore(group.header,first);else nav.append(group.header);}}applySidebarPinned();}
  // 常用 is a read-only mirror: clones of stored entries, clicks delegated to this box, never persisted itself.
  const PIN_LIMIT=8;
  const sidebarNavEntries=()=>sidebarSections.flatMap(group=>group.nodes);
  function sidebarPinnedKeys(){const valid=new Set(sidebarNavEntries().map(x=>x.key)),stored=state?.settings?.preferences?.sidebarPinned;return [...new Set((Array.isArray(stored)?stored:[]).filter(x=>typeof x==='string'&&valid.has(x)))].slice(0,PIN_LIMIT);}
  const pinnableButton=node=>node.matches('.nav-tree')?node.querySelector(':scope > .nav-item[data-view]'):node;
  function applySidebarPinned(){
    const nav=document.querySelector('#sidebar .nav-list');if(!nav?.querySelector)return;
    let box=nav.querySelector(':scope > .nav-pinned');
    if(!box){box=document.createElement('div');box.className='nav-pinned';box.hidden=true;box.innerHTML='<div class="nav-label">常用</div><div class="nav-pinned-items"></div>';box.addEventListener('click',e=>{const item=e.target.closest('[data-view]');if(!item||!box.contains(item))return;e.preventDefault();navigate?.(item.dataset.view);});}
    const home=nav.querySelector(':scope > .nav-item[data-view="home"]');
    if(home&&box.previousElementSibling!==home)home.after(box);else if(!box.parentNode)nav.prepend(box);
    const byKey=new Map(sidebarNavEntries().map(x=>[x.key,x.node]));
    const clones=sidebarPinnedKeys().map(key=>{const source=byKey.get(key),button=source&&pinnableButton(source);if(!button)return null;const clone=button.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));clone.querySelectorAll('.tree-chevron').forEach(el=>el.remove());return clone;}).filter(Boolean);
    box.querySelector('.nav-pinned-items').replaceChildren(...clones);
    box.hidden=!clones.length;
  }
  function openSidebarOrderEditor(){const overlay=document.createElement('div');overlay.className='modal-backdrop sidebar-order-editor';let draft=Object.fromEntries(sidebarSections.filter(g=>g.key!=='home').map(g=>[g.key,sidebarOrderFor(g)]));const title=key=>{const entry=sidebarLabelDefinitions.find(x=>x.key==='item:'+key);return entry?.node?.textContent||key;};let pins=sidebarPinnedKeys();overlay.innerHTML='<section class="modal utility-editor" role="dialog" aria-modal="true" aria-label="自訂側邊欄順序"><div class="modal-header"><h2>自訂側邊欄順序</h2><button class="icon-btn" type="button" data-close aria-label="關閉">×</button></div><p class="muted">可拖曳項目，或使用上移與下移。項目只在所屬群組內移動。點 ☆ 加入「常用」置頂（最多 8 項）。</p><div class="sidebar-order-groups"></div><p data-error role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-reset>恢復預設順序</button><button type="button" class="secondary-btn" data-close>取消</button><button type="button" class="primary-btn" data-save>儲存順序</button></div></section>';document.body.append(overlay);activateDialog(overlay);
    let busy=false;const close=()=>{if(!busy)overlay.remove()};overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close()},true);
    const paint=()=>{overlay.querySelector('.sidebar-order-groups').innerHTML=sidebarSections.filter(g=>g.key!=='home').map(g=>`<section class="sidebar-order-group"><h3>${escapeHtml(g.header?.textContent||g.label)}</h3><div class="sidebar-order-list" data-order-group="${escapeAttr(g.key)}">${draft[g.key].map((key,i)=>`<div class="sidebar-order-row" draggable="true" data-order-key="${escapeAttr(key)}"><span aria-hidden="true">⋮⋮</span><strong>${escapeHtml(title(key))}</strong><button type="button" class="secondary-btn compact pin-toggle" data-pin="${escapeAttr(key)}" aria-pressed="${pins.includes(key)}" aria-label="${escapeAttr(title(key))}${pins.includes(key)?' 取消常用':' 加入常用'}" title="${pins.includes(key)?'取消常用':'加入常用'}">${pins.includes(key)?'★':'☆'}</button><button type="button" class="secondary-btn compact" data-step="-1" aria-label="${escapeAttr(title(key))} 上移" ${i===0?'disabled':''}>↑</button><button type="button" class="secondary-btn compact" data-step="1" aria-label="${escapeAttr(title(key))} 下移" ${i===draft[g.key].length-1?'disabled':''}>↓</button></div>`).join('')}</div></section>`).join('');};paint();
    const togglePin=key=>{const message=overlay.querySelector('[data-error]');if(pins.includes(key)){pins=pins.filter(x=>x!==key);}else if(pins.length>=PIN_LIMIT){message.textContent=`常用最多 ${PIN_LIMIT} 項，請先取消其他項目。`;return;}else{pins=[...pins,key];}message.textContent='';paint();overlay.querySelector(`[data-pin="${CSS.escape(key)}"]`)?.focus();};
    overlay.querySelector('.sidebar-order-groups').onclick=e=>{const pinButton=e.target.closest('[data-pin]');if(pinButton){togglePin(pinButton.dataset.pin);return;}const button=e.target.closest('[data-step]'),row=button?.closest('[data-order-key]'),group=button?.closest('[data-order-group]')?.dataset.orderGroup;if(!group)return;const values=draft[group],from=values.indexOf(row.dataset.orderKey),to=from+Number(button.dataset.step);if(to<0||to>=values.length)return;[values[from],values[to]]=[values[to],values[from]];paint();overlay.querySelector(`[data-order-group="${group}"] [data-order-key="${row.dataset.orderKey}"] [data-step="${button.dataset.step}"]`)?.focus();};
    let dragged=null;overlay.querySelector('.sidebar-order-groups').addEventListener('dragstart',e=>{const row=e.target.closest('[data-order-key]');dragged=row?{group:row.closest('[data-order-group]').dataset.orderGroup,key:row.dataset.orderKey}:null;if(e.dataTransfer)e.dataTransfer.effectAllowed='move';});overlay.querySelector('.sidebar-order-groups').addEventListener('dragover',e=>{const row=e.target.closest('[data-order-key]');if(dragged&&row&&row.closest('[data-order-group]').dataset.orderGroup===dragged.group)e.preventDefault();});overlay.querySelector('.sidebar-order-groups').addEventListener('drop',e=>{const row=e.target.closest('[data-order-key]');if(!dragged||!row||row.closest('[data-order-group]').dataset.orderGroup!==dragged.group)return;e.preventDefault();const list=draft[dragged.group],from=list.indexOf(dragged.key),to=list.indexOf(row.dataset.orderKey);if(from>=0&&to>=0){const [moved]=list.splice(from,1);list.splice(to,0,moved);}dragged=null;paint();});overlay.querySelector('.sidebar-order-groups').addEventListener('dragend',()=>dragged=null);
    async function save(reset=false){if(busy)return;busy=true;overlay.querySelectorAll('button').forEach(b=>b.disabled=true);try{await window.IAN_OS_CLOUD.flushSave();const next=cloneState();next.settings.preferences ||= {};if(reset){delete next.settings.preferences.sidebarOrder;delete next.settings.preferences.sidebarPinned;}else{next.settings.preferences.sidebarOrder=draft;next.settings.preferences.sidebarPinned=pins;}await window.IAN_OS_CLOUD.savePreferences(next);state.settings.preferences=next.settings.preferences;applySidebarOrder();overlay.remove();toast(reset?'已恢復預設順序':'側欄順序已儲存');}catch(error){overlay.querySelector('[data-error]').textContent='儲存失敗，順序仍保留在編輯視窗中，請檢查連線後重試。';busy=false;overlay.querySelectorAll('button').forEach(b=>b.disabled=false);}}overlay.querySelector('[data-save]').onclick=()=>save();overlay.querySelector('[data-reset]').onclick=()=>save(true);
  }
  function openSidebarLabelEditor(){
    const overlay=document.createElement('div');overlay.className='modal-backdrop sidebar-label-editor';
    const labels=state.settings.preferences?.sidebarLabels||{};
    overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="自訂側欄"><div class="modal-header"><h2>自訂側欄</h2><button type="button" class="icon-btn" data-close aria-label="關閉">×</button></div><p class="muted">留白即使用預設名稱。模組名稱會同步顯示在側欄與頁面標題，不影響原有功能。</p><form><div class="sidebar-label-fields">${sidebarLabelDefinitions.map(({key,label},index)=>`<div class="sidebar-label-row"><label for="sidebar-name-${index}">${escapeHtml(label)}</label><div><input id="sidebar-name-${index}" data-label-key="${escapeAttr(key)}" value="${escapeAttr(typeof labels[key]==='string'?labels[key]:'')}" placeholder="${escapeAttr(label)}" maxlength="60"><button type="button" class="secondary-btn compact" data-label-reset="${index}" aria-label="還原 ${escapeAttr(label)}">還原</button></div></div>`).join('')}</div><p data-label-error role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-reset-all>全部還原</button><button type="button" class="secondary-btn" data-close>取消</button><button type="submit" class="primary-btn">儲存</button></div></form></section>`;
    document.body.appendChild(overlay);activateDialog(overlay);
    let busy=false;
    const close=()=>{if(!busy)overlay.remove();};overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();close();}},true);
    overlay.querySelectorAll('[data-label-reset]').forEach(b=>b.onclick=()=>{overlay.querySelector('#sidebar-name-'+b.dataset.labelReset).value='';});
    overlay.querySelector('[data-reset-all]').onclick=()=>overlay.querySelectorAll('[data-label-key]').forEach(input=>input.value='');
    overlay.querySelector('form').onsubmit=async e=>{
      e.preventDefault();if(busy)return;busy=true;
      const custom={};overlay.querySelectorAll('[data-label-key]').forEach(input=>{const value=input.value.trim();if(value)custom[input.dataset.labelKey]=value;});
      overlay.querySelectorAll('button,input').forEach(el=>el.disabled=true);
      try{
        await window.IAN_OS_CLOUD.flushSave();
        const next=cloneState();next.settings.preferences ||= {};next.settings.preferences.sidebarLabels=custom;
        await window.IAN_OS_CLOUD.savePreferences(next);
        state.settings.preferences ||= {};state.settings.preferences.sidebarLabels=custom;
        applySidebarLabels();onLabelsChanged?.();busy=false;close();toast('選單名稱已儲存');
      }catch(error){overlay.querySelector('[data-label-error]').textContent=error?.code==='IAN_DATA_CONFLICT'?'本機資料更新失敗，輸入內容仍保留。':'儲存失敗，輸入內容仍保留，請檢查連線後重試。';}
      finally{busy=false;overlay.querySelectorAll('button,input').forEach(el=>el.disabled=false);}
    };
  }
    return {applyLabels:applySidebarLabels,syncPageTitle,applyOrder:applySidebarOrder,applyPinned:applySidebarPinned,pinnedKeys:sidebarPinnedKeys,openOrderEditor:openSidebarOrderEditor,openLabelEditor:openSidebarLabelEditor};
  }};
})();
