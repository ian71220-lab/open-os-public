/* Public mirror adapter. No network client, credentials or remote persistence. */
(() => {
  'use strict';
  const keys={state:'open-os-demo-state-v1',restaurants:'open-os-demo-restaurants-v1',assets:'open-os-demo-assets-v1',automations:'open-os-demo-automation-v1'};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key));return value??clone(fallback);}catch{return clone(fallback);}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{throw new Error('瀏覽器儲存空間不足或不可使用。');}};
  const uuid=()=>crypto.randomUUID();
  const user={id:'00000000-0000-4000-8000-000000000001',email:'demo@example.invalid'};
  let listener=()=>{},assets=[],activeState=null;
  const notify=()=>listener({state:'saved',message:'僅儲存在這個瀏覽器'});
  const state=()=>activeState||read(keys.state,window.IAN_OS_SEED);
  const update=value=>{activeState=clone(value);write(keys.state,activeState);notify();};
  const assetRows=()=>read(keys.assets,window.IAN_OS_DEMO_ASSETS||[]);
  const fileKey='open-os-demo-files-v1';
  const files=new Map(Object.entries(read(fileKey,{})));
  const saveFiles=()=>write(fileKey,Object.fromEntries(files));
  const fileToData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('本機檔案讀取失敗'));reader.readAsDataURL(file);});
  async function upload(file){if(file.size>1_000_000)throw new Error('公開版附件上限 1 MB，請選擇較小的檔案。');const path=`demo-file-${uuid()}`;const url=await fileToData(file);files.set(path,url);saveFiles();return path;}
  function automationRequest(name,args={}){
    const entries=read(keys.automations,{rules:[],phase2:[],inbox:[],history:[]});
    if(name==='ian_notify_unread_count')return Promise.resolve(entries.inbox.filter(row=>!row.read_at).length);
    if(/_list$/.test(name))return Promise.resolve(clone(name.includes('phase2')?entries.phase2:entries.rules));
    if(/_inbox$/.test(name))return Promise.resolve(clone(entries.inbox));
    if(/_history$/.test(name))return Promise.resolve(clone(entries.history));
    if(/_save$/.test(name)){const list=name.includes('phase2')?entries.phase2:entries.rules;const payload=args.p_data||{};const item={...payload,id:args.p_id||uuid(),revision:1,name:payload.name||'示範規則',enabled:false,archived:false,source_name:'虛構範例',created_at:new Date().toISOString()};const index=list.findIndex(row=>row.id===item.id);if(index<0)list.unshift(item);else list[index]={...list[index],...item};write(keys.automations,entries);return Promise.resolve(clone(list[index<0?0:index]));}
    if(/_run$/.test(name))return Promise.resolve({status:'skipped',message:'公開版不會執行背景工作。'});
    if(/_archive$/.test(name)){const list=name.includes('phase2')?entries.phase2:entries.rules;const item=list.find(row=>row.id===args.p_id);if(item)item.archived=true;write(keys.automations,entries);return Promise.resolve(true);}
    if(/_delete_read$|_read$/.test(name))return Promise.resolve(true);
    return Promise.resolve([]);
  }
  window.IAN_OS_CLOUD={
    configured:()=>true,init:()=>{},user:()=>user,uuid,onAuthChange:()=>{},onStatus:fn=>{listener=fn||(()=>{});notify();},
    session:async()=>({user}),signIn:async()=>({user}),signOut:async()=>{},
    loadState:async seed=>{activeState=read(keys.state,seed);return clone(activeState);},
    queueSave:update,saveState:async value=>update(value),savePreferences:async value=>update(value),flushSave:async()=>true,
    remapLegacy:value=>value,deleteRecord:async()=>true,deleteCategory:async()=>true,
    loadRestaurants:async()=>read(keys.restaurants,window.IAN_OS_DEMO_RESTAURANTS||[]),
    saveRestaurant:async(id,values)=>{const rows=read(keys.restaurants,window.IAN_OS_DEMO_RESTAURANTS||[]),record={...values,id:id||uuid(),updated_at:new Date().toISOString()};const i=rows.findIndex(row=>row.id===id);if(i>=0)rows[i]=record;else rows.unshift(record);write(keys.restaurants,rows);return clone(record);},
    deleteRestaurant:async id=>{write(keys.restaurants,read(keys.restaurants,window.IAN_OS_DEMO_RESTAURANTS||[]).filter(row=>row.id!==id));return {id};},
    loadHomeAssets:async()=>{assets=assetRows();return clone(assets);},saveHomeAssets:async rows=>{assets=clone(rows);write(keys.assets,assets);return true;},
    deleteHomeAsset:async id=>{assets=assetRows().filter(row=>row.id!==id);write(keys.assets,assets);return true;},homeAssetCount:()=>assetRows().length,
    uploadHomeAssetInvoice:async file=>upload(file),signedFileUrl:async path=>files.get(path)||path,
    uploadPromptStyleImage:async(file,promptId,image={})=>({storage_path:await upload(file),file_name:image.name||file.name,mime_type:file.type,file_size:file.size,caption:image.caption||''}),
    refreshPromptUrls:async prompts=>{for(const prompt of prompts||[])for(const image of prompt.styleImages||[])if(image.storage_path&&files.has(image.storage_path))image.src=files.get(image.storage_path);},
    uploadAttachment:async(file,entityType,entityId)=>{const storage_path=await upload(file);return {id:uuid(),record_type:entityType,record_id:entityId,storage_path,file_name:file.name,mime_type:file.type,file_size:file.size,src:files.get(storage_path)};},
    hydrateAttachmentUrls:async rows=>(rows||[]).map(item=>({...item,src:files.get(item.storage_path)||item.src||''})),
    deleteAttachment:async attachment=>{files.delete(attachment.storage_path);saveFiles();return true;},deleteAttachmentsForEntity:async()=>{},deletePrivatePaths:async paths=>{for(const path of paths||[])files.delete(path);saveFiles();},
    checkCalendarImportSchema:async()=>true,automationRequest,gmailRequest:async()=>({connected:false}),
    tables:[]
  };
})();
