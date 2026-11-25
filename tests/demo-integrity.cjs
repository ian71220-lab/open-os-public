'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),site=path.join(root,'site'),store=new Map();
const context={window:{},crypto:require('node:crypto').webcrypto,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},Date,JSON,Map,Promise};vm.createContext(context);
for(const name of ['data.js','demo-store.js'])vm.runInContext(fs.readFileSync(path.join(site,'js',name),'utf8'),context);
const cloud=context.window.IAN_OS_CLOUD,seed=context.window.IAN_OS_SEED;
assert(seed.notes.length&&seed.tasks.length&&seed.projects.length&&context.window.IAN_OS_DEMO_RESTAURANTS.length);
assert.equal(cloud.configured(),true);assert.equal(cloud.user().email,'demo@example.invalid');
(async()=>{
 const first=await cloud.loadState(seed);assert(first.notes.length>0);first.notes[0].title='Local edit';cloud.queueSave(first);assert.equal((await cloud.loadState(seed)).notes[0].title,'Local edit');
 const row=await cloud.saveRestaurant(null,{name:'Fictional local cafe',city:'Sample City'});assert((await cloud.loadRestaurants()).some(x=>x.id===row.id));await cloud.deleteRestaurant(row.id);assert(!(await cloud.loadRestaurants()).some(x=>x.id===row.id));assert((await cloud.loadRestaurants()).length>0);
 const original=await cloud.loadHomeAssets();await cloud.saveHomeAssets([...original,{id:'local-asset',name:'Example'}]);assert((await cloud.loadHomeAssets()).some(x=>x.id==='local-asset'));await cloud.deleteHomeAsset('local-asset');assert(!(await cloud.loadHomeAssets()).some(x=>x.id==='local-asset'));
 assert.deepEqual(await cloud.automationRequest('ian_auto_inbox'),[]);assert.equal(await cloud.automationRequest('ian_notify_unread_count'),0);assert.equal((await cloud.gmailRequest()).connected,false);
 const html=fs.readFileSync(path.join(site,'index.html'),'utf8');assert(/OPEN OS/.test(html));assert(/js\/demo-store\.js/.test(html));assert(!/supabase-(?:config|store)|vendor\/supabase/.test(html));
 const paths=[];for(const dir of ['site','tests','tools']){const visit=p=>{for(const ent of fs.readdirSync(p,{withFileTypes:true})){const full=path.join(p,ent.name);if(ent.isDirectory())visit(full);else paths.push(full);}};visit(path.join(root,dir));}
 for(const file of paths){if(file.endsWith('demo-integrity.cjs'))continue;const bytes=fs.readFileSync(file);if(bytes.includes(0))continue;const body=bytes.toString('utf8');assert(!/qurjksow|os\.ianho\.us|admin\.shopify\.com\/store\/likfineart|hostingersite\.com|SUPABASE_(?:URL|KEY)|ANTHROPIC_API_KEY/i.test(body),`private identifier in ${file}`);}
 assert(!fs.existsSync(path.join(site,'js/supabase-store.js')));assert(!fs.existsSync(path.join(site,'js/vendor/supabase.min.js')));assert(!fs.existsSync(path.join(site,'modules/home-assets/index.html')));
 console.log('PASS fictional seed, local state/restaurants/assets CRUD, disabled remote adapters, asset/identifier scan');
})().catch(error=>{console.error(error);process.exitCode=1});
