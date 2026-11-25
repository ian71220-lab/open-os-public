(() => {
  'use strict';
  const definitions = [
    ['notes','筆記',['title','content','description','category','tags']],
    ['bookmarks','書籤',['title','url','description','notes','category','tags']],
    ['tasks','待辦',['title','notes','description','dueDate','tags']],
    ['events','行事曆事件',['title','description','notes','location','start','tags']],
    ['communications','訊息紀錄',['subject','contact','notes','channel','tags']],
    ['projects','專案',['title','description','category','tags','entries']],
    ['creditCards','信用卡',['name','bank','last4','notes','recommendedUses']],
    ['trips','旅行',['name','title','destination','notes','days']],
    ['restaurants','餐廳',['name','city','cuisine','address','notes','phone']],
    ['vendors','商家',['name','contactPerson','phone','address','businessHours','website','notes','categoryNames']],
    ['prompts','提示詞',['title','content','description','category','tags']],
    ['skills','技能',['title','content','description','category','tags']],
    ['videos','影片',['title','description','url','category','tags']]
  ];
  const flatten = value => {
    if(value == null) return '';
    if(Array.isArray(value)) return value.map(flatten).join(' ');
    if(typeof value === 'object') return Object.values(value).map(flatten).join(' ');
    return String(value);
  };
  const normalized = value => String(value ?? '').trim().toLocaleLowerCase();
  function search(data, input) {
    const needle=normalized(input);
    if(!needle) return [];
    return definitions.map(([key,label,fields])=>{
      const source=key==='trips'?data?.settings?.preferences?.trips:key==='restaurants'?data?.restaurants:data?.[key];
      const rows=Array.isArray(source)?source:[];
      const items=rows.filter(row=>row&&fields.some(field=>normalized(flatten(row[field])).includes(needle)));
      return {key,label,count:items.length,items};
    }).filter(group=>group.count);
  }
  function visible(group,expanded=false){return expanded?group.items:group.items.slice(0,5);}
  const api={definitions,search,visible};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.IAN_OS_GLOBAL_SEARCH_LOGIC=api;
})();
