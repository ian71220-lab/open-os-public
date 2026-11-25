(() => {
  let localStorageWarningShown=false;
  function safeStorageGet(key){try{return window.localStorage.getItem(key);}catch(error){if(!localStorageWarningShown){localStorageWarningShown=true;console.warn('[OPEN OS] Optional browser storage read failed.',{name:error?.name||'StorageError'});}return null;}}
  function safeStorageSet(key,value){try{window.localStorage.setItem(key,value);return true;}catch(error){if(!localStorageWarningShown){localStorageWarningShown=true;console.warn('[OPEN OS] Optional browser storage write failed.',{name:error?.name||'StorageError'});}return false;}}
  const I18N = {
    zh: {
      vendors:'商家與廠商', home:'首頁', navKnowledge:'知識', navLife:'生活', navWorkspace:'工作空間', notes:'筆記', bookmarks:'書籤', videos:'影音牆', travel:'旅遊規劃', automations:'自動化', graph:'關聯圖譜', health:'系統健康', settings:'設定 · 分類管理', homeAssets:'家中物品管理', creditCards:'信用卡管理', reminders:'待辦與提醒', projects:'專案', calendar:'行程', communications:'訊息紀錄', export:'匯出 JSON', reset:'重設示範資料', add:'新增',
      search:'搜尋 OPEN OS…', morning:'每日早報', todayAgenda:'今日行程', todayTasks:'今日交辦', messages:'Email / 訊息紀錄', month:'工作整月排程',
      quick:'快速新增', noItems:'目前沒有資料', edit:'編輯', copy:'複製 Prompt', favorite:'收藏', back:'返回', open:'開啟連結', prompt:'Prompt 指令', styles:'風格參考圖',
      notesTitle:'筆記', notesSub:'集中保存工作筆記、想法、SOP、研究資料與影片連結。', promptsSub:'把常用指令做成可視覺瀏覽、可編輯、可複製的 Prompt Library。',
      skillsSub:'保存長期 AI 角色、工作模式與完整協作指令。', bookmarksSub:'保存網址，也記錄當初為什麼收藏。', calendarSub:'管理每天行程與整月工作排程。', commSub:'記錄 Email、Teams、簡訊等來往與待追蹤狀態。',
      all:'全部', addNote:'新增筆記', addPrompt:'新增 Prompt', addSkill:'新增 Skill', addBookmark:'新增書籤', addTask:'新增交辦', addEvent:'新增行程', logMessage:'記錄訊息',
      overdue:'逾期', dueToday:'今日到期', schedule:'今日行程', followup:'需追蹤', recent:'最近更新', searchResults:'搜尋結果'
    },
    en: {
      vendors:'Vendors', home:'Home', navKnowledge:'KNOWLEDGE', navLife:'LIFE', navWorkspace:'WORKSPACE', notes:'Notes', bookmarks:'Bookmarks', videos:'Video Wall', travel:'Travel Planning', automations:'Automations', graph:'Relation Graph', health:'System Health', settings:'Settings · Categories', homeAssets:'Home Inventory', creditCards:'Credit Cards', reminders:'Tasks & Reminders', projects:'Projects', calendar:'Calendar', communications:'Messages', export:'Export JSON', reset:'Reset Demo Data', add:'Add',
      search:'Search OPEN OS…', morning:'Morning Brief', todayAgenda:"Today's Schedule", todayTasks:"Today's Tasks", messages:'Email / Message Log', month:'Monthly Work Schedule',
      quick:'Quick Add', noItems:'Nothing here yet', edit:'Edit', copy:'Copy Prompt', favorite:'Favorite', back:'Back', open:'Open Link', prompt:'Prompt', styles:'Style References',
      notesTitle:'Notes', notesSub:'Keep work notes, ideas, SOPs, research and video links in one place.', promptsSub:'A visual, editable and reusable Prompt Library.',
      skillsSub:'Store long-term AI roles, work modes and collaboration instructions.', bookmarksSub:'Save URLs together with why they mattered.', calendarSub:'Manage daily schedules and the full work month.', commSub:'Track email, Teams, texts and follow-up status.',
      all:'All', addNote:'Add Note', addPrompt:'Add Prompt', addSkill:'Add Skill', addBookmark:'Add Bookmark', addTask:'Add Task', addEvent:'Add Event', logMessage:'Log Message',
      overdue:'Overdue', dueToday:'Due today', schedule:"Today's events", followup:'Follow-up', recent:'Recently updated', searchResults:'Search results'
    }
  };

  // System-owned labels only. User titles, notes, categories and other saved text never pass through this map.
  I18N.en.ui = {
    '首頁':'Home','筆記':'Notes','書籤':'Bookmarks','影音牆':'Video Wall','旅遊規劃':'Travel Planning','系統健康':'System Health','設定 · 分類管理':'Settings · Categories',
    '分類管理':'Category Management','關聯圖譜':'Relation Graph','家中物品管理':'Home Inventory','信用卡管理':'Credit Cards','待辦與提醒':'Tasks & Reminders','專案':'Projects','行程':'Calendar','訊息紀錄':'Message Log','自動化':'Automations',
    '快速篩選標籤':'Quick Filters','點選標籤查看相關內容':'Select a tag to view related content','所有內容概況':'Workspace at a glance','點選卡片直接進入模組':'Open any module directly',
    '新增影片':'Add Video','新增信用卡':'Add Credit Card','編輯信用卡':'Edit Credit Card','信用卡名稱':'Card Name','後四碼':'Last Four Digits','信用卡額度':'Credit Limit','結帳日':'Closing Date','繳款日':'Due Date','帳單金額':'Statement Balance','福利重點':'Benefits','備註':'Notes','每月幾日':'Day of month',
    '新增':'Add','新增清單':'Add Checklist','新增一列':'Add Row','新增一項':'Add Item','新增分類':'Add Category','新增旅遊行程':'Add Travel Event','建立旅程':'Create Trip','編輯旅程':'Edit Trip','編輯每日規劃':'Edit Daily Plan',
    '新增設備':'Add Item','匯出 Excel':'Export Excel','匯入 Excel':'Import Excel','資產概覽':'Asset Overview','取消':'Cancel','儲存':'Save','編輯':'Edit','刪除':'Delete','返回':'Back','關閉':'Close','重新開始':'Start Over','立即測試':'Run Test',
    '名稱':'Name','類別':'Category','連結':'Link','操作':'Actions','分類':'Category','標題':'Title','簡介':'Description','內容':'Content','標籤':'Tags','收藏':'Favorite','類型':'Type','狀態':'Status','到期日':'Due Date','到期設定':'Due Setting','設定到期日':'Set Due Date','無到期日':'No Due Date','優先順序':'Priority','範圍':'Scope','提醒時間（選填）':'Reminder Time (optional)','開始':'Start','結束':'End','對象':'Contact','日期時間':'Date & Time','管道':'Channel','方向':'Direction',
    '待處理':'To Do','提醒':'Reminder','進行中':'In Progress','完成':'Done','已取消':'Cancelled','需追蹤':'Follow-up','等待回覆':'Waiting','已封存':'Archived','高':'High','中':'Medium','低':'Low','工作':'Work','生活':'Life','個人':'Personal','收到':'Received','已回覆 / 寄出':'Sent / Replied','未分類':'Uncategorized',
    '快速新增':'Quick Capture','新增到 OPEN OS':'Add to OPEN OS','編輯資料':'Edit Item','新增分類名稱':'New Category Name','類型 / Type':'Type','分類 / Category':'Category','標題 / Title':'Title','簡介 / Description':'Description','內容 / Content':'Content','標籤 / Tags':'Tags','★ 收藏 / Favorite':'★ Favorite','影片連結 / Video URL':'Video URL','風格參考圖片 / Style Images':'Style Images','新增圖片網址（每行一張）':'Image URLs (one per line)','從電腦加入原圖':'Upload Original Images','自訂封面 URL（選填）':'Custom Cover URL (optional)','時間碼筆記可直接寫在「內容」中，例如：':'Write timestamp notes in Content, for example:','留空則自動使用 YouTube 封面':'Leave blank to use the YouTube cover','影片網址':'Video URL',
    '記錄訊息':'Log Message','訊息 / Message':'Message','狀態':'Status','無到期日':'No Due Date','無期限':'No Deadline','提醒時間':'Reminder Time','主旨 / 內容':'Subject / Content','全部':'All','工作整月排程':'Monthly Work Schedule',
    '固定工作的操作清單，無日期、無期限。完成後保留，下一輪可清除勾選重新使用。':'Recurring checklists without dates or deadlines. Keep completed items and reset for the next round.','建立第一份固定工作清單，每份最多 50 項。':'Create a recurring checklist with up to 50 items.','清單名稱':'Checklist Name','勾選項目':'Checklist Items','固定工作事項':'Recurring task','勾選清單':'Checklist','填寫待完成項目':'Enter an item to complete',
    '一趟旅程，多天安排。把時間、交通、餐廳與住宿放在一起。':'Plan time, transit, food and lodging across a trip.','旅程名稱':'Trip Name','旅遊類型':'Trip Type','國內旅遊':'Domestic Travel','出國旅遊':'International Travel','尚未設定':'Not Set','目的地':'Destination','出發日期':'Departure Date','返回日期':'Return Date','預算':'Budget','幣別':'Currency','旅程備註':'Trip Notes','每日規劃':'Daily Plan','完成旅遊':'Complete Trip','重新開啟旅遊':'Reopen Trip','早餐':'Breakfast','午餐':'Lunch','晚餐':'Dinner','宵夜或其他':'Late Night / Other','既有餐廳資料':'Previous Restaurant Notes','餐廳規劃':'Restaurants','交通工具':'Transport','住宿':'Lodging','備註／預訂資訊':'Notes / Reservations','當日花費':'Daily Cost','已完成':'Completed','累計花費':'Total Spent','所有旅程':'All Trips','開啟每日規劃':'Open Daily Plan','尚未安排':'Not Planned','未定時間':'Time TBD','既有旅遊行程':'Existing Travel Events','原有行事曆資料仍保留；新旅程使用上方每日規劃。':'Existing calendar events remain available; new trips use the daily planner.','尚未建立旅程。按「建立旅程」開始規劃。':'No trips yet. Select Create Trip to get started.','出發準備清單（最多 50 項）':'Travel Checklist (up to 50 items)','勾選清單':'Checklist','旅程購買清單':'Trip Shopping List','每日購買清單':'Daily Shopping List','新增項目':'Add Item','編輯項目':'Edit Item','勾選清單最多 50 項':'Checklist supports up to 50 items','編輯購買項目':'Edit Shopping Item','新增購買項目':'Add Shopping Item','項目名稱':'Item Name','項目':'Item','已購買':'Purchased','標記為未購買':'Mark as not purchased','標記為已購買':'Mark as purchased','尚無購買項目':'No shopping items yet',
    '每日自動化':'Daily Automations','依裝置當地時間執行。頁面需保持開啟；若稍晚開啟，當天會補跑一次。':'Runs at local device time while this page is open. A missed run starts when you return later that day.','每日早報':'Morning Brief','午後追蹤提醒':'Afternoon Follow-up','收工檢查':'End-of-day Review','整理今日到期、逾期與待回覆訊息。':'Summarize due tasks, overdue work and pending messages.','列出尚未完成的待回覆訊息。':'List messages awaiting a reply.','確認尚未完成的待辦，安排明日工作。':'Review open tasks and plan tomorrow.','啟用':'Enable','觸發':'Trigger','每日':'Daily','執行動作':'Action','已啟用':'Enabled','已暫停':'Paused','最近執行':'Last Run','尚無執行紀錄':'No Runs Yet','執行紀錄':'Run History','後續可加入的固定項目':'Potential Future Routines','既有工作流程構想':'Existing Workflow Ideas','以下為舊版保存的規劃，尚未接上背景執行服務。':'Saved workflow ideas from the previous version; background execution is not connected.',
    '時間碼 / Notes':'Timestamps / Notes','時間碼':'Timestamps','則筆記':'notes','開啟影片':'Open Video','影音已刪除':'Video Deleted','影片收藏、封面、時間碼筆記與相關知識集中在同一個觀看介面。':'Keep video links, covers, timestamps and related notes together.',
    '修改名稱、圖示與顏色；重新命名會同步更新使用此分類的內容。':'Edit names, icons and colors. Renaming updates connected items.','新增分類':'Add Category','選擇圖示':'Choose Icon','選擇配色':'Choose Color','分類名稱':'Category Name','分類預覽':'Category Preview','建立分類':'Create Category','編輯分類':'Edit Category','儲存修改':'Save Changes',
    '雲端同步':'Cloud Sync','登入狀態':'Sign-in Status','天氣':'Weather','內容數量':'Content Count','已登入':'Signed In','未登入':'Signed Out','已取得':'Available','尚未取得':'Unavailable','系統健康':'System Health','顯示目前連線與同步結果。尚未提供伺服器監控或排程執行報告。':'Shows current connection and sync results. Server monitoring and scheduled reports are not available yet.',
    '正在載入你的工作空間…':'Loading your workspace…','登入 OPEN OS':'Sign in to OPEN OS','使用你的帳號開啟家裡、公司與行動裝置共用的資料。':'Sign in to access your synced workspace across devices.','密碼':'Password','登入':'Sign In','登出':'Sign Out','資料儲存在這個瀏覽器':'Data is stored in this browser','帳號由 本機展示版管理。':'Accounts are managed by the local demo.',
    '正在載入物品資料…':'Loading inventory…','輸入城市名稱':'Enter city name','已收藏':'Favorited','移除收藏':'Remove Favorite','加入收藏':'Add Favorite','未完成待辦':'Open Tasks','今日行程':'Today’s Schedule','最近更新':'Recently Updated'
  };
  Object.assign(I18N.en.ui,{
    '上午':'Morning','下午／傍晚':'Afternoon / Evening','今日主要行程':'Top Priority Today','例如：與朋友見面、重要預約':'For example: meeting a friend or an important appointment',
    '查看專案':'View Project','尚無紀錄':'No Logs Yet','暫停':'Paused','目前尚未建立標籤':'No tags yet','訊息':'Message','全部管道':'All Channels','登入中…':'Signing in…',
    '晴朗':'Clear','多雲':'Cloudy','霧':'Fog','下雨':'Rain','下雪':'Snow','陣雨':'Showers','雷雨':'Thunderstorms',
    '此瀏覽器不支援通知':'Notifications are unavailable in this browser','瀏覽器通知已開啟':'Browser notifications enabled','未授權通知，頁面內提醒仍可使用':'Notifications were not allowed; in-page reminders remain available',
    '尚未取得同步結果':'No sync result yet','不包含家中物品與信用卡':'Excludes Home Inventory and Credit Cards','同步需要處理':'Sync Needs Attention','最近同步成功':'Recently Synced','同步狀態待確認':'Sync Pending',
    '編輯 Routine checklist':'Edit Routine Checklist','新增 Routine checklist':'New Routine Checklist','請填寫清單名稱':'Enter a checklist name','請至少填寫一項工作':'Add at least one item','完成進度':'Completion Progress',
    '早上':'Morning','中午':'Midday','下午':'Afternoon','晚上':'Evening','每日行程':'Daily Itinerary','旅程日期':'Trip Dates','交通方式':'Transportation Mode','飛機':'Flight','自駕旅程':'Road Trip','開車路程與停靠':'Driving & Stops','開車路段':'Driving Segment','途中停靠':'Route Stops','新增開車路段':'Add Driving Segment','編輯開車路段':'Edit Driving Segment','新增中途停靠':'Add Route Stop','編輯中途停靠':'Edit Route Stop','起點':'From','目的地':'To','出發時間':'Departure Time','預計抵達時間':'Estimated Arrival','行駛距離':'Driving Distance','預估車程':'Estimated Drive Time','行駛路線':'Route / Highway','停靠名稱':'Stop Name','地點':'Location','停靠類型':'Stop Type','停留時間':'Duration','整日路線':'General route','上移路段':'Move segment up','下移路段':'Move segment down','上移停靠':'Move stop up','下移停靠':'Move stop down','加油':'Gas','用餐':'Meal','休息':'Rest','景點':'Attraction','觀景':'Scenic stop','購物':'Shopping','過夜':'Overnight','其他':'Other','尚未新增開車路段。':'No driving segments added yet.','請填寫起點與目的地':'Enter a starting point and destination','請填寫停靠名稱':'Enter a stop name','ROAD TRIP':'ROAD TRIP',
    '國內':'Domestic','出國':'International','旅程':'Trip','天':'days','加入兩筆內容之間的連結。':'Connect two items in this graph.','AI 與自動化':'AI & Automations','目前是規則型 Prototype：展示未來可由 Calendar、Email、AI 與資料庫觸發的工作流程。':'A rules prototype showing how calendars, email, AI and the database may trigger workflows.',
    '請輸入分類名稱':'Enter a category name','分類已新增':'Category added','儲存修改':'Save Changes','尚未建立關係':'No relationships yet',
    '類型 / Type':'Type','風格參考圖片 / Style Images':'Style Images','為什麼收藏 / Why I Saved It':'Why I Saved It','訊息內容 / Notes':'Message Content / Notes','備註 / Notes':'Notes','Prompt 指令 / Prompt':'Prompt',
    '不限制圖片比例。原始寬高、格式與檔案大小會記錄；超大原圖可能超過瀏覽器本機儲存容量。':'No aspect ratio limit. Original dimensions, format and size are recorded; very large originals may exceed browser storage capacity.',
    '可建立沒有截止日期、但只需要記住或提醒自己的事項。':'Create tasks without a deadline for items you only need to remember or review.',
    '填寫待完成項目':'Enter a checklist item','收工檢查':'End-of-day Review','列出尚未完成的待回覆訊息。':'List messages awaiting replies.',
    '準備項目':'Preparation Item','行程項目':'Itinerary Item','航段類型':'Flight Leg Type','航空公司':'Airline','航班號碼':'Flight Number','出發機場／代碼':'Departure Airport / Code','抵達機場／代碼':'Arrival Airport / Code','起飛：出發地當地日期與時間':'Departure Local Date & Time','抵達：目的地當地日期與時間':'Arrival Local Date & Time','出發航廈／報到區':'Departure Terminal / Check-in','抵達航廈':'Arrival Terminal','登機門':'Gate','座位':'Seat','艙等（商務／豪華經濟／經濟等）':'Cabin Class','訂位參考（選填）':'Booking Reference (optional)',
    '依機場與日期自動判斷時差':'Use airport/date to calculate time zones','進階：手動時差（其他機場／舊資料）':'Advanced: Manual Time Zones','出發 UTC 時差':'Departure UTC Offset','抵達 UTC 時差':'Arrival UTC Offset',
    '行李：件數、費用、寄放／領取／重新托運':'Baggage: pieces, fees and transfer','地面時間表：報到、安檢、海關、交通動線（每行一項）':'Ground Timeline: check-in, security, customs and transit','貴賓室／資格確認／位置':'Lounge / Eligibility / Location','參考網址':'Reference URL','其他注意事項／待確認資訊':'Other Notes / To Verify',
    '去程':'Outbound','回程':'Return','途中航班／轉機':'Connection / Transfer','去程與回程':'Outbound & Return','第一天 · 去程':'Day One · Outbound','最後一天 · 回程':'Final Day · Return','去程航段':'Outbound Leg','回程航段':'Return Leg','途中航班':'Connection','尚未加入航班。搭車或其他交通可直接填每日規劃。':'No flights yet. Add ground travel to the daily plan.','每一班飛機新增一個航段；去程全部顯示在第一天、回程全部顯示在最後一天。所有時刻為各機場當地時間。':'Add one leg per flight. Outbound flights appear on the first day and returns on the last. Times are local to each airport.',
    '行李／重新托運':'Baggage / Recheck','地面時間表／轉機動線':'Ground Timeline / Transfer','貴賓室':'Lounge','訂位參考':'Booking Reference','開啟參考資料':'Open Reference','查看參考資料':'View Reference','航廈待確認':'Terminal TBD','艙等未填':'Cabin Not Set',
    '每日雲端備份：需要伺服器排程與備份儲存空間。':'Daily cloud backup requires a server schedule and backup storage.',
    '信用卡到期提醒：需要將各卡日期統一為可排程欄位。':'Credit card due reminders require normalized schedule dates.',
    '出發前旅遊提醒：可依出發日期整理未完成準備清單。':'Pre-trip reminders can summarize unfinished preparations by departure date.',
    'Email 自動擷取與整理：需要另外串接信箱並授權。':'Automatic email capture requires a connected and authorized mailbox.',
    '尚無自動執行紀錄；手動測試不會消耗每日執行次數。':'No automatic runs yet. Manual tests do not use a daily run.',
    '登入 OPEN OS':'Sign in to OPEN OS','目前沒有資料':'No data yet','開啟瀏覽器通知':'Enable Browser Notifications','顯示更多':'Show More','筆':'items'
  });
  Object.assign(I18N.en.ui,{
    '清除這份清單的所有勾選，開始下一輪？':'Clear the checks and start another round?',
    '確定刪除這份 Routine checklist？':'Delete this Routine Checklist?',
    '有尚未儲存的修改。確定放棄修改並關閉？':'Discard unsaved changes and close?',
    '請填寫旅程名稱、有效日期（最多 60 天）及非負預算。':'Enter a trip name, valid dates (up to 60 days) and a non-negative budget.',
    '日期範圍包含已有途中航班，請先調整航班顯示日期。':'Adjust existing connecting flights before changing the trip dates.',
    '縮短日期會移除已有規劃的日子，請先清空那些日子的內容或保留日期範圍。':'Clear the planned days before shortening the trip, or keep the current date range.',
    '編輯航段':'Edit Flight Leg','新增航段':'Add Flight Leg',
    '航段時間重疊，請確認':'Flight times overlap; please check','僅為時刻差，不代表已確認可銜接。':'Time difference only; the connection is not confirmed.'
  });
  Object.assign(I18N.en.ui,{
    '時間待確認':'Time TBD','此機場尚未在清單中，請使用進階手動時差。':'Airport not listed. Use advanced manual time zones.',
    '這個當地時間無效或位於夏令時間切換的重複時段，請確認時間或使用手動時差。':'Invalid or ambiguous local time at a daylight saving change. Check the time or use manual time zones.',
    '請選擇航段類型。':'Select a flight leg type.','請填寫出發與抵達機場。':'Enter departure and arrival airports.','途中航班請選擇旅程內的日期。':'Select a trip date for the connecting flight.',
    '請確認起降日期、時間與 UTC 時差；抵達時刻必須晚於起飛時刻。':'Check flight dates, times and UTC offsets. Arrival must be after departure.','參考連結請使用 http 或 https 網址。':'Use an http or https reference URL.','確定刪除此航段？':'Delete this flight leg?',
    '依機票填寫各機場的當地日期與時間。選擇機場後，系統依日期自動處理時差與夏令時間，無須換算。':'Use local dates and times from your ticket. Airport/date selection handles time zones and daylight saving automatically.',
    '途中航班顯示日期（去／回程自動放首／末日）':'Connection Display Date (outbound/return use first/last day)',
    '手動模式：使用下方 UTC 時差，舊版航班資料保持原設定。':'Manual mode uses the UTC offsets below. Existing flight settings remain unchanged.',
    '示範海岸城':'Sample Coast City','舊金山':'San Francisco','洛杉磯':'Los Angeles','西雅圖':'Seattle','桃園／台北':'Taoyuan / Taipei','台北松山':'Taipei Songshan','高雄':'Kaohsiung','紐約':'New York','紐華克':'Newark','芝加哥':'Chicago','達拉斯':'Dallas','東京成田':'Tokyo Narita','東京羽田':'Tokyo Haneda','首爾仁川':'Seoul Incheon','香港':'Hong Kong','新加坡':'Singapore','倫敦':'London','巴黎':'Paris'
  });
  Object.assign(I18N.en.ui,{
    '筆記 Note':'Note','影片 Video':'Video','書籤 Bookmark':'Bookmark','待辦 Task':'Task','行程 Event':'Event','Email / 訊息紀錄':'Email / Message Log',
    '匯入 v0.5 資料':'Import v0.5 Data','。詳細觀看頁會自動辨識時間碼。':'. The video viewer detects timestamps automatically.','00:16 觀察卡片排版':'00:16 Review the card layout',
    '紀錄點':'log entries','最後更新':'Last Updated','新增專案':'New Project','開啟專案':'Open Project','專案名稱':'Project Name','說明':'Description',
    '紀錄日期':'Log Date','紀錄標題':'Log Title','摘要':'Summary','決策、問題與備註':'Decisions, Issues & Notes','下一步':'Next Steps',
    '到期或逾期':'Due or Overdue','時間碼筆記':'Timestamp Notes','開啟影片連結':'Open Video Link',
    '開啟完整行程':'Open Full Calendar','顯示更多':'Show More','相關於':'Related To','影片 URL':'Video URL'
  });
  Object.assign(I18N.en.ui,{
    '尚未設定 本機展示版 Publishable Key。':'本機展示版 publishable key is not configured.',
    '無法連接 本機展示版，請稍後再試。':'Could not connect to 本機展示版. Try again shortly.',
    'Email 或密碼不正確。':'Incorrect email or password.','請先完成 Email 驗證。':'Confirm your email before signing in.','登入失敗，請檢查帳號或稍後重試。':'Sign-in failed. Check your account or try again later.',
    '要把這台瀏覽器內的 v0.5 資料匯入 本機展示版 嗎？雲端現有內容將以這份資料為主。':'Import v0.5 browser data to 本機展示版? This copy will replace the current cloud contents.',
    'v0.5 資料已匯入雲端':'v0.5 data imported to cloud','匯入失敗，請確認雲端連線後重試。':'Import failed. Check the cloud connection and retry.',
    '圖片讀取失敗':'Could not read the image','分類已新增':'Category added','登出前同步失敗：':'Sync failed before sign-out: ','行事曆匯入失敗：':'Calendar import failed: ',
    '編輯時請保留原本類型。':'Keep the original item type when editing.','請設定有效的開始與結束時間，結束不可早於開始。':'Choose valid start and end times. End must not be before start.','請設定有效的訊息時間。':'Choose a valid message time.',
    '圖片無法上傳私人儲存空間；請檢查連線或改用檔案上傳。原資料尚未儲存。':'Image upload to private storage failed. Check the connection or upload a file. Your item has not been saved.',
    '未分類':'Uncategorized','尚未設定有效連結':'No valid link set','目前沒有書籤':'No bookmarks yet'
  });
  Object.assign(I18N.en.ui,{
    '起飛':'Departure','抵達':'Arrival','當地時間':'local time','當地日期的時差':'UTC offset for local date','飛行':'Flight','轉機間隔':'Connection time','此日新增途中航班／轉機':'Add a connecting flight for this day',
    '手動模式：使用下方 UTC 時差，舊版航班資料保持原設定。':'Manual UTC offsets are used; existing flight settings stay intact.',
    '行事曆匯入失敗：':'Calendar import failed: ','請先完成資料載入。':'Wait for the data to load.'
  });
  Object.assign(I18N.en.ui,{
    '關閉側邊欄':'Close sidebar','開啟側邊欄':'Open sidebar','切換主題':'Toggle theme','切換語言':'Switch language','帳號':'Account',
    '關閉 Prompt 詳細內容':'Close Prompt detail','關閉圖片檢視器':'Close image viewer','關閉影音詳細內容':'Close video detail'
  });
  Object.assign(I18N.en.ui,{
    'B 粗體':'B Bold','I 斜體':'I Italic','刪除線':'Strikethrough','小標題':'Heading','• 清單':'• List','引用':'Quote','表格':'Table',
    '＋列':'Add Row','−列':'Remove Row','＋欄':'Add Column','−欄':'Remove Column','預覽格式':'Preview','收起預覽':'Hide Preview','文字格式':'Text Formatting'
  });
  Object.assign(I18N.en.ui,{
    '100 個常用圖示 · ✓ 表示已使用':'100 common icons · ✓ shows in use','✓ 表示已使用':'✓ shows in use',
    '分類名稱':'Category Name','例如：工作、旅行、靈感':'e.g. Work, Travel, Inspiration',
    '資料儲存在這個瀏覽器':'Data is stored in this browser'
  });
  Object.assign(I18N.en.ui,{
    '匯入 Apple 行事曆':'Import Apple Calendar','尚未排定日期':'Unscheduled','上個月':'Previous month','回到本月':'Current month','下個月':'Next month',
    '世界時間':'World Clocks','清晨':'Early Morning','上午':'Morning','晚間':'Evening','凌晨':'Late Night',
    '全系統摘要':'System Overview','紀錄總數':'Total Logs','新增今日紀錄':'Add Today’s Log',
    '每個圖譜都是獨立的關係集合，可依專案或主題分開管理。':'Each graph is an independent set of relationships you can organize by project or topic.',
    '以旅遊分類整理行程；備註可記錄住宿、交通與景點。':'Organize travel events by category; use notes for lodging, transit and places.',
    '工作交辦、生活細節與提醒時間集中整理。到期提醒會在頁面內顯示。':'Keep work, personal tasks and reminders together. Due reminders appear in the app.'
  });
  Object.assign(I18N.en.ui,{
    '已登入，但工作區載入失敗。':'Signed in, but the workspace could not load.',
    '請檢查網路連線後重試；你的登入狀態仍已保留。':'Check your connection and retry. Your sign-in is still active.',
    '無法確認登入狀態，請重新登入。':'Unable to restore the sign-in state. Please sign in again.',
    '網路連線失敗，請檢查連線後再試。':'Network connection failed. Check your connection and try again.',
    '登出失敗，請稍後再試。':'Sign-out failed. Please try again.'
  });
  const originalUILabels = new WeakMap();
  const ui = value => lang()==='en' ? (I18N.en.ui[value] || value) : value;
  function localizeUI(root=document) {
    const selector='.primary-btn,.secondary-btn,.text-btn,.icon-btn,.mini-btn,.control-btn,.filter-chip,.nav-item,label,label>span,legend,option,summary,th,dt,#authTitle,.page-title,.page-subtitle,.section-head h2,.section-head h3,.modal h2,.category-picker h3,.category-picker h3 small,.nav-label,.field-caption,.field-label,.field-hint,.info-note,.info-note strong,.empty-state,.rule-state,.rule-last,.rule-trigger,.rule-action>span,.rule-action>p,.travel-metrics .panel,.travel-back,.travel-details dt,.period-preview h3,.flight-hint,.flight-card small,.flight-meta,.home-tags .overview-heading>span,.home-tags h2,.auth-gate p,.auth-gate small,.account-menu>span,.project-summary span,.entry-block h4,.video-timeline h2,.video-timeline .section-head>span,.bookmark-table th,.comm-table th,.health-overview,.health-card small,.preview-checklist h3,.routine-actions button,.rich-toolbar,.rich-toolbar button';
    const candidates=[...(root.nodeType===1&&root.matches?.(selector)?[root]:[]),...(root.querySelectorAll?.(selector)||[])];
    for (const el of candidates) {
      if(el.closest('[data-sidebar-label],.sidebar-label-editor,.checklist-view,.trip-task,.project-card,.item-card,.detail-content,.project-description,.entry-prose,.rich-preview,.rich-table-scroll,.card-body,.routine-panel h2,.user-content,[data-home-tag],[data-channel-filter],[data-filter]:not([data-filter="All"]),[data-category-filter]:not([data-category-filter="All"]),#captureCategory option,#projectCategory option,#relationFrom option,#relationTo option'))continue;
      for(const node of el.childNodes)if(node.nodeType===Node.TEXT_NODE){
        const raw=originalUILabels.get(node) ?? node.nodeValue;
        if(!originalUILabels.has(node))originalUILabels.set(node,raw);
        const parts=raw.match(/^(\s*[＋✎↺✈◷☑◉♨⌂↗▷＄◈]?[\s]*)?(.*?)(\s*)$/s);
        if(!parts)continue;
        const translated=I18N.en.ui[parts[2]] || I18N.en.ui[raw.trim()];
        if(translated)node.nodeValue=lang()==='en'?(parts[1]||'')+translated+(parts[3]||''):raw;
      }
      for(const attr of ['placeholder','aria-label','title']){
        if(!el.hasAttribute(attr))continue;
        const key='data-ui-original-'+attr;
        if(!el.hasAttribute(key))el.setAttribute(key,el.getAttribute(attr));
        const original=el.getAttribute(key);
        el.setAttribute(attr,ui(original));
      }
    }
    for(const el of root.querySelectorAll?.('input[placeholder],textarea[placeholder],button[aria-label],a[aria-label],iframe[title]')||[]){
      if(el.closest('.user-content'))continue;
      for(const attr of ['placeholder','aria-label','title']){
        if(!el.hasAttribute(attr))continue;
        const key='data-ui-original-'+attr;if(!el.hasAttribute(key))el.setAttribute(key,el.getAttribute(attr));
        el.setAttribute(attr,ui(el.getAttribute(key)));
      }
    }
  }
  function lang() { return 'zh'; }
  function t(key) { return I18N[lang()]?.[key] || I18N.zh[key] || key; }
  window.IAN_OS_APP_SHARED={safeStorageGet,safeStorageSet,I18N,ui,localizeUI,lang,t};
})();
