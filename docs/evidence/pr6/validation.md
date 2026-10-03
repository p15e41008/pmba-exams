# PR #6 驗證

日期：2026-10-02；契約：`docs/specs/issue-batch.md`。原始需求：#5、#7、#8、#9、#10、#11、#12、#13。

## 可重跑檢查

```powershell
node --test tests/answer-scoring.test.cjs
uv run --python 3.13 run_server.py
# 另一個終端；須安裝 Chrome
uv run --python 3.13 --script tests/browser-workflow.py
```

Node 回歸 16 項涵蓋快捷鍵、答案辨識、複習保存、選取保留、清空保存、順序取消、計分及彈窗守衛；功能先加入失敗檢查，再修正。

瀏覽器使用隔離 Chrome context，先實際載入官方 Excel，再以四題資料驗證桌面 1280×900 與手機 390×844。

| Issue | 驗證內容 |
| --- | --- |
| #5 | A/Z、B/X、C、D/V 的 Node 回歸；瀏覽器操作 Z、C |
| #7 | 錯答標記、改答／重測答對仍保留、重載保留 |
| #8 | 一次開始、進階區收合、頁面設定、複習包含已作答題、限制題數 |
| #9 | 清空後重載仍清空，複習不受影響；Node 驗證取消 |
| #10 | 答對 2、答錯 0、未作答 2，正確率 100% 仍不顯示滿分；重測全對才滿分 |
| #11 | 取消順序變更保留作答與位置；確認後重設，依相同設定再抽一輪保留最新順序 |
| #12 | 取消選取後修改另一題標記，桌面／手機選取數均保留 |
| #13 | 焦點按鈕 Enter／Space 只作答一次；三種彈窗名稱、Tab 循環、Escape、焦點返回；原快捷鍵仍可用 |

原版曾重現焦點答案按鈕 Enter 直接換題、作答數為零。整合時發現原生 dialog 的 Tab 邊界可逸出，已在共用入口修正並回歸。

跨模型檢查發現切換順序後重開會還原舊設定；新增 Node 與真實 Chrome 失敗檢查後，同步已接受的新順序，16／16 回歸及桌面／手機流程通過。其餘兩項建議經查核：複習入口關閉尚未作答符合 #7 明文；返回清單重選為既有行為，#12 的範圍是更新標記時保留選取。

## 畫面證據

- 原版：[桌面](before-desktop.png)、[手機](before-mobile.png)、[鍵盤重現](before-keyboard.png)。
- 官方題庫新版：[桌面](after-first-load.png)、[手機](after-first-load-mobile.png)。
- 結算：[桌面](after-summary-desktop.png)、[手機](after-summary-mobile.png)。

手機檢查為 Chrome 窄視窗模擬，未涵蓋 iOS／Android 實機。未新增正式前端依賴；測試透過 uv 暫存 Playwright。

## 回復

PR 尚未合併，行銷期末考結束後才可合併。程式可回復原分支版本；沒有修改既有 LocalStorage 鍵或格式。使用者確認清空是刻意的資料刪除，回復程式不能恢復已清空紀錄；本輪測試只使用隔離資料。
