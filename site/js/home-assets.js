(() => {
  'use strict';
  const XLSX_JS_PATH='js/vendor/xlsx.full.min.js?v=c9506197';
  const XLSX_SRC=new URL(XLSX_JS_PATH,document.baseURI).href;
  let xlsxPromise=null;
  const CATEGORIES={tv_audio:['電視與影音','TV & Audio','▣'],smart_home:['智慧家居','Smart Home','⌂'],plug_power:['智慧插座與電源','Plugs & Power','⌁'],lighting:['智慧照明','Lighting','✦'],security:['安全設備','Security','◇'],appliances:['家庭家電','Appliances','⌂'],major_appliances:['大型家電','Major Appliances','▦'],computing:['電腦與辦公','Computing','▤'],mobile:['手持設備','Mobile Devices','▯'],network:['網路設備','Network','⌁'],camera:['攝影機','Cameras','◉'],thermostat:['溫控設備','Thermostat','◌'],storage:['儲存設備','Storage','▥'],gaming:['遊戲與娛樂','Gaming','◇'],vehicle:['交通工具','Vehicles','◇'],subscription:['設備租賃與訂閱','Subscriptions','$'],others:['其他設備','Others','□']};
  const empty=()=>({name:'',category:'others',brand:'',model:'',app:'',ipAddress:'',location:'',purchaseDate:'',price:'',currency:'USD',warrantyStatus:'under',warrantyExpiry:'',warrantyRange:'',channel:'',costPlan:'date',notes:'',loanTotalAmount:'',amountPaid:'',loanAmount:'',loanEndDate:'',invoiceName:'',invoicePath:'',invoiceData:''});
  let items=[],loaded=false,loading=null,search='',filter='all',context=null,loadGeneration=0;
  const e=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const a=e;
  const tr=(zh)=>zh;
  const label=key=>CATEGORIES[key]?.[0]||key||tr('未分類','Uncategorized');
  const icon=key=>CATEGORIES[key]?.[2]||'□';
  const money=(value,currency)=>{const n=Number(value||0);return n.toLocaleString('zh-TW',{style:'currency',currency:currency||'USD',maximumFractionDigits:2});};
  const days=value=>{if(!value)return '—';const time=new Date(value).getTime();return Number.isFinite(time)?Math.max(0,Math.ceil((Date.now()-time)/86400000)):'—';};
  const allCategories=()=>[...new Set([...Object.keys(CATEGORIES),...items.map(item=>item.category).filter(Boolean)])];
  const filtered=()=>items.filter(item=>{const haystack=[item.name,item.brand,item.model,item.location,item.app,item.ipAddress,label(item.category)].join(' ').toLowerCase();return haystack.includes(search.toLowerCase())&&(filter==='all'||item.category===filter);});

  async function ensureLoaded(){
    if(loaded)return;
    if(!loading){
      const generation=loadGeneration;
      const pending=window.IAN_OS_CLOUD.loadHomeAssets().then(rows=>{
        if(generation!==loadGeneration)return;
        items=rows.map(row=>({...empty(),...row}));loaded=true;
      }).finally(()=>{if(loading===pending)loading=null;});
      loading=pending;
    }
    await loading;
  }
  function page(){
    const sameScreen=!!context?.app?.querySelector('.native-assets-head');
    return window.IAN_OS_SCROLL ? window.IAN_OS_SCROLL.keep(pageContent,sameScreen) : pageContent();
  }
  function pageContent(){
    const totals=items.reduce((map,item)=>{const currency=item.currency||'USD';map[currency]=(map[currency]||0)+(Number(item.price)||0);return map;},{});
    const rows=filtered();
    context.app.innerHTML=`
      <section class="page-head compact-head utility-page utility-assets native-assets-head"><div><div class="eyebrow">生活紀錄</div><h1 class="page-title">${tr('家中物品管理','Home Inventory')}</h1><p class="page-subtitle">${tr('家中物品、保固、位置與維護資料集中管理，並儲存在這個瀏覽器。','Track household items, warranties, locations and maintenance in this browser.')}</p></div><div class="section-actions"><button class="secondary-btn" data-asset-export>⇩ ${tr('匯出 Excel','Export Excel')}</button><button class="secondary-btn" data-asset-import>⇧ ${tr('匯入 Excel','Import Excel')}</button><input hidden type="file" accept=".xlsx,.xls" data-asset-file><button class="primary-btn" data-asset-add>＋ ${tr('新增設備','Add Item')}</button></div></section>
      <section class="asset-summary-grid" aria-label="${tr('資產概覽','Asset overview')}"><div class="panel"><small>${tr('設備數量','Total Items')}</small><strong>${items.length}</strong></div><div class="panel"><small>${tr('資產總值','Total Value')}</small><strong>${Object.keys(totals).length?Object.entries(totals).map(([currency,value])=>money(value,currency)).join(' · '):'—'}</strong></div><div class="panel"><small>${tr('待補購買日期','Missing Purchase Date')}</small><strong>${items.filter(item=>!item.purchaseDate).length}</strong></div></section>
      <section class="asset-toolbar panel"><label class="asset-search"><span aria-hidden="true">⌕</span><input type="search" value="${a(search)}" placeholder="${tr('搜尋設備、品牌、位置…','Search name, brand, location…')}" dir="ltr" aria-label="搜尋家中物品" data-asset-search></label><button class="secondary-btn" data-asset-new-category>＋ ${tr('新增分類','New Category')}</button></section>
      <div class="asset-category-strip" role="list" aria-label="${tr('分類','Categories')}"><button class="asset-category ${filter==='all'?'active':''}" data-asset-filter="all"><span>⌂</span><b>${tr('全部','All')}</b><small>${items.length}</small></button>${allCategories().map(key=>`<button class="asset-category ${filter===key?'active':''}" data-asset-filter="${a(key)}"><span>${icon(key)}</span><b>${e(label(key))}</b><small>${items.filter(item=>item.category===key).length}</small></button>`).join('')}</div>
      <section class="asset-list" aria-live="polite">${rows.length?rows.map(card).join(''):(items.length?`<div class="empty-state panel">${tr('找不到符合的設備','No matching items found')}</div>`:globalThis.IAN_OS_EMPTY_GUIDE({title:'還沒有家中物品',hint:'登錄第一件家中物品，追蹤價格與位置。',target:'[data-asset-add]'}))}</section>`;
    // Use the existing localization opt-out without changing global language state.
    for(const child of context.app.children){child.classList.add('user-content');child.lang='zh-TW';}
    bind();
    window.IAN_OS_PDF.mount(context.app.querySelector('.section-actions'),'asset',()=>items.map(v=>({...v,category:label(v.category)})),true);
    const exportButton=context.app.querySelector('[data-pdf-export]');if(exportButton){exportButton.textContent='匯出全部 PDF';exportButton.title='匯出家中物品全部記錄';}
  }
  function card(item){return `<article class="asset-card panel" data-asset-open="${a(item.id)}" tabindex="0" role="button" aria-label="${tr('編輯設備','Edit item')}: ${a(item.name)}"><div class="asset-card-icon" aria-hidden="true">${icon(item.category)}</div><div class="asset-card-main"><span class="eyebrow">${e(label(item.category))}</span><h2>${e(item.name||tr('未命名設備','Untitled item'))}</h2><p>${e([item.brand,item.model].filter(Boolean).join(' · ')||'—')}</p></div><dl><div><dt>${tr('位置','Location')}</dt><dd>${e(item.location||'—')}</dd></div><div><dt>${tr('保固','Warranty')}</dt><dd><span class="status-pill ${item.warrantyStatus==='under'?'status-success':'status-danger'}">${item.warrantyStatus==='under'?tr('保固中','Active'):tr('已過期','Expired')}</span></dd></div><div><dt>${tr('購買價格','Price')}</dt><dd>${money(item.price,item.currency)}</dd></div><div><dt>${tr('使用天數','Days Used')}</dt><dd>${days(item.purchaseDate)}</dd></div></dl><span class="asset-card-arrow" aria-hidden="true">›</span></article>`;}
  function bind(){
    const input=context.app.querySelector('[data-asset-search]');
    let composing=false;
    const updateResults=()=>{
      search=input.value;
      const rows=filtered();
      context.app.querySelector('.asset-list').innerHTML=rows.length?rows.map(card).join(''):(items.length?`<div class="empty-state panel">${tr('找不到符合的設備')}</div>`:globalThis.IAN_OS_EMPTY_GUIDE({title:'還沒有家中物品',hint:'登錄第一件家中物品，追蹤價格與位置。',target:'[data-asset-add]'}));
      bindItemCards();
    };
    input.oncompositionstart=()=>{composing=true;};
    input.oncompositionend=()=>{composing=false;updateResults();};
    input.oninput=event=>{if(!composing&&!event.isComposing)updateResults();};
    context.app.querySelectorAll('[data-asset-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.assetFilter;page();});
    context.app.querySelector('[data-asset-add]').onclick=()=>editor();
    context.app.querySelector('[data-asset-new-category]').onclick=()=>{const name=prompt(tr('輸入新的分類名稱：','Enter a new category name:'))?.trim();if(name)editor({...empty(),category:name});};
    bindItemCards();
    context.app.querySelector('[data-asset-export]').onclick=exportExcel;
    const file=context.app.querySelector('[data-asset-file]');context.app.querySelector('[data-asset-import]').onclick=()=>file.click();file.onchange=importExcel;
  }
  function bindItemCards(){
    context.app.querySelectorAll('[data-asset-open]').forEach(card=>{const open=()=>editor(items.find(item=>item.id===card.dataset.assetOpen));card.onclick=open;card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};});
  }
  function field(name,title,type='text',extra=''){return `<label><span>${title}</span><input name="${name}" type="${type}" ${extra}></label>`;}
  function editor(item=null){
    const record={...empty(),...(item||{})};
    const overlay=document.createElement('div');overlay.className='modal-backdrop user-content';overlay.lang='zh-TW';
    const categoryOptions=[...allCategories(),...(record.category&&!allCategories().includes(record.category)?[record.category]:[])];
    overlay.innerHTML=`<section class="modal modal-wide asset-editor" role="dialog" aria-modal="true" aria-labelledby="asset-editor-title"><div class="modal-header"><div><div class="eyebrow">家中物品</div><h2 id="asset-editor-title">${item?tr('編輯設備詳情','Edit Item Details'):tr('新增家庭設備','Add New Item')}</h2></div><button class="icon-btn" type="button" data-close aria-label="${tr('關閉','Close')}">×</button></div><form><div class="asset-form-section"><h3>${tr('基本資訊','Basic Information')}</h3>${field('name',tr('設備名稱','Item Name'),'text','required')}<div class="field-grid two"><label><span>${tr('分類','Category')}</span><select name="category">${categoryOptions.map(key=>`<option value="${a(key)}">${e(label(key))}</option>`).join('')}</select></label>${field('location',tr('放置位置','Location'))}</div><div class="field-grid two">${field('brand',tr('品牌名稱','Brand'))}${field('model',tr('型號編號','Model'))}</div></div><div class="asset-form-section"><h3>${tr('保固與財務','Warranty & Cost')}</h3><div class="field-grid two">${field('purchaseDate',tr('購買日期','Purchase Date'),'date')}${field('channel',tr('購買管道','Purchase Channel'))}</div><div class="field-grid two"><label><span>${tr('保固狀態','Warranty')}</span><select name="warrantyStatus"><option value="under">${tr('保固中','Active')}</option><option value="out">${tr('已過期','Expired')}</option></select></label>${field('warrantyExpiry',tr('保固到期日','Warranty Expiry'),'date')}</div>${field('warrantyRange',tr('保固範圍','Warranty Range'))}<div class="field-grid two">${field('price',tr('購買價格','Price'),'number','min="0" step="0.01"')}${field('currency',tr('貨幣單位','Currency'))}</div><label><span>${tr('成本計劃','Cost Plan')}</span><select name="costPlan"><option value="date">${tr('按日期','By Date')}</option><option value="month">${tr('每月固定','Monthly')}</option><option value="year">${tr('每年固定','Yearly')}</option><option value="count">${tr('按次數計','By Usage')}</option></select></label></div><div class="asset-form-section"><h3>${tr('貸款與分期','Loan & Financing')}</h3><div class="field-grid two">${field('loanTotalAmount',tr('貸款總金額','Loan Amount'),'number','step="0.01"')}${field('amountPaid',tr('已付金額','Amount Paid'),'number','step="0.01"')}</div><div class="field-grid two">${field('loanAmount',tr('每月還款金額','Monthly Payment'),'number','step="0.01"')}${field('loanEndDate',tr('貸款結束日期','Loan End Date'),'date')}</div></div><div class="asset-form-section"><h3>${tr('技術資訊','Technical Info')}</h3><div class="field-grid two">${field('app',tr('關聯 APP','Connected App'))}${field('ipAddress',tr('IP 位址','IP Address'))}</div><label><span>${tr('備註說明','Notes')}</span><textarea name="notes" rows="4"></textarea></label></div><div class="asset-form-section"><h3>${tr('發票與憑證','Invoice & Receipt')}</h3><div class="asset-invoice"><input type="file" accept="image/*,application/pdf" data-invoice-file>${record.invoicePath?`<button class="secondary-btn" type="button" data-view-invoice>${tr('檢視憑證','View Document')}</button><button class="secondary-btn" type="button" data-remove-invoice>${tr('移除','Remove')}</button>`:''}</div><small data-invoice-name>${e(record.invoiceName||'')}</small></div><div class="modal-actions">${item?`<button class="danger-btn secondary-danger" type="button" data-delete>${tr('刪除設備','Delete Item')}</button>`:''}<button class="secondary-btn" type="button" data-close>${tr('取消','Cancel')}</button><button class="primary-btn" type="submit">${tr('儲存設備','Save Item')}</button></div></form></section>`;
    document.body.appendChild(overlay);window.IAN_OS_DIALOG.activate(overlay);
    if(item?.id){window.IAN_OS_PDF.mount(overlay.querySelector('.modal-actions'),'asset',()=>[{...item,category:label(item.category)}]);const exportButton=overlay.querySelector('[data-pdf-export]');if(exportButton){exportButton.textContent='匯出 PDF';exportButton.title='匯出已儲存的記錄';}}
    const form=overlay.querySelector('form');for(const [key,value] of Object.entries(record)){if(form.elements[key])form.elements[key].value=value??'';}
    const close=()=>{window.IAN_OS_DIALOG.deactivate(overlay);overlay.remove();};overlay.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
    overlay.querySelector('[data-invoice-file]').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const id=record.id||window.IAN_OS_CLOUD.uuid();record.id=id;record.invoicePath=await window.IAN_OS_CLOUD.uploadHomeAssetInvoice(file,id);record.invoiceName=file.name;overlay.querySelector('[data-invoice-name]').textContent=file.name;context.toast(tr('憑證已上傳；儲存設備後完成同步','Document uploaded; save the item to finish'));}catch(error){context.toast(error.message||tr('上傳失敗','Upload failed'));}};
    overlay.querySelector('[data-view-invoice]')?.addEventListener('click',async()=>{
      try{window.open(await window.IAN_OS_CLOUD.signedFileUrl(record.invoicePath),'_blank','noopener');}
      catch{context?.toast(tr('無法開啟憑證，請稍後重試','Unable to open the document; try again'));}
    });
    overlay.querySelector('[data-remove-invoice]')?.addEventListener('click',()=>{record.invoicePath='';record.invoiceName='';overlay.querySelector('[data-invoice-name]').textContent='';});
    overlay.querySelector('[data-delete]')?.addEventListener('click',async()=>{const removed=await window.IAN_OS_DELETE.run({name:record.name,message:tr('此操作無法復原。','This action cannot be undone.'),action:()=>window.IAN_OS_CLOUD.deleteHomeAsset(record.id)});if(!removed)return;items=items.filter(value=>value.id!==record.id);if(record.invoicePath)window.IAN_OS_CLOUD.deletePrivatePaths([record.invoicePath]).catch(()=>{});close();page();context.onCountChange?.();});
    let saving=false;
    form.onsubmit=async event=>{
      event.preventDefault();if(saving)return;
      saving=true;
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      const owner=context,generation=loadGeneration;
      const values=Object.fromEntries(new FormData(form));
      record.id=record.id||window.IAN_OS_CLOUD.uuid();
      const next={...record,...values,price:Number(values.price||0)};
      const nextItems=items.some(value=>value.id===next.id)?items.map(value=>value.id===next.id?next:value):[next,...items];
      try{
        await window.IAN_OS_CLOUD.saveHomeAssets(nextItems);
        if(generation!==loadGeneration)return;
        items=nextItems;close();
        if(context===owner){
          if(!owner.isCurrent||owner.isCurrent())page();
          owner.onCountChange?.();owner.toast('設備已儲存');
        }
      }catch{
        if(context===owner)owner.toast('儲存失敗，請重試');
      }finally{saving=false;submit.disabled=false;}
    };
  }
  function ensureXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=XLSX_SRC;script.async=true;
      const finish=error=>{
        clearTimeout(timer);script.onload=null;script.onerror=null;
        if(error){script.remove();reject(error);}else resolve(window.XLSX);
      };
      const timer=setTimeout(()=>finish(new Error('XLSX load timed out')),12000);
      script.onload=()=>finish(window.XLSX?null:new Error('XLSX unavailable'));
      script.onerror=()=>finish(new Error('XLSX load failed'));
      document.head.appendChild(script);
    }).catch(error=>{xlsxPromise=null;throw error;});
    return xlsxPromise;
  }
  async function exportExcel(){
    const owner=context,generation=loadGeneration;
    try{const XLSX=await ensureXlsx();if(generation!==loadGeneration||context!==owner)return;const sheet=XLSX.utils.json_to_sheet(items.map(({invoiceData,...item})=>item));const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Home Assets');XLSX.writeFile(book,`Home_Assets_${new Date().toISOString().slice(0,10)}.xlsx`);}
    catch{if(context===owner&&owner)owner.toast('Excel 元件載入失敗，請重試');}
  }
  async function importExcel(event){const file=event.target.files[0];if(!file)return;try{const XLSX=await ensureXlsx();const reader=new FileReader();reader.onload=async e=>{try{const book=XLSX.read(e.target.result,{type:'array'}),sheet=book.Sheets[book.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:''});const added=rows.map(row=>({...empty(),id:window.IAN_OS_CLOUD.uuid(),name:row.name||row.Name||row['設備名稱']||row['物品名稱']||'',brand:row.brand||row.Brand||row['品牌']||'',model:row.model||row.Model||row['型號']||'',location:row.location||row.Location||row['放置位置']||'',category:row.category||row.Category||row['分類']||'others',price:row.price||row.Price||row['購買價格']||0,currency:row.currency||row.Currency||row['貨幣單位']||'USD',notes:row.notes||row.Notes||row['備註說明']||''})).filter(row=>row.name);const nextItems=[...added,...items];await window.IAN_OS_CLOUD.saveHomeAssets(nextItems);items=nextItems;page();context.onCountChange?.();context.toast(tr(`已匯入 ${added.length} 筆`,`Imported ${added.length} items`));}catch{context.toast(tr('匯入失敗，請檢查檔案','Import failed; check the file'));}finally{event.target.value='';}};reader.readAsArrayBuffer(file);}catch{event.target.value='';context.toast(tr('Excel 元件載入失敗，請重試','Unable to load Excel tools; try again'));}}
  async function render(options){
    context=options;
    const current=()=>context===options&&(!options.isCurrent||options.isCurrent());
    if(!loaded || !options.app.querySelector('.native-assets-head'))options.app.innerHTML=`<div class="panel asset-loading user-content" role="status">${'正在載入物品資料'}</div>`;
    try{await ensureLoaded();if(current())page();}
    catch{
      if(!current())return;
      options.app.innerHTML=`<div class="panel empty-state asset-loading user-content" role="alert">${'無法載入家中物品資料。'}<button type="button" class="secondary-btn" data-asset-retry>${'重試'}</button></div>`;
      options.app.querySelector('[data-asset-retry]').onclick=()=>render(options);
    }
  }
  function reset(){loadGeneration++;items=[];loaded=false;loading=null;search='';filter='all';context=null;}
  window.IAN_OS_HOME_ASSETS={render,reset};
})();
