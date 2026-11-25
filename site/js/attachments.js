(() => {
  const allowed=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
  const maxSize=25*1024*1024;
  let existing=[],pending=[],removed=[],entityType='note',entityId='';
  const lang=()=>window.IAN_OS_UI?.lang?.()||'zh';
  const text=(zh,en)=>lang()==='zh'?zh:en;
  const esc=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const input=()=>document.getElementById('captureImagesInput');
  const grid=()=>document.getElementById('captureImageGrid');
  const displayName=image=>image.file_name||image.file?.name||text('圖片','Image');
  const source=image=>image.src||image.preview||'';

  function valid(file){
    if(!allowed.has(String(file.type||'').toLowerCase()))throw new Error(text('僅支援 JPEG、PNG、WebP 或 HEIC。','Use JPEG, PNG, WebP or HEIC images.'));
    if(!file.size||file.size>maxSize)throw new Error(text('每張圖片必須小於 25 MB。','Each image must be 25 MB or smaller.'));
  }
  function revoke(image){if(image.preview?.startsWith('blob:'))URL.revokeObjectURL(image.preview);}
  function open(item,type){
    pending.forEach(revoke);existing=(item?.attachments||[]).map(value=>({...value}));pending=[];removed=[];
    entityType=type||item?.type||'note';entityId=item?.id||'';render();
    if(existing.some(value=>value.storage_path&&!source(value)))hydrate(existing).then(values=>{existing=values;render();}).catch(()=>{});
  }
  function close(){pending.forEach(revoke);pending=[];removed=[];existing=[];if(input())input().value='';render();}
  function addFiles(files){
    for(const file of files){valid(file);pending.push({file,preview:URL.createObjectURL(file),file_name:file.name,mime_type:file.type,file_size:file.size});}
    if(input())input().value='';render();
  }
  function remove(index,kind){
    if(kind==='existing'){const [item]=existing.splice(index,1);if(item)removed.push(item);}
    else {const [item]=pending.splice(index,1);if(item)revoke(item);}
    render();
  }
  function render(){
    const el=grid();if(!el)return;
    const entries=[...existing.map((item,index)=>({item,index,kind:'existing'})),...pending.map((item,index)=>({item,index,kind:'pending'}))];
    el.innerHTML=entries.length?entries.map(({item,index,kind})=>`<figure class="capture-image-thumb"><button type="button" class="capture-image-preview" data-attachment-preview="${kind}:${index}" aria-label="${esc(text('預覽','Preview'))} ${esc(displayName(item))}">${source(item)?`<img src="${esc(source(item))}" alt="${esc(displayName(item))}">`:`<span class="attachment-image-loading" role="status">${text('載入圖片…','Loading image…')}</span>`}</button><button type="button" class="capture-image-remove" data-attachment-remove="${kind}:${index}" aria-label="${esc(text('移除','Remove'))} ${esc(displayName(item))}">×</button><figcaption>${esc(displayName(item))}</figcaption></figure>`).join(''):`<div class="capture-images-empty">${text('尚未加入圖片','No images added')}</div>`;
    el.querySelectorAll('[data-attachment-remove]').forEach(button=>button.addEventListener('click',()=>{const [kind,index]=button.dataset.attachmentRemove.split(':');remove(Number(index),kind);}));
    el.querySelectorAll('[data-attachment-preview]').forEach(button=>button.addEventListener('click',()=>{const [kind,index]=button.dataset.attachmentPreview.split(':');preview((kind==='existing'?existing:pending)[Number(index)]);}));
  }
  async function hydrate(list){return window.IAN_OS_CLOUD.hydrateAttachmentUrls(list||[]);}
  async function commit(type,id){
    entityType=type;entityId=id;
    while(pending.length){
      const item=pending[0];
      try{
        const uploaded=await window.IAN_OS_CLOUD.uploadAttachment(item.file,type,id);
        existing.push(uploaded);revoke(item);pending.shift();render();
      }catch(error){throw new Error(`${displayName(item)} — ${error?.message||text('上傳失敗','Upload failed')}`);}
    }
    while(removed.length){
      const item=removed[0];
      try{await window.IAN_OS_CLOUD.deleteAttachment(item);removed.shift();}
      catch(error){throw new Error(`${displayName(item)} — ${error?.message||text('刪除失敗','Removal failed')}`);}
    }
    render();return current();
  }
  function current(includePendingDeletes=false){return [...existing,...(includePendingDeletes?removed:[])].map(value=>({...value}));}
  function signature(){return JSON.stringify({existing:existing.map(item=>item.id),pending:pending.map(item=>[item.file_name,item.file_size]),removed:removed.map(item=>item.id)});}
  function gallery(items){
    const visible=(items||[]).map((item,index)=>({item,index})).filter(entry=>source(entry.item)||entry.item?.storage_path);
    if(!visible.length)return '';
    return `<section class="attachment-gallery-section"><h2>${text('圖片','Images')}</h2><div class="attachment-gallery">${visible.map(({item,index})=>`<button type="button" class="attachment-gallery-item" data-saved-image="${index}" aria-label="${esc(text('預覽','Preview'))} ${esc(displayName(item))}">${source(item)?`<img src="${esc(source(item))}" alt="${esc(displayName(item))}" loading="lazy">`:`<span class="attachment-image-loading" role="status">${text('載入圖片…','Loading image…')}</span>`}</button>`).join('')}</div></section>`;
  }
  function bindGallery(root,items){
    const buttons=[...(root?.querySelectorAll('[data-saved-image]')||[])];let loadPromise=null;
    const load=()=>{if(!(items||[]).some(item=>item?.storage_path&&!source(item)))return Promise.resolve(items);if(loadPromise)return loadPromise;loadPromise=hydrate(items).then(values=>{items.splice(0,items.length,...values);buttons.forEach(button=>{const item=items[Number(button.dataset.savedImage)];if(!source(item))return;button.innerHTML=`<img src="${esc(source(item))}" alt="${esc(displayName(item))}" loading="lazy">`;button.querySelector('img')?.addEventListener('error',()=>button.remove());});return items;}).finally(()=>{loadPromise=null;});return loadPromise;};
    load().catch(()=>{});buttons.forEach(button=>button.addEventListener('click',async()=>{await load().catch(()=>{});preview(items[Number(button.dataset.savedImage)]); }));
  }
  function preview(item){
    if(!item||!source(item))return;
    const backdrop=document.getElementById('imageBackdrop'),content=document.getElementById('imageViewerContent');
    backdrop.classList.add('attachment-lightbox');
    content.innerHTML=`<figure class="attachment-viewer"><img src="${esc(source(item))}" alt="${esc(displayName(item))}"><figcaption title="${esc(displayName(item))}">${esc(displayName(item))}</figcaption></figure>`;
    backdrop.hidden=false;window.IAN_OS_DIALOG?.activate(backdrop);
  }
  input()?.addEventListener('change',event=>{try{addFiles([...event.target.files]);}catch(error){window.dispatchEvent(new CustomEvent('ian-attachment-error',{detail:error.message}));}});
  window.IAN_OS_ATTACHMENTS={open,close,commit,hydrate,gallery,bindGallery,preview,signature,current};
})();
