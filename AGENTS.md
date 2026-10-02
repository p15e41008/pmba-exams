# Repository Guidelines

## 入口與修改邊界

GitHub Pages 靜態網站，沒有安裝或建置步驟；前端依賴由 CDN 載入。

- `index.html`：頁面、樣式、題庫載入、篩選、作答與 LocalStorage；日常功能修改集中在此。
- 根目錄 `.xlsx`：題庫資料；更新／新增題庫先讀 `README.md > 二、維護說明`，保留既有檔名與九個欄位，新增來源同步更新 `EXCEL_SOURCES`。
- `tests/answer-scoring.test.cjs`：答案、作答紀錄、計分及快捷鍵回歸；沿用現有測試環境。
- `_archive/`：歷史快照，保留作參考。

## 驗證

```powershell
uv run --python 3.13 run_server.py
node --test tests/answer-scoring.test.cjs
```

伺服器停用 HTTP 快取，開啟 `http://localhost:8080/`；Node.js 18+ 測試無需 npm 套件。

- 答案、作答狀態、計分或快捷鍵變更：執行上述回歸測試。
- 介面變更：依 `README.md > 三、開發者測試指引` 驗證桌面、手機與鍵盤路徑，PR 附桌面及手機截圖。
- 題庫更新：使用無痕視窗驗證首次載入；曾手動匯入時，先按「重新整理題庫」再驗官方更新。

## 工作規則

- 沿用修改區域格式與命名；文字檔 UTF-8 without BOM，重用現有函式，保持修改範圍集中。
- GitHub issue／PR 的例行建立、編輯與標籤操作，依已授權任務直接執行；本專案不採外部 API 寫入一律先問的預設。
- Commit 僅在使用者明確要求時執行，格式 `type(scope): 中文描述`；開始修改及提交前查 `git status`，保留他人變更。
- 共用密碼是公開原始碼中的「門簾」；修改相關行為先讀 `docs/adr/0001-static-password-is-a-curtain-not-a-lock.md`，機密資料留在 repo 外。
- 查部署狀態與已知限制讀 `docs/current-status.md`；涉及狀態判斷時再核對最新 GitHub 資料。

## Agent skills

### Issue tracker

GitHub `p15e41008/pmba-exams`；讀取或發布 issues／specs 時讀 `docs/agents/issue-tracker.md`。

### Triage labels

Matt 預設五種狀態標籤；分類或更新狀態時讀 `docs/agents/triage-labels.md`。

### Domain docs

單一領域（single-context）；探索或撰寫用語前依 `docs/agents/domain.md` 讀 `GLOSSARY.md` 指向的正典與相關 ADRs。

接手 skill 安裝前的 issues 時，參考 `docs/matt-issue-migration.md` 的路徑，再讀最新 issue 與 comments。
