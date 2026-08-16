# 「上班偷偷看股票」Chrome Web Store 上架必填資料

最後核對日期：2026-08-16  
擴充功能版本：1.2.0  
Manifest：V3

本文件依目前專案的實際程式、權限與資料流整理，可依 Chrome Web Store 後台順序填寫。標示「待填」的項目涉及開發者身分、公開網址或尚未製作的圖片，無法由程式內容安全推定。

## 0. 送審前尚待準備

- [ ] 開發者／發布者名稱
- [ ] 已驗證的聯絡信箱
- [ ] Trader／Non-Trader 身分聲明
- [ ] 公開 HTTPS 隱私權政策網址
- [ ] 至少一張 1280×800 或 640×400 的實際操作截圖
- [ ] 一張 440×280 的小型宣傳圖
- [ ] 確認 128×128 商店 ICON 的主圖四周是否有適當透明留白
- [ ] 在無開發工具、無本機快取的全新 Chrome 使用者資料中完成一次安裝測試

Chrome Web Store 官方目前要求至少提供商店 ICON、小型宣傳圖及一張操作截圖；截圖可使用 1280×800 或 640×400。[官方圖片規格](https://developer.chrome.com/docs/webstore/images)

## 1. 開發者帳戶

### Publisher name／發布者名稱（必填）

```text
[待填：個人、工作室或公司對外顯示名稱]
```

這個名稱會顯示在所有已發布擴充功能下方。

### Contact email／聯絡信箱（必填且必須驗證）

```text
[待填：可長期收信的客服／開發者信箱]
```

### Trader／Non-Trader（必填）

```text
[待由發布者依實際法律與商業身分選擇]
```

- 若以商業、公司、工作室或職業目的提供：通常應評估選擇 `Trader`。
- 若純粹以個人、非商業目的提供：通常應評估選擇 `Non-Trader`。
- Google 要求所有發布者聲明其中一種；本文件不代替法律判斷。
- 選擇 Trader 時，後台可能要求驗證並公開法定名稱、地址及聯絡電話。

官方帳戶欄位說明：[設定開發者帳戶](https://developer.chrome.com/docs/webstore/set-up-account/)、[Trader／Non-Trader 說明](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)

### Physical address／實體地址

目前擴充功能沒有付費、訂閱或應用程式內購買，因此一般帳戶設定不因付費功能而要求地址；但若發布者聲明為 Trader，仍可能因 Trader 驗證而被要求提供地址。

## 2. Package／套件

### 上傳檔案（必填）

```text
D:\Projects\StockTicker\build\StockTicker-1.2.0.zip
```

### 套件版本

```text
1.2.0
```

### SHA-256（自行核對用，不需貼到商店欄位）

```text
3DD5FB441F6B957229D5CD7DB09E0317F83F5BF35FE32286EAE26EF5FA8EC2FA
```

### Manifest 名稱（由套件讀取，不在後台修改）

```text
上班偷偷看股票
```

### Manifest 簡短說明（由套件讀取，不在後台修改）

```text
每 5 秒更新一次指定股票的即時報價。
```

Chrome Web Store 上傳後，名稱、版本、ICON 與簡短說明取自 `manifest.json`；若要修改，必須更新 Manifest、提高版本並重新打包。[官方準備套件說明](https://developer.chrome.com/docs/webstore/prepare)

## 3. Store listing／商店資訊

### Primary language／主要語言（必填）

```text
繁體中文（zh_TW）
```

目前介面只有繁體中文，不應勾選尚未實作的英文或日文語系。

### Primary category／主要分類（必填）

```text
Productivity／生產力工具
```

如果後台當下沒有「生產力工具」，可選最接近的 `Tools／工具`。不要選金融交易或購物類別，因為本擴充功能只顯示公開報價，不提供交易、帳戶或投資組合服務。

### Detailed description／詳細說明（必填，可直接貼上）

```text
「上班偷偷看股票」是一款精簡的股票報價追蹤工具，讓使用者從 Chrome 工具列快速查看自己加入的股票與 ETF。開啟彈出視窗後，報價會每 5 秒更新一次；關閉視窗後即停止輪詢，不會持續在背景查詢。

主要功能：

• 支援台灣上市、上櫃、美國及 Yahoo Finance 可識別的其他市場股票代號
• 支援以台股中文公司名稱或 ETF 中文名稱搜尋
• 搜尋結果優先顯示 .TW，其次為 .TWO
• 可同時追蹤多支股票，並以拖曳方式調整順序
• 可建立多個追蹤分頁，並設定最多 3 個中文字的分頁名稱
• 新增股票會放入目前分頁，股票卡可拖曳到其他分頁
• 顯示即時價格、漲跌金額、漲跌幅與最近 16 根一分鐘 K 線／成交量
• 依台灣市場慣例使用紅色表示上漲、綠色表示下跌
• 工具列 ICON 徽章顯示目前分頁第一支股票的最新價格
• 點擊股票卡可開啟 Yahoo 股市或玩股網詳細頁面
• 可使用瀏覽器帳號進行同瀏覽器跨裝置同步
• 支援 JSON 匯出與匯入，方便在 Chrome 與 Edge 之間搬移追蹤資料

資料來源與更新說明：

報價與搜尋使用 Yahoo Finance；台股公司及 ETF 中文名稱使用臺灣證券交易所（TWSE）與證券櫃檯買賣中心（TPEx）的公開資料。每 5 秒查詢一次不代表交易所資料一定每 5 秒變動，實際更新速度、延遲與可用性由資料提供者決定。

隱私摘要：

本擴充功能不包含廣告、分析追蹤或開發者營運的資料伺服器。追蹤清單與設定預設儲存在瀏覽器本機；只有使用者主動開啟同步時，才交由目前瀏覽器帳號的同步服務保存。為提供搜尋與報價，使用者輸入的搜尋文字或股票代號會透過 HTTPS 傳送至相應的公開資料服務。

重要聲明：

本工具僅供資訊查看，不提供下單、投資帳戶、持倉管理或投資建議。公開報價可能延遲、缺漏或暫時無法使用，請勿將其作為交易決策的唯一依據。
```

### Store icon／商店 ICON（必填）

```text
套件內：icon/128.png
尺寸：128×128 PNG
```

注意：官方圖示規格建議 128×128 圖檔中的主要圖形約為 96×96，四周各保留約 16px 透明區域。現有 ICON 尺寸正確，但送審前仍應肉眼確認透明留白。

### Screenshots／操作截圖（至少一張必填，最多五張）

建議準備 1280×800 PNG，畫面必須呈現真實最新版介面。

1. `01-多股即時報價.png`：顯示台積電與 ETF、價格、紅漲綠跌及 K 線。
2. `02-中文搜尋.png`：輸入「元大台灣50」，顯示 `.TW` 優先及中文 ETF 名稱。
3. `03-多分頁拖曳.png`：顯示多分頁、分頁名稱及拖曳移動股票。
4. `04-同步與匯出入.png`：展開設定面板，顯示同步、匯出及匯入按鈕。
5. `05-工具列股價.png`：顯示工具列 ICON 徽章上的第一支股票價格。

目前狀態：

```text
[待製作並上傳，至少一張]
```

### Small promo tile／小型宣傳圖（必填）

```text
尺寸：440×280 PNG 或 JPEG
建議主標：上班偷偷看股票
建議副標：工具列快速查看自選股
建議畫面：金色「股」ICON＋精簡報價卡，不放 Yahoo／TWSE／TPEx 官方標誌
目前狀態：[待製作]
```

### Marquee promo tile／大型宣傳圖（選填）

```text
尺寸：1400×560 PNG 或 JPEG
目前建議：先不填
```

### YouTube promotional video／宣傳影片（選填）

```text
目前建議：先不填
```

### Mature content／成人內容（必填選擇）

```text
否／No
```

### Homepage URL／首頁（選填）

```text
[選填：產品介紹或 GitHub 專案的公開 HTTPS 網址]
```

### Support URL／支援網址（選填但建議）

```text
[選填：公開問題回報、使用說明或客服頁面 HTTPS 網址]
```

## 4. Privacy practices／隱私權實務

### Single purpose description／單一用途（必填，可直接貼上）

```text
本擴充功能的單一用途，是讓使用者在 Chrome 工具列彈出視窗中建立自選股票清單，並快速查看所選股票與 ETF 的公開報價、漲跌及短期 K 線資訊。
```

### storage 權限用途（必填，可直接貼上）

```text
storage 權限用於在瀏覽器本機保存使用者主動建立的股票追蹤清單、股票順序、分頁、分頁名稱、目前分頁、股票網站偏好、同步開關與可重新下載的台股中文名稱快取。只有使用者主動開啟跨裝置同步時，追蹤清單及相關偏好才會寫入 chrome.storage.sync，由目前瀏覽器帳號的同步服務保存。本擴充功能沒有開發者營運的資料伺服器。
```

### Host permission：query1.finance.yahoo.com（必填，可直接貼上）

```text
用於向 Yahoo Finance 取得使用者已加入股票的公開報價、前收資訊及一分鐘 K 線／成交量資料，並在新增股票前驗證代號是否有效。請求只在使用者開啟擴充功能彈出視窗或主動更新時發生。
```

### Host permission：query2.finance.yahoo.com（必填，可直接貼上）

```text
用於依使用者輸入的股票代號或名稱搜尋 Yahoo Finance 可識別的股票與 ETF。使用者輸入的搜尋文字會透過 HTTPS 傳送至 Yahoo Finance，僅用於回傳搜尋候選項。
```

### Host permission：openapi.twse.com.tw（必填，可直接貼上）

```text
用於下載臺灣證券交易所公開提供的上市公司及 ETF 基本資料，以將台股代號與繁體中文公司／基金名稱配對。資料只作為搜尋與顯示名稱使用，並在本機快取最多 24 小時。
```

### Host permission：www.tpex.org.tw（必填，可直接貼上）

```text
用於下載證券櫃檯買賣中心公開提供的上櫃公司及 ETF 資料，以將上櫃代號與繁體中文公司／基金名稱配對。資料只作為搜尋與顯示名稱使用，並在本機快取最多 24 小時。
```

### Remote code／遠端程式碼（必填選擇）

```text
No, I am not using remote code.／否，我沒有使用遠端程式碼。
```

若後台提供說明欄，可填：

```text
所有 JavaScript、HTML、CSS 與功能模組均包含在上傳套件內。擴充功能只透過 fetch 讀取遠端 JSON 市場資料，不下載、載入或執行遠端 JavaScript、WebAssembly 或其他可執行程式碼。
```

Manifest V3 不允許執行未包含在套件內的遠端程式碼；讀取 JSON 資料不等於執行遠端程式碼。[官方隱私欄位說明](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

### Data usage／資料使用類型（必填）

依目前程式的保守申報建議：

- [ ] 個人識別資訊：不勾選
- [ ] 健康資訊：不勾選
- [ ] 財務和付款資訊：不勾選
- [ ] 驗證資訊：不勾選
- [ ] 個人通訊資料：不勾選
- [ ] 位置資訊：不勾選
- [ ] 網頁記錄／瀏覽紀錄：不勾選
- [x] 使用者活動：勾選
- [ ] 網站內容：不勾選

「使用者活動」採保守申報，涵蓋使用者在擴充功能內輸入的搜尋文字、選擇的股票代號、追蹤清單操作與偏好。這些資料只用於使用者主動要求的搜尋、報價、清單保存與同步，不做分析、廣告或使用者輪廓。

「財務和付款資訊」目前不勾選，因為擴充功能不讀取或保存使用者的持股數量、成本、損益、券商帳戶、交易、銀行、信用卡或付款資料；它只保存公開股票代號組成的自選清單。若未來加入持倉、成本、損益或交易功能，必須重新評估並更新此欄。

### 資料用途補充說明（若後台出現文字欄，可直接貼上）

```text
使用者輸入的股票搜尋文字或股票代號只會為了提供搜尋、代號驗證與報價功能，透過 HTTPS 傳送至 Yahoo Finance。上市與上櫃中文名稱名單由 TWSE／TPEx 公開 API 下載，不包含使用者帳戶資料。追蹤清單、分頁與偏好預設保存在瀏覽器本機；只有使用者主動開啟同步時才由瀏覽器帳號同步服務保存。開發者不接收、保存或查看這些資料，也未使用分析、廣告或追蹤服務。
```

### Limited Use certifications／有限使用聲明（必填）

在目前程式行為不變的前提下，後台顯示的 Limited Use 聲明全部勾選，包括：

- [x] 不會在核准用途之外出售或轉移使用者資料。
- [x] 不會將使用者資料用於與擴充功能單一用途無關的目的。
- [x] 不會將使用者資料用於信用評分或貸款用途。

### Privacy policy URL／隱私權政策網址（必填）

```text
[待填：https://你的公開網站/stockticker/privacy]
```

要求：

- 必須是未登入也能開啟的公開 HTTPS 頁面。
- 頁面內容應與下方「隱私權政策全文」一致。
- 後台勾選項目、實際程式行為與隱私政策不可互相矛盾。
- 若日後新增分析、廣告、帳戶、持倉或其他資料處理，必須同步更新程式、商店申報及隱私政策。

Google 要求每個項目完成資料使用揭露與 Limited Use 認證；涉及使用者資料時應提供隱私權政策。[官方 User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

## 5. Distribution／發布範圍

### In-app purchases／應用程式內購買（必填選擇）

```text
No／否
```

目前沒有付費下載、訂閱、捐款解鎖或額外付費功能。

### Visibility／可見度（必填選擇）

正式公開版本建議：

```text
Public／公開
```

如果希望先由少數人測試，可先選 `Private` 或 `Unlisted`；三種可見度都必須經過相同政策審查。[官方發布範圍說明](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)

### Geographic distribution／地區（必填選擇）

首版建議：

```text
Taiwan／台灣
```

理由：介面目前只有繁體中文，且中文名稱、網站偏好與紅漲綠跌設計以台灣市場為主。若希望海外繁體中文使用者也能安裝，可改為 `All regions`，但商店說明仍應清楚標示介面語言及台股導向。

### Deferred publishing／審核通過後是否立即發布

建議首版：

```text
延後發布／審核通過後由開發者手動發布
```

此項不是內容欄位；延後發布可讓你在審核通過後再確認商店頁面與公開政策網址。

## 6. Test instructions／審核測試說明（目前非必填，但建議填寫）

Chrome 官方說明 Test instructions 不是發布必填項目；本擴充功能不需要帳號、付費或測試憑證。[官方測試說明](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)

### Login required／是否需要登入

```text
No／否
```

### 測試步驟（可直接貼上）

```text
本擴充功能不需要帳號、API 金鑰或付費服務。

1. 安裝後將「上班偷偷看股票」釘選到 Chrome 工具列。
2. 點擊工具列 ICON 開啟彈出視窗。
3. 在搜尋框輸入 2330，按右側「+」。擴充功能應加入 2330.TW，並顯示「台積電」。
4. 輸入 0050 或「元大台灣50」，確認搜尋結果優先顯示 .TW 且使用中文 ETF 名稱。
5. 等待約 5 秒，確認價格、漲跌與 K 線更新；工具列 ICON 徽章應顯示目前分頁第一支股票價格。
6. 使用分頁列右側「+」新增追蹤分頁，並將股票卡拖到另一分頁。
7. 展開設定，可切換 Yahoo 股市／玩股網、設定最多 3 字的分頁名稱、匯出或匯入 JSON。
8. 跨裝置同步是選用功能；開啟後使用 chrome.storage.sync，不需要開發者帳號。

報價及搜尋依賴 Yahoo Finance、TWSE 與 TPEx 公開服務；若任一服務暫時限流，稍後重試即可。
```

## 7. 審核備註（選填但建議）

```text
本擴充功能是 Manifest V3 工具列股票報價追蹤器。所有 JavaScript、HTML 與 CSS 均包含在上傳套件內，不使用遠端程式碼、分析、廣告或開發者後端。

storage 權限只用於保存使用者的追蹤清單、分頁、偏好、台股名稱快取及選用的瀏覽器帳號同步資料。四個 host permissions 僅用來讀取 Yahoo Finance 公開搜尋／報價 JSON，以及 TWSE／TPEx 公開公司與 ETF 名稱資料。擴充功能不讀取一般網頁內容或瀏覽紀錄。

彈出視窗開啟時每 5 秒查詢報價；關閉彈出視窗後即停止，不會持續在背景輪詢。點擊股票卡只會由使用者主動開啟 Yahoo 股市或玩股網頁面。
```

## 8. 隱私權政策全文

以下內容應發布為公開 HTTPS 網頁，再把網址填入 Chrome Web Store 的 Privacy policy URL。發布前請把 `[開發者聯絡信箱]` 換成真實信箱。

---

# 上班偷偷看股票 隱私權政策

最後更新日期：2026 年 8 月 16 日

「上班偷偷看股票」（以下稱「本擴充功能」）重視使用者隱私。本政策說明本擴充功能如何處理、儲存、使用及傳送資料。

## 一、功能與資料處理摘要

本擴充功能讓使用者建立股票與 ETF 自選清單，並從 Chrome 工具列彈出視窗查看公開報價、漲跌與短期 K 線。使用者的追蹤清單與偏好預設儲存在瀏覽器本機；只有使用者主動開啟跨裝置同步時，相關資料才會交由目前瀏覽器帳號的同步服務保存。

本擴充功能不包含廣告、分析追蹤、社群追蹤器，也沒有由開發者營運的資料收集或股票報價伺服器。

## 二、處理的資料

為提供使用者主動要求的功能，本擴充功能會處理：

1. 使用者輸入的股票代號、公司名稱或 ETF 名稱搜尋文字。
2. 使用者加入的股票代號、顯示名稱、排列順序及所屬分頁。
3. 使用者設定的分頁名稱、目前分頁、股票詳細頁網站偏好及同步開關。
4. 瀏覽器同步所需的更新時間、裝置識別亂數與資料校驗資訊。裝置識別亂數不是硬體序號，也不包含姓名、電子郵件或帳號資料。
5. 從 TWSE／TPEx 下載並在本機快取的公開台股公司及 ETF 名稱資料。

本擴充功能不會要求或保存使用者的姓名、電子郵件地址、電話、精確位置、密碼、驗證 Cookie、銀行帳戶、信用卡、券商帳戶、持股數量、購入成本、交易紀錄或付款資料。

## 三、資料用途

上述資料只用於：

1. 搜尋及驗證使用者指定的股票代號。
2. 取得並顯示公開股票報價、漲跌與 K 線。
3. 保存及還原使用者的追蹤清單、分頁、排序與偏好。
4. 在使用者主動選擇時，透過瀏覽器帳號進行跨裝置同步。
5. 產生及驗證使用者主動匯出或匯入的 JSON 存檔。

這些資料不會用於廣告、跨網站追蹤、建立使用者輪廓、出售資料、信用評分、貸款或與股票報價追蹤無關的用途。

## 四、外部資料服務

本擴充功能會透過 HTTPS 使用以下公開資料服務：

1. Yahoo Finance：搜尋股票與 ETF、驗證代號、取得報價、一分鐘 K 線及成交量。使用者輸入的搜尋文字或股票代號可能包含在傳送給 Yahoo Finance 的請求中。
2. 臺灣證券交易所（TWSE）：下載公開的上市公司及 ETF 基本資料，用於顯示繁體中文名稱。
3. 證券櫃檯買賣中心（TPEx）：下載公開的上櫃公司及 ETF 資料，用於顯示繁體中文名稱。

這些服務可能依其自身政策處理正常網路連線資訊，例如 IP 位址、請求時間、使用者代理資訊及所請求的資料。開發者不控制這些第三方服務的資料處理方式，使用者可另行查閱各資料提供者的隱私政策與服務條款。

本擴充功能不會下載或執行遠端 JavaScript、WebAssembly 或其他遠端可執行程式碼；遠端回應只作為市場及名稱資料解析。

## 五、本機儲存、同步與匯出

1. 本機儲存：追蹤清單、分頁、偏好及快取使用 Chrome Storage API 儲存在瀏覽器內。台股名稱快取通常在 24 小時後重新下載。
2. 跨裝置同步：預設關閉。只有使用者主動開啟時，追蹤清單、分頁、分頁名稱、目前分頁及網站偏好才會寫入 `chrome.storage.sync`，並由瀏覽器帳號的同步服務處理。Chrome 與 Edge 的帳號同步服務彼此不直接互通。
3. JSON 匯出／匯入：使用者可主動下載 JSON 存檔，或選擇本機 JSON 檔案匯入。檔案的位置、備份與刪除由使用者自行控制。

開發者無法登入或查看使用者瀏覽器本機、瀏覽器帳號同步空間或使用者匯出的 JSON 檔案。

## 六、保留與刪除

追蹤清單及偏好會保留在瀏覽器內，直到使用者在擴充功能中移除、以其他存檔替換、清除擴充功能資料或解除安裝。同步副本的保存與刪除另受使用者目前瀏覽器帳號及其同步服務管理。

台股公開名稱快取可由瀏覽器清除，且通常每 24 小時更新。即時報價與 K 線只在顯示功能所需期間使用，不由本擴充功能建立永久成交資料庫。

## 七、資料分享、出售與廣告

本擴充功能不出售使用者資料，不將資料提供給資料仲介、廣告商或分析服務，也不使用個人化、再行銷或興趣式廣告。

只有為了提供使用者主動要求的搜尋、報價與名稱功能，才會向前述公開資料服務傳送必要的搜尋文字、股票代號或一般網路請求。

## 八、Chrome Web Store Limited Use

本擴充功能對使用者資料的使用遵守 Chrome Web Store User Data Policy，包括 Limited Use requirements。資料只會用於提供或改善本擴充功能清楚揭露的單一用途，不會用於與該用途無關的目的、信用評分或貸款。

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## 九、資訊安全

本擴充功能只透過 HTTPS 連線到已在 Manifest 宣告的市場資料服務。匯入存檔會檢查檔案大小、格式、版本、命名空間、股票代號及分頁關聯；瀏覽器同步資料會分塊並附加校驗碼。

任何網路傳輸或軟體都無法保證絕對安全。使用者應妥善保管瀏覽器帳號與自行匯出的 JSON 存檔。

## 十、兒童與敏感資料

本擴充功能不是專為兒童設計，也不會主動要求個人識別、健康、驗證、付款或其他敏感帳戶資料。

## 十一、報價與投資免責聲明

本擴充功能僅供一般資訊查看，不提供證券交易、投資帳戶、持倉管理、投資建議、招攬或保證。公開報價可能延遲、錯誤、缺漏或暫時無法使用。使用者不應將本擴充功能顯示的內容作為交易或其他財務決策的唯一依據。

## 十二、政策變更

若本擴充功能新增資料處理方式或本政策有重大變更，開發者會更新本頁面的內容與最後更新日期，並依適用要求更新 Chrome Web Store 的隱私揭露。

## 十三、聯絡方式

如對本政策或資料處理方式有疑問，請聯絡：

```text
[開發者聯絡信箱]
```

---

## 9. 最終送審檢查表

- [ ] 上傳 `StockTicker-1.2.0.zip`
- [ ] 確認後台讀到名稱「上班偷偷看股票」、版本 `1.2.0`
- [ ] 確認 Manifest 權限只有 `storage` 與四個必要 host permissions
- [ ] 貼上詳細說明並選擇繁體中文、Productivity
- [ ] 上傳 128×128 ICON、至少一張操作截圖、440×280 小型宣傳圖
- [ ] Mature content 選「否」
- [ ] 填寫單一用途、storage 及四個 host permission 說明
- [ ] Remote code 選「否」
- [ ] 依本文件完成資料類型與全部 Limited Use 認證
- [ ] 隱私政策已發布在未登入也能讀取的 HTTPS 網址
- [ ] 後台隱私政策網址與開發者聯絡信箱已填妥
- [ ] In-app purchases 選「否」
- [ ] 選擇 Public／Private／Unlisted 與發布地區
- [ ] 完成 Trader／Non-Trader 聲明及必要驗證
- [ ] 以全新 Chrome 使用者資料依測試步驟完整測試
- [ ] 送出審核前再次核對商店申報、隱私政策與實際程式行為一致

## 官方參考資料

- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Supplying Images](https://developer.chrome.com/docs/webstore/images)
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Set up distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Set up your developer account](https://developer.chrome.com/docs/webstore/set-up-account/)
- [Trader verification FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)
- [Provide test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)
