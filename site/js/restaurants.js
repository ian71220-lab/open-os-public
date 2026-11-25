(() => {
  const fields = ['name', 'cuisine', 'city', 'hours', 'address', 'phone', 'url', 'notes'];
  const defaults = ['美式', '台式', '日式', '韓式', '中式', '義式'];
  const labels = {name:'餐廳名稱', city:'城市／地區', cuisine:'菜系類別', address:'完整地址', hours:'營業時間', phone:'電話', url:'網站／訂位網址', notes:'備註與個人資訊'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const safeURL = value => {if(!value)return '';try{if(!/^https?:\/\//i.test(value))return '';const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}};
  const maps = address => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  const safeSession = {
    get(key){try{return JSON.parse(sessionStorage.getItem(key) || 'null');}catch{return null;}},
    set(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}
  };

  function orderedCuisines(custom,records,order){
    const valid=[...new Set([...defaults,...custom,...records.map(x=>x.cuisine)].filter(x=>typeof x==='string'&&x.trim()))];
    const saved=Array.isArray(order)?order:[];
    return [...new Set([...saved.filter(x=>valid.includes(x)),...valid])];
  }
  function planCityRenames(cities,nextNames,records){
    const names=nextNames.map(name=>String(name).trim());
    if(names.some(name=>!name||name.length>300))throw new Error('INVALID_CITY');
    if(new Set(names.map(name=>name.toLocaleLowerCase())).size!==names.length)throw new Error('DUPLICATE_CITY');
    return cities.map((name,index)=>({oldName:name,newName:names[index],ids:records.filter(row=>row.city===name).map(row=>row.id)})).filter(({oldName,newName})=>oldName!==newName);
  }
  function selectField(key,values,current=''){
    const choices=[...new Set([...values,current].filter(Boolean))];
    return `<select name="${key}" data-restaurant-select="${key}"><option value="">請選擇</option>${choices.map(value=>`<option value="${escape(value)}" ${value===current?'selected':''}>${escape(value)}</option>`).join('')}<option value="" data-new="true">＋ 新增${key==='city'?'城市／地區':'菜系'}</option></select><input name="${key}" data-restaurant-new="${key}" aria-label="新增${labels[key]}" placeholder="輸入新的${labels[key]}" maxlength="${key==='city'?300:60}" hidden disabled>`;
  }
  function create({app, cloud, toast, dialog, isActive, getCuisines=()=>[], getCuisineOrder=()=>[], saveCuisines=async()=>{}}) {
    let records=[], owner='', search='', city='', cuisine='', customCuisines=[], generation=0, loaded=false;
    let rememberedScroll=0;
    const storageKey = () => `open-os-public-restaurant-ui:${owner}`;
    const allCuisines = () => orderedCuisines(customCuisines,records,getCuisineOrder());
    const rememberPosition = () => {if(!owner||!isActive())return;rememberedScroll=window.scrollY;remember();};
    const remember = () => {if(owner)safeSession.set(storageKey(),{search,city,cuisine,scrollY:rememberedScroll});};
    const restore = () => {
      const saved=safeSession.get(storageKey());
      search=typeof saved?.search==='string'?saved.search.slice(0,300):'';
      city=typeof saved?.city==='string'?saved.city:'';
      cuisine=typeof saved?.cuisine==='string'?saved.cuisine:'';
      rememberedScroll=Number.isFinite(saved?.scrollY)?Math.max(0,saved.scrollY):0;
    };
    document.addEventListener('visibilitychange',()=>{if(document.hidden)rememberPosition();});
    window.addEventListener('pagehide',rememberPosition);
    let scrollSaveTimer;
    window.addEventListener('scroll',()=>{
      if(!owner||!isActive())return;
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer=setTimeout(rememberPosition,200);
    },{passive:true});

    function refresh() {
      const user=cloud.user()?.id;
      if(!user){records=[];owner='';loaded=false;return;}
      if(owner!==user){owner=user;records=[];loaded=false;customCuisines=getCuisines();restore();}
      const ticket=++generation;
      // Re-entering the view shows cached data immediately instead of a blank loading flash.
      if(loaded)draw();
      else app.innerHTML='<section class="panel" role="status">正在載入餐廳資料…</section>';
      cloud.loadRestaurants().then(rows=>{
        if(ticket!==generation||cloud.user()?.id!==user||!isActive())return;
        const firstLoad=!loaded;
        records=rows;loaded=true;customCuisines=getCuisines();draw();
        if(firstLoad&&rememberedScroll>0)requestAnimationFrame(()=>window.scrollTo({top:rememberedScroll,behavior:'instant'}));
      }).catch(error=>{
        if(ticket!==generation||!isActive())return;
        if(loaded){toast('餐廳資料更新失敗，顯示上次載入的資料。');return;}
        app.innerHTML='<section class="panel" role="alert">餐廳資料載入失敗，請檢查本機儲存空間。<button class="secondary-btn" id="restaurantRetry">重試</button></section>';
        app.querySelector('#restaurantRetry').onclick=refresh;
        console.warn('[OPEN OS] Restaurant read failed',error);
      });
    }

    function fact(label,value,markup=false){return value?`<li><span class="restaurant-fact-label">${escape(label)}：</span>${markup?value:escape(value)}</li>`:'';}
    function draw() {
      const sameScreen=!!app.querySelector('.restaurant-filters');
      return window.IAN_OS_SCROLL ? window.IAN_OS_SCROLL.keep(drawContent,sameScreen) : drawContent();
    }
    function drawContent() {
      const cities=[...new Set(records.map(x=>x.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
      const cuisines=allCuisines();
      const needle=search.toLocaleLowerCase();
      const filtered=records.filter(x=>(!city||x.city===city)&&(!cuisine||x.cuisine===cuisine)&&(!needle||fields.some(k=>String(x[k]||'').toLocaleLowerCase().includes(needle))));
      app.innerHTML=`<section class="page-head"><div><div class="eyebrow">LIFESTYLE</div><h1 class="page-title">美食餐廳</h1><p class="page-subtitle">收藏餐廳與個人筆記。</p></div><div class="restaurant-head-actions"><button class="secondary-btn" id="restaurantManageCities">管理城市</button><button class="secondary-btn" id="restaurantManageCuisines">管理菜系</button><button class="primary-btn" id="restaurantAdd">＋ 新增餐廳</button></div></section>
        <section class="panel restaurant-filters"><label>搜尋<input id="restaurantSearch" type="search" placeholder="名稱、地址或備註" value="${escape(search)}"></label><label>城市<select id="restaurantCity"><option value="">全部城市</option>${cities.map(x=>`<option ${x===city?'selected':''} value="${escape(x)}">${escape(x)}</option>`).join('')}</select></label><label>菜系<select id="restaurantCuisine"><option value="">全部菜系</option>${cuisines.map(x=>`<option ${x===cuisine?'selected':''} value="${escape(x)}">${escape(x)}</option>`).join('')}</select></label></section>
        <div class="restaurant-grid">${filtered.map(x=>{
          const url=safeURL(x.url);
          const phone=x.phone?`<a href="tel:${escape(x.phone.replace(/[^\d+()-]/g,''))}">${escape(x.phone)}</a>`:'';
          const website=url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">網站／訂位 ↗</a>`:'';
          return `<article class="panel restaurant-card"><div class="restaurant-card-top"><h2>${escape(x.name)}</h2>${x.cuisine?`<span class="restaurant-cuisine-tag" title="${escape(x.cuisine)}">${escape(x.cuisine)}</span>`:''}</div><p class="muted">${escape(x.city)}</p><ul class="restaurant-facts">${fact('地址',x.address)}${x.address?fact('地圖',`<a href="${escape(maps(x.address))}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>`,true):''}${fact('營業時間',x.hours)}${fact('電話',phone,true)}${fact('網址',website,true)}</ul>${x.notes?`<p class="restaurant-notes">${escape(x.notes)}</p>`:''}<div class="detail-actions"><button class="secondary-btn compact" data-restaurant-edit="${escape(x.id)}">編輯</button><button class="danger-btn secondary-danger compact" data-restaurant-delete="${escape(x.id)}">刪除</button></div></article>`;
        }).join('')||(records.length?'<section class="panel">目前沒有符合條件的餐廳。</section>':`<section class="panel">${globalThis.IAN_OS_EMPTY_GUIDE({title:'還沒有餐廳',hint:'新增第一家想去的餐廳。',target:'#restaurantAdd'})}</section>`)}</div>`;
      app.querySelector('#restaurantAdd').onclick=()=>edit();
      app.querySelector('#restaurantManageCuisines').onclick=manageCuisines;
      app.querySelector('#restaurantManageCities').onclick=manageCities;
      app.querySelector('#restaurantSearch').oninput=e=>{
        search=e.target.value;remember();const start=e.target.selectionStart;draw();
        const input=app.querySelector('#restaurantSearch');input.focus({preventScroll:true});input.setSelectionRange(start,start);
      };
      app.querySelector('#restaurantCity').onchange=e=>{city=e.target.value;remember();draw();};
      app.querySelector('#restaurantCuisine').onchange=e=>{cuisine=e.target.value;remember();draw();};
      app.querySelectorAll('[data-restaurant-edit]').forEach(b=>b.onclick=()=>edit(records.find(x=>x.id===b.dataset.restaurantEdit)));
      app.querySelectorAll('[data-restaurant-delete]').forEach(b=>b.onclick=()=>remove(records.find(x=>x.id===b.dataset.restaurantDelete)));
    }

    function manageCities(){
      const cities=[...new Set(records.map(row=>row.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
      const overlay=document.createElement('div');overlay.className='modal-backdrop restaurant-editor restaurant-city-manager';
      overlay.innerHTML=`<section class="modal utility-editor" role="dialog" aria-modal="true" aria-label="管理城市"><div class="modal-header"><h2>管理城市</h2><button type="button" class="icon-btn" data-close aria-label="關閉">×</button></div><p class="muted">修改城市名稱後，使用該名稱的餐廳會一起更新，餐廳地址不變。</p><form><div class="restaurant-city-list">${cities.length?cities.map((name,index)=>`<label class="restaurant-city-row"><span>${escape(name)}</span><input name="city-${index}" value="${escape(name)}" maxlength="300" required aria-label="編輯 ${escape(name)} 城市名稱"></label>`).join(''):'<p class="muted">尚無餐廳城市。</p>'}</div><p data-error role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-close>取消</button><button type="submit" class="primary-btn">儲存變更</button></div></form></section>`;
      document.body.append(overlay);dialog?.(overlay);
      let busy=false;const ownerAtOpen=cloud.user()?.id;
      const close=()=>{if(!busy)overlay.remove();};
      overlay.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
      overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();close();}});
      overlay.querySelector('form').onsubmit=async event=>{
        event.preventDefault();if(busy)return;
        const nextNames=cities.map((_,index)=>event.target.elements[`city-${index}`].value.trim());
        const errorNode=overlay.querySelector('[data-error]');errorNode.textContent='';
        let changes;
        try{changes=planCityRenames(cities,nextNames,records);}
        catch(error){errorNode.textContent=error.message==='DUPLICATE_CITY'?'城市名稱不可重複。':'城市名稱必須為 1–300 個字。';return;}
        if(!changes.length){close();return;}
        busy=true;overlay.querySelector('[type=submit]').disabled=true;
        try{
          if(cloud.user()?.id!==ownerAtOpen)throw new Error('Session changed');
          for(const {oldName,newName,ids} of changes){
            for(const id of ids){
              const row=records.find(record=>record.id===id);
              if(!row)continue;
              const updated=await cloud.saveRestaurant(row.id,{...Object.fromEntries(fields.map(key=>[key,row[key]||''])),city:newName});
              if(cloud.user()?.id!==ownerAtOpen)throw new Error('Session changed');
              records=records.map(record=>record.id===row.id?updated:record);
            }
            if(city===oldName)city=newName;
          }
          remember();busy=false;close();if(isActive())draw();toast('城市名稱已更新');
        }catch{busy=false;overlay.querySelector('[type=submit]').disabled=false;errorNode.textContent='儲存未完成，請檢查連線後重試。若部分餐廳已更新，重新開啟管理城市前請先重新整理資料。';}
      };
    }

    function manageCuisines() {
      const overlay=document.createElement('div');overlay.className='modal-backdrop restaurant-editor restaurant-cuisine-manager';
      let custom=[...customCuisines],order=allCuisines(),busy=false,dragged=null;const renames=new Map();
      const ownerAtOpen=cloud.user()?.id;
      overlay.innerHTML='<section class="modal utility-editor" role="dialog" aria-modal="true" aria-label="管理菜系"><div class="modal-header"><h2>管理菜系</h2><button type="button" class="icon-btn" data-close aria-label="關閉">×</button></div><p class="muted">拖曳或使用上下按鈕排列。按「儲存變更」後，表單與篩選器會使用相同順序。預設菜系不可重新命名；使用中的菜系重新命名時，相關餐廳會同步更新。預設及使用中的菜系不可刪除。</p><form class="restaurant-cuisine-add"><label><span>新菜系名稱</span><input name="name" maxlength="60" required placeholder="例如：泰式、越式、墨西哥式"></label><button type="submit" class="primary-btn">新增</button></form><p data-error role="alert"></p><div class="restaurant-cuisine-list"></div><div class="modal-actions"><button type="button" class="secondary-btn" data-reset>恢復預設順序</button><button type="button" class="secondary-btn" data-close>取消</button><button type="button" class="primary-btn" data-save>儲存變更</button></div></section>';
      document.body.append(overlay);dialog?.(overlay);
      const close=()=>{if(!busy)overlay.remove();};
      overlay.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
      overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();close();}});
      const list=overlay.querySelector('.restaurant-cuisine-list'),errorNode=overlay.querySelector('[data-error]');
      function paint(focusIndex,step){
        const scroll=list.scrollTop;
        list.innerHTML=order.map((name,index)=>{
          const standard=defaults.includes(name),used=records.filter(x=>x.cuisine===name).length;
          return `<div class="restaurant-cuisine-row" draggable="true" data-index="${index}"><span class="cuisine-drag" aria-hidden="true">⋮⋮</span><div class="cuisine-name"><strong>${escape(name)}</strong><small>${standard?'預設菜系':used?`${used} 家餐廳使用中`:'自訂菜系'}</small></div><div class="cuisine-actions"><button type="button" class="secondary-btn compact" data-step="-1" aria-label="${escape(name)} 上移" ${index===0?'disabled':''}>↑</button><button type="button" class="secondary-btn compact" data-step="1" aria-label="${escape(name)} 下移" ${index===order.length-1?'disabled':''}>↓</button><button type="button" class="secondary-btn compact" data-rename ${standard?'disabled':''} aria-label="編輯 ${escape(name)}">編輯</button><button type="button" class="danger-btn secondary-danger compact" data-remove ${standard||used?'disabled':''} aria-label="刪除 ${escape(name)}">刪除</button></div></div>`;
        }).join('');list.scrollTop=scroll;
        if(Number.isInteger(focusIndex)){const row=list.children[focusIndex];const target=row?.querySelector(`[data-step="${step}"]:not([disabled])`)||row?.querySelector('[data-step]:not([disabled])');target?.focus({preventScroll:true});}
      }
      function move(from,to){if(busy||from<0||to<0||from>=order.length||to>=order.length)return;const [name]=order.splice(from,1);order.splice(to,0,name);paint(to,to<from?-1:1);}
      list.onclick=event=>{if(busy)return;const button=event.target.closest('button'),row=button?.closest('[data-index]');if(!row||button.disabled)return;const index=Number(row.dataset.index);if(button.hasAttribute('data-step'))move(index,index+Number(button.dataset.step));else if(button.hasAttribute('data-rename')){const oldName=order[index];if(defaults.includes(oldName))return;const proposed=prompt('修改菜系名稱',oldName);if(proposed===null)return;const nextName=proposed.trim();errorNode.textContent='';if(!nextName||nextName.length>60){errorNode.textContent='菜系名稱必須為 1–60 個字。';return;}if(order.some((x,i)=>i!==index&&x.toLocaleLowerCase()===nextName.toLocaleLowerCase())){errorNode.textContent='這個菜系已經存在。';return;}if(nextName===oldName)return;const affected=records.filter(x=>x.cuisine===oldName);if(affected.length){if(!confirm(`「${oldName}」目前有 ${affected.length} 家餐廳使用。儲存變更時將同步更新這些餐廳的菜系，是否繼續？`))return;}renames.set(oldName,nextName);custom=custom.map(x=>x===oldName?nextName:x);order[index]=nextName;paint(index);}else if(button.hasAttribute('data-remove')){const name=order[index];if(defaults.includes(name)||records.some(x=>x.cuisine===name))return;custom=custom.filter(x=>x!==name);for(const [old,newName] of renames){if(newName===name)renames.delete(old);}order.splice(index,1);paint();}};
      list.addEventListener('dragstart',event=>{if(busy){event.preventDefault();return;}const row=event.target.closest('[data-index]');dragged=row?Number(row.dataset.index):null;if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(dragged));}});
      list.addEventListener('dragover',event=>{if(dragged!==null&&!busy&&event.target.closest('[data-index]'))event.preventDefault();});
      list.addEventListener('drop',event=>{const row=event.target.closest('[data-index]');if(dragged===null||!row)return;event.preventDefault();move(dragged,Number(row.dataset.index));dragged=null;});list.addEventListener('dragend',()=>dragged=null);
      overlay.querySelector('form').onsubmit=event=>{event.preventDefault();if(busy)return;const input=event.target.elements.name,name=input.value.trim();errorNode.textContent='';if(!name||name.length>60){errorNode.textContent='菜系名稱必須為 1–60 個字。';return;}if(order.some(x=>x.toLocaleLowerCase()===name.toLocaleLowerCase())){errorNode.textContent='這個菜系已經存在。';return;}custom.push(name);order.push(name);input.value='';paint();input.focus({preventScroll:true});};
      overlay.querySelector('[data-reset]').onclick=()=>{if(busy)return;order=orderedCuisines(custom,records,[]);paint();};
      overlay.querySelector('[data-save]').onclick=async()=>{if(busy)return;busy=true;errorNode.textContent='';overlay.querySelectorAll('button,input').forEach(el=>el.disabled=true);try{if(cloud.user()?.id!==ownerAtOpen)throw new Error('Session changed');// Update restaurant records first, then persist cuisine settings. Partial failures stay visible for retry.
        for(const [oldName,newName] of renames){
          const affected=records.filter(row=>row.cuisine===oldName);
          for(const row of affected){
            const updated=await cloud.saveRestaurant(row.id,{...Object.fromEntries(fields.map(key=>[key,row[key]||''])),cuisine:newName});
            records=records.map(entry=>entry.id===row.id?updated:entry);
          }
        }
        await saveCuisines(custom,order);if(cloud.user()?.id!==ownerAtOpen)throw new Error('Session changed');customCuisines=[...custom];if(!order.includes(cuisine))cuisine='';remember();busy=false;close();if(isActive())draw();toast('菜系與順序已儲存');}catch(error){busy=false;errorNode.textContent='儲存未完成，請檢查連線後重試。若部分餐廳已更新，重新開啟菜系管理前請先重新整理資料。';overlay.querySelectorAll('button,input').forEach(el=>el.disabled=false);paint();}};
      paint();
    }

    function edit(item) {
      const overlay=document.createElement('div');overlay.className='modal-backdrop restaurant-editor';
      const options={city:[...new Set(records.map(x=>x.city).filter(Boolean))],cuisine:allCuisines()};
      const editorField = k => `<label class="restaurant-edit-field restaurant-edit-${k}"><span>${labels[k]}</span>${k==='city'||k==='cuisine'?selectField(k,options[k],item?.[k]||''):k==='notes'?`<textarea name="${k}" maxlength="4000">${escape(item?.[k]||'')}</textarea>`:`<input name="${k}" ${k==='name'?'required':''} maxlength="${k==='url'?1000:k==='hours'?600:300}" ${k==='city'||k==='cuisine'?`list="restaurant-${k}-options"`:''} value="${escape(item?.[k]||'')}">`}</label>`;
      overlay.innerHTML=`<section class="modal utility-editor" role="dialog" aria-modal="true" aria-label="${item?'編輯':'新增'}餐廳"><div class="modal-header"><h2>${item?'編輯':'新增'}餐廳</h2><button type="button" class="icon-btn" data-close aria-label="關閉">×</button></div><form><div class="restaurant-edit-grid">${fields.map(editorField).join('')}</div><p data-error role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-close>取消</button><button type="submit" class="primary-btn">儲存</button></div></form></section>`;
      document.body.append(overlay);dialog?.(overlay);
      overlay.querySelectorAll('[data-restaurant-select]').forEach(select=>select.onchange=()=>{const input=overlay.querySelector(`[data-restaurant-new="${select.dataset.restaurantSelect}"]`),adding=!!select.selectedOptions[0]?.dataset.new;input.hidden=!adding;input.disabled=!adding;select.name=adding?'':select.dataset.restaurantSelect;if(adding)input.focus({preventScroll:true});});
      const close=()=>overlay.remove();
      overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
      overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
      overlay.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const data=Object.fromEntries(new FormData(e.target));
        for(const key of fields)data[key]=String(data[key]||'').trim();
        if(!data.name){overlay.querySelector('[data-error]').textContent='請填寫餐廳名稱。';return;}
        if(data.url&&!safeURL(data.url)){overlay.querySelector('[data-error]').textContent='網址請以 https:// 或 http:// 開頭。';return;}
        const submit=overlay.querySelector('[type=submit]');submit.disabled=true;
        try{const saved=await cloud.saveRestaurant(item?.id||null,data);if(item)records=records.map(x=>x.id===item.id?saved:x);else records.unshift(saved);close();draw();toast('餐廳已儲存');}
        catch(error){overlay.querySelector('[data-error]').textContent='儲存失敗，資料仍保留在表單中，請檢查本機儲存空間。';console.warn('[OPEN OS] Restaurant save failed',error);}
        finally{submit.disabled=false;}
      };
    }

    async function remove(item) {
      if(!item||!confirm(`確定刪除「${item.name}」？`))return;
      try{await cloud.deleteRestaurant(item.id);records=records.filter(x=>x.id!==item.id);draw();toast('餐廳已刪除');}
      catch(error){toast('刪除失敗，請重試');console.warn('[OPEN OS] Restaurant deletion failed',error);}
    }
    return {render:refresh,rememberPosition,loadedRecords:()=>loaded?[...records]:[],openRecord:id=>{const row=records.find(x=>x.id===id);if(row)edit(row);}};
  }
  window.IAN_OS_RESTAURANTS={create,safeURL,maps,orderedCuisines,selectField,planCityRenames};
})();
