/* Fictional data only. The public mirror starts with these local records. */
(() => {
  const day=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)};
  const time=(offset,hour)=>`${day(offset)}T${hour}:00`;
  const common=(type,id,title,category,description)=>({id,type,title,description,content:`<p>${description}</p>`,category,tags:[category],favorite:false,checklist:[],attachments:[],createdAt:day(-10),updatedAt:day(-1)});
  const notes=[common('note','11111111-1111-4111-8111-111111111111','社區藝文活動構想','創意','規劃一場小型藝文交流，整理場地、海報與活動流程。'),common('note','11111111-1111-4111-8111-111111111112','週末閱讀摘記','生活','閱讀版面設計文章，記下留白與字級的運用方式。')];
  const prompts=[{...common('prompt','22222222-2222-4222-8222-222222222221','清楚的工作摘要','寫作','把提供的文字整理成三個重點，標記需要確認的內容。'),styleImages:[]}];
  const skills=[common('skill','33333333-3333-4333-8333-333333333331','編排與字體層級','設計','使用字級與留白安排閱讀順序。')];
  const videos=[{...common('video','44444444-4444-4444-8444-444444444441','版面設計示範','學習','示範影片項目，連結為公開範例網址。'),url:'https://example.com/video'}];
  const bookmarks=[{...common('bookmark','55555555-5555-4555-8555-555555555551','設計靈感資料庫','靈感','示範用網站，不含私人收藏。'),url:'https://example.com/design'}];
  const tasks=[{...common('task','66666666-6666-4666-8666-666666666661','檢查展示版手機排版','工作','確認卡片、按鈕與導覽在手機上容易操作。'),status:'todo',priority:'high',dueDate:day(1)},{...common('task','66666666-6666-4666-8666-666666666662','整理活動參考資料','創意','選擇幾張合適的示範圖。'),status:'todo',priority:'medium',dueDate:day(3)}];
  const events=[{...common('event','77777777-7777-4777-8777-777777777771','展示設計討論','會議','討論虛構專案的視覺方向。'),start:time(2,'10:00'),end:time(2,'11:00'),allDay:false}];
  const communications=[{...common('communication','88888888-8888-4888-8888-888888888881','活動場地詢問','工作','虛構的往來訊息，沒有寄送功能。'),subject:'活動場地詢問',notes:'確認場地是否有投影設備。',contact:'示範合作夥伴',channel:'Email',direction:'received',status:'open',dateTime:time(-1,'14:00')}];
  const projects=[{...common('project','99999999-9999-4999-8999-999999999991','街區藝文指南','工作','製作虛構街區活動的視覺指南。'),status:'active',version:'0.1',entries:[]}];
  [
    ['展場導覽草稿','工作','規劃作品說明與展場導覽節奏。'],
    ['植物色彩觀察','生活','整理葉片、陰影與自然色階的配色參考。'],
    ['網站版面檢查','工作','檢查主選單、首頁卡片與手機上的文字可讀性。'],
    ['攝影集封面提案','創意','嘗試幾種不同比例的封面字體排列。']
  ].forEach(([title,category,description],i)=>notes.push(common('note',`11111111-1111-4111-8111-${String(i+3).padStart(12,'0')}`,title,category,description)));
  [
    ['產品介紹精簡稿','寫作','使用自然語氣說明功能與限制。'],
    ['活動視覺檢查表','設計','依字體、對比與留白檢查版面。']
  ].forEach(([title,category,description],i)=>prompts.push({...common('prompt',`22222222-2222-4222-8222-${String(i+2).padStart(12,'0')}`,title,category,description),styleImages:[]}));
  skills.push(common('skill','33333333-3333-4333-8333-333333333332','資訊架構整理','設計','以清楚分類與標題協助讀者找到內容。'));
  [
    ['排版練習網站','靈感','觀察範例的網格與邊界。'],
    ['城市地圖範例','生活','示範用的公開地圖資源。']
  ].forEach(([title,category,description],i)=>bookmarks.push({...common('bookmark',`55555555-5555-4555-8555-${String(i+2).padStart(12,'0')}`,title,category,description),url:`https://example.com/${i+1}`}));
  tasks.push({...common('task','66666666-6666-4666-8666-666666666663','確認印刷紙樣','工作','查看示範紙張與色彩。'),status:'todo',priority:'low',dueDate:day(5)});
  events.push({...common('event','77777777-7777-4777-8777-777777777772','週末散步','生活','虛構城市的週末散步。'),start:time(5,'11:00'),end:time(5,'13:00'),allDay:false});
  communications.push({...common('communication','88888888-8888-4888-8888-888888888882','示範設計回覆','工作','虛構往來紀錄。'),subject:'示範設計回覆',notes:'已收到修改方向，待確認交付日期。',contact:'範例合作夥伴',channel:'Message',direction:'received',status:'open',dateTime:time(-2,'09:00')});
  window.IAN_OS_SEED=Object.freeze({categories:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',name:'工作',icon:'◇',color:'#2563EB'},{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',name:'生活',icon:'○',color:'#4c8a61'},{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',name:'創意',icon:'✦',color:'#b97d60'}],notes,prompts,skills,videos,bookmarks,projects,graphSets:[],tasks,events,communications,workflows:[],creditCards:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',name:'日常採買卡',last4:'0000',issuer:'示範發卡機構',closingDate:'15',dueDate:'28',currency:'USD',limit:0,annualFee:0,benefits:'<p>虛構示範卡片，沒有真實帳戶資料。</p>',recommendedUses:['日常採買']}],vendors:[{id:'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',name:'北岸印刷工坊',contactPerson:'示範窗口',phone:'',address:'虛構街區',businessHours:'週一至週五',website:'https://example.com',notes:'展示用商家，不代表真實服務。',categoryIds:['dddddddd-dddd-4ddd-8ddd-ddddddddddd1'],createdAt:day(-5),updatedAt:day(-5)}],vendorCategories:[{id:'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',name:'印刷'}],settings:{language:'zh',briefNote:'',preferences:{trips:[{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',title:'海岸城市散步',start:day(20),end:day(22),destination:'示範海岸城',transportMode:'road_trip',type:'domestic',currency:'USD',budget:0,checklist:[{text:'整理行李',done:false}],shoppingList:[],flights:[],days:[]}]}}});
  window.IAN_OS_DEMO_RESTAURANTS=[{id:'ffffffff-ffff-4fff-8fff-fffffffffff1',name:'橡樹街咖啡',city:'示範海岸城',cuisine:'咖啡',address:'虛構地址，不對應實際地點',hours:'週一至週五 09:00–17:00',phone:'',url:'',notes:'採光良好的虛構咖啡店。',created_at:day(-4),updated_at:day(-4)},{id:'ffffffff-ffff-4fff-8fff-fffffffffff2',name:'青葉小館',city:'示範海岸城',cuisine:'蔬食',address:'虛構地址，不對應實際地點',hours:'每日 11:00–20:00',phone:'',url:'',notes:'季節蔬菜料理的虛構餐廳。',created_at:day(-2),updated_at:day(-2)}];
  [
    ['晨光烘焙','麵包','展示週末早餐的虛構店家。'],
    ['白石麵屋','日式','一間虛構的麵食小店。'],
    ['河畔餐桌','美式','示範城市中的簡餐店。'],
    ['柚子食堂','台式','提供家常料理的虛構食堂。'],
    ['微光晚餐','義式','虛構的晚餐地點。'],
    ['小山茶屋','茶飲','以閱讀和茶飲為主的虛構空間。']
  ].forEach(([name,cuisine,notes],i)=>window.IAN_OS_DEMO_RESTAURANTS.push({id:`ffffffff-ffff-4fff-8fff-${String(i+3).padStart(12,'0')}`,name,city:i%2?'示範海岸城':'虛構山城',cuisine,address:'虛構地址，不對應實際地點',hours:'每日 10:00–19:00',phone:'',url:'',notes,created_at:day(-i-2),updated_at:day(-i-2)}));
  window.IAN_OS_DEMO_ASSETS=[{id:'abababab-abab-4bab-8bab-ababababab01',name:'展示用桌燈',brand:'Sample',model:'Desk 01',category:'lighting',location:'示範工作室',price:0,currency:'USD',notes:'不代表真實購買紀錄。'}];
})();
