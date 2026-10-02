# 既有 issues 接入 Matt

查核日期：2026-10-02。狀態：本地 setup 與 GitHub 分類／就緒標籤已完成；#8、#10 的產品決策待釐清。

## 採用路徑

本地 `/setup-matt-pocock-skills` 已完成，再補齊既有 issue 的實作契約。保留原編號、需求與驗收，不為格式一致而重建 issues。

依 `/ask-matt`，自己建立的工作不走 `/triage`。範圍明確的 issue 可直接交 `/implement`；需要產品決策的先走 `/grill-with-docs`，只有超出單次 session 的工作才走 `/to-spec` → `/to-tickets`。

本文件記錄接入路徑與待決事項；原始需求以 GitHub issue 全文為準。下一次接手時重新讀取 issue、comments 與相關 PR，避免使用此快照判斷即時狀態。

## 8 個 issues 的接手路徑

| Issue | 查核結果 | 下一步 | 已套用類別／狀態 |
| --- | --- | --- | --- |
| [#5 選擇題快捷鍵](https://github.com/p15e41008/pmba-exams/issues/5) | 目前分支已實作，HEAD `5165c1e`；[PR #6](https://github.com/p15e41008/pmba-exams/pull/6) 未合併 | review 現有 PR、補瀏覽器驗證；PR 指定 10/5 起才可合併，且含 `Closes #5` | enhancement；待 review／合併，不再派實作 |
| [#9 清空作答紀錄保存](https://github.com/p15e41008/pmba-exams/issues/9) | 清空記憶體後缺少既有保存呼叫，範圍與取消路徑明確 | `/implement #9`，沿用既有 Node 測試環境驗證保存與重新載入 | bug／ready-for-agent |
| [#11 切換順序提示重開](https://github.com/p15e41008/pmba-exams/issues/11) | 重排前未確認，會直接清空本輪作答 | `/implement #11`，驗證取消時所有本輪狀態保留、確認後才重設 | bug／ready-for-agent |
| [#12 更新複習保留選取](https://github.com/p15e41008/pmba-exams/issues/12) | 更新標記走篩選流程，會重建成全選；issue 已定義候選移除的行為 | `/implement #12`；修正在共用選取／篩選流程，保留一般切換題庫與篩選原有行為 | bug／ready-for-agent |
| [#7 答錯自動加入複習](https://github.com/p15e41008/pmba-exams/issues/7) | 規則完整；有效作答入口目前只保存已作答紀錄 | `/implement #7`；沿用原保存格式，驗證答對後仍保留標記及複習篩選互動 | enhancement／ready-for-agent |
| [#10 結算區分未作答](https://github.com/p15e41008/pmba-exams/issues/10) | 練習中用已作答數作分母，結算用總題數；滿分分支只看有無錯題 | `/grill-with-docs` 決定正確率含義，再 `/implement #10` | bug；決策待確認，暫不標 ready-for-agent |
| [#8 開始練習直接開刷](https://github.com/p15e41008/pmba-exams/issues/8) | 核心 UX 已確認；現有預設為隨機、全部題目，尚未作答篩選預設開啟 | 先釐清下列設定生命週期，再 `/implement #8`；若實際需要多 session 才產 spec 與子票 | enhancement；決策待確認，暫不標 ready-for-agent |
| [#13 鍵盤與彈窗操作](https://github.com/p15e41008/pmba-exams/issues/13) | 靜態程式仍可能攔截有焦點按鈕的 Enter／Space；尚未實際瀏覽器重現 | `/implement #13`，第一步重現鍵盤路徑，再選實作方案；保留所有焦點、語意與瀏覽器驗收 | bug＋accessibility／ready-for-agent；以重現開始 |

`ready-for-agent` 表示已有可執行契約，不表示 bug 已於本輪瀏覽器重現。#9–#12 的重現證據來自原 issue；本輪只查核程式。#13 原 issue 明確只有靜態發現。

## 待釐清的產品決策

- **#10 正確率**：練習中與結算都使用「答對／已作答」，或分別清楚標示「作答正確率」與「本輪得分率（答對／總題數）」？建議保留兩者的用途並改成不同名稱，另顯示答對、答錯、未作答數。無法辨識答案的題目如何呈現，也須明確；不能顯示全數答對。
- **#8 設定生命週期**：本頁內調整的題數與順序是否沿用到下一輪、切換題庫與重新開站？建議先維持現有的頁面內設定，不新增跨開站保存。首頁預設「尚未作答」是否保留？原 issue 只說沿用既有預設，整理時不擅自取消。使用者在進階選取取消全部時，應提示重新選取，避免靜默改練全部。

上列均為待確認建議，不能當成已接受需求。#7 已確認的「答對保留複習標記、使用者自行取消」不重問。

## 依賴與建議順序

- #9、#11、#12 可獨立實作，沒有已確認 blocker。
- #12 → #7 是建議順序：先穩定選取，再增加自動標記；#7 驗收包含不意外全選，整合時必須檢查。這不等於已建立硬依賴。
- #8 的複習路徑採用 #7 的規則，#8 完整驗收需要 #7 的行為可用。建議將 #7 設為 #8 的 blocker，確認後才寫入 tracker。
- #13 的快捷鍵修正可先做；彈窗驗收與 #8 介面變更要互相回歸。可安排 #8 後驗收最終介面，無須把整張 #13 都硬綁在 #8 後。
- #10 與 #7 都涉及作答／結算，依序實作即可；不是功能前提，不建立硬依賴。
- 目前這批不直接交 `/implement-spec`：尚無核准 spec 與依賴圖；而且主要實作同在單一入口，逐票完成較容易整合。

## Setup 記錄

已依 skill 模板完成設定；正典為 `AGENTS.md`、`docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`、`docs/agents/domain.md` 與 `GLOSSARY.md`。術語仍由 `CONTEXT.md` 維護。

## 套用步驟與完成條件

1. 已確認：tracker 使用 GitHub，設定入口為 AGENTS.md，triage vocabulary 採預設值。
2. 已完成：加入 AGENTS.md 區塊並依 skill 模板建立三份 docs/agents 文件與 GLOSSARY.md。
3. 已完成：建立缺少的四個狀態標籤；#9、#11、#12、#7、#13 加 ready-for-agent 及類別；#8 加 enhancement、#10 加 bug；#5 加 enhancement，維持 PR 接手。保留原本文與驗收，尚未建立建議依賴。
4. #8、#10 決策落定後補入原 issue。只有真的需要拆票才走 to-spec／to-tickets；不關閉或修改其父 issue，除非另有授權。
5. 完成後，下一次可用 `/implement #9` 等原編號直接接手。實作依專案規則跑適用測試與 code-review；skill 要求自動 commit 時，仍遵守專案的明確 commit 授權規則。

## 本輪驗證

- 初次盤點讀取全部 8 個 open issues 本文、標籤與 comments；當時均無標籤或 comments。
- 查核當前分支 `fix/choice-keyboard-aliases`、PR #6 本文與相關程式／測試。
- `node --test tests/answer-scoring.test.cjs`：7／7 通過。這是現有功能基線，不涵蓋尚未實作的 #7–#13。
- GitHub 標籤建立／套用完成後回讀核對；本輪僅變更文件與標籤，未進行瀏覽器重現、功能實作或 commit。
