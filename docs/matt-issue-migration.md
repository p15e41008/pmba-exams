# 既有 issues 接入 Matt

更新：2026-10-02。Matt setup 已完成；八張既有 issue 保留原編號與驗收，由 [PR #6](https://github.com/p15e41008/pmba-exams/pull/6) 整合審查，行銷期末考結束後才可合併。

## 正典入口

- `AGENTS.md`：技能路由與專案規則。
- `docs/agents/issue-tracker.md`、`triage-labels.md`、`domain.md`：Matt 模板的 tracker、標籤與領域設定。
- `GLOSSARY.md`：指向術語正典 `CONTEXT.md`。
- `docs/specs/issue-batch.md`：原始 issue、已接受決策與整合順序。
- `docs/evidence/pr6/validation.md`：本輪驗證與限制。

## 接手流程

依 `/ask-matt`，使用者自己建立的工作不走 `/triage`。本批釐清需求後以 `/implement-spec` 分組實作，再整合回 PR #6；沒有為了模板重建或關閉 issue。

保留預設標籤：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。#7–#13 已加 `ready-for-agent`；#5 由既有 PR 接手。即時狀態以 GitHub 為準。

## 已接受決策

- #8：預設隨機、全部題目；設定僅在頁面內沿用，不新增跨開站保存。首頁保留尚未作答篩選；複習入口取消此篩選。取消全部選題時提示重新選取。
- #10：練習與結算均以「答對／已作答」計算正確率，另外顯示答錯與未作答；存在未作答或未知答案時不宣稱滿分。
- #7：答錯自動加入複習；改答或重測答對仍保留，由使用者手動取消。

後續先讀原 issue 全文、comments 與 PR，再用對應 Matt skill。合併後由 PR 的 `Closes` 關閉原 issue；本輪不直接合併。
