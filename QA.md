# OPEN OS Public Mirror QA

## 已完成

- 原版 `site/` 的頁面結構、模組與所有保留的 68 份 CSS 去除註解後比對，樣式宣告未改動；僅移除已停用 Gmail 整合樣式。
- JavaScript 與工具腳本 `node --check` 全數通過。
- `node tests/demo-integrity.cjs` 通過：虛構初始資料、本機工作區儲存、餐廳新增與刪除、家中物品新增與刪除、停用遠端服務、敏感網址與設定掃描。
- `node tools/stamp-assets.cjs` 連續執行兩次，第二次無檔案變更。
- Python 本機 HTTP 伺服器回傳首頁 200 OK。
- 伺服器包僅包含 `site/` 內容，沒有 SQL、Edge Function、正式設定、測試或工具。

## 尚未完成

- 瀏覽器視覺與互動測試：本環境 Chromium 啟動器缺少執行檔，隔離的雲端瀏覽器無法連到本機 HTTP 服務。需在一般桌機與手機瀏覽器實測。
- 本機資料的附件預覽、圖片、完整旅遊編輯與 PWA 安裝尚需人工確認。
- 正式 Supabase 資料與帳號沒有也不應用此公開包測試。

## 發布前人工檢查

1. 在獨立網址啟動公開版，確認首頁、側欄、搜尋、餐廳、記事本、待辦、旅遊、信用卡與家中物品頁面。
2. 新增一筆示範筆記，重新整理後確認仍在；清除網站資料後確認回到虛構初始資料。
3. 以 390px 寬度開啟手機導覽，確認沒有水平溢出。
4. 在瀏覽器 Network 面板確認沒有連線到 Supabase 或正式 IAN OS 網域。
5. 測試深色模式、鍵盤、離線頁與 PWA 安裝。

## GitHub 發布檢查

- 將 `COMPLETE.zip` 解壓後，直接把根目錄的檔案提交到公開倉庫，不要上傳正式 IAN OS 原始包或任何 `.env`。
- GitHub Pages 請把 `SERVER-DEPLOY.zip` 的內容放在倉庫根目錄或 `docs/`，再把 Pages 發布來源設為相同資料夾。COMPLETE 包中的網站原始檔位於 `site/`，GitHub Pages 的分支發布選項不能直接指定任意 `site/` 子目錄。Apache `.htaccess` 在 GitHub Pages 不會生效，若需要強制 HTTP CSP，請選擇支援自訂安全標頭的託管平台。
- 發布前以乾淨瀏覽器完成上述人工檢查。GitHub 公開倉庫與正式 IAN OS 應使用不同網域，避免瀏覽器資料或 Service Worker 的作用範圍混淆。
